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
    pixels = frame.load()
    
    html_lines = []
    
    for y in range(height):
        row_html = ""
        current_type = None # "space" or "color"
        current_color = None
        run_length = 0
        
        for x in range(width):
            r, g, b, a = pixels[x, y]
            
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

def extract_frames(gif_path, new_width, target_fps=None):
    try:
        img = Image.open(gif_path)
    except Exception as e:
        print(f"Error opening image: {e}")
        return None, 15

    # Detect native FPS from frame durations
    durations = []
    for frame_idx in range(img.n_frames):
        img.seek(frame_idx)
        d = img.info.get('duration', 100)
        durations.append(d if d > 0 else 100)
        
    avg_duration = sum(durations) / len(durations) if durations else 100
    detected_fps = max(1, round(1000.0 / avg_duration))
    export_fps = target_fps if target_fps else detected_fps
    
    print(f"Detected Native GIF FPS: ~{detected_fps} FPS | Export Target: {export_fps} FPS")

    # Temporal subsampling calculation
    frames_to_sample = []
    if export_fps < detected_fps:
        step = detected_fps / export_fps
        cur = 0.0
        while int(cur) < img.n_frames:
            frames_to_sample.append(int(cur))
            cur += step
    else:
        frames_to_sample = list(range(img.n_frames))

    raw_frames = []
    for idx in frames_to_sample:
        img.seek(idx)
        frame = img.convert("RGBA")
        frame = resize_image(frame, new_width)
        raw_frames.append(frame)
        
    # Find global bounding box of non-transparent pixels (using same alpha threshold as renderer)
    global_bbox = None
    for frame in raw_frames:
        alpha = frame.split()[3]
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
                
    frames_html = []
    for frame in raw_frames:
        if global_bbox:
            cropped = frame.crop(global_bbox)
        else:
            cropped = frame
            
        html_frame = frame_to_html(cropped)
        frames_html.append(html_frame)
        
    return frames_html, export_fps

if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Convert GIF animations to ASCILINE color matrix JSON files.")
    parser.add_argument("input", help="Path to input GIF file")
    parser.add_argument("pos_width", nargs="?", type=int, default=None, help="Character columns width (positional shortcut)")
    parser.add_argument("--cols", "--width", "-w", dest="cols", type=int, default=None, help="Character columns width (default: 40)")
    parser.add_argument("--fps", type=int, default=None, help="Target playback & sampling FPS (default: detect from GIF)")
    parser.add_argument("--facing", choices=["left", "right"], default="right", help="Native sprite facing direction (default: right)")
    parser.add_argument("--l", dest="facing_left", action="store_true", help="Shortcut for --facing left")
    parser.add_argument("--r", dest="facing_right", action="store_true", help="Shortcut for --facing right")
    parser.add_argument("--idle", dest="idle_mode", default="freeze", help="Idle animation mode: freeze, play, or frame number (default: freeze)")
    parser.add_argument("-o", "--output", dest="output", default=None, help="Custom output JSON path")

    args = parser.parse_args()

    input_file = args.input
    width = args.cols or args.pos_width or 40
    facing = "left" if args.facing_left else ("right" if args.facing_right else args.facing)
    idle_mode = args.idle_mode
    target_fps = args.fps

    base_name = os.path.splitext(os.path.basename(input_file))[0]
    output_file = args.output or f"{base_name}_coloranim.json"
    
    print(f"Processing {input_file} (Width: {width}, Facing: {facing}, Idle: {idle_mode}) with COLORS...")
    frames, final_fps = extract_frames(input_file, width, target_fps)
    
    if frames:
        data = {
            "name": base_name,
            "width": width,
            "fps": final_fps,
            "frameCount": len(frames),
            "isColored": True,
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
                
        out_dir = os.path.dirname(output_file)
        if out_dir and not os.path.exists(out_dir):
            os.makedirs(out_dir, exist_ok=True)

        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2)
            
        print(f"Successfully created {output_file} with {len(frames)} colored frames at {final_fps} FPS!")
        print("Load this JSON in SpriteMascot to see the full color pixel art.")
