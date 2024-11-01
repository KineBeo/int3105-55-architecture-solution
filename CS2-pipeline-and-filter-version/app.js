const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const convertRouter = require('./routes/convert');

const app = express();

// Setup directories
const setupDirectories = async () => {
    const dirs = ['uploads', 'output'];
    for (const dir of dirs) {
        try {
            await fs.access(dir);
        } catch {
            await fs.mkdir(dir);
        }
    }
};

// Basic error handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: err.message || 'Something went wrong!' });
});

// Routes
app.use('/convert', convertRouter);

// Serve simple HTML form for testing
app.get('/', (req, res) => {
    res.send(`
        <html>
            <body>
                <h2>Image to PDF Converter</h2>
                <form action="/convert" method="post" enctype="multipart/form-data">
                    <input type="file" name="image" accept="image/*">
                    <button type="submit">Convert to PDF</button>
                </form>
            </body>
        </html>
    `);
});

module.exports = { app, setupDirectories };