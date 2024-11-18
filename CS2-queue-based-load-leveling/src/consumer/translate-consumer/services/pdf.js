const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

function createPDF(text, outputPath) {
    const doc = new PDFDocument();
    const fontPath = path.join(__dirname, '../font/Roboto-Regular.ttf');
    doc.pipe(fs.createWriteStream(outputPath));
    doc.font(fontPath)
        .fontSize(14)
        .text(text, 100, 100);
    doc.end();
    return outputPath;
}

module.exports = {
    createPDF
}