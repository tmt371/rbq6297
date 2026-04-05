/* FILE: 04-core-code/ui/ocr-view.js */
import { EVENTS } from '../config/constants.js';
import { OcrApiService } from '../services/ocr-api-service.js';
import { stateService } from '../services/state-service.js';
import * as quoteActions from '../actions/quote-actions.js';
import * as uiActions from '../actions/ui-actions.js';

export class OcrView {
    constructor({ eventAggregator }) {
        this.eventAggregator = eventAggregator;
        this.ocrApiService = new OcrApiService();
        
        // Modal Overlay
        this.overlay = document.getElementById('ocr-modal-overlay');

        // Sub-containers (SPA views)
        this.cropperView = document.getElementById('ocr-cropper-container');
        this.queueView = document.getElementById('ocr-queue-container');

        // Cropper View Elements
        this.imageElement = document.getElementById('ocr-crop-image');
        this.zoomSlider = document.getElementById('ocr-zoom-slider');
        this.btnReset = document.getElementById('ocr-btn-reset');
        this.btnRotate = document.getElementById('ocr-btn-rotate');
        this.btnCancel = document.getElementById('ocr-btn-cancel');
        this.btnConfirm = document.getElementById('ocr-btn-confirm');
        
        // Queue View Elements
        this.queueList = document.getElementById('ocr-queue-list');
        this.btnCloseQueue = document.getElementById('ocr-btn-close-queue');
        this.btnDeleteAll = document.getElementById('ocr-btn-delete-all');
        this.btnAddMore = document.getElementById('ocr-btn-add-more');
        this.btnStartOcr = document.getElementById('ocr-btn-start-ocr');

        // [NEW] Loading Overlay Cache
        this.loadingOverlay = document.getElementById('ocr-loading-overlay');

        // [NEW] Magnifier (Loupe) Element
        this.magnifier = document.createElement('div');
        this.magnifier.id = 'ocr-magnifier';
        Object.assign(this.magnifier.style, {
            display: 'none',
            position: 'fixed',
            width: '150px',
            height: '150px',
            borderRadius: '50%',
            border: '3px solid #28a745',
            backgroundColor: 'white',
            backgroundRepeat: 'no-repeat',
            pointerEvents: 'none',
            zIndex: '10005',
            boxShadow: '0 4px 10px rgba(0,0,0,0.3)'
        });
        document.body.appendChild(this.magnifier);

        // State
        this.cropper = null;
        this.imageQueue = [];

        this._initializeListeners();
    }

