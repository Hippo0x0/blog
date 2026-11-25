---
categories: [LLM]
tags: [AI, Agent, 端侧AI, Tool Calling, Function Calling, Qwen, Gemma, 移动端]
---

# [AI] 端侧 AI Agent 调研：小模型能在手机上自主干多少事？

2026 年是端侧 Agent 从实验走向生产的转折点。Google 发布专为端侧 agent 设计的 Gemma 4 系列，阿里 Qwen3 全系支持 function calling，Android 系统级 AppFunctions API 让 App 向 AI 暴露可调用能力。本文整理了端侧 Agent 的架构模式、模型能力边界、上下文管理和 Tool Calling 方案。

---

## 1. 2026 端侧 Agent 关键事件

- **Google Gemma 4 (2026 年 4 月)**：专为端侧 agent 设计的开源模型家族（E2B ~2.3B, E4B ~4.5B），128K context，原生 function calling，多模态
- **Google AppFunctions (2026 年 3 月)**：Android Jetpack API，让 App 向 AI Agent 暴露可调用能力，类似 MCP 但 OS 级
- **llama.cpp tool calling 成熟**：通过 Jinja 模板 + GBNF grammar 实现可靠的 function calling
- **专用小模型井喷**：FunctionGemma (270M)、SimpleTool (0.5B)、LocoOperator-4B 等

---

## 2. Agent 架构模式

### 2.1 分层多模型（Tiered Multi-Model）——2026 年主流

```
              用户意图
                  │
                  ▼
┌─────────────────────────────────┐
│  Router (0.27B-0.6B)             │
│  FunctionGemma / Qwen3-0.6B      │
│  判断意图，分派任务，延迟 <50ms     │
└─────────────┬───────────────────┘
              │
     ┌────────┴────────┐
     ▼                 ▼
┌──────────┐  ┌──────────────────┐
│ Thinker  │  │ Executor         │
│ (0.6-3B) │  │ (4B+ / Cloud)     │
│ 基础推理  │  │ 复杂多步推理       │
│ 选工具    │  │ 长上下文          │
└──────────┘  └──────────────────┘
```

用一个极小的 Router 模型（270MB，始终在线）判断意图，简单任务由本地 Thinker 处理，复杂任务才上云模型。

### 2.2 Planner + Executor（规划-执行分离）

云端大模型做规划，端侧小模型做执行。OpenAI GPT-5.4 Mini/Nano 采用此模式。

```
Planner (cloud: GPT-5 / Gemini-2.5)
  → 分解任务为 steps
  → 每个 step = {tool, args}

Executor (on-device: Qwen3-0.8B)
  → 逐个执行 tool call
  → 返回结果给 Planner
```

### 2.3 Sub-Agent（子代理模式）

一个"主控"模型 (4B+) 管理多个子 agent，每个子 agent 处理特定领域。Jandal AI 的模块化 skill 框架（Kotlin native tools + Wasm sandbox）是实现参考。

---

## 3. 小模型能自主做什么

### 能力矩阵

| 能力 | 0.5B-1B | 2B-3B | 4B+ |
|------|:---:|:---:|:---:|
| 单步 Tool Call | ✅ | ✅ | ✅ |
| 多轮 Tool Call (2-3步) | ⚠️ | ✅ | ✅ |
| 结构化 JSON 输出 | ✅ | ✅ | ✅ |
| 分类/标签/摘要 | ✅ | ✅ | ✅ |
| 简单代码生成 | ⚠️ | ✅ | ✅ |
| 多步推理 (≥5步) | ❌ | ⚠️ | ✅ |
| 长文档理解 | ❌ | ⚠️ | ✅ |
| 模糊指令处理 | ❌ | ❌ | ⚠️ |

**关键数据点**：
- **FunctionGemma (270M)**：纯 function calling 模型，NL→结构化 API 调用，CPU 可跑
- **ST-Qwen-0.5B**：在 Mobile Actions benchmark 上超过 FunctionGemma
- **LocoOperator-4B**：100% 合法 JSON tool call，本地运行，零 API 成本
- **Qwen3-0.6B**：最小 thinking agent (752M params, 40K context)，支持 agentic loop

### 真实世界基准

Mercor APEX-Agents (2026 年 2 月)：首次尝试任务完成率 ~25%，重试后 ~40%。多步复杂任务仍然不可靠——端侧 Agent 的可靠性问题远未解决。

### 0.8B 模型的能力边界

**确定可行**：
- 内容自动分类/打标签/摘要——已验证
- 语义搜索——embedding + 向量检索
- 单步工具调用——搜索、设置、查询
- 简单的 2-3 步工作流——"找到所有关于认证的内容，创建一个总结"

**需要验证**：
- 多轮对话中的上下文保持
- 工具选择正确率（多工具场景）
- JSON 输出格式可靠性

**0.8B 做不了**：
- 长程多步推理（≥5步）
- 复杂代码生成/调试
- 模糊意图消歧

---

## 4. 上下文窗口与内存管理

### 理论 vs 实践

| 维度 | 理论值 | 移动端实践 |
|------|--------|-----------|
| Context window | 128K-256K (模型原生) | 4K-16K (RAM 约束) |
| KV cache (4K tokens) | ~500MB | 需与其他资源争抢 |
| Qwen3-0.6B 40K ctx | 40K 可用 | 实际 4K-8K 可控 |

### 核心问题：Memory Paradox

更多 context → 更高准确率，但 KV cache 随序列长度线性增长。Android LMK 在 3-4GB App RAM 时杀进程。

### 已落地的解决方案

