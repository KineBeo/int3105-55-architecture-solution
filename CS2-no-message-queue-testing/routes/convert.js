const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const upload = require('../config/multer');
const Pipeline = require('../services/Pipeline');
const OCRFilter = require('../services/filters/OCRFilter');
const TranslationFilter = require('../services/filters/TranslationFilter');
const PDFFilter = require('../services/filters/PDFFilter');

const createProcessingPipeline = () => {
    return new Pipeline()
        .addFilter(new OCRFilter())
        .addFilter(new TranslationFilter())
        .addFilter(new PDFFilter());
};

router.post('/', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No image file uploaded' });
        }

        const pipeline = createProcessingPipeline();
        const pdfPath = await pipeline.process(req.file.path);

        res.download(pdfPath, 'translated.pdf', async (err) => {
            if (err) {
                console.error('Error sending file:', err);
            }
            
            try {
                await fs.unlink(req.file.path);
            } catch (cleanupErr) {
                console.error('Cleanup error:', cleanupErr);
            }
        });

    } catch (error) {
        console.error('Processing error:', error);
        res.status(500).json({ error: 'Error processing image' });
        
        // Cleanup on error
        if (req.file) {
            try {
                await fs.unlink(req.file.path);
            } catch (cleanupErr) {
                console.error('Cleanup error:', cleanupErr);
            }
        }
    }
});

module.exports = router;