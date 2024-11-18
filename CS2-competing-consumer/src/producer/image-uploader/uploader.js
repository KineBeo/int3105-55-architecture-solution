const express = require('express');
const multer = require('multer');
const amqp = require('amqplib');
const path = require('path');
const fs = require('fs');

const app = express();

// Cấu hình multer để lưu file upload với tên file gốc
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'src/producer/uploads/');
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname);
  }
});

const upload = multer({ storage: storage });

// Khởi tạo kết nối AMQP
let channel, connection;
async function connectQueue() {
  try {
    connection = await amqp.connect('amqp://localhost');
    channel = await connection.createChannel();
    await channel.assertQueue('image-processing-queue', { durable: true });
  } catch (error) {
    console.error('Error connecting to RabbitMQ:', error);
  }
}

connectQueue();

app.post('/upload', upload.single('image'), async (req, res) => {
  if (!req.file) {
    return res.status(400).send('No file uploaded.');
  }

  // Lưu thông tin file
  const fileInfo = {
    originalPath: req.file.path,
    filename: req.file.filename
  };

  console.log('filepath:', fileInfo.originalPath);
  // Gửi thông tin file vào queue
  channel.sendToQueue(
    'image-processing-queue',
    Buffer.from(JSON.stringify(fileInfo)),
    {
      persistent: true
    }
  );

  res.json({
    message: 'File uploaded and sent for processing',
    fileId: req.file.filename,
    filePath: req.file.path
  });
});

app.get('/status/:fileId', (req, res) => {
  // TODO: Implement status checking logic
  res.json({ status: 'processing' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Producer server running on port ${PORT}`);
});