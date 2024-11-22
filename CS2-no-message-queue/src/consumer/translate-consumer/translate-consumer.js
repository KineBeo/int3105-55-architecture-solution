// consumer/translate-consumer/translate-consumer.js
const express = require('express');
const ocr = require("./services/ocr");
const { translate } = require("./services/translate");
const { createPDF } = require("./services/pdf");
const path = require("path");
const fs = require("fs");

// Request limiting mechanism
const MAX_CONCURRENT_REQUESTS = 5; // Maximum number of concurrent requests


const app = express();
app.use(express.json());


// STATES
let previousIgnoredRequests = 0;
let totalIgnoredRequests = 0;
let currentRequests = 0;
let consumerTimeline = [];
let firstRequestTime = null;
let previousTotalProcessedRequests = 0;
let totalProcessedRequests = 0;

// HTTP endpoint that receives direct requests from producer.
app.post('/process', async (req, res) => {
  // Initialize firstRequestTime if this is the first request
  if (firstRequestTime === null) {
    firstRequestTime = Date.now();
  }

  // Check if we've reached the maximum number of concurrent requests
  if (currentRequests >= MAX_CONCURRENT_REQUESTS) {
    totalIgnoredRequests++;
    console.log(`[Request Rejected] Maximum concurrent requests (${MAX_CONCURRENT_REQUESTS}) reached. Try again later.`);
    return res.status(503).json({
      success: false,
      message: 'Server is busy. Please try again later.'
    });
  }

  // Increment the counter before processing
  currentRequests++;

  try {
    const fileInfo = req.body;
    console.log("[Direct Request] Processing file:", fileInfo.originalPath);
    
    if (!fs.existsSync(fileInfo.originalPath)) {
      throw new Error(`Image file not found: ${fileInfo.originalPath}`);
    }

    const extractedText = await ocr.image2text(fileInfo.originalPath);
    const vietnameseText = await translate(extractedText);

    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const outputPath = path.join(
      __dirname,
      "output",
      `${fileInfo.filename}-${uniqueSuffix}.pdf`
    );

    await createPDF(vietnameseText, outputPath);
    console.log("[Direct Request] Successfully processed file:", fileInfo.filename);

    totalProcessedRequests++; // Add this line before sending success response
    res.json({ 
      success: true,
      filename: fileInfo.filename,
      outputPath
    });

  } catch (error) {
    console.error("[Direct Request] Error processing file:", error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  } finally {
    // Decrement the counter after processing
    currentRequests--;
    if (currentRequests === 0) {
      updateTimeline();
    }
  }
});


const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Consumer service running on port ${PORT}`);
});

const updateTimeline = () => {
  if (firstRequestTime !== null) {
    consumerTimeline.push({
      time: Math.round((Date.now() - firstRequestTime) / 1000 * 100) / 100,
      requests_processed: totalProcessedRequests - previousTotalProcessedRequests,
      requests_ignored: totalIgnoredRequests - previousIgnoredRequests
    });
    
    previousIgnoredRequests = totalIgnoredRequests;
    previousTotalProcessedRequests = totalProcessedRequests;
  }
};


// Graceful shutdown
process.on("SIGINT", () => {
  console.log("Shutting down server...");
  console.log('\nConsumer Timeline:');
  console.log(JSON.stringify(consumerTimeline, null, 2));
  process.exit(0);
});