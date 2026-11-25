---
categories: [LLM]
tags: [AI, LLM, Tool Calling, Web Search, 端侧AI, SearXNG, Function Calling]
---

# [AI] 给本地模型加上联网搜索：端侧 LLM 如何接入互联网

本地 LLM 有知识截止日期。用户问「最近发生了什么」或「帮我查一下 XXX」，离线模型是答不了的。本文整理了给本地 LLM 加上联网搜索能力的完整方案——从意图识别到搜索结果注入，全程可在端侧完成。

---

## 1. 结论先行

**推荐方案**：客户端 Tool Calling 循环 + SearXNG（自部署）或 Serper API（免部署），分两阶段落地：

- **阶段 1**（快速验证）：prompt 内嵌搜索指令 + DuckDuckGo 免费 API，不改推理引擎，2-3 天可跑通
- **阶段 2**（正式方案）：Function Calling API + Grammar 约束 + SearXNG/Serper，稳定可靠

备选：如果想一步到位，直接用 Ollama 的 built-in `web_search` tool 最省事。

---

## 2. 技术链条

整个链条分 5 步：

```
用户消息 → [意图识别] → [搜索执行] → [结果处理] → [上下文注入] → LLM 回答
```

---

### 2.1 意图识别：怎么知道用户想搜索

| 方式 | 优点 | 缺点 |
|------|------|------|
| **关键词触发**（正则匹配"搜一下""帮我查"等） | 零延迟，不占推理资源 | 漏判率高，无法理解隐含搜索意图 |
| **小模型快速分类**（task session 做二分类） | 较准，延迟低（~50ms） | 多一次推理 |
| **主模型 Tool Calling**（模型自己输出 tool_call） | 最准，能处理隐含意图 | 每次推理都走 tool calling 流程 |

建议：阶段 1 用关键词触发快速验证全链路；阶段 2 切到主模型 Tool Calling。

---

### 2.2 搜索执行：拿什么搜、搜哪里

| 方案 | 部署难度 | 隐私性 | 搜索质量 | 费用 |
|------|----------|--------|----------|------|
| **DuckDuckGo Instant Answer API** | 零部署 | 中（DDG 不追踪用户，但走公网） | 中等 | 免费 |
| **SearXNG 自部署** | 需要服务器（Docker） | 高（搜索请求代理化，上游引擎看不到真实用户） | 高（聚合 Google/Bing/DDG 等） | 服务器成本 |
| **Brave Search API** | 零部署 | 中 | 高 | 免费 2000 次/月 |
| **Serper.dev** (Google Search API) | 零部署 | 低（走 Google 数据） | 最高 | 免费 2500 次/月 |
| **Bing Search API** | 零部署 | 低 | 高 | 免费 1000 次/月 |

SearXNG 自部署最符合"数据主权在用户"的定位——用户可以选择自建实例，也可以用公共实例。不想折腾的用户，Serper 或 Brave API 作为默认选项。

**SearXNG JSON API**：

```bash
curl "https://your-instance.example.com/search?q=Swift+6+new+features&format=json"
```

返回包含 `title`、`url`、`content`（snippet）、`engine` 的结构化结果。

---

### 2.3 结果处理：怎么把网页变成 LLM 可读的文本

| 方式 | 优点 | 缺点 |
|------|------|------|
| **只用 snippet** | 零延迟 | 信息量太少 |
| **逐条 fetch + HTML→text** | 信息完整 | 慢，HTML 转文本有噪音 |
| **Jina Reader / Firecrawl** | 专为 LLM 设计的抓取 API，输出干净 markdown | 需要额外 API（有免费额度） |

建议：阶段 1 用 URLSession 抓 2-3 条结果页 → 简单 HTML 标签剥离 → 截断到 2000 字。阶段 2 考虑接 Jina Reader（`https://r.jina.ai/{url}` 直接返回 LLM 友好的 markdown）。

---

### 2.4 上下文注入：怎么把搜索结果塞给模型

核心约束：**上下文窗口有限**。

```text
联网搜索结果：

[1] Swift 6 新特性详解
来源: https://example.com/swift6
内容: Swift 6 引入了严格并发检查...

[2] Swift 6 Migration Guide
来源: https://example.com/swift6-migration
内容: ...

基于以上搜索结果回答用户问题。
```

Open WebUI 的两种模式值得参考：
- **Bypass 模式**：原始内容直接拼进 prompt（适合大上下文模型）
- **RAG 模式**：搜索结果先 embedding → 存入向量库 → 检索最相关段落再注入

