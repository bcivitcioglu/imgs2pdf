console.log("script.js is loaded");

// Select the file input, dropzone, checkbox and buttons
const fileInput = document.getElementById('fileInput');
const dropzone = document.getElementById('dropzone');
const mergeInput = document.getElementById('mergeInput');
const convertButton = document.getElementById('convertButton');
const downloadButton = document.getElementById('downloadButton');
const statusText = document.getElementById('status');
const removeAllButton = document.getElementById('removeAllButton');
const dropText = document.getElementById('dropText');
window.addEventListener('resize', adjustFontSize);

function adjustFontSize() {
    let fontSize = Math.max(window.innerWidth * 0.012, 16) + 'px';
    document.body.style.fontSize = fontSize;

    let buttons = document.querySelectorAll('.btn');
    buttons.forEach(button => {
        button.style.fontSize = fontSize;
    });
}

// Call the function initially to set the font size
adjustFontSize();

let fileCountProgress = 0;  // Changed the name from uploadProgress to fileCountProgress
let conversionProgress = 0;
const maxFiles = 30;  // Set this to the maximum number of files allowed
let allFiles = [];  // This array will hold all the files selected so far

// Event listeners for dropzone
dropzone.addEventListener('click', function() {
    if (allFiles.length === maxFiles) {
        return;
    }
    fileInput.click();
});

dropzone.addEventListener('dragover', function(e) {
    if (allFiles.length === maxFiles) {
        return;
    }
    e.preventDefault();
    this.style.backgroundColor = '#aaa';
});

dropzone.addEventListener('dragleave', function(e) {
    this.style.backgroundColor = 'rgb(233, 233, 233)';
});

dropzone.addEventListener('drop', function(e) {
    e.preventDefault();
    this.style.backgroundColor = 'rgb(233, 233, 233)';
    addFiles(e.dataTransfer.files);
});

// Event listener for fileInput
fileInput.addEventListener('change', function() {
    addFiles(this.files);
});

function addFiles(files) {
    if (allFiles.length === maxFiles) {
        return;
    }
    Array.from(files).forEach(file => {
        // only allow image file types
        if (!file.type.startsWith('image/')) {
            alert('Only image files are allowed');
            return;
        }
        if (allFiles.length < maxFiles) {
            allFiles.push(file);

            const thumbnailContainer = document.createElement('div');
            thumbnailContainer.className = 'thumbnailContainer d-flex align-items-start position-relative col-6 col-md-4 col-lg-4 p-1'; 

            const thumbnail = document.createElement('img');
            thumbnail.className = 'thumbnail img-thumbnail w-100 h-100'; 
            thumbnail.style.objectFit = 'cover'; 

            if (file.type === 'image/heic') {
                thumbnail.src = '/logos/favicon.png'; // Replace with the path to your placeholder image
            } else {
                thumbnail.src = URL.createObjectURL(file);
            }
    
            const removeButton = document.createElement('button');
            removeButton.className = 'removeButton btn btn-sm btn-danger position-absolute top-0 end-0'; 
            removeButton.style.zIndex = '10'; 
            removeButton.textContent = '\u2715'
    

          removeButton.addEventListener('click', function(event) {
              event.stopPropagation(); // Stop the click event from bubbling up to the dropzone
              const index = allFiles.indexOf(file);
              if (index !== -1) {
                  allFiles.splice(index, 1);
                  thumbnailContainer.remove();
                  fileCountProgress = allFiles.length; // Update fileCountProgress
                  convertButton.disabled = allFiles.length === 0;
                  // Disable the "Remove All" button if no files are left
                  removeAllButton.disabled = allFiles.length === 0;
                  downloadButton.disabled = allFiles.length === 0;
                  if (allFiles.length===0){
                    dropText.textContent = 'Click or drop images (jpeg, png, HEIC) here';
                  }
                  updateFileCountProgressBar();
                  conversionProgress = 0;
                  updateConversionProgressBar();
              }
              
              if(allFiles.length===0){
                statusText.textContent = 'No files selected';
              } else {
                statusText.textContent = allFiles.length + '/' + maxFiles + ' files selected';
              }
              statusText.style.color = 'blue';
              downloadButton.disabled = true;  // Disable the download button
          });
            
          thumbnailContainer.appendChild(thumbnail);
          thumbnailContainer.appendChild(removeButton);

          const thumbnailsContainer = document.getElementById('thumbnails');
          thumbnailsContainer.appendChild(thumbnailContainer);
}    if (allFiles.length>=1){
    dropText.textContent = '';
}
      });

    // Clear the file input
    fileInput.value = '';

    // Update fileCountProgress and the convert button
    fileCountProgress = allFiles.length;
    convertButton.disabled = allFiles.length === 0;

    // Enable the "Remove All" button if there are files in the allFiles array
    removeAllButton.disabled = allFiles.length === 0;

    updateFileCountProgressBar();
    statusText.textContent = allFiles.length + '/' + maxFiles + ' files selected';
    statusText.style.color = 'blue';
}



