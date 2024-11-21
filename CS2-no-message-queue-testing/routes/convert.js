const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const upload = require('../config/multer');
const { image2text } = require('../utils/ocr');
const { translate } = require('../utils/translate');
const { createPDF } = require('../utils/pdf');

async function processImage(imagePath) {
    const extractedText = await image2text(imagePath);
    const translatedText = await translate(extractedText);
    return createPDF(translatedText);
}

async function cleanupFile(filePath) {
    try {
        await fs.unlink(filePath);
    } catch (cleanupErr) {
        console.error('Cleanup error:', cleanupErr);
    }
}

router.post('/', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No image file uploaded' });
        }

        const pdfPath = await processImage(req.file.path);
        
        res.download(pdfPath, 'translated.pdf', async (err) => {
            if (err) {
                console.error('Error sending file:', err);
            }
            await cleanupFile(req.file.path);
        });

    } catch (error) {
        console.error('Processing error:', error);
        res.status(500).json({ error: 'Error processing image' });
        
        if (req.file) {
            await cleanupFile(req.file.path);
        }
    }
});

module.exports = router;