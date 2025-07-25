package com.pictech.demo;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.pictech.client.ImageTranslationApiClient;

import java.nio.file.Paths;
import java.util.Map;
import java.util.logging.ConsoleHandler;
import java.util.logging.Level;
import java.util.logging.Logger;

public class RemoveClientDemo {

    private static final Logger LOGGER = Logger.getLogger(ImageTranslationApiClient.class.getName());

    static {
        ConsoleHandler handler = new ConsoleHandler();
        // 设置日志格式，方便阅读
        handler.setFormatter(new java.util.logging.SimpleFormatter() {
            @Override
            public String format(java.util.logging.LogRecord record) {
                return String.format("%1$tF %1$tT - %2$s - %3$s%n",
                        record.getMillis(), record.getLevel(), record.getMessage());
            }
        });
        LOGGER.addHandler(handler);
        LOGGER.setLevel(Level.INFO); // 设置日志级别为 INFO，可以根据需要调整为 Level.FINE 进行更详细的调试
    }

    public static void main(String[] args) {
        // --- 初始化客户端 ---
        // 在实际 Spring 项目中，这会通过 @Autowired 自动注入
        // 这里为了方便测试，我们手动 new 一个实例
        ImageTranslationApiClient client =
                new com.pictech.client.ImageTranslationApiClient(
                Constants.apiBaseUrl,
                Constants.apiKey,
                Constants.secretKey);
        LOGGER.info("API 客户端初始化完成。");


        // --- 场景2: 测试背景移除(抠图)功能 ---
        System.out.println("\n----------- 开始测试背景移除(抠图)功能 -----------");
        try {
            // 您可以选择使用本地图片路径 或 图片URL
            String localImagePath = "/Users/liuhongjing/Downloads/1.jpg"; // 【请修改】指向您的本地图片
            String outputDirectory = "/Users/liuhongjing/Downloads/output/"; // 【请修改】指定输出目录
            String outputFilename = "removed_background_result.png";

            LOGGER.info("准备执行抠图任务, 输出到: " + Paths.get(outputDirectory, outputFilename));

            // 调用高级封装方法，传入本地图片路径
            boolean success = client.removeBackground(localImagePath, null, outputDirectory, outputFilename);
            // 或者，传入图片URL
            // boolean success = client.removeBackground(null, imageUrlForRemoval, outputDirectory, outputFilename);

            if (success) {
                LOGGER.info("抠图任务成功完成！");
            } else {
                LOGGER.severe("抠图任务失败！");
            }

        } catch (Exception e) {
            LOGGER.severe("测试背景移除时发生错误: " + e.getMessage());
            e.printStackTrace();
        }
    }
}
