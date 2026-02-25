# PWA 图标生成说明

为了完整支持 PWA 安装功能，需要生成以下图标文件：

## 需要的图标尺寸

- `icon-192.png` - 192x192 像素
- `icon-512.png` - 512x512 像素

## 生成方法

### 方法 1：使用在线工具

1. 访问 https://realfavicongenerator.net/ 或 https://www.pwabuilder.com/imageGenerator
2. 上传 `icon.svg` 文件
3. 下载生成的图标文件
4. 将 `icon-192.png` 和 `icon-512.png` 放置到 `public/` 目录

### 方法 2：使用 ImageMagick（命令行）

```bash
# 安装 ImageMagick（如果未安装）
# macOS: brew install imagemagick
# Linux: sudo apt-get install imagemagick

# 从 SVG 生成 PNG
convert -background none -resize 192x192 public/icon.svg public/icon-192.png
convert -background none -resize 512x512 public/icon.svg public/icon-512.png
```

### 方法 3：使用 Node.js 脚本

创建一个临时脚本 `generate-icons.js`：

```javascript
const sharp = require('sharp')
const fs = require('fs')

async function generateIcons() {
  const svg = fs.readFileSync('public/icon.svg')
  
  await sharp(svg)
    .resize(192, 192)
    .png()
    .toFile('public/icon-192.png')
  
  await sharp(svg)
    .resize(512, 512)
    .png()
    .toFile('public/icon-512.png')
  
  console.log('图标生成完成！')
}

generateIcons()
```

然后运行：
```bash
npm install sharp
node generate-icons.js
```

## 临时解决方案

在生成图标之前，可以暂时使用以下命令创建占位图标（需要 ImageMagick）：

```bash
# 创建黑色背景的占位图标
convert -size 192x192 xc:#000000 -pointsize 72 -fill white -gravity center -annotate +0+0 "ZR" public/icon-192.png
convert -size 512x512 xc:#000000 -pointsize 192 -fill white -gravity center -annotate +0+0 "ZR" public/icon-512.png
```

或者直接复制现有的 `vite.svg` 并重命名（不推荐，但可以快速测试）。
