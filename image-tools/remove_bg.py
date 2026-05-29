"""
AI 抠图 — 基于 rembg (u2net)
支持单张图片或整个目录
"""
import sys
import os
from pathlib import Path
from rembg import remove, new_session

MODELS = ["u2net", "u2netp", "u2net_human_seg", "u2net_cloth_seg", "silueta", "isnet-general-use"]
IMG_EXTS = {".png", ".jpg", ".jpeg", ".webp", ".bmp"}


def remove_bg(input_path: str, output_path: str, model: str = "u2net"):
	session = new_session(model)
	with open(input_path, "rb") as f:
		data = f.read()
	result = remove(data, session=session)
	os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)
	with open(output_path, "wb") as f:
		f.write(result)
	print(f"  ✓ {os.path.basename(input_path)} → {os.path.basename(output_path)}")


def main():
	if len(sys.argv) < 2:
		print(__doc__)
		print("用法: python remove_bg.py <文件或目录> [-m 模型]")
		print(f"模型: {', '.join(MODELS)}")
		sys.exit(1)

	target = sys.argv[1]

	# 解析模型参数
	model = "u2net"
	for i, arg in enumerate(sys.argv):
		if arg == "-m" and i + 1 < len(sys.argv):
			model = sys.argv[i + 1]
			if model not in MODELS:
				print(f"未知模型: {model}，可用: {', '.join(MODELS)}")
				sys.exit(1)

	path = Path(target)
	if not path.exists():
		print(f"路径不存在: {target}")
		sys.exit(1)

	# 收集要处理的图片
	tasks = []
	if path.is_file():
		if path.suffix.lower() in IMG_EXTS:
			# 第二个参数指定输出路径
			if len(sys.argv) >= 3 and not sys.argv[2].startswith("-"):
				out = Path(sys.argv[2])
			else:
				out = path.parent / f"{path.stem}_bg{path.suffix}"
			tasks.append((str(path), str(out)))
		else:
			print(f"不支持的文件格式: {path.suffix}")
			sys.exit(1)
	elif path.is_dir():
		out_dir = path / "bg_removed"
		for f in sorted(path.iterdir()):
			if f.suffix.lower() in IMG_EXTS:
				out = out_dir / f"{f.stem}{f.suffix}"
				tasks.append((str(f), str(out)))
		if not tasks:
			print("目录中没有图片文件")
			sys.exit(1)

	print(f"模型: {model} | 共 {len(tasks)} 张图片")
	for inp, out in tasks:
		remove_bg(inp, out, model)
	print(f"完成! 输出到: {os.path.dirname(tasks[0][1])}")


if __name__ == "__main__":
	main()
