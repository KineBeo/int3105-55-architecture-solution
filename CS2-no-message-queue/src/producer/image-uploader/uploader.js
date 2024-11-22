const express = require("express");
const multer = require("multer");
const amqp = require("amqplib");
const path = require("path");
const fs = require("fs");
const rateLimit = require("express-rate-limit");
const app = express();

// Cấu hình multer để lưu file upload với tên file gốc
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "src/producer/uploads/");
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname);
  },
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
});

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

const uploadLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // limit each IP to 100 requests per minute
  message: "Too many uploads from this IP, please try again later",
});

// Khởi tạo kết nối AMQP
let channel, connection;
async function connectQueue() {
  try {
    connection = await amqp.connect(RABBITMQ_CONFIG.url);
    channel = await connection.createChannel();
    await channel.assertQueue(
      RABBITMQ_CONFIG.queue,
      RABBITMQ_CONFIG.queueOptions
    );
  } catch (error) {
    console.error("Error connecting to RabbitMQ:", error);
  }
}

connectQueue();

app.post("/upload", upload.single("image"), async (req, res) => {
  if (!req.file) {
    return res.status(400).send("No file uploaded.");
  }

  // Lưu thông tin file
  const fileInfo = {
    originalPath: req.file.path,
    filename: req.file.filename,
  };

  console.log("filepath:", fileInfo.originalPath);
  // Gửi thông tin file vào queue
  channel.sendToQueue(
    "image-processing-queue",
    Buffer.from(JSON.stringify(fileInfo)),
    {
      persistent: true,
    }
  );

  res.json({
    message: "File uploaded and sent for processing",
    fileId: req.file.filename,
    filePath: req.file.path,
  });
});

app.post('/upload/batch', 
  uploadLimiter,
  upload.array('images', 1000),
  async (req, res) => {
      if (!req.files || req.files.length === 0) {
          return res.status(400).send('No files uploaded.');
      }

      try {
          const batchSize = 50;
          const files = req.files;
          const results = [];

          for (let i = 0; i < files.length; i += batchSize) {
              const batch = files.slice(i, i + batchSize);
              
              for (const file of batch) {
                  const fileInfo = {
                      originalPath: file.path,
                      filename: file.filename,
                      timestamp: Date.now()
                  };

                  await channel.sendToQueue(
                      RABBITMQ_CONFIG.queue,
                      Buffer.from(JSON.stringify(fileInfo)),
                      {
                          persistent: true,
                          priority: file.size > 1024 * 1024 ? 1 : 2
                      }
                  );

                  results.push(fileInfo.filename);
              }

              // Add delay between batches
              await new Promise(resolve => setTimeout(resolve, 100));
          }

          res.json({
              message: `${results.length} files queued for processing`,
              files: results
          });
      } catch (error) {
          console.error('Upload error:', error);
          res.status(500).send('Error processing upload');
      }
  }
);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Producer server running on port ${PORT}`);
});
