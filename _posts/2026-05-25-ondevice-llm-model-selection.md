---
categories: [LLM]
tags: [AI, LLM, 端侧AI, 模型选型, Qwen, GGUF, 移动端]
---

# [AI] 端侧 LLM 模型选型指南（2026）

想把 LLM 跑在手机上，选哪个模型？本文整理了 2026 年适合移动端部署的开源模型，覆盖 Qwen3 / MiniCPM / Gemma / Phi / Llama 等主流选项，包含真实设备 benchmark 和 GGUF 量化建议。

---

## 1. 小模型竞争格局

移动端能跑得动的模型范围大致在 0.5B-4B 参数量。几个关键数据点：

| 模型 | 参数量 | MMLU | 上下文 | iPhone 15 Pro 速度 | 核心优势 | 许可 |
|------|--------|------|--------|-------------------|----------|------|
| **Qwen3-4B** | 4B | 78.3% | 256K | ~30 tok/s | 中英双语最佳 | Apache 2.0 |
| **MiniCPM 4.0** | 4B | SOTA 级 | 128K | 17+ tok/s (iPhone 16 Pro) | 专为手机打造 | Custom (free) |
| **Phi-4-mini** (Microsoft) | 3.8B | 67.3% | 128K | — | 推理/代码最强 | MIT |
| **Gemma 3** (Google) | 1B/4B | — | 128K | 45 tok/s (4B on Jetson) | Android 集成最好 | Apache 2.0 |
| **Llama 3.2** (Meta) | 1B/3B | — | 128K | 7.7 tok/s (3B, S24 Ultra) | Tool-calling/JSON 最佳 | Community |

Qwen3-4B-2507 是 2025 年 8 月专门为移动端优化的版本，256K 上下文，benchmark 上能打 Qwen2.5-72B。MiniCPM-V 4.0 的 OCRBench 894 甚至超过了 GPT-4.1-mini（840）。

---

## 2. Qwen 系列：端侧首选

### Qwen3（2025 年 4 月，Apache 2.0）

36 万亿 token 训练，119 种语言，Dense + MoE 双架构：

| 模型 | 参数量 | 上下文 | 架构 | 移动端适配 |
|------|--------|--------|------|-----------|
| **Qwen3-0.6B** | 0.6B | 32K | Dense | 超轻量 |
| **Qwen3-1.7B** | 1.7B | 32K | Dense | 均衡选择 |
| **Qwen3-4B** | 4B | 256K | Dense | 最佳质量 |
| Qwen3-8B | 8B | 128K | Dense | 旗舰机可用 |
| Qwen3-30B-A3B | 30B / 3B active | 128K | MoE | 值得关注（仅3B激活） |

**Qwen3.5-0.8B**（2026 年 3 月）是移动端真正的突破——原生 256K 上下文，Hybrid Gated DeltaNet + Gated Attention (3:1) 混合架构，18 层 DeltaNet 的 KV cache 不随上下文增长。Q4_K_M 量化后仅 550 MB。

### 中英双语推荐优先级

| 优先级 | 模型 | 理由 |
|--------|------|------|
| **1st** | Qwen3-4B-2507 | C-Eval 82.1%, MMLU 78.3%, 256K, Apache 2.0 |
| **2nd** | Qwen3.5-0.8B | 256K, 550MB, 混合架构内存友好 |
| **3rd** | MiniCPM 4.0 | 专为手机打造，iOS 开源 App |
| **4th** | Qwen3-1.7B | 轻量选项，32K 上下文 |
| **避开** | Gemma 3（中文场景） | 已知中文 bug，会胡编古诗词 |
| **避开** | Llama 3.2（中文场景） | 中文 benchmark ~30%, 需微调 |

---

## 3. GGUF 量化：如何把大象装进口袋

GGUF 是 llama.cpp 生态的标准格式。K-quant 系列使用混合精度——关键张量多分 bit，普通张量少分。

