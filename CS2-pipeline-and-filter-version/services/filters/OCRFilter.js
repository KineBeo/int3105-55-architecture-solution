const Filter = require('./Filter');
const ocr = require('../../utils/ocr');

class OCRFilter extends Filter {
    async process(imagePath) {
        const text = await ocr.image2text(imagePath);
        return text;
    }
}

module.exports = OCRFilter;