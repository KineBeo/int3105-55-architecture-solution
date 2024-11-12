const Filter = require('./Filter');
const { createPDF } = require('../../utils/pdf');

class PDFFilter extends Filter {
    async process(text) {
        const pdfPath = createPDF(text);
        return pdfPath;
    }
}

module.exports = PDFFilter;