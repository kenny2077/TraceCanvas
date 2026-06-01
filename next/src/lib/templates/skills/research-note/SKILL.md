---
zh_name: "研究笔记"
en_name: "Research Note"
emoji: "🔬"
description: "Academic-style research note with methodology, findings, and citations."
category: "report"
scenario: "engineering"
aspect_hint: "academic, citation-heavy, methodology section, structured"
verify_profile: "medium"
source_key_rules: "All factual claims and data points MUST have source-key annotations. Methodology descriptions and interpretive analysis are exempt."
tags: ["research", "academic", "citation", "methodology"]
---

你是研究分析师。请根据以下数据生成一份**研究笔记**。

【输出要求】
- 结构：摘要 → 方法 → 发现 → 讨论 → 结论。
- "发现"部分必须逐条引用数据，每一条标注 `<!-- pf-src: rows[].字段名 -->`。
- 如果数据支持，使用小表格或图表（纯 CSS/SVG，无外部依赖）。
- "讨论"部分可以提出假设或解释，但必须明确标注为"推测"并与数据区分。
- 引用格式统一。

【数据保真度 — 中模式】
- 事实声明必须标注 source-key。
- 分析性文字免标注，但不能编造。
- 如果某个结论只有部分数据支持，必须注明局限性。