    _initializeListeners() {
        // --- Cropper View Listeners ---
        if (this.btnReset) this.btnReset.addEventListener('click', () => this.cropper?.reset());
        if (this.btnRotate) this.btnRotate.addEventListener('click', () => this.cropper?.rotate(90));
        if (this.btnCancel) this.btnCancel.addEventListener('click', () => {
            // If we already have items in the queue, go back to queue instead of closing everything
            if (this.imageQueue.length > 0) {
                this.switchToQueue();
            } else {
                this.hide();
            }
        });
        if (this.btnConfirm) this.btnConfirm.addEventListener('click', () => this._handleConfirm());

        if (this.zoomSlider) {
            this.zoomSlider.addEventListener('input', (e) => {
                this.cropper?.zoomTo(parseFloat(e.target.value));
            });
        }

        // --- Queue View Listeners ---
        if (this.btnCloseQueue) this.btnCloseQueue.addEventListener('click', () => this.hide());
        if (this.btnDeleteAll) this.btnDeleteAll.addEventListener('click', () => {
            if (confirm('Are you sure you want to delete all images?')) {
                this.imageQueue = [];
                this.renderQueue();
            }
        });
        if (this.btnAddMore) this.btnAddMore.addEventListener('click', () => {
            document.getElementById('hidden-ocr-file-input').click();
        });
        if (this.btnStartOcr) {
            this.btnStartOcr.addEventListener('click', async () => {
                if (this.imageQueue.length === 0) {
                    this.eventAggregator.publish(EVENTS.SHOW_NOTIFICATION, {
                        type: 'warning',
                        message: "Please add at least one image before starting OCR."
                    });
                    return;
                }
                
                // 1. Show Loading UI
                if (this.loadingOverlay) this.loadingOverlay.style.display = 'flex';
                
                try {
                    console.log("🚀 Sending images to Gemini API...");
                    const ocrApiService = new OcrApiService();
                    
                    // 2. Await API Call
                    const results = await ocrApiService.recognizeImages(this.imageQueue);
                    
                    if (!results || results.length === 0) {
                         throw new Error("Gemini returned no data rows.");
                    }

                    console.log("✅ [OCR] API Success! Raw JSON:", results);

                    const currentState = stateService.getState();
                    const currentProductKey = currentState.quoteData.currentProduct;
                    const productData = currentState.quoteData.products[currentProductKey];
                    const currentItems = productData.items || [];

                    // Map JSON keys to strict RBQ internal schema
                    // Note: Key names match the canonical schema defined in the Gemini system prompt.
                    const mappedResults = results.map((r, index) => {
                        // 1. Determine Mount (IN/OUT)
                        const rawMount = (
                            r["Mounting"] || r["Mounting (IB/OB)"] || r["mount"] ||
                            r["Mount"] || r["IB/OB"] || r["O/I"] || r["M"] || ""
                        ).toLowerCase();
                        const oiValue = rawMount.includes("out") || rawMount === "o" || rawMount === "ob" || rawMount === "face" ? "OUT" : "IN";

                        // 2. Determine Control (L/R)
                        const rawControl = (
                            r["Control"] || r["Control Side (L/R)"] || r["Control Side"] ||
                            r["control"] || r["L/R"] || r["C"] || ""
                        ).toLowerCase();
                        const lrValue = rawControl.includes("r") || rawControl === "right" ? "R" : "L";

                        // 3. Determine Roll Direction (O for Over, "" for Standard)
                        const rawOver = (r["Over"] || r["Roll"] || r["over"] || "").toUpperCase();
                        const overValue = rawOver.includes("OVER") || rawOver === "O" ? "O" : "";

                        // 4. Determine Fabric Type (SN for Screen, B1 for Blockout, B2 for LF)
                        const rawType = (r["Type"] || r["fabricType"] || r["G"] || "").toUpperCase();
                        let fabricTypeValue = rawType;

                        if (rawType.includes("S")) {
                            fabricTypeValue = "SN";
                        } else if (rawType.includes("LF")) {
                            fabricTypeValue = "B2";
                        } else if (rawType.includes("B")) {
                            fabricTypeValue = "B1";
                        }

                        // 5. Location — canonical key from new prompt is "Location"
                        const locationValue = r["Location"] || r["Room / Location"] || r["Room"] || r["location"] || r["Area"] || "";

                        // 6. Width — canonical key from new prompt is "Width"
                        //    If the value is a formula string (contains +/-/=), the prompt returns ""; parseInt("") → NaN → 0.
                        const widthValue = parseInt(
                            r["Width"] || r["Width (mm)"] || r["width"] || r["W"] || r["w"] || r["Width_mm"] || 0, 10
                        ) || 0;

                        // 7. Height — canonical key from new prompt is "Height"
                        //    Formula values are returned as "" by the model, safely collapsed to 0.
                        const heightValue = parseInt(
                            r["Height"] || r["Drop / Height (mm)"] || r["Drop (mm)"] || r["Drop"] ||
                            r["drop"] || r["height"] || r["H"] || r["h"] || r["Drop_mm"] || r["height_mm"] || 0, 10
                        ) || 0;

                        return {
                            id: `ocr-${Date.now()}-${index}`, // Mandatory unique ID
                            productType: 'rollerBlind',        // CRITICAL: Prevent ProductFactory crash
                            location: locationValue,
                            width: widthValue,
                            height: heightValue,
                            oi: oiValue,             // 'IN' or 'OUT'
                            lr: lrValue,             // 'L' or 'R'
                            over: overValue,         // 'O' or ''
                            fabricType: fabricTypeValue,
                            fabric: r["Fabric"] || r["Fabric Name"] || r["fabric"] || r["Material"] || "",
                            color: r["Color"] || r["color"] || ""
                        };
                    });

                    // 8. [NEW] Ghost Row Filtering: Remove hallucinations with no dimensions
                    const cleanResults = mappedResults.filter(item => {
                        const hasWidth = item.width && item.width > 0;
                        const hasHeight = item.height && item.height > 0;
                        return hasWidth || hasHeight; // Keep if it has at least one valid dimension
                    });

                    // Replace if first row is empty, otherwise append
                    let newItems;
                    if (currentItems.length === 1 && !currentItems[0].width && !currentItems[0].height) {
                        newItems = cleanResults;
                    } else {
                        newItems = [...currentItems, ...cleanResults];
                    }

                    // [FIX] Update specific product items instead of root quoteData
                    const updatedProducts = {
                        ...currentState.quoteData.products,
                        [currentProductKey]: {
                            ...productData,
                            items: newItems
                        }
                    };

                    // Dispatch with full state merge
                    stateService.dispatch(quoteActions.setQuoteData({
                        ...currentState.quoteData,
                        products: updatedProducts
                    }));

                    // Trigger calculations
                    stateService.dispatch(uiActions.setSumOutdated(true));
                    
                    // [NEW] Manual Refresh Trigger to ensure TableComponent re-renders
                    // We use the standard STATE_CHANGED event which UIManager listens to.
                    setTimeout(() => {
                        const nextState = stateService.getState();
                        this.eventAggregator.publish(EVENTS.STATE_CHANGED, nextState);
                    }, 50); // Small delay to allow dispatch frame-batching to complete

                    // Close modal and cleanup
                    this.hide();
                    this.imageQueue = [];
                    this.renderQueue();

                    this.eventAggregator.publish(EVENTS.SHOW_NOTIFICATION, {
                        type: 'success',
                        message: `Successfully extracted ${cleanResults.length} items from OCR.`
                    });

                } catch (error) {
                    console.error("❌ [OCR] Extraction Failed:", error);
                    this.eventAggregator.publish(EVENTS.SHOW_NOTIFICATION, {
                        type: 'error',
                        message: "OCR Failed: " + error.message
                    });
                } finally {
                    // 6. Hide Loading UI
                    if (this.loadingOverlay) this.loadingOverlay.style.display = 'none';
                }
            });
        }

        // Listen for the global OCR request event
        this.eventAggregator.subscribe(EVENTS.USER_REQUESTED_OCR, (payload) => {
            if (payload && payload.imageUrl) {
                this.show(payload.imageUrl);
            }
        });
    }

