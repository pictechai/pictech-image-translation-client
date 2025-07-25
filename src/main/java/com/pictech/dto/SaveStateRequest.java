package com.pictech.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

public class SaveStateRequest {
    @JsonProperty("RequestId")
    private String requestId;

    @JsonProperty("Code")
    private int code;

    @JsonProperty("Message")
    private String message;

    @JsonProperty("Data")
    private TranslationData data;

    public String getRequestId() {
        return requestId;
    }

    public SaveStateRequest setRequestId(String requestId) {
        this.requestId = requestId;
        return this;
    }

    public int getCode() {
        return code;
    }

    public SaveStateRequest setCode(int code) {
        this.code = code;
        return this;
    }

    public String getMessage() {
        return message;
    }

    public SaveStateRequest setMessage(String message) {
        this.message = message;
        return this;
    }

    public TranslationData getData() {
        return data;
    }

    public SaveStateRequest setData(TranslationData data) {
        this.data = data;
        return this;
    }
}