---

### 2.5 Tool Calling 循环：多轮搜索的执行框架

真正好用的联网搜索不是"搜一次 → 回答"，而是支持**多轮搜索**——模型搜一次发现不够，可以调整关键词再搜。

标准 Tool Calling 循环（Ollama / OpenAI 兼容模式）：

```python
messages = [{"role": "user", "content": "Swift 6 的 actor 和 Rust 的有什么区别？"}]

while True:
    response = chat(
        model="qwen3",
        messages=messages,
        tools=[web_search, web_fetch]
    )
    if response.message.tool_calls:
        for tc in response.message.tool_calls:
            result = execute_tool(tc)  # 调搜索 API，把结果拼回来
            messages.append({"role": "tool", "content": result})
    else:
        break  # 模型觉得信息够了，输出最终回答

return response.message.content
```

这个循环在客户端执行——模型只管输出 tool_call，实际的 HTTP 请求由 app 发起。

**llama.cpp 对 Tool Calling 的支持**：从 2024 年起就支持 OpenAI 兼容的 function calling。关键实现是**把 tool 的 JSON Schema 转成 GBNF grammar**，在采样阶段硬约束模型只能输出合法的 tool_call JSON——即使模型本身 tool use 能力一般，grammar 约束也能保证格式正确。

注意：必须启 `--jinja` flag，且 `tool_choice: "required"` 与 thinking/reasoning 模式有冲突（[llama.cpp#15247](https://github.com/ggml-org/llama.cpp/issues/15247)）。

---

## 3. 业界竞品参考

### 3.1 Lucy（Menlo Research, 2025）

专门为移动端 Agentic Web Search 训练的 1.7B 模型：
- 基座 Qwen3-1.7B，纯 RL（无 SFT）训练，用 verifiable rewards 驱动
- 内部 `<think>` 机制充当动态 task vector machine，自我构建搜索策略
- SimpleQA 上达到 78.3%，接近 DeepSeek-V3（67B）
- GGUF 格式可用

Lucy 的启发：不需要大模型也能做 agentic search，关键是让模型学会"怎么搜"而不是背答案。

### 3.2 Off Grid（iOS + Android）

完全端上运行的 AI 助手，内置 Tool Calling 体系：
- 支持 Qwen3、Llama 3.2、Gemma3、Phi-4 等模型
- 内置反"失控循环"保护（防止模型无限搜索）
- 搜索结果以可点击链接呈现

### 3.3 Open WebUI + SearXNG（社区主流）

最常见"完全本地化"方案组合：Open WebUI (前端) + Ollama (LLM) + SearXNG (搜索) + Chroma (向量库)。所有数据本地处理，搜索请求通过 SearXNG 代理化。

---

## 4. 推荐架构

```
ChatViewModel.sendMessage()
  │
  ▼
[当前消息] → InferenceEngine (task session, tool calling 模式)
  │
  │ ← tool_call: web_search("query")
  ▼
[WebSearchService]
  │
  ├─ SearXNG JSON API (自部署 or 公共实例)
  ├─ 备选: Serper API / Brave API
  ▼
[搜索结果 list]
  │
  ├─ snippet 直接用
  ├─ 可选: fetch URL → HTML→text
  ▼
[拼入 tool result message]
  │
  ▼
InferenceEngine (继续推理，基于搜索结果回答)
  │
  ▼
[最终流式回答]
```

---

## 5. 风险与应对

| 风险 | 应对 |
|------|------|
| Qwen3.5-0.8B tool calling 准确率不如大模型 | 先用 grammar 约束保底输出格式，再逐步调优 prompt |
| 搜索 API 有速率限制 | 内置结果缓存（同一 query 5min 内复用） |
| 网络 IO 让聊天变慢 | 搜索期间显示"正在搜索…"loading，流式回答不受阻塞 |
| 搜索结果质量参差 | snippet 先用，可选 fetch URL 获取完整内容 |
| SearXNG 需要用户自建服务器 | 提供默认公共实例列表，同时支持 Serper/Brave API 作为开箱即用选项 |

---

## 6. 参考

- [Ollama Web Search Blog](https://ollama.com/blog/web-search)
- [Lucy: edgerunning agentic web search](https://arxiv.org/abs/2508.00360)
- [llama.cpp Function Calling PR](https://github.com/ggml-org/llama.cpp/pull/9639)
- [SearXNG 官方文档](https://docs.searxng.org/)
- [Open WebUI Web Search](https://docs.openwebui.com/features/chat-conversations/web-search/)
