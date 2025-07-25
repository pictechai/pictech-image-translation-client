# 图片在线翻译与编辑器

这是一个功能强大的 Web 应用，它允许用户上传图片或提供图片 URL，调用后端服务对图片中的文字进行智能翻译和替换，并在一个功能丰富的在线编辑器中对翻译后的图片进行二次编辑。

## ✨ 主要功能

-   **多种导入方式**：支持从本地拖拽或选择文件上传，也支持通过 URL 导入网络图片。
-   **智能文本翻译**：集成强大的图像翻译 API，可自动识别图片中的文本并进行多语言翻译。
-   **多语言支持**：支持多种源语言和目标语言的选择。
-   **强大的在线编辑器**：
    -   基于 Fabric.js，提供画布操作。
    -   添加/编辑文本：自定义文本内容、字体、大小、颜色、行高等。
    -   局部恢复：可使用透明矩形擦除部分翻译内容，恢复原始图像。
    -   操作历史：支持撤销（Undo）和重做（Redo）,提示：当执行【局部恢复】操作后， 撤销和重做针无效，只能 执行复原。
    -   一键复原：随时可将所有修改恢复到翻译刚完成时的状态。
-   **导出图片**：可将最终编辑好的图片导出为 PNG 文件。
-   **现代化界面**：采用科技感 UI 设计，提供流畅的用户体验。

## 🏗️ 系统架构

本项目的架构分为前端和后端两部分，它们协同工作以完成复杂的图像翻译任务。

`[用户浏览器 (前端)] <--> [本项目 Spring Boot 后端 (代理)] <--> [外部图像翻译 API]`

-   **前端 (Frontend)**：位于 `src/main/resources/static` 目录。由 HTML, CSS, 和 JavaScript 构成，负责用户交互、界面展示和向本项目后端发送请求。
-   **后端 (Backend)**：是一个 Spring Boot 应用。它不直接处理图像，而是作为一个**安全代理**，接收来自前端的请求，附加上保密的 `API Key` 和 `Secret`，然后转发给真正的外部图像翻译 API。这样做可以避免在前端代码中暴露敏感密钥。

## 🔧 技术栈

-   **后端**: Java, Spring Boot
-   **前端**: HTML5, CSS3, JavaScript
-   **核心库**:
    -   [Fabric.js](http://fabricjs.com/): 用于实现强大的 HTML5 Canvas 交互式编辑器。
    -   [Tailwind CSS](https://tailwindcss.com/): 用于快速构建现代化、响应式的用户界面。

## 🚀 快速开始

请按照以下步骤配置并运行本应用。

### 1. 环境准备

-   **Java Development Kit (JDK)**: 推荐 JDK 8 或更高版本。
-   **Maven**: 用于构建和管理 Java 项目。
-   一个现代浏览器，如 Chrome, Firefox, 或 Edge。

### 2. 配置

在运行项目之前，您需要进行两处关键配置。

#### (1) 后端配置 (连接外部 API)

打开文件 `src/main/resources/application.properties`。

```properties
# 外部图像翻译 API 的服务器地址
pictech.api.base-url=http://example.com

# 您从 API 提供商处获取的 Key
pictech.api.key=aaaa

# 您从 API 提供商处获取的 Secret
pictech.api.secret=bbbbbbbb
```

-   请将 `pictech.api.key` 和 `pictech.api.secret` 的值替换为您自己的有效凭证。

#### (2) 前端配置 (连接本项目后端)

打开文件 `src/main/resources/static/editor/config.js`。

在文件的最上方，有一个 `API_CONFIG` 对象，用于管理所有前端到后端的请求路径。

```javascript
// --- 【新增】API 配置中心 ---
// 将所有与后端API相关的路径和设置集中在此处，方便修改和维护。
const API_CONFIG = {
    UPLOAD_API: '/api/translate/upload', // 文件上传接口
    URL_API: '/api/translate/url',       // URL 提交接口
    RESULT_API: '/api/translate/result'  // 结果轮询接口（不含 requestId）
    // 【配置项】轮询间隔时间（毫秒）。
    POLLING_INTERVAL_MS: 2000 // 当前设置为2秒
};
```

-   通常情况下，您**不需要修改**这些默认路径，因为它们与后端 `TranslationController` 中的路径是匹配的。
-   如果您需要调整后端的 Controller 路径，请务必在此处进行同步修改。
-   `polling_interval_ms` 控制了前端向后端查询翻译结果的频率，可以根据需要调整。

### 3. 运行项目

1.  导航到项目的根目录（即包含 `pom.xml` 文件的目录）。
2.  启动 ImageTranslationApiApplication 
3.  当您在控制台看到类似 `Started ImageTranslationApiApplication in ... seconds` 的日志时，表示后端服务已成功启动。

### 4. 访问应用

打开您的浏览器，访问以下地址：

[http://localhost:8080](http://localhost:8080)

应用会自动加载，并弹出“导入图片”窗口，您可以开始使用了。

## 📖 使用指南

1.  **导入图片**：在弹出的窗口中，选择“本地上传”或“图片 URL”标签页。
    -   **本地上传**：点击或拖拽图片文件到指定区域。
    -   **图片 URL**：粘贴图片的公开链接，然后点击“提交”。
2.  **选择语言**：导入图片后，界面会切换到语言选择视图。
    -   选择图片的**源语言**。
    -   选择您希望翻译成的**目标语言**。
    -   点击“立即翻译”按钮。
3.  **等待翻译**：应用会显示加载动画，并在后台处理翻译任务。
4.  **编辑图片**：翻译完成后，图片会加载到编辑器中。
    -   **修改文本**：双击图片上的文本框进行编辑。右侧会弹出工具面板，可调整字体、大小、颜色等。
    -   **添加新文本**：点击顶部“添加文本”按钮。
    -   **局部恢复**：点击“局部恢复”，在需要恢复的区域画一个矩形，该区域的翻译将被擦除，显示原始图像。
    -   **撤销/重做**：使用“撤销”和“重做”按钮来回退或重现您的操作。
5.  **导出**：编辑满意后，点击“导出图片”按钮，即可将最终成品保存到本地。

## 📁 文件结构说明

```
.
├── src
│   ├── main
│   │   ├── java
│   │   │   └── com
│   │   │       └── pictech
│   │   │           ├── client            # 调用外部API的客户端
│   │   │           ├── controller        # Spring MVC 控制器，处理前端请求
│   │   │           ├── service           # 业务逻辑服务
│   │   │           └── ImageTranslationApiApplication.java # Spring Boot 启动类
│   │   └── resources
│   │       ├── static                    # 存放所有前端静态资源
│   │       │   ├── editor
│   │       │   │   ├── config.js       # 核心API调用和流程控制逻辑
│   │       │   │   ├── call_api.js       # 核心API调用和流程控制逻辑
│   │       │   │   ├── editor.html       # 编辑器主页面
│   │       │   │   └── pictech_editor.js # Fabric.js画布操作逻辑
│   │       │   └── index.html            # 应用入口页面，内嵌editor.html
│   │       └── application.properties    # Spring Boot 配置文件
└── pom.xml                             # Maven 项目配置文件
```