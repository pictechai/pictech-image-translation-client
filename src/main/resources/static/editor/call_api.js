// --- 【中文备注】引入 API 配置 ---
import API_CONFIG from './config.js';

// --- 【中文备注】全局变量和DOM元素引用 ---
const importModalOverlay = document.getElementById('import-modal-overlay');
const loadingOverlay = document.getElementById('loading-overlay');
const loadingText = document.getElementById('loading-text');
const editorView = document.getElementById('editor-container');
const languageSelectionView = document.getElementById('language-selection-view');
const languageSelectionOverlay = document.getElementById('language-selection-overlay'); // 【新增】获取遮罩层引用

const previewImage = document.getElementById('preview-image');
const sourceLanguageGroup = document.getElementById('source-language-group');
const destLanguageGroup = document.getElementById('dest-language-group');
const translateNowBtn = document.getElementById('translate-now-btn');
const closeLangViewBtn = document.getElementById('close-lang-view-btn');

let uploadedFile = null;
let uploadedImageUrl = null;
let currentTaskFilename = 'edited_image.png';
let originalUploadedImageUrl = null;
// --- 在全局变量区域添加 ---
let lastSentTemplateJson = null; // 【新增】用于缓存最后一次发送给父窗口的JSON
let isDirty = false; // 【新增】画布“脏”状态检查
let isSaving = false; // 【新增】防止重复保存的状态锁

// --- 【改造】将函数挂载到 window 对象，使其能被 HTML 中的 onclick 调用 ---
// 原因是 <script type="module"> 会创建独立的作用域，函数默认不是全局的。

// --- 【中文备注】显示导入图片的模态框 ---
window.showImportModal = function() {
    importModalOverlay.classList.add('visible');
}

// --- 【中文备注】隐藏导入图片的模态框 ---
window.hideImportModal = function() {
    importModalOverlay.classList.remove('visible');
    document.getElementById('url-input').value = ''; // 清空 URL 输入框
    document.getElementById('file-input').value = ''; // 清空文件输入
}

// --- 【中文备注】显示加载覆盖层 ---
function showLoadingOverlay(text) {
    loadingText.textContent = text;
    loadingOverlay.style.display = 'flex';
}

// --- 【中文备注】隐藏加载覆盖层 ---
function hideLoadingOverlay() {
    loadingOverlay.style.display = 'none';
}

// --- 【中文备注】切换到语言选择视图 ---
function showLanguageSelectionView(imageSrc) {
    previewImage.src = imageSrc;
    // 【修改】使用 class 控制显示，以触发过渡效果
    languageSelectionOverlay.classList.add('visible');
    languageSelectionView.classList.add('visible');
    translateNowBtn.disabled = true;
    const checkedDestRadio = destLanguageGroup.querySelector('input:checked');
    if (checkedDestRadio) {
        checkedDestRadio.checked = false;
        checkedDestRadio.parentElement.classList.remove('checked');
    }
}

// --- 【中文备注】切换回主编辑器视图 ---
function showEditorView() {
    // 【修改】使用 class 控制隐藏
    languageSelectionView.classList.remove('visible');
    languageSelectionOverlay.classList.remove('visible');
}





const SCHEMA_VERSION_KEY = 'fabritor_schema_version';
const SCHEMA_VERSION = 3;
const FABRITOR_CUSTOM_PROPS = [
'id',
'fabritor_desc',
'selectable',
'hasControls',
'sub_type',
'imageSource',
'imageBorder',
'oldArrowInfo'
];
// --- 【中文备注】语言列表配置，适配接口文档 ---
const LANGUAGES = {
    Chinese: 'zh', // 中文
    ChineseTraditional: 'zh-tw', // 中文繁体
    English: 'en', // 英语
    Russian: 'ru', // 俄语
    Japanese: 'ja', // 日语
    Korean: 'ko', // 韩语
    Thai: 'th', // 泰语
    French: 'fr', // 法语
    Czech: 'cs', // 捷克语
    German: 'de', // 德语
    Spanish: 'es', // 西班牙语
    Croatian: 'hbs', // 克罗地亚语
    Hungarian: 'hu', // 匈牙利语
    Indonesian: 'id', // 印度尼西亚语
    Italian: 'it', // 意大利语
    Malay: 'ms', // 马来语
    Dutch: 'nl', // 荷兰语
    Polish: 'pl', // 波兰语
    Portuguese: 'pt', // 葡萄牙语
    Romani: 'rom', // 罗姆语
    Turkish: 'tr', // 土耳其语
    Vietnamese: 'vi' // 越南语

};

