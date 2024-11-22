// consumer/translate-consumer/translate-consumer.js
const amqp = require("amqplib");
const ocr = require("./services/ocr");
const { translate } = require("./services/translate");
const { createPDF } = require("./services/pdf");
const path = require("path");
const fs = require("fs");

class TokenBucket {
  constructor(rate, capacity) {
    this.tokens = capacity;
    this.capacity = capacity;
    this.rate = rate;
    this.lastRefill = Date.now();

    setInterval(() => this.refill(), 1000);
  }

  refill() {
    const now = Date.now();
    const timePassed = (now - this.lastRefill) / 1000;
    this.tokens = Math.min(this.capacity, this.tokens + this.rate * timePassed);
    this.lastRefill = now;
  }

  consume() {
    if (this.tokens >= 1) {
      this.tokens -= 1;
      return true;
    }
    return false;
  }
}

const RABBITMQ_CONFIG = {
  url: "amqp://localhost",
  queue: "queue-based-load-leveling",
  queueOptions: {
    durable: true,
    arguments: {
      "x-message-ttl": 24 * 60 * 60 * 1000, // 24 hours
      "x-max-length": 10000,
      "x-overflow": "reject-publish",
    },
  },
};

async function startConsumer() {
  try {
    // Kết nối đến RabbitMQ
    const connection = await amqp.connect(RABBITMQ_CONFIG.url);
    const channel = await connection.createChannel();

    // Đảm bảo queue tồn tại
    await channel.assertQueue(
        RABBITMQ_CONFIG.queue,
        RABBITMQ_CONFIG.queueOptions
      );

    // // Prefetch chỉ 1 message tại một thời điểm
    // channel.prefetch(1);

    const tokenBucket = new TokenBucket(10, 20); // 10 messages per second, bucket capacity 20
        
    // Set prefetch
    channel.prefetch(5);

    console.log(" [*] Waiting for messages in %s queue", RABBITMQ_CONFIG.queue);

    // Xử lý message
    channel.consume(
      RABBITMQ_CONFIG.queue,
      async (msg) => {

        if (!tokenBucket.consume()) {
            channel.nack(msg, false, true);
            return;
        }
        if (msg !== null) {
          const fileInfo = JSON.parse(msg.content.toString());
          console.log("Received message:", fileInfo.originalPath);

          try {
            if (!fs.existsSync(fileInfo.originalPath)) {
              throw new Error(`Image file not found: ${fileInfo.originalPath}`);
            }

            const extractedText = await ocr.image2text(fileInfo.originalPath);
            const vietnameseText = await translate(extractedText);

            const uniqueSuffix =
              Date.now() + "-" + Math.round(Math.random() * 1e9);
            const outputPath = path.join(
              __dirname,
              "output",
              `${fileInfo.filename}-${uniqueSuffix}.pdf`
            );
            // console.log('Output path:', outputPath);
            await createPDF(vietnameseText, outputPath);

            // Xác nhận đã xử lý message thành công
            channel.ack(msg);

            console.log("Successfully processed file:", fileInfo.filename);
          } catch (error) {
            console.error("Error processing message:", error);
            // Trong trường hợp lỗi, có thể quyết định requeue message
            channel.nack(msg, false, true);
          }
        }
      },
      {
        noAck: false, // Bật chế độ manual acknowledgment
      }
    );
  } catch (error) {
    console.error("Error starting consumer:", error);
  }
}

// Khởi động consumer
startConsumer().catch(console.error);

// Xử lý graceful shutdown
process.on("SIGINT", async () => {
  try {
    await connection.close();
    process.exit(0);
  } catch (error) {
    console.error("Error during shutdown:", error);
    process.exit(1);
  }
});
