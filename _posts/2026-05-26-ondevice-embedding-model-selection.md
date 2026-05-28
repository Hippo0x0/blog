---
categories: [LLM]
tags: [AI, Embedding, RAG, 端侧AI, 模型选型, Qwen, BGE, 向量检索]
---

# [AI] 端侧 Embedding 模型选型：让手机本地跑 RAG

要在手机上做本地 RAG（检索增强生成），Embedding 模型是核心组件。它把文本转成向量，存入本地向量库，查询时找最相似的内容喂给 LLM。本文整理了 2026 年适合移动端部署的 Embedding 模型，覆盖 Qwen3-Embedding / BGE-M3 / EmbeddingGemma 等主流选项。

---

## 1. 一句话推荐

| 模型 | 参数量 | 维度 | 上下文 | MTEB | 量化后大小 | 最佳场景 |
|------|--------|------|--------|------|-----------|----------|
| **Qwen3-Embedding-0.6B** | 596M | 32-1024 (MRL) | 32K | 64.33 | ~640 MB (Q8_0) | 移动端最佳平衡 |
| **Qwen3-Embedding-4B** | 4B | 32-2560 (MRL) | 32K | 69.45 | ~2.5 GB (Q4_K_M) | 端侧最高质量 |
| **BGE-M3** (BAAI) | 568M | 1024 | 8K | 59.56 | ~1.2 GB | 最成熟的生态 |
| **EmbeddingGemma** (Google) | 300M | 768 (MRL→128) | 2K | <500M 中最佳 | ~200 MB | 超轻量移动端 |

---

## 2. Qwen3-Embedding（阿里，2025 年 6 月）——首选

从 Qwen3 基座模型微调而来，继承了 LLM 的 32K 上下文能力和指令跟随能力（写 prompt 指定嵌入方向，准确率可从 72% 拉升至 89%）。

**MRL（Matryoshka Representation Learning）**是核心特性：存储时用全维度（最高质量），检索时可按需截断到更低维度（更快）——质量损失约 1%。

**GGUF 大小**：

| 模型 | F16 | Q8_0 | Q6_K | Q4_K_M | Q3_K_M |
|------|-----|------|------|--------|--------|
| 0.6B | 1.2 GB | 639 MB | 472 MB | — | 331 MB |
| 4B | 7.5 GB | 4.0 GB | 3.1 GB | 2.5 GB | 1.9 GB |

**MTEB 多语言分数（2025 年 5 月）**：

| 模型 | MTEB Mean |
|------|-----------|
| Qwen3-Embedding-8B | 70.58（发布时开源第一） |
| Qwen3-Embedding-4B | 69.45 |
| **Qwen3-Embedding-0.6B** | **64.33** |
| multilingual-e5-large-instruct | 63.22 |
| GTE-Qwen2-7B-Instruct | 62.51 |
| BGE-M3 | 59.56 |

0.6B 模型在 MTEB 上已经超过了大部分上一代的大模型，性价比极高。

---

## 3. BGE-M3（BAAI）——最成熟的备选

568M 参数，1024 维输出，BGE-M3 是目前生态最完善的 multilingual embedding 模型。

**核心能力**：
- **Dense + Sparse + ColBERT**：一个模型支持三种检索模式
- **100+ 语言**：多语言支持优秀，中文 5/5 星
- **跨语言 R@1: 0.940**——远超 mxbai（0.120）和 nomic（0.154）
- **MIT 许可证**：最宽松

**限制**：
- **8K 上下文上限**——更长文档会退化，Needle-in-haystack 在 8K 降到 0.920
- **不支持指令嵌入**：无法通过 prompt 适配领域
- **固定 1024 维**：无 MRL，无法优化存储
- **MTEB 59.56**：低于 Qwen3-Embedding-0.6B (64.33)

如果要一个经过大规模验证、生态成熟的方案，BGE-M3 是最安全的选择。

---

## 4. EmbeddingGemma（Google, 2025）——最轻量

300M 参数，768 维输出，支持 MRL 截断到 512/256/128。

**关键特点**：
- **~200 MB** 量化后——任意手机都能跑
- **2K 上下文**——大部分文档 chunk 够用
- **100+ 语言**
- **<500M 参数中 MTEB 排名第一**

**限制**：
- 需要任务专用 prompt 模板：文档用 `"title: none | text:"`，查询用 `"task: search result | query:"`
- 2K 上下文较长文档受限
- 社区规模不如 BGE-M3

