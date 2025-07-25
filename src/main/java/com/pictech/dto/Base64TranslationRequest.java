package com.pictech.dto;

public class Base64TranslationRequest {
    private String imageBase64; // 包含 data:image/...;base64, 前缀
    private String sourceLanguage;
    private String targetLanguage;

    public String getImageBase64() {
        return imageBase64;
    }

    public Base64TranslationRequest setImageBase64(String imageBase64) {
        this.imageBase64 = imageBase64;
        return this;
    }

    public String getSourceLanguage() {
        return sourceLanguage;
    }

    public Base64TranslationRequest setSourceLanguage(String sourceLanguage) {
        this.sourceLanguage = sourceLanguage;
        return this;
    }

    public String getTargetLanguage() {
        return targetLanguage;
    }

    public Base64TranslationRequest setTargetLanguage(String targetLanguage) {
        this.targetLanguage = targetLanguage;
        return this;
    }
}
