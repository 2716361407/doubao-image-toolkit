"""
豆包生图 → 去水印 → 抠图 一键工作流
用法:
  python scripts/tools/doubao_to_bg.py "一只可爱的金色猫咪，白色纯色背景" -o output.png
  python scripts/tools/doubao_to_bg.py "金色箭头图标" --ratio 1:1 -o arrow.png
"""
import sys, os, subprocess, cv2, numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
TOOLKIT_ROOT = os.path.dirname(HERE)
DOUBAO_SCRIPT = os.path.join(TOOLKIT_ROOT, "doubao-gen", "scripts", "main.ts")
TEMP_DIR = os.path.join(HERE, "temp")


def remove_watermark(input_path: str, output_path: str) -> None:
	"""OpenCV inpaint 去水印"""
	print(f"  去水印: {input_path}")
	img = cv2.imread(input_path)
	if img is None:
		print("  跳过（读取失败）")
		return

	h, w = img.shape[:2]
	# 豆包水印在左上角
	mask = np.zeros((h, w), dtype=np.uint8)
	x1, y1 = 8, 8
	x2, y2 = min(int(w * 0.2), 200), min(int(h * 0.06), 40)
	cv2.rectangle(mask, (x1, y1), (x2, y2), 255, -1)

	result = cv2.inpaint(img, mask, 3, cv2.INPAINT_TELEA)
	cv2.imwrite(output_path, result)
	print(f"  完成: {output_path}")


def main():
	if len(sys.argv) < 2:
		print(__doc__)
		sys.exit(1)

	# Parse args (supports both: "prompt" --opt  AND  --opt "prompt")
	prompt = None
	output = None
	ratio = None
	quality = "original"
	args = sys.argv[1:]
	i = 0
	while i < len(args):
		arg = args[i]
		if arg in ("--output", "-o") and i + 1 < len(args):
			output = os.path.abspath(args[i + 1]); i += 2
		elif arg == "--ratio" and i + 1 < len(args):
			ratio = args[i + 1]; i += 2
		elif arg == "--quality" and i + 1 < len(args):
			quality = args[i + 1]; i += 2
		elif not arg.startswith("-"):
			prompt = arg; i += 1
		else:
			i += 1

	if not prompt:
		print("错误: 缺少提示词")
		sys.exit(1)

	os.makedirs(TEMP_DIR, exist_ok=True)
	raw = os.path.join(TEMP_DIR, "step1_raw.png")
	clean = os.path.join(TEMP_DIR, "step2_clean.png")
	final = output or os.path.join(os.getcwd(), "output_bg.png")

	# 1. 豆包生图
	print(f"[1/3] 豆包生图: {prompt}")
	cmd = ["npx", "ts-node", DOUBAO_SCRIPT, prompt, f"--output={raw}", f"--quality={quality}"]
	if ratio:
		cmd.append(f"--ratio={ratio}")
	result = subprocess.run(cmd, cwd=os.path.dirname(DOUBAO_SCRIPT), timeout=120)
	if result.returncode != 0 or not os.path.exists(raw):
		print("生图失败")
		sys.exit(1)

	# 2. 去水印
	print("[2/3] 去水印")
	remove_watermark(raw, clean)

	# 3. 抠图
	print(f"[3/3] 抠图: {clean}")
	remove_bg = os.path.join(HERE, "remove_bg.py")
	subprocess.run(["python", remove_bg, clean, final], timeout=60)
	print(f"完成: {final}")


if __name__ == "__main__":
	main()
