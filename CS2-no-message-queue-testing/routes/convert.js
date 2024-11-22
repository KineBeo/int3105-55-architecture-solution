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

router.post('/', async (req, res) => {
    const filePath = 'uploads/PngExample.png';
    try {
        await processImage(filePath);
        res.status(200).json({ message: 'Image processed successfully' });
    } catch (error) {
        console.error('Processing error:', error);
        res.status(500).json({ error: 'Error processing image' });
    }
});

module.exports = router;