const amqp = require('amqplib');

async function publishToQueue(queue, message) {
  try {
    const connection = await amqp.connect('amqp://localhost');
    const channel = await connection.createChannel();
    
    await channel.assertQueue(queue, {
      durable: true
    });
    
    channel.sendToQueue(queue, Buffer.from(JSON.stringify(message)), {
      persistent: true
    });
    
    setTimeout(() => {
      connection.close();
    }, 500);
  } catch (error) {
    console.error('Error publishing to queue:', error);
    throw error;
  }
}

module.exports = { publishToQueue };