// --- 【中文备注】源语言列表，基于接口文档 ---
const SOURCE_LANGUAGES = {
    Chinese: 'zh', // 中文
    English: 'en', // 英语
    ChineseTraditional: 'zh-tw', // 中文繁体
    Japanese: 'ja' // 日语
};

// --- 【中文备注】语言中文名称映射，用于显示 ---
const LANGUAGE_DISPLAY_NAMES = {
    'cs': '捷克语',
    'de': '德语',
    'en': '英语',
    'es': '西班牙语',
    'fr': '法语',
    'hbs': '克罗地亚语',
    'hu': '匈牙利语',
    'id': '印度尼西亚语',
    'it': '意大利语',
    'ja': '日语',
    'ko': '韩语',
    'ms': '马来语',
    'nl': '荷兰语',
    'pl': '波兰语',
    'pt': '葡萄牙语',
    'rom': '罗姆语',
    'ru': '俄语',
    'th': '泰语',
    'tr': '土耳其语',
    'vi': '越南语',
    'zh': '中文',
    'zh-tw': '中文繁体'
};



// --- 【中文备注】创建单个语言单选框 ---
function createRadioButton(key, code, name, isChecked) {
    const label = document.createElement('label');
    label.className = `language-radio-label ${isChecked ? 'checked' : ''}`;
    const input = document.createElement('input');
    input.type = 'radio';
    input.name = name;
    input.value = code; // 使用接口文档的语言代码
    input.className = 'language-radio-input hidden'; // 隐藏原生radio
    input.checked = isChecked;
    input.addEventListener('change', () => {
        document.querySelectorAll(`input[name="${name}"]`).forEach(radio => {
            radio.parentElement.classList.toggle('checked', radio.checked);
        });
        if (name === 'dest_lang' && destLanguageGroup.querySelector('input:checked')) {
             translateNowBtn.disabled = false;
        }
    });
    const span = document.createElement('span');
    span.textContent = LANGUAGE_DISPLAY_NAMES[code]; // 显示中文名称
    label.appendChild(input);
    label.appendChild(span);
    return label;
}

// --- 【中文备注】初始化语言选项 ---
function initializeLanguageOptions() {
    // 清空现有选项以防重复添加
    sourceLanguageGroup.innerHTML = '';
    destLanguageGroup.innerHTML = '';

    Object.entries(SOURCE_LANGUAGES).forEach(([key, code]) => {
        // 默认选中中文作为源语言
        sourceLanguageGroup.appendChild(createRadioButton(key, code, 'source_lang', key === 'Chinese'));
    });
    Object.entries(LANGUAGES).forEach(([key, code]) => {
        destLanguageGroup.appendChild(createRadioButton(key, code, 'dest_lang', false));
    });
    translateNowBtn.addEventListener('click', handleTranslateNowClick);

      // 【新增】为关闭按钮绑定事件
    closeLangViewBtn.addEventListener('click', () => {
        // 点击关闭时，直接切换回编辑器视图
        showEditorView();
        // 并且加载原始图片（如果存在）
        resetWithNotQueRen();
    });
}
// --- 【核心】与父窗口通信 ---

/**
 * 监听来自父窗口的消息
 */
window.addEventListener('message', (event) => {
    // 安全性检查 (可选但推荐)
    // if (event.origin !== 'http://your-main-domain.com') return;
    const data = event.data;
    if (data.type === 'loadData' && data.payload) {
        console.log('从父窗口收到加载指令:', data.payload);
        showEditorView();
        // 调用现有的 loadFromAPI 函数来加载数据
        loadFromAPI(data.payload);
    }
});

/**
 * 【核心】当编辑器完成一次新的翻译时，将结果发送回父窗口
 * @param {object} newApiResponse - 新的 API 响应数据
 */
function sendResultToParent(newApiResponse) {
    console.log('向父窗口发送新的翻译结果:', newApiResponse);
    // 使用 window.parent.postMessage 发送消息
    window.parent.postMessage({
        type: 'newTranslationResult',
        payload: newApiResponse
    }, '*'); // 在生产环境中，应将 '*' 替换为父窗口的确切源
}

