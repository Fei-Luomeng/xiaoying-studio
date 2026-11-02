package com.xiaoying.studio.task;

public enum Stage {
    MATERIAL_CHECK("素材检查"), GENERATE("模拟生成"), FINALIZE("结果整理");
    public final String label;
    Stage(String label) { this.label = label; }
}
