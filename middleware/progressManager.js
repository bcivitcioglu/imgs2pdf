// progressManager.js
let conversionProgress = {};

function updateProgress(total, converted) {
    conversionProgress.total = total;
    conversionProgress.converted = converted;
}

function getProgress() {
    return conversionProgress;
}

module.exports = {
    updateProgress,
    getProgress
};
