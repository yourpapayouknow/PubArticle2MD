# PubArticle2MD

公众号文章转 Markdown / PDF，支持两种运行方式：

- GitHub Pages 在线纯前端模式（无需本地环境）
- Windows EXE 桌面模式（内置本地 API，无需手动安装 Node）

测试文章链接：

`https://mp.weixin.qq.com/s/5BOAnJ5H4seYxSbXWi5Ibg`

## 在线地址（GitHub Pages）

`https://yourpapayouknow.github.io/PubArticle2MD/`

## 运行模式说明

页面会自动检测环境，并在“运行模式”中显示当前状态：

1. 纯前端模式（GitHub Pages，可直接在线运行）
- 适合在线直接使用
- 受 CORS 与微信风控影响，建议优先“粘贴 HTML”模式

2. 本地 API 模式（桌面 EXE 内置后端 / Node 服务）
- 支持后端解析与后端 PDF 导出（Playwright）
- 桌面 EXE 会自动拉起本地服务，不需要手动 `npm start`

## Windows EXE 使用方式（推荐）

1. 打开仓库 Release 页面
2. 下载 `PubArticle2MD-xxx-windows-x64.exe`
3. 双击运行
4. 看到“运行模式”为“本地 API 模式（桌面 EXE 内置后端）”即可

## 本地开发运行（源码）

```bash
npm install
npm run install:chromium
npm start
```

打开：

`http://127.0.0.1:8787`

## 命令行转换

```bash
npm run convert -- --url "https://mp.weixin.qq.com/s/5BOAnJ5H4seYxSbXWi5Ibg" --outdir outputs
```

默认输出到 `outputs/`：

- `xxx.md`
- `xxx.zip`（Markdown + 资源文件）
- `xxx.pdf`

## 本地打包 EXE（关键）

```bash
npm install
npm run desktop:dist
```

说明：

- `desktop:dist` 会自动执行：
- 拷贝前端 vendor 依赖
- 检查并安装 Playwright Chromium 到 `node_modules`（用于随包封装）
- 构建 `dist-desktop/*.exe`

## 本地打包并上传 Release（不走 Actions 构建）

先确保你已安装并登录 GitHub CLI：

```bash
gh auth login
```

然后执行：

```bash
npm run release:local -- --tag v1.0.2
```

可选预发布：

```bash
npm run release:local -- --tag v1.0.2-beta --prerelease
```

该命令会：

1. 在本机打包 EXE
2. 创建或更新对应 Tag 的 GitHub Release
3. 上传 `dist-desktop/*.exe`

## GitHub Actions 说明

项目仍保留 Actions，作用如下：

1. `CI`
- 语法检查

2. `Deploy GitHub Pages`
- 自动发布 `public/` 到 GitHub Pages

3. `Build Desktop EXE`
- 可选的云端打包与发布流程
- 如果你更偏好“只用本机打包”，可直接使用 `npm run release:local`

## 免责声明

请仅在遵守平台规则与版权法规的前提下使用本项目。
