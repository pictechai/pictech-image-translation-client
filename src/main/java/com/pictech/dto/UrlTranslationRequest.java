package com.pictech.dto;

public class UrlTranslationRequest {
    private String imageUrl;
    private String sourceLanguage;
    private String targetLanguage;

    public String getImageUrl() {
        return imageUrl;
    }

    public UrlTranslationRequest setImageUrl(String imageUrl) {
        this.imageUrl = imageUrl;
        return this;
    }

    public String getSourceLanguage() {
        return sourceLanguage;
    }

    public UrlTranslationRequest setSourceLanguage(String sourceLanguage) {
        this.sourceLanguage = sourceLanguage;
        return this;
    }

    public String getTargetLanguage() {
        return targetLanguage;
    }

    public UrlTranslationRequest setTargetLanguage(String targetLanguage) {
        this.targetLanguage = targetLanguage;
        return this;
    }
}
