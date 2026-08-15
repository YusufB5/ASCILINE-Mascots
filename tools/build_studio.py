import urllib.request
import os

html_template = """<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>ASCILINE Mascot Studio</title>
    <script>
    // --- OMGGIF LIBRARY EMBEDDED ---
    // (c) Dean McNamee <dean@gmail.com>, 2013.
    // https://github.com/deanm/omggif
    [OMGGIF_SOURCE]
    // --- END OMGGIF ---
    </script>
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #121215; color: #eee; margin: 0; padding: 20px; display: flex; flex-direction: column; align-items: center; }
        h1 { color: #00ffcc; text-shadow: 0 0 10px rgba(0,255,204,0.5); }
        .studio-container { display: flex; gap: 20px; width: 100%; max-width: 1000px; }
        .panel { background: #1e1e24; border: 1px solid #333; border-radius: 8px; padding: 20px; flex: 1; }
        #drop-zone { border: 2px dashed #00ffcc; border-radius: 8px; padding: 40px 20px; text-align: center; cursor: pointer; transition: all 0.3s; margin-bottom: 20px; }
        #drop-zone:hover, #drop-zone.dragover { background: rgba(0, 255, 204, 0.1); }
        #canvas-container { width: 100%; height: 300px; background: #000; display: flex; align-items: center; justify-content: center; margin-bottom: 20px; border-radius: 4px; overflow: hidden; background-image: linear-gradient(45deg, #222 25%, transparent 25%), linear-gradient(-45deg, #222 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #222 75%), linear-gradient(-45deg, transparent 75%, #222 75%); background-size: 20px 20px; background-position: 0 0, 0 10px, 10px -10px, -10px 0px; }
        canvas { image-rendering: pixelated; max-width: 100%; max-height: 100%; }
        .controls { display: grid; gap: 15px; }
        .control-group { display: flex; align-items: center; gap: 10px; }
        input[type="range"] { flex: 1; }
        input[type="number"] { width: 80px; padding: 5px; background: #333; border: 1px solid #555; color: #fff; border-radius: 4px; }
        button { background: #333; color: #fff; border: 1px solid #555; padding: 8px 16px; cursor: pointer; border-radius: 4px; font-weight: bold; transition: 0.2s; }
        button:hover { background: #555; }
        button.primary { background: #00ffcc; color: #000; border: none; padding: 12px; font-size: 16px; width: 100%; margin-top: 10px;}
        button.primary:hover { background: #00ccaa; }
        .timeline-info { display: flex; justify-content: space-between; color: #888; font-size: 14px; margin-bottom: 5px; }
        .trim-markers { display: flex; justify-content: space-between; margin-top: -10px; font-size: 12px; color: #00ffcc; }
    </style>
</head>
<body>
    <h1>ASCILINE Mascot Studio</h1>
    <p>Drag & Drop a GIF, select your animation loop, and export directly to JSON!</p>
    <div class="studio-container">
        <div class="panel">
            <div id="drop-zone">
                <h3>Drag & Drop GIF Here</h3>
                <p>or click to select file</p>
                <input type="file" id="file-input" accept="image/gif" style="display: none;">
            </div>
            <div id="canvas-container"><canvas id="preview-canvas"></canvas></div>
            <div class="timeline-info"><span id="time-display">0.00s</span><span id="frame-display">Frame 0 / 0</span></div>
            <input type="range" id="scrubber" min="0" max="0" value="0" disabled>
            <div class="trim-markers"><span id="start-marker">Start: 0</span><span id="end-marker">End: All</span></div>
        </div>
        <div class="panel controls">
            <h3>Trim & Playback</h3>
            <div class="control-group">
                <button id="btn-set-start" disabled>Set Start Frame</button>
                <button id="btn-set-end" disabled>Set End Frame</button>
                <button id="btn-reset-trim" disabled>Reset Range</button>
            </div>
            <hr style="border: none; border-top: 1px solid #333; width: 100%; margin: 15px 0;">
            <h3>Mascot Settings</h3>
            <div class="control-group">
                <label style="min-width: 140px;">ASCII Width (Cols):</label>
                <input type="number" id="input-cols" value="50" min="10" max="300">
            </div>
            <div class="control-group">
                <label style="min-width: 140px;">Facing Direction:</label>
                <select id="select-facing" style="background:#333; color:#fff; border:1px solid #555; padding:5px; border-radius:4px; flex:1;">
                    <option value="right">Right (Default)</option>
                    <option value="left">Left</option>
                </select>
            </div>
            <div class="control-group">
                <label style="min-width: 140px;">Idle Mode:</label>
                <select id="select-idle" style="background:#333; color:#fff; border:1px solid #555; padding:5px; border-radius:4px; flex:1;">
                    <option value="freeze">Freeze on stop</option>
                    <option value="play">Keep animating</option>
                    <option value="0">Reset to Frame 0</option>
                </select>
            </div>
            <hr style="border: none; border-top: 1px solid #333; width: 100%; margin: 15px 0;">
            <div style="display:flex; gap:10px;">
                <button id="btn-export-color" class="primary" style="flex:1;" disabled>Export Color JSON</button>
                <button id="btn-export-text" class="primary" style="background:#4da6ff; flex:1;" disabled>Export Mono Text JSON</button>
            </div>
        </div>
    </div>
    <script>
        let gifReader = null;
        let startFrameIdx = 0;
        let endFrameIdx = 0;
        let numFrames = 0;
        let frameDelays = [];
        let currentBaseName = "mascot";
        
        const ASCII_CHARS = "@%#*+=-:. ";
        
        const canvas = document.getElementById('preview-canvas');
        const ctx = canvas.getContext('2d');
        
        const dropZone = document.getElementById('drop-zone');
        const fileInput = document.getElementById('file-input');
        const scrubber = document.getElementById('scrubber');
        const timeDisplay = document.getElementById('time-display');
        const frameDisplay = document.getElementById('frame-display');
        const startMarker = document.getElementById('start-marker');
        const endMarker = document.getElementById('end-marker');
        
        dropZone.addEventListener('click', () => fileInput.click());
        dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('dragover'); });
        dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
        dropZone.addEventListener('drop', (e) => {
            e.preventDefault(); dropZone.classList.remove('dragover');
            if(e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
        });
        fileInput.addEventListener('change', (e) => {
            if(e.target.files.length) handleFile(e.target.files[0]);
        });
        
        function handleFile(file) {
            if (file.type !== "image/gif" && !file.name.toLowerCase().endsWith('.gif')) {
                return alert("Please drop a GIF file.");
            }
            currentBaseName = file.name.replace(/\\.[^/.]+$/, "");
            const reader = new FileReader();
            reader.onload = (e) => processGIF(e.target.result);
            reader.readAsArrayBuffer(file);
        }
        
        function processGIF(buffer) {
            try {
                gifReader = new GifReader(new Uint8Array(buffer));
                numFrames = gifReader.numFrames();
                canvas.width = gifReader.width;
                canvas.height = gifReader.height;
                
                frameDelays = [];
                for(let i=0; i<numFrames; i++) {
                    frameDelays.push(gifReader.frameInfo(i).delay * 10 || 100);
                }
                
                startFrameIdx = 0; 
                endFrameIdx = numFrames - 1;
                scrubber.max = numFrames - 1; 
                scrubber.value = 0; 
                scrubber.disabled = false;
                
                ['btn-set-start', 'btn-set-end', 'btn-reset-trim', 'btn-export-color', 'btn-export-text'].forEach(id => {
                    const el = document.getElementById(id);
                    if (el) el.disabled = false;
                });
                
                updateTrimMarkers();
                drawFrame(0);
            } catch (err) {
                console.error(err); alert("Error parsing GIF: " + err.message);
            }
        }
        
        function drawFrame(idx) {
            if(!gifReader) return;
            const pixels = new Uint8ClampedArray(gifReader.width * gifReader.height * 4);
            gifReader.decodeAndBlitFrameRGBA(idx, pixels);
            const imageData = new ImageData(pixels, gifReader.width, gifReader.height);
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.putImageData(imageData, 0, 0);
            
            let timeMs = 0; 
            for(let i=0; i<idx; i++) timeMs += frameDelays[i];
            timeDisplay.innerText = (timeMs / 1000).toFixed(2) + "s";
            frameDisplay.innerText = `Frame ${idx} / ${numFrames - 1}`;
        }
        
        scrubber.addEventListener('input', () => drawFrame(parseInt(scrubber.value)));
        
        document.getElementById('btn-set-start').onclick = () => { 
            startFrameIdx = parseInt(scrubber.value); 
            if(startFrameIdx > endFrameIdx) endFrameIdx = startFrameIdx; 
            updateTrimMarkers(); 
        };
        document.getElementById('btn-set-end').onclick = () => { 
            endFrameIdx = parseInt(scrubber.value); 
            if(endFrameIdx < startFrameIdx) startFrameIdx = endFrameIdx; 
            updateTrimMarkers(); 
        };
        document.getElementById('btn-reset-trim').onclick = () => { 
            startFrameIdx = 0; 
            endFrameIdx = numFrames - 1; 
            updateTrimMarkers(); 
        };
        
        function updateTrimMarkers() { 
            startMarker.innerText = `Start: ${startFrameIdx}`; 
            endMarker.innerText = `End: ${endFrameIdx}`; 
        }
        
        // Compute scaled pixel matrix and calculate cross-frame global bounding box
        function computeFramesData(cols) {
            const aspect = canvas.width / canvas.height;
            const scaledWidth = cols;
            const scaledHeight = Math.max(1, Math.round(cols / aspect / 2));
            
            let scaleCanvas = document.createElement('canvas');
            scaleCanvas.width = scaledWidth; 
            scaleCanvas.height = scaledHeight;
            let scaleCtx = scaleCanvas.getContext('2d', { willReadFrequently: true });
            
            let rawFrames = [];
            let minX = scaledWidth, minY = scaledHeight, maxX = -1, maxY = -1;
            
            for(let i = startFrameIdx; i <= endFrameIdx; i++) {
                drawFrame(i);
                scaleCtx.clearRect(0, 0, scaledWidth, scaledHeight);
                scaleCtx.drawImage(canvas, 0, 0, scaledWidth, scaledHeight);
                const imgData = scaleCtx.getImageData(0, 0, scaledWidth, scaledHeight).data;
                
                let frameMatrix = [];
                for(let y=0; y<scaledHeight; y++) {
                    let row = [];
                    for(let x=0; x<scaledWidth; x++) {
                        let idx = (y * scaledWidth + x) * 4;
                        let r = imgData[idx], g = imgData[idx+1], b = imgData[idx+2], a = imgData[idx+3];
                        if(a >= 128) {
                            if(x < minX) minX = x;
                            if(x > maxX) maxX = x;
                            if(y < minY) minY = y;
                            if(y > maxY) maxY = y;
                            row.push({ r, g, b, a });
                        } else {
                            row.push(null);
                        }
                    }
                    frameMatrix.push(row);
                }
                rawFrames.push(frameMatrix);
            }
            
            // If completely empty, fallback to full size
            if (minX > maxX || minY > maxY) {
                minX = 0; minY = 0; maxX = scaledWidth - 1; maxY = scaledHeight - 1;
            }
            
            const bbox = { minX, minY, maxX, maxY, width: maxX - minX + 1, height: maxY - minY + 1 };
            return { rawFrames, bbox, scaledWidth, scaledHeight };
        }
        
        function downloadJSON(data, filename) {
            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data, null, 2));
            const dl = document.createElement('a'); 
            dl.setAttribute("href", dataStr); 
            dl.setAttribute("download", filename);
            document.body.appendChild(dl); 
            dl.click(); 
            dl.remove();
        }
        
        document.getElementById('btn-export-color').onclick = () => {
            const cols = parseInt(document.getElementById('input-cols').value) || 50;
            const facing = document.getElementById('select-facing').value;
            const idleMode = document.getElementById('select-idle').value;
            
            const { rawFrames, bbox } = computeFramesData(cols);
            
            let colorFrames = [];
            for (let f = 0; f < rawFrames.length; f++) {
                let htmlLines = [];
                for (let y = bbox.minY; y <= bbox.maxY; y++) {
                    let rowHtml = "";
                    let currentType = null;
                    let currentColor = null;
                    let runLength = 0;
                    
                    for (let x = bbox.minX; x <= bbox.maxX; x++) {
                        let pixel = rawFrames[f][y][x];
                        let pType = pixel ? "color" : "space";
                        let pColor = pixel ? "#" + ((1 << 24) + (pixel.r << 16) + (pixel.g << 8) + pixel.b).toString(16).slice(1) : null;
                        
                        if (currentType === null) {
                            currentType = pType;
                            currentColor = pColor;
                            runLength = 1;
                        } else if (currentType === pType && currentColor === pColor) {
                            runLength++;
                        } else {
                            if (currentType === "space") {
                                rowHtml += " ".repeat(runLength);
                            } else {
                                rowHtml += `<span style='color:${currentColor}'>` + "█".repeat(runLength) + "</span>";
                            }
                            currentType = pType;
                            currentColor = pColor;
                            runLength = 1;
                        }
                    }
                    if (currentType === "space") {
                        rowHtml += " ".repeat(runLength);
                    } else if (currentType === "color") {
                        rowHtml += `<span style='color:${currentColor}'>` + "█".repeat(runLength) + "</span>";
                    }
                    htmlLines.push(rowHtml);
                }
                colorFrames.push(htmlLines.join("\n"));
            }
            
            const exportData = {
                name: currentBaseName,
                width: cols,
                frameCount: colorFrames.length,
                isColored: true,
                facing: facing,
                idleMode: idleMode,
                metadata: {
                    width: bbox.width,
                    height: bbox.height,
                    facing: facing,
                    idleMode: idleMode
                },
                frames: colorFrames
            };
            
            downloadJSON(exportData, `${currentBaseName}_coloranim.json`);
        };
        
        document.getElementById('btn-export-text').onclick = () => {
            const cols = parseInt(document.getElementById('input-cols').value) || 50;
            const facing = document.getElementById('select-facing').value;
            const idleMode = document.getElementById('select-idle').value;
            
            const { rawFrames, bbox } = computeFramesData(cols);
            
            let textFrames = [];
            for (let f = 0; f < rawFrames.length; f++) {
                let lines = [];
                for (let y = bbox.minY; y <= bbox.maxY; y++) {
                    let rowChars = [];
                    for (let x = bbox.minX; x <= bbox.maxX; x++) {
                        let pixel = rawFrames[f][y][x];
                        if (!pixel) {
                            rowChars.push(" ");
                        } else {
                            let gray = Math.round(0.2989 * pixel.r + 0.5870 * pixel.g + 0.1140 * pixel.b);
                            let charIdx = Math.round((gray / 255.0) * (ASCII_CHARS.length - 1));
                            rowChars.push(ASCII_CHARS[charIdx]);
                        }
                    }
                    lines.push(rowChars.join(""));
                }
                textFrames.push(lines.join("\n"));
            }
            
            const exportData = {
                name: currentBaseName,
                width: cols,
                frameCount: textFrames.length,
                isColored: false,
                facing: facing,
                idleMode: idleMode,
                metadata: {
                    width: bbox.width,
                    height: bbox.height,
                    facing: facing,
                    idleMode: idleMode
                },
                frames: textFrames
            };
            
            downloadJSON(exportData, `${currentBaseName}_textanim.json`);
        };
    </script>
</body>
</html>"""

def build():
    print("Downloading omggif.js...")
    req = urllib.request.Request("https://unpkg.com/omggif@1.0.10/omggif.js", headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req) as response:
        omggif_js = response.read().decode('utf-8')
        
    final_html = html_template.replace("[OMGGIF_SOURCE]", omggif_js)
    
    out_path = os.path.join(os.path.dirname(__file__), 'gif_studio.html')
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(final_html)
    print("Successfully built gif_studio.html with embedded omggif!")

if __name__ == "__main__":
    build()
