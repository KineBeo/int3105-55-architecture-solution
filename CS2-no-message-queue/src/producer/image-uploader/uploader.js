const express = require("express");
const multer = require("multer");
const amqp = require("amqplib");
const rateLimit = require("express-rate-limit");
const app = express();

// CONSTANTS
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

const RABBITMQ_URL = "amqp://localhost";
const RABBITMQ_QUEUE = "queue-based-load-leveling";
const RABBITMQ_QUEUE_TTL = 24 * 60 * 60 * 1000; // 24 hours
const RABBITMQ_MAX_LENGTH = 10000;
const RABBITMQ_OVERFLOW = "reject-publish";

const UPLOAD_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const UPLOAD_LIMIT_MAX_REQUESTS = 100;
const UPLOAD_LIMIT_MESSAGE = "Too many uploads from this IP, please try again later";

const BATCH_SIZE = 50;
const MAX_FILES = 1000;
const DELAY_BETWEEN_BATCHES = 100; // milliseconds
const LARGE_FILE_SIZE = 1024 * 1024; // 1MB
const HIGH_PRIORITY = 1;
const LOW_PRIORITY = 2;

// HELPER FUNCTIONS
const createFileInfo = (file) => ({
  originalPath: file.path,
  filename: file.filename,
  timestamp: Date.now()
});

const validateFiles = (files) => {
  if (!files || files.length === 0) {
      throw new Error('No files uploaded.');
  }
  return files;
}

const getMessagePriority = (fileSize) => 
  fileSize > LARGE_FILE_SIZE ? HIGH_PRIORITY : LOW_PRIORITY;

const queueFile = async (channel, fileInfo, fileSize) => {
  await channel.sendToQueue(
      RABBITMQ_CONFIG.queue,
      Buffer.from(JSON.stringify(fileInfo)),
      {
          persistent: true,
          priority: getMessagePriority(fileSize)
      }
  );
  return fileInfo.filename;
};

const processBatch = async (batch, channel) => {
  const results = [];
  for (const file of batch) {
      const fileInfo = createFileInfo(file);
      const filename = await queueFile(channel, fileInfo, file.size);
      results.push(filename);
  }
  return results;
};

const delay = () => new Promise(resolve => 
  setTimeout(resolve, DELAY_BETWEEN_BATCHES)
);

// MAIN IMPLEMENTATION
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
    fileSize: MAX_FILE_SIZE,
  },
});

const RABBITMQ_CONFIG = {
  url: RABBITMQ_URL,
  queue: RABBITMQ_QUEUE,
  queueOptions: {
    durable: true,
    arguments: {
      "x-message-ttl": RABBITMQ_QUEUE_TTL,
      "x-max-length": RABBITMQ_MAX_LENGTH,
      "x-overflow": RABBITMQ_OVERFLOW,
    },
  },
};

const uploadLimiter = rateLimit({
  windowMs: UPLOAD_LIMIT_WINDOW_MS,
  max: UPLOAD_LIMIT_MAX_REQUESTS,
  message: UPLOAD_LIMIT_MESSAGE,
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

// Batch upload
app.post('/upload/batch',
    uploadLimiter,
    upload.array('images', MAX_FILES),
    async (req, res) => {
        try {
            const files = validateFiles(req.files);
            const results = [];

            for (let i = 0; i < files.length; i += BATCH_SIZE) {
                const batch = files.slice(i, i + BATCH_SIZE);
                const batchResults = await processBatch(batch, channel);
                results.push(...batchResults);
                await delay();
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
