package com.pictech.client;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.InvalidKeyException;
import java.security.NoSuchAlgorithmException;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.*;

/**
 * PicTech 图片翻译 API 客户端
 * 负责与远程 API 服务进行通信，包括构建请求、生成签名和发送 HTTP 请求。
 */
@Component
public class ImageTranslationApiClient {

    // --- 从 application.properties 注入配置 ---
    private final String apiBaseUrl;
    private final String apiKey;
    private final String secretKey;

    // --- HTTP 和 JSON 工具 ---
    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;

    // --- API 端点常量 ---
    private static final String SUBMIT_ENDPOINT = "/submit_task";
    private static final String QUERY_ENDPOINT = "/query_result";

    /**
     * 构造函数，通过 Spring 依赖注入初始化配置和工具。
     *
     * @param apiBaseUrl API 基础 URL
     * @param apiKey     API Key
     * @param secretKey  API Secret
     */
    public ImageTranslationApiClient(
            @Value("${pictech.api.base-url}") String apiBaseUrl,
            @Value("${pictech.api.key}") String apiKey,
            @Value("${pictech.api.secret}") String secretKey) {
        this.apiBaseUrl = apiBaseUrl;
        this.apiKey = apiKey;
        this.secretKey = secretKey;
        this.restTemplate = new RestTemplate();
        this.objectMapper = new ObjectMapper();
    }

    /**
     * 提交基于图片 URL 的翻译任务。
     */
    public Map<String, Object> submitTaskWithUrl(String imageUrl, String sourceLanguage, String targetLanguage) throws Exception {
        Map<String, Object> payload = new HashMap<>();
        payload.put("ImageUrl", imageUrl);
        payload.put("SourceLanguage", sourceLanguage);
        payload.put("TargetLanguage", targetLanguage);
        return executePostRequest(SUBMIT_ENDPOINT, payload);
    }

    /**
     * 提交基于 Base64 编码图片的翻译任务。
     */
    public Map<String, Object> submitTaskWithBase64(String imageBase64, String sourceLanguage, String targetLanguage) throws Exception {
        Map<String, Object> payload = new HashMap<>();
        payload.put("ImageBase64", imageBase64);
        payload.put("SourceLanguage", sourceLanguage);
        payload.put("TargetLanguage", targetLanguage);
        payload.put("OutputType", 1);
        return executePostRequest(SUBMIT_ENDPOINT, payload);


    }

    /**
     * 查询指定任务 ID 的翻译结果。
     */
    public Map<String, Object> queryTaskResult(String requestId) throws Exception {
        Map<String, Object> payload = new HashMap<>();
        payload.put("RequestId", requestId);
        return executePostRequest(QUERY_ENDPOINT, payload);
    }

    /**
     * 执行 POST 请求的核心方法。
     *
     * @param endpoint API 端点路径
     * @param payload  请求的业务参数
     * @return API 返回的响应体，解析为 Map
     * @throws Exception 如果请求失败或签名生成失败
     */
    private Map<String, Object> executePostRequest(String endpoint, Map<String, Object> payload) throws Exception {
        String timestamp = String.valueOf(ZonedDateTime.now(ZoneId.of("Asia/Shanghai")).toEpochSecond());

        // 1. 添加公共参数
        payload.put("AccountId", this.apiKey);
        payload.put("Timestamp", timestamp);

        // 2. 生成签名
        // 注意：签名的参数必须是字符串类型
        Map<String, String> paramsForSignature = new HashMap<>();
        for (Map.Entry<String, Object> entry : payload.entrySet()) {
            paramsForSignature.put(entry.getKey(), String.valueOf(entry.getValue()));
        }
        String signature = generateSignature(paramsForSignature);
        payload.put("Signature", signature);

        // 3. 设置 HTTP Header
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);

        // 4. 将 payload 转换为 JSON 字符串
        String requestBody;
        try {
            requestBody = objectMapper.writeValueAsString(payload);
        } catch (JsonProcessingException e) {
            throw new RuntimeException("无法将请求体序列化为JSON", e);
        }

        // 5. 创建并发送 HTTP 请求
        HttpEntity<String> requestEntity = new HttpEntity<>(requestBody, headers);
        String fullUrl = this.apiBaseUrl + endpoint;

        try {
            // 使用 RestTemplate 发送请求，并期望返回一个可以映射到 Map 的 JSON
            @SuppressWarnings("unchecked")
            Map<String, Object> response = restTemplate.postForObject(fullUrl, requestEntity, Map.class);
            return response;
        } catch (RestClientException e) {
            // 包装并抛出更具体的异常信息
            throw new RuntimeException("调用 PicTech API 失败: " + fullUrl + ", 错误: " + e.getMessage(), e);
        }
    }

    /**
     * 生成 API 请求签名。
     * 这是一个常见的签名实现方式，请根据您的 API 提供商的文档进行核对和修改。
     * 通常的流程是：
     * 1. 将所有请求参数（除了 signature 本身）按 key 的字母顺序排序。
     * 2. 将排序后的参数拼接成 `key1=value1&key2=value2` 的形式。
     * 3. 在拼接后的字符串末尾加上 `&key=SECRET_KEY`。
     * 4. 对最终的字符串进行 HMAC-SHA256 哈希计算。
     *
     * @param params 用于签名的参数映射
     * @return 生成的签名字符串（通常是十六进制）
     */
    /**
     * 生成签名（与服务端一致）
     */
    private String generateSignature(Map<String, String> params)
            throws NoSuchAlgorithmException, InvalidKeyException {
        // 1. 排序
        List<Map.Entry<String, String>> sortedEntries = new ArrayList<>(params.entrySet());
        sortedEntries.sort(Map.Entry.comparingByKey());

        // 2. 构造签名字符串，过滤空值
        StringBuilder toSign = new StringBuilder();
        for (Map.Entry<String, String> entry : sortedEntries) {
            if (entry.getValue() != null && !entry.getValue().isEmpty()) {
                if (toSign.length() > 0) {
                    toSign.append("&");
                }
                toSign.append(entry.getKey()).append("=").append(entry.getValue());
            }
        }
        toSign.append("&SecretKey=").append(secretKey);

        // 打印签名原始串
//        System.out.println("Client-side sign string: " + toSign);

        // 3. HMAC-SHA256 + Base64
        Mac hmacSha256 = Mac.getInstance("HmacSHA256");
        hmacSha256.init(new SecretKeySpec(secretKey.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
        byte[] hash = hmacSha256.doFinal(toSign.toString().getBytes(StandardCharsets.UTF_8));

        return Base64.getEncoder().encodeToString(hash);
    }

    /**
     * 辅助方法：将字节数组转换为十六进制字符串。
     */
    private static String bytesToHex(byte[] hash) {
        StringBuilder hexString = new StringBuilder(2 * hash.length);
        for (byte b : hash) {
            String hex = Integer.toHexString(0xff & b);
            if (hex.length() == 1) {
                hexString.append('0');
            }
            hexString.append(hex);
        }
        return hexString.toString();
    }
}