| 量化级别 | 位深 | ~大小（7B模型） | 困惑度增长 | 质量描述 |
|----------|------|----------------|-----------|----------|
| **Q2_K** | ~2-bit | ~2.6 GB | +0.87 ppl | 严重质量损失 |
| **Q3_K_M** | ~3-bit | ~3.3 GB | +0.25 ppl | 可接受的退化 |
| **Q4_K_M** | ~4-bit | ~3.8-4.5 GB | +0.05 ppl | **几乎无感损失** |
| **Q5_K_M** | ~5-bit | ~4.5-5.0 GB | +0.02 ppl | 优秀 |
| **Q8_0** | 8-bit | ~6.7-9.5 GB | +0.0004 ppl | 与 FP16 无法区分 |

**Q4_K_M 是移动端的黄金平衡点。** 各设备推荐：

| 设备 RAM | 推荐模型大小 | 推荐量化 | 磁盘占用 |
|----------|------------|---------|---------|
| 4 GB | 0.5B-1.5B | Q4_K_M 或 Q8_0 | 400 MB - 1.5 GB |
| 6 GB | 1.5B-3B | Q4_K_M | 1.5-2.5 GB |
| 8 GB | 3B-4B | Q4_K_M | 2-4 GB |
| 8 GB (max) | 7B | Q4_K_M | ~4-4.5 GB |

### 实测数据（骁龙 855, 6GB RAM, Termux + llama.cpp）

| 模型 | 量化 | 内存 | 1 线程 | 4 线程 |
|------|------|------|--------|--------|
| Qwen2.5-0.5B | Q5_K_M | 852 MB | 16.25 tok/s | 15.45 tok/s |
| Qwen2.5-1.5B | Q4_K_M | 1474 MB | 6.29 tok/s | ~13 tok/s |
| Qwen2.5-1.5B | Q3_K_M | 1290 MB | 7.60 tok/s | 13.81 tok/s |

注意：多线程对 1.5B+ 模型有帮助，但对极小模型反而有害（线程开销 > 收益）。

---

## 4. 各模型详细分析

### MiniCPM 4.0 / MiniCPM-V 4.0（OpenBMB / 面壁智能）

- **尺寸**：0.5B, 4B, 8B；有 vision 变体
- **关键优势**：专为手机打造。开源 iOS App，iPhone 16 Pro Max 首 token <2s，不发热
- **内存**：M4 上 3.33 GB（低于 Qwen2.5-VL-3B 和 Gemma 3-4B）
- **并发**：256 并发用户 13,856 tok/s 吞吐（2x Qwen/Gemma）
- **InfLLM v2**：稀疏注意力（5% 稀疏度），长文本提速 220x vs Qwen-3-8B
- **Vision (MiniCPM-V 4.0)**：4.1B 参数，OCRBench 894（beat GPT-4.1-mini at 840），发表在 Nature Communications

### Phi-4-mini（Microsoft）

- **尺寸**：3.8B（文本）；5.6B（多模态变体）
- **架构**：SambaY（Mamba + 滑动窗口注意力 + Gated Memory Units），10x 吞吐
- **关键优势**：同级最强推理。MATH >80%, GPQA 56%
- **限制**：3.8B 无 vision。主要在服务器硬件上 benchmark
- **适用场景**：数学辅导、代码助手、结构化推理

### Gemma 3（Google）

- **尺寸**：1B, 4B, 12B, 27B；270M 超轻量
- **关键优势**：Android/MediaPipe/LiteRT 原生集成，140+ 语言
- **270M 变体**：Pixel 9 Pro 上 25 次对话 <1% 电量
- **Gemma 3n**（2025 年 6 月）：MatFormer 嵌套架构，首个 <10B 模型 LMArena 1300+
- **关键限制：中文处理有已知问题**——中文提问可能回英文答案，胡编古诗词
- **Benchmark (4B)**：HellaSwag 77.2, BoolQ 72.3, ARC-e 82.4