    show(imageUrl) {
        if (!this.overlay || !this.imageElement) return;

        // Switch to Cropper View
        this.cropperView.style.display = 'flex';
        this.queueView.style.display = 'none';
        this.overlay.style.display = 'flex';

        this.imageElement.src = imageUrl;

        // Cleanup previous instance
        if (this.cropper) {
            this.cropper.destroy();
        }

        // Initialize Cropper.js
        this.cropper = new Cropper(this.imageElement, {
            viewMode: 1,
            dragMode: 'crop',
            autoCropArea: 0.9,
            background: false,
            responsive: true,
            restore: false,
            zoom: (e) => {
                if (this.zoomSlider) {
                    this.zoomSlider.value = e.detail.ratio;
                }
            }
        });
    }

    switchToQueue() {
        this.cropperView.style.display = 'none';
        this.queueView.style.display = 'flex';
        this.renderQueue();
    }

    hide() {
        if (this.overlay) {
            this.overlay.style.display = 'none';
        }
        if (this.cropper) {
            this.cropper.destroy();
            this.cropper = null;
        }
        // Hide magnifier just in case
        if (this.magnifier) this.magnifier.style.display = 'none';
        
        // Cleanup file input
        const fileInput = document.getElementById('hidden-ocr-file-input');
        if (fileInput) fileInput.value = '';
    }

    _handleConfirm() {
        if (!this.cropper) return;

        const croppedDataUrl = this.cropper.getCroppedCanvas().toDataURL('image/jpeg');
        
        // Push to queue
        this.imageQueue.push(croppedDataUrl);
        
        // Transition to queue view
        this.switchToQueue();
    }

