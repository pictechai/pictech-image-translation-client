package com.pictech.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

public class TranslationData {
    @JsonProperty("FinalImageUrl")
    private String finalImageUrl;

    @JsonProperty("InPaintingUrl")
    private String inPaintingUrl;

    @JsonProperty("SourceUrl")
    private String sourceUrl;

    // 关键字段：画布的 JSON 状态
    @JsonProperty("TemplateJson")
    private String templateJson;

    public String getFinalImageUrl() {
        return finalImageUrl;
    }

    public TranslationData setFinalImageUrl(String finalImageUrl) {
        this.finalImageUrl = finalImageUrl;
        return this;
    }

    public String getInPaintingUrl() {
        return inPaintingUrl;
    }

    public TranslationData setInPaintingUrl(String inPaintingUrl) {
        this.inPaintingUrl = inPaintingUrl;
        return this;
    }

    public String getSourceUrl() {
        return sourceUrl;
    }

    public TranslationData setSourceUrl(String sourceUrl) {
        this.sourceUrl = sourceUrl;
        return this;
    }

    public String getTemplateJson() {
        return templateJson;
    }

    public TranslationData setTemplateJson(String templateJson) {
        this.templateJson = templateJson;
        return this;
    }
}
