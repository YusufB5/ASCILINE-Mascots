import sys
import json
import os
from PIL import Image

# Standard ASCII ramp from dark to light (high density to low density)
ASCII_CHARS = "@%#*+=-:. "

def resize_image(image, new_width=40):
    width, height = image.size
    # Adjust aspect ratio for monospace font height (characters are usually twice as tall as they are wide)
    ratio = height / width / 2.0
    new_height = int(new_width * ratio)
    if new_height < 1:
        new_height = 1
    resized_image = image.resize((new_width, new_height))
    return resized_image

def frame_to_ascii(frame):
    width, height = frame.size
    pixels = frame.load()
    
    lines = []
    for y in range(height):
        row_chars = []
        for x in range(width):
            r, g, b, a = pixels[x, y]
            if a < 128:
                row_chars.append(" ")
            else:
                gray = int(0.2989 * r + 0.5870 * g + 0.1140 * b)
                char_idx = int((gray / 255.0) * (len(ASCII_CHARS) - 1))
                row_chars.append(ASCII_CHARS[char_idx])
        lines.append("".join(row_chars))
        
    return "\n".join(lines)

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
        
    # Find global bounding box of non-transparent pixels (using same alpha threshold as renderer)
    global_bbox = None
    for frame in raw_frames:
        alpha = frame.split()[3]
        # Only consider pixels with alpha >= 128 as visible to match frame_to_ascii logic
        mask = alpha.point(lambda p: 255 if p >= 128 else 0)
        bbox = mask.getbbox()
        if bbox:
            if global_bbox is None:
                global_bbox = list(bbox)
            else:
                global_bbox[0] = min(global_bbox[0], bbox[0])
                global_bbox[1] = min(global_bbox[1], bbox[1])
                global_bbox[2] = max(global_bbox[2], bbox[2])
                global_bbox[3] = max(global_bbox[3], bbox[3])

    frames_text = []
    for frame in raw_frames:
        if global_bbox:
            cropped = frame.crop(global_bbox)
        else:
            cropped = frame
            
        text_frame = frame_to_ascii(cropped)
        frames_text.append(text_frame)
        
    return frames_text

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python gif2text.py <input.gif> [width=40] [--l|--r] [--idle=freeze|play|0]")
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
    output_file = f"{base_name}_textanim.json"
    
    print(f"Processing {input_file} (Width: {width}, Facing: {facing}, Idle: {idle_mode}) as pure ASCII text...")
    frames = extract_frames(input_file, width)
    
    if frames:
        data = {
            "name": base_name,
            "width": width,
            "frameCount": len(frames),
            "isColored": False,
            "facing": facing,
            "idleMode": idle_mode,
            "frames": frames
        }
        
        # Preserve existing metadata (like custom hitboxes) if file exists
        if os.path.exists(output_file):
            try:
                with open(output_file, 'r', encoding='utf-8') as f:
                    existing = json.load(f)
                    if 'metadata' in existing:
                        data['metadata'] = existing['metadata']
            except Exception:
                pass
                
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
            
        print(f"Successfully created {output_file} with {len(frames)} text frames!")
        print("Load this JSON in SpriteMascot for high-performance pure ASCII animation.")
