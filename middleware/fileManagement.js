const fs = require('fs');
const { deletionDelay } = require('../constants');

function deleteDirectoryRecursive(dirPath) {
    if (fs.existsSync(dirPath)) {
        fs.readdirSync(dirPath).forEach((file, index) => {
            const curPath = path.join(dirPath, file);
            if (fs.lstatSync(curPath).isDirectory()) { // Check if it's a directory
                deleteDirectoryRecursive(curPath);
            } else { 
                fs.unlinkSync(curPath); // Delete file
            }
        });
        fs.rmdirSync(dirPath); // Delete directory
    }
}

function scheduleFileDeletion(filePath, delay = deletionDelay) {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            if (fs.lstatSync(filePath).isDirectory()) {
                try {
                    deleteDirectoryRecursive(filePath);
                    console.log(`Successfully deleted directory at ${filePath}`);
                    resolve();
                } catch (err) {
                    console.error(`Failed to delete directory at ${filePath}:`, err);
                    reject(err);
                }
            } else {
                fs.unlink(filePath, (err) => {
                    if (err) {
                        console.error(`Failed to delete file at ${filePath}:`, err);
                        reject(err);
                    } else {
                        console.log(`Successfully deleted file at ${filePath}`);
                        resolve();
                    }
                });
            }
        }, delay);
    });
}

module.exports = {
    scheduleFileDeletion
};
