const tesseract = require("node-tesseract-ocr")

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function image2text(path){
  await delay(5000);
  return await tesseract.recognize(path, {
    lang: "eng"
  })
}

module.exports = {
  image2text
}

