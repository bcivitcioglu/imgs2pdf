const express = require('express');
const fs = require('fs');
const uploadRoutes = require('./routes/uploadRoutes');
const downloadRoutes = require('./routes/downloadRoutes');

const app = express();

// Ensure uploads and pdfs directories exist
const directories = ['uploads', 'pdfs'];
directories.forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir);
    }
});

app.use(express.static('public'));

// Use the routes
app.use(uploadRoutes);
app.use(downloadRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send({ error: 'Something went wrong!' });
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server started on port ${port}`));
