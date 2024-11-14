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
const ocr = require('../utils/ocr');
const { createPDF } = require('../utils/pdf');
const { translate } = require('../utils/translate');

async function processSequentialWithBenchmarking(req, res) {
    try {
        // Start total processing time benchmarking
        const startTime = Date.now();
        // Start OCR processing time benchmarking
        const ocrStartTime = Date.now()
        const text = await ocr.image2text("./uploads/PngExample.png");
        // End OCR processing time benchmarking
        const ocrEndTime = Date.now()
        console.log(`OCR processing time: ${ocrEndTime - ocrStartTime} ms`);
        
        const viText = await translate(text);
        const pdfFile = createPDF(viText);
        // End total processing time benchmarking
        const endTime = Date.now();
        console.log(`Total processing time: ${endTime - startTime} ms`);
    } catch (e) {
        console.log(e);
    }
}

const processOCRInputs = async (inputs, ocrFilters, numOCRInstances) => {
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
        const chunkResults = await Promise.all(chunkPromises);
        ocrResults.push(...chunkResults);
    }
    return ocrResults;
};

const processPipeline = async (ocrResults) => {
    const pipeline = new Pipeline()
        .addFilter(new TranslationFilter())
        .addFilter(new PDFFilter());

    return await Promise.all(
        ocrResults.map(({ result }) => pipeline.process(result))
    );
};

const generateBenchmarkingResult = (numInputs, numOCRInstances, 
    ocrStartTime, ocrEndTime, startTime, endTime, ocrResults) => {
    const instanceUtilization = new Map();
    ocrResults.forEach(({ instanceId }) => {
        instanceUtilization.set(instanceId,
            (instanceUtilization.get(instanceId) || 0) + 1);
    });

    return {
        numInputs,
        numOCRInstances,
        OCRProcessingTime: ocrEndTime - ocrStartTime,
        totalProcessingTime: endTime - startTime,
        averageTimePerInput: (endTime - startTime) / numInputs,
        instanceUtilization: Object.fromEntries(instanceUtilization),
        theoreticalMaxParallel: Math.min(numInputs, numOCRInstances),
        actualSpeedup: (OCRFilter.averageProcessingTime * numInputs) / (ocrEndTime - ocrStartTime)
    };
};

const printBenchmarkingResult = (benchmarkingResult) => {
    console.log('\nConcurrent Pipes and Filters Implementation');
    console.log(`Number of inputs: ${benchmarkingResult.numInputs}`);
    console.log(`Number of OCR instances: ${benchmarkingResult.numOCRInstances}`);
    console.log(`OCR processing time: ${benchmarkingResult.OCRProcessingTime} ms`);
    console.log(`Total processing time: ${benchmarkingResult.totalProcessingTime} ms`);
    console.log(`Average time per input: ${benchmarkingResult.averageTimePerInput} ms`);
    console.log('Instance utilization:', benchmarkingResult.instanceUtilization);
    console.log(`Theoretical speedup: ${benchmarkingResult.theoreticalMaxParallel}x`);
    console.log(`Actual speedup: ${benchmarkingResult.actualSpeedup.toFixed(2)}x`);
};


// TEST: Create a concurrent processing pipeline for testing.
const createConcurrentPipelineWithBenchmarking = (numOCRInstances) => {
    const ocrFilters = Array.from({ length: numOCRInstances },
        (_, i) => new OCRFilter(`OCR-${i + 1}`));

    return {
        async process(fixedImagePath, numInputs) {
            const startTime = Date.now();
            const inputs = Array(numInputs).fill(fixedImagePath);

            const ocrStartTime = Date.now();
            const ocrResults = await processOCRInputs(inputs, ocrFilters, numOCRInstances);
            const ocrEndTime = Date.now();

            const finalResults = await processPipeline(ocrResults);
            const endTime = Date.now();

            const benchmarkingResult = generateBenchmarkingResult(numInputs, numOCRInstances, 
                ocrStartTime, ocrEndTime, startTime, endTime, ocrResults);
            printBenchmarkingResult(benchmarkingResult);

            return finalResults;
        }
    };
};

async function processConcurrent(req, res) {
    const numInputs = 30;
    const numOCRInstances = 10;

    console.log('Request received.');

    const fixedImagePath = 'uploads/PngExample.png';
    req.file = { path: fixedImagePath };

    if (!req.file) {
        return res.status(400).json({ error: 'No image file uploaded' });
    }

    console.log('File uploaded:', req.file);

    try {
        const pipeline = createConcurrentPipelineWithBenchmarking(numOCRInstances);
        const pdfPaths = await pipeline.process(req.file.path, numInputs);

        res.status(200).json({ files: pdfPaths });
    } catch (error) {
        console.error('Processing error:', error);
        res.status(500).json({ error: 'Error processing image' });
    }
}

router.post('/', async (req, res) => {
    processConcurrent(req, res);
});

module.exports = router;