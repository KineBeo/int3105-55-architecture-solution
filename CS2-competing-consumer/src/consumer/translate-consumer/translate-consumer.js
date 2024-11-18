// consumer/translate-consumer/translate-consumer.js
const amqp = require('amqplib');
const ocr = require('./services/ocr');
const { translate } = require('./services/translate');
const { createPDF } = require('./services/pdf');
const path = require('path');
const fs = require('fs');


async function startConsumer() {
    try {
        // Kết nối đến RabbitMQ
        const connection = await amqp.connect('amqp://localhost');
        const channel = await connection.createChannel();
        
        const queue = 'image-processing-queue';
        
        // Đảm bảo queue tồn tại
        await channel.assertQueue(queue, {
            durable: true
        });

        // Prefetch chỉ 1 message tại một thời điểm
        channel.prefetch(1);

        console.log(' [*] Waiting for messages in %s queue', queue);

        // Xử lý message
        channel.consume(queue, async (msg) => {
            if (msg !== null) {
                const fileInfo = JSON.parse(msg.content.toString());
                console.log('Received message:', fileInfo.originalPath);
                
                try {

                    if (!fs.existsSync(fileInfo.originalPath)) {
                        throw new Error(`Image file not found: ${fileInfo.originalPath}`);
                      }
            
                    // 1. OCR xử lý ảnh sang text
                    // console.log('Processing OCR for file:', fileInfo.filename);
                    const extractedText = await ocr.image2text(fileInfo.originalPath);

                    // 2. Dịch text sang tiếng Việt
                    // console.log('Translating text to Vietnamese');
                    const vietnameseText = await translate(extractedText);

                    // 3. Tạo PDF
                    // console.log('Creating PDF');
                    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
                    const outputPath = path.join(__dirname, 'output', `${fileInfo.filename}-${uniqueSuffix}.pdf`);
                    // console.log('Output path:', outputPath);
                    await createPDF(vietnameseText, outputPath);

                    // Xác nhận đã xử lý message thành công
                    channel.ack(msg);
                    
                    console.log('Successfully processed file:', fileInfo.filename);

                } catch (error) {
                    console.error('Error processing message:', error);
                    // Trong trường hợp lỗi, có thể quyết định requeue message
                    channel.nack(msg, false, true);
                }
            }
        }, {
            noAck: false // Bật chế độ manual acknowledgment
        });

    } catch (error) {
        console.error('Error starting consumer:', error);
    }
}

// Khởi động consumer
startConsumer().catch(console.error);

// Xử lý graceful shutdown
process.on('SIGINT', async () => {
    try {
        await connection.close();
        process.exit(0);
    } catch (error) {
        console.error('Error during shutdown:', error);
        process.exit(1);
    }
});