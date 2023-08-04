const express = require('express');
const multer  = require('multer');
const path = require('path');
const fs = require('fs');
const PDFDocument = require('pdfkit');
const JSZip = require('jszip');
const { PDFDocument: PDFLibDocument } = require('pdf-lib');
const probe = require('probe-image-size');
const heicConvert = require('heic-convert');

const app = express();

// Ensure uploads and pdfs directories exist
const directories = ['uploads', 'pdfs'];
directories.forEach(dir => {
    if (!fs.existsSync(dir)){
        fs.mkdirSync(dir);
    }
});
// Unique Delimiter
const delimiter = "____12345678____";

// Multer setup
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads')
    },
    filename: function (req, file, cb) {
        // Adjust the filename to include the delimiter and original filename
        const originalFilename = path.basename(file.originalname, path.extname(file.originalname));
        const filename = originalFilename + delimiter + Date.now() + path.extname(file.originalname);
        cb(null, filename);
    }
});

const upload = multer({ storage: storage });
 

// Express setup
app.use(express.static('public'));

// Conversion progress storage
let conversionProgress = {};

// Deletion delay: 10 minutes
const deletionDelay = 2 * 60 * 1000;

function scheduleFileDeletion(filePath, delay) {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            fs.unlink(filePath, (err) => {
                if (err) {
                    console.error(`Failed to delete file at ${filePath}:`, err);
                    reject(err); // Reject the promise if an error occurs
                } else {
                    console.log(`Successfully deleted file at ${filePath}`);
                    resolve(); // Resolve the promise when the file is successfully deleted
                }
            });
        }, delay);
    });
}

// Route to handle file uploading
app.post('/upload', upload.array('images', 30), async (req, res) => {
    const mergePDFs = req.body.merge === 'true';

    conversionProgress = {
        total: req.files.length,
        converted: 0
    };

    const convertImageToPdfPage = async (doc, imagePath, isFirstImage) => {
        console.log(`Converting image at ${imagePath}...`);
        // If the image is a HEIC image, convert it to JPEG first
        let isHeic = path.extname(imagePath).toLowerCase() === '.heic';

        if (isHeic) {
            let jpegPath = imagePath + '.jpeg';
            console.log(`Detected HEIC image. Converting to JPEG at ${jpegPath}...`);
        
            const inputBuffer = fs.readFileSync(imagePath);
            const outputBuffer = await heicConvert({
                buffer: inputBuffer, // the HEIC file buffer
                format: 'JPEG',      // output format
                quality: 1           // the jpeg compression quality, between 0 and 1
            });
        
            fs.writeFileSync(jpegPath, outputBuffer);
            imagePath = jpegPath;
            // Schedule deletion of the converted JPEG file
            scheduleFileDeletion(jpegPath, deletionDelay);

        }
        console.log(`Probing image at ${imagePath}...`);
        try {
            const imageSize = await probe(fs.createReadStream(imagePath));
        } catch (err) {
            console.error(`Failed to process image at ${imagePath}:`, err);
            // Handle the error: send a response, skip the file, etc.
            fs.unlinkSync(imagePath); // Immediately delete the invalid file
            throw new Error(`${path.basename(imagePath)} is not an image file or not one of our supported files.`);        
        }
    
        const pdfWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
        const pdfHeight = doc.page.height - doc.page.margins.top - doc.page.margins.bottom;
        const imageWidth = imageSize.width;
        const imageHeight = imageSize.height;
    
        // Keep the image size the same if it fits within the page. Otherwise, scale it down.
        let width, height;
        if (imageWidth <= pdfWidth && imageHeight <= pdfHeight) {
            // If the image fits within the page, keep its size the same.
            width = imageWidth;
            height = imageHeight;
        } else {
            // If the image is too big, scale it down.
            const widthRatio = pdfWidth / imageWidth;
            const heightRatio = pdfHeight / imageHeight;
            const ratio = Math.min(widthRatio, heightRatio);
    
            width = imageWidth * ratio;
            height = imageHeight * ratio;
        }
    
        // Position the image in the center of the page
        const x = (pdfWidth - width) / 2 + doc.page.margins.left;
        const y = (pdfHeight - height) / 2 + doc.page.margins.top;
    
        if (!isFirstImage) {
            doc.addPage();
        }
    
        doc.image(imagePath, x, y, {width: width, height: height});
    };
    
    try{
    if (mergePDFs) {
        const doc = new PDFDocument();
        const uniqueFilename = 'merged' + delimiter + Date.now() + '.pdf';
        const stream = fs.createWriteStream(path.join('pdfs', uniqueFilename));

        for (let i = 0; i < req.files.length; i++) {
            let file = req.files[i];
            await convertImageToPdfPage(doc, file.path, i === 0);
            conversionProgress.converted += 1;
            scheduleFileDeletion(file.path, deletionDelay); // Schedule deletion of uploaded file
        }

        doc.pipe(stream);
        doc.end();

    // Schedule deletion of generated PDF
    scheduleFileDeletion(path.join('pdfs', uniqueFilename), deletionDelay); 

    res.send({ pdfs: [uniqueFilename] });
    } else {
        const pdfs = [];
        for (let i = 0; i < req.files.length; i++) {
            let file = req.files[i];
            const doc = new PDFDocument();
            const stream = fs.createWriteStream(path.join('pdfs', file.filename + '.pdf'));
            
            await convertImageToPdfPage(doc, file.path, true);

            doc.pipe(stream);
            doc.end();

            pdfs.push(path.join('pdfs', file.filename + '.pdf'));

            conversionProgress.converted += 1;

            // Schedule deletion of uploaded file and generated PDF
            scheduleFileDeletion(file.path, deletionDelay);
            scheduleFileDeletion(path.join('pdfs', file.filename + '.pdf'), deletionDelay);
        }

        res.send({ pdfs: pdfs.map(pdf => path.basename(pdf)) });
    }} catch (err){
        console.error(err);
        res.status(400).json({error:err.message});
    }
});

