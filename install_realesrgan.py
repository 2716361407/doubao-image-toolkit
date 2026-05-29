"""
Real-ESRGAN 便携版下载器
下载 Real-ESRGAN NCNN Vulkan 版本到 realesrgan/ 目录
仅 Windows x64 支持
"""
import os, sys, urllib.request, zipfile, shutil

REALESRGAN_URL = "https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.5.0/realesrgan-ncnn-vulkan-20220424-windows.zip"
HERE = os.path.dirname(os.path.abspath(__file__))
TARGET_DIR = os.path.join(HERE, "realesrgan")

def download_with_progress(url, dest):
    print(f"下载: {url}")
    def report(count, block_size, total_size):
        pct = min(count * block_size * 100 / total_size, 100)
        sys.stdout.write(f"\r  {pct:.0f}% ({count * block_size // 1024 // 1024}MB / {total_size // 1024 // 1024}MB)")
        sys.stdout.flush()
    urllib.request.urlretrieve(url, dest, reporthook=report)
    print()

def main():
    if os.path.exists(os.path.join(TARGET_DIR, "realesrgan-ncnn-vulkan.exe")):
        print("Real-ESRGAN 已安装")
        return

    os.makedirs(TARGET_DIR, exist_ok=True)
    zip_path = os.path.join(TARGET_DIR, "realesrgan.zip")

    try:
        download_with_progress(REALESRGAN_URL, zip_path)
        print("解压...")
        with zipfile.ZipFile(zip_path, 'r') as zf:
            zf.extractall(TARGET_DIR)
        os.remove(zip_path)
        print(f"完成! 安装到: {TARGET_DIR}")
    except Exception as e:
        print(f"下载失败: {e}")
        print(f"请手动下载: {REALESRGAN_URL}")
        print(f"解压到: {TARGET_DIR}")

if __name__ == "__main__":
    main()