/**
 * 【核心】当编辑器完成一次新的翻译时，将结果发送回父窗口
 * @param {object} newApiResponse - 新的 API 响应数据
 */
function sendResultToParentForSave(newApiResponse) {
    console.log('向父窗口发送新的翻译结果:', newApiResponse);
    // 使用 window.parent.postMessage 发送消息
    window.parent.postMessage({
        type: 'saveTranslationResult',
        payload: newApiResponse
    }, '*'); // 在生产环境中，应将 '*' 替换为父窗口的确切源
}
// --- 【中文备注】处理文件上传 ---
function handleFileSubmit(file) {
    if (!file || !file.type.startsWith('image/')) return alert('请上传有效的图片文件！');
    window.hideImportModal();
    uploadedFile = file;
    uploadedImageUrl = null;
    originalUploadedImageUrl = URL.createObjectURL(file);
    showLanguageSelectionView(originalUploadedImageUrl);
}

// --- 【中文备注】处理 URL 提交 ---
window.handleUrlSubmit = function() {
    const imageUrl = document.getElementById('url-input').value.trim();
    if (!imageUrl) return alert('请输入有效的图片 URL！');
    window.hideImportModal();
    uploadedFile = null;
    uploadedImageUrl = imageUrl;
    originalUploadedImageUrl = imageUrl;
    showLanguageSelectionView(originalUploadedImageUrl);
}

// --- 【中文备注】处理“立即翻译”点击事件 ---
async function handleTranslateNowClick() {
    const sourceLang = sourceLanguageGroup.querySelector('input:checked')?.value;
    const destLang = destLanguageGroup.querySelector('input:checked')?.value;

    if (!sourceLang || !destLang) {
        alert('请选择源语言和目标语言。');
        return;
    }

    let submissionPromise;
    if (uploadedFile) {
        const formData = new FormData();
        formData.append('file', uploadedFile);
        formData.append('sourceLanguage', sourceLang);
        formData.append('targetLanguage', destLang);
        submissionPromise = fetch(API_CONFIG.UPLOAD_API, { method: 'POST', body: formData });
    } else if (uploadedImageUrl) {
        submissionPromise = fetch(API_CONFIG.URL_API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ imageUrl: uploadedImageUrl, sourceLanguage: sourceLang, targetLanguage: destLang })
        });
    } else {
        return alert('错误：找不到上传的图片信息！');
    }
    startTranslationProcess(submissionPromise);
}

// --- 【中文备注】开始翻译流程 ---
async function startTranslationProcess(submissionPromise) {
    showLoadingOverlay('正在提交任务...');
    languageSelectionView.classList.remove('visible');
    languageSelectionOverlay.classList.remove('visible');

    try {
        const response = await submissionPromise;
        if (!response.ok) { // 更稳健的状态码检查
            const errorData = await response.json().catch(() => ({})); // 避免JSON解析错误
            throw new Error(`提交失败: ${errorData.error || response.statusText}`);
        }

        const data = await response.json();
        if (!data.RequestId) throw new Error('提交成功，但未返回任务ID');

        showLoadingOverlay('任务处理中，请稍候...');
        pollForResult(data.RequestId);
    } catch (error) {
        alert(`操作失败: ${error.message}`);
        hideLoadingOverlay();
        if (originalUploadedImageUrl) {
            showEditorView();
            loadOriginalImage(originalUploadedImageUrl);
        }
    }
}

