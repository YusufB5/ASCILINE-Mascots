import sys
import json
import os
from PIL import Image

ASCII_CHARS = " .:-=+*#%@"

def resize_image(image, new_width=40):
    width, height = image.size
    # Adjust aspect ratio for monospace font height (characters are usually twice as tall as they are wide)
    ratio = height / width / 2.0
    new_height = int(new_width * ratio)
    resized_image = image.resize((new_width, new_height))
    return resized_image

def pixel_to_ascii(pixel):
    # pixel is a tuple (R, G, B, A)
    r, g, b, a = pixel
    if a < 128: # Transparent
        return " "
    
    # Calculate luminance
    gray = int(0.2989 * r + 0.5870 * g + 0.1140 * b)
    
    # Map to ascii - Dark colors (black) get denser characters (@, %), bright colors get lighter ones
    ASCII_CHARS = "@%#*+=-:. "
    char_idx = int((gray / 255.0) * (len(ASCII_CHARS) - 1))
    return ASCII_CHARS[char_idx]

def extract_frames(gif_path, new_width):
    try:
        img = Image.open(gif_path)
    except Exception as e:
        print(f"Error opening image: {e}")
        return None

    raw_frames = []
    
    # Iterate over frames in the GIF
    for frame_idx in range(img.n_frames):
        img.seek(frame_idx)
        frame = img.convert("RGBA")
        frame = resize_image(frame, new_width)
        raw_frames.append(frame)
        
    # Find global bounding box of non-transparent pixels
    global_bbox = None
    for frame in raw_frames:
        alpha = frame.split()[3]
        bbox = alpha.getbbox()
        if bbox:
            if global_bbox is None:
                global_bbox = list(bbox)
            else:
                global_bbox[0] = min(global_bbox[0], bbox[0])
                global_bbox[1] = min(global_bbox[1], bbox[1])
                global_bbox[2] = max(global_bbox[2], bbox[2])
                global_bbox[3] = max(global_bbox[3], bbox[3])

    frames_html = []
    for frame in raw_frames:
        if global_bbox:
            cropped = frame.crop(global_bbox)
        else:
            cropped = frame
            
        width, height = cropped.size
        pixels = cropped.getdata()
        
        row_htmls = []
        for y in range(height):
            row_html = ""
            current_type = None # "space" or "char"
            current_chars = ""
            
            for x in range(width):
                r, g, b, a = pixels[y * width + x]
                if a < 128:
                    p_type = "space"
                    p_char = " "
                else:
                    p_type = "char"
                    gray = int(0.2989 * r + 0.5870 * g + 0.1140 * b)
                    # ASCII_CHARS = "@%#*+=-:. "
                    char_idx = int((gray / 255.0) * 9)
                    p_char = "@%#*+=-:. "[char_idx]
                
                if current_type is None:
                    current_type = p_type
                    current_chars = p_char
                elif current_type == p_type:
                    current_chars += p_char
                else:
                    # Flush previous
                    if current_type == "space":
                        row_html += current_chars
                    else:
                        row_html += f"<span>{current_chars}</span>"
                    
                    # Start new
                    current_type = p_type
                    current_chars = p_char
                    
            # Flush last run of the row
            if current_type == "space":
                row_html += current_chars
            elif current_type == "char":
                row_html += f"<span>{current_chars}</span>"
                
            row_htmls.append(row_html)
            
        frames_html.append("\n".join(row_htmls))
        
    return frames_html

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python gif2mascot.py <input.gif> [width=40] [--l|--r]")
        sys.exit(1)
        
    input_file = sys.argv[1]
    
    # Parse arguments
    width = 40
    facing = "right"
    idle_mode = "freeze"
    
    for arg in sys.argv[2:]:
        if arg == "--l":
            facing = "left"
        elif arg == "--r":
            facing = "right"
        elif arg.startswith("--idle="):
            idle_mode = arg.split("=")[1]
        elif arg.isdigit():
            width = int(arg)
    
    base_name = os.path.splitext(os.path.basename(input_file))[0]
    output_file = f"{base_name}_anim.json"
    
    print(f"Processing {input_file} (Width: {width}, Facing: {facing}, Idle: {idle_mode})...")
    frames = extract_frames(input_file, width)
    
    if frames:
        data = {
            "name": base_name,
            "width": width,
            "frameCount": len(frames),
            "isColored": True, # Triggers span rendering in JS
            "facing": facing,
            "idleMode": idle_mode,
            "frames": frames
        }
        
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2)
            
        print(f"Successfully created {output_file} with {len(frames)} frames!")
        print("You can now load this JSON in your SpriteMascot.")
