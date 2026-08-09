import argparse
import sys
from PIL import Image

def trim_gif(input_path, output_path, start_sec, end_sec):
    try:
        img = Image.open(input_path)
    except Exception as e:
        print(f"Error opening {input_path}: {e}")
        sys.exit(1)

    # Gather all frames and their durations
    frames = []
    current_time_ms = 0
    start_ms = start_sec * 1000 if start_sec is not None else 0
    end_ms = end_sec * 1000 if end_sec is not None else float('inf')

    try:
        while True:
            # duration is usually in milliseconds
            duration = img.info.get('duration', 100) 
            if duration == 0:
                duration = 100

            if current_time_ms >= start_ms and current_time_ms <= end_ms:
                # Keep this frame
                frames.append(img.copy())

            current_time_ms += duration

            if current_time_ms > end_ms:
                break

            img.seek(img.tell() + 1)
    except EOFError:
        pass # Reached end of GIF

    if not frames:
        print("Error: No frames found in the specified time range.")
        sys.exit(1)

    # Save the trimmed GIF
    frames[0].save(
        output_path,
        save_all=True,
        append_images=frames[1:],
        loop=img.info.get('loop', 0),
        duration=img.info.get('duration', 100),
        disposal=img.info.get('disposal', 2)
    )

    print(f"Successfully trimmed GIF! Saved {len(frames)} frames to {output_path}")
    print(f"Time range kept: {start_sec}s to {end_sec}s")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Trim a GIF based on start and end seconds.")
    parser.add_argument("input", help="Path to input GIF file")
    parser.add_argument("--start", type=float, help="Start time in seconds (e.g. 1.5)", default=0.0)
    parser.add_argument("--end", type=float, help="End time in seconds (e.g. 3.0)", default=None)
    parser.add_argument("--out", help="Output GIF file path", required=True)

    args = parser.parse_args()
    trim_gif(args.input, args.out, args.start, args.end)
