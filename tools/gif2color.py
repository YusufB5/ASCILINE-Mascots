import sys
import json
import os
from PIL import Image

def resize_image(image, new_width=40):
    width, height = image.size
    # Adjust aspect ratio for monospace font height (characters are usually twice as tall as they are wide)
    ratio = height / width / 2.0
    new_height = int(new_width * ratio)
    resized_image = image.resize((new_width, new_height))
    return resized_image

def rgba_to_hex(r, g, b):
    return f"#{r:02x}{g:02x}{b:02x}"

def frame_to_html(frame):
    width, height = frame.size
    pixels = frame.getdata()
    
    html_lines = []
    
    for y in range(height):
        row_html = ""
        current_type = None # "space" or "color"
        current_color = None
        run_length = 0
        
        for x in range(width):
            r, g, b, a = pixels[y * width + x]
            
            if a < 128:
                p_type = "space"
                p_color = None
            else:
                p_type = "color"
                p_color = rgba_to_hex(r, g, b)
                
            if current_type is None:
                current_type = p_type
                current_color = p_color
                run_length = 1
            elif current_type == p_type and current_color == p_color:
                run_length += 1
            else:
                # Flush previous
                if current_type == "space":
                    row_html += " " * run_length
                else:
                    row_html += f"<span style='color:{current_color}'>" + ("█" * run_length) + "</span>"
                
                # Start new
                current_type = p_type
                current_color = p_color
                run_length = 1
                
        # Flush last run of the row
        if current_type == "space":
            row_html += " " * run_length
        elif current_type == "color":
            row_html += f"<span style='color:{current_color}'>" + ("█" * run_length) + "</span>"
            
        html_lines.append(row_html)
        
    return "\n".join(html_lines)

def extract_frames(gif_path, new_width):
    try:
        img = Image.open(gif_path)
    except Exception as e:
        print(f"Error opening image: {e}")
        return None

    raw_frames = []
    
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
        # Crop frame to global bounding box to remove empty padding
        if global_bbox:
            cropped = frame.crop(global_bbox)
        else:
            cropped = frame
            
        html_frame = frame_to_html(cropped)
        frames_html.append(html_frame)
        
    return frames_html

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python gif2color.py <input.gif> [width=40] [--l|--r] [--idle=freeze|play|0]")
        sys.exit(1)
        
    input_file = sys.argv[1]
    
    # Parse arguments
    width = 40
    facing = "right"
    idle_mode = "freeze" # Default to pausing on current frame
    
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
    output_file = f"{base_name}_coloranim.json"
    
    print(f"Processing {input_file} (Width: {width}, Facing: {facing}, Idle: {idle_mode}) with COLORS...")
    frames = extract_frames(input_file, width)
    
    if frames:
        data = {
            "name": base_name,
            "width": width,
            "frameCount": len(frames),
            "isColored": True,
            "facing": facing,
            "idleMode": idle_mode,
            "frames": frames
        }
        
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2)
            
        print(f"Successfully created {output_file} with {len(frames)} colored frames!")
        print("Load this JSON in SpriteMascot to see the full color pixel art.")