**自适应上下文管理**（CMU & Samsung）：双 LoRA 适配器系统——Executor 适配器处理任务，State-Tracker 适配器将对话历史压缩为轻量 Context State Object (CSO)。初始 prompt 减少 6x，上下文增长速度降低 10-25x。

**PagedAttention**（Google AICore + Gemini Nano）：将 KV cache 分区为非连续块（类似虚拟内存分页），减少碎片，在移动 NPU 上支持更大有效上下文。

**MemAgent 多层记忆**：五层记忆架构（对话记忆 → 长期用户记忆 → 情景记忆 → 感官记忆 → 工作记忆），中央控制器在 token 预算下求解整数背包问题——自动修剪低价值记忆。

**量化 + RAG**：4-bit/2-bit 量化将模型压缩到 <1.5GB RAM，RAG 作为"小抄"补偿低精度的质量损失。

### 实践建议

| 策略 | 说明 |
|------|------|
| **ContextSize = 4096** | 当前合理值，Chat 场景够用 |
| **任务分离** | chat 用 4096，task（分类/标签）用 2048 |
| **按需加载工具 schema** | 不用时释放 token 预算 |
| **system prompt 精简** | ≤100 tokens，其余按需注入 |
| **用完即清** | 每次 infer 后 `llama_memory_clear` |

---

## 5. Tool/Function Calling 方案

### llama.cpp 方案（最通用）

llama.cpp 的工具调用在 2026 年已成熟：

```
Tool Definitions (JSON Schema)
    │
    ▼
Chat Template (Jinja)  ← 将 tools 注入 system prompt
    │
    ▼
llama_decode()  ← 正常推理
    │
    ▼
Grammar Constraint (GBNF/JSON Schema)  ← 约束 token 生成
    │
    ▼
Parse Tool Call  ← 提取 {name, arguments}
    │
    ▼
Execute Tool  ← 客户端本地执行
    │
    ▼
Inject Result  ← 再次 llama_decode
```

关键机制：JSON Schema 被编译为 GBNF grammar，在采样阶段强制模型输出合法 tool_call。这意味着模型本身 tool use 能力一般时，grammar 约束也能保证格式正确。

关键点：
- 必须启用 `--jinja` flag
- 支持 `tool_choice: "auto" | "required" | "none"`
- 已知问题：`tool_choice: "required"` 与 thinking/reasoning 模式冲突（[llama.cpp#15247](https://github.com/ggml-org/llama.cpp/issues/15247)）

### 方案对比

| 方案 | 适用场景 | 优劣 |
|------|---------|------|
| **llama.cpp + grammar** | 通用，无需外部依赖 | 需要自己写 tool-parsing |
| **Google AICore / AppFunctions** | Android 17+，Gemma 模型 | 限制 Google 生态 |
| **自定义 Prompt Engineering** | ≤3 个 tool，最简单 | 灵活性最低 |

---

## 6. 生产级案例

| 项目 | 平台 | 模型 | 特色 |
|------|------|------|------|
| **Google AICore + AppFunctions** | Android | Gemma 4 | OS 级 Agent，App 暴露能力给 AI |
| **ClawMobile** | Android | 任意 | 开箱即用 Agent runtime，语义 UI 控制 |
| **Jandal AI** | Android | Gemma 4 | 全离线，Kotlin，sqlite-vec RAG，Wasm skills |
| **PhoneClaw** | iOS | Gemma 4 (MLX) | 全离线，语音/相机/HealthKit |
| **OpenPhone** | Android | Qwen2.5-VL-3B | 端云协作，默认端侧，复杂才上云 |

---

## 7. 一个实操 ReAct Loop 示例

使用 Qwen3.5-0.8B + llama.cpp grammar 约束：

```
<system>
You are a content management agent. Available tools:
- search_content(query: string) → List<ContentItem>
- summarize(item_ids: string[]) → string
Use the tools to help the user. Respond in JSON: {"tool":"name","args":{...}}

<user>
Find all content about authentication and create a summary.

<assistant>
{"tool":"search_content","args":{"query":"authentication"}}

<observation>
Found 3 items: [id1, id2, id3]

<assistant>
{"tool":"summarize","args":{"item_ids":["id1","id2","id3"]}}

<observation>
Summary: Authentication-related content includes OAuth2 implementation, JWT token handling, and biometric auth integration.

<assistant>
Here's what I found about authentication in your knowledge base:
1. OAuth2 implementation guide...
2. JWT token handling best practices...
3. Biometric authentication integration...
```

---

## 8. 上下文预算（4096 tokens 模型）

| 项目 | Token 数 | 占比 |
|------|---------|:---:|
| System prompt + tool defs | 200 | 5% |
| Conversation history (压缩) | 500 | 12% |
| User query | 100 | 2% |
| Tool results (每轮 ~300) | 900 | 22% |
| **可用输出** | **2396** | **59%** |
| **总计** | **4096** | 100% |

---

## 9. 关键结论

1. **端侧 Agent 2026 年可行但有限**：单步 tool call 完全可靠，3 步以内基本可靠，5 步以上不稳定
2. **小模型的最大价值是 Router + 简单执行器**：0.6B 模型做意图路由 + 单步操作，复杂任务上云
3. **FunctionGemma (270M) 是惊喜**：纯 function calling 模型，CPU 可跑，准确率够用
4. **llama.cpp + GBNF grammar 是最通用的 tool calling 方案**：不绑生态，模型自由
5. **上下文管理才是真正的瓶颈**：Memory Paradox——更多 context 更准，但 KV cache 吃死 RAM
6. **本质洞察**：端侧 Agent 的价值不在于"替代云端 Agent"，而在于"能不上云的事就别上云"
