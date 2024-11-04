const amqp = require('amqplib');
const { image2text } = require('../utils/ocr');
const { translate } = require('../utils/translate');
const { createPDF } = require('../utils/pdf');

async function startConsumer() {
  try {
    const connection = await amqp.connect('amqp://localhost');
    const channel = await connection.createChannel();
    const queue = 'image_processing';

    await channel.assertQueue(queue, {
      durable: true
    });

    channel.prefetch(1);
    
    console.log('Waiting for messages...');

    channel.consume(queue, async (msg) => {
      if (msg !== null) {
        const data = JSON.parse(msg.content.toString());
        
        try {
          // Process image to text
          const text = await image2text(data.imagePath);
          console.log('OCR completed');

          // Translate text
          const viText = await translate(text);
          console.log('Translation completed');

          // Create PDF with jobId as filename
          const pdfFile = await createPDF(viText, data.jobId);
          console.log('PDF created:', pdfFile);

          channel.ack(msg);
        } catch (error) {
          console.error('Processing error:', error);
          channel.nack(msg);
        }
      }
    });
  } catch (error) {
    console.error('Consumer error:', error);
  }
}

module.exports = { startConsumer };