    renderQueue() {
        if (!this.queueList) return;
        this.queueList.innerHTML = '';

        if (this.imageQueue.length === 0) {
            this.queueList.innerHTML = '<div style="text-align:center; color:#999; padding-top:40px;">No images in queue</div>';
            return;
        }

        this.imageQueue.forEach((dataUrl, index) => {
            const item = document.createElement('div');
            item.style.display = 'flex';
            item.style.background = 'white';
            item.style.padding = '10px';
            item.style.borderRadius = '8px';
            item.style.boxShadow = '0 2px 4px rgba(0,0,0,0.05)';
            item.style.alignItems = 'center';
            item.style.gap = '15px';

            item.innerHTML = `
                <div class="ocr-thumbnail-wrapper" style="width:80px; height:80px; border-radius:4px; overflow:hidden; background:#eee; flex-shrink:0;">
                    <img class="ocr-thumbnail-img" src="${dataUrl}" style="width:100%; height:100%; object-fit:cover; cursor: zoom-in; touch-action: none;">
                </div>
                <div style="flex-grow:1; font-weight:bold; color:#555;">Measurement ${index + 1}</div>
                <div style="display:flex; flex-direction:column; gap:5px;">
                    <button class="queue-up" data-index="${index}" style="padding:5px; background:#f0f0f0; border:none; border-radius:4px; cursor:pointer;" ${index === 0 ? 'disabled' : ''}>🔼</button>
                    <button class="queue-down" data-index="${index}" style="padding:5px; background:#f0f0f0; border:none; border-radius:4px; cursor:pointer;" ${index === this.imageQueue.length - 1 ? 'disabled' : ''}>🔽</button>
                </div>
                <button class="queue-delete" data-index="${index}" style="padding:10px; background:#fff0f0; color:#dc3545; border:none; border-radius:4px; cursor:pointer; font-size:18px;">🗑️</button>
            `;

            const img = item.querySelector('.ocr-thumbnail-img');

            // --- LOUPE LOGIC (Step 1.2.3) ---
            const startLoupe = (e) => {
                this.magnifier.style.display = 'block';
                this.magnifier.style.backgroundImage = `url(${dataUrl})`;
                this.magnifier.style.backgroundSize = '400%';
                updateLoupe(e);
            };

            const updateLoupe = (e) => {
                const clientX = e.touches ? e.touches[0].clientX : e.clientX;
                const clientY = e.touches ? e.touches[0].clientY : e.clientY;
                
                const magnifierSize = 150;
                const yOffsetAbove = 140;
                const yOffsetBelow = 40;

                // --- Y-axis Dynamic Flip (Step 1.2.4) ---
                let topPos = clientY - yOffsetAbove;
                if (clientY < yOffsetAbove + 10) {
                    // Too close to the top! Flip it BELOW the finger.
                    topPos = clientY + yOffsetBelow;
                }

                // --- X-axis Boundary Protection ---
                let leftPos = clientX - (magnifierSize / 2);
                if (leftPos < 10) leftPos = 10;
                const maxLeft = window.innerWidth - magnifierSize - 10;
                if (leftPos > maxLeft) leftPos = maxLeft;

                this.magnifier.style.left = `${leftPos}px`;
                this.magnifier.style.top = `${topPos}px`;

                // Calculate relative position within thumbnail for bg-position
                const rect = img.getBoundingClientRect();
                const x = ((clientX - rect.left) / rect.width) * 100;
                const y = ((clientY - rect.top) / rect.height) * 100;
                this.magnifier.style.backgroundPosition = `${x}% ${y}%`;
                
                if (e.cancelable) e.preventDefault();
            };

            const stopLoupe = () => {
                this.magnifier.style.display = 'none';
            };

            // Mouse Events
            img.addEventListener('mousedown', startLoupe);
            img.addEventListener('mousemove', (e) => {
                if (this.magnifier.style.display === 'block') updateLoupe(e);
            });
            img.addEventListener('mouseup', stopLoupe);
            img.addEventListener('mouseleave', stopLoupe);

            // Touch Events (Non-passive to prevent scrolling while magnifying)
            img.addEventListener('touchstart', startLoupe, { passive: false });
            img.addEventListener('touchmove', updateLoupe, { passive: false });
            img.addEventListener('touchend', stopLoupe);
            img.addEventListener('touchcancel', stopLoupe);

            // Action listeners for this specific item
            item.querySelector('.queue-up').addEventListener('click', () => this.moveItem(index, -1));
            item.querySelector('.queue-down').addEventListener('click', () => this.moveItem(index, 1));
            item.querySelector('.queue-delete').addEventListener('click', () => this.deleteItem(index));

            this.queueList.appendChild(item);
        });
    }

    moveItem(index, direction) {
        const newIndex = index + direction;
        if (newIndex < 0 || newIndex >= this.imageQueue.length) return;

        const temp = this.imageQueue[index];
        this.imageQueue[index] = this.imageQueue[newIndex];
        this.imageQueue[newIndex] = temp;

        this.renderQueue();
    }

    deleteItem(index) {
        if (confirm('Remove this image from queue?')) {
            this.imageQueue.splice(index, 1);
            this.renderQueue();
        }
    }
}
