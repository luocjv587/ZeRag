# PWA 安装功能说明

ZeRag 现在支持 PWA（Progressive Web App）功能，用户可以从浏览器将应用安装到设备上，就像原生应用一样。

## 功能特性

✅ **Web App Manifest** - 定义应用名称、图标、主题色等
✅ **Service Worker** - 支持离线访问和缓存
✅ **安装提示** - 自动检测并提示用户安装
✅ **独立窗口** - 安装后以独立窗口运行
✅ **快捷方式** - 支持添加到主屏幕

## 使用方法

### 桌面浏览器（Chrome/Edge）

1. 访问应用后，地址栏右侧会出现安装图标（⬇️）
2. 点击安装图标，选择"安装"
3. 应用将作为独立窗口打开

### 移动设备

#### iOS (Safari)
1. 点击底部分享按钮
2. 选择"添加到主屏幕"
3. 确认添加

#### Android (Chrome)
1. 浏览器会自动显示安装横幅
2. 或点击菜单中的"添加到主屏幕"
3. 确认安装

## 开发说明

### 文件结构

```
public/
├── manifest.json      # PWA 清单文件
├── sw.js             # Service Worker
├── icon-192.png      # 192x192 图标
├── icon-512.png      # 512x512 图标
└── icon.svg          # 源图标文件
```

### 自定义配置

编辑 `public/manifest.json` 可以修改：
- 应用名称和描述
- 主题色和背景色
- 图标路径
- 启动 URL
- 显示模式

### Service Worker 更新

Service Worker 会自动缓存静态资源。如需更新缓存策略，编辑 `public/sw.js`。

### 测试 PWA

1. 使用 HTTPS 或 localhost 访问（PWA 需要安全上下文）
2. 打开浏览器开发者工具
3. 在 Application 标签页查看：
   - Manifest
   - Service Workers
   - Cache Storage

## 注意事项

- PWA 需要 HTTPS 或 localhost 才能正常工作
- Service Worker 仅在生产环境或通过 HTTPS 访问时生效
- 图标文件必须存在，否则安装可能失败
- 首次安装后，应用会缓存基本资源以支持离线访问

## 故障排除

### 安装按钮不显示
- 确保使用 HTTPS 或 localhost
- 检查 manifest.json 是否正确
- 清除浏览器缓存后重试

### Service Worker 未注册
- 检查浏览器控制台错误信息
- 确保 sw.js 文件可访问
- 检查 Service Worker 作用域设置

### 图标不显示
- 确认 icon-192.png 和 icon-512.png 存在
- 检查 manifest.json 中的图标路径
- 清除浏览器缓存