### Llama 3.2（Meta）

- **尺寸**：1B, 3B（文本）；11B, 90B（vision）
- **关键优势**：最强 tool-calling 和结构化 JSON 输出，128K 上下文
- **S24 Ultra (int8, 3B)**：67.5 tok/s prefill, 7.7 tok/s decode
- **关键限制：原生中文弱**——中文 benchmark ~30-36%
- **中文微调版可用**：Breeze2 (MediaTek, 繁体), TaiPhone-1B

### DeepSeek-R1-Distill-Qwen-1.5B

- **尺寸**：1.5B（从 DeepSeek-R1 蒸馏）
- **关键优势**：继承大模型的 CoT 推理能力
- **速度**：高通 QCS8550 上 40+ tok/s，可跑 Intel NPU
- **适用场景**：推理密集型移动任务

---

## 5. 框架支持矩阵

| 模型 | llama.cpp | Ollama | MNN (阿里) | MediaPipe |
|------|-----------|--------|------------|-----------|
| Qwen 3 | ✅ | ✅ | ✅ | ❌ |
| MiniCPM 4 | ✅ | ✅ | ❌ | ❌ |
| Gemma 3 | ✅ | ✅ | ❌ | ✅ |
| Llama 3.2 | ✅ | ✅ | ❌ | ✅ |
| Phi-4-mini | ✅ | ✅ | ❌ | ❌ |

- **MNN**（阿里）：iOS/Android 上 Qwen 优化最佳，Arm + GPU/NPU 加速
- **llama.cpp**：最通用，社区支持最好，Termux 可跑 Android
- **MediaPipe/LiteRT**：Google 方案，Gemma 在 Android 上最优

---

## 6. 实践建议

### 分级部署策略

**第一级 — 始终在线（后台任务）**
- 模型：Qwen3-0.6B Q4_K_M (~600 MB)
- 用途：内容分类、关键词提取、通知摘要
- 设备：4GB+ RAM 即可
- 速度：中端机 10-16 tok/s

**第二级 — 交互式助手（前台）**
- 模型：Qwen3-4B-Instruct-2507 Q4_K_M (~4 GB) 或 Qwen3.5-0.8B (~550 MB)
- 用途：聊天、文档问答、内容整理
- 设备：8GB RAM 旗舰机，iPhone 15 Pro+
- 速度：25-32 tok/s

**第三级 — 降级 / 低端设备**
- 模型：Qwen3-1.7B Q4_K_M (~1.5 GB)
- 用途：所有第一级任务 + 基础聊天和摘要
- 设备：6GB+ RAM 中端机
- 速度：8-13 tok/s

### llama.cpp 移动端最优参数

```bash
./llama-cli \
  -m model-Q4_K_M.gguf \
  -t 4 \          # 4 线程（1.5B+ 的甜点）
  -c 2048 \       # 上下文（越低越省 RAM）
  -b 512 \        # batch size
  --mlock \       # 锁定模型在 RAM 中
  --no-mmap       # 某些 Android kernel 禁用内存映射
```

---

## 7. 关键结论

1. **Qwen3-4B-2507 是综合首选**：中英双语最佳，Apache 2.0，移动端 25-32 tok/s，256K 上下文
2. **Qwen3.5-0.8B 是移动端长上下文的突破**：256K 原生、550 MB、混合 DeltaNet 架构，内存友好
3. **Q4_K_M 是通用量化选择**：近乎无损质量，尺寸仅原来的 25%
4. **不要在中英双语场景中用 Gemma 3 或 Llama 3.2**：中文能力有已知缺陷
5. **llama.cpp + MNN 作为推理栈**：llama.cpp 通用兼容，MNN 专门优化 Qwen
6. 所有推荐模型都是 Apache 2.0 许可，商业使用安全
