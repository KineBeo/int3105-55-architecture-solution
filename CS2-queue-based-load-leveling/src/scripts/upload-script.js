const fs = require('fs');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');
const readline = require('readline');

const IMAGE_PATH = path.join(__dirname, '../producer/uploads/i-1.png');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const uploadImage = async (copies) => {
  const formData = new FormData();
  
  for (let i = 0; i < copies; i++) {
    formData.append('images', fs.createReadStream(IMAGE_PATH), `i-1-copy${i}.png`);
  }

  try {
    const response = await axios.post('http://localhost:3000/upload/batch', formData, {
      headers: formData.getHeaders(),
    });
    console.log('Upload successful:', response.data);
  } catch (error) {
    console.error('Error uploading image:', error);
  }
};

// Prompt for copies and run upload
rl.question('How many copies would you like to upload? ', (answer) => {
  const copies = parseInt(answer);
  
  if (isNaN(copies) || copies <= 0) {
    console.error('Please enter a valid positive number');
    rl.close();
    return;
  }
  
  uploadImage(copies).finally(() => rl.close());
});
