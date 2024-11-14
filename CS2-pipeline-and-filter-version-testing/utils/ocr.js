const tesseract = require("node-tesseract-ocr")

// Simulate processing time by delaying execution
const delay = function (ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Base 5s + random variation between 0 and 2s
const calculateProcessingTime = function () {
  const fixedProcessingTime = 5000;
  const variatingProcessingTime = 2000;
  return fixedProcessingTime + Math.random() * variatingProcessingTime;
}

async function image2text(path) {
  const processingTime = calculateProcessingTime(); 
  await delay(processingTime);

  return await tesseract.recognize(path, {
    lang: "eng"
  })
}

module.exports = {
  image2text
}

