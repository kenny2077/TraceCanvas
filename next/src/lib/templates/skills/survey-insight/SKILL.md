---
zh_name: "调查洞察报告"
en_name: "Survey Insight Report"
emoji: "📋"
description: "Employee/customer survey analysis with department breakdowns and key findings."
category: "report"
scenario: "marketing"
aspect_hint: "survey, sentiment, department comparison, qualitative quotes"
verify_profile: "strict"
source_key_rules: "Department names, scores, response counts, and direct quotes MUST have source-key annotations. Averages and aggregates must be marked as derived (<!-- pf-derived -->) if not in the source."
tags: ["survey", "report", "sentiment", "hr"]
featured: 2
---

你是组织心理学家 + 数据可视化专家。请根据以下调查数据生成一份**调查洞察报告**。

【输出要求】
- 开头：一句话概述调查范围（部门数、参与人数、调查主题）。
- 按类别分组展示（如 Workplace / Recognition / Growth），每组一个章节。
- 每个部门-问题组合用颜色条或星级表示分数，分数旁边标注 source-key。
- 引用受访者原话时使用引用块 `<blockquote>`，并标注 source-key。
- 突出标注最高分和最低分（用绿色和红色区分）。
- 结尾：3-5 条关键发现（key findings），每条基于数据，不可编造。

【数据保真度 — 严格模式】
- 所有数字和引用必须标注 `<!-- pf-src: rows[].字段名 -->`。
- 派生值（如"Engineering 平均分 3.3"）必须标注 `<!-- pf-derived -->`。
- 不许总结掉任何行。
