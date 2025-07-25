// --- 初始化 Fabric.js 和控件 ---
// --- 1. 获取容器元素 ---
const canvasContainer = document.getElementById('canvas-container');

// --- 2. 获取容器的实际像素尺寸 ---
const containerWidth = canvasContainer.clientWidth;
const containerHeight = canvasContainer.clientHeight;

// --- 3. 使用获取到的数字尺寸初始化 Fabric.js 画布 ---
const canvas = new fabric.Canvas('canvas', {
    width: containerWidth,      // 【修复】使用数字变量 containerWidth
    height: containerHeight,    // 【修复】使用数字变量 containerHeight
    backgroundColor: '#eaeaea',
    preserveObjectStacking: true,
    imageSmoothingEnabled: false,
    selection: true
});
// 【新增】为画布元素本身添加圆角样式
canvas.getElement().style.borderRadius = '12px';
canvas.getSelectionElement().style.borderRadius = '12px'; // 选中框也应用

// 【改造】获取浮动面板的控件
const textEditorPanel = document.getElementById('text-editor-panel');
const textContentInput = document.getElementById('text-content-input'); // 【新增】获取文本内容输入框
const fontFamilySelect = document.getElementById('font-family-select');
const fontSizeInput = document.getElementById('font-size-input');
const lineHeightInput = document.getElementById('line-height-input');
const fontColorInput = document.getElementById('font-color-input');
const colorPreview = document.getElementById('color-preview');
const boldBtn = document.getElementById('font-bold-btn');
const alignCenterBtn = document.getElementById('align-center-btn');
const loadingOverlay = document.getElementById('loading-overlay');
const loadingText = document.getElementById('loading-text');



// --- 全局变量 ---
let undoStack = [];
let redoStack = [];
let initialState = null; // 【中文备注】新增：用于存储画布的初始状态
let sketch = null;
let isLoading = false;
let isSavingState = false;
let finalImage = null;
let inpaintingImage = null;
let isDragging = false;
let lastPosX = 0;
let lastPosY = 0;
let finalImageClone = null;
let transparentRect = null;
let restoreGroup = null;
let originalFilename = 'edited_image.png'; // 【新增】用于存储源图片的文件名，并设置一个默认值
let lastResultData = null; // 【新增】缓存最后一个有效的 resultData

// 【新增 Bug 1】文本编辑面板拖拽状态
let isDraggingPanel = false;
let panelStartX = 0;
let panelStartY = 0;
let panelLeft = 0;
let panelTop = 0;
/**
 * 全局变量：缓存上一次选中的 f-text 对象
 */
let lastActiveText = null;

// --- 【中文备注】显示加载覆盖层 ---
function showLoadingOverlayPic(text) {
    loadingText.textContent = text;
    loadingOverlay.style.display = 'flex';
}

// --- 【中文备注】隐藏加载覆盖层 ---
function hideLoadingOverlayPic() {
    loadingOverlay.style.display = 'none';
}
async function loadFromAPI(apiResponse) {
    canvas.clear();
    showLoadingOverlayPic('正在加载图片...');

    lastResultData = apiResponse ;

    const { InPaintingUrl, SourceUrl, TemplateJson } = apiResponse.Data || {};
    originalInpaintingUrl = InPaintingUrl;

    const promises = [];

    if (SourceUrl) {

         // 从 SourceUrl 中解析文件名并存储到全局变量
        try {
            // 1. 从 URL 中获取最后一部分 (e.g., "image.jpg?query=123")
            const filenameWithParams = SourceUrl.substring(SourceUrl.lastIndexOf('/') + 1);
            // 2. 去除 URL 参数 (e.g., "image.jpg")
            const cleanFilename = filenameWithParams.split('?')[0];

            if (cleanFilename) {
                originalFilename = cleanFilename;
                console.log(`[成功] 已将导出文件名设置为源文件名: ${originalFilename}`);
            }
        } catch (e) {
            console.error('解析源文件名失败，将使用默认文件名。', e);
            originalFilename = 'edited_image.png'; // 解析失败时的备用方案
        }

        promises.push(new Promise(resolve => {
            fabric.Image.fromURL(SourceUrl, (img) => {
                finalImage = img;
                img.set({
                    crossOrigin: 'anonymous',
                    id: 'final-image',
                    selectable: false,
                    evented: false
                });
                canvas.add(finalImage);
                resolve();
            }, { crossOrigin: 'anonymous' });
        }));
    }

    if (InPaintingUrl) {
        promises.push(new Promise(resolve => {
            fabric.Image.fromURL(InPaintingUrl, (img) => {
                inpaintingImage = img;
                img.set({
                    crossOrigin: 'anonymous',
                    id: 'inpainting-image',
                    selectable: false,
                    evented: false
                });
                canvas.add(inpaintingImage);
                resolve();
            }, { crossOrigin: 'anonymous' });
        }));
    }

    await Promise.all(promises);

    if (finalImage) {
        canvas.sendToBack(finalImage);
    }
    if (inpaintingImage) {
        canvas.bringToFront(inpaintingImage);
    }

    if (TemplateJson && TemplateJson !== '{ .}') {
        await loadFromJSON(TemplateJson, true);
        saveOriginalTextLayers();
    } else {
        saveState();
    }
    hideLoadingOverlayPic();
}

/**
 * 【修复】动态填充字体选择器
 * 使用字体的 CSS value 作为 option 的 value，这是统一标识的关键。
 */
function populateFontSelector() {
    fontFamilySelect.innerHTML = '';
    FONT_LIST.forEach(font => {
        const option = document.createElement('option');
        option.value = font.value; // ✅ 使用 CSS 值作为 value
        option.textContent = font.name;
        fontFamilySelect.appendChild(option);
    });
}


// --- 字体配置 ---
 const FONT_URL_MAP = {
 };

const FONT_LIST = [
  { name: '默认字体', value: 'Arial, sans-serif' },
  { name: '思源黑体', value: 'Noto Sans SC, sans-serif' },
  { name: '思源宋体', value: 'Noto Serif SC, serif' },
  { name: '阿里普惠体', value: 'alibaba-puhuiti, sans-serif' },
  { name: 'AdventProBold', value: 'Advent Pro, sans-serif' },
  // 系统字体（免费可商用，不嵌入）
  { name: 'Segoe UI', value: 'Segoe UI, sans-serif', file: null },
  { name: 'Calibri', value: 'Calibri, sans-serif', file: null },
  { name: 'Cambria', value: 'Cambria, serif', file: null },
  { name: 'Lucida Console', value: 'Lucida Console, monospace', file: null },
  { name: 'Menlo', value: 'Menlo, monospace', file: null },
  { name: 'SF Pro', value: '-apple-system, BlinkMacSystemFont, sans-serif', file: null },
  { name: 'Times New Roman', value: 'Times New Roman, serif', file: null },
  { name: 'Georgia', value: 'Georgia, serif', file: null },
  { name: 'Verdana', value: 'Verdana, sans-serif', file: null },
  { name: 'Tahoma', value: 'Tahoma, sans-serif', file: null },
  { name: 'Trebuchet MS', value: 'Trebuchet MS, sans-serif', file: null },
  { name: 'Courier New', value: 'Courier New, monospace', file: null }
];



// --- 自定义类 ---
function createCustomClass() {
    fabric.FImage = fabric.util.createClass(fabric.Group, {
        type: 'f-image',
        initialize: function(objects, options) {
            options = options || {};
            this.callSuper('initialize', objects, options);
            this.set({
                id: options.id || '',
                imageBorder: options.imageBorder || {},
                selectable: options.selectable !== false,
                hasControls: options.hasControls !== false,
                evented: options.evented !== false
            });
        },
        toObject: function() {
            return fabric.util.object.extend(this.callSuper('toObject'), {
                id: this.id,
                imageBorder: this.imageBorder
            });
        }
    });
    fabric.FImage.fromObject = function(object, callback) {
        fabric.util.enlivenObjects(object.objects, function(enlivenedObjects) {
            const options = fabric.util.object.clone(object);
            delete options.objects;
            callback && callback(new fabric.FImage(enlivenedObjects, options));
        });
    };


// --- 【改造】自定义类 FText ---
    fabric.FText = fabric.util.createClass(fabric.Textbox, {
        type: 'f-text',
        initialize: function(text, options) {
            options = options || {};
            this.callSuper('initialize', text, options);
            this.set({
                id: options.id || fabric.util.getRandomInt(1, 10000).toString(),
                fontFamily: options.fontFamily || 'Noto Sans SC, sans-serif',
                lineHeight: options.lineHeight || 1.3,
                splitByGrapheme: true,
                // 【中文备注】核心修改：彻底禁止在画布上直接编辑
                editable: false,
                // 【中文备注】以下为样式优化
                borderColor: 'rgba(66, 153, 225, 0.7)',
                borderDashArray: [5, 5],
                cornerColor: 'white',
                cornerStrokeColor: 'rgba(66, 153, 225, 1)',
                cornerStyle: 'circle',
                borderScaleFactor: 2.5,
                transparentCorners: false,
                cornerSize: 14,
                padding: 10
            });
        },
        toObject: function() {
            return fabric.util.object.extend(this.callSuper('toObject'), {
                id: this.id,
                pathAlign: this.pathAlign,
                minWidth: this.minWidth,
                splitByGrapheme: this.splitByGrapheme,
                editable: this.editable // 确保 editable 状态被保存
            });
        }
    });

    fabric.FText.fromObject = function(object, callback) {
        const options = fabric.util.object.clone(object);
        options.selectable = true;
        options.hasControls = true;
        options.evented = true;
        callback && callback(new fabric.FText(object.text, options));
    };
}
createCustomClass();

// 在 createCustomClass() 函数之后，或任何初始化代码之前添加以下代码

// 【修改】使用更简洁的、直接生成的 SVG 图标，这是一个红色的 'X'
const deleteIconSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
  <line x1="18" y1="6" x2="6" y2="18"></line>
  <line x1="6" y1="6" x2="18" y2="18"></line>
