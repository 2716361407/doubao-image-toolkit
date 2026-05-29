# 豆包 AI 图片工具箱

一站式图片生成与处理工具集：豆包 AI 生图 → 去水印 → AI 超分 → 抠图去背景。

## 三个核心能力

### 1. 豆包生图
Playwright 自动化控制浏览器，在豆包 Web 端生成图片。支持原图/预览两种模式。

### 2. 去水印 + 超分
OpenCV 智能检测豆包水印区域并 inpaint 修复。支持 PIL Lanczos 3× 或 Real-ESRGAN 4× AI 超分。

### 3. AI 抠图
基于 rembg (u2net) 深度学习模型，自动去除背景输出透明 PNG。

## 快速开始

```bash
# 安装 Node.js 依赖
cd doubao-gen && npm install && npx playwright install chromium && cd ..

# 安装 Python 依赖
pip install -r requirements.txt

# (可选) AI 超分模型
python install_realesrgan.py
```

### 首次登录豆包

```bash
npx --prefix doubao-gen ts-node --project doubao-gen/tsconfig.json doubao-gen/scripts/main.ts "测试" --ui
```

### 生图

```bash
npx --prefix doubao-gen ts-node --project doubao-gen/tsconfig.json doubao-gen/scripts/main.ts "一只赛博朋克猫" --output=./cat.png --quality=original
```

### 去水印 + 放大

```bash
python image-tools/clean.py cat.png cat_clean.png --scale 3
```

### 抠图

```bash
python image-tools/remove_bg.py cat_clean.png
```

### 一键流水线

```bash
python image-tools/pipeline.py "金色图标, 纯白背景" -o icon_bg.png --ratio 1:1
```

## 目录结构

```
doubao-image-toolkit/
├── SKILL.md                    # AI skill 定义
├── doubao-gen/                 # 豆包生图 (Node.js + Playwright)
│   ├── package.json
│   └── scripts/
│       ├── main.ts             # CLI 入口
│       └── doubao-webapi/
│           └── client.ts       # 核心客户端
├── image-tools/                # 图片处理 (Python)
│   ├── clean.py                # 去水印 + 超分
│   ├── remove_bg.py            # 抠图
│   └── pipeline.py             # 一键流水线
└── realesrgan/                 # AI 超分模型 (可选)
```

## License

MIT