app.get('/download', async (req, res) => {
    try{
    if (!req.query.pdfs) {
        res.status(400).send('Missing required parameter: pdfs');
        return;
    }

    const pdfs = req.query.pdfs.split(',');
    const zip = new JSZip();

    if (pdfs.length === 1) {
        const file = path.join('pdfs', pdfs[0]);

        // Extract the original file name without the timestamp and image extension
        const originalFilename = pdfs[0].split(delimiter)[0];
        const pdfExtension = ".pdf";

        // Split the original filename by the "." character
        const filenameParts = originalFilename.split(".");

        // If the filename has more than one part, remove the last part (image extension)
        if (filenameParts.length > 1) {
            filenameParts.pop();
        }

        // Join the remaining parts back together with the "." character
        const filenameWithoutImageExtension = filenameParts.join(".");

        res.set('Content-Disposition', `attachment; filename=${filenameWithoutImageExtension}${pdfExtension}`);
        console.log(filenameWithoutImageExtension + pdfExtension);
        const downloadFileName = filenameWithoutImageExtension + pdfExtension;
        res.download(file,downloadFileName);

    } else {
        for (let pdf of pdfs) {
            const data = fs.readFileSync(path.join('pdfs', pdf));
            zip.file(pdf, data);
        }

        const data = await zip.generateAsync({type:'nodebuffer'});
        res.set('Content-Type', 'application/zip');
        res.set('Content-Disposition', `attachment; filename=pdfs.zip`);
        res.send(data);
    }}catch(err){
        next(err);

    }
});

app.get('/progress', (req, res) => {
    res.json(conversionProgress);
});

app.get('/check-file', (req, res) => {
    const { filePath } = req.query;
    fs.access(filePath, fs.constants.F_OK, (err) => {
        // fs.access checks for the existence of file
        res.json({ fileExists: !err });
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send({ error: 'Something went wrong!' });
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server started on port ${port}`));
