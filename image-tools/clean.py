"""
Image Cleaner — 豆包生图后处理工具
用法:
  python image-tools/clean.py <input> <output> [--scale N] [--ai]

功能:
  1. OpenCV inpaint 去除豆包水印
  2. 默认 PIL Lanczos (3×) 或 --ai 使用 Real-ESRGAN (4×)

依赖: pip install opencv-python pillow numpy
"""
import cv2
import numpy as np
from PIL import Image
import sys, os

def remove_watermark(input_path):
    """Remove Doubao watermark using OpenCV inpainting. Returns cleaned BGR image."""
    # Use numpy to read file bytes first (avoids OpenCV unicode path issue on Windows)
    img_array = np.frombuffer(np.fromfile(input_path, dtype=np.uint8), dtype=np.uint8)
    img = cv2.imdecode(img_array, cv2.IMREAD_COLOR)
    if img is None:
        print(f"ERROR: Cannot read {input_path}")
        sys.exit(1)
    h, w = img.shape[:2]
    mask = np.zeros((h, w), dtype=np.uint8)

    def detect_region(rx, ry, rw, rh, bg_y_offset):
        """Detect watermark region using adaptive threshold + connected components"""
        roi = img[ry:ry+rh, rx:rx+rw]
        gray = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)
        
        # Sample background
        bg_y = ry + rh + bg_y_offset if bg_y_offset > 0 else max(0, ry - 15)
        bg_roi = img[max(0,bg_y):min(h,bg_y+15), rx:rx+rw]
        bg_mean = np.mean(cv2.cvtColor(bg_roi, cv2.COLOR_BGR2GRAY)) if bg_roi.size > 0 else 50
        
        # Adaptive threshold
        _, roi_mask = cv2.threshold(gray, bg_mean + 15, 255, cv2.THRESH_BINARY)
        kernel = np.ones((3,3), np.uint8)
        roi_mask = cv2.dilate(roi_mask, kernel, iterations=2)
        
        # Filter small noise
        num_labels, labels, stats, _ = cv2.connectedComponentsWithStats(roi_mask, connectivity=8)
        clean = np.zeros_like(roi_mask)
        for i in range(1, num_labels):
            if stats[i, cv2.CC_STAT_AREA] >= 6:
                clean[labels == i] = 255
        mask[ry:ry+rh, rx:rx+rw] = clean

    # Top-left: "AI生成"
    detect_region(0, 0, int(w * 0.45), int(h * 0.08), 1)

    result = cv2.inpaint(img, mask, inpaintRadius=3, flags=cv2.INPAINT_NS)
    return result, np.count_nonzero(mask)

def upscale(input_path, output_path, scale):
    """Upscale image using Lanczos resampling."""
    img = Image.open(input_path)
    w, h = img.size
    result = img.resize((w * scale, h * scale), Image.LANCZOS)
    result.save(output_path)
    print(f"  Upscale: {w}x{h} -> {w*scale}x{h*scale}")

def main():
    if len(sys.argv) < 3:
        print("Usage: python clean_image.py <input> <output> [--scale N] [--ai]")
        print("Example: python clean_image.py in.png out.png --scale 3")
        print("         python clean_image.py in.png out.png --ai  (Real-ESRGAN 4×)")
        sys.exit(1)

    input_path = sys.argv[1]
    output_path = sys.argv[2]
    scale = 3
    use_ai = False
    args = sys.argv[3:]
    i = 0
    while i < len(args):
        if args[i] == '--scale':
            scale = int(args[i+1]); i += 2
        elif args[i] == '--ai':
            use_ai = True; i += 1
        else:
            i += 1

    # Step 1: Remove watermark
    print(f"Input: {input_path}")
    cleaned, fixed = remove_watermark(input_path)
    print(f"  Watermark: {fixed} pixels inpainted")
    
    # Save intermediate (use numpy encode to avoid unicode path issue)
    tmp_path = output_path + ".tmp.png"
    cv2.imencode('.png', cleaned)[1].tofile(tmp_path)
    
    # Step 2: Upscale
    if use_ai:
        import subprocess
        toolkit_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        esrgan = os.path.join(toolkit_root, "realesrgan", "realesrgan-ncnn-vulkan.exe")
        if os.path.exists(esrgan):
            subprocess.run([esrgan, "-i", tmp_path, "-o", output_path, "-s", "4", "-n", "realesrgan-x4plus"], check=True)
            print(f"  AI upscale (Real-ESRGAN 4×)")
        else:
            print(f"  WARNING: Real-ESRGAN not found at {esrgan}, falling back to Lanczos")
            upscale(tmp_path, output_path, scale)
    else:
        upscale(tmp_path, output_path, scale)
    
    # Cleanup
    if os.path.exists(tmp_path):
        os.remove(tmp_path)
    print(f"Output: {output_path}")

if __name__ == "__main__":
    main()
