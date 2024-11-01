const { app, setupDirectories } = require('./app');

const port = process.env.PORT || 3000;

(async () => {
    try {
        await setupDirectories();
        app.listen(port, () => {
            console.log(`Server running at http://localhost:${port}`);
        });
    } catch (error) {
        console.error('Server startup error:', error);
        process.exit(1);
    }
})();