最适合极致低资源的移动端部署场景——每 MB 都要珍惜。

---

## 5. 其他值得注意的模型

| 模型 | 参数量 | 维度 | 上下文 | 备注 |
|------|--------|------|--------|------|
| **all-MiniLM-L6-v2** | 22M | 384 | 256 tokens | 最小选项 (~45 MB)，仅英文，极快 |
| **multilingual-e5-large** | 560M | 1024 | 512 | 多语言强，MTEB 63.22 |
| **GTE-large-zh** (阿里) | 326M | 1024 | 512 | 中文优化，CPU 极快 |
| **m3e-base** (MokaAI) | 110M | 768 | 512 | 中文语义好，轻量 |
| **mxbai-embed-large** | 335M | 1024 | 512 | 英文好，多语言差 (R@1: 0.120) |
| **nomic-embed-text** | 137M | 768 | 8192 | 长上下文好，多语言差 (R@1: 0.154) |

**避坑提示**：mxbai-embed 和 nomic-embed 在英文 MTEB 上表现不错，但中文和跨语言表现极差。做中英双语 RAG 不要用。

---

## 6. 两阶段检索 Pipeline

仅靠 embedding 检索的准确率有限。推荐搭配 reranker 做两阶段检索：

```
文档 → 分块 → Embedding (0.6B, 快速) → 向量库
                                            ↓
查询 → Embedding (同模型) → 向量搜索 (top-50) → Reranker (4B, 精确) → top-5 → LLM
```

- **第一阶段（Embedding，0.6B）**：快速初筛，对所有新内容持续运行
- **第二阶段（Reranker，4B）**：Cross-encoder 精排，只在查询时运行
- **效果**：相关性从 63% 提升到 89%，额外延迟很小

搭配 Qwen3-Reranker-4B 的效果最理想（同体系，指令风格一致）。

### 中英检索质量数据

**中文长文档检索（NDCG@10）**：

| 模型 | NDCG@10 |
|------|---------|
| Qwen3-Embedding-4B | 0.782 |
| BGE-M3 | 0.715 |
| text-embedding-3-small (API) | 0.641 |

**代码语义相似度（NDCG@10）**：

| 模型 | NDCG@10 |
|------|---------|
| Qwen3-Embedding-4B | 0.863 |
| BGE-M3 | 0.742 |
| nomic-embed-text | 0.658 |

---

## 7. 各设备部署建议

| 设备 RAM | 推荐模型 | 量化 | 磁盘占用 | 维度 |
|----------|---------|------|---------|------|
| 4 GB | EmbeddingGemma-300M | INT8 | ~200 MB | 768 (MRL→256) |
| 4 GB | Qwen3-Embedding-0.6B | Q8_0 | ~640 MB | 1024 (MRL→512) |
| 4 GB (超轻) | all-MiniLM-L6-v2 | FP32 | ~45 MB | 384 |
| 6 GB | Qwen3-Embedding-0.6B | F16 | ~1.2 GB | 1024 |
| 6 GB | BGE-M3 | FP32 | ~1.2 GB | 1024 |
| 8 GB | Qwen3-Embedding-4B | Q4_K_M | ~2.5 GB | 2560 (MRL→1024) |
| 8 GB | BGE-M3 + Qwen3-Reranker-4B | Mixed | ~3.7 GB | 1024 + reranker |

---

## 8. Ollama 快速启动

```bash
# Embedding 模型
ollama pull qwen3-embedding:0.6b-q8_0   # 639 MB

# Reranker（两阶段检索用）
ollama pull qwen3-reranker:4b            # ~2.5 GB (Q4_K_M)
```

---

## 9. 关键结论

1. **Qwen3-Embedding-0.6B 是移动端 RAG 首选**：640 MB (Q8_0)，MTEB 64.33（超越上一代大模型），32K 上下文，指令感知，Apache 2.0
2. **搭配 Qwen3-Reranker-4B 做两阶段检索**：embedding 负责召回，reranker 负责精度（63% → 89%）
3. **BGE-M3 是最安全的备选**：生态成熟，MIT 许可，多语言出色，但 8K 上下文封顶且 MTEB 较低
4. **利用 MRL 降维优化存储**：全维度存储，检索时按需截断
5. **不要在中英双语场景用 mxbai-embed 或 nomic-embed**：跨语言性能接近零
6. **极致轻量场景用 EmbeddingGemma-300M (~200 MB)**，多语言表现扎实
