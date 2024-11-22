// consumer/translate-consumer/translate-consumer.js
const express = require('express');
const ocr = require("./services/ocr");
const { translate } = require("./services/translate");
const { createPDF } = require("./services/pdf");
const path = require("path");
const fs = require("fs");

// Request limiting mechanism
const MAX_CONCURRENT_REQUESTS = 3; // Maximum number of concurrent requests
let currentRequests = 0;

const app = express();
app.use(express.json());

// HTTP endpoint that receives direct requests from producer.
app.post('/process', async (req, res) => {
  // Check if we've reached the maximum number of concurrent requests
  if (currentRequests >= MAX_CONCURRENT_REQUESTS) {
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
  }
});

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("Shutting down server...");
  process.exit(0);
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Consumer service running on port ${PORT}`);
});
