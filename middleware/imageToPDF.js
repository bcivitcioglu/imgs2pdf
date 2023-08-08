const path = require('path');
const fs = require('fs');
const PDFDocument = require('pdfkit');
const probe = require('probe-image-size');
const heicConvert = require('heic-convert');
const { deletionDelay } = require('../constants');
const { scheduleFileDeletion } = require('../middleware/fileManagement');

const convertImageToPdfPage = async (doc, imagePath, isFirstImage) => {
    //console.log(`Converting image at ${imagePath}...`);

    let imageSize;
    let isHeic = path.extname(imagePath).toLowerCase() === '.heic';

    if (isHeic) {
        // ... [snip] ... (No changes in this section)
    }

    //console.log(`Probing image at ${imagePath}...`);

    try {
        imageSize = await probe(fs.createReadStream(imagePath));
        //console.log(`imageSize: ${imageSize}`);
    } catch (err) {
        console.error(`Failed to process image at ${imagePath}:`, err);
        try {
            fs.unlinkSync(imagePath);
        } catch (err) {
            console.error(`Failed to delete file ${imagePath}:`, err);
        }
                return path.basename(imagePath);  // Return the invalid file name
        }

    if (!imageSize) {
        throw new Error('Failed to probe image size');
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
    return null;  // Return null if no errors occurred.
};

module.exports = {
    convertImageToPdfPage
};
