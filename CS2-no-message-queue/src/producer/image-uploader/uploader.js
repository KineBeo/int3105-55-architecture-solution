const express = require("express");
const multer = require("multer");
const rateLimit = require("express-rate-limit");
const app = express();
const axios = require("axios");

// CONSTANTS
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const UPLOAD_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const UPLOAD_LIMIT_MAX_REQUESTS = 100;
const UPLOAD_LIMIT_MESSAGE = "Too many uploads from this IP, please try again later";

const BATCH_SIZE = 50;
const MAX_FILES = 1000;
const DELAY_BETWEEN_BATCHES = 10000; // milliseconds

const CONSUMER_URL = process.env.CONSUMER_URL || "http://localhost:3001";

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

const sendToConsumer = async (fileInfo) => {
  try {
    const response = await axios.post(`${CONSUMER_URL}/process`, fileInfo);
    return response.data;
  } catch (error) {
    throw new Error('Failed to send file to consumer');
  }
};

const processBatch = async (batch) => {
  console.log(`Processing batch of ${batch.length} files...`);
  
  // Create array of promises for concurrent execution
  const promises = batch.map(async (file) => {
    const fileInfo = createFileInfo(file);
    try {
      const result = await sendToConsumer(fileInfo);
      return result.filename;
    } catch (error) {
      return null;
    }
  });

  // Execute all promises concurrently
  const results = await Promise.all(promises);
  
  // Filter out failed requests (null values)
  return results.filter(result => result !== null);
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


const uploadLimiter = rateLimit({
  windowMs: UPLOAD_LIMIT_WINDOW_MS,
  max: UPLOAD_LIMIT_MAX_REQUESTS,
  message: UPLOAD_LIMIT_MESSAGE,
});

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
                processBatch(batch).then(batchResults => {
                  results.push(...batchResults);
                }).catch(error => {
                  console.error('Batch processing error:', error);
                });
                await delay();
            }

            console.log(`${results.length} files sent to consumer for processing`);
            res.json({
              message: `${results.length} files sent to consumer for processing`,
              files: results
            });
        } catch (error) {
            res.status(500).send('Error processing upload');
        }
    }
);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Producer server running on port ${PORT}`);
});
