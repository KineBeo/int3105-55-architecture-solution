const tesseract = require("node-tesseract-ocr")

const fixedProcessingTime = 5000;
const variatingProcessingTime = 2000;

async function image2text(path) {
  const processingTime = fixedProcessingTime + Math.random() * variatingProcessingTime; // Base 5s + random variation
  await new Promise(resolve => setTimeout(resolve, processingTime));
  return await tesseract.recognize(path, {
    lang: "eng"
  })
}

module.exports = {
  image2text
}

