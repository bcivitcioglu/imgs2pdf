const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');
const express = require('express');
const router = express.Router();
const { delimiter } = require('../constants');

function extractOriginalFilename(modifiedFilename) {
    const parts = modifiedFilename.split(delimiter);
    if (parts.length > 1) {
        parts.pop(); // Remove the timestamp
        return parts.join(delimiter);
    }
    return modifiedFilename;
}

router.get('/download', async (req, res,next) => {
    //console.log("Download route hit with:", req.query.pdfs); // Add this

    try{
    if (!req.query.pdfs) {
        res.status(400).send('Missing required parameter: pdfs');
        return;
    }

    const pdfs = req.query.pdfs.split(',');
    const zip = new JSZip();

    if (pdfs.length === 1) {
        const dirName = path.dirname(pdfs[0]); // Get the directory name from the path
        const file = path.join('pdfs', dirName, path.basename(pdfs[0])); // adjust for new directory
    
        const downloadFileName = path.basename(file, '.pdf'); // Extracting file name without extension
        res.setHeader('Content-Disposition', 'attachment; filename="' + downloadFileName + '.pdf"');
        res.setHeader('Content-Type', 'application/pdf');
        //console.log("Attempting to send file from path:", file);
        fs.createReadStream(file).pipe(res);                    
    } else {
        for (let pdf of pdfs) {
            const data = fs.readFileSync(path.join('pdfs', pdf));
            const cleanedUpPdfName = path.basename(pdf).replace(/\..+$/, '') + '.pdf';
            zip.file(cleanedUpPdfName, data);
                                }

        const data = await zip.generateAsync({type:'nodebuffer'});
        res.set('Content-Type', 'application/zip');
        res.set('Content-Disposition', `attachment; filename=pdfs.zip`);
        res.send(data);
    }}catch(err){
        next(err);

    }
});

module.exports = router;
