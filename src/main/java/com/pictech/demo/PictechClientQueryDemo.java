package com.pictech.demo;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.pictech.client.ImageTranslationApiClient;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.util.Base64;
import java.util.Map;

/**
 * 图片翻译演示类，支持本地图片和 URL 图片的翻译和查询
 */
public class PictechClientQueryDemo {

    // 【中文备注】用于美化 JSON 输出的 ObjectMapper 实例，设为静态常量以供共用
    private static final ObjectMapper prettyJsonMapper = new ObjectMapper()
            .enable(SerializationFeature.INDENT_OUTPUT);

    /**
     * 主入口方法，用于演示本地图片和 URL 图片的翻译和查询
     *
     * @param args 命令行参数（未使用）
     * @throws Exception JSON 处理或线程中断可能抛出异常
     */
    public static void main(String[] args) throws Exception {
        // 【中文备注】创建 API 客户端实例
        ImageTranslationApiClient client =
        new ImageTranslationApiClient(
                Constants.apiBaseUrl,
                Constants.apiKey,
                Constants.secretKey);

        // 【中文备注】创建 Demo 实例
        Map<String, Object> queryResult = client.queryTranslationTaskResult("60dcbb8e-ea8e-4a7c-bd42-cb42f06c4e86");
        // 【中文备注】打印格式化的查询结果
        System.out.println("查询结果: " + prettyJsonMapper.writeValueAsString(queryResult));

    }

    /**
     * 从文件路径读取图片并转换为 Base64 编码
     *
     * @param imagePath 图片文件路径
     * @return Base64 编码字符串（包含 MIME 类型前缀，如 "data:image/jpeg;base64,"），失败时返回 null
     */
    public String readImageAsBase64(String imagePath) {
        // 【中文备注】检查输入路径是否有效
        if (imagePath == null || imagePath.isEmpty()) {
            System.err.println("错误：图片路径为空");
            return null;
        }

        try {
            File imageFile = new File(imagePath);
            // 【中文备注】验证图片文件是否存在
            if (!imageFile.exists()) {
                System.err.println("错误：找不到文件 '" + imagePath + "'");
                return null;
            }

            // 【中文备注】获取图片的 MIME 类型，默认为 image/jpeg
            String mimeType = Files.probeContentType(imageFile.toPath());
            if (mimeType == null || !mimeType.startsWith("image")) {
                System.err.println("警告：无法识别图片类型 '" + imagePath + "'，将默认使用 image/jpeg。");
                mimeType = "image/jpeg";
            }

            // 【中文备注】读取图片内容并转换为 Base64
            byte[] fileContent = Files.readAllBytes(imageFile.toPath());
            String base64Data = Base64.getEncoder().encodeToString(fileContent);

            return "data:" + mimeType + ";base64," + base64Data;
        } catch (IOException e) {
            System.err.println("读取或编码图片时出错: " + imagePath + "，异常信息: " + e.getMessage());
            return null;
        }
    }

    /**
     * 从 main/resources 获取图片文件的绝对路径
     *
     * @param resourcePath main/resources 下的图片相对路径（如 "source.png"）
     * @return 图片文件的绝对路径，若文件不存在返回 null
     */
    public String getResourceImagePath(String resourcePath) {
        // 【中文备注】检查输入路径是否有效
        if (resourcePath == null || resourcePath.isEmpty()) {
            System.err.println("错误：资源路径为空");
            return null;
        }

        try {
            // 【中文备注】使用 ClassLoader 获取 main/resources 下的图片资源
            ClassLoader classLoader = getClass().getClassLoader();
            java.net.URL resourceUrl = classLoader.getResource(resourcePath);
            if (resourceUrl == null) {
                System.err.println("错误：main/resources 下找不到图片 '" + resourcePath + "'");
                return null;
            }
            // 【中文备注】将资源 URL 转换为文件路径
            File imageFile = new File(resourceUrl.toURI());
            if (!imageFile.exists()) {
                System.err.println("错误：图片文件 '" + imageFile.getAbsolutePath() + "' 不存在");
                return null;
            }
            // 【中文备注】返回图片的绝对路径
            return imageFile.getAbsolutePath();
        } catch (Exception e) {
            System.err.println("获取 main/resources 图片路径失败: " + resourcePath + "，异常信息: " + e.getMessage());
            return null;
        }
    }

