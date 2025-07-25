// --- 【中文备注】API 请求路径配置 ---
const API_CONFIG = {
    UPLOAD_API: '/api/translate/upload', // 文件上传接口
    URL_API: '/api/translate/url',       // URL 提交接口
    RESULT_API: '/api/translate/result', // 结果轮询接口（不含 requestId）
    SAVE_API: '/api/translate/save',
    POLLING_INTERVAL_MS: 2000 // 轮询间隔，当前设置为2秒
};



export default API_CONFIG;