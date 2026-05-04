# PubArticle2MD（GitHub Pages 在线版 + 本地增强版）

PubArticle2MD 是一个公众号文章转换工具，支持导出 Markdown 和 PDF。

- 在线模式：直接部署到 GitHub Pages，打开网页即可运行（纯前端）。
- 本地增强模式：启动 Node 服务后，使用后端抓取与高保真 PDF 导出。

## 在线地址（GitHub Pages）

部署后地址通常是：

`https://yourpapayouknow.github.io/PubArticle2MD/`

## Windows EXE（推荐给普通用户）

如果你不想安装 Node/npm，可以直接下载 Release 里的 Windows 便携版 EXE：

1. 打开仓库 `Releases` 页面。
2. 下载 `PubArticle2MD-xxx-windows-x64.exe`。
3. 双击运行即可使用。

说明：
- EXE 内已包含运行时环境，不需要额外安装 Node。
- EXE 默认运行“纯前端模式”（与 Pages 模式一致），适合直接使用和分发。

## 运行模式说明

页面会自动检测并显示当前模式：

1. 纯前端模式（GitHub Pages）
- 无需本地服务，打开网页即可转换。
- 支持三种抓取方式：自动、代理 URL、粘贴 HTML。
- 受浏览器跨域限制影响，某些公众号链接可能无法直接抓取，建议使用“粘贴 HTML”。

2. 本地 API 模式（Node 服务）
- 需要本地启动 `npm start`。
- 支持后端抓取、懒加载图片修复、Playwright 生成高保真 PDF。

## GitHub Pages 直接在线使用（你需要的方式）

1. 打开 Pages 页面。
2. 选择抓取方式：
- 自动（推荐，系统会根据环境选择）
- 代理 URL（纯前端跨域受限时可用）
- 粘贴 HTML（最稳定）
3. 点击“解析”。
4. 点击“下载 Markdown ZIP”或“下载 PDF”。

说明：
- 由于 `mp.weixin.qq.com` 存在反爬与 CORS 限制，“粘贴 HTML”是最稳定方案。
- 纯前端模式下，若图片跨域不可读，ZIP 中会保留原图链接并提示部分图片下载失败。

## 本地启动（高保真）

```bash
npm install
npm run install:chromium
npm start
```

打开：

`http://localhost:8787`

## 命令行批处理（本地）

```bash
npm run convert -- --url "https://mp.weixin.qq.com/s/5BOAnJ5H4seYxSbXWi5Ibg" --outdir outputs
```

输出目录默认 `outputs/`，通常包含：

- `xxx.md`
- `xxx.zip`（Markdown + assets）
- `xxx.pdf`

## GitHub Actions（已调整）

当前工作流：

1. `CI`
- push / PR 时执行依赖安装与语法检查。

2. `Deploy GitHub Pages`
- push 到 `main` 后自动发布 `public/` 到 GitHub Pages。
- 也支持手动 `workflow_dispatch`。

3. `Build Desktop EXE`
- `push tag (v*)` 或手动触发时，自动构建 Windows 便携版 EXE。
- 构建成功后自动上传到 GitHub Release，同时保留 workflow artifact。

发布 EXE 的两种方式：

1. 打 tag 自动发布
```bash
git tag v0.2.0
git push origin v0.2.0
```
2. 在 Actions 页面手动运行 `Build Desktop EXE`，填写 tag。

## 技术说明（简要）

- 文章正文提取：优先 `#js_content`。
- 懒加载修复：优先 `data-src` 回填 `src`。
- Markdown：Turndown + GFM 插件转换。
- 前端 PDF：html2pdf.js。
- 后端 PDF：Playwright Chromium（本地 API 模式）。

## 免责声明

请仅在遵守平台规则与版权法规的前提下使用本项目。
