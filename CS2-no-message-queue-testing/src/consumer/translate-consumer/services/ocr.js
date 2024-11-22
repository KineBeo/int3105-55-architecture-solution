// services/ocr.js
const tesseract = require("node-tesseract-ocr");
const fs = require('fs');

async function image2text(path) {
    // Kiểm tra file tồn tại
    if (!fs.existsSync(path)) {
        throw new Error(`Input file not found: ${path}`);
    }

    const config = {
        lang: "eng",
        oem: 1,
        psm: 3,
    }

    try {
        const text = await tesseract.recognize(path, config);
        return text;
    } catch (error) {
        console.error('OCR Error:', error);
        throw error;
    }
}

module.exports = {
    image2text
}