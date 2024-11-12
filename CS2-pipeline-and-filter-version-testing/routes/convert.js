"use strict";

const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const upload = require('../config/multer');
const Pipeline = require('../services/Pipeline');
const OCRFilter = require('../services/filters/OCRFilter');
const TranslationFilter = require('../services/filters/TranslationFilter');
const PDFFilter = require('../services/filters/PDFFilter');
const path = require('path');

// TEST: Removed sequential processing pipeline for testing.
// const createProcessingPipeline = () => {
//     return new Pipeline()
//         .addFilter(new OCRFilter())
//         .addFilter(new TranslationFilter())
//         .addFilter(new PDFFilter());
// };

// TEST: Create a concurrent processing pipeline for testing.
const createConcurrentPipeline = (numOCRInstances) => {
    const ocrFilters = Array.from({ length: numOCRInstances },
        (_, i) => new OCRFilter());

    return {
        async process(fixedImagePath, numInputs) {
            const inputs = Array(numInputs).fill(fixedImagePath);

            // Distribute inputs across OCR filters
            const ocrPromises = inputs.map((input, index) => {
                const ocrFilter = ocrFilters[index % numOCRInstances];
                return ocrFilter.process(input);
            });

            // Process OCR in parallel
            const ocrResults = await Promise.all(ocrPromises);

            // Create sequential pipelines for remaining filters
            const pipeline = new Pipeline()
                .addFilter(new TranslationFilter())
                .addFilter(new PDFFilter());

            // Process remaining filters
            const finalResults = await Promise.all(
                ocrResults.map(result => pipeline.process(result))
            );

            return finalResults;
        }
    };
};

async function processConcurrent(req, res) {
    try {
        // TEST: Check if request reaches this router.
        console.log('Request received.')

        // TEST: Set a fixed path for the test image file.
        const fixedImagePath = 'uploads/PngExample.png';
        req.file = { path: fixedImagePath };

        if (!req.file) {
            return res.status(400).json({ error: 'No image file uploaded' });
        }

        // RESEARCH: Check req.file.path structure.
        console.log('File uploaded:', req.file);
        console.log('File path:', req.file.path);

        const pipeline = createConcurrentPipeline(1);
        // TEST: Start benchmarking.
        const startTime = Date.now();
        const pdfPaths = await pipeline.process(req.file.path, 5);
        // TEST: End benchmarking.
        const endTime = Date.now();

        // TEST: Send the paths of the saved files as the response
        res.status(200).json({ files: pdfPaths });

        // TEST: Remove user download action.
        // res.download(pdfPath, 'translated.pdf', async (err) => {
        //     if (err) {
        //         console.error('Error sending file:', err);
        //     }

        //     // TEST: Remove deleting uploaded file upon success.
        //     // try {
        //     //     await fs.unlink(req.file.path);
        //     // } catch (cleanupErr) {
        //     //     console.error('Cleanup error:', cleanupErr);
        //     // }
        // });
        console.log('Processing time:', endTime - startTime, 'ms');
    } catch (error) {
        console.error('Processing error:', error);
        res.status(500).json({ error: 'Error processing image' });

        // TEST: Remove deleting uploaded file upon success.
        // Cleanup on error
        // if (req.file) {
        //     try {
        //         await fs.unlink(req.file.path);
        //     } catch (cleanupErr) {
        //         console.error('Cleanup error:', cleanupErr);
        //     }
        // }
    }
}

router.post('/', async (req, res) => {
    processConcurrent(req, res);
});

module.exports = router;