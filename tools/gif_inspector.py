import argparse
import sys
import base64
from PIL import Image
from io import BytesIO

HTML_TEMPLATE = """
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>GIF Inspector</title>
    <style>
        body { font-family: Arial, sans-serif; background: #1e1e1e; color: #fff; text-align: center; padding: 20px; }
        #viewer { margin: 20px auto; max-width: 80%; border: 2px solid #444; padding: 10px; background: #000; }
        img { max-width: 100%; height: auto; image-rendering: pixelated; }
        input[type=range] { width: 80%; margin: 20px 0; }
        .info { font-size: 24px; font-weight: bold; color: #00ffcc; margin-bottom: 10px; }
        .controls { margin-top: 20px; }
        button { padding: 10px 20px; font-size: 16px; cursor: pointer; background: #333; color: white; border: 1px solid #555; }
        button:hover { background: #555; }
    </style>
</head>
<body>
    <h2>ASCILINE - GIF Inspector</h2>
    <p>Use the slider to scrub through the GIF and find the exact seconds you want to trim.</p>
    
    <div id="viewer">
        <div class="info">Time: <span id="timeDisplay">0.00</span> s &nbsp;|&nbsp; Frame: <span id="frameDisplay">0</span></div>
        <img id="gifFrame" src="" alt="Frame">
        <br>
        <input type="range" id="scrubber" min="0" max="0" value="0" step="1">
    </div>

    <script>
        // Data injected by Python
        const frames = [__FRAMES__];
        const times = [__TIMES__];
        
        const scrubber = document.getElementById('scrubber');
        const img = document.getElementById('gifFrame');
        const timeDisplay = document.getElementById('timeDisplay');
        const frameDisplay = document.getElementById('frameDisplay');
        
        scrubber.max = frames.length - 1;
        
        function updateFrame() {
            const idx = parseInt(scrubber.value);
            img.src = frames[idx];
            timeDisplay.innerText = times[idx].toFixed(2);
            frameDisplay.innerText = idx + " / " + (frames.length - 1);
        }
        
        scrubber.addEventListener('input', updateFrame);
        
        // Initialize
        updateFrame();
    </script>
</body>
</html>
"""

def inspect_gif(input_path, output_path):
    try:
        img = Image.open(input_path)
    except Exception as e:
        print(f"Error opening {input_path}: {e}")
        sys.exit(1)

    frames_b64 = []
    times_sec = []
    
    current_time_ms = 0
    
    try:
        while True:
            duration = img.info.get('duration', 100)
            if duration == 0: duration = 100
                
            # Convert frame to base64 PNG
            # Convert to RGBA to ensure consistent format
            frame_img = img.convert("RGBA")
            buffered = BytesIO()
            frame_img.save(buffered, format="PNG")
            img_str = base64.b64encode(buffered.getvalue()).decode("utf-8")
            
            frames_b64.append(f"'data:image/png;base64,{img_str}'")
            times_sec.append(str(current_time_ms / 1000.0))
            
            current_time_ms += duration
            img.seek(img.tell() + 1)
    except EOFError:
        pass

    if not frames_b64:
        print("Error: No frames found.")
        sys.exit(1)

    frames_js = ",".join(frames_b64)
    times_js = ",".join(times_sec)
    
    html_content = HTML_TEMPLATE.replace("[__FRAMES__]", frames_js).replace("[__TIMES__]", times_js)
    
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(html_content)
        
    print(f"Success! Generated inspector tool at: {output_path}")
    print("Double click this HTML file to open it in your browser and scrub through the GIF.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Generate an HTML visual inspector for a GIF to find exact timestamps.")
    parser.add_argument("input", help="Path to input GIF file")
    
    args = parser.parse_args()
    out_path = args.input + "_inspector.html"
    inspect_gif(args.input, out_path)
