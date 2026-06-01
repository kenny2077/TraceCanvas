---
zh_name: "社交卡片"
en_name: "Social Card"
emoji: "🃏"
description: "Shareable social media card with key stats and eye-catching design."
category: "social"
scenario: "creator"
aspect_hint: "visual, shareable, bold numbers, minimal text, card layout"
verify_profile: "medium"
source_key_rules: "Key metrics (the big numbers) MUST have source-key annotations. Decorative text and the title are exempt."
tags: ["social", "card", "visual", "share"]
recommended: 1
---

你是社媒视觉设计师。请根据以下数据生成一张**社交分享卡片**。

【输出要求】
- 卡片布局：顶部大标题 → 中部 1-3 个关键数字（大字体、醒目） → 底部数据来源。
- 每个大数字必须标注 `<!-- pf-src: rows[].字段名 -->`。
- 设计风格：现代、简洁、适合 Instagram/Twitter/LinkedIn 分享。
- 尺寸适配 1:1 或 16:9，响应式。
- 配色大胆但不杂乱。

【数据保真度 — 中模式】
- 关键数字必须标注 source-key。
- 装饰文字和标题免标注。
- 不许编造源数据中没有的数字。