</svg>
`;
const deleteIcon = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(deleteIconSvg);
const img = document.createElement('img');
img.src = deleteIcon;


// 定义删除动作的函数 (保持不变)
function deleteObject(eventData, transform) {
    const target = transform.target;
    const canvas = target.canvas;
    canvas.remove(target);
    canvas.requestRenderAll();
    saveState(); // 删除后保存状态
    return true;
}

// 【修改】渲染删除图标的函数
function renderDeleteIcon(ctx, left, top, styleOverride, fabricObject) {
    const size = this.cornerSize;
    ctx.save();
    ctx.translate(left, top);
    ctx.rotate(fabric.util.degreesToRadians(fabricObject.angle));

    // 【修改】绘制浅蓝色圆形背景
    ctx.fillStyle = '#3b82f6'; // 浅蓝色背景
    ctx.beginPath();
    ctx.arc(0, 0, size / 2, 0, 2 * Math.PI);
    ctx.fill();

    // 【修改】在背景上绘制红色的 'X' 图标
    // 为了让 'X' 更清晰，我们给它一个小的内边距
    const padding = size * 0.2;
    ctx.drawImage(img, -size/2 + padding/2, -size/2 + padding/2, size - padding, size - padding);

    ctx.restore();
}

// 克隆并修改 fabric.Textbox (我们自定义的 FText 基于它) 的控件
fabric.Textbox.prototype.controls.deleteControl = new fabric.Control({
    x: 0.5,      // 右上角 X
    y: -0.5,     // 右上角 Y
    offsetX: 12, // 【修改】向右偏移量减小
    offsetY: -12,// 【修改】向上偏移量减小
    cursorStyle: 'pointer',
    mouseUpHandler: deleteObject,
    render: renderDeleteIcon,
    cornerSize: 20 // 【修改】整体尺寸变小
});

// 如果你只想给 FText 添加这个控件，可以这样做：
fabric.FText.prototype.controls.deleteControl = fabric.Textbox.prototype.controls.deleteControl;

/**
 * 【中文备注】新增：显示一个漂亮的自定义确认弹窗
 * @param {string} message - 要在弹窗中显示的消息文本。
 * @returns {Promise<boolean>} - 用户点击确认返回 true，点击取消返回 false。
 */
function showCustomConfirm(message) {
    return new Promise(resolve => {
        // 1. 创建弹窗的 HTML 结构
        const overlay = document.createElement('div');
        overlay.className = 'custom-confirm-overlay';

        const modal = document.createElement('div');
        modal.className = 'custom-confirm-modal';

        const msgElement = document.createElement('p');
        msgElement.textContent = message;

        const btnContainer = document.createElement('div');
        btnContainer.className = 'custom-confirm-buttons';

        const okBtn = document.createElement('button');
        okBtn.textContent = '确认重置';
        okBtn.className = 'confirm-btn-ok';

        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = '取消';
        cancelBtn.className = 'confirm-btn-cancel';

        // 2. 组装元素
        btnContainer.appendChild(cancelBtn);
        btnContainer.appendChild(okBtn);
        modal.appendChild(msgElement);
        modal.appendChild(btnContainer);
        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        // 3. 定义清理函数
        const cleanup = () => {
            overlay.classList.remove('visible');
            setTimeout(() => {
                document.body.removeChild(overlay);
            }, 200); // 等待动画结束再移除
        };

        // 4. 绑定事件
        okBtn.onclick = () => {
            cleanup();
            resolve(true);
        };

        cancelBtn.onclick = () => {
            cleanup();
            resolve(false);
        };

        // 5. 显示弹窗（带动画）
        setTimeout(() => {
            overlay.classList.add('visible');
        }, 10); // 延迟一小段时间以触发CSS过渡
    });
}

/**
 * 【中文备注】全部重置函数 (修改为使用自定义弹窗)
 * 点击后将显示美化的确认框，确认后刷新页面。
 */
async function resetAll() {
    const userConfirmed = await showCustomConfirm(
        '您确定要重置所有内容吗？此操作将重新加载页面，所有未保存的修改都将丢失。'
    );

    if (userConfirmed) {
        if (lastResultData) {
	          // 1) 移除所有绘制对象
			  canvas.clear();
			  // 2) 如果还设置过背景或叠加图层，建议一起置空
			  canvas.setBackgroundImage(null);
			  canvas.setOverlayImage(null);
			  // 3) 为保险起见重新渲染
			  canvas.renderAll();
              await loadFromAPI(lastResultData);
        } else {
            // 如果没有缓存的 resultData，刷新页面
            window.location.reload();
        }
    }
    // 如果 userConfirmed 为 false，则不执行任何操作。
}

/**
 * 【中文备注】全部重置函数 (修改为使用自定义弹窗)
 * 点击后将显示美化的确认框，确认后刷新页面。
 */
async function resetWithNotQueRen() {
    if (lastResultData) {
          // 1) 移除所有绘制对象
		  canvas.clear();
		  // 2) 如果还设置过背景或叠加图层，建议一起置空
		  canvas.setBackgroundImage(null);
		  canvas.setOverlayImage(null);
		  // 3) 为保险起见重新渲染
		  canvas.renderAll();
          await loadFromAPI(lastResultData);
    } else {
        // 如果没有缓存的 resultData，刷新页面
        window.location.reload();
    }
}

// --- 【改造】保存状态 ---
function saveState() {
    if (isLoading || isSavingState) return;
    isSavingState = true;
    const currentState = JSON.stringify(canvas.toJSON(['id', 'fabritor_desc', 'imageBorder', 'pathAlign', 'minWidth', 'splitByGrapheme']));

    // 【中文备注】如果是第一次保存，则记录为初始状态
    if (initialState === null) {
        initialState = currentState;
    }

    if (undoStack.length === 0 || undoStack[undoStack.length - 1] !== currentState) {
        undoStack.push(currentState);
        redoStack = []; // 任何新的修改都会清空重做栈
    }
    isSavingState = false;
}

// --- 【核心改造】修复撤销/重做功能 ---
function handleUndoRedo(state) {
    isLoading = true;

    // 【中文备注】核心修复：与 resetAll 函数同理，为从历史记录中取出的状态手动添加版本号
    try {
        const stateObject = JSON.parse(state);
        stateObject.fabritor_schema_version = 3; // 添加版本号

        // 使用修复后的 stateObject 加载
        loadFromJSON(stateObject, false).finally(() => {
            isLoading = false;
            canvas.discardActiveObject();
            transparentRect = canvas.getObjects().find(obj => obj.id === 'transparent-rect');
            if (transparentRect) {
                // 如果历史状态中有恢复框，需要重新应用效果（此部分逻辑根据您的需求可能需要调整）
                // 通常撤销/重做不应包含局部恢复的中间状态，但此处保留以防万一
                // applyVisualEffects();
            } else {
                 if (inpaintingImage) {
                    inpaintingImage.clipPath = null;
                 }
                 if(finalImage) {
                    finalImage.clipPath = null;
                 }
            }
            canvas.renderAll();
        });
    } catch (e) {
        console.error("解析历史状态JSON时失败:", e);
        alert("执行撤销/重做失败！");
        isLoading = false;
    }
}

function undo() {
    if (undoStack.length > 1) {
        const lastState = undoStack.pop();
        redoStack.push(lastState);
        handleUndoRedo(undoStack[undoStack.length - 1]);
    }
}

function redo() {
    if (redoStack.length > 0) {
        const state = redoStack.pop();
        undoStack.push(state);
        handleUndoRedo(state);
    }
}

// --- 添加文本 ---
function addText() {
    const text = new fabric.FText('请输入文本', {
        left: canvas.getCenter().left,
        top: canvas.getCenter().top,
        originX: 'center',
        originY: 'center',
        width: 200,
        fontSize: 16,
        fontFamily: 'Noto Sans SC, sans-serif',
        fill: '#000000',
        // 【改造】禁止在画布上直接编辑文本
        editable: false,
        selectable: true,
        hasControls: true,
        evented: true
    });
    canvas.add(text);
    canvas.setActiveObject(text);
    // 【改造】移除 enterEditing 和 selectAll，因为编辑将在面板中进行
    updateAndShowTextPanel(text);
    canvas.renderAll();
    saveState();
}

/**
 * 【中文备注】新增：用于缓存字体加载 Promise 的 Map，防止重复请求
 */
const fontLoadingPromises = new Map();
/**
 * 【改进】异步加载字体
 * @param {string} fontFamilyValue - 要加载的字体的 CSS `fontFamily` 值
 * @returns {Promise<void>}
 */
async function loadFont(fontFamilyValue) {
    const fontConfig = FONT_LIST.find(f => f.value === fontFamilyValue);

    if (!fontConfig || !fontConfig.url) {
        return Promise.resolve();
    }

    if (fontLoadingPromises.has(fontFamilyValue)) {
        return fontLoadingPromises.get(fontFamilyValue);
    }

    const fontFaceName = fontFamilyValue;
    const loadingPromise = new Promise(async (resolve, reject) => {
        const fontFace = new FontFace(fontFaceName, `url(${fontConfig.url})`);
        try {
            console.log(`%c正在加载字体: ${fontConfig.name}...`, 'color: blue');
            const loadedFont = await fontFace.load();
            document.fonts.add(loadedFont);
            console.log(`%c字体 "${fontConfig.name}" 加载成功!`, 'color: green');
            resolve();
        } catch (error) {
            console.error(`加载字体 "${fontConfig.name}" 失败:`, error);
            reject(error);
        }
    });

    fontLoadingPromises.set(fontFamilyValue, loadingPromise);
    return loadingPromise;
}

// --- 检查对象数组中是否包含除画板外的矩形 ---
function hasRect(objects) {
    return objects.some(item => item.type === 'rect' && item.id !== 'pictech');
}

// --- 检查ID是否为新的Debug格式 ---
function debugIsNew(id) {
    return id.includes('***');
}

// --- 从ID解析位置和尺寸 ---
function debugTopHeight(id) {
    const [part1] = id.split('***');
    const keyValuePairs = part1.split('_');
    const map = new Map();
    keyValuePairs.forEach(pair => {
        const [key, value] = pair.match(/([a-z])(\d)/i).slice(1);
        map.set(key, parseInt(value, 10));
    });
    return map;
}

// --- 调整画布以适应画板和图片 ---
function adjustCanvasToSketch() {
    if (!sketch) return;
    const canvasSize = { width: canvas.width, height: canvas.height };
    const sketchSize = { width: sketch.getScaledWidth(), height: sketch.getScaledHeight() };

    const zoomLevel = Math.min(
        canvasSize.width / sketchSize.width,
        canvasSize.height / sketchSize.height
    ) * 0.95;

    canvas.zoomToPoint(new fabric.Point(canvas.getCenter().left, canvas.getCenter().top), zoomLevel);

    const sketchCenter = sketch.getCenterPoint();
    const viewportTransform = canvas.viewportTransform;
    viewportTransform[4] = canvas.width / 2 - sketchCenter.x * viewportTransform[0];
    viewportTransform[5] = canvas.height / 2 - sketchCenter.y * viewportTransform[3];
    canvas.setViewportTransform(viewportTransform);

    if (finalImage) {
        finalImage.set({
            left: sketch.left,
            top: sketch.top,
            scaleX: sketch.scaleX,
            scaleY: sketch.scaleY
        });
    }
    if (inpaintingImage) {
        inpaintingImage.set({
            left: sketch.left,
            top: sketch.top,
            scaleX: sketch.scaleX,
            scaleY: sketch.scaleY
        });
    }
    if (finalImageClone) {
        finalImageClone.set({
            left: sketch.left,
            top: sketch.top,
            scaleX: sketch.scaleX,
            scaleY: sketch.scaleY
        });
    }
    canvas.renderAll();
}

let originalTextLayersData = [];

async function loadFromJSON(json, addHistory = true) {
    if (!json) return false;
    let parsedJson = json;
    if (typeof json === 'string') {
        try {
            parsedJson = JSON.parse(json);
        } catch (e) {
            console.error('JSON解析失败:', e);
            alert('加载模板失败，请检查JSON格式！');
            return false;
        }
    }

    const SCHEMA_VERSION = 3;
    if (parsedJson.fabritor_schema_version !== SCHEMA_VERSION) {
        alert('模板版本不兼容，请更换模板！');
        return false;
    }

    isLoading = true;

    try {
        const objects = parsedJson.objects || [];

        // 步骤 4: 所有字体加载完毕后，安全地加载 Fabric 画布
        // 注意：现在我们不再需要在循环中 await loadFont
        objects.forEach(item => {
             if (item.type === 'f-text') {
                item.selectable = true;
                item.hasControls = true;
                item.evented = true;
                item.fontFamily = 'Noto Sans SC, sans-seri';
            }
        });

        const currentObjects = canvas.getObjects().filter(obj => obj.type !== 'f-text');

        return new Promise((resolve) => {
            canvas.loadFromJSON(parsedJson, () => {
                const allObjects = canvas.getObjects();
                const textObjects = allObjects.filter(obj => obj.type === 'f-text');

                canvas.clear();

                currentObjects.forEach(obj => {
                    canvas.add(obj);
                });

                const finalImg = canvas.getObjects().find(obj => obj.id === 'final-image');
                const inpaintingImg = canvas.getObjects().find(obj => obj.id === 'inpainting-image');

                if (finalImg) canvas.sendToBack(finalImg);
                if (inpaintingImg) canvas.bringToFront(inpaintingImg);

                textObjects.forEach(textObj => canvas.add(textObj));

                const sketchObj = allObjects.find(obj => obj.id === 'pictech');
                if (sketchObj) {
                    canvas.add(sketchObj);
                    canvas.sendToBack(sketchObj);
                    sketch = sketchObj;
                    sketch.set({ selectable: false, hasControls: false, evented: false });
//                    sketch.clone((cloned) => {
//                        canvas.clipPath = cloned;
//                        canvas.requestRenderAll(); // 使用 requestRenderAll 性能更好
//                    });
                    adjustCanvasToSketch();
                }

                canvas.requestRenderAll(); // 最终重绘一次

                if (addHistory) {
                    undoStack = [];
                    redoStack = [];
                    saveState();
                }

                resolve(true);
            }, (o, obj) => {
                if (obj.id === 'pictech') {
                    sketch = obj;
                }
            });
        });
    } catch (error) {
        console.error("加载模板时发生严重错误:", error);
        alert('加载模板时发生严重错误！');
        return false;
    } finally {
        isLoading = false;
    }
}




function saveOriginalTextLayers() {
    originalTextLayersData = [];
    const textObjects = canvas.getObjects().filter(obj => obj.type === 'f-text');

    textObjects.forEach(textObj => {
        originalTextLayersData.push({
            id: textObj.id,
            text: textObj.text,
            originalText: textObj.text,
            fontFamily: textObj.fontFamily,
            fontSize: textObj.fontSize,
            fill: textObj.fill,
            left: textObj.left,
            top: textObj.top,
            width: textObj.width,
            height: textObj.height,
            angle: textObj.angle,
            scaleX: textObj.scaleX,
            scaleY: textObj.scaleY,
            originX: textObj.originX,
            originY: textObj.originY,
            ...textObj.toObject()
        });
    });
}
/**
 * 【中文备注】局部恢复工具的全局配置
 */
const RESTORE_TOOL_CONFIG = {
    // --- 初始尺寸 ---
    INITIAL_WIDTH: 200, // 恢复框初始宽度
    INITIAL_HEIGHT: 50,  // 恢复框初始高度

    // --- 最小尺寸限制 ---
    MIN_WIDTH: 60,       // 恢复框最小宽度
    MIN_HEIGHT: 24,       // 【需求】恢复框最小高度，可设为5

    // --- 按钮相关 ---
    BUTTON_HEIGHT: 16,     // 按钮的目标高度
    // 【核心】决定按钮是在内部还是外部的临界高度
    // 按钮高度(16) + 上下内边距(例如 4+4=8) = 24
    MIN_HEIGHT_FOR_INTERNAL_BUTTONS: 24,
};
let confirmBtn = null;
let cancelBtn = null;
let masterClipRect = null;

 async function addTransparentRect() {
    console.log("--- [开始] addTransparentRect: 创建局部恢复工具 (高性能版) ---");

    if (!inpaintingImage || !finalImage) {
        showCustomAlert('图片未完全加载，无法使用局部恢复功能！');
        console.error("错误: 关键图层 finalImage 或 inpaintingImage 未加载。");
        return;
    }

    if (restoreGroup) {
        console.log("检测到已存在的恢复工具，正在清理...");
        cancelRestore(false);
    }

    const confirmSvg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M20.285 2l-11.285 11.567-5.286-5.011-3.714 3.716 9 8.728 15-15.285z"/></svg>';
    const cancelSvg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M24 20.188l-8.315-8.209 8.2-8.282-3.697-3.697-8.212 8.318-8.31-8.203-3.666 3.666 8.321 8.24-8.206 8.313 3.666 3.666 8.237-8.318 8.285 8.203z"/></svg>';

   // 【修改】使用全局常量设置初始尺寸
    transparentRect = new fabric.Rect({
        width: RESTORE_TOOL_CONFIG.INITIAL_WIDTH,
        height: RESTORE_TOOL_CONFIG.INITIAL_HEIGHT,
        fill: 'rgba(0,0,0,0)',
        strokeWidth: 0,
        originX: 'center',
        originY: 'center',
        left: 0,
        top: 0,
    });

    [confirmBtn, cancelBtn] = await Promise.all([
        createIconButton(confirmSvg, '#10b981', 'confirm-btn'),
        createIconButton(cancelSvg, '#ef4444', 'cancel-btn')
    ]);

    restoreGroup = new fabric.Group([transparentRect, confirmBtn, cancelBtn], {
        left: canvas.getCenter().left, top: canvas.getCenter().top, originX: 'center', originY: 'center',
        subTargetCheck: true, hasControls: true, lockScalingFlip: true,
        transparentCorners: false, cornerStyle: 'circle', cornerColor: 'rgba(0,0,255,0.5)',
        cornerSize: 12, borderColor: 'red', borderDashArray: [5, 5],
        borderScaleFactor: 2,
        // 【移除】不再在此处设置 minScaleLimit，将由事件处理器动态控制
    });

    canvas.add(restoreGroup);
    canvas.setActiveObject(restoreGroup);
    canvas.bringToFront(restoreGroup);

    masterClipRect = _createAbsoluteClipRect();

    positionButtons();
    bindGroupEvents();
    bindButtonEvents();
    applyVisualEffects();

    canvas.renderAll();
    console.log("--- [结束] addTransparentRect: 初始化完成 ---");
}
// 请用下面的版本替换您现有的 positionButtons 函数

/**
 * 【中文备注】定位按钮 (最终智能版 - 内外动态定位 & 间距自适应)
 */
function positionButtons() {
    if (!restoreGroup || !transparentRect || !confirmBtn || !cancelBtn) return;

    const groupScaleX = restoreGroup.scaleX || 1;
    const groupScaleY = restoreGroup.scaleY || 1;

    // --- 1. 按钮缩放逻辑 (保持不变) ---
    // (这部分逻辑是正确的，无需改动)
    const initialButtonScale = 1.0;
    const minButtonScale = 0.8;
    let targetButtonScreenScaleX = initialButtonScale;
    let targetButtonScreenScaleY = initialButtonScale;
    if (groupScaleX < 1) { targetButtonScreenScaleX = Math.max(groupScaleX, minButtonScale); }
    if (groupScaleY < 1) { targetButtonScreenScaleY = Math.max(groupScaleY, minButtonScale); }


    // --- 2. 按钮垂直定位 (Y轴, 保持不变) ---
    // (这部分内外判断的逻辑也是正确的，无需改动)
    const currentHeight = restoreGroup.getScaledHeight();
    let btnY;
    if (currentHeight >= RESTORE_TOOL_CONFIG.MIN_HEIGHT_FOR_INTERNAL_BUTTONS) {
        const offsetYFromBottomEdge_Inside = 4;
        btnY = (transparentRect.height / 2) - (RESTORE_TOOL_CONFIG.BUTTON_HEIGHT / 2 / groupScaleY) - (offsetYFromBottomEdge_Inside / groupScaleY);
    } else {
        const offsetYFromBottomEdge_Outside = 18;
        btnY = (transparentRect.height / 2) + (offsetYFromBottomEdge_Outside / groupScaleY);
    }

    // --- 3. 【核心修改】按钮水平定位 (X轴, 实现自适应间距) ---
    // 将恢复框的宽度分成4份
    const quarterWidth = transparentRect.width / 4;
    // 取消按钮位于左侧 1/4 处，确认按钮位于右侧 1/4 处 (相对于中心点)
    const cancelBtnX = -quarterWidth;
    const confirmBtnX = quarterWidth;


    // --- 4. 应用变换 ---
    // 【注意】这里我们直接使用计算出的新坐标
    cancelBtn.set({ // 左边的取消按钮
        left: cancelBtnX,
        top: btnY,
        scaleX: targetButtonScreenScaleX / groupScaleX,
        scaleY: targetButtonScreenScaleY / groupScaleY,
    });
    confirmBtn.set({ // 右边的确认按钮
        left: confirmBtnX,
        top: btnY,
        scaleX: targetButtonScreenScaleX / groupScaleX,
        scaleY: targetButtonScreenScaleY / groupScaleY,
    });
    // 【关键修改】分离两个更新操作，避免相互干扰
    // 1. 先更新按钮坐标，确保点击事件有效
    confirmBtn.setCoords();
    cancelBtn.setCoords();

	  // 新代码 ↓
	restoreGroup.setCoords(); // ✅ 轻量级刷新包围盒
	canvas.requestRenderAll();
}


/**
 * 【中文备注】防抖函数 (通用工具)
 * @param {Function} func - 需要进行防抖处理的函数。
 * @param {number} delay - 延迟时间，单位毫秒。
 * @returns {Function} - 返回一个包装后的新函数，该函数具有防抖功能。
 */
function debounce(func, delay) {
    let timeoutId; // 用于存储 setTimeout 的 ID

    return function(...args) {
        // 保存 this 上下文和参数
        const context = this;

        // 如果已经设置了定时器，就清除它，重新计时
        clearTimeout(timeoutId);

        // 设置一个新的定时器
        timeoutId = setTimeout(() => {
            // 时间到了，执行原始函数
            func.apply(context, args);
        }, delay);
    };
}


/**
 * 【中文备注】绑定组事件 (最终稳定版)
 * 核心修改：
 * 1. 【修复消失BUG】采用稳定的事件流，只更新独立的 masterClipRect，绝不修改 Group 内部子元素尺寸，
 *    从而彻底解决工具在交互中意外消失或渲染错乱的问题。
 * 2. 【使用常量】所有尺寸限制均来自全局配置对象，方便维护。
 */
function bindGroupEvents() {
    // 定义一个统一、正确的更新函数
    const updateAll = (e) => {
        // --- 尺寸限制逻辑 ---
        if (e && e.transform && e.transform.action.includes('scale')) {
            if (restoreGroup.getScaledWidth() < RESTORE_TOOL_CONFIG.MIN_WIDTH) {
                restoreGroup.scaleX = RESTORE_TOOL_CONFIG.MIN_WIDTH / transparentRect.width;
            }
            if (restoreGroup.getScaledHeight() < RESTORE_TOOL_CONFIG.MIN_HEIGHT) {
                restoreGroup.scaleY = RESTORE_TOOL_CONFIG.MIN_HEIGHT / transparentRect.height;
            }
        }
        // --- 稳定且正确的实时更新流程 ---
        positionButtons();          // 动态定位按钮
        updateMasterClipRectSize(); // 只调用此函数同步黄线
        applyVisualEffects();       // 应用裁剪
    };

    restoreGroup.on('moving', updateAll);
    restoreGroup.on('scaling', updateAll);
    restoreGroup.on('rotating', updateAll);

    restoreGroup.on('modified', () => {
        console.log("恢复组被修改 (操作结束)");
    });
}
function updateMasterClipRectSize() {
    if (!restoreGroup || !masterClipRect) return;

    // 计算红线框（`restoreGroup`）在屏幕上的绝对尺寸
    const actualWidth = transparentRect.width * restoreGroup.scaleX;
    const actualHeight = transparentRect.height * restoreGroup.scaleY;

    // 将这些绝对尺寸和变换应用到独立的 masterClipRect (黄线) 上
    masterClipRect.set({
        left: restoreGroup.left,
        top: restoreGroup.top,
        width: actualWidth,    // 直接设置计算出的宽度
        height: actualHeight,  // 直接设置计算出的高度
        angle: restoreGroup.angle,
        scaleX: 1, // 确保其缩放为1，因为尺寸已是绝对值
        scaleY: 1,
    });
}
function bindButtonEvents() {
    // 【需求 2】为确认操作添加防抖处理，延迟300毫秒
    // 这样即使用户快速、重复点击确认按钮，也只会在停止点击300ms后执行一次。
    const debouncedConfirmRestore = debounce(confirmRestore, 300);

    confirmBtn.on('mousedown', (e) => {
        e.e.preventDefault();
        e.e.stopPropagation();
        console.log("%c✓ 确认按钮被点击", "color: green; font-weight: bold;");
        debouncedConfirmRestore(); // 调用防抖包装后的函数
    });

    cancelBtn.on('mousedown', (e) => {
        e.e.preventDefault();
        e.e.stopPropagation();
        console.log("%c× 取消按钮被点击", "color: red; font-weight: bold;");
        cancelRestore();
    });
}


function updateMasterClipPath() {
    if (!restoreGroup || !masterClipRect) return;
    masterClipRect.set({
        left: restoreGroup.left,
        top: restoreGroup.top,
        scaleX: restoreGroup.scaleX,
        scaleY: restoreGroup.scaleY,
        angle: restoreGroup.angle,
    });
}

function applyVisualEffects() {
    if (!masterClipRect) return;

    applyImageClipping(masterClipRect);
    applyTextMask(masterClipRect);

    canvas.bringToFront(restoreGroup);
    canvas.requestRenderAll();
}

/**
 * 【中文备注】创建绝对定位的裁剪矩形 (修复缩放问题)
 * 关键修改：使用实际的缩放后尺寸，而不是原始尺寸
 */
function _createAbsoluteClipRect() {
    if (!restoreGroup || !transparentRect) return null;

    // 【关键修改】计算透明矩形的实际尺寸（原始尺寸 × 组缩放比例）
    const actualWidth = transparentRect.width * restoreGroup.scaleX;
    const actualHeight = transparentRect.height * restoreGroup.scaleY;

    // 【关键】返回一个与 restoreGroup 变换完全一致的矩形，用于裁剪
    // 使用实际缩放后的尺寸，不再应用 scaleX/scaleY
    return new fabric.Rect({
        left: restoreGroup.left,
        top: restoreGroup.top,
        width: actualWidth,      // 【修改】使用实际缩放后的尺寸
        height: actualHeight,    // 【修改】使用实际缩放后的尺寸
        scaleX: 1,              // 【修改】由于已经使用了实际尺寸，缩放设为1
        scaleY: 1,              // 【修改】由于已经使用了实际尺寸，缩放设为1
        angle: restoreGroup.angle,
        originX: 'center',
        originY: 'center',
        absolutePositioned: true,
    });
}

/**
 * 【中文备注】应用文字遮罩 (修复缩放同步问题)
 * 关键修改：确保遮罩矩形的尺寸与裁剪矩形完全一致
 */
function applyTextMask(clipRect) {
    // 确保 clipRect 的坐标是最新的，这对于 intersectsWithObject 至关重要
    clipRect.setCoords();

    const textObjects = canvas.getObjects().filter(obj => {
        // 过滤逻辑保持不变，确保我们只处理普通文本对象
        if (obj.type === 'group') return false;
        if (obj.id && (obj.id.includes('btn') || obj.id.includes('restore-group') || obj.id.includes('transparent-rect'))) return false;
        if (obj.name && (obj.name.includes('btn') || obj.name.includes('restore'))) return false;
        if (obj === finalImage || obj === inpaintingImage) return false;
        return obj.type === 'f-text' || obj.type === 'text' || obj.type === 'i-text';
    });

    textObjects.forEach(textObj => {
        // 使用更精确的 intersectsWithObject 方法替代之前的 getBoundingRect() 手动判断。
        const isIntersecting = textObj.intersectsWithObject(clipRect, true, true);

        if (isIntersecting) {
            // 如果文字与恢复框相交，我们使其不可交互，并应用反向裁剪
            textObj.set({
                selectable: false,
                hasControls: false,
                evented: false
            });

            // 【关键修改】使用与clipRect完全相同的尺寸和变换创建遮罩
            const maskRect = new fabric.Rect({
                left: clipRect.left,
                top: clipRect.top,
                width: clipRect.width,    // 【修改】使用clipRect的宽度
                height: clipRect.height,  // 【修改】使用clipRect的高度
                angle: clipRect.angle,
                scaleX: clipRect.scaleX,  // 【修改】使用clipRect的缩放
                scaleY: clipRect.scaleY,  // 【修改】使用clipRect的缩放
                originX: 'center',
                originY: 'center',
                absolutePositioned: true,
                inverted: true // inverted: true 表示裁剪掉矩形内部的区域
            });
            textObj.clipPath = maskRect;
            textObj.dirty = true;

        } else {
            // 如果文字不再与恢复框相交，则恢复其原始状态
            if (textObj.clipPath) { // 仅在需要时清除，提高性能
                textObj.clipPath = null;
                textObj.set({
                    selectable: true,
                    hasControls: true,
                    evented: true
                });
                textObj.dirty = true;
            }
        }
    });

    canvas.requestRenderAll();
}

/**
 * 【中文备注】更新透明矩形尺寸 (增强版)
 * 新增：同步更新 transparentRect 自身尺寸 和 masterClipRect
 */
function updateTransparentRectSize() {
    if (!restoreGroup || !transparentRect) return;

    // 【核心逻辑】计算组缩放后的尺寸
    const groupScaleX = restoreGroup.scaleX || 1;
    const groupScaleY = restoreGroup.scaleY || 1;

    // 计算缩放后的宽高
    const actualWidth = transparentRect.width * groupScaleX;
    const actualHeight = transparentRect.height * groupScaleY;

    console.log(`透明矩形实际尺寸更新: ${actualWidth}x${actualHeight} (组缩放: ${groupScaleX}, ${groupScaleY})`);

    // ✅【新增关键】更新 transparentRect 尺寸，防止遮罩区域不匹配
    transparentRect.set({
        width: actualWidth,
        height: actualHeight,
        scaleX: 1, // 使用实际尺寸后取消缩放
        scaleY: 1,
    });

    // ✅ 同步更新 masterClipRect
    if (masterClipRect) {
        masterClipRect.set({
            left: restoreGroup.left,
            top: restoreGroup.top,
            width: actualWidth,
            height: actualHeight,
            scaleX: 1,
            scaleY: 1,
            angle: restoreGroup.angle,
        });
    }

    // ✅ 记录当前透明矩形尺寸
    window.currentTransparentRectSize = {
        width: actualWidth,
        height: actualHeight,
        scaleX: groupScaleX,
        scaleY: groupScaleY
    };

    // 需要更新坐标以刷新界面表现
    transparentRect.setCoords();
    if (masterClipRect) masterClipRect.setCoords();
}



function applyImageClipping(clipRect) {
    if (!inpaintingImage || !finalImage) return;
    const finalClipPath = fabric.util.object.clone(clipRect);
    finalClipPath.inverted = false;
    const inpaintingClipPath = fabric.util.object.clone(clipRect);
    inpaintingClipPath.inverted = true;

    finalImage.clipPath = finalClipPath;
    inpaintingImage.clipPath = inpaintingClipPath;

    canvas.bringToFront(finalImage);
    canvas.bringToFront(restoreGroup);

    canvas.renderAll();
}


async function confirmRestore() {
    console.log("%c--- [开始] confirmRestore (消除白痕修复版) ---", "color: #4CAF50; font-weight: bold;");
    if (!restoreGroup) return;

    // ... [函数前半部分，直到 try 块，保持不变] ...
    const clipRect = _createAbsoluteClipRect();
    if (!clipRect) {
        console.error("无法创建裁剪矩形，操作中止。");
        return;
    }
    clipRect.setCoords();

    const allObjects = canvas.getObjects();
    const originalInpaintingImageIndex = allObjects.indexOf(inpaintingImage);
    if (originalInpaintingImageIndex === -1) {
        alert('错误：找不到 inpaintingImage 图层！');
        cancelRestore(false);
        return;
    }

    const upperLayers = allObjects.filter((obj, index) =>
        index > originalInpaintingImageIndex &&
        !obj.name?.includes('restore') &&
        obj !== restoreGroup
    );

    const layersToMergeAndRemove = upperLayers.filter(obj => {
        obj.setCoords();
        if (!obj.visible) return false;
        const isText = obj.type === 'f-text' || obj.type === 'text' || obj.type === 'i-text';
        return isText && obj.intersectsWithObject(clipRect, true, true);
    });

    const originalObjectsState = canvas.toJSON(['id', 'selectable', 'evented', 'clipPath']);

    const originalClipPaths = new Map();
    const allImagesToProcess = [inpaintingImage, finalImage];
    allImagesToProcess.forEach(obj => {
        if (obj.clipPath) {
            originalClipPaths.set(obj, obj.clipPath);
            obj.clipPath = null;
        }
    });

    try {
        // ... [离屏Canvas的创建逻辑保持不变] ...
        const imagesToMeasure = [inpaintingImage, finalImage];
        const imageClones = await new Promise(resolve => {
            fabric.util.enlivenObjects(imagesToMeasure.map(o => o.toJSON()), resolve);
        });
        const measurementGroup = new fabric.Group(imageClones);
        const bBox = measurementGroup.getBoundingRect(true);
        measurementGroup.destroy();
        console.log(`[步骤 2] 计算出合成区域的精确边界 (bBox):`, bBox);

        const multiplier = window.devicePixelRatio || 2;
        const offscreenCanvasElement = document.createElement('canvas');
        offscreenCanvasElement.width = Math.ceil(bBox.width * multiplier);
        offscreenCanvasElement.height = Math.ceil(bBox.height * multiplier);

        const staticCanvas = new fabric.StaticCanvas(offscreenCanvasElement, {
            width: Math.ceil(bBox.width * multiplier),
            height: Math.ceil(bBox.height * multiplier),
            enableRetinaScaling: false,
            // 【可选优化】明确设置背景色可以避免任何透明度问题，但新逻辑下非必需
            // backgroundColor: 'white'
        });
        console.log(`[步骤 3] 创建离屏画布，尺寸: ${staticCanvas.width}x${staticCanvas.height}px, 倍率: ${multiplier}`);


        // --- [核心修改] ---
        // 采用“底图 + 局部覆盖”策略来避免边缘拼接产生的白痕。

        // 1. 将 inpaintingImage (原始图) 作为完整底图，不加任何裁剪
        const inpaintingCloneArr = await new Promise(resolve => fabric.util.enlivenObjects([inpaintingImage.toJSON()], resolve));
        const inpaintingObj = inpaintingCloneArr[0];
        inpaintingObj.left -= bBox.left;
        inpaintingObj.top -= bBox.top;
        // 【关键】不再对底图设置 clipPath
        // const inpaintingClipPath = ...
        // inpaintingObj.clipPath = inpaintingClipPath;
        staticCanvas.add(inpaintingObj);
        console.log(`[步骤 4.1] 已将完整的 inpaintingImage (无裁剪) 作为底图添加到离屏画布`);

        // 2. 将 finalImage (恢复区内容) 裁剪后绘制在底图之上
        const finalCloneArr = await new Promise(resolve => fabric.util.enlivenObjects([finalImage.toJSON()], resolve));
        const finalObj = finalCloneArr[0];
        finalObj.left -= bBox.left;
        finalObj.top -= bBox.top;
        const finalClipPath = new fabric.Rect({ // 这个裁剪是必要的，以限定恢复区域
            left: clipRect.left - bBox.left, top: clipRect.top - bBox.top,
            width: transparentRect.width, height: transparentRect.height,
            scaleX: restoreGroup.scaleX, scaleY: restoreGroup.scaleY,
            angle: restoreGroup.angle, originX: 'center', originY: 'center',
            absolutePositioned: true, inverted: false
        });
        finalObj.clipPath = finalClipPath;
        staticCanvas.add(finalObj);
        console.log(`[步骤 4.2] 已将裁剪后的 finalImage (框内部分) 覆盖到底图之上`);

        // 3. 将需要保留的文字图层（框外部分）裁剪后绘制在最上层
        if (layersToMergeAndRemove.length > 0) {
            const otherLayerClones = await new Promise(resolve => {
                fabric.util.enlivenObjects(layersToMergeAndRemove.map(o => o.toJSON()), resolve);
            });
            otherLayerClones.forEach(clone => {
                clone.left -= bBox.left;
                clone.top -= bBox.top;
                const textClipPath = new fabric.Rect({ // 文字的裁剪逻辑不变
                    left: clipRect.left - bBox.left,
                    top: clipRect.top - bBox.top,
                    width: transparentRect.width,
                    height: transparentRect.height,
                    scaleX: restoreGroup.scaleX,
                    scaleY: restoreGroup.scaleY,
                    angle: restoreGroup.angle,
                    originX: 'center',
                    originY: 'center',
                    absolutePositioned: true,
                    inverted: true
                });
                clone.clipPath = textClipPath;
                staticCanvas.add(clone);
            });
            console.log(`[步骤 4.3] 已将 ${layersToMergeAndRemove.length} 个其他图层（框外文字）添加到离屏画布`);
        }

        // ... [函数后续部分，从生成 DataURL 到替换主画布对象，保持不变] ...
        staticCanvas.setViewportTransform([multiplier, 0, 0, multiplier, 0, 0]);
        staticCanvas.renderAll();

        const mergedImageDataURL = staticCanvas.toDataURL({ format: 'png', quality: 1.0 });

        const mergedImage = await new Promise((resolve, reject) => {
            fabric.Image.fromURL(mergedImageDataURL, (img) => {
                if (img) { resolve(img); }
                else { reject(new Error('无法创建合并图像')); }
            }, { crossOrigin: 'anonymous' });
        });

        mergedImage.set({
            left: bBox.left,
            top: bBox.top,
            originX: 'left',
            originY: 'top',
            id: 'inpainting-image',
            selectable: false,
            evented: false,
            scaleX: 1 / multiplier,
            scaleY: 1 / multiplier
        });

        canvas.renderOnAddRemove = false;

        const objectsToRemove = [inpaintingImage, finalImage, ...layersToMergeAndRemove];
        objectsToRemove.forEach(obj => canvas.remove(obj));

        canvas.insertAt(mergedImage, originalInpaintingImageIndex, false);
        inpaintingImage = mergedImage;

        cancelRestore(false);

        canvas.renderOnAddRemove = true;

        staticCanvas.dispose();
        offscreenCanvasElement.remove();

        canvas.renderAll();
        console.log("%c--- confirmRestore 操作成功结束，白痕问题已修复 ---", "color: #4CAF50; font-weight: bold;");
        undoStack = [];
        redoStack = [];
        saveState(); // 将合并后的新状态作为历史记录的第一个（也是唯一一个）状态
    } catch (error) {
        // ... [错误处理和 finally 块保持不变] ...
        console.error('确认恢复时发生严重错误:', error);
        alert('确认恢复时发生严重错误，操作已回滚！');

        canvas.loadFromJSON(originalObjectsState, () => {
            inpaintingImage = canvas.getObjects().find(o => o.id === 'inpainting-image');
            finalImage = canvas.getObjects().find(o => o.id === 'final-image');
            canvas.renderAll();
        });
    } finally {
        if (originalClipPaths.size > 0) {
            for (const [obj, clipPath] of originalClipPaths.entries()) {
                if (canvas.getObjects().includes(obj)) {
                    obj.clipPath = clipPath;
                }
            }
            if (canvas.renderOnAddRemove) {
                canvas.renderAll();
            }
        }
    }
}

function cancelRestore(doSaveState = true) {
    if (transparentRect) {
        canvas.remove(transparentRect);
        transparentRect = null;
    }
    console.log("--- [开始] cancelRestore: 撤销操作 ---");
    if (restoreGroup) {
        canvas.remove(restoreGroup);
        restoreGroup = null;
        confirmBtn = null;
        cancelBtn = null;
    }
    masterClipRect = null;

    const finalImg = canvas.getObjects().find(obj => obj.id === 'final-image');
    const inpaintingImg = canvas.getObjects().find(obj => obj.id === 'inpainting-image');
    const pictech = canvas.getObjects().find(obj => obj.id === 'pictech');

    if (finalImg) {
        canvas.sendToBack(finalImg);
    }
    if (pictech) {
        canvas.sendToBack(pictech);
    }
    if (inpaintingImg) {
        canvas.bringToFront(inpaintingImg);
    }
    canvas.getObjects().forEach(obj => {
        if (obj.clipPath) {
            obj.clipPath = null;
            obj.dirty = true;
        }
        if (obj.type === 'f-text') {
            obj.set({
                selectable: true,
                hasControls: true,
                evented: true
            });
            canvas.bringToFront(obj);
        }
    });

    canvas.requestRenderAll();

    if (doSaveState) {
        // saveState();
    }
    console.log("--- [结束] cancelRestore: 状态已恢复 ---");
}

function showCustomAlert(message) {
    console.warn(`UI提示: ${message}`);
}
/**
 * 【中文备注】创建科技感图标按钮（支持指定尺寸）
 * @param {string} svgString - SVG图标字符串
 * @param {string} color - 主色调（描边 & 发光）
 * @param {string} name - 按钮名称
 * @param {number} size - 按钮宽高（像素），默认36px，推荐设置为偶数，如16、20、24、32等
 * @returns {Promise<fabric.Group>} - 返回按钮组
 */
async function createIconButton(svgString, color, name, size = 24) {
    const radius = size / 2;

    // 背景圆形（支持动态尺寸）
    const btnBackground = new fabric.Circle({
        radius,
        fill: 'rgba(20, 20, 30, 0.7)',
        stroke: color,
        strokeWidth: 2,
        shadow: `0 0 10px ${color}`,
        originX: 'center',
        originY: 'center'
    });

    // 加载SVG图标并缩放适配背景
    const icon = await new Promise(resolve => {
        fabric.loadSVGFromString(svgString, (objects, options) => {
            const svg = fabric.util.groupSVGElements(objects, options);
            svg.set({
                fill: '#ffffff',
                originX: 'center',
                originY: 'center'
            });

            // 核心：缩放图标以适应背景圆（占用 60% 区域）
            const iconTargetSize = radius * 1.2;
            const scale = iconTargetSize / Math.max(svg.width, svg.height);
            svg.scale(scale);

            resolve(svg);
        });
    });

    // 合并为一个按钮组
    return new fabric.Group([btnBackground, icon], {
        name,
        selectable: false,
        hasControls: false,
        evented: true,
        originX: 'center',
        originY: 'center',
        hoverCursor: 'pointer',
    });
}

// 【新增】一个函数来调整画布尺寸
function resizeCanvas() {
    const container = document.getElementById('canvas-container');
    const width = container.clientWidth;
    const height = container.clientHeight;
    canvas.setWidth(width);
    canvas.setHeight(height);
    canvas.calcOffset();
    canvas.renderAll();
}

// 在初始化和窗口大小变化时调用
window.addEventListener('resize', resizeCanvas);


/**
 * 定位文本编辑面板，确保不遮挡文本，并支持拖拽
 * @param {fabric.Object} target - Fabric.js 文本对象（f-text）
 */
function positionTextPanel(target) {
    console.group(`[Debug] 定位面板，目标文本: "${target?.text?.substring(0, 20) || '未知'}..."`);

    try {
        // 检查 target 是否有效
        if (!target || !target.type || typeof target.getBoundingRect !== 'function') {
            console.error("【错误】无效的 target 对象:", {
                target: target,
                hasType: !!target?.type,
                isFabricObject: target instanceof fabric.Object,
                hasGetBoundingRect: typeof target?.getBoundingRect === 'function'
            });
            console.groupEnd();
            return;
        }

        // 等待布局稳定后再进行定位
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                performPositioning(target);
            });
        });

    } catch (error) {
        console.error("在 positionTextPanel 函数中发生异常:", error);
        console.groupEnd();
    }
}

/**
 * 执行实际的定位逻辑
 * @param {fabric.Object} target
 */
function performPositioning(target) {
    try {
        // 记录目标文本的完整属性
        console.log("%c目标文本属性:", "color: purple; font-weight: bold;", {
            type: target.type,
            text: target.text,
            width: target.width,
            height: target.height,
            scaleX: target.scaleX,
            scaleY: target.scaleY,
            angle: target.angle,
            left: target.left,
            top: target.top,
            fontSize: target.get('fontSize') || 24
        });

        // 检查是否用户已手动拖拽面板
        const panel = textEditorPanel;
        if (panel.dataset.userDragged === 'true') {
            console.log("%c面板已被用户拖拽，跳过自动定位", "color: orange; font-weight: bold;");
            console.groupEnd();
            return;
        }

        // 强制重新计算布局，确保获取准确的尺寸
        const editorContainer = document.getElementById('editor-container');
        editorContainer.offsetHeight; // 触发重绘

        // 获取面板尺寸
        const panelRect = getPanelRect(panel);
        if (!panelRect) {
            console.error("【错误】无法获取面板的有效尺寸!");
            console.groupEnd();
            return;
        }

        console.log("%c面板尺寸:", "color: blue; font-weight: bold;", panelRect);

        // 添加延迟确保容器尺寸稳定
        setTimeout(() => {
            calculateAndApplyPosition(target, panel, editorContainer, panelRect);
        }, 10);

    } catch (error) {
        console.error("在 performPositioning 函数中发生异常:", error);
        console.groupEnd();
    }
}

/**
 * 获取面板的准确尺寸
 * @param {HTMLElement} panel
 * @returns {Object|null}
 */
function getPanelRect(panel) {
    // 如果面板隐藏，需要临时显示来获取尺寸
    const wasHidden = panel.style.display === 'none';
    const originalVisibility = panel.style.visibility;
    const originalPosition = panel.style.position;

    if (wasHidden) {
        // 临时显示但不可见，用于测量
        panel.style.visibility = 'hidden';
        panel.style.position = 'absolute';
        panel.style.display = 'block';
        panel.style.top = '-9999px'; // 移到屏幕外
    }

    // 强制重新计算布局
    panel.offsetHeight;

    const rect = panel.getBoundingClientRect();

    // 恢复原始状态
    if (wasHidden) {
        panel.style.display = 'none';
        panel.style.visibility = originalVisibility;
        panel.style.position = originalPosition;
        panel.style.top = '';
    }

    // 验证尺寸有效性
    if (rect.width === 0 || rect.height === 0) {
        return null;
    }

    return {
        width: rect.width,
        height: rect.height
    };
}

/**
 * 计算并应用最终位置
 * @param {fabric.Object} target
 * @param {HTMLElement} panel
 * @param {HTMLElement} editorContainer
 * @param {Object} panelRect
 */
async function calculateAndApplyPosition(target, panel, editorContainer, panelRect) {
    try {
        // 获取稳定的容器尺寸
        let containerRect = null;
        let attempts = 0;
        const maxAttempts = 3;

        while (attempts < maxAttempts) {
            const currentRect = editorContainer.getBoundingClientRect();

            if (containerRect &&
                Math.abs(currentRect.width - containerRect.width) < 1 &&
                Math.abs(currentRect.height - containerRect.height) < 1) {
                break;
            }

            containerRect = currentRect;
            attempts++;

            if (attempts < maxAttempts) {
                await new Promise(resolve => setTimeout(resolve, 5));
            }
        }

        console.log("%c容器尺寸 (稳定后):", "color: blue; font-weight: bold;", {
            width: containerRect.width,
            height: containerRect.height,
            attempts: attempts
        });

        // 记录画布缩放状态
        console.log("%c画布缩放状态:", "color: orange; font-weight: bold;", {
            zoom: canvas.getZoom(),
            viewportTransform: canvas.viewportTransform
        });

        // 【关键修复】正确获取文本在容器中的位置
        // 方案1: 使用 canvas 的方法将对象坐标转换为页面坐标
        const canvasElement = canvas.getElement();
        const canvasRect = canvasElement.getBoundingClientRect();

        // 获取文本的实际渲染边界框（相对于canvas）
        const targetRect = target.getBoundingRect();

        // 将canvas坐标转换为页面坐标
        const targetInScreen = {
            left: canvasRect.left + targetRect.left,
            top: canvasRect.top + targetRect.top,
            width: targetRect.width,
            height: targetRect.height
        };

        // 转换为相对于容器的坐标
        const targetInContainer = {
            left: targetInScreen.left - containerRect.left,
            top: targetInScreen.top - containerRect.top,
            width: targetInScreen.width,
            height: targetInScreen.height
        };

        console.log("%c【修复】目标文本在各坐标系中的位置:", "color: green; font-weight: bold;", {
            canvas坐标: targetRect,
            屏幕坐标: targetInScreen,
            容器相对坐标: targetInContainer
        });

        // 动态间距计算
        const fontSize = target.get('fontSize') || 24;
        const containerScale = Math.min(containerRect.width / 1200, containerRect.height / 800);
        const baseGap = Math.max(15, 20 * containerScale);

        const gaps = {
            bottom: baseGap + 10 + fontSize * 0.3,
            top: baseGap + 60 + fontSize * 0.4,
            right: baseGap + fontSize * 0.3,
            left: baseGap + fontSize * 0.3
        };

        console.log("%c动态间距 (容器自适应):", "color: cyan; font-weight: bold;", {
            ...gaps,
            fontSize: fontSize,
            containerScale: containerScale.toFixed(3),
            baseGap: baseGap.toFixed(2)
        });

        // 计算候选位置
        const targetBottom = targetInContainer.top + targetInContainer.height;
        const targetRight = targetInContainer.left + targetInContainer.width;
        const targetCenterX = targetInContainer.left + targetInContainer.width / 2;
        const targetCenterY = targetInContainer.top + targetInContainer.height / 2;

        const positions = {
            bottom: {
                top: targetBottom + gaps.bottom,
                left: targetCenterX - panelRect.width / 2
            },
            top: {
                top: targetInContainer.top - panelRect.height - gaps.top,
                left: targetCenterX - panelRect.width / 2
            },
            right: {
                top: targetCenterY - panelRect.height / 2,
                left: targetRight + gaps.right
            },
            left: {
                top: targetCenterY - panelRect.height / 2,
                left: targetInContainer.left - panelRect.width - gaps.left
            }
        };

        console.log("%c【修复后】候选位置:", "color: cyan; font-weight: bold;", positions);

        // 更严格的碰撞检测
        const priority = ['bottom', 'top', 'right', 'left'];
        let bestPosition = null;

        for (const posName of priority) {
            const pos = positions[posName];

            // 检查是否在容器内
            const margin = 10;
            const fitsContainer = (
                pos.top >= margin &&
                pos.left >= margin &&
                pos.top + panelRect.height <= containerRect.height - margin &&
                pos.left + panelRect.width <= containerRect.width - margin
            );

            // 更精确的重叠检测
            const padding = 5;
            const isOverlapping = (
                pos.left < targetInContainer.left + targetInContainer.width + padding &&
                pos.left + panelRect.width > targetInContainer.left - padding &&
                pos.top < targetInContainer.top + targetInContainer.height + padding &&
                pos.top + panelRect.height > targetInContainer.top - padding
            );

            console.log(`%c检查位置 '${posName}':`, fitsContainer && !isOverlapping ? "color: green;" : "color: red;", {
                fitsContainer,
                overlapsText: isOverlapping,
                position: pos,
                gap: gaps[posName === 'bottom' ? 'bottom' : posName === 'top' ? 'top' : posName === 'right' ? 'right' : 'left'].toFixed(2)
            });

            if (fitsContainer && !isOverlapping) {
                console.log(`✔ '${posName}' 位置合适，已选择。`);
                bestPosition = pos;
                break;
            }
        }

        // 应用最终位置
        if (bestPosition) {
            panel.style.top = `${Math.round(bestPosition.top)}px`;
            panel.style.left = `${Math.round(bestPosition.left)}px`;
            console.log("%c最终位置:", "color: green; font-weight: bold;", {
                top: Math.round(bestPosition.top),
                left: Math.round(bestPosition.left)
            });
        } else {
            // 更智能的回退策略
            applyFallbackPosition(panel, targetInContainer, containerRect, panelRect, gaps);
        }

    } catch (error) {
        console.error("在 calculateAndApplyPosition 函数中发生异常:", error);
    } finally {
        console.groupEnd();
    }
}

/**
 * 应用回退位置策略
 */
function applyFallbackPosition(panel, targetInContainer, containerRect, panelRect, gaps) {
    console.warn("【备用方案】使用智能回退定位");

    // 尝试在目标下方，但确保不遮挡
    let fallbackTop = targetInContainer.top + targetInContainer.height + gaps.bottom;
    let fallbackLeft = targetInContainer.left;

    // 如果下方空间不够，尝试上方
    if (fallbackTop + panelRect.height > containerRect.height - 10) {
        fallbackTop = Math.max(10, targetInContainer.top - panelRect.height - gaps.top);
    }

    // 水平居中，但保证在容器内
    fallbackLeft = targetInContainer.left + targetInContainer.width / 2 - panelRect.width / 2;
    fallbackLeft = Math.max(10, Math.min(fallbackLeft, containerRect.width - panelRect.width - 10));

    // 最后确保垂直位置也在容器内
    fallbackTop = Math.max(10, Math.min(fallbackTop, containerRect.height - panelRect.height - 10));

    panel.style.top = `${Math.round(fallbackTop)}px`;
    panel.style.left = `${Math.round(fallbackLeft)}px`;

    console.log("%c回退位置:", "color: orange; font-weight: bold;", {
        top: Math.round(fallbackTop),
        left: Math.round(fallbackLeft)
    });
}

// 添加窗口大小变化监听，重新定位面板
let resizeTimeout;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
        const activeObject = canvas.getActiveObject();
        if (activeObject && activeObject.type === 'f-text' && textEditorPanel.style.display !== 'none') {
            console.log("窗口大小变化，重新定位面板");
            positionTextPanel(activeObject);
        }
    }, 100);
});




/**
 * 更新并显示文本编辑面板
 * @param {fabric.Object} target - Fabric.js 文本对象（f-text）
 */
function updateAndShowTextPanel(target) {
    // 【中文备注】检查目标是否为 f-text 类型，若不是则隐藏面板
    if (!target || target.type !== 'f-text') {
        console.log("【Debug】目标无效或非 f-text，隐藏面板:", { target: target, type: target?.type });
        hideTextPanel();
//        lastActiveText = null; // 重置缓存
        return;
    }

    // 【修复】检查是否为同一文本对象且面板已被拖拽
    if (target === lastActiveText) {
        console.log("%c同一文本对象且面板已被拖拽，跳过定位", "color: orange; font-weight: bold;", {
            targetText: target.text,
            lastActiveText: lastActiveText?.text
        });
        textEditorPanel.style.display = 'block';
        textEditorPanel.style.opacity = '1';
        textEditorPanel.style.transform = 'translateY(0)';
        textContentInput.focus(); // 强制聚焦 textarea
        console.log('【Debug】文本编辑面板成功显示，目标文本:', target.text);
        return;
    }

    if (target && target.type == 'f-text') {
         lastActiveText = target;
    }

    // 【中文备注】确保面板在显示前正确初始化控件值
    textContentInput.value = target.get('text') || '';
    fontSizeInput.value = Math.round(target.get('fontSize')) || 24;
    lineHeightInput.value = target.get('lineHeight') || 1.3;
    fontColorInput.value = target.get('fill') || '#000000';
    colorPreview.style.backgroundColor = target.get('fill') || '#000000';
  // 【修改】字体选择逻辑
    let currentFont = target.get('fontFamily') || 'Noto Sans SC, sans-serif';
    // 检查当前字体是否存在于我们的字体列表中
    const fontExists = FONT_LIST.some(font => font.value === currentFont);
    if (!fontExists) {
        console.warn(`字体 "${currentFont}" 未在列表中找到，回退到默认字体。`);
        currentFont = 'Noto Sans SC, sans-serif'; // 如果不存在，强制设为思源黑体
    }
    fontFamilySelect.value = currentFont;
    boldBtn.classList.toggle('active', target.get('fontWeight') === 'bold');
    alignCenterBtn.classList.toggle('active', target.get('textAlign') === 'center');

    const svg = document.getElementById('color-picker-icon1');
    const normalized = fontColorInput.value.toLowerCase();
    if (isLightColor(normalized)) {
        svg.setAttribute('fill', '#000000'); // 字体偏白，SVG 变黑
    } else {
        svg.setAttribute('fill', '#ffffff'); // 字体偏深，SVG 变白
    }

    // 【中文备注】确保字体选择有效，若无效则回退到默认字体 AlibabaPuHuiTi
    if (!fontFamilySelect.value || !FONT_LIST.some(font => font.value === fontFamilySelect.value)) {
        fontFamilySelect.value = 'AlibabaPuHuiTi';
        applyStyleToSelection({ fontFamily: 'AlibabaPuHuiTi' });
    }

    // 【中文备注】修复闪退问题：先设置 display 并初始化透明度，延迟显示以确保 DOM 稳定
    textEditorPanel.style.display = 'block';
    textEditorPanel.style.opacity = '0'; // 先设为透明，防止闪烁
    positionTextPanel(target); // 立即定位面板

    // 【中文备注】延迟显示以确保 DOM 更新完成，并强制聚焦 textarea
    setTimeout(() => {
        // 【新增】检查当前活跃对象，防止 selection:cleared 误触发隐藏
        if (canvas.getActiveObject() === target) {
            textEditorPanel.style.opacity = '1';
            textEditorPanel.style.transform = 'translateY(0)';
            textContentInput.focus(); // 强制聚焦 textarea
            console.log('【Debug】文本编辑面板成功显示，目标文本:', target.text);
        } else {
            console.warn('【Debug】活跃对象已改变，取消显示文本编辑面板');
            hideTextPanel();
//            lastActiveText = null; // 重置缓存
        }
    }, 100); // 延迟 100ms，确保 DOM 和事件处理稳定
}





function isLightColor(hexColor) {
  let r, g, b;

  // 去掉 #
  hexColor = hexColor.replace(/^#/, '');

  // 3位转6位
  if (hexColor.length === 3) {
    hexColor = hexColor.split('').map(c => c + c).join('');
  }

  // 解析 RGB
  r = parseInt(hexColor.slice(0, 2), 16);
  g = parseInt(hexColor.slice(2, 4), 16);
  b = parseInt(hexColor.slice(4, 6), 16);

  // 使用 YIQ 公式判断亮度
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;

  return yiq >= 200; // 亮度阈值越高越偏白（你可以调试这个值）
}

function hideTextPanel() {
    // 【中文备注】配合CSS动画，先改变透明度和位置，动画结束后再隐藏
    textEditorPanel.style.opacity = '0';
    textEditorPanel.style.transform = 'translateY(10px)';
    setTimeout(() => {
        textEditorPanel.style.display = 'none';
    }, 200); // 等待动画结束
}
function hideTextPanelAndDeselect() {
    hideTextPanel();
    canvas.discardActiveObject();
    canvas.renderAll();
}

// --- 【改造】应用样式到选中对象 ---
function applyStyleToSelection(style) {
    const activeObject = canvas.getActiveObject();

    if (activeObject && activeObject.type === 'f-text') {
        console.log('%c[applyStyleToSelection] 选中对象前状态:', 'color: #0aa', { ...activeObject.toObject() });
        console.log('%c[applyStyleToSelection] 即将应用样式:', 'color: #0a0', style);

        // 应用样式
        activeObject.set(style);
        canvas.renderAll();

        console.log('%c[applyStyleToSelection] 样式应用后状态:', 'color: #00a', { ...activeObject.toObject() });

        // 【中文备注】修复闪烁问题：检查面板是否已显示，仅更新控件值，不重新触发 updateAndShowTextPanel
        const isPanelVisible = textEditorPanel.style.display === 'block' && textEditorPanel.style.opacity === '1';
        console.log(`[applyStyleToSelection] 面板当前是否显示: ${isPanelVisible}`);

        if (isPanelVisible) {
            console.log('[applyStyleToSelection] 面板已显示，仅更新控件值');
            textContentInput.value = activeObject.get('text') || '';
            fontSizeInput.value = Math.round(activeObject.get('fontSize')) || 24;
            lineHeightInput.value = activeObject.get('lineHeight') || 1.3;
            fontColorInput.value = activeObject.get('fill') || '#000000';
            colorPreview.style.backgroundColor = activeObject.get('fill') || '#000000';
            boldBtn.classList.toggle('active', activeObject.get('fontWeight') === 'bold');
            alignCenterBtn.classList.toggle('active', activeObject.get('textAlign') === 'center');

            console.log('[applyStyleToSelection] ✅ 已完成控件值更新');
        } else {
            console.log('[applyStyleToSelection] 面板未显示，调用 updateAndShowTextPanel()');
            updateAndShowTextPanel(activeObject);
        }
    } else {
        console.warn('[applyStyleToSelection] 未选中 f-text 对象，或对象无效');
    }
}


// --- 【改造】设置文本控件监听器 ---
function setupTextControlListeners() {
    // 【中文备注】修复：修正事件监听逻辑，确保文本内容实时同步并顺畅修改
    // 文本内容：在 input 事件中实时更新文本框内容，blur 时保存状态
    textContentInput.addEventListener('input', (e) => {
        const activeObject = canvas.getActiveObject();
        if (activeObject && activeObject.type === 'f-text') { // 【修复】修正拼写错误 'f-tSext' -> 'f-text'
            activeObject.set('text', e.target.value);
            canvas.renderAll();
            positionTextPanel(activeObject); // 文本变化可能影响尺寸，需重新定位面板
        }
    });
    textContentInput.addEventListener('blur', saveState);

    // 字体、颜色等选择：在值改变后保存
    fontFamilySelect.addEventListener('change', async (e) => {
        await loadFont(e.target.value);
        applyStyleToSelection({ fontFamily: e.target.value });
        saveState();
    });
    fontColorInput.addEventListener('change', (e) => {
        applyStyleToSelection({ fill: e.target.value });
        colorPreview.style.backgroundColor = e.target.value;
        saveState();
    });

    // 字号、行高：在输入完成（change事件）后保存
    fontSizeInput.addEventListener('change', (e) => {
        applyStyleToSelection({ fontSize: parseInt(e.target.value, 10) || 24 });
        saveState();
    });
    lineHeightInput.addEventListener('change', (e) => {
        applyStyleToSelection({ lineHeight: parseFloat(e.target.value) || 1.3 });
        saveState();
    });

    // 按钮点击：单次操作，直接保存
    boldBtn.addEventListener('click', () => {
        const o = canvas.getActiveObject();
        if (o) {
            applyStyleToSelection({ fontWeight: o.get('fontWeight') === 'bold' ? 'normal' : 'bold' });
            saveState();
        }
    });
    alignCenterBtn.addEventListener('click', () => {
        const o = canvas.getActiveObject();
        if (o) {
            applyStyleToSelection({ textAlign: o.get('textAlign') === 'center' ? 'left' : 'center' });
            saveState();
        }
    });

    // 实时预览：仅更新样式，不保存状态
    fontSizeInput.addEventListener('input', (e) => applyStyleToSelection({ fontSize: parseInt(e.target.value, 10) || 24 }));
    lineHeightInput.addEventListener('input', (e) => applyStyleToSelection({ lineHeight: parseFloat(e.target.value) || 1.3 }));
    fontColorInput.addEventListener('input', (e) => {
        applyStyleToSelection({ fill: e.target.value });
        colorPreview.style.backgroundColor = e.target.value;
    });
}

// --- 新增 Bug 1: 文本编辑面板拖拽功能 ---
function setupPanelDragListeners() {
    const panel = document.getElementById('text-editor-panel');

    panel.addEventListener('mousedown', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'BUTTON') {
            return;
        }
        isDraggingPanel = true;
        panelStartX = e.clientX;
        panelStartY = e.clientY;
        const computedStyle = getComputedStyle(panel);
        panelLeft = parseFloat(computedStyle.left);
        panelTop = parseFloat(computedStyle.top);
//        e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDraggingPanel) return;
        const dx = e.clientX - panelStartX;
        const dy = e.clientY - panelStartY;
        panel.style.left = `${panelLeft + dx}px`;
        panel.style.top = `${panelTop + dy}px`;
    });

    document.addEventListener('mouseup', () => {
        isDraggingPanel = false;
    });
}

let isPanMode = false;

canvas.off('mouse:down').on('mouse:down', function (opt) {
    const target = opt.target;
    const e = opt.e;

    // 【改造】当点击 f-text 对象时，仅选中它并更新面板，不再进入画布编辑模式
    if (target && target.type === 'f-text') {
        updateAndShowTextPanel(target);
        // 无需设置拖拽标志，Fabric.js 的默认行为会处理对象的移动
        isPanMode = false;
        isDragging = false; // 明确不是画布平移
        return;
    }

    // （以下逻辑基本保持不变，用于处理其他对象选中和画布平移）
    if (target && target.selectable) {
        isPanMode = false;
        isDragging = false;
        return;
    }

    canvas.discardActiveObject();
    hideTextPanel();
    isPanMode = true;
    isDragging = false;
    lastPosX = e.clientX;
    lastPosY = e.clientY;
});

canvas.off('mouse:move').on('mouse:move', function (opt) {
    if (!isPanMode && !isDragging) return;

    const e = opt.e;
    const dx = e.clientX - lastPosX;
    const dy = e.clientY - lastPosY;

    if (isPanMode) {
        canvas.relativePan(new fabric.Point(dx, dy));
    } else if (isDragging && canvas.getActiveObject()) {
        const obj = canvas.getActiveObject();
        if (obj.type === 'f-text' && obj.isEditing) {
            obj.lockMovementX = false;
            obj.lockMovementY = false;
        }
        obj.left += dx;
        obj.top += dy;
        obj.setCoords();
        if (obj.type === 'f-text') {
            positionTextPanel(obj);
        }
    }

    lastPosX = e.clientX;
    lastPosY = e.clientY;
    canvas.requestRenderAll();
});

canvas.off('mouse:up').on('mouse:up', function () {


    const activeObject = canvas.getActiveObject();
    if (activeObject && activeObject.type === 'f-text' && activeObject.isEditing) {
	    if (isDragging || isPanMode) {
	        saveState();
	    }
        activeObject.lockMovementX = true;
        activeObject.lockMovementY = true;
    }

    isDragging = false;
    isPanMode = false;
});


canvas.on('mouse:wheel', (opt) => {
    const delta = opt.e.deltaY;
    let zoom = canvas.getZoom();
    zoom *= 0.999 ** delta;
    if (zoom > 5) zoom = 5;
    if (zoom < 0.1) zoom = 0.1;
    canvas.zoomToPoint({ x: opt.e.offsetX, y: opt.e.offsetY }, zoom);
    opt.e.preventDefault();
    opt.e.stopPropagation();

    canvas.requestRenderAll();
    clearTimeout(window.saveStateTimeout);
    window.saveStateTimeout = setTimeout(saveState, 300);
});

canvas.on({
    'selection:created': (e) => {
        // 【中文备注】仅当目标是 f-text 时显示面板
        if (e.target && e.target.type === 'f-text') {
            updateAndShowTextPanel(e.target);
        } else {
            // 【改造】延迟隐藏面板，防止快速切换导致闪退
            setTimeout(() => {
                if (!canvas.getActiveObject()) {
                    hideTextPanel();
                }
            }, 100);
        }
    },
    'selection:updated': (e) => {
        // 【中文备注】仅当目标是 f-text 时显示面板
        if (e.target && e.target.type === 'f-text') {
            updateAndShowTextPanel(e.target);
        } else {
            // 【改造】延迟隐藏面板，防止快速切换导致闪退
            setTimeout(() => {
                if (!canvas.getActiveObject()) {
                    hideTextPanel();
                }
            }, 100);
        }
    },
    'selection:cleared': () => {
        // 【改造】延迟隐藏面板，防止快速点击导致闪退
        setTimeout(() => {
            if (!canvas.getActiveObject()) {
                hideTextPanel();
                console.log('【Debug】选择清空，隐藏文本编辑面板');
            }
        }, 100);
    },
    //'object:modified': saveState,
    'mouse:up': () => { isDragging = false; }
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Delete' && canvas.getActiveObject()?.id === 'restore-group') {
        cancelRestore();
    }
});