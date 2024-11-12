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
        const processingTime = OCRFilter.fixedProcessingTime + Math.random() * OCRFilter.variatingProcessingTime; // Base 5s + random variation
        const formattedDate = new Date().toLocaleString();
        await new Promise(resolve => setTimeout(resolve, processingTime));

        console.log(`OCR Instance ${this.id} processed image in ${processingTime}ms at ${formattedDate}`);
        return await ocr.image2text(imagePath);
    }
}

module.exports = OCRFilter;