// --- 【中文备注】轮询查询任务结果 ---
async function pollForResult(requestId) {
    try {
        const response = await fetch(`${API_CONFIG.RESULT_API}/${requestId}`);
        if (response.status === 202) {
            setTimeout(() => pollForResult(requestId), API_CONFIG.POLLING_INTERVAL_MS);
        } else if (response.status === 200) {
            const resultData = await response.json();
            if (resultData && resultData.Code === 202) {
                setTimeout(() => pollForResult(requestId), API_CONFIG.POLLING_INTERVAL_MS);
            } else if (resultData && resultData.Code === 200) {
                currentTaskFilename = resultData.filename || 'translated_image.png';
//                showEditorView();
//                await loadFromAPI(resultData);
  // 【核心修改】当获取到新结果时，不再直接调用 loadFromAPI，
                // 而是将结果发送给父窗口，由父窗口统一管理和下发加载指令。
                sendResultToParent(resultData);
                hideLoadingOverlay();
            } else {
                throw new Error(`任务处理失败: ${resultData?.Message || '未知错误'}`);
            }
        } else {
            throw new Error(`服务器错误，状态码: ${response.status}`);
        }
    } catch (error) {
        alert(`获取结果失败: ${error.message}`);
        hideLoadingOverlay();
        if (originalUploadedImageUrl) {
            showEditorView();
            loadOriginalImage(originalUploadedImageUrl);
        }
    }
}

/**
 * 【最终修复版】通用的保存状态函数
 * 核心修复：为“重载”和“API保存”生成两份不同的JSON，确保重载时画布状态完整。
 * @returns {Promise<boolean>}
 */
async function updateAndSaveState() {
    // 【新增】如果正在保存，则阻止新的保存请求
    if (isSaving) {
        showToast('正在保存中，请稍候...', 'error');
        return false;
    }

    console.log('开始更新并保存画布状态...');
    if (!lastResultData || !lastResultData.RequestId) {
        showToast('无法保存，缺少任务上下文信息。', 'error');
        return false;
    }

    isSaving = true; // 加锁
    showLoadingOverlay('正在保存...');

    try {
        // --- 【核心修复】第一步：生成完整的画布状态JSON ---
        // 这个JSON包含了所有对象（图片、文本、sketch画板等），用于确保重加载时能完美恢复。
        const fullCanvasJson = canvas.toJSON(FABRITOR_CUSTOM_PROPS);
        fullCanvasJson[SCHEMA_VERSION_KEY] = SCHEMA_VERSION;
        const fullCanvasJsonString = JSON.stringify(fullCanvasJson);

        console.log("【用于重载】生成的完整画布JSON:", fullCanvasJson);

        // --- 第二步：准备发送给父窗口（用于重载）的数据 ---
        // 使用完整的JSON，这样当父窗口发回加载指令时，所有内容都能正确对齐。
        lastResultData.Data.TemplateJson = fullCanvasJsonString;
        sendResultToParentForSave(lastResultData);

        // --- 第三步：准备发送给后端保存API的数据 ---
        // 根据需求，我们为后端API生成一个只包含文本图层的JSON。

        // 1. 创建一个只包含文本对象的版本
        const textObjects = fullCanvasJson.objects.filter(obj => obj.type === 'f-text');
        const textOnlyCanvasJson = {
            ...fullCanvasJson, // 复制其他属性如版本号、背景色等
            objects: textObjects // 替换为只含文本的数组
        };
        const textOnlyCanvasJsonString = JSON.stringify(textOnlyCanvasJson);

        console.log("【用于API】生成的仅文本图层JSON:", textOnlyCanvasJson);

        // 2. 创建一个用于API请求的独立数据副本，避免互相干扰
        const apiPayload = JSON.parse(JSON.stringify(lastResultData)); // 深拷贝
        apiPayload.Data.TemplateJson = textOnlyCanvasJsonString; // 替换为仅文本的JSON

        // --- 第四步：调用保存API ---
        const response = await fetch(API_CONFIG.SAVE_API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(apiPayload) // 发送仅包含文本图层的版本
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(`保存失败: ${errorData.Message || errorData.error || response.statusText}`);
        }

        const saveDataResponse = await response.json();
        if (saveDataResponse.Code !== 200) {
            throw new Error(`保存时发生错误: ${saveDataResponse.Message || '未知服务端错误'}`);
        }

        console.log('仅文本图层的状态已成功保存到服务器。', saveDataResponse);
        isDirty = false;
        // showToast('保存成功！', 'success'); // loading覆盖层会自动隐藏，此提示可选
        return true;

    } catch (error) {
        console.error('调用保存接口时出错:', error);
        showToast(`保存失败: ${error.message}`, 'error');
        return false;
    } finally {
        isSaving = false; // 解锁
        hideLoadingOverlay();
    }
}

/**
 * 【新增】仅保存当前画布状态的函数
 */
window.saveCanvasState = async function() {
    await updateAndSaveState();
}



// --- 导出图片 ---
/**
 * 【中文备注】导出图片 (已修改，使用动态文件名)
 */
 window.exportImage = async function(){
    if (!inpaintingImage) {
        alert('底图 (inpaintingImage) 未加载，无法导出！');
        return;
    }

    console.log("开始导出自定义合并图片...");

    // ... [函数前半部分的合并逻辑保持不变] ...
    const textObjects = canvas.getObjects().filter(obj => obj.type === 'f-text');
    const objectsToExport = [inpaintingImage, ...textObjects];
    const clones = await new Promise(resolve => {
        fabric.util.enlivenObjects(objectsToExport.map(o => o.toObject()), resolve);
    });
    const tempGroup = new fabric.Group(clones);
    const bBox = tempGroup.getBoundingRect(true);
    tempGroup.destroy();
    if (!bBox.width || !bBox.height) {
        alert('无法计算导出区域，请确保有可见内容。');
        return;
    }
    const multiplier = window.devicePixelRatio || 2;
    const offscreenCanvasEl = document.createElement('canvas');
    const staticCanvas = new fabric.StaticCanvas(offscreenCanvasEl, {
        width: bBox.width,
        height: bBox.height,
        enableRetinaScaling: false
    });
    const finalClones = await new Promise(resolve => {
        fabric.util.enlivenObjects(objectsToExport.map(o => o.toObject()), resolve);
    });
    finalClones.forEach(clone => {
        clone.set({
            left: clone.left - bBox.left,
            top: clone.top - bBox.top
        });
        staticCanvas.add(clone);
    });
    staticCanvas.setDimensions({
        width: bBox.width * multiplier,
        height: bBox.height * multiplier
    });
    staticCanvas.setViewportTransform([multiplier, 0, 0, multiplier, 0, 0]);
    staticCanvas.renderAll();

    const dataURL = staticCanvas.toDataURL({
        format: 'png',
        quality: 1.0
    });

    const link = document.createElement('a');
    link.href = dataURL;

    // --- [核心修改] ---
    // 使用存储的全局变量 originalFilename 作为下载的文件名
    link.download = originalFilename;
    // --- [修改结束] ---

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    staticCanvas.dispose();

    await updateAndSaveState();

    console.log("导出成功！");
}


// --- 【中文备注】加载原始图片到画布 ---
function loadOriginalImage(imageUrl) {
    canvas.clear();
    fabric.Image.fromURL(imageUrl, (img) => {
        img.set({
            id: 'original-image',
            selectable: false,
            evented: false,
        });
        canvas.add(img);
        canvas.centerObject(img);
        img.setCoords();
        canvas.renderAll();
        saveState();
    }, { crossOrigin: 'anonymous' });
}


// --- 【中文备注】为导入模态框添加事件监听器 ---
function setupImportListeners() {
    const tabUpload = document.getElementById('tab-upload');
    const tabUrl = document.getElementById('tab-url');
    const contentUpload = document.getElementById('content-upload');
    const contentUrl = document.getElementById('content-url');
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');

    tabUpload.addEventListener('click', () => {
        tabUpload.classList.add('active');
        tabUrl.classList.remove('active');
        contentUpload.classList.add('active');
        contentUrl.classList.remove('active');
    });
    tabUrl.addEventListener('click', () => {
        tabUrl.classList.add('active');
        tabUpload.classList.remove('active');
        contentUrl.classList.add('active');
        contentUpload.classList.remove('active');
    });

    dropZone.addEventListener('click', () => fileInput.click());
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
    });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        if (e.dataTransfer.files.length) {
            handleFileSubmit(e.dataTransfer.files[0]);
        }
    });

    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length) {
            handleFileSubmit(e.target.files[0]);
        }
    });
}

// --- 【中文备注】初始化编辑器 ---
async function initializeEditor() {
    populateFontSelector();
    setupTextControlListeners();
    setupPanelDragListeners();
    setupImportListeners();
    initializeLanguageOptions();
//    setupKeyboardListeners();
    // 【改造】移除此行，避免页面加载时自动弹出导入窗口
    resizeCanvas();
}

// --- 【中文备注】启动编辑器 ---
// 使用 DOMContentLoaded 确保所有元素都已加载
document.addEventListener('DOMContentLoaded', initializeEditor);