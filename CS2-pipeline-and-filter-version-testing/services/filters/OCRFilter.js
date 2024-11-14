const Filter = require('./Filter');
const ocr = require('../../utils/ocr');

class OCRFilter extends Filter {
    static fixedProcessingTime = 5000;
    static variatingProcessingTime = 2000;
    static averageProcessingTime = OCRFilter.fixedProcessingTime + OCRFilter.variatingProcessingTime / 2;

    constructor(id) {
        super();
        this.id = id;
    }

    async process(imagePath) {
        // Simulate varying processing times to better demonstrate concurrency
        const formattedDate = new Date().toLocaleString();

        const startTime = Date.now();
        const result = await ocr.image2text(imagePath);
        const endTime = Date.now();
        const processingTime = endTime - startTime;
        console.log(`OCR Instance ${this.id} processed image in ${processingTime}ms at ${formattedDate}`);
        return result;
    }
}

module.exports = OCRFilter;