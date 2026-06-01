---
zh_name: "高管摘要"
en_name: "Executive Summary"
emoji: "📝"
description: "Concise executive summary with key metrics, trends, and action items."
category: "report"
scenario: "product"
aspect_hint: "concise, metric-focused, action-oriented, one-page"
verify_profile: "strict-numbers"
source_key_rules: "Numeric metrics (revenue, growth%, counts) MUST have source-key annotations. Headings and qualitative summaries are exempt from source-key requirements but must not invent facts."
tags: ["executive", "summary", "metrics", "one-page"]
featured: 3
---

你是战略顾问。请根据以下数据生成一份**一页高管摘要**。

【输出要求】
- 标题：数据集名称 + 时间范围（如"Q1 2025 产品线表现"）。
- 顶部：3-5 个核心 KPI（如总收入、增长率、Top 产品），每个数字标注 `<!-- pf-src: rows[].字段名 -->`。
- 中部：关键趋势段落（2-3 句基于数据的观察），不编造。
- 底部：行动建议（2-3 条），每条明确基于哪个数据点。
- 一页之内（适合打印/截图分享）。

【数据保真度 — 严格数字模式】
- 所有数字必须精确标注 source-key。
- 文字描述可以免标注，但不能编造数据中不存在的事实。
- 派生计算（合计、增长率变化）标注 `<!-- pf-derived -->`。