convertButton.addEventListener('click', function() {
    const formData = new FormData();
    for (let i = 0; i < allFiles.length; i++) {
        formData.append('images', allFiles[i]);
        // Update the status text for each file
        statusText.textContent = 'Uploading file ' + (i + 1) + ' of ' + allFiles.length;
        statusText.style.color = 'blue';
        
    }
    formData.append('merge', mergeInput.checked ? 'true' : 'false');

    statusText.textContent = 'Converting...';
    statusText.style.color = 'orange';
    
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/upload', true);
    
    // xhr.upload.onprogress = (event) => {
    //     if (event.lengthComputable) {
    //         conversionProgress = event.loaded / event.total * 100;
    //         updateConversionProgressBar();
    //     }
    // };


    xhr.onload = () => {
        if (xhr.status === 200) {
            // Start updating the conversion progress bar as soon as the upload is complete
            getConversionProgress();
    
            const result = JSON.parse(xhr.responseText);
            console.log(result);

            downloadButton.onclick = function() {
                if (downloadButton.disabled) {
                    return;
                }
                // Check if the file exists before starting the download
                fetch(`/check-file?filePath=${encodeURIComponent('pdfs/' + result.pdfs[0])}`)
                    .then(response => response.json())
                    .then(data => {
                        if (data.fileExists) {
                            // If the file exists, start the download
                            fetch('/download?pdfs=' + encodeURIComponent(result.pdfs.join(',')))
                                .then(response => response.blob())
                                .then(blob => {
                                    const url = window.URL.createObjectURL(blob);
                                    const a = document.createElement('a');
                                    a.href = url;
                                    a.download = result.pdfs.length > 1 ? 'pdfs.zip' : result.pdfs[0];
                                    a.click();
                                })
                                .catch(error => {
                                    console.error('Error in fetch:', error);
                                });
                        } else {
                            // If the file doesn't exist, disable the download button and inform the user
                            downloadButton.disabled = true;
                            statusText.textContent = 'File no longer exists. Please convert your files again.';
                        }
                    })
                    .catch(error => {
                        console.error('Error in fetch:', error);
                    });
            };
            
            downloadButton.disabled = false;
            downloadButton.style.display = 'block';
            statusText.textContent = 'Conversion complete! Ready to download.';
            statusText.style.color = 'green';
                    } else {
                        const result = JSON.parse(xhr.responseText);
                        statusText.textContent = 'Error: ' + result.error;
                        statusText.style.color = 'red';
                    }
    };
        xhr.send(formData);
});

removeAllButton.addEventListener('click', function() {
    allFiles = [];  // Clear the allFiles array
    fileCountProgress = 0;  // Reset fileCountProgress
    convertButton.disabled = true;  // Disable the convert button
    removeAllButton.disabled = true;  // Disable the "Remove All" button
    downloadButton.disabled = true;
    conversionProgress = 0;
    updateConversionProgressBar();
    updateFileCountProgressBar();  // Update the file count progress bar

    // Remove all thumbnail containers
    const thumbnailContainers = document.querySelectorAll('.thumbnailContainer');
    thumbnailContainers.forEach(container => {
        container.remove();
    });
    statusText.textContent = 'No files selected';
    statusText.style.color = 'blue';
    dropText.textContent = 'Click or drop images (jpeg, png, HEIC) here';
});

mergeInput.addEventListener('change', function() {
    downloadButton.disabled = true;  // Disable the download button
});


const getConversionProgress = () => {
    fetch('/progress')
        .then(response => {
            console.log('Raw response from /progress:', response);
            return response.json();
        })
        .then(data => {
            conversionProgress = data.converted / data.total * 100;
            updateConversionProgressBar();

            if (conversionProgress < 100) {
                setTimeout(getConversionProgress, 1000);
            }
        })
        .catch(error => {
            console.error('Error in getConversionProgress fetch:', error);
        });
};

function updateFileCountProgressBar() {
    const progressBar = document.getElementById('fileCountProgressBar').style;
    const progress = (fileCountProgress / maxFiles) * 100;

    // Update the width of the progress bar
    progressBar.width = progress + '%';

    // Update the color from green to red based on the number of files uploaded
    progressBar.backgroundColor = `rgb(${progress * 2.55}, ${(100 - progress) * 2.55}, 0)`;

}


const updateConversionProgressBar = () => {
    const conversionProgressBar = document.getElementById('conversionProgressBar');
    conversionProgressBar.style.width = `${conversionProgress}%`;
};

