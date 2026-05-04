# PubArticle2MD（本地 PWA 版）

PubArticle2MD 是一个本地运行的公众号文章转换工具，支持导出 Markdown 和 PDF。

## 项目特点

- 全流程本地执行，不依赖在线转换站点。
- 前端为 PWA，可安装到桌面使用。
- 支持公众号文章常见懒加载图片处理和防盗链场景。
- 支持浏览器页面使用，也支持命令行批处理。

## 环境要求

- Node.js 20 及以上（建议 22/24）
- npm

## 本地启动

```bash
npm install
npm run install:chromium
npm start
```

启动后访问：

`http://localhost:8787`

## 页面使用方法

1. 在输入框粘贴公众号文章链接（例如测试链接：`https://mp.weixin.qq.com/s/5BOAnJ5H4seYxSbXWi5Ibg`）。
2. 点击 `Parse` 解析并预览正文。
3. 点击 `Download Markdown ZIP` 下载 Markdown+图片资源包。
4. 点击 `Download PDF` 下载 PDF 文件。

如果微信返回环境验证页，可展开页面里的 fallback 区域，粘贴文章 HTML 再导出。

## 命令行使用方法

```bash
npm run convert -- --url "https://mp.weixin.qq.com/s/5BOAnJ5H4seYxSbXWi5Ibg" --outdir outputs
```

默认输出到 `outputs/`，通常会生成：

- `xxx.md`
- `xxx.zip`（Markdown + assets）
- `xxx.pdf`

## GitHub Actions

仓库地址：<https://github.com/yourpapayouknow/PubArticle2MD>

已配置两个工作流：

1. `CI`：在 push/PR 时安装依赖并执行语法检查。
2. `Convert WeChat Article`：手动触发，输入文章 URL 后生成导出文件并上传 artifact。

手动触发路径：

`Actions -> Convert WeChat Article -> Run workflow`

## 实现说明（简要）

- 从公众号页面提取 `#js_content` 正文。
- 优先使用 `data-src` 还原懒加载图片链接。
- 下载图片时附带 `Referer` 和常见浏览器 UA。
- PDF 导出时将图片内嵌为 Base64，再由 Playwright Chromium 生成。

## 免责声明

请仅在遵守平台规则与版权法规的前提下使用本项目。
