---
zh_name: "数据简报"
en_name: "Data Brief"
emoji: "📊"
description: "Structured data report with tables, charts, and source annotations."
category: "report"
scenario: "operations"
aspect_hint: "data-driven, table-heavy, precise numbers"
verify_profile: "strict"
source_key_rules: "Every numeric value, label, and category MUST have a <!-- pf-src: rows[].field --> annotation. All rows must be represented."
tags: ["data", "report", "table", "chart"]
featured: 1
---

你是数据分析师 + 前端工程师。请根据以下结构化数据生成一份**数据简报**。

【输出要求】
- 标题醒目，包含数据摘要（如"Q1 销售数据 · 10 个品类"）。
- 主体使用表格展示原始数据，每行每列都必须标注 source-key。
- 在表格上方添加 2-4 个 KPI 卡片（总计、平均值、最高、最低），每个 KPI 数字也要标注 source-key。
- 如果有时间序列或可比较维度，添加一个趋势摘要段落。
- 排版清晰，表格响应式（移动端友好）。
- 配色：主色#2563eb（蓝），中性灰系。

【数据保真度 — 严格模式】
- **不许**编造任何数字。
- **不许**省略任何行。
- 每个数据点必须紧跟 `<!-- pf-src: rows[].字段名 -->`。
- 数字精度必须与源数据一致（如 4.2 不能写成 4.20 或 4）。
