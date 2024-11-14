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
const createConcurrentPipelineWithBenchmarking = (numOCRInstances) => {
    const ocrFilters = Array.from({ length: numOCRInstances },
        (_, i) => new OCRFilter(`OCR-${i + 1}`));

    return {
        async process(fixedImagePath, numInputs) {
            const startTime = Date.now();
            const inputs = Array(numInputs).fill(fixedImagePath);

            const ocrStartTime = Date.now();

            // Process inputs in chunks based on number of OCR instances
            const ocrResults = [];
            for (let i = 0; i < inputs.length; i += numOCRInstances) {
                const chunk = inputs.slice(i, i + numOCRInstances);
                const chunkPromises = chunk.map((input, chunkIndex) => {
                    const ocrFilter = ocrFilters[chunkIndex];
                    return ocrFilter.process(input)
                        .then(result => ({
                            instanceId: ocrFilter.id,
                            inputIndex: i + chunkIndex,
                            result
                        }));
                });
                // Process each chunk concurrently, but wait for chunk to complete
                const chunkResults = await Promise.all(chunkPromises);
                ocrResults.push(...chunkResults);
            }

            const ocrEndTime = Date.now();

            // Log instance utilization
            const instanceUtilization = new Map();
            ocrResults.forEach(({ instanceId }) => {
                instanceUtilization.set(instanceId,
                    (instanceUtilization.get(instanceId) || 0) + 1);
            });

            const pipeline = new Pipeline()
                .addFilter(new TranslationFilter())
                .addFilter(new PDFFilter());

            const finalResults = await Promise.all(
                ocrResults.map(({ result }) => pipeline.process(result))
            );

            const endTime = Date.now();

            // Enhanced benchmarking results
            const benchmarkingResult = {
                numInputs,
                numOCRInstances,
                OCRProcessingTime: ocrEndTime - ocrStartTime,
                totalProcessingTime: endTime - startTime,
                averageTimePerInput: (endTime - startTime) / numInputs,
                instanceUtilization: Object.fromEntries(instanceUtilization),
                theoreticalMaxParallel: Math.min(numInputs, numOCRInstances),
                actualSpeedup: (OCRFilter.averageProcessingTime * numInputs) / (ocrEndTime - ocrStartTime)
            };

            console.log('\nConcurrent Pipes and Filters Implementation');
            console.log(`Number of inputs: ${benchmarkingResult.numInputs}`);
            console.log(`Number of OCR instances: ${benchmarkingResult.numOCRInstances}`);
            console.log(`OCR processing time: ${benchmarkingResult.OCRProcessingTime} ms`);
            console.log(`Total processing time: ${benchmarkingResult.totalProcessingTime} ms`);
            console.log(`Average time per input: ${benchmarkingResult.averageTimePerInput} ms`);
            console.log('Instance utilization:', benchmarkingResult.instanceUtilization);
            console.log(`Theoretical speedup: ${benchmarkingResult.theoreticalMaxParallel}x`);
            console.log(`Actual speedup: ${benchmarkingResult.actualSpeedup.toFixed(2)}x`);

            return finalResults;
        }
    };
};
async function processConcurrent(req, res) {
    const numInputs = 30;
    const numOCRInstances = 10;
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

        const pipeline = createConcurrentPipelineWithBenchmarking(numOCRInstances);
        const pdfPaths = await pipeline.process(req.file.path, numInputs);


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