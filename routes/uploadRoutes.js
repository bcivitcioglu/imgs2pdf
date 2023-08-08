const fs = require('fs');
const path = require('path');
const express = require('express');
const router = express.Router();
const multer = require('multer');
const { convertImageToPdfPage } = require('../middleware/imageToPDF');
const { delimiter } = require('../constants');
const { scheduleFileDeletion } = require('../middleware/fileManagement');
const { updateProgress, getProgress } = require('../middleware/progressManager');
const PDFDocument = require('pdfkit');


// Multer setup
let counter = 0; // Add a counter
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDate = Date.now();
        const dir = `uploads/${uploadDate}`;

        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        cb(null, dir);
    },
    filename: function (req, file, cb) {
        cb(null, file.originalname);  // save with the original name
    }
});

const upload = multer({ storage: storage });
 
function extractOriginalFilename(modifiedFilename) {
    const parts = modifiedFilename.split(delimiter);
    if (parts.length > 1) {
        parts.pop(); // Remove the timestamp
        return parts.join(delimiter);
    }
    return modifiedFilename;
}

// Route to handle file uploading
router.post('/upload', upload.array('images', 30), async (req, res) => {
    let invalidFiles = [];
    const mergePDFs = req.body.merge === 'true';

    // Determine the correct directory for the PDFs
    const timestampDir = path.dirname(req.files[0].path);
    const pdfDirPath = path.join('pdfs', path.basename(timestampDir));
    if (!fs.existsSync(pdfDirPath)) {
        fs.mkdirSync(pdfDirPath, { recursive: true });
    }

    updateProgress(req.files.length, 0);
    
    try {
        if (mergePDFs) {
            const doc = new PDFDocument();
            const uniqueFilename = path.join(pdfDirPath, 'merged.pdf');
            const stream = fs.createWriteStream(uniqueFilename);

            for (let i = 0; i < req.files.length; i++) {
                let file = req.files[i];
                await convertImageToPdfPage(doc, file.path, i === 0);
                const progress = getProgress();
                updateProgress(progress.total, progress.converted + 1);
                scheduleFileDeletion(file.path); // Schedule deletion of uploaded file
            }

            doc.pipe(stream);
            doc.end();

            // Schedule deletion of generated PDF
            scheduleFileDeletion(uniqueFilename); 

            res.send({ pdfs: [path.relative('pdfs', uniqueFilename)] });
        } else {
            const pdfs = [];
            for (let i = 0; i < req.files.length; i++) {
                let file = req.files[i];
                const doc = new PDFDocument();
                const individualPdfFilename = path.join(pdfDirPath, file.filename + '.pdf');
                const stream = fs.createWriteStream(individualPdfFilename);
                
                let errorFile = await convertImageToPdfPage(doc, file.path, true);
                if (errorFile) {
                    invalidFiles.push(errorFile);
                } else {
                    doc.pipe(stream);
                    doc.end();
                    pdfs.push(individualPdfFilename);
                }

                const progress = getProgress();
                updateProgress(progress.total, progress.converted + 1);
                
                // Schedule deletion of uploaded file and generated PDF
                scheduleFileDeletion(file.path);
                scheduleFileDeletion(individualPdfFilename);
            }
            
            // Check for invalid files here:
            if (invalidFiles.length > 0) {
                res.status(400).json({
                    error: `${invalidFiles.length} file(s) are invalid or not recognized as images: ${invalidFiles.map(extractOriginalFilename).join(', ')}`
                });
                return;
            }

            res.send({ pdfs: pdfs.map(pdf => path.relative('pdfs', pdf)) });
        }
    } catch (err) {
        console.error(err);
        res.status(400).json({error: err.message});
    }
});

router.get('/progress', (req, res) => {
    res.json(getProgress());
});

router.get('/check-file', (req, res) => {
    const { filePath } = req.query;
    const fullPath = path.join('pdfs', filePath); // Ensure we are checking inside the 'pdfs' directory
    fs.access(fullPath, fs.constants.F_OK, (err) => {
        // fs.access checks for the existence of file
        const exists = !err;
        //console.log(`Checking file at ${fullPath}. Exists: ${exists}`);
        res.json({ fileExists: exists });
    });
});

module.exports = router;
