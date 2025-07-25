package com.pictech.controller;

import com.fasterxml.jackson.databind.util.JSONPObject;
import com.pictech.dto.Base64TranslationRequest;
import com.pictech.dto.SaveStateRequest;
import com.pictech.dto.UrlTranslationRequest;
import com.pictech.service.TranslationService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.Collections; // <-- 需要引入这个类
import java.util.HashMap;     // <-- 也可以用这个，作为备选
import java.util.Map;
import java.util.UUID;

/**
 * 提供图片翻译的 RESTful API 接口
 */
@RestController
@RequestMapping("/api/translate")
public class TranslationController {

    private final TranslationService translationService;

    @Autowired
    public TranslationController(TranslationService translationService) {
        this.translationService = translationService;
    }

    /**
     * 接口1: 通过图片 URL 提交翻译任务
     */
    @PostMapping("/url")
    public ResponseEntity<Object> submitFromUrl(@RequestBody UrlTranslationRequest request) {
        try {
            Map<String, Object> result = translationService.submitTaskFromUrl(
                    request.getImageUrl(),
                    request.getSourceLanguage(),
                    request.getTargetLanguage()
            );
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            // 使用 Collections.singletonMap() 替换 Map.of()
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Collections.singletonMap("error", e.getMessage()));
        }
    }

    /**
     * 接口2: 通过 Base64 字符串提交翻译任务
     */
    @PostMapping("/base64")
    public ResponseEntity<Object> submitFromBase64(@RequestBody Base64TranslationRequest request) {
        try {
            Map<String, Object> result = translationService.submitTaskFromBase64(
                    request.getImageBase64(),
                    request.getSourceLanguage(),
                    request.getTargetLanguage()
            );
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            // 使用 Collections.singletonMap() 替换 Map.of()
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Collections.singletonMap("error", e.getMessage()));
        }
    }

    /**
     * 接口3: 通过文件上传方式提交翻译任务 (推荐)
     */
    @PostMapping("/upload")
    public ResponseEntity<Object> submitFromFileUpload(@RequestParam("file") MultipartFile file,
                                                       @RequestParam("sourceLanguage") String sourceLanguage,
                                                       @RequestParam("targetLanguage") String targetLanguage) {
        if (file.isEmpty()) {
            // 使用 Collections.singletonMap() 替换 Map.of()
            return ResponseEntity.badRequest().body(Collections.singletonMap("error", "上传文件不能为空"));
        }
        try {
            Map<String, Object> result = translationService.submitTaskFromFile(file, sourceLanguage, targetLanguage);
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            // 使用 Collections.singletonMap() 替换 Map.of()
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Collections.singletonMap("error", e.getMessage()));
        }
    }

    /**
     * 【新增】接口2: 保存编辑器画布状态
     *
     * @param request 包含任务ID和最新画布状态的请求对象
     * @return 成功时返回成功信息，失败时返回错误信息
     */
    @PostMapping("/save")
    public ResponseEntity<Object> saveState(@RequestBody SaveStateRequest request) {
        try {
            Map<String, Object> mockResponse = new HashMap<>();
            mockResponse.put("Code", 200);
            mockResponse.put("Message", "状态保存成功");
            mockResponse.put("RequestId", UUID.randomUUID().toString());
            // 返回成功的响应
            if (request == null || request.getData() == null) {
                return ResponseEntity.ok(mockResponse);
            }
            // 调用 Service 层处理保存逻辑
//          Map<String, Object> result = translationService.saveTaskState(request);
            System.out.println(request.getData().getFinalImageUrl());
            // 返回成功的响应
            return ResponseEntity.ok(mockResponse);
        } catch (IllegalArgumentException e) {
            // 处理无效参数的异常
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Collections.singletonMap("error", "请求参数错误: " + e.getMessage()));
        } catch (Exception e) {
            // 处理其他所有服务器内部异常
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Collections.singletonMap("error", "服务器内部错误: " + e.getMessage()));
        }
    }

    /**
     * 接口4: 查询翻译任务的结果
     */
    @GetMapping("/result/{requestId}")
    public ResponseEntity<Object> queryResult(@PathVariable String requestId) {
        try {
            Map<String, Object> result = translationService.queryTaskResult(requestId);
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            // 使用 Collections.singletonMap() 替换 Map.of()
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Collections.singletonMap("error", e.getMessage()));
        }
    }
}