package com.pictech.service;
import com.pictech.client.ImageTranslationApiClient;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.Base64;
import java.util.Map;

/**
 * 封装图片翻译的核心业务逻辑
 */
@Service
public class TranslationService {

    private final ImageTranslationApiClient apiClient;

    @Autowired
    public TranslationService(ImageTranslationApiClient apiClient) {
        this.apiClient = apiClient;
    }

    /**
     * 提交基于 URL 的翻译任务
     * @param imageUrl 图片 URL
     * @param sourceLanguage 源语言
     * @param targetLanguage 目标语言
     * @return API 响应结果
     * @throws Exception
     */
    public Map<String, Object> submitTaskFromUrl(String imageUrl, String sourceLanguage, String targetLanguage) throws Exception {
        return apiClient.submitTranslationTaskWithUrl(imageUrl, sourceLanguage, targetLanguage);
    }

    /**
     * 提交基于 Base64 的翻译任务
     * @param imageBase64 Base64 编码的图片字符串
     * @param sourceLanguage 源语言
     * @param targetLanguage 目标语言
     * @return API 响应结果
     * @throws Exception
     */
    public Map<String, Object> submitTaskFromBase64(String imageBase64, String sourceLanguage, String targetLanguage) throws Exception {
        return apiClient.submitTranslationTaskWithBase64(imageBase64, sourceLanguage, targetLanguage);
    }

    /**
     * 提交通过文件上传的翻译任务
     * @param file 上传的图片文件
     * @param sourceLanguage 源语言
     * @param targetLanguage 目标语言
     * @return API 响应结果
     * @throws Exception
     */
    public Map<String, Object> submitTaskFromFile(MultipartFile file, String sourceLanguage, String targetLanguage) throws Exception {
        // 将 MultipartFile 转换为 Base64 字符串
        String imageBase64 = convertFileToBase64(file);
        return apiClient.submitTranslationTaskWithBase64(imageBase64, sourceLanguage, targetLanguage);
    }

    /**
     * 查询翻译任务的结果
     * @param requestId 任务 ID
     * @return 查询结果
     * @throws Exception
     */
    public Map<String, Object> queryTaskResult(String requestId) throws Exception {
        return apiClient.queryTranslationTaskResult(requestId);
    }

    /**
     * 将 MultipartFile 转换为带前缀的 Base64 字符串
     * @param file 文件
     * @return Base64 字符串
     * @throws IOException
     */
    private String convertFileToBase64(MultipartFile file) throws IOException {
        String mimeType = file.getContentType();
        if (mimeType == null || !mimeType.startsWith("image")) {
            // 提供一个默认值或抛出异常
            mimeType = "image/jpeg";
        }
        byte[] fileContent = file.getBytes();
        String encodedString = Base64.getEncoder().encodeToString(fileContent);
        return "data:" + mimeType + ";base64," + encodedString;
    }
}