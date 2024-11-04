const express = require('express');
const multer = require('multer');
const path = require('path');
const { publishToQueue } = require('./queue/publisher');
const { startConsumer } = require('./queue/consumer');

const app = express();
const port = 3000;

// Cấu hình multer để lưu file upload
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/')
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname))
  }
});

const upload = multer({ storage: storage });

// Endpoint để upload ảnh
app.post('/convert', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const jobId = Date.now().toString();
    const message = {
      jobId,
      imagePath: req.file.path
    };

    // Publish message vào queue
    await publishToQueue('image_processing', message);

    res.json({ 
      message: 'File uploaded and processing started',
      jobId: jobId
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Endpoint để check status và download PDF
app.get('/status/:jobId', (req, res) => {
  const jobId = req.params.jobId;
  const pdfPath = `./output/${jobId}.pdf`;
  
  if (require('fs').existsSync(pdfPath)) {
    res.download(pdfPath);
  } else {
    res.json({ status: 'processing' });
  }
});
// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Serve index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
  startConsumer(); // Start message queue consumer
});