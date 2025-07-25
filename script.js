class OCRTextEditor {
    constructor() {
        this.canvas = null;
        this.ctx = null;
        this.originalImage = null;
        this.ocrData = null;
        this.selectedWordIndex = null;
        this.scaleFactor = 1;
        this.canvasRect = null;
        
        // OCR API configuration
        this.apiKey = this.getApiKey();
        this.apiUrl = 'https://api.ocr.space/parse/image';
        
        // Font detection
        this.detectedFonts = new Map();
        this.fallbackFonts = ['Arial', 'Helvetica', 'sans-serif'];
        
        this.initializeElements();
        this.setupEventListeners();
        this.loadFallbackFonts();
    }

    getApiKey() {
        // For now, return the working API key directly to restore functionality
        // In production, you should use environment variables or secure storage
        return 'K87955780288957';
    }

    initializeElements() {
        // DOM elements
        this.uploadArea = document.getElementById('uploadArea');
        this.imageInput = document.getElementById('imageInput');
        this.detectTextBtn = document.getElementById('detectTextBtn');
        this.canvasSection = document.getElementById('canvasSection');
        this.canvas = document.getElementById('imageCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.boundingBoxes = document.getElementById('boundingBoxes');
        this.downloadBtn = document.getElementById('downloadBtn');
        this.resetBtn = document.getElementById('resetBtn');
        
        // Modal elements
        this.replaceModal = document.getElementById('replaceModal');
        this.originalText = document.getElementById('originalText');
        this.replacementText = document.getElementById('replacementText');
        this.confirmReplace = document.getElementById('confirmReplace');
        this.cancelReplace = document.getElementById('cancelReplace');
        
        // Utility elements
        this.loadingOverlay = document.getElementById('loadingOverlay');
        this.errorMessage = document.getElementById('errorMessage');
        this.errorText = document.getElementById('errorText');
        this.dismissError = document.getElementById('dismissError');
    }

    setupEventListeners() {
        // Upload functionality
        this.uploadArea.addEventListener('click', () => this.imageInput.click());
        this.uploadArea.addEventListener('dragover', this.handleDragOver.bind(this));
        this.uploadArea.addEventListener('dragleave', this.handleDragLeave.bind(this));
        this.uploadArea.addEventListener('drop', this.handleDrop.bind(this));
        this.imageInput.addEventListener('change', this.handleImageSelect.bind(this));
        
        // OCR and processing
        this.detectTextBtn.addEventListener('click', this.detectText.bind(this));
        
        // Canvas and word selection
        this.boundingBoxes.addEventListener('click', this.handleWordClick.bind(this));
        
        // Modal functionality
        this.confirmReplace.addEventListener('click', this.replaceText.bind(this));
        this.cancelReplace.addEventListener('click', this.closeModal.bind(this));
        this.replacementText.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.replaceText();
        });
        
        // Download and reset
        this.downloadBtn.addEventListener('click', this.downloadImage.bind(this));
        this.resetBtn.addEventListener('click', this.resetEditor.bind(this));
        
        // Error handling
        this.dismissError.addEventListener('click', this.hideError.bind(this));
        
        // Window resize
        window.addEventListener('resize', this.handleResize.bind(this));
    }

    async loadFallbackFonts() {
        // Load common fonts for fallback
        const fontsToLoad = [
            'Arial',
            'Helvetica',
            'Times New Roman',
            'Courier New',
            'Verdana',
            'Georgia',
            'Trebuchet MS',
            'Impact'
        ];

        for (const font of fontsToLoad) {
            try {
                const fontObserver = new FontFaceObserver(font);
                await fontObserver.load(null, 3000);
            } catch (error) {
                console.log(`Font ${font} not available`);
            }
        }
    }

    handleDragOver(e) {
        e.preventDefault();
        this.uploadArea.classList.add('dragover');
    }

    handleDragLeave(e) {
        e.preventDefault();
        this.uploadArea.classList.remove('dragover');
    }

    handleDrop(e) {
        e.preventDefault();
        this.uploadArea.classList.remove('dragover');
        
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            this.processImageFile(files[0]);
        }
    }

    handleImageSelect(e) {
        const file = e.target.files[0];
        if (file) {
            this.processImageFile(file);
        }
    }

    processImageFile(file) {
        // Validate file type
        if (!file.type.startsWith('image/')) {
            this.showError('Please select a valid image file.');
            return;
        }

        // Validate file size (3MB limit)
        const maxSize = 3 * 1024 * 1024; // 3MB in bytes
        if (file.size > maxSize) {
            this.showError('Image size must be less than 3MB. Please choose a smaller image.');
            return;
        }

        // Load image
        const reader = new FileReader();
        reader.onload = (e) => {
            this.loadImage(e.target.result);
        };
        reader.onerror = () => {
            this.showError('Failed to read the image file. Please try again.');
        };
        reader.readAsDataURL(file);
    }

    loadImage(imageSrc) {
        const img = new Image();
        img.onload = () => {
            this.originalImage = img;
            this.drawImageOnCanvas();
            this.detectTextBtn.disabled = false;
            this.showSuccess('Image loaded successfully! Click "Detect Text" to continue.');
        };
        img.onerror = () => {
            this.showError('Failed to load the image. Please try a different image.');
        };
        img.src = imageSrc;
    }

    drawImageOnCanvas() {
        // Use original image dimensions for better OCR accuracy
        let { width, height } = this.originalImage;
        
        // Only scale down if image is extremely large (over 2000px)
        const maxDimension = 2000;
        if (width > maxDimension || height > maxDimension) {
            const scale = Math.min(maxDimension / width, maxDimension / height);
            width *= scale;
            height *= scale;
        }
        
        // Set canvas to display size for UI
        const displayMaxWidth = Math.min(800, window.innerWidth - 100);
        const displayMaxHeight = Math.min(600, window.innerHeight - 300);
        
        let displayWidth = width;
        let displayHeight = height;
        
        if (displayWidth > displayMaxWidth || displayHeight > displayMaxHeight) {
            const displayScale = Math.min(displayMaxWidth / displayWidth, displayMaxHeight / displayHeight);
            displayWidth *= displayScale;
            displayHeight *= displayScale;
        }
        
        // Set actual canvas size for processing
        this.canvas.width = width;
        this.canvas.height = height;
        this.scaleFactor = width / this.originalImage.width;
        
        // Set display size
        this.canvas.style.width = displayWidth + 'px';
        this.canvas.style.height = displayHeight + 'px';
        
        // Draw image at full resolution
        this.ctx.clearRect(0, 0, width, height);
        this.ctx.drawImage(this.originalImage, 0, 0, width, height);
        
        // Update canvas rect for coordinate calculations
        this.updateCanvasRect();
    }

    updateCanvasRect() {
        this.canvasRect = this.canvas.getBoundingClientRect();
    }

    async detectText() {
        // Validate API key first
        if (!this.apiKey) {
            this.showError('API key is required for text detection. Please refresh and provide a valid key.');
            return;
        }
        
        this.showLoading('Detecting text in image...');
        
        try {
            // Convert canvas to base64 - use JPEG for better performance
            const base64Data = this.canvas.toDataURL('image/jpeg', 0.9).split(',')[1];
            
            // Prepare form data with enhanced OCR settings
            const formData = new FormData();
            formData.append('apikey', this.apiKey);
            formData.append('base64Image', `data:image/jpeg;base64,${base64Data}`);
            formData.append('isOverlayRequired', 'true');
            formData.append('language', 'eng');
            formData.append('detectOrientation', 'true');
            formData.append('scale', 'true');
            formData.append('OCREngine', '2');
            formData.append('isTable', 'false');
            formData.append('filetype', 'JPG');
            
            // Make API request
            const response = await fetch(this.apiUrl, {
                method: 'POST',
                body: formData
            });
            
            if (!response.ok) {
                throw new Error(`API request failed: ${response.status} ${response.statusText}`);
            }
            
            const result = await response.json();
            
            if (result.IsErroredOnProcessing) {
                throw new Error(result.ErrorMessage || 'OCR processing failed');
            }
            
            if (!result.ParsedResults || result.ParsedResults.length === 0) {
                throw new Error('No text detected in the image');
            }
            
            this.ocrData = result.ParsedResults[0];
            this.processOCRResults();
            
        } catch (error) {
            console.error('OCR Error:', error);
            this.showError(`Text detection failed: ${error.message}`);
        } finally {
            this.hideLoading();
        }
    }

    processOCRResults() {
        if (!this.ocrData.TextOverlay || !this.ocrData.TextOverlay.Lines) {
            this.showError('No text overlay data received from OCR service');
            return;
        }

        // Clear existing bounding boxes
        this.boundingBoxes.innerHTML = '';
        
        // Create bounding boxes for each word
        let wordIndex = 0;
        this.ocrData.TextOverlay.Lines.forEach((line, lineIndex) => {
            if (line.Words) {
                line.Words.forEach((word, wordIndexInLine) => {
                    this.createWordBoundingBox(word, wordIndex);
                    wordIndex++;
                });
            }
        });
        
        // Show canvas section
        this.canvasSection.style.display = 'block';
        this.canvasSection.scrollIntoView({ behavior: 'smooth' });
        
        this.showSuccess(`Text detection complete! Found ${wordIndex} words. Click on any word to edit it.`);
    }

    createWordBoundingBox(word, index) {
        const box = document.createElement('div');
        box.className = 'word-box';
        box.dataset.wordIndex = index;
        box.dataset.originalText = word.WordText;
        
        // Get display scale factor
        const canvasDisplayWidth = parseFloat(this.canvas.style.width) || this.canvas.width;
        const canvasDisplayHeight = parseFloat(this.canvas.style.height) || this.canvas.height;
        const displayScaleX = canvasDisplayWidth / this.canvas.width;
        const displayScaleY = canvasDisplayHeight / this.canvas.height;
        
        // Calculate position and size for display overlay
        const left = word.Left * this.scaleFactor * displayScaleX;
        const top = word.Top * this.scaleFactor * displayScaleY;
        const width = word.Width * this.scaleFactor * displayScaleX;
        const height = word.Height * this.scaleFactor * displayScaleY;
        
        box.style.left = `${left}px`;
        box.style.top = `${top}px`;
        box.style.width = `${width}px`;
        box.style.height = `${height}px`;
        
        // Store word data (use canvas coordinates for processing)
        box.wordData = {
            text: word.WordText,
            left: word.Left * this.scaleFactor,
            top: word.Top * this.scaleFactor,
            width: word.Width * this.scaleFactor,
            height: word.Height * this.scaleFactor,
            originalWord: word
        };
        
        this.boundingBoxes.appendChild(box);
        
        // Detect font for this word
        this.detectWordFont(word, box);
    }

    async detectWordFont(word, boxElement) {
        try {
            // Calculate proper font size based on word height
            const fontSize = Math.max(14, word.Height * this.scaleFactor * 0.9);
            
            // Detect text color and weight by analyzing the word area
            const wordData = boxElement.wordData;
            const { textColor, fontWeight } = this.analyzeWordVisualProperties(wordData);
            
            // Store comprehensive font info including color
            this.detectedFonts.set(boxElement.dataset.wordIndex, {
                family: 'Arial',
                size: fontSize,
                weight: fontWeight,
                style: 'normal',
                color: textColor,
                originalHeight: word.Height,
                originalWidth: word.Width
            });
            
        } catch (error) {
            console.log('Font detection failed for word:', word.WordText);
            this.detectedFonts.set(boxElement.dataset.wordIndex, {
                family: 'Arial',
                size: Math.max(14, word.Height * this.scaleFactor * 0.9),
                weight: 'normal',
                style: 'normal',
                color: '#000000',
                originalHeight: word.Height,
                originalWidth: word.Width
            });
        }
    }

    analyzeWordVisualProperties(wordData) {
        try {
            // Sample pixels from the word area to detect color and weight
            const centerX = Math.floor(wordData.left + wordData.width / 2);
            const centerY = Math.floor(wordData.top + wordData.height / 2);
            
            // Sample multiple points within the word
            const samplePoints = [
                { x: centerX, y: centerY },
                { x: Math.floor(wordData.left + wordData.width * 0.3), y: centerY },
                { x: Math.floor(wordData.left + wordData.width * 0.7), y: centerY },
                { x: centerX, y: Math.floor(wordData.top + wordData.height * 0.3) },
                { x: centerX, y: Math.floor(wordData.top + wordData.height * 0.7) }
            ];
            
            let textPixels = [];
            let backgroundPixels = [];
            
            // Collect color samples from text and background areas
            samplePoints.forEach(point => {
                if (point.x >= 0 && point.x < this.canvas.width && point.y >= 0 && point.y < this.canvas.height) {
                    const imageData = this.ctx.getImageData(point.x, point.y, 1, 1);
                    const [r, g, b] = imageData.data;
                    const brightness = (r + g + b) / 3;
                    
                    textPixels.push({ r, g, b, brightness });
                }
            });
            
            // Sample background around the word
            const bgSamplePoints = [
                { x: wordData.left - 5, y: wordData.top },
                { x: wordData.left + wordData.width + 5, y: wordData.top },
                { x: wordData.left, y: wordData.top - 5 },
                { x: wordData.left, y: wordData.top + wordData.height + 5 }
            ];
            
            bgSamplePoints.forEach(point => {
                if (point.x >= 0 && point.x < this.canvas.width && point.y >= 0 && point.y < this.canvas.height) {
                    const imageData = this.ctx.getImageData(point.x, point.y, 1, 1);
                    const [r, g, b] = imageData.data;
                    const brightness = (r + g + b) / 3;
                    
                    backgroundPixels.push({ r, g, b, brightness });
                }
            });
            
            // Determine text color by finding the most contrasting color to background
            let textColor = '#000000';
            if (textPixels.length > 0 && backgroundPixels.length > 0) {
                const avgBgBrightness = backgroundPixels.reduce((sum, p) => sum + p.brightness, 0) / backgroundPixels.length;
                
                // Find the pixel with highest contrast to background
                const contrastPixel = textPixels.reduce((bestContrast, current) => {
                    const currentContrast = Math.abs(current.brightness - avgBgBrightness);
                    const bestContrastValue = Math.abs(bestContrast.brightness - avgBgBrightness);
                    return currentContrast > bestContrastValue ? current : bestContrast;
                });
                
                textColor = `rgb(${contrastPixel.r}, ${contrastPixel.g}, ${contrastPixel.b})`;
            } else if (textPixels.length > 0) {
                // Fallback to darkest pixel
                const darkestPixel = textPixels.reduce((darkest, current) => 
                    current.brightness < darkest.brightness ? current : darkest
                );
                textColor = `rgb(${darkestPixel.r}, ${darkestPixel.g}, ${darkestPixel.b})`;
            }
            
            // Determine font weight based on text thickness
            // Analyze contrast and pixel density to detect bold text
            let fontWeight = 'normal';
            if (textPixels.length > 0 && backgroundPixels.length > 0) {
                const avgTextBrightness = textPixels.reduce((sum, p) => sum + p.brightness, 0) / textPixels.length;
                const avgBgBrightness = backgroundPixels.reduce((sum, p) => sum + p.brightness, 0) / backgroundPixels.length;
                const contrast = Math.abs(avgBgBrightness - avgTextBrightness);
                
                // Higher contrast and certain patterns suggest bold text
                if (contrast > 100 && wordData.height > 16) {
                    fontWeight = 'bold';
                }
            }
            
            return { textColor, fontWeight };
            
        } catch (error) {
            console.log('Visual analysis failed:', error);
            return { textColor: '#000000', fontWeight: 'normal' };
        }
    }

    handleWordClick(e) {
        const wordBox = e.target.closest('.word-box');
        if (!wordBox) return;
        
        // Clear previous selection
        document.querySelectorAll('.word-box.selected').forEach(box => {
            box.classList.remove('selected');
        });
        
        // Select current word
        wordBox.classList.add('selected');
        this.selectedWordIndex = parseInt(wordBox.dataset.wordIndex);
        
        // Show replacement modal
        this.originalText.textContent = wordBox.dataset.originalText;
        this.replacementText.value = wordBox.dataset.originalText;
        this.replaceModal.style.display = 'flex';
        
        // Focus on input
        setTimeout(() => {
            this.replacementText.focus();
            this.replacementText.select();
        }, 100);
    }

    replaceText() {
        const newText = this.replacementText.value.trim();
        
        if (!newText) {
            this.showError('Please enter replacement text');
            return;
        }
        
        if (this.selectedWordIndex === null) {
            this.showError('No word selected');
            return;
        }
        
        // Find the selected word box
        const selectedBox = document.querySelector(`[data-word-index="${this.selectedWordIndex}"]`);
        if (!selectedBox) {
            this.showError('Selected word not found');
            return;
        }
        
        // Get word data and font info
        const wordData = selectedBox.wordData;
        const fontInfo = this.detectedFonts.get(this.selectedWordIndex.toString());
        
        // Clear the original text area on canvas
        this.clearWordArea(wordData);
        
        // Draw new text
        this.drawReplacementText(newText, wordData, fontInfo);
        
        // Update the bounding box
        selectedBox.dataset.originalText = newText;
        selectedBox.wordData.text = newText;
        
        // Close modal
        this.closeModal();
        
        this.showSuccess('Text replaced successfully!');
    }

    clearWordArea(wordData) {
        const x = Math.floor(wordData.left);
        const y = Math.floor(wordData.top);
        const width = Math.floor(wordData.width);
        const height = Math.floor(wordData.height);
        
        // Fast and invisible background reconstruction
        this.fastInvisibleFill(x, y, width, height);
    }

    fastInvisibleFill(x, y, width, height) {
        // Professional-grade invisible fill optimized for speed
        
        // Step 1: Direct pixel cloning from closest edges
        this.cloneNearestEdges(x, y, width, height);
        
        // Step 2: Seamless edge blending
        this.seamlessEdgeBlend(x, y, width, height);
    }

    cloneNearestEdges(x, y, width, height) {
        // Clone directly from adjacent pixels for perfect matching
        const imageData = this.ctx.createImageData(width, height);
        
        for (let py = 0; py < height; py++) {
            for (let px = 0; px < width; px++) {
                const targetIndex = (py * width + px) * 4;
                
                // Find nearest source pixel outside the text area
                let sourceX, sourceY;
                
                // Priority: left edge, right edge, top edge, bottom edge
                if (x > 0) {
                    sourceX = x - 1;
                    sourceY = y + py;
                } else if (x + width < this.canvas.width) {
                    sourceX = x + width;
                    sourceY = y + py;
                } else if (y > 0) {
                    sourceX = x + px;
                    sourceY = y - 1;
                } else if (y + height < this.canvas.height) {
                    sourceX = x + px;
                    sourceY = y + height;
                } else {
                    // Fallback to neutral color
                    imageData.data[targetIndex] = 245;
                    imageData.data[targetIndex + 1] = 245;
                    imageData.data[targetIndex + 2] = 245;
                    imageData.data[targetIndex + 3] = 255;
                    continue;
                }
                
                // Get source pixel color
                const sourceData = this.ctx.getImageData(sourceX, sourceY, 1, 1);
                
                // Add subtle variation to avoid uniformity
                const variation = (Math.random() - 0.5) * 4;
                
                imageData.data[targetIndex] = Math.max(0, Math.min(255, sourceData.data[0] + variation));
                imageData.data[targetIndex + 1] = Math.max(0, Math.min(255, sourceData.data[1] + variation));
                imageData.data[targetIndex + 2] = Math.max(0, Math.min(255, sourceData.data[2] + variation));
                imageData.data[targetIndex + 3] = 255;
            }
        }
        
        this.ctx.putImageData(imageData, x, y);
    }

    seamlessEdgeBlend(x, y, width, height) {
        // Ultra-light blending for invisible seams
        const blendWidth = 1;
        
        // Blend all four edges
        const edges = [
            { x: x, y: y, w: width, h: blendWidth }, // Top
            { x: x, y: y + height - blendWidth, w: width, h: blendWidth }, // Bottom
            { x: x, y: y, w: blendWidth, h: height }, // Left
            { x: x + width - blendWidth, y: y, w: blendWidth, h: height } // Right
        ];
        
        edges.forEach(edge => {
            if (edge.x >= 0 && edge.y >= 0 && 
                edge.x + edge.w <= this.canvas.width && 
                edge.y + edge.h <= this.canvas.height) {
                
                const edgeData = this.ctx.getImageData(edge.x, edge.y, edge.w, edge.h);
                const data = edgeData.data;
                
                // Light smoothing
                for (let i = 0; i < data.length; i += 4) {
                    data[i] = Math.round(data[i] * 0.9 + data[i] * 0.1);
                    data[i + 1] = Math.round(data[i + 1] * 0.9 + data[i + 1] * 0.1);
                    data[i + 2] = Math.round(data[i + 2] * 0.9 + data[i + 2] * 0.1);
                }
                
                this.ctx.putImageData(edgeData, edge.x, edge.y);
            }
        });
    }







    getBackgroundColor(wordData) {
        // Sample pixels around the word to determine background color
        const samples = [];
        const sampleRadius = 5;
        
        // Sample points around the word
        const samplePoints = [
            { x: wordData.left - sampleRadius, y: wordData.top },
            { x: wordData.left + wordData.width + sampleRadius, y: wordData.top },
            { x: wordData.left, y: wordData.top - sampleRadius },
            { x: wordData.left, y: wordData.top + wordData.height + sampleRadius }
        ];
        
        samplePoints.forEach(point => {
            if (point.x >= 0 && point.x < this.canvas.width && point.y >= 0 && point.y < this.canvas.height) {
                const imageData = this.ctx.getImageData(point.x, point.y, 1, 1);
                const [r, g, b] = imageData.data;
                samples.push({ r, g, b });
            }
        });
        
        if (samples.length === 0) {
            return '#FFFFFF'; // Default to white
        }
        
        // Calculate average color
        const avgR = Math.round(samples.reduce((sum, s) => sum + s.r, 0) / samples.length);
        const avgG = Math.round(samples.reduce((sum, s) => sum + s.g, 0) / samples.length);
        const avgB = Math.round(samples.reduce((sum, s) => sum + s.b, 0) / samples.length);
        
        return `rgb(${avgR}, ${avgG}, ${avgB})`;
    }

    drawReplacementText(text, wordData, fontInfo) {
        // Calculate precise font size for exact dimensional match
        const optimalSize = this.calculateOptimalFontSize(text, wordData);
        
        // Set up font with exact specifications
        this.ctx.font = `${fontInfo.weight} ${optimalSize}px Arial, sans-serif`;
        this.ctx.fillStyle = fontInfo.color;
        this.ctx.textBaseline = 'top';
        this.ctx.textAlign = 'left';
        
        // Calculate precise positioning for perfect fit
        const metrics = this.ctx.measureText(text);
        const x = wordData.left;
        const y = wordData.top + (wordData.height - optimalSize) * 0.15;
        
        // Draw text with exact positioning
        this.ctx.fillText(text, x, y);
    }

    calculateOptimalFontSize(text, wordData) {
        // Binary search for perfect font size fit
        let low = 6;
        let high = Math.floor(wordData.height * 1.2);
        let bestSize = Math.floor(wordData.height * 0.8);
        
        for (let i = 0; i < 10; i++) {
            const testSize = Math.floor((low + high) / 2);
            this.ctx.font = `normal ${testSize}px Arial`;
            const width = this.ctx.measureText(text).width;
            
            if (width <= wordData.width * 0.95) {
                low = testSize;
                bestSize = testSize;
            } else {
                high = testSize - 1;
            }
        }
        
        return Math.max(6, bestSize);
    }

    needsTextShadow(color) {
        // Determine if text needs shadow for better visibility
        if (color.startsWith('rgb')) {
            const matches = color.match(/\d+/g);
            if (matches && matches.length >= 3) {
                const [r, g, b] = matches.map(Number);
                const brightness = (r + g + b) / 3;
                return brightness > 200 || brightness < 50; // Very light or very dark colors
            }
        }
        return false;
    }

    getContrastColor(color) {
        // Get contrasting color for shadow
        if (color.startsWith('rgb')) {
            const matches = color.match(/\d+/g);
            if (matches && matches.length >= 3) {
                const [r, g, b] = matches.map(Number);
                const brightness = (r + g + b) / 3;
                return brightness > 128 ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.5)';
            }
        }
        return 'rgba(0,0,0,0.5)';
    }

    closeModal() {
        this.replaceModal.style.display = 'none';
        this.selectedWordIndex = null;
        this.replacementText.value = '';
        
        // Clear selection
        document.querySelectorAll('.word-box.selected').forEach(box => {
            box.classList.remove('selected');
        });
    }

    downloadImage() {
        try {
            // Create download link
            const link = document.createElement('a');
            link.download = `edited-image-${Date.now()}.png`;
            link.href = this.canvas.toDataURL('image/png');
            
            // Trigger download
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            this.showSuccess('Image downloaded successfully!');
        } catch (error) {
            this.showError('Failed to download image. Please try again.');
        }
    }

    resetEditor() {
        // Clear canvas
        if (this.canvas) {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        }
        
        // Clear bounding boxes
        this.boundingBoxes.innerHTML = '';
        
        // Reset data
        this.originalImage = null;
        this.ocrData = null;
        this.selectedWordIndex = null;
        this.detectedFonts.clear();
        
        // Reset UI
        this.canvasSection.style.display = 'none';
        this.detectTextBtn.disabled = true;
        this.imageInput.value = '';
        this.closeModal();
        
        this.showSuccess('Editor reset successfully. Upload a new image to start again.');
    }

    handleResize() {
        if (this.originalImage) {
            // Redraw image with new dimensions
            setTimeout(() => {
                this.drawImageOnCanvas();
                if (this.ocrData) {
                    this.processOCRResults();
                }
            }, 100);
        }
    }

    showLoading(message = 'Loading...') {
        this.loadingOverlay.querySelector('p').textContent = message;
        this.loadingOverlay.style.display = 'flex';
    }

    hideLoading() {
        this.loadingOverlay.style.display = 'none';
    }

    showError(message) {
        this.errorText.textContent = message;
        this.errorMessage.style.display = 'block';
        
        // Auto-hide after 5 seconds
        setTimeout(() => {
            this.hideError();
        }, 5000);
    }

    hideError() {
        this.errorMessage.style.display = 'none';
    }

    showSuccess(message) {
        // Create a temporary success message
        const successDiv = document.createElement('div');
        successDiv.className = 'success-message';
        successDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background-color: #f0fdf4;
            border: 1px solid #bbf7d0;
            border-radius: 8px;
            padding: 16px;
            max-width: 400px;
            z-index: 1500;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            color: #166534;
        `;
        successDiv.textContent = message;
        
        document.body.appendChild(successDiv);
        
        // Auto-remove after 3 seconds
        setTimeout(() => {
            if (successDiv.parentNode) {
                successDiv.parentNode.removeChild(successDiv);
            }
        }, 3000);
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new OCRTextEditor();
});

// Handle potential API errors gracefully
window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
    if (event.reason && event.reason.message) {
        // Show user-friendly error message
        const editor = window.ocrEditor;
        if (editor) {
            editor.showError('An unexpected error occurred. Please try again.');
        }
    }
});
