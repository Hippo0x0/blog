---
categories: [LLM]
tags: [AI, iOS, Swift, llama.cpp, 多模态, GGUF, 实战]
---

# [AI] iOS 端 llama.cpp 多模态接入实战：跨越四层的图片理解之路

如果你在用 llama.cpp 的 Swift 封装做 iOS App，想给纯文本模型加上图片理解能力，这篇是给你的。本文记录了从底层 C++ 到上层 SwiftUI 的完整接入过程。

---

## 1. 问题

iOS 推理链路：

```
App
  -> LocalLLM (Swift Package)
    -> AnyLanguageModel (抽象层)
      -> LlamaLanguageModel (llama.cpp provider)
        -> llama.swift (C API 封装)
          -> llama.cpp XCFramework
```

`LanguageModelSession.respond(to:images:)` 上层 API 已经支持把图片写入 transcript 的 `.image` segment，但 `LlamaLanguageModel` 在遇到图片时直接抛 `unsupportedFeature`。而 `mmproj-F16.gguf` 已经放进 Xcode resources，只是没有路径传进去。

结论：不能只改上层，需要同时打通 **llama.cpp → llama.swift → AnyLanguageModel → App** 四层。

---

## 2. 接入策略：四个 PR 串联

| 仓库 | PR | 作用 |
|------|----|------|
| `llama.cpp` | [PR #1](https://github.com/Hippo0x0/llama.cpp/pull/1) | 构建带 `mtmd` 的 Apple XCFramework |
| `llama.swift` | [PR #1](https://github.com/Hippo0x0/llama.swift/pull/1) | binary target 指向 mtmd-enabled XCFramework |
| `AnyLanguageModel` | [PR #1](https://github.com/Hippo0x0/AnyLanguageModel/pull/1) | `LlamaLanguageModel` 支持 `mmprojPath` 和 image prompt |
| `copytain` | [PR #1](https://github.com/Hippo0x0/copytain/pull/1) | iOS 端加载 `mmproj-F16.gguf` 并通过新的 image analysis API 调用 |

Release asset: [llama-mtmd-ios-macos-xcframework.zip](https://github.com/Hippo0x0/llama.cpp/releases/tag/llama-mtmd-ios-macos-20260515)

---

## 3. llama.cpp 层：构建 mtmd-enabled XCFramework

`build-xcframework.sh` 的关键变化：

- `LLAMA_BUILD_TOOLS=ON`，让 `tools/mtmd` 被构建
- module map 暴露 `mtmd.h` 和 `mtmd-helper.h`
- 动态库合并时加入 `tools/mtmd/.../libmtmd.a`
- 链接参数增加 `CoreML` framework

验证过的符号：

```
mtmd_init_from_file
mtmd_tokenize
mtmd_helper_eval_chunks
mtmd_helper_bitmap_init_from_buf
```

注意：一开始尝试把 `libllama-common.a` 也合入，但会引入 `httplib` 相关未解析符号。`mtmd-helper.h` 所需 helper 已在 `libmtmd.a` 内，最终只合入 `libmtmd.a`。

---

## 4. llama.swift 层：指向新 XCFramework

`Package.swift` 的 `llama-cpp` binary target 改为指向 release asset：

```swift
.binaryTarget(
    name: "llama-cpp",
    url: "https://github.com/Hippo0x0/llama.cpp/releases/download/"
        + "llama-mtmd-ios-macos-20260515/llama-mtmd-ios-macos-xcframework.zip",
    checksum: "c5e35f4d08c016c02454c8092958e79a15466e9bddc915fc2295d8aaed406a26"
)
```

`Sources/LlamaSwift/Llama.swift` 保持不变：

```swift
@_exported @preconcurrency import llama
```

这样 `AnyLanguageModel` 只需 `import LlamaSwift`，就能访问 `llama.h` 和 `mtmd.h` 的所有 C API。

---

## 5. AnyLanguageModel 层：核心逻辑

`LlamaLanguageModel` 的变化：

**新增初始化参数**：

```swift
LlamaLanguageModel(modelPath: textModelPath, mmprojPath: mmprojPath)
```

**新增 CustomGenerationOptions**：
- `mmprojPath`
- `mediaMarker`
- `imageMinTokens` / `imageMaxTokens`
- `mmprojUseGPU`

**删除旧的图片拒绝逻辑**：

```swift
// 删除了这一行
validateNoImageSegments(in:)
```

**新增多模态路径**：

```
Transcript.ImageSegment
  -> insert <__media__>
  -> mtmd_helper_bitmap_init_from_buf / file
  -> mtmd_tokenize
  -> mtmd_helper_eval_chunks
  -> existing sampler loop
```

关键行为：
- 没有图片时，保留原 text-only `generateText` / `generateTextStream` 路径
- 有图片但没有 `mmprojPath` 时，提前抛 `missingMultimodalProjector`
- `.image(.data)` 直接走 `mtmd_helper_bitmap_init_from_buf`，避免应用层额外落盘
- `.image(.url)` 当前只支持本地 file URL

---

## 6. App 层：接入调用

**ModelManager**：
- 继续解析 `Qwen3.5-0.8B-Q4_K_M.gguf`
- 新增解析 `mmproj-F16.gguf`
- 加载模型时传入 projector 路径

**InferenceEngine**：
- `loadModel(path:mmprojPath:)` 创建 `LlamaLanguageModel(modelPath:mmprojPath:)`
- 新增 `analyzeImage(url:prompt:)` API

这一步只打通模型调用能力。后续内容库可以把图片抽取从占位字符串升级为真实的 VLM 描述。

---

## 7. 验证结果

```bash
# 单元测试（配置测试）
swift test --traits Llama --filter LlamaLanguageModelMultimodalConfigurationTests
# 结果：4/4 通过

# 运行时测试（真实 gguf + mmproj + image）
LLAMA_MODEL_PATH=".../Qwen3.5-0.8B-Q4_K_M.gguf" \
LLAMA_MMPROJ_PATH=".../mmproj-F16.gguf" \
swift test --traits Llama --filter LlamaLanguageModelMultimodalRuntimeTests
# 结果：通过，确认不再走 unsupportedFeature

# Swift Package 构建
cd ios/LocalLLM && swift build
# 结果：通过

# Xcode 构建
xcodebuild -workspace Copytain.xcworkspace \
  -scheme Copytain \
  -destination 'generic/platform=iOS Simulator' \
  CODE_SIGNING_ALLOWED=NO build
# 结果：通过
```

---

## 8. 后续工作和风险

**待完善**：
1. 内容库图片抽取——`TextExtractionService` 的 `.image` 分支目前仍返回 `[Image: title]`，之后应改为调用 VLM 生成描述/OCR 文本
2. 视频输入——`mtmd` 当前不是一等视频输入，推荐先用 `AVAssetImageGenerator` 抽关键帧再复用 image path
3. Session/context 复用——当前每次请求重建 `llama_context`，图片首响偏慢

**稳定性风险**：
- `mtmd` 仍是实验 API，llama.cpp 升级可能需要同步调用签名
- MiniCPM-V 4.6 运行时内存明显高于 text-only Qwen3.5 0.8B，低内存设备需要策略降级

---

## 9. 结论

这次接入证明：保留 `LanguageModelSession` 抽象是可行的。图片输入不需要在 App 层另起 ObjC++ bridge，而是可以作为 `LlamaLanguageModel` provider 能力下沉到 `AnyLanguageModel`，上层继续使用统一的：

```swift
session.respond(to: prompt, image: imageSegment, options: options)
```

这样后续如果切换 MLX / Ollama / 云模型，业务层不需要重写多模态调用入口。