    /**
     * 演示 1: 提交单个图片翻译任务（使用 Base64 编码）
     *
     * @param client        API 客户端实例
     * @param resourcePath  main/resources 下的图片相对路径（如 "source.png"）
     * @param sourceLanguage 源语言代码
     * @param targetLanguage 目标语言代码
     * @return 成功提交后，返回任务的 RequestId；否则返回 null
     * @throws Exception JSON 处理可能抛出异常
     */
    public String demonstrateSingleSubmitWithBase64(ImageTranslationApiClient client, String resourcePath, String sourceLanguage, String targetLanguage) throws Exception {
        // 【中文备注】打印演示标题
        System.out.println("\n--- 演示 1: 提交 Base64 图片 ---");

        // 【中文备注】验证语言参数
        if (sourceLanguage == null || sourceLanguage.isEmpty() || targetLanguage == null || targetLanguage.isEmpty()) {
            System.err.println("错误：源语言或目标语言为空");
            return null;
        }

        // 【中文备注】从 main/resources 加载图片
        String imagePath = getResourceImagePath(resourcePath);

        String requestId = null;
        // 【中文备注】检查图片路径是否有效
        if (imagePath != null) {
            // 【中文备注】读取图片并转换为 Base64
            String imageBase64 = readImageAsBase64(imagePath);
            if (imageBase64 != null) {
                // 【中文备注】验证客户端实例
                if (client == null) {
                    System.err.println("错误：API 客户端实例为空");
                    return null;
                }

                // 【中文备注】调用客户端方法提交任务
                Map<String, Object> submitResult = client.submitTranslationTaskWithBase64(imageBase64, sourceLanguage, targetLanguage);
                // 【中文备注】打印格式化的响应
                System.out.println("单任务提交(Base64) 响应: " + prettyJsonMapper.writeValueAsString(submitResult));

                // 【中文备注】从响应中提取 RequestId 用于后续查询
                if (submitResult != null) {
                    requestId = (String) submitResult.get("RequestId");
                }


            } else {
                System.out.println("读取图片 " + imagePath + " 失败，跳过提交。");
            }
        } else {
            System.out.println("获取 main/resources 图片路径 " + resourcePath + " 失败，跳过提交。");
        }
        return requestId;
    }

    /**
     * 演示 2: 提交单个图片翻译任务（使用图片 URL）
     *
     * @param client        API 客户端实例
     * @param imageUrl      图片 URL
     * @param sourceLanguage 源语言代码
     * @param targetLanguage 目标语言代码
     * @return 成功提交后，返回任务的 RequestId；否则返回 null
     * @throws Exception JSON 处理可能抛出异常
     */
    public String demonstrateSingleSubmitWithUrl(ImageTranslationApiClient client, String imageUrl, String sourceLanguage, String targetLanguage) throws Exception {
        // 【中文备注】打印演示标题
        System.out.println("\n--- 演示 2: 提交 URL 图片 ---");

        // 【中文备注】验证客户端实例
        if (client == null) {
            System.err.println("错误：API 客户端实例为空");
            return null;
        }

        // 【中文备注】验证图片 URL
        if (imageUrl == null || imageUrl.isEmpty()) {
            System.err.println("错误：图片 URL 为空");
            return null;
        }

        // 【中文备注】验证语言参数
        if (sourceLanguage == null || sourceLanguage.isEmpty() || targetLanguage == null || targetLanguage.isEmpty()) {
            System.err.println("错误：源语言或目标语言为空");
            return null;
        }

        // 【中文备注】调用客户端方法提交任务
        Map<String, Object> submitResult = client.submitTranslationTaskWithUrl(imageUrl, sourceLanguage, targetLanguage);
        // 【中文备注】打印格式化的响应
        System.out.println("单任务提交(URL) 响应: " + prettyJsonMapper.writeValueAsString(submitResult));

        // 【中文备注】从响应中提取 RequestId 用于后续查询
        String requestId = null;
        if (submitResult != null) {
            requestId = (String) submitResult.get("RequestId");
        }
        return requestId;
    }

    /**
     * 演示 3: 查询单个任务的结果
     *
     * @param client    API 客户端实例
     * @param requestId 要查询的任务 ID
     * @throws Exception JSON 处理或线程中断可能抛出异常
     */
    public void demonstrateSingleQuery(ImageTranslationApiClient client, String requestId) throws Exception {
        // 【中文备注】打印演示标题
        System.out.println("\n--- 演示 3: 查询单个任务结果 --- \t" + requestId);

        // 【中文备注】安全检查，确保 requestId 和 client 不为空
        if (requestId == null || requestId.isEmpty()) {
            System.out.println("RequestId 为空，无法查询。");
            return;
        }
        if (client == null) {
            System.err.println("错误：API 客户端实例为空");
            return;
        }

        // 【中文备注】模拟等待后台处理时间
        System.out.println("等待 5 秒钟让后台处理...");
        Thread.sleep(5000);

        // 【中文备注】调用客户端方法查询结果
        Map<String, Object> queryResult = client.queryTranslationTaskResult(requestId);
        // 【中文备注】打印格式化的查询结果
        System.out.println("查询 RequestId [" + requestId + "] 结果: " + prettyJsonMapper.writeValueAsString(queryResult));
    }
}