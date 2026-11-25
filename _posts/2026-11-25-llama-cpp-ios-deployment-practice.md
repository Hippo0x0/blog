---
title: "浅谈：Llama.cpp 端侧模型部署实践 iOS"
date: 2026-11-25 10:30:00 +0800
categories: [LLM]
tags: [iOS, Swift, llama.cpp, GGUF, Metal, 端侧AI, Qwen, Gemma]
description: "从端侧模型发展、Qwen 与 Gemma 选型，到 llama.cpp、Metal、GGUF 量化、工具调用、多模态和 iOS 内存问题的实践记录。"
---

[飞书原文](https://xr2hd33jjg.feishu.cn/docx/NkhQdqehPo5gPUxVtA5ctoFcnPb)

<style>
.feishu-table { max-width: 100%; overflow-x: auto; margin: 1.5rem 0; }
.feishu-table table { width: max-content; min-width: 100%; max-width: none; margin: 0; }
.feishu-table td { min-width: 7rem; max-width: 26rem; white-space: normal; vertical-align: top; }
.feishu-table img { max-width: 22rem; height: auto; }
@media(max-width:600px) { .feishu-table td { min-width: 6rem; max-width: 18rem; } .feishu-table img { max-width: 15rem; } }
</style>

## 分享内容

1. 大致了解模型的端侧部署的历史

1. 大致了解Llama.cpp这个框架

1. 大致了解iOS端侧部署的当前情况

## 业界发展

从2020年开始关注端侧模型部署的情况

当时主要是：轻量化的模型设计，模型蒸馏、模型剪枝、量化部署技术。

1. 轻量化的模型设计：使用深度可分离卷积、1x1卷积、分组卷积等方式，使得推理更快，更适合端侧推理。

1. 模型蒸馏技术：从大的teacher模型获得一个小规模的适合移动端部署的student模型，使得模型在小的基础上尽可能保持精度。

1. 模型剪枝技术：把模型参数中贡献少的删除掉，然后通过微调恢复模型精度。

1. 量化部署：使用int8、int4等更低精度更少计算量的模型权重进行模型推理，使得推理更高效。

总体来说，模型推理上，即便是在数据中心运行，也需要保持低的推理成本，同时维持尽可能高的模型精度。

对于移动端、摄像头、无人机等端侧设备，模型需要在已有前沿模型的基础上继续处理，以适配端侧的真实需求。

在2020年主要的端侧部署的需求为：

<div class="feishu-table" role="region" aria-label="对比表，可横向滚动" tabindex="0"><table>
<tr><td><strong>领域</strong></td><td><strong>神经网络的主要应用</strong></td><td><strong>2020 年典型端侧部署场景</strong></td></tr>
<tr><td>计算机视觉</td><td>图像分类、目标检测、人脸识别、OCR、图像分割、视频分析</td><td>手机拍照增强、人脸解锁、相册分类；摄像头行人/车辆检测；工业相机缺陷检测</td></tr>
<tr><td>语音</td><td>语音识别、语音合成、声纹识别、降噪</td><td>智能音箱唤醒词、手机语音助手、耳机降噪、离线语音命令</td></tr>
<tr><td>自然语言处理</td><td>机器翻译、文本分类、搜索、推荐、问答</td><td>输入法预测、垃圾短信识别、简单离线翻译；大型语言模型基本仍运行在云端</td></tr>
<tr><td>推荐与广告</td><td>商品、视频、新闻和广告推荐</td><td>少量轻量级用户偏好预测；完整推荐系统通常仍部署在云端</td></tr>
<tr><td>自动驾驶与交通</td><td>车辆、行人和车道线识别，驾驶决策</td><td>车载摄像头、ADAS、自动驾驶感知，需要毫秒级本地推理</td></tr>
<tr><td>安防</td><td>人脸识别、行为检测、异常检测</td><td>智能摄像头、门禁、考勤机，在设备或边缘网关上处理视频</td></tr>
<tr><td>工业制造</td><td>缺陷检测、预测性维护、机器人控制</td><td>工业相机、机械臂和工厂网关，要求低时延和断网可用</td></tr>
<tr><td>医疗</td><td>医学影像分析、辅助诊断、生命体征预测</td><td>便携医疗设备、可穿戴设备；复杂诊断模型主要仍在服务器运行</td></tr>
<tr><td>金融</td><td>风控、反欺诈、信用评估、量化分析</td><td>手机端活体检测、人脸核身；核心风控通常在云端</td></tr>
<tr><td>游戏与内容创作</td><td>NPC、图像处理、动作识别、内容生成</td><td>手机游戏 AI、美颜、滤镜、人体姿态和 AR 特效</td></tr>
<tr><td>智能家居与物联网</td><td>环境感知、设备控制、异常检测</td><td>智能门锁、家电、音箱、传感器和微控制器上的 TinyML</td></tr>
<tr><td>农业与零售</td><td>病虫害识别、商品识别、客流分析</td><td>无人机、手持设备、智能货架、无人收银设备</td></tr>
</table></div>

2020年还是CV领域大火的时候，当时的计算机视觉四小龙主要做人脸识别，开发AISDK给各个厂商、App使用。主要是图像识别、图像分割、图像分类任务。

比如：

1. 人脸识别：同一个人脸不同时间出现在不同的摄像头，识别出来是录入过的人。YoloV5、FastRCNN之类的。

1. 医疗图像分割和识别：医疗CT图片分割出来病变区域，分割后判别是什么病，给出概率。UNet之类的。

<div class="feishu-table" role="region" aria-label="对比表，可横向滚动" tabindex="0"><table>
<tr><td>公司</td><td>成立时间</td><td>2020 年前后的主要方向</td></tr>
<tr><td><strong>商汤科技（SenseTime）</strong></td><td>2014</td><td>人脸与图像识别、智慧城市、安防、手机视觉、自动驾驶</td></tr>
<tr><td><strong>旷视科技（Megvii）</strong></td><td>2011</td><td>Face++、人脸识别、城市物联网、物流机器人、供应链视觉</td></tr>
<tr><td><strong>云从科技（CloudWalk）</strong></td><td>2015</td><td>人脸识别、智慧金融、机场安检、智慧城市、人机协同操作系统</td></tr>
<tr><td><strong>依图科技（YITU）</strong></td><td>2012</td><td>安防视觉、医疗影像、城市治理、AI 芯片及服务器</td></tr>
</table></div>

## 主要的模型架构变化（2015 - 2025）

神经网络研究领域的重心这几年发生过几次变化，从最开始的统计概率学模型解决CV、NLP问题，到AlexNet、ResNet的神经网络在CV领域大展拳脚，再到Transformer架构在NLP领域几乎超越所有方法并在CV领域也得到应用， 到如今LLM统一视觉、语言、语音多种模态，变化一直在发生，主干网络也一直在变迁，主要paper可以看如下的表格。

2020年那个时候，训练一个10M(千万)参数的模型部署到手机上已经是很前沿的工作了，毕竟当时最大的模型也就是几百M(亿)参数量，连1B（10亿）都不会到，现在2026年已经是300B（3000亿）～1T（1万亿）参数规模的模型了。

<div class="feishu-table" role="region" aria-label="对比表，可横向滚动" tabindex="0"><table>
<tr><td><strong>时间</strong></td><td><strong>模型 / 论文</strong></td><td><strong>领域</strong></td><td><strong>主要 idea</strong></td><td><strong>代表参数量</strong></td><td><strong>常见推理框架</strong></td></tr>
<tr><td>2015.12</td><td><a href="https://arxiv.org/abs/1512.03385">ResNet</a></td><td>视觉 CNN</td><td>残差连接 F(x)+x，解决深层网络退化问题</td><td>R18 11.7M；R50 25.6M</td><td>几乎所有推理框架</td></tr>
<tr><td>2017.04</td><td><a href="https://arxiv.org/abs/1704.04861">MobileNetV1</a> ⭐</td><td>轻量 CNN</td><td>深度可分离卷积；使用宽度和分辨率倍率调节模型</td><td>4.2M</td><td>TFLite、Core ML、NNAPI、NCNN</td></tr>
<tr><td>2017.06</td><td><a href="https://arxiv.org/abs/1706.03762">Transformer</a></td><td>基础架构</td><td>多头自注意力和位置编码，移除 RNN/CNN 序列结构</td><td>Base 约 65M</td><td>PyTorch、TF、HF、ONNX</td></tr>
<tr><td>2018.01</td><td><a href="https://arxiv.org/abs/1801.04381">MobileNetV2</a> ⭐</td><td>轻量 CNN</td><td>倒残差、线性瓶颈、深度可分离卷积</td><td>3.5M</td><td>TFLite、Core ML、NNAPI、NCNN</td></tr>
<tr><td>2018.06</td><td><a href="https://cdn.openai.com/research-covers/language-unsupervised/language_understanding_paper.pdf">GPT-1</a></td><td>NLP</td><td>Decoder-only Transformer；生成式预训练后进行任务微调</td><td>117M</td><td>TF、HF Transformers、ONNX</td></tr>
<tr><td>2018.1</td><td><a href="https://arxiv.org/abs/1810.04805">BERT</a></td><td>NLP</td><td>Encoder-only；双向 Masked Language Model</td><td>Base 110M；Large 340M</td><td>HF、ONNX Runtime、OpenVINO</td></tr>
<tr><td>2019.02</td><td><a href="https://cdn.openai.com/better-language-models/language_models_are_unsupervised_multitask_learners.pdf">GPT-2</a></td><td>NLP</td><td>扩大 Decoder-only 模型，展示零样本任务能力</td><td>117M～1.5B</td><td>HF、ONNX、TensorRT</td></tr>
<tr><td>2019.1</td><td><a href="https://arxiv.org/abs/1910.01108">DistilBERT</a> ⭐</td><td>轻量 NLP</td><td>在预训练阶段蒸馏 BERT，减少层数</td><td>66M</td><td>HF、ONNX、OpenVINO、TFLite</td></tr>
<tr><td>2019.05</td><td><a href="https://arxiv.org/abs/1905.11946">EfficientNet</a> ⭐</td><td>高效 CNN</td><td>同时缩放网络深度、宽度和输入分辨率</td><td>B0 5.3M；B7 66M</td><td>TFLite、ONNX、TensorRT</td></tr>
<tr><td>2020.1</td><td><a href="https://arxiv.org/abs/2010.11929">ViT</a></td><td>视觉 Transformer</td><td>将图像切成 patch，当作 token 输入纯 Transformer</td><td>B/16 86M；L/16 307M</td><td>timm、HF、JAX、TensorRT</td></tr>
<tr><td>2022.06</td><td><a href="https://arxiv.org/abs/2206.01191">EfficientFormer</a> ⭐</td><td>轻量 ViT</td><td>移除移动硬件不友好的算子，按实测延迟搜索模型</td><td>L1 12.3M</td><td>Core ML、ONNX、TensorRT</td></tr>
<tr><td>2020.04</td><td><a href="https://arxiv.org/abs/2004.02984">MobileBERT</a> ⭐</td><td>端侧 NLP</td><td>深而窄的网络、瓶颈结构、逐层蒸馏</td><td>25.3M</td><td>TFLite、NNAPI、ONNX</td></tr>
<tr><td>2020.05</td><td><a href="https://arxiv.org/abs/2005.14165">GPT-3</a></td><td>大语言模型</td><td>通过大规模预训练产生零样本、少样本和上下文学习能力</td><td>125M～175B</td><td>权重不公开；OpenAI API</td></tr>
<tr><td>2022.08</td><td>Stable Diffusion 1.x（<a href="https://arxiv.org/abs/2112.10752">LDM 论文</a>）</td><td>文生图</td><td>CLIP 文本条件 + latent U-Net + VAE</td><td>U-Net 860M；完整约 1.07B</td><td>Diffusers、ComfyUI、TensorRT</td></tr>
<tr><td>2022.11</td><td>Stable Diffusion 2.x</td><td>文生图</td><td>使用 OpenCLIP 文本编码器，提高训练和生成分辨率</td><td>完整约 1.3B</td><td>Diffusers、ComfyUI、TensorRT</td></tr>
<tr><td>2023.03</td><td><a href="https://arxiv.org/abs/2303.08774">GPT-4</a></td><td>多模态大模型</td><td>支持图像输入；使用规模预测和 RLHF，架构未公开</td><td><strong>未公开</strong></td><td>OpenAI API / ChatGPT</td></tr>
<tr><td>2023.11</td><td><a href="https://arxiv.org/abs/2401.14196">DeepSeek-Coder</a></td><td>代码大模型</td><td>以代码为主、自然语言为辅进行预训练；支持 Fill-in-the-Middle 代码补全</td><td>1.3B、5.7B、6.7B、33B</td><td>HF Transformers、vLLM、llama.cpp、ONNX</td></tr>
<tr><td>2024.05</td><td><a href="https://openai.com/index/gpt-4o-system-card/">GPT-4o</a></td><td>原生多模态模型</td><td>单一端到端模型统一处理文本、图像、视频和音频</td><td><strong>未公开</strong></td><td>OpenAI API / ChatGPT</td></tr>
<tr><td>2024.05</td><td><a href="https://arxiv.org/abs/2405.04434">DeepSeek-V2</a> ⭐</td><td>高效 MoE 大模型</td><td>DeepSeekMoE 稀疏专家架构；MLA 压缩 KV Cache，降低长上下文推理成本</td><td>236B 总参数 / 21B 激活；Lite：16B / 2.4B 激活</td><td>HF、vLLM、SGLang、TensorRT-LLM</td></tr>
<tr><td>2024.12</td><td><a href="https://arxiv.org/abs/2412.19437">DeepSeek-V3</a> ⭐</td><td>高效 MoE 大模型</td><td>MLA + DeepSeekMoE；无辅助损失负载均衡；Multi-Token Prediction；FP8 训练</td><td><strong>671B 总参数 / 37B 激活</strong></td><td>HF、vLLM、SGLang、TensorRT-LLM</td></tr>
<tr><td>2025.01</td><td><a href="https://arxiv.org/abs/2501.12948">DeepSeek-R1</a></td><td>推理模型</td><td>使用大规模强化学习激发长链推理；R1 加入冷启动数据和多阶段训练</td><td><strong>671B / 37B 激活</strong></td><td>HF、vLLM、SGLang</td></tr>
</table></div>

CV/NLP领域模型的主干网络变化：

1. 最早是统计概率学模型高斯混合模型(GMM)、LDA、决策树、多层感知机MLP、蒙特卡罗链方法，特别是支持向量机(SVM)，几乎用在所有任务上。

1. 在LeNet、AlexNet出现后，解决了神经网络的规模化训练问题，解决简单的图像分类问题。

1. 在ResNet出现后，解决深度神经网络的训练问题，解决图像分类、图像识别等问题。

1. 在Attention is All You Need之后，较大程度解决长序列依赖问题，并且模型大部分计算能够并行执行。解决机器翻译问题。

1. 在GPT系列模型，证明了生成式预训练 + 下游微调路线能够解决大部分下游NLP任务：翻译、对话、总结、情感分类等等。

1. 现代LLM通过更大规模的预训练，加上监督微调、偏好对齐、推理强化训练、安全与工具使用训练，使得模型在各个场景变得真实可用。

{% raw %}
```text
VGG
 ↓
ResNet ─────────────→ Faster R-CNN / FPN / RetinaNet
 ↓
SqueezeNet → MobileNet → ShuffleNet → EfficientNet → MobileNetV3
                                                       ↓
Transformer → BERT → DistilBERT / TinyBERT / MobileBERT
      │
      ├── GPT-1 → GPT-2 → GPT-3 → InstructGPT → GPT-4 → GPT-4o
      │
      └── ViT → DeiT / Swin → MobileViT / TinyViT / EfficientFormer
                     │
                     └── CLIP → BLIP / BLIP-2 / MobileCLIP
                            │
DDPM → Latent Diffusion ───┴→ Stable Diffusion → SDXL
                                             └→ LCM / SD-Turbo
```
{% endraw %}

### 大表格

<div class="feishu-table" role="region" aria-label="对比表，可横向滚动" tabindex="0"><table>
<tr><td><strong>时间</strong></td><td><strong>模型 / 论文</strong></td><td><strong>领域</strong></td><td><strong>主要 idea</strong></td><td><strong>代表参数量</strong></td><td><strong>常见推理框架</strong></td></tr>
<tr><td>2014</td><td><a href="https://arxiv.org/abs/1409.1556">VGG-16</a></td><td>视觉 CNN</td><td>重复堆叠 3×3 卷积，通过加深网络提升特征表达</td><td>138M</td><td>PyTorch、TF、ONNX、TensorRT</td></tr>
<tr><td>2015.04</td><td><a href="https://arxiv.org/abs/1504.08083">Fast R-CNN</a></td><td>目标检测</td><td>整图只提取一次特征，使用 RoI Pooling 完成分类和框回归</td><td>约 134M（VGG-16）</td><td>torchvision、Detectron2、OpenVINO</td></tr>
<tr><td>2015.06</td><td><a href="https://arxiv.org/abs/1506.01497">Faster R-CNN</a></td><td>目标检测</td><td>使用 RPN 生成候选框，形成经典两阶段检测器</td><td>约 42M（R50-FPN）</td><td>torchvision、Detectron2、MMDetection、TensorRT</td></tr>
<tr><td>2015.06</td><td><a href="https://arxiv.org/abs/1506.02640">YOLOv1</a></td><td>目标检测</td><td>把检测变成一次密集回归，开启实时单阶段检测路线</td><td>约 45M</td><td>Darknet、Ultralytics、ONNX、TensorRT</td></tr>
<tr><td>2015.12</td><td><a href="https://arxiv.org/abs/1512.03385">ResNet</a></td><td>视觉 CNN</td><td>残差连接 F(x)+x，解决深层网络退化问题</td><td>R18 11.7M；R50 25.6M</td><td>几乎所有推理框架</td></tr>
<tr><td>2015.12</td><td><a href="https://arxiv.org/abs/1512.02325">SSD</a></td><td>目标检测</td><td>在多尺度特征图上直接预测类别和边界框</td><td>SSD300 约 35.6M</td><td>OpenCV DNN、TFLite、TensorRT</td></tr>
<tr><td>2016.02</td><td><a href="https://arxiv.org/abs/1602.07360">SqueezeNet</a> ⭐</td><td>轻量 CNN</td><td>Fire Module 用 1×1 卷积压缩通道，显著减少参数</td><td>1.24M</td><td>TFLite、Core ML、ONNX、NCNN</td></tr>
<tr><td>2016.12</td><td><a href="https://arxiv.org/abs/1612.03144">FPN</a></td><td>目标检测</td><td>自顶向下融合多尺度特征，改善小目标检测</td><td>随 backbone 变化</td><td>Detectron2、MMDetection、TensorRT</td></tr>
<tr><td>2017.04</td><td><a href="https://arxiv.org/abs/1704.04861">MobileNetV1</a> ⭐</td><td>轻量 CNN</td><td>深度可分离卷积；使用宽度和分辨率倍率调节模型</td><td>4.2M</td><td>TFLite、Core ML、NNAPI、NCNN</td></tr>
<tr><td>2017.06</td><td><a href="https://arxiv.org/abs/1706.03762">Transformer</a></td><td>基础架构</td><td>多头自注意力和位置编码，移除 RNN/CNN 序列结构</td><td>Base 约 65M</td><td>PyTorch、TF、HF、ONNX</td></tr>
<tr><td>2017.07</td><td><a href="https://arxiv.org/abs/1707.01083">ShuffleNetV1</a> ⭐</td><td>轻量 CNN</td><td>分组卷积配合 Channel Shuffle，实现通道间信息交换</td><td>约 1.8M</td><td>NCNN、MNN、TFLite</td></tr>
<tr><td>2017.08</td><td><a href="https://arxiv.org/abs/1708.02002">RetinaNet</a></td><td>目标检测</td><td>Focal Loss 缓解前景、背景类别不均衡</td><td>约 34M（R50-FPN）</td><td>Detectron2、TensorRT</td></tr>
<tr><td>2018.01</td><td><a href="https://arxiv.org/abs/1801.04381">MobileNetV2</a> ⭐</td><td>轻量 CNN</td><td>倒残差、线性瓶颈、深度可分离卷积</td><td>3.5M</td><td>TFLite、Core ML、NNAPI、NCNN</td></tr>
<tr><td>2018.06</td><td><a href="https://cdn.openai.com/research-covers/language-unsupervised/language_understanding_paper.pdf">GPT-1</a></td><td>NLP</td><td>Decoder-only Transformer；生成式预训练后进行任务微调</td><td>117M</td><td>TF、HF Transformers、ONNX</td></tr>
<tr><td>2018.07</td><td><a href="https://arxiv.org/abs/1807.11164">ShuffleNetV2</a> ⭐</td><td>轻量 CNN</td><td>从真实设备延迟出发设计通道切分与 Shuffle</td><td>2.3M（1.0×）</td><td>NCNN、MNN、TFLite、TensorRT</td></tr>
<tr><td>2018.1</td><td><a href="https://arxiv.org/abs/1810.04805">BERT</a></td><td>NLP</td><td>Encoder-only；双向 Masked Language Model</td><td>Base 110M；Large 340M</td><td>HF、ONNX Runtime、OpenVINO</td></tr>
<tr><td>2019.02</td><td><a href="https://cdn.openai.com/better-language-models/language_models_are_unsupervised_multitask_learners.pdf">GPT-2</a></td><td>NLP</td><td>扩大 Decoder-only 模型，展示零样本任务能力</td><td>117M～1.5B</td><td>HF、ONNX、TensorRT</td></tr>
<tr><td>2019.05</td><td><a href="https://arxiv.org/abs/1905.02244">MobileNetV3</a> ⭐</td><td>轻量 CNN</td><td>NAS、SE、h-swish，直接针对手机延迟优化</td><td>Small 2.5M；Large 5.4M</td><td>TFLite、Core ML、NNAPI</td></tr>
<tr><td>2019.05</td><td><a href="https://arxiv.org/abs/1905.11946">EfficientNet</a> ⭐</td><td>高效 CNN</td><td>同时缩放网络深度、宽度和输入分辨率</td><td>B0 5.3M；B7 66M</td><td>TFLite、ONNX、TensorRT</td></tr>
<tr><td>2019.09</td><td><a href="https://arxiv.org/abs/1909.10351">TinyBERT</a> ⭐</td><td>轻量 NLP</td><td>蒸馏 embedding、隐藏层和 attention；两阶段蒸馏</td><td>4层约 14.5M</td><td>HF、ONNX、OpenVINO</td></tr>
<tr><td>2019.09</td><td><a href="https://arxiv.org/abs/1909.11942">ALBERT</a> ⭐</td><td>参数压缩</td><td>跨层参数共享、词嵌入因式分解</td><td>Base 12M</td><td>HF、TF、ONNX</td></tr>
<tr><td>2019.1</td><td><a href="https://arxiv.org/abs/1910.01108">DistilBERT</a> ⭐</td><td>轻量 NLP</td><td>在预训练阶段蒸馏 BERT，减少层数</td><td>66M</td><td>HF、ONNX、OpenVINO、TFLite</td></tr>
<tr><td>2019.1</td><td><a href="https://arxiv.org/abs/1910.10683">T5</a></td><td>NLP</td><td>将所有 NLP 任务统一成 text-to-text</td><td>60M～11B</td><td>HF、T5X、ONNX、TensorRT</td></tr>
<tr><td>2019.11</td><td><a href="https://arxiv.org/abs/1911.09070">EfficientDet</a> ⭐</td><td>轻量检测</td><td>EfficientNet backbone + 可重复的 BiFPN</td><td>D0 3.9M；D7 52M</td><td>TF、TFLite、TensorRT</td></tr>
<tr><td>2019.11</td><td><a href="https://arxiv.org/abs/1911.11907">GhostNet</a> ⭐</td><td>轻量 CNN</td><td>用廉价线性操作生成冗余特征图</td><td>约 5.2M</td><td>NCNN、MNN、TensorRT</td></tr>
<tr><td>2020.02</td><td><a href="https://arxiv.org/abs/2002.10957">MiniLM</a> ⭐</td><td>轻量 NLP</td><td>蒸馏教师模型的自注意力关系</td><td>约 22M（L6-H384）</td><td>HF、ONNX、OpenVINO</td></tr>
<tr><td>2020.04</td><td><a href="https://arxiv.org/abs/2004.02984">MobileBERT</a> ⭐</td><td>端侧 NLP</td><td>深而窄的网络、瓶颈结构、逐层蒸馏</td><td>25.3M</td><td>TFLite、NNAPI、ONNX</td></tr>
<tr><td>2020.05</td><td><a href="https://arxiv.org/abs/2005.14165">GPT-3</a></td><td>大语言模型</td><td>通过大规模预训练产生零样本、少样本和上下文学习能力</td><td>125M～175B</td><td>权重不公开；OpenAI API</td></tr>
<tr><td>2020.05</td><td><a href="https://arxiv.org/abs/2005.12872">DETR</a></td><td>Transformer 检测</td><td>Object Query + 集合预测，移除 anchor 和 NMS</td><td>约 41M（R50）</td><td>PyTorch、HF、ONNX、TensorRT</td></tr>
<tr><td>2020.06</td><td><a href="https://arxiv.org/abs/2006.11239">DDPM</a></td><td>图像生成</td><td>正向逐步加噪，反向网络逐步去噪生成图像</td><td>数十至数百 M</td><td>PyTorch、JAX、Diffusers</td></tr>
<tr><td>2020.1</td><td><a href="https://arxiv.org/abs/2010.04159">Deformable DETR</a></td><td>高效检测</td><td>每个 query 只关注少量采样点，加快收敛</td><td>约 40M（R50）</td><td>MMDetection、ONNX、TensorRT</td></tr>
<tr><td>2020.1</td><td><a href="https://arxiv.org/abs/2010.11929">ViT</a></td><td>视觉 Transformer</td><td>将图像切成 patch，当作 token 输入纯 Transformer</td><td>B/16 86M；L/16 307M</td><td>timm、HF、JAX、TensorRT</td></tr>
<tr><td>2020.12</td><td><a href="https://arxiv.org/abs/2012.12877">DeiT</a> ⭐</td><td>轻量 ViT</td><td>蒸馏 token 和强数据增强，降低 ViT 数据需求</td><td>Tiny 5.7M；Small 22M</td><td>timm、ONNX、TensorRT</td></tr>
<tr><td>2021.02</td><td><a href="https://arxiv.org/abs/2102.09672">Improved DDPM</a></td><td>图像生成</td><td>学习反向方差，用更少采样步保持生成质量</td><td>随 U-Net 变化</td><td>PyTorch、Diffusers</td></tr>
<tr><td>2021.02</td><td><a href="https://arxiv.org/abs/2103.00020">CLIP</a></td><td>视觉语言</td><td>图像和文本双编码器对比学习，实现零样本分类和检索</td><td>ViT-B/32 总计约 151M</td><td>OpenAI CLIP、OpenCLIP、HF</td></tr>
<tr><td>2021.03</td><td><a href="https://arxiv.org/abs/2103.14030">Swin Transformer</a></td><td>视觉 Transformer</td><td>层级特征与移位窗口注意力，适合检测和分割</td><td>Tiny 28M；Base 88M</td><td>timm、MMDetection、TensorRT</td></tr>
<tr><td>2021.04</td><td><a href="https://arxiv.org/abs/2104.01136">LeViT</a> ⭐</td><td>轻量 ViT</td><td>CNN 下采样结合 Transformer，按硬件延迟优化</td><td>128S 约 7.8M</td><td>PyTorch、ONNX、TensorRT</td></tr>
<tr><td>2021.1</td><td><a href="https://arxiv.org/abs/2110.02178">MobileViT</a> ⭐</td><td>移动端 ViT</td><td>MobileNet 建模局部特征，Transformer 建模全局关系</td><td>XXS 1.3M；S 5.6M</td><td>Core ML、TFLite、ONNX</td></tr>
<tr><td>2021.12</td><td><a href="https://arxiv.org/abs/2112.10752">Latent Diffusion</a></td><td>图像生成</td><td>在 VAE latent 空间扩散，以 cross-attention 接入文本</td><td>随配置变化</td><td>CompVis、Diffusers、ONNX</td></tr>
<tr><td>2022.01</td><td><a href="https://arxiv.org/abs/2201.12086">BLIP</a></td><td>视觉语言</td><td>同时支持理解和生成，用 caption bootstrapping 清洗数据</td><td>数百 M</td><td>PyTorch、HF</td></tr>
<tr><td>2022.03</td><td><a href="https://arxiv.org/abs/2203.02155">InstructGPT</a></td><td>对齐</td><td>SFT + 奖励模型 + RLHF，让 GPT 遵循人类指令</td><td>1.3B、6B、175B</td><td>OpenAI 托管服务</td></tr>
<tr><td>2022.06</td><td><a href="https://arxiv.org/abs/2206.01191">EfficientFormer</a> ⭐</td><td>轻量 ViT</td><td>移除移动硬件不友好的算子，按实测延迟搜索模型</td><td>L1 12.3M</td><td>Core ML、ONNX、TensorRT</td></tr>
<tr><td>2022.07</td><td><a href="https://arxiv.org/abs/2207.10666">TinyViT</a> ⭐</td><td>轻量 ViT</td><td>卷积 stem、局部窗口 attention、跨模型蒸馏</td><td>5M版约 5.4M</td><td>PyTorch、ONNX、TensorRT</td></tr>
<tr><td>2022.08</td><td>Stable Diffusion 1.x（<a href="https://arxiv.org/abs/2112.10752">LDM 论文</a>）</td><td>文生图</td><td>CLIP 文本条件 + latent U-Net + VAE</td><td>U-Net 860M；完整约 1.07B</td><td>Diffusers、ComfyUI、TensorRT</td></tr>
<tr><td>2022.11</td><td>Stable Diffusion 2.x</td><td>文生图</td><td>使用 OpenCLIP 文本编码器，提高训练和生成分辨率</td><td>完整约 1.3B</td><td>Diffusers、ComfyUI、TensorRT</td></tr>
<tr><td>2023.01</td><td><a href="https://arxiv.org/abs/2301.12597">BLIP-2</a></td><td>视觉语言模型</td><td>冻结图像编码器和 LLM，用 Q-Former 连接两者</td><td>Q-Former 约 188M；总量取决于 LLM</td><td>HF、PyTorch</td></tr>
<tr><td>2023.03</td><td><a href="https://arxiv.org/abs/2303.08774">GPT-4</a></td><td>多模态大模型</td><td>支持图像输入；使用规模预测和 RLHF，架构未公开</td><td><strong>未公开</strong></td><td>OpenAI API / ChatGPT</td></tr>
<tr><td>2023.04</td><td><a href="https://arxiv.org/abs/2304.08069">RT-DETR</a> ⭐</td><td>实时检测</td><td>高效混合编码器、端到端无 NMS、decoder 层数可调</td><td>R50 约 42M</td><td>Paddle、Ultralytics、TensorRT</td></tr>
<tr><td>2023.07</td><td><a href="https://arxiv.org/abs/2307.01952">SDXL</a></td><td>文生图</td><td>更大 U-Net、双文本编码器、多宽高比训练、可选 refiner</td><td>U-Net 约 2.6B；完整约 3.5B</td><td>Diffusers、ComfyUI、TensorRT</td></tr>
<tr><td>2023.1</td><td><a href="https://arxiv.org/abs/2310.04378">LCM</a> ⭐</td><td>快速扩散</td><td>将多步扩散蒸馏为 2～4 步生成</td><td>通常继承原 SD 参数量</td><td>Diffusers、ComfyUI、TensorRT</td></tr>
<tr><td>2023.11</td><td><a href="https://arxiv.org/abs/2311.17049">MobileCLIP</a> ⭐</td><td>轻量多模态</td><td>轻量图像编码器、强化数据集和知识蒸馏</td><td>S0：11.4M图像 + 42.4M文本</td><td>OpenCLIP、Core ML、ONNX</td></tr>
<tr><td>2023.11</td><td><a href="https://arxiv.org/abs/2311.17042">SD-Turbo</a> ⭐</td><td>快速文生图</td><td>对抗扩散蒸馏，将生成减少到 1～4 次网络调用</td><td>约 1.3B</td><td>Diffusers、TensorRT、Core ML</td></tr>
<tr><td>2024.05</td><td><a href="https://openai.com/index/gpt-4o-system-card/">GPT-4o</a></td><td>原生多模态模型</td><td>单一端到端模型统一处理文本、图像、视频和音频</td><td><strong>未公开</strong></td><td>OpenAI API / ChatGPT</td></tr>
</table></div>

## 模型

模型上选了Qwen3.5-0.8B和Gemma4-e2b。

- 原因主要是，iOS端侧App的内存占用阈值通常在 **1GB ~ 2GB** 左右(经验值)， 实际开发中有遇到**1.3GB**内存占用情况下App被杀死的情况，因此如果端侧推理模型，内存占用最好控制在1GB及以下，能在500MB以下最好。

- 简单计算：

- 1B参数大约相当于 1B \* 32bit(float32) = 10 0000 0000 \* 32 / 8(bit) / 1024 / 1024 / 1024 = 3.72GB内存

- 因此至少使用8bit量化进行推理，再除以4 = 0.93GB，才能到勉强可以运行的地步。

- 如果使用4bit量化进行推理，则再除以2 = 0.46GB，就达到基本可用的地步，加上200MB的KVCache也可以支持。

在这两个模型之前尝试了：

1. MiniCPM-2B： 清华系面壁智能公司出品，基本上只有最高端iOS设备才能勉强运行起来，非常容易OOM，不可用状态，试用App简陋，在移动端显然不能使用这个模型，除非自己愿意付出成本做2bit量化。<https://github.com/OpenBMB/MiniCPM-V-Apps>

![Llama.cpp iOS 端侧部署实践配图]({{ '/assets/posts/llama-cpp-ios/1418.png' | relative_url }})

1. 苹果的FastVLM：苹果在这个模型使用一个单独的视觉Encoder映射图片token到LLM的向量空间，达成了几乎实时的图片识别速度，但是也基本只能在顶配手机上运行起来。<https://github.com/apple-aiml-research/ml-fastvlm>

![Llama.cpp iOS 端侧部署实践配图]({{ '/assets/posts/llama-cpp-ios/1419.jpeg' | relative_url }})

个人体感上，端侧模型的性能，直到Gemma4-e2b才真正解决，变得相对可用，内存占用也到达一个相对合理的范围。未来直接调用Apple/Google提供的内置模型进行长久推理，或者是自行部署模型，都会是一个相对简单的事情。

### Qwen3.5 0.8B（2026 年 3 月 2 日）

模型卡：<https://huggingface.co/Qwen/Qwen3.5-0.8B>

技术报告：<https://arxiv.org/abs/2604.15804> qwen3.5技术报告

官方博客：<https://qwen.ai/blog?id=qwen3.5>

<div class="feishu-table" role="region" aria-label="对比表，可横向滚动" tabindex="0"><table>
<tr><td>项目</td><td>Qwen3.5-0.8B</td></tr>
<tr><td>模型类型</td><td>因果语言模型 + 视觉编码器</td></tr>
<tr><td>语言模型参数</td><td>0.8B</td></tr>
<tr><td>网络层数</td><td>24 层</td></tr>
<tr><td>隐藏维度</td><td>1024</td></tr>
<tr><td>架构</td><td>Gated DeltaNet 与标准注意力混合</td></tr>
<tr><td>原生上下文</td><td>262,144 tokens</td></tr>
<tr><td>输入模态</td><td>文本、图片、视频</td></tr>
<tr><td>语言覆盖</td><td>官方称支持 201 种语言及方言</td></tr>
<tr><td>推理模式</td><td>普通模式、Thinking 模式</td></tr>
<tr><td>许可证</td><td>Apache 2.0</td></tr>
<tr><td>官方定位</td><td>原型、专项微调、研究与开发</td></tr>
</table></div>

主要亮点：

- **Unified Vision-Language Foundation**: Early fusion training on multimodal tokens achieves cross-generational parity with Qwen3 and outperforms Qwen3-VL models across reasoning, coding, agents, and visual understanding benchmarks.

- **Efficient Hybrid Architecture:** Gated Delta Networks combined with sparse Mixture-of-Experts deliver high-throughput inference with minimal latency and cost overhead.

- **Scalable RL Generalization:** Reinforcement learning scaled across million-agent environments with progressively complex task distributions for robust real-world adaptability.

- **Global Linguistic Coverage:** Expanded support to 201 languages and dialects, enabling inclusive, worldwide deployment with nuanced cultural and regional understanding.

- **Next-Generation Training Infrastructure:** Near-100% multimodal training efficiency compared to text-only training and asynchronous RL frameworks supporting massive-scale agent scaffolds and environment orchestration.

- **统一的视觉—语言基础模型**：通过对多模态 Token 进行早期融合训练，模型能力达到与 Qwen3 跨代相当的水平，并在推理、编程、智能体和视觉理解等基准测试中优于 Qwen3-VL 系列。

- **高效的混合架构**：将门控 Delta 网络（Gated Delta Networks）与稀疏混合专家模型（Sparse MoE）结合，在仅增加较少延迟和成本开销的情况下，实现高吞吐量推理。

- **可扩展的强化学习泛化能力**：将强化学习扩展至包含数百万个智能体环境的大规模训练体系，并逐步提高任务分布的复杂度，从而增强模型在真实场景中的适应能力和稳健性。

- **广泛的语言覆盖**：将支持范围扩展至 201 种语言和方言，使模型能够在全球范围内部署，并更细致地理解不同地区的语言、文化和语境。

- **新一代训练基础设施**：多模态训练效率接近纯文本训练，同时采用异步强化学习框架，支持超大规模智能体脚手架和训练环境的编排与调度。

![Llama.cpp iOS 端侧部署实践配图]({{ '/assets/posts/llama-cpp-ios/256.png' | relative_url }})

解读：

整体上来说，Qwen3.5是在Qwen3的基础上再加了一些优化，模型主干结构上没有明显变化，但增强了多模态能力和Agent能力。

1. **统一的视觉—语言基础模型：**

上一代[Qwen3-VL](https://arxiv.org/abs/2511.21631)是外挂视觉Encoder的模式，也就是先训练了一个LLM，再单独加一个视觉的Encoder，在两者分别预训练结束后，通过视觉—语言对齐预训练来融合视觉、文本的特征。Qwen3.5是统一多模态的模式，内置了Vision Encoder，预训练阶段VisionEncoder和LLM同时训练，官方认为怎么做能够提升模型在文本、视觉、Agent等Benchmark上的效果。

![Llama.cpp iOS 端侧部署实践配图]({{ '/assets/posts/llama-cpp-ios/1469.png' | relative_url }})

1. **高效的混合架构：****[代码](https://github.com/huggingface/transformers/blob/main/src/transformers/models/qwen3_5/modeling_qwen3_5.py#L504)**

承袭了Qwen3: 在75% 的层使用 Gated DeltaNet，提高速度并降低长上下文开销；25% 的层使用Gated Attention保留完整注意力，负责精确检索；

[Gated DeltaNet](https://github.com/NVlabs/GatedDeltaNet)是2024年12月份提出的，2025年9月Qwen3-Next使用，2026年2月Qwen3.5采用，使用一个固定大小的循环状态来压缩历史信息，好处是显著降低计算复杂度，缺点是容易遗忘远期细节。

[GateAttention](https://github.com/qiuzh20/gated_attention)是2025年5月Qwen团队提出，解决Attention请求后的内容不是全部都需要的，允许模型完全不看无意义的内容。

{% raw %}
```bash
普通线性注意力：
不断向记忆中追加信息，容易发生干扰

Delta Rule：
先找出旧关联与新信息的误差，再定向修改

Gate：
决定整体保留或遗忘多少历史
```
{% endraw %}

Qwen3.5的新的东西是：将视觉 Token 与 Gated DeltaNet 混合注意力结合，不过结合的方式比较直接，把视觉token直接放到上下文中：[具体代码](https://github.com/huggingface/transformers/blob/f62dc9bf2c90353b442a56e74391fbb8c689b55e/src/transformers/models/qwen3_5/modular_qwen3_5.py#L619-L631)

放入的方式如下：

{% raw %}
```bash
<vision_start>
<image> <image> <image> ... <image>
<vision_end>
```
{% endraw %}

![Llama.cpp iOS 端侧部署实践配图]({{ '/assets/posts/llama-cpp-ios/1480.png' | relative_url }})

1. **可扩展的强化学习泛化能力：**

Qwen3.5仍然使用Qwen3就在使用的[GSPO](https://qwen.ai/blog?id=gspo)， 这里主要是说原本Qwen3只是在数学、代码、推理、20+通用任务上做了常规的大规模RL，而Qwen3.5则是在训练数据和环境上做了拓展，能够对各类Agent任务进行大规模RL，官方形容为显著更多的数据。

<div class="feishu-table" role="region" aria-label="对比表，可横向滚动" tabindex="0"><table>
<tr><td>数据指标</td><td>Qwen3</td><td>Qwen3.5</td></tr>
<tr><td>Reasoning RL 初始任务</td><td>3,995 个 query-verifier 对</td><td>未公布</td></tr>
<tr><td>General RL</td><td>20+ 类任务，样本数未公布</td><td>“几乎所有能构造的 RL 任务和环境”</td></tr>
<tr><td>Agent 环境/脚手架</td><td>未给规模</td><td>百万级，即 10^6 量级</td></tr>
<tr><td>RL rollout 轨迹数</td><td>未公布</td><td>未公布</td></tr>
<tr><td>预训练量</td><td>36 万亿 token</td><td>“显著更多”、达数十万亿量级，未给精确值</td></tr>
</table></div>

传统的RL：

Qwen3的RL基本是

{% raw %}
```bash
问题 → 模型回答 → 判分 → 更新模型
```
{% endraw %}

Agent RL：

Qwen3.5的RL的步骤是这样的

{% raw %}
```bash
任务
 ↓
模型思考并选择工具
 ↓
环境执行工具，返回观察结果
 ↓
模型根据结果决定下一步
 ↓
可能继续搜索、读文件、写代码、重试
 ↓
任务结束后计算奖励
```
{% endraw %}

一次RL运行的过程如下：形成一条轨迹

{% raw %}
```bash
任务：修复某 Git 仓库中的登录 bug
  ↓
Qwen3.5：读取文件
  ↓
环境：返回文件内容
  ↓
Qwen3.5：修改代码
  ↓
环境：执行 patch，返回结果
  ↓
Qwen3.5：运行测试
  ↓
环境：返回测试日志
  ↓
Qwen3.5：继续修改
  ↓
Verifier：全部测试通过，reward = 1
```
{% endraw %}

根据轨迹优化模型参数：

不同环境有不同 verifier，例如：

<div class="feishu-table" role="region" aria-label="对比表，可横向滚动" tabindex="0"><table>
<tr><td><strong>任务</strong></td><td><strong>典型 reward</strong></td></tr>
<tr><td>数学</td><td>最终答案是否正确</td></tr>
<tr><td>编程</td><td>单元测试通过率、编译结果</td></tr>
<tr><td>SWE Agent</td><td>issue 是否修复、隐藏测试是否通过</td></tr>
<tr><td>搜索</td><td>答案正确率、引用覆盖率</td></tr>
<tr><td>Tool Use</td><td>工具选择及参数是否正确</td></tr>
<tr><td>GUI</td><td>是否到达目标状态</td></tr>
<tr><td>对话</td><td>reward model 或 rubric judge 评分</td></tr>
<tr><td>安全/格式</td><td>是否违规、是否满足输出格式</td></tr>
</table></div>

例如可以组成：

R=1.0Rsuccess+0.2Rpartial+0.1Rformat−0.05Rcost−0.2Runsafe

对于不同的轨迹，能够过的一个不同的Reward数值

{% raw %}
```bash
轨迹 1：测试全部通过    R=1.0
轨迹 2：通过一半测试    R=0.5
轨迹 3：代码无法编译    R=0.0
轨迹 4：工具调用出错    R=-0.2
```
{% endraw %}

奖励转换成组内相对优势：

A^i=std(R1,…,RG)+ϵRi−mean(R1,…,RG)

结果就是：

- 高于平均水平的轨迹：A^i>0，增加其概率。

- 低于平均水平的轨迹：A^i<0，降低其概率。

1. **广泛的语言覆盖**

Qwen3.5 官方宣称覆盖从 Qwen3 的 **119 种语言/方言扩展到 201 种**

- Qwen3.5 将词表从大约 15 万扩大到 **25 万 token**。

- 预训练语料包含这些语言

- 做过多语言指令对齐

用户用泰语提问 → 用泰语回答

用户要求中译阿 → 输出阿拉伯语

用户中英混合提问 → 理解混合语义

- Agent 能力也覆盖多语言环境

在 Agent 训练语境中，它还意味着模型可能面对：

- 不同语言的网页

- 多语言搜索结果

- 非英语软件界面

- 多语言工具说明

- 跨语言信息汇总

- 用一种语言搜索、用另一种语言输出

1. **新一代训练基础设施**

为了训练 Qwen3.5，重新设计了底层的分布式训练和 RL 数据生产系统。

- Qwen3.5 同时处理文本、图片和视频。不同模态的计算特点不同：

- 图片/视频编码器：计算量大、输入尺寸变化大

- 语言模型：序列长、MoE 通信量大

- 视频：帧数差异很大，容易造成 GPU 负载不均

Qwen3.5 将二者解耦：

{% raw %}
```text
图片/视频
   ↓
视觉编码集群 —— 使用适合视觉模型的并行策略
   ↓
视觉 token
   ↓
语言模型集群 —— 使用适合长序列和 MoE 的并行策略
   ↓
训练 loss
```
{% endraw %}

并把视觉计算与 MoE 的稀疏计算、通信重叠起来。官方称在混合文本—图片—视频训练中，吞吐率可以接近纯文本训练基线。

- 原生 FP8 训练

- RL 的生成和训练完全解耦，就是异步Agent RL，

agent RL 包含两种差异很大的工作：

{% raw %}
```text
Rollout：运行模型、调用工具、等待环境
Training：前向计算、反向传播、更新参数
```
{% endraw %}

为了减少等待，Rollout 有自己的推理集群，训练使用自己的推理集群，之间做训练Rollout轨迹数据的缓冲与调度。

官方声称整套 RL 基础设施实现了约 **3～5 倍端到端加速**。提升来自要素综合产生：

FP8+推理训练解耦+异步调度+推测解码+MoE 路由一致性+多轮任务管理

#### 0.8B的产生

1. 独立设计 0.8B 网络。

但是和Qwen3.5-35B-A3B、Qwen3.5-397B-A17B不同，0.8B本身不是MoE模型，是Dense模型，没有ExportRouter。猜测是这个参数量级再拆分Export模型，没有收益。

1. 多语言、多模态预训练得到 Qwen3.5-0.8B-Base

但其实Qwen3.5-0.8B的多语言模型其实翻译效果挺差的，只能做到基本的翻译，只能用于基本的中英翻译。完全没有必要在这么小的模型上支持201 种语言和方言，词表也没有必要到248K这么大，腾挪出来的参数和词表能够提升不少模型的能力，后续我们从Gemma4-e2b可以看出来。

<div class="feishu-table" role="region" aria-label="对比表，可横向滚动" tabindex="0"><table>
<tr><td>Benchmark</td><td>0.8B</td><td>Qwen3-1.7B</td><td>Qwen3.5-2B</td><td>主要测试内容</td></tr>
<tr><td>MMMLU</td><td>44.3</td><td>57.0</td><td>63.1</td><td>多语言知识与理解</td></tr>
<tr><td>MMLU-ProX</td><td>34.6</td><td>49.4</td><td>52.3</td><td>29 种语言的高难度知识推理</td></tr>
<tr><td>PolyMath</td><td>8.2</td><td>25.2</td><td>26.1</td><td>18 种语言的数学推理</td></tr>
<tr><td>WMT24++</td><td>27.2</td><td>39.3</td><td>45.8</td><td>55 种语言的机器翻译</td></tr>
<tr><td>MaXIFE</td><td>39.2</td><td>50.7</td><td>60.6</td><td>23 种语言的指令遵循</td></tr>
</table></div>

1. SFT / 可能的强模型蒸馏 / RL 对齐得到 Qwen3.5-0.8B

这里官方没有太多信息，可以想见对Qwen3.5-0.8B用的SFT样本数会更少，做的RL对齐也会更少。要是有更多信息就好了。

官方也没有披露是否使用强模型进行蒸馏，因此Qwen3.5-0.8B可以认为是Qwen3.5-397B的相似结构缩小版，基本的训练步骤都是一致的。

#### Benchmark

文本推理能力明显弱于2B左右模型，**并且官方披露开启 Thinking 0.8B 容易陷入思考循环**。

<div class="feishu-table" role="region" aria-label="对比表，可横向滚动" tabindex="0"><table>
<tr><td>Benchmark</td><td>Qwen3.5-0.8B</td><td>Qwen3-1.7B</td><td>Qwen3.5-2B</td></tr>
<tr><td>MMLU-Pro</td><td>42.3</td><td>56.5</td><td>66.5</td></tr>
<tr><td>MMLU-Redux</td><td>59.5</td><td>73.9</td><td>79.6</td></tr>
<tr><td>C-Eval</td><td>50.5</td><td>68.1</td><td>73.2</td></tr>
<tr><td>LongBench v2</td><td>26.1</td><td>26.5</td><td>38.7</td></tr>
<tr><td>MMLU-ProX</td><td>34.6</td><td>49.4</td><td>52.3</td></tr>
<tr><td>PolyMath</td><td>8.2</td><td>25.2</td><td>26.1</td></tr>
<tr><td>BFCL-V4</td><td>25.3</td><td>未公布</td><td>43.6</td></tr>
</table></div>

相比别的小模型，优势在于多模态能力几乎匹敌上一代的2B模型，这些2B模型基本是使用外挂VisionEncoder来实现的。

<div class="feishu-table" role="region" aria-label="对比表，可横向滚动" tabindex="0"><table>
<tr><td>视觉 Benchmark</td><td>Qwen3.5-0.8B</td><td>Qwen3-VL-2B</td><td>Qwen3.5-2B</td><td>SmolVLM-500M</td><td>LFM2.5-VL-1.6B</td></tr>
<tr><td>MMMU</td><td>49.0 / 47.4</td><td>61.4</td><td>64.2 / 64.2</td><td>33.7</td><td>40.56</td></tr>
<tr><td>MathVista</td><td>62.2 / 58.6</td><td>73.6</td><td>76.7 / 73.9</td><td>40.1</td><td>—</td></tr>
<tr><td>RealWorldQA</td><td>63.4 / 61.6</td><td>69.5</td><td>74.5 / 71.2</td><td>—</td><td>64.84</td></tr>
<tr><td>MMStar</td><td>58.3 / 55.9</td><td>68.1</td><td>71.7 / 68.0</td><td>38.3</td><td>50.67</td></tr>
<tr><td>AI2D</td><td>69.9 / 68.7</td><td>80.4</td><td>83.3 / 81.5</td><td>59.5</td><td>—</td></tr>
<tr><td>OCRBench</td><td>74.5 / 79.1</td><td>79.2</td><td>84.5 / 85.4</td><td>61.0</td><td>41.44（OCRBench v2）†</td></tr>
<tr><td>OmniDocBench 1.5</td><td>61.0 / 70.6</td><td>65.9</td><td>79.8 / 80.9</td><td>—</td><td>—</td></tr>
<tr><td>VideoMME，无字幕</td><td>57.7</td><td>62.1</td><td>69.0</td><td>—</td><td>—</td></tr>
<tr><td>ScreenSpot Pro</td><td>46.5</td><td>48.5</td><td>54.5</td><td>—</td><td>—</td></tr>
</table></div>

#### 简单主观评价

勉强可用的小模型，属于给Qwen3.5系列锦上添花的一个模型，用于验证整套训练方法在小模型场景的可行性。

1. 个人认为Qwen算法团队没有真正面向移动端或者嵌入式场景去设计模型，只是想验证自己架构和方法在小规模模型上也能起作用，顺手做了一个小版本模型，刷新一下评测集 --- 这也是之前当前不少算法团队对于小模型的态度。

1. 官方没有提供量化版本，只提供了BF16位版本，官方 Safetensors 文件约 1.75 GB，显然无法直接在手机上运行起来，官方的评测推理并非手机端完成。社区版本8bit量化精度再次损失，效果更拉垮。

1. 实际使用下来，非常容易死循环，指令遵循效果差，通过prompt控制难度高。以开发者的角度，有理由认为：Qwen3.5-0.8B不是一个成熟的产品，训练阶段很可能没有移动端人员提供参考性建议和反馈。

### Gemma4 e2b（2026 年 3 月 31 日）

模型卡： <https://ai.google.dev/gemma/docs/core/model_card_4>

技术报告：<https://arxiv.org/html/2607.02770v1> gemma4

<div class="feishu-table" role="region" aria-label="对比表，可横向滚动" tabindex="0"><table>
<tr><td>参数部分</td><td>规模</td><td>推理时的主要操作</td></tr>
<tr><td>常规 Token Embedding</td><td>约 400M</td><td>查表</td></tr>
<tr><td>Transformer 主干</td><td>约 1.87B</td><td>Attention、FFN 矩阵运算</td></tr>
<tr><td>PLE</td><td>约 2.34B</td><td>逐层查表</td></tr>
<tr><td>视觉编码器</td><td>约 150M</td><td>有图片时运行</td></tr>
<tr><td>音频编码器</td><td>约 305M</td><td>有音频时运行</td></tr>
<tr><td>MTP 草稿模型</td><td>约 76M</td><td>推测解码时运行</td></tr>
<tr><td>词表规模</td><td>262K</td><td></td></tr>
<tr><td>输入</td><td>文本、图片、音频、视频帧</td><td></td></tr>
<tr><td>输出</td><td>文本</td><td></td></tr>
<tr><td>目标设备</td><td>手机、浏览器、边缘设备</td><td></td></tr>
</table></div>

主要亮点：

1. **Thinking mode for advanced reasoning:** We introduce a thinking mode ([OpenAI, 2024](https://arxiv.org/html/2607.02770v1#bib.bib30)) to Gemma 4 models. By outputting a reasoning trace before the response, models demonstrate improved capabilities in reasoning-heavy domains such as mathematics and coding.

1. **Long-context efficiency:** Extended contexts lead to a memory explosion in the KV cache. We conserve a 5:1 ratio of local sliding window to global self-attention (4:1 for the 2.3B model) and use p-RoPE ([Barbero et al., 2025](https://arxiv.org/html/2607.02770v1#bib.bib2)) as positional encoding. Combined with KV cache sharing ([Shazeer, 2019](https://arxiv.org/html/2607.02770v1#bib.bib38)) and the reuse of keys as values in global layers ([Kayyam et al., 2026](https://arxiv.org/html/2607.02770v1#bib.bib22)), these optimizations reduce the global KV cache footprint by up to 37.5%.

1. **Compute efficiency:** We release an autoregressive multi-token prediction (MTP) drafter head ([Li et al., 2024](https://arxiv.org/html/2607.02770v1#bib.bib27)) designed for speculative decoding ([Leviathan et al., 2023](https://arxiv.org/html/2607.02770v1#bib.bib26)) to improve the decoding speed of our models.

1. **Memory efficiency:** We provide quantized versions of our models trained with quantization-aware training ([Jacob et al., 2018](https://arxiv.org/html/2607.02770v1#bib.bib19), QAT) to reduce their parameter memory footprint and latency with minimal impact on quality.

1. **Encoder-free architecture**: Gemma 4 models have frozen vision and audio encoders. We introduce a unified encoder-free architecture for the 12B model, which projects raw 40ms audio chunks and image patches into the LLM embedding space, alleviating the need for separate encoders and reducing memory fragmentation.

1. **用于高级推理的思考模式**：我们在 Gemma 4 模型中引入了一种思考模式（OpenAI，2024 年）。通过在响应之前输出推理过程，模型在需要大量推理能力的领域（如数学和编程）中的表现得到了提升。

1. **长上下文效率**：较长的上下文会导致 KV 缓存中的内存占用激增。我们采用了 5:1 的比例来分配局部滑动窗口与全局自注意力的资源（对于 23 亿参数的模型，比例为 4:1）。同时，我们使用 p-RoPE 方法作为位置编码方法（Barbero 等人，2025 年）。结合 KV 缓存共享机制（Shazeer，2019 年），以及将全局层中的键作为值进行复用，这些优化使得全局 KV 缓存的占用空间减少了 37.5%。

1. **计算效率**：我们发布了一种自回归多标记预测模型框架（Li 等人，2024 年），该框架旨在提高模型的解码速度，适用于推测性解码（Leviathan 等人，2023 年）。

1. **内存效率**：我们提供了经过量化处理的模型版本，这些模型是在遵循量化感知训练策略的情况下训练的（Jacob 等人，2018 年，QAT 论文）。这样可以在不影响质量的前提下，减少模型的内存占用和响应时间。

![Llama.cpp iOS 端侧部署实践配图]({{ '/assets/posts/llama-cpp-ios/336.png' | relative_url }})

图源：[A Visual Guide to Gemma 4](https://newsletter.maartengrootendorst.com/p/a-visual-guide-to-gemma-4)

解读：

整体来说：Gemma4对于Gemma3(2025 年 3 月 12 日)而言是一次全面的提升，架构上延续了Decoder-only Transformer 和局部/全局注意力框架， 主要变化是简化 Gemma 3n 的复杂结构，同时加入更适合推理、长上下文和端侧部署的新模块。

1. **用于高级推理的思考模式**： Gemma4使用OpenAI2024年在[o1模型](https://arxiv.org/pdf/2412.16720)中提出的思考方法，要求模型按照think模板输出思维链。

模型的后训练数据中会出现：<|think|>标签，因此模型天然就支持思考。

另外，我们可以看到，工具调用在后训练时的数据，也是通过system prompt中添加标签+工具描述来支持的。

{% raw %}
```bash
<|turn>system
<|think|>
你是一个助手。

<|tool>declaration:
calculator{
    expression: string
}
<tool|>
<turn|>

<|turn>user
计算237乘以419。
<turn|>

<|turn>model
<|channel>thought
This requires exact arithmetic, so I should use the calculator.
<channel|>
<|tool_call>
call:calculator{
    expression:<|"|>237 * 419<|"|>
}
<tool_call|>
<turn|>

<|tool_response>
99303
<tool_response|>

<|turn>model
237 × 419 = 99303。
<turn|>
```
{% endraw %}

仅靠这些标签数据进行SFT监督微调可以教会输出格式，后训练中还需要进行强化学习增强。

顺便解释：Chat Template负责什么？

Chat Template只负责把结构化消息：

{% raw %}
```text
[
    {"role": "system", "content": "..."},
    {"role": "user", "content": "求解这个问题"}
]
```
{% endraw %}

序列化成模型训练时熟悉的Token格式：

{% raw %}
```text
<|turn>system
<|think|>...
<turn|>
<|turn>user
求解这个问题
<turn|>
<|turn>model
```
{% endraw %}

接下来输出什么，仍由模型概率分布决定。

一般的推理过程为：

pip install -U transformers torch accelerate

{% raw %}
```python
from transformers import AutoProcessor, AutoModelForMultimodalLM
# 加载模型
MODEL_ID = "google/gemma-4-E2B-it"
processor = AutoProcessor.from_pretrained(MODEL_ID)
model = AutoModelForMultimodalLM.from_pretrained(
    MODEL_ID,
    dtype="auto",
    device_map="auto"
)
# 提示词
messages = [
    {"role": "system", "content": "You are a helpful assistant."},
    {"role": "user", "content": "Write a short joke about saving RAM."},
]

# 使用ChatTemplate处理输入
inputs = processor.apply_chat_template(
    messages,
    tokenize=True,
    return_dict=True,
    return_tensors="pt",
    add_generation_prompt=True,
    enable_thinking=False
).to(model.device)
input_len = inputs["input_ids"].shape[-1]

# 生成结果
outputs = model.generate(**inputs, max_new_tokens=1024)
response = processor.decode(outputs[0][input_len:], skip_special_tokens=False)

# 处理输出～
processor.parse_response(response)
```
{% endraw %}

1. **长上下文效率**：以下优化使得全局 KV 缓存的占用空间减少了 37.5%

1. 拓展上下文长度到256K并不是一件容易的事情，都需要简化计算复杂度，Qwen3.5选择的是一个门控的记忆块+全局注意力三比一，Gemma4选择的是滑动窗口局部注意力+全局注意力五比一，局部层只查看最近512个Token，全局层仍需保存长距离信息，但全局层数量比局部层少，因此总KV Cache显著下降。

1. 用上了p-RoPE: RoPE使用不同频率表示Token位置。上下文特别长时，一部分位置频率可能产生旋转过快、位置混叠等问题，Gemma 4在全局层使用 **Proportional RoPE（p-RoPE）**，只在部分维度施加适合长距离的位置旋转，让其他维度更多保留语义信息，改善长上下文质量和稳定性。

1. 跨层共享KV Cache：普通Transformer每一层分别计算并保存自己的K、V，Gemma 4的部分后层会复用前面同类型Attention层的KV，Gemma 4 E2B的35层中，有20层采用这类KV共享策略。

{% raw %}
```bash
Layer 20 ──生成KV──┐
Layer 21 ──────────┤
Layer 22 ──────────┤ 共用相关KV状态
Layer 23 ──────────
```
{% endraw %}

1. **计算效率**：使用草稿模型进行投机解码，加快模型的解码速度。原理在于，Transformer架构本身支持并行训练，并行推理多个token，只是在推理阶段，只对最后一个token进行计算，投机解码利用了并行的结构，要求模型对drafter产生的多个新的token进行并行计算，相同则使用，相反则抛弃。

{% raw %}
```bash
prompt：北京是中国的
Drafter草拟： 首 都 ， 位 于 华 北
                   │
                   ▼
主模型验证：  ✓  ✓  ✓  ✗
                   │
                   ▼
接受结果：    首 都 ， 坐
                             ↓
                         开始下一轮
```
{% endraw %}

![Llama.cpp iOS 端侧部署实践配图]({{ '/assets/posts/llama-cpp-ios/1893.png' | relative_url }})

1. **内存效率**：在训练阶段，引入量化感知QAT，使得模型在量化后的效果更好，原理是：训练时保留浮点主权重，但在每次前向传播中模拟INT4、INT2、INT8量化造成的误差，让模型提前学会补偿这些误差；训练完成后再真正导出低比特权重。

这里有一个要点，模拟INT4，其实就是一个`round()`操作，而`round()`的梯度几乎处处为零，怎么训练？

解决方式：假装Round近似是恒等函数，导数当作1，而前向计算的时候确实执行了round()操作。

∂x∂round(x)≈1

pytorch伪代码

{% raw %}
```python
import torch

# detach 不计算梯度， y = x + x.round()的梯度为1.
def fake_quant_int4(weight):
    qmin = -8
    qmax = 7

 # 简化示例：整个Tensor共用一个Scale。
 # 实际通常使用分组或逐通道Scale。
    scale = weight.detach().abs().max() / qmax
    scale = scale.clamp(min=1e-8)

    scaled = weight / scale

 # 前向值等于round(scaled)，反向梯度近似直通
 # 
    rounded = scaled + (scaled.round() - scaled).detach()
    quantized = rounded.clamp(qmin, qmax)

 # Fake Quant：仍返回浮点Tensor，但数值只能落在量化网格上
 return quantized * scale
```
{% endraw %}

#### “E2B”是什么意思？

`E` 表示 **Effective Parameters（有效参数），也就是Transformer部分的参数。**

- 模型实际的总体参数是**5.065B。**

<div class="feishu-table" role="region" aria-label="对比表，可横向滚动" tabindex="0"><table>
<tr><td>组件</td><td>参数量</td><td>占主模型比例</td><td>主要用途</td></tr>
<tr><td>PLE表</td><td>约2.34B</td><td>46.2%</td><td>每个Token、每个层的低维Embedding</td></tr>
<tr><td>Transformer主干</td><td>约1.87B</td><td>36.9%</td><td>Attention、FFN、Norm、PLE门控投影等</td></tr>
<tr><td>普通Token Embedding</td><td>约400M</td><td>7.9%</td><td>初始Token表示及共享LM Head</td></tr>
<tr><td>音频编码器</td><td>约305M</td><td>6.0%</td><td>音频、语音识别与翻译</td></tr>
<tr><td>视觉编码器</td><td>约150M</td><td>3.0%</td><td>图片和视频帧编码</td></tr>
<tr><td><strong>主模型总计</strong></td><td><strong>约5.065B</strong></td><td><strong>100%</strong></td><td></td></tr>
<tr><td>MTP Drafter</td><td>约76M</td><td>独立组件</td><td>投机解码</td></tr>
</table></div>

- 包含一个大的PLE表，作用是使用打表代替计算。

---- 没错，优化的终点就是打表，GoogleDeepMind也是如此。

PLE指Per-Layer Embeddings，每个 Token 只需要从巨大的 PLE 表中取出约 8960 个数，而不是让全部 2.34B 参数参与矩阵乘法。PLE适合CPU/RAM/闪存查表和端侧部署。

{% raw %}
```bash
Token ID
   │
   ├──普通 Embedding──────────────┐
   │                              ▼
   ├──PLE 第 1 层向量 ───────► Transformer Layer 1
   ├──PLE 第 2 层向量 ───────► Transformer Layer 2
   ├──PLE 第 3 层向量 ───────► Transformer Layer 3
   │                              ...
   └──PLE 第 35 层向量 ──────► Transformer Layer 35
```
{% endraw %}

由此获得了超过传统 2B 模型的容量，增强模型能力。不过PLE对模型质量的净提升，以及相对MoE、加宽FFN等方案的优势，Google尚未用公开的严格消融实验充分证明。

#### Benchmark

综合能力接近上一代约12B稠密模型；在数学、代码和复杂推理任务上，可以匹敌甚至超过上一代27B模型。

<div class="feishu-table" role="region" aria-label="对比表，可横向滚动" tabindex="0"><table>
<tr><td>指标</td><td>Gemma 4 E2B</td><td>Gemma 3 12B</td><td>Gemma 3 27B</td></tr>
<tr><td>MMLU Pro</td><td>60.0%</td><td>60.6%</td><td>67.5%</td></tr>
<tr><td>GPQA Diamond</td><td>43.4%</td><td>40.9%</td><td>42.4%</td></tr>
<tr><td>LiveCodeBench</td><td>44.0%</td><td>24.6%</td><td>约29%</td></tr>
<tr><td>BigBench Extra Hard</td><td>21.9%</td><td>16.3%</td><td>19.3%</td></tr>
<tr><td>AIME 2026</td><td>37.5%</td><td>非同口径</td><td>20.8%</td></tr>
<tr><td>MMMU Pro视觉理解</td><td>44.2%</td><td>非同口径</td><td>49.7%</td></tr>
</table></div>

对比Qwen3.5 0.8B呢，两个模型在相近的时间发布，但是效果上差别很大。Gemma4-e2b在文本领域明显优于Qwen3.5-0.8B, 参数上的影响比较大，对比同等规模的Qwen3.5-2B，能力基本差不多，但是指令遵循好很多。

- benchmark上看，Gemma4e2b略低于Qwen3.5-2B

- 实际部署上，Gemma4e2b体验明显好于Qwen3.5-0.8B，工程上全面胜利。

<div class="feishu-table" role="region" aria-label="对比表，可横向滚动" tabindex="0"><table>
<tr><td>类别</td><td>Benchmark</td><td>Gemma 4 E2B</td><td>Gemma 3 12B</td><td>Gemma 3 27B</td><td>Qwen3.5-0.8B</td><td>Qwen3-VL-2B</td><td>Qwen3.5-2B</td><td>SmolVLM-500M</td><td>LFM2.5-VL-1.6B</td></tr>
<tr><td>文本·知识</td><td>MMLU-Pro</td><td>60.0</td><td>60.6</td><td>67.5</td><td>42.3 / 29.7</td><td>62.3 / 49.0</td><td>66.5 / 55.3</td><td>—</td><td>—</td></tr>
<tr><td>文本·科学推理</td><td>GPQA Diamond</td><td>43.4</td><td>40.9</td><td>42.4</td><td>11.9 / —</td><td>49.5 / 42.0</td><td>51.6 / —</td><td>—</td><td>—</td></tr>
<tr><td>文本·综合知识</td><td>SuperGPQA</td><td>—</td><td>—</td><td>—</td><td>21.3 / 16.9</td><td>34.6 / 24.3</td><td>37.5 / 30.4</td><td>—</td><td>—</td></tr>
<tr><td>文本·代码</td><td>LiveCodeBench†</td><td>44.0</td><td>24.6</td><td>29.7</td><td>—</td><td>29.3 / 20.3</td><td>—</td><td>—</td><td>—</td></tr>
<tr><td>文本·指令遵循</td><td>IFEval</td><td>94.6</td><td>88.9</td><td>90.4</td><td>44.0 / 52.1</td><td>75.1 / 68.2</td><td>78.6 / 61.2</td><td>—</td><td>—</td></tr>
<tr><td>文本·复杂指令</td><td>IFBench</td><td>38.0</td><td>—</td><td>32.0</td><td>21.0 / —</td><td>—</td><td>41.3 / —</td><td>—</td><td>—</td></tr>
<tr><td>文本·多语言</td><td>MMMLU</td><td>67.4</td><td>—</td><td>70.7</td><td>44.3 / 34.1</td><td>—</td><td>63.1 / 56.9</td><td>—</td><td>—</td></tr>
<tr><td>文本·多语言数学</td><td>PolyMath</td><td>—</td><td>—</td><td>—</td><td>8.2 / —</td><td>28.0 / 14.9</td><td>26.1 / —</td><td>—</td><td>—</td></tr>
<tr><td>视觉·综合理解</td><td>MMMU</td><td>—</td><td>59.6</td><td>64.9</td><td>49.0 / 47.4</td><td>61.4</td><td>64.2 / 64.2</td><td>33.7</td><td>40.56</td></tr>
<tr><td>视觉·高难推理</td><td>MMMU-Pro</td><td>44.2</td><td>—</td><td>49.7</td><td>31.2 / 31.4</td><td>42.5</td><td>50.3 / 47.7</td><td>—</td><td>—</td></tr>
<tr><td>视觉·数学</td><td>MathVista</td><td>—</td><td>62.9</td><td>67.6</td><td>62.2 / 58.6</td><td>73.6</td><td>76.7 / 73.9</td><td>40.1</td><td>—</td></tr>
<tr><td>视觉·真实场景</td><td>RealWorldQA</td><td>—</td><td>—</td><td>—</td><td>63.4 / 61.6</td><td>69.5</td><td>74.5 / 71.2</td><td>—</td><td>64.84</td></tr>
<tr><td>视觉·综合推理</td><td>MMStar</td><td>—</td><td>—</td><td>—</td><td>58.3 / 55.9</td><td>68.1</td><td>71.7 / 68.0</td><td>38.3</td><td>50.67</td></tr>
<tr><td>视觉·图表理解</td><td>AI2D</td><td>—</td><td>84.2</td><td>84.5</td><td>69.9 / 68.7</td><td>80.4</td><td>83.3 / 81.5</td><td>59.5</td><td>—</td></tr>
<tr><td>视觉·文字识别</td><td>OCRBench‡</td><td>—</td><td>—</td><td>—</td><td>74.5 / 79.1</td><td>79.2</td><td>84.5 / 85.4</td><td>61.0</td><td>41.44（v2）</td></tr>
</table></div>

#### 简单主观评价

专为移动端精心设计的模型，优秀的内存控制，优秀的模型能力，超出预期的模型能力。

1. 个人认为GoogleDeepMind团队里，移动端、桌面端被认为是重要场景，值得follow Gemma的路径。

1. 官方就提供原生4bit量化，开箱即用，模型易于控制，易于使用。

1. 4bit量化版本，可以稳定维持500MB的内存占用，运行2B～12B的智能水平，未来可期。

1. Google端侧已经内置了Gemma4e2b和Gemma4e4b。

## 实操

### HuggingFace 下载模型

<https://huggingface.co/unsloth/Qwen3.5-0.8B-GGUF/tree/main>

![Llama.cpp iOS 端侧部署实践配图]({{ '/assets/posts/llama-cpp-ios/379.png' | relative_url }})

这里的mmproj就是多模态（图片和语音）的权重，Qwen3.5-0.8B 的 `mmproj` 约 205 MB，主要就是完整视觉塔和 Merger，推理的时候Prompt 中先放置视觉占位符：

{% raw %}
```bash
<vision_start>
<image> <image> ... <image>
<vision_end>
请描述图片
```
{% endraw %}

执行流程：

{% raw %}
```bash
1. mmproj 读取图片
2. Vision Encoder 生成视觉特征
3. Merger 将视觉特征变成 1024 维视觉 Token
4. 用视觉 Token 替换 <image> 占位 Embedding
5. 主 GGUF 的 Gated DeltaNet/Attention 处理统一序列
6. 语言模型生成文本
```
{% endraw %}

这样做的好处是：允许纯文本模式省内存。[llama.cpp多模态说明](https://github.com/ggml-org/llama.cpp/tree/master/tools/mtmd)。

<div class="feishu-table" role="region" aria-label="对比表，可横向滚动" tabindex="0"><table>
<tr><td>部分</td><td>文件大小</td></tr>
<tr><td>Q4_K_M 语言模型</td><td>533 MB</td></tr>
<tr><td>F16 mmproj</td><td>205 MB</td></tr>
<tr><td>合计</td><td>约 738 MB</td></tr>
</table></div>

<https://huggingface.co/google/gemma-4-E2B-it-qat-q4_0-gguf/tree/main>

![Llama.cpp iOS 端侧部署实践配图]({{ '/assets/posts/llama-cpp-ios/387.png' | relative_url }})

### 推理框架 Llama.cpp

<https://github.com/ggml-org/llama.cpp/tree/master>

**llama.cpp 是一个用 C/C++ 实现的高性能大语言模型推理框架**。它最初用于在普通电脑上运行 Meta 的 LLaMA 模型，现在已经支持 Qwen、Gemma、Mistral、DeepSeek 等大量模型架构。

比如<https://ollama.com/>、<https://lmstudio.ai/>、<https://chatboxai.app/en>都是以llama.cpp为推理内核的流行的本地模型对话应用。

![Llama.cpp iOS 端侧部署实践配图]({{ '/assets/posts/llama-cpp-ios/392.png' | relative_url }})

{% raw %}
```text
flowchart LR
    A["iOS / Swift"] --> B["llama C API"]
    B --> C["模型、Context、计算图"]
    C --> D["GGML Backend Scheduler"]
    D --> E["Metal GPU"]
    D --> F["ARM CPU / Accelerate"]
    G["GGUF 模型"] --> C
```
{% endraw %}

<div class="feishu-table" role="region" aria-label="对比表，可横向滚动" tabindex="0"><table>
<tr><td>语言</td><td>大小</td><td>占比</td></tr>
<tr><td>C++</td><td>21.75 MB</td><td><strong>55.94%</strong></td></tr>
<tr><td>C</td><td>6.28 MB</td><td><strong>16.16%</strong></td></tr>
<tr><td>Python</td><td>2.83 MB</td><td><strong>7.29%</strong></td></tr>
<tr><td>CUDA</td><td>2.10 MB</td><td><strong>5.39%</strong></td></tr>
<tr><td>TypeScript</td><td>1.60 MB</td><td><strong>4.11%</strong></td></tr>
<tr><td>Svelte</td><td>0.83 MB</td><td><strong>2.12%</strong></td></tr>
<tr><td>HTML</td><td>0.78 MB</td><td><strong>2.00%</strong></td></tr>
<tr><td>Metal</td><td>0.60 MB</td><td><strong>1.55%</strong></td></tr>
<tr><td>Jinja</td><td>0.45 MB</td><td><strong>1.15%</strong></td></tr>
<tr><td>GLSL</td><td>0.38 MB</td><td><strong>0.99%</strong></td></tr>
<tr><td>CMake</td><td>0.29 MB</td><td><strong>0.76%</strong></td></tr>
<tr><td>Shell</td><td>0.29 MB</td><td><strong>0.76%</strong></td></tr>
<tr><td>WGSL</td><td>0.22 MB</td><td><strong>0.58%</strong></td></tr>
<tr><td>Go Template</td><td>0.21 MB</td><td><strong>0.55%</strong></td></tr>
<tr><td>Objective-C</td><td>0.12 MB</td><td><strong>0.31%</strong></td></tr>
<tr><td>其他</td><td>约 0.14 MB</td><td><strong>0.35%</strong></td></tr>
</table></div>

主要函数

{% raw %}
```bash
Swift
 ├─ llama_backend_init()                   # 初始化 llama.cpp 后端及全局运行环境
 ├─ llama_model_load_from_file()           # 从 GGUF 文件加载模型结构、权重和元数据
 ├─ llama_init_from_model()                # 基于模型创建推理上下文（Context、KV Cache 等）
 ├─ llama_tokenize()                       # 将输入文本编码为 Token ID 序列
 ├─ llama_decode()                         # 执行一批 Token 的模型前向计算
 │    ├─ llama_context::decode()            # 进入 Context 内部的解码实现
 │    ├─ process_ubatch()                   # 将输入批次拆分并处理为微批次（ubatch）
 │    ├─ llama_model::build_graph()         # 根据模型结构构建 GGML 计算图
 │    ├─ ggml_backend_sched_graph_compute_async()
 │    │                                    # 调度计算图，将算子分配到不同计算后端并异步执行
 │    └─ Metal / CPU kernel                # 在 Apple GPU 或 ARM CPU 上执行具体算子
 ├─ llama_sampler_sample()                 # 根据 logits 和采样策略选择下一个 Token
 └─ llama_token_to_piece()                 # 将生成的 Token ID 解码为文本片段
```
{% endraw %}

#### 源码文件：

<div class="feishu-table" role="region" aria-label="对比表，可横向滚动" tabindex="0"><table>
<tr><td>文件</td><td>作用</td></tr>
<tr><td><code>include/llama.h</code></td><td>最重要的公共 C API；iOS Swift 通过桥接层直接导入这一层</td></tr>
<tr><td><code>src/llama.cpp</code></td><td>API 门面、后端初始化、模型加载入口，以及部分公共接口实现</td></tr>
<tr><td><code>src/llama-context.cpp</code></td><td>管理 Context、KV Cache、encode/decode 和计算图执行</td></tr>
<tr><td><code>src/llama-model.cpp</code></td><td>模型对象、超参数与权重加载、设备分配及计算图构建入口</td></tr>
<tr><td><code>src/llama-model-loader.cpp</code></td><td>读取 GGUF 与分片模型，管理 mmap，并将模型权重装载到相应设备</td></tr>
<tr><td><code>src/llama-sampler.cpp</code></td><td>实现 temperature、top-k、top-p、min-p、重复惩罚等采样算法</td></tr>
<tr><td><code>src/llama-vocab.cpp</code></td><td>实现 tokenizer、Token 与文本片段的相互转换，以及特殊 Token 管理</td></tr>
<tr><td><code>src/llama-chat.cpp</code></td><td>Chat Template 的解析、检测和应用</td></tr>
</table></div>

一个大的context管理模型的推理上下文。

![Llama.cpp iOS 端侧部署实践配图]({{ '/assets/posts/llama-cpp-ios/400.png' | relative_url }})

#### 模型架构实现

<div class="feishu-table" role="region" aria-label="对比表，可横向滚动" tabindex="0"><table>
<tr><td>文件</td><td>作用</td></tr>
<tr><td><code>src/llama-arch.h</code> / <code>src/llama-arch.cpp</code></td><td>定义模型架构枚举、GGUF metadata key，以及标准 Tensor 名称映射</td></tr>
<tr><td><code>src/llama-hparams.cpp</code></td><td>从 GGUF metadata 中解析模型层数、Embedding 维度、Attention Head、RoPE 等超参数</td></tr>
<tr><td><code>src/llama-graph.cpp</code></td><td>提供 Attention、FFN、MoE、RoPE 等通用计算图构造部件</td></tr>
<tr><td><code>src/models/llama.cpp</code></td><td>实现 Llama、Llama 2、Llama 3 等架构的权重声明和计算图构建</td></tr>
<tr><td><code>src/models/qwen2.cpp</code></td><td>实现 Qwen2 系列模型的权重声明和计算图构建</td></tr>
<tr><td><code>src/models/gemma.cpp</code></td><td>实现 Gemma 系列模型的权重声明和计算图构建</td></tr>
<tr><td><code>src/models/*.cpp</code></td><td>各模型架构的独立实现目录；新增模型通常需要在此实现相应的权重布局与计算图</td></tr>
</table></div>

从模型的graph，就可以了解到模型在推理时候的具体实现了：

![Llama.cpp iOS 端侧部署实践配图]({{ '/assets/posts/llama-cpp-ios/2527.png' | relative_url }})

![Llama.cpp iOS 端侧部署实践配图]({{ '/assets/posts/llama-cpp-ios/2529.png' | relative_url }})

#### Metal 后端文件

<div class="feishu-table" role="region" aria-label="对比表，可横向滚动" tabindex="0"><table>
<tr><td>文件</td><td>作用</td></tr>
<tr><td><code>ggml/src/ggml-metal/ggml-metal.cpp</code></td><td>Metal backend 的公共入口，负责 Buffer 管理、Backend 接口和计算图执行</td></tr>
<tr><td><code>ggml-metal-device.m</code> / <code>ggml-metal-device.cpp</code></td><td>管理 <code>MTLDevice</code>、查询 GPU 能力，并完成 Metal backend 的设备注册与 C++ 接口衔接</td></tr>
<tr><td><code>ggml-metal-context.m</code></td><td>管理 Command Queue、Command Buffer、Pipeline 和 Metal Runtime 上下文</td></tr>
<tr><td><code>ggml-metal-ops.cpp</code></td><td>将 GGML 运算节点分发到对应的 Metal Pipeline 和 Kernel</td></tr>
<tr><td><code>ggml-metal-fusion.cpp</code></td><td>识别并执行可融合的算子组合，减少中间数据读写和 Kernel 启动开销</td></tr>
<tr><td><code>kernels/mul_mm.metal</code></td><td>矩阵乘矩阵 Kernel，主要影响 Prompt Prefill 等批量计算</td></tr>
<tr><td><code>kernels/mul_mv.metal</code></td><td>矩阵乘向量 Kernel，对单 Token 自回归解码尤其重要</td></tr>
<tr><td><code>kernels/fa.metal</code></td><td>Flash Attention Kernel，融合 Attention 的多个计算步骤</td></tr>
<tr><td><code>kernels/rope.metal</code></td><td>RoPE 旋转位置编码 Kernel</td></tr>
<tr><td><code>kernels/norm.metal</code></td><td>RMSNorm 等归一化运算 Kernel</td></tr>
<tr><td><code>kernels/softmax.metal</code></td><td>Softmax 运算 Kernel</td></tr>
<tr><td><code>kernels/dequantize.h</code></td><td>定义量化权重在 GPU 侧的反量化与解包逻辑</td></tr>
</table></div>

官方构建文档确认 Metal 是 Apple 平台的 GPU 加速后端：[build.md](https://github.com/ggml-org/llama.cpp/blob/master/docs/build.md)。

这里可以看到 kernel\_conv\_2d 是多GPU线程逐个元素计算的，没有怎么优化过。

这里发起了多个Shader线程做计算

- CPU：通常只有几个到几十个硬件执行线程，适合复杂控制流和低延迟任务。

- GPU：一次可以保持和调度大量轻量级 shader 线程，适合高度并行的矩阵、图像和向量运算。

- GPU 的一个线程远比 CPU 线程轻量，通常没有独立的完整执行资源；很多 GPU 线程组成 SIMD 批次，共享执行单元。

我们可以发起 `1,000,000` 个 Metal 线程，但 GPU 可能每次只让其中几千或几万个处于活跃状态，其余排队执行。

![Llama.cpp iOS 端侧部署实践配图]({{ '/assets/posts/llama-cpp-ios/417.png' | relative_url }})

不过其实有更高效的卷积方式，把卷积拆成 im2col + mul\_mat：<https://github.com/ggml-org/llama.cpp/blob/master/ggml/src/ggml.c#L4748-L4775>，或者是`GGML_OP_SSM_CONV`的

{% raw %}
```go
// ggml_conv_2d

// a: [OC，IC, KH, KW]
// b: [N, IC, IH, IW]
// result: [N, OC, OH, OW]
struct ggml_tensor * ggml_conv_2d(
 struct ggml_context * ctx,
 struct ggml_tensor  * a,
 struct ggml_tensor  * b,
 int                   s0,
 int                   s1,
 int                   p0,
 int                   p1,
 int                   d0,
 int                   d1) {
 struct ggml_tensor * im2col = ggml_im2col(ctx, a, b, s0, s1, p0, p1, d0, d1, true, a->type == GGML_TYPE_BF16 ? GGML_TYPE_F32 : GGML_TYPE_F16); // [N, OH, OW, IC * KH * KW]

 struct ggml_tensor * result =
        ggml_mul_mat(ctx,
                ggml_reshape_2d(ctx, im2col, im2col->ne[0],  im2col->ne[3] * im2col->ne[2] * im2col->ne[1]), // [N, OH, OW, IC * KH * KW] => [N*OH*OW, IC * KH * KW]
                ggml_reshape_2d(ctx, a, (a->ne[0] * a->ne[1] * a->ne[2]),  a->ne[3]));                       // [OC，IC, KH, KW] => [OC, IC * KH * KW]

    result = ggml_reshape_4d(ctx, result, im2col->ne[1], im2col->ne[2], im2col->ne[3], a->ne[3]); // [OC, N, OH, OW]
    result = ggml_cont(ctx, ggml_permute(ctx, result, 0, 1, 3, 2)); // [N, OC, OH, OW]


 return result;
}
```
{% endraw %}

#### CPU 和 GPU 如何配合

在 iPhone 上：

- 权重一般交给 Metal backend。

- 部分不适合或不支持的算子可能在 CPU 执行。

- `ggml_backend_sched` 根据 tensor 所在设备、算子支持情况和 buffer 类型切分计算图。

- Prompt Processing 主要是较大的矩阵乘法。

- 单 token Generation 主要是矩阵向量乘法，内存带宽影响明显。

- Apple Silicon 使用统一内存，日志里的“VRAM offload”并不意味着存在独立显存。

当前 `llama_model_default_params()` 中 `n_gpu_layers = -1`，表示默认尽量把所有层放到 GPU。官方 SwiftUI 示例在模拟器上则显式设置：

{% raw %}
```text
model_params.n_gpu_layers = 0
```
{% endraw %}

因此性能测试应在真机 Release 构建中进行，而不是以模拟器结果判断 Metal 性能。

#### GGUF metadata 包含什么

常见字段包括：

{% raw %}
```text
general.architecture
general.name
general.file_type
general.quantization_version

llama.context_length
llama.embedding_length
llama.block_count
llama.attention.head_count
llama.attention.head_count_kv
llama.rope.dimension_count

tokenizer.ggml.model
tokenizer.ggml.tokens
tokenizer.ggml.scores
tokenizer.ggml.token_type
tokenizer.chat_template
```
{% endraw %}

字段前缀会随架构变化，例如 Qwen、Gemma 使用各自的架构前缀。

GGUF 的重要价值是：

- 权重、超参数、词表和 Chat Template 可以放在同一容器中；

- tensor 数据带 offset 和 alignment，适合 `mmap`；

- metadata 可扩展；

- 每个 tensor 可以有不同的数据类型；

- 支持大型模型拆分成多个 GGUF shard。

#### 量化格式

常见权重类型：

<div class="feishu-table" role="region" aria-label="对比表，可横向滚动" tabindex="0"><table>
<tr><td>F32</td><td>精度最高，体积和内存最大</td></tr>
<tr><td>F16/BF16</td><td>常用的未量化或转换中间格式</td></tr>
<tr><td>Q8_0</td><td>质量接近浮点，体积仍较大</td></tr>
<tr><td>Q6_K</td><td>较高质量</td></tr>
<tr><td>Q5_K_M</td><td>质量和体积偏保守</td></tr>
<tr><td>Q4_K_M</td><td>移动端常见的均衡选择</td></tr>
<tr><td>Q4_0</td><td>简单、兼容性好，但通常不如 K-quant</td></tr>
<tr><td>Q3_K、Q2_K</td><td>更小，但质量损失明显</td></tr>
<tr><td>IQ*</td><td>importance-aware 系列，低 bit 下改善质量，但要确认目标后端 kernel 支持情况</td></tr>
</table></div>

需要特别注意：

`Q4_K_M.gguf` 是量化配方或整体文件类型，不表示文件里每个 tensor 都是 Q4\_K。

例如 embedding、output tensor 可能保留成 Q6\_K、Q8\_0 或更高精度。真正的数据类型记录在每个 tensor descriptor 中。

#### iOS 选型建议

比较稳妥的起点是：

- 模型规模：1B～3B。

- 量化：先用 `Q4_K_M`；质量更重要时尝试 `Q5_K_M`。

- Context：先设 2048 或 4096，不要一开始追求模型声明的最大上下文。

- GPU：真机默认全层 Metal。

- 模型存储：下载到 Application Support/Documents 后从文件路径加载。

- 并发：每个活跃会话独立 context；不要并发调用同一个 context。

- 生命周期：切后台或内存警告时考虑释放 context/model。

总内存并不等于 GGUF 文件大小，大致还包括：

{% raw %}
```text
模型权重
+ KV Cache（随上下文长度和层数增长）
+ Metal/CPU 计算缓冲区
+ logits、tokenizer 和 App 本身
```
{% endraw %}

因此一个磁盘上能放下的模型，不一定能在 iPhone 的内存限制下稳定运行。

### 使用方式

以下三种方式，其实都是把llama.cpp的C函数直接暴露给Swift，只是封装的程度不同。

1. llama.cpp官方提供的XCFramework: <https://github.com/ggml-org/llama.cpp/blob/master/docs/xcframework.md>

1. llama.swift: <https://github.com/mattt/llama.swift>

1. AnyLanguageModel: <https://github.com/huggingface/AnyLanguageModel>

实际推荐直接使用第一种或者第二种，第三种虽然和第二种一样也是[mattt](https://github.com/mattt)大神维护的项目，但是更新迭代特别缓慢。比如我在使用第三种的时候发现依赖的llama.cpp版本太低，导致无法使用多模态能力，就只能自己切分支打XCFramework了。

![Llama.cpp iOS 端侧部署实践配图]({{ '/assets/posts/llama-cpp-ios/467.png' | relative_url }})

Swift的推理框架比较荒凉，也包括基于CoreML的swfit-transformer，等支持Qwen3.5等到花都谢了。

1. <https://github.com/huggingface/swift-transformers>， 应用层：<https://github.com/huggingface/swift-chat>

如果不开发的情况下，想直接在移动端试试，推荐使用<https://github.com/a-ghorbani/pocketpal-ai> 进行测试。

### 一般流程

{% raw %}
```swift
// 初始化
let model = llama_model_load_from_file(modelPath, modelParams) 
let context = llama_init_from_model(model!, contextParams) 
if llama_get_memory(context) == nil {
 throw LlamaLanguageModelError.encoderOnlyModel
}
llama_set_causal_attn(context, true)
llama_set_warmup(context, false)
llama_set_n_threads(context, runtimeOptions.threads, runtimeOptions.threads)

// 获得词表
let vocab = llama_model_get_vocab(model) 
// prompt转换成token
let maxTokens = Int32(max(utf8Count * 2, 8))  // Rough estimate, minimum capacity
let tokens = UnsafeMutablePointer<llama_token>.allocate(capacity: Int(maxTokens))
let tokenCount = llama_tokenize(
                vocab,
                text,
 Int32(utf8Count),
                tokens, // 这里token
                maxTokens,
                addSpecial,
 true // parseSpecial
            )
// 填充context的批次
var batch = llama_batch_init(Int32(options.batchSize), 0, 1)
defer { llama_batch_free(batch) }
for i in 0..<promptTokens.count {
      batch.token[i]   = promptTokens[i]   // token id
      batch.pos[i]     = i                 // 位置
      batch.n_seq_id[i] = 1
      batch.seq_id[i]![0] = 0
      batch.logits[i]  = (i == promptTokens.count-1) ? 1 : 0 // 只有最后一个要输出 logits
  }
  batch.n_tokens = promptTokens.count
// prefill：把 prompt 真正过一遍网络，同时填充 KV cache
llama_decode(context, batch) 
// 初始化输出的采样器
let sampler = llama_sampler_chain_init(llama_sampler_chain_default_params())
defer { llama_sampler_free(sampler) }
let samplerPtr = UnsafeMutablePointer<llama_sampler>(sampler)
// 生成循环：sample → decode → 再 sample …
var n_cur = promptTokens.count
for _ in 0..<maxTokens {
 // 从最后一个位置的 logits 采样
 let nextToken = llama_sampler_sample(sampler, context, -1)  
  llama_sampler_accept(sampler, nextToken)
 // 遇到结束符就停
 if llama_vocab_is_eog(vocab, nextToken) { break }   
 // 输出这 1 个 token
 let text = tokenToText(vocab, nextToken)            
 // 把刚采样的 token 组装成「单 token batch」，再 decode
  batch.n_tokens = 1
  batch.token[0]  = nextToken
  batch.pos[0]    = n_cur
  batch.seq_id[0]![0] = 0
  batch.logits[0] = 1
  n_cur += 1
  llama_decode(context, batch)   // ← 生成阶段的 decode
}
```
{% endraw %}

加载模型：llama.cpp的日志。

Qwen3.5-0.8B

{% raw %}
```cpp
llama_model_loader: loaded meta data with 46 key-value pairs and 320 tensors from /var/mobile/Containers/Data/Application/23ABB35A-D928-4C75-8FA9-234D806339F7/Library/Application Support/copytain_fs/models/local/Qwen3.5-0.8B-Q4_K_M.gguf (version GGUF V3 (latest))
llama_model_loader: Dumping metadata keys/values. Note: KV overrides do not apply in this output.
llama_model_loader: - kv   0:                       general.architecture str              = qwen35
llama_model_loader: - kv   1:                               general.type str              = model
llama_model_loader: - kv   2:                               general.name str              = Qwen3.5-0.8B
llama_model_loader: - kv   3:                           general.basename str              = Qwen3.5-0.8B
llama_model_loader: - kv   4:                       general.quantized_by str              = Unsloth
llama_model_loader: - kv   5:                         general.size_label str              = 0.8B
llama_model_loader: - kv   6:                            general.license str              = apache-2.0
llama_model_loader: - kv   7:                       general.license.link str              = https://huggingface.co/Qwen/Qwen3.5-0...
llama_model_loader: - kv   8:                           general.repo_url str              = https://huggingface.co/unsloth
llama_model_loader: - kv   9:                   general.base_model.count u32              = 1
llama_model_loader: - kv  10:                  general.base_model.0.name str              = Qwen3.5 0.8B
llama_model_loader: - kv  11:          general.base_model.0.organization str              = Qwen
llama_model_loader: - kv  12:              general.base_model.0.repo_url str              = https://huggingface.co/Qwen/Qwen3.5-0.8B
llama_model_loader: - kv  13:                               general.tags arr[str,1]       = ["image-text-to-text"]
llama_model_loader: - kv  14:                         qwen35.block_count u32              = 24
llama_model_loader: - kv  15:                      qwen35.context_length u32              = 262144
llama_model_loader: - kv  16:                    qwen35.embedding_length u32              = 1024
llama_model_loader: - kv  17:                 qwen35.feed_forward_length u32              = 3584
llama_model_loader: - kv  18:                qwen35.attention.head_count u32              = 8
llama_model_loader: - kv  19:             qwen35.attention.head_count_kv u32              = 2
llama_model_loader: - kv  20:             qwen35.rope.dimension_sections arr[i32,4]       = [11, 11, 10, 0]
llama_model_loader: - kv  21:                      qwen35.rope.freq_base f32              = 10000000.000000
llama_model_loader: - kv  22:    qwen35.attention.layer_norm_rms_epsilon f32              = 0.000001
llama_model_loader: - kv  23:                qwen35.attention.key_length u32              = 256
llama_model_loader: - kv  24:              qwen35.attention.value_length u32              = 256
llama_model_loader: - kv  25:                     qwen35.ssm.conv_kernel u32              = 4
llama_model_loader: - kv  26:                      qwen35.ssm.state_size u32              = 128
llama_model_loader: - kv  27:                     qwen35.ssm.group_count u32              = 16
llama_model_loader: - kv  28:                  qwen35.ssm.time_step_rank u32              = 16
llama_model_loader: - kv  29:                      qwen35.ssm.inner_size u32              = 2048
llama_model_loader: - kv  30:             qwen35.full_attention_interval u32              = 4
llama_model_loader: - kv  31:                qwen35.rope.dimension_count u32              = 64
llama_model_loader: - kv  32:                       tokenizer.ggml.model str              = gpt2
llama_model_loader: - kv  33:                         tokenizer.ggml.pre str              = qwen35
llama_model_loader: - kv  34:                      tokenizer.ggml.tokens arr[str,248320]  = ["!", "\"", "#", "$", "%", "&", "'", ...
llama_model_loader: - kv  35:                  tokenizer.ggml.token_type arr[i32,248320]  = [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, ...
llama_model_loader: - kv  36:                      tokenizer.ggml.merges arr[str,247587]  = ["Ġ Ġ", "ĠĠ ĠĠ", "i n", "Ġ t",...
llama_model_loader: - kv  37:                tokenizer.ggml.eos_token_id u32              = 248046
llama_model_loader: - kv  38:            tokenizer.ggml.padding_token_id u32              = 248055
llama_model_loader: - kv  39:                    tokenizer.chat_template str              = {%- set image_count = namespace(value...
llama_model_loader: - kv  40:               general.quantization_version u32              = 2
llama_model_loader: - kv  41:                          general.file_type u32              = 15
llama_model_loader: - kv  42:                      quantize.imatrix.file str              = Qwen3.5-0.8B-GGUF/imatrix_unsloth.gguf
llama_model_loader: - kv  43:                   quantize.imatrix.dataset str              = unsloth_calibration_Qwen3.5-0.8B.txt
llama_model_loader: - kv  44:             quantize.imatrix.entries_count u32              = 186
llama_model_loader: - kv  45:              quantize.imatrix.chunks_count u32              = 80
llama_model_loader: - type  f32:  133 tensors
llama_model_loader: - type q8_0:   36 tensors
llama_model_loader: - type q4_K:   98 tensors
llama_model_loader: - type q5_K:   36 tensors
llama_model_loader: - type q6_K:   17 tensors
llama_prepare_model_devices: using device MTL0 (Apple A19 Pro GPU) (unknown id) - 8191 MiB free
```
{% endraw %}

{% raw %}
```cpp
llama_model_loader: Dumping metadata keys/values. Note: KV overrides do not apply in this output.
llama_model_loader: - kv   0:                       general.architecture str              = gemma4
llama_model_loader: - kv   1:                               general.type str              = model
llama_model_loader: - kv   2:                     general.sampling.top_k i32              = 64
llama_model_loader: - kv   3:                     general.sampling.top_p f32              = 0.950000
llama_model_loader: - kv   4:                      general.sampling.temp f32              = 1.000000
llama_model_loader: - kv   5:                               general.name str              = 2B_dequant_qat_it_hf
llama_model_loader: - kv   6:                           general.finetune str              = 2B_dequant_qat_it_hf
llama_model_loader: - kv   7:                         general.size_label str              = 4.6B
llama_model_loader: - kv   8:                         gemma4.block_count u32              = 35
llama_model_loader: - kv   9:                      gemma4.context_length u32              = 131072
llama_model_loader: - kv  10:                    gemma4.embedding_length u32              = 1536
llama_model_loader: - kv  11:                 gemma4.feed_forward_length arr[i32,35]      = [6144, 6144, 6144, 6144, 6144, 6144, ...
llama_model_loader: - kv  12:                gemma4.attention.head_count u32              = 8
llama_model_loader: - kv  13:             gemma4.attention.head_count_kv u32              = 1
llama_model_loader: - kv  14:                      gemma4.rope.freq_base f32              = 1000000.000000
llama_model_loader: - kv  15:                  gemma4.rope.freq_base_swa f32              = 10000.000000
llama_model_loader: - kv  16:    gemma4.attention.layer_norm_rms_epsilon f32              = 0.000001
llama_model_loader: - kv  17:                gemma4.attention.key_length u32              = 512
llama_model_loader: - kv  18:              gemma4.attention.value_length u32              = 512
llama_model_loader: - kv  19:             gemma4.final_logit_softcapping f32              = 30.000000
llama_model_loader: - kv  20:            gemma4.attention.sliding_window u32              = 512
llama_model_loader: - kv  21:          gemma4.attention.shared_kv_layers u32              = 20
llama_model_loader: - kv  22:    gemma4.embedding_length_per_layer_input u32              = 256
llama_model_loader: - kv  23:    gemma4.attention.sliding_window_pattern arr[bool,35]     = [true, true, true, true, false, true,...
llama_model_loader: - kv  24:            gemma4.attention.key_length_swa u32              = 256
llama_model_loader: - kv  25:          gemma4.attention.value_length_swa u32              = 256
llama_model_loader: - kv  26:                gemma4.rope.dimension_count u32              = 512
llama_model_loader: - kv  27:            gemma4.rope.dimension_count_swa u32              = 256
llama_model_loader: - kv  28:                       tokenizer.ggml.model str              = gemma4
llama_model_loader: - kv  29:                      tokenizer.ggml.tokens arr[str,262144]  = ["<pad>", "<eos>", "<bos>", "<unk>", ...
llama_model_loader: - kv  30:                      tokenizer.ggml.scores arr[f32,262144]  = [-1000.000000, -1000.000000, -1000.00...
llama_model_loader: - kv  31:                  tokenizer.ggml.token_type arr[i32,262144]  = [3, 3, 3, 3, 3, 1, 1, 1, 1, 1, 1, 1, ...
llama_model_loader: - kv  32:                      tokenizer.ggml.merges arr[str,514906]  = ["\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n \n", ...
llama_model_loader: - kv  33:                tokenizer.ggml.bos_token_id u32              = 2
llama_model_loader: - kv  34:                tokenizer.ggml.eos_token_id u32              = 1
llama_model_loader: - kv  35:            tokenizer.ggml.unknown_token_id u32              = 3
llama_model_loader: - kv  36:            tokenizer.ggml.padding_token_id u32              = 0
llama_model_loader: - kv  37:               tokenizer.ggml.mask_token_id u32              = 4
llama_model_loader: - kv  38:                    tokenizer.chat_template str              = {%- macro format_parameters(propertie...
llama_model_loader: - kv  39:            tokenizer.ggml.add_space_prefix bool             = false
llama_model_loader: - kv  40:               tokenizer.ggml.add_bos_token bool             = true
llama_model_loader: - kv  41:               general.quantization_version u32              = 2
llama_model_loader: - kv  42:                          general.file_type u32              = 2
llama_model_loader: - type  f32:  263 tensors
llama_model_loader: - type  f16:    1 tensors
llama_model_loader: - type q4_0:  275 tensors
llama_model_loader: - type q6_K:    2 tensors
llama_prepare_model_devices: using device MTL0 (Apple A19 Pro GPU) (unknown id) - 8191 MiB free
```
{% endraw %}

### token/s

<https://huggingface.co/spaces/a-ghorbani/ai-phone-leaderboard>

以iPhone17pro为例，Qwen3.5-0.8B的4bit量化可以跑出60+token/s， Gemma4-e2b的4bit量化可以跑出20+token/s。

<div class="feishu-table" role="region" aria-label="对比表，可横向滚动" tabindex="0"><table>
<tr><td>设备情况</td><td>Qwen3.5-0.8 本地评测</td><td>Gemma4-e2b本地评测</td></tr>
<tr><td><img src="{{ '/assets/posts/llama-cpp-ios/2626.jpg' | relative_url }}" alt="Llama.cpp iOS 端侧部署实践配图" loading="lazy"></td><td><img src="{{ '/assets/posts/llama-cpp-ios/2628.jpg' | relative_url }}" alt="Llama.cpp iOS 端侧部署实践配图" loading="lazy"></td><td><img src="{{ '/assets/posts/llama-cpp-ios/2630.jpg' | relative_url }}" alt="Llama.cpp iOS 端侧部署实践配图" loading="lazy"></td></tr>
<tr><td>11.4GB 6core Metal后端</td><td>85.09token/s 内存峰值1G</td><td>37.81token/s，内存峰值4G<br>
(PocketAI的运行配置没有优化过， gpu_layer=99常驻内存，应当改成n_gpu_layers = 0， 减小峰值<br>
<img src="{{ '/assets/posts/llama-cpp-ios/2638.png' | relative_url }}" alt="Llama.cpp iOS 端侧部署实践配图" loading="lazy"><br>
)</td></tr>
</table></div>

录屏：

<div class="feishu-table" role="region" aria-label="对比表，可横向滚动" tabindex="0"><table>
<tr><td>Qwen3.5-0.8B<br>
对话</td><td>Qwen3.5-0.8B<br>
思考对话</td><td>Gemma4-e2b<br>
对话</td><td>Gemma4-e2b<br>
思考对话</td></tr>
<tr><td><a href="https://xr2hd33jjg.feishu.cn/docx/NkhQdqehPo5gPUxVtA5ctoFcnPb#RGm6dEY9yoUBf6x3fmYcDL7TnNb">查看原文演示视频</a></td><td><a href="https://xr2hd33jjg.feishu.cn/docx/NkhQdqehPo5gPUxVtA5ctoFcnPb#SsBidMY4Qo68y3x9uAGcGjsFnbe">查看原文演示视频</a></td><td><a href="https://xr2hd33jjg.feishu.cn/docx/NkhQdqehPo5gPUxVtA5ctoFcnPb#DeNNd8VDIoydQGx4QjqcXMnFnOb">查看原文演示视频</a></td><td><a href="https://xr2hd33jjg.feishu.cn/docx/NkhQdqehPo5gPUxVtA5ctoFcnPb#ZVzPdQhmoowEFoxPk8gcKYrin3e">查看原文演示视频</a></td></tr>
<tr><td>正常<br>
67.97token/s<br>
106ms TTFT</td><td>思考死循环<br>
41.92token/s<br>
40TTFT</td><td>正常<br>
27.95token/s<br>
140ms TTFT</td><td>正常<br>
18.78token/s<br>
225 TTFT</td></tr>
</table></div>

### 工具调用

<div class="feishu-table" role="region" aria-label="对比表，可横向滚动" tabindex="0"><table>
<tr><td>Qwen3.5-0.8B<br>
调用自定义sh工具</td><td>Gemma4-e2b<br>
调用自定义sh工具</td></tr>
<tr><td><a href="https://xr2hd33jjg.feishu.cn/docx/NkhQdqehPo5gPUxVtA5ctoFcnPb#QhDudbh29ongqfxU06fcIzbQnEb">查看原文演示视频</a><br>
输出一堆无用token</td><td><a href="https://xr2hd33jjg.feishu.cn/docx/NkhQdqehPo5gPUxVtA5ctoFcnPb#ERDsdkmu9oJIcMxs0yhcoIBUnsh">查看原文演示视频</a><br>
符合要求</td></tr>
<tr><td>Qwen3.5-0.8B<br>
结合工具回复</td><td>Gemma4-e2b<br>
结合工具回复</td></tr>
<tr><td><a href="https://xr2hd33jjg.feishu.cn/docx/NkhQdqehPo5gPUxVtA5ctoFcnPb#V1djdqfBrogFpfxtlKKc2HMTngb">查看原文演示视频</a></td><td><a href="https://xr2hd33jjg.feishu.cn/docx/NkhQdqehPo5gPUxVtA5ctoFcnPb#ZBUid4TNuo0nCaxvKvTcwDNInsf">查看原文演示视频</a></td></tr>
</table></div>

工具调用的定义在system prompt中添加上就可以。

![Llama.cpp iOS 端侧部署实践配图]({{ '/assets/posts/llama-cpp-ios/494.png' | relative_url }})

- Qwen3.5-0.8B的回复速度更快，如果不死循环，并且更好控制，体验上会好很多

- Gemma4-e2b虽然回复的慢，发热更明显，但是回复质量更好，废话也更少。

新的模型的chat template在llama.cpp的支持速度是没有太快的，比如gemma4-e2b 3月31日发布

<https://github.com/ggml-org/llama.cpp/pull/21418>

<https://github.com/ggml-org/llama.cpp/pull/21760>

但是到比较稳定支持，需要到2026年4月13日之后，所以最好及时同步llama.cpp的版本。

Gemma的ChatTemplate和Qwen的ChatTemplate是完全不同的：

- <https://huggingface.co/google/gemma-4-E2B-it/blob/main/chat_template.jinja>

- <https://huggingface.co/Qwen/Qwen3-30B-A3B-Thinking-2507/blob/8217eea09b2a3771bcd6d881189a7ed315e148fe/chat_template.jinja>

{% raw %}
```swift
 Qwen3 通常把工具结果作为一个模拟的 user turn：

 <|im_start|>user
 <tool_response>
  命令输出
 </tool_response>
 <|im_end|>

 Gemma 4 使用自己的结果结构：

 <|tool_response>
  response:sh{value:<|"|>命令输出<|"|>}
 <tool_response|>
```
{% endraw %}

### 多模态

<div class="feishu-table" role="region" aria-label="对比表，可横向滚动" tabindex="0"><table>
<tr><td>Qwen3.5-0.8B</td><td>Gemma4-e2b</td></tr>
<tr><td><a href="https://xr2hd33jjg.feishu.cn/docx/NkhQdqehPo5gPUxVtA5ctoFcnPb#FIDldtTxNoNfhzxdTftcaaw8njg">查看原文演示视频</a></td><td><a href="https://xr2hd33jjg.feishu.cn/docx/NkhQdqehPo5gPUxVtA5ctoFcnPb#MgE6dDbrLoPDY9xT8oickJiSnId">查看原文演示视频</a></td></tr>
</table></div>

- Qwen3.5-0.8B的回复速度更快，文本token填充更快，解读图片体验更好。

- Gemma4-e2b的视觉token填充比较慢。

### 未来展望

我们有理由相信，以后的本地模型，应当能够以2～4B的参数量达到现在桌面端本地模型的27B左右的智能程度（大学生程度），每个人在本地有一个无需上传数据的贾维斯是完全能够做到的，长时间地稳定地关照体贴个人的生活。

我们也能够展望，家用机器人的端侧部署，能够使用32B左右的本地模型，达到当前云端300B左右打模型的智能程度，动态识别环境信息，代替我们执行反复的家务活，帮助我们维护家庭的日常事务、安全，作为可靠的家庭伙伴而存在，一个真正的家庭管家。

而面对更长远的未来，机器人的社会、宗教、文化、信仰，则由他们自己去构建。

#### VLA：

实际上：Gemma4-e2b、Qwen3.5-0.8B已经在VLA领域应用中：

1. Kaggle上基于Gemma4-e2b的机械臂 <https://www.kaggle.com/competitions/gemma-4-good-hackathon/writeups/new-writeup-1778618527713>

1. 树莓派上运行Gemma4e2b <https://alphasignal.ai/news/google-runs-gemma-4-e2b-fully-offline-on-a-175-raspberry-pi>

1. 英伟达的Gemma4教程： <https://huggingface.co/blog/nvidia/gemma4>

1. 相关原理讲解：(非Gemma4-e2b，介绍 <https://arxiv.org/html/2410.24164v1> Pi0)

<a href="https://www.youtube.com/watch?v=2mrGMMmrVNE">观看视频</a>

![Llama.cpp iOS 端侧部署实践配图]({{ '/assets/posts/llama-cpp-ios/2717.jpeg' | relative_url }})

### 坑

#### Qwen3.5-0.8B的思考模式控制难以生效

模型倾向于开启思考，有时候会无法关闭。

原因：Qwen3.5-0.8B的指令遵从很差，即便通过chat template指定了关闭思考，也会继续思考，网友们都遇到了。

<https://github.com/ggml-org/llama.cpp/issues/20182>

后续新的chat template应该可以，还没验证。

#### llama.cpp的多模态模块mtmd需要单独编译出来产物发布

最初官方 llama.swift 的 XCFramework 没有导出 mtmd.h、mtmd-helper.h，也没有链接 libmtmd.a，Swift 根本调用不了 mtmd\_\*。

<https://github.com/ggml-org/llama.cpp/blob/master/build-xcframework.sh>

只能修改打xcframework.sh自己加：<https://github.com/tc-mb/llama.cpp/commit/87b8ed4a5f61f9a7472fe11fdc2ff0dbd9d6b453>(三方实现)

后来官方也加了mtmd。

#### 移动端不好做跨轮KVCache

KVCache能力llama.cpp本身是有的，在一次对话中的多个token解码过程是生效的。

但是这在多轮对话中，是不生效的，当前是因为使用的AnyLanguageModel是无状态的，不支持多轮生效。

此外：大批量的KV放在内存也会极大增加内存占用。

- 如果KVCache常驻：内存占用就比较大，需要控制Context上下文小，比如仅保持8K上下文。

设定参数：

{% raw %}
```cpp
params.n_ctx   = 8192 // KV cache 能装多少 token
params.type_k  = Q8_0     // K 向量量化，省内存
params.type_v  = Q4_0     // V 向量量化，省内存
```
{% endraw %}

#### Prefill填充是一个耗时操作、耗内存操作，容易申请过大临时缓冲区导致crash。

{% raw %}
```swift
  聊天记录
 ↓
 Chat Template 格式化
 ↓
 Tokenize
 ↓
  分批 llama_decode
 ↓
  建立 KV Cache / recurrent state ------------以上为prefill。
 ↓
  取得最后位置 logits
 ↓
  开始逐 token 生成
```
{% endraw %}

当前是每次对话，要重新填充上下文，本身耗时就长。

此外，

随着聊天内容越来越大，上下文占用越来越多，重新把token填充到内存中是一个耗时的操作。

为了每次把大量上下文快速读取，每次处理是批量进行填充的，一般有这个runtimeBatchSize参数可以进行批量操作

nonisolated static let runtimeBatchSize = 512.

{% raw %}
```text
  完整 Prompt
  → 按 runtimeBatchSize 分块
  → 多次 llama_decode
  → 建立 KV Cache / recurrent state
  → 开始生成
```
{% endraw %}

但是这个数字如果比较大，就需要开出比较大的临时缓冲区做decode操作，容易申请不到导致crash。

{% raw %}
```text
  M_prefill ≈
  M_fixed
  + A × n_ubatch
  + B × n_ubatch × n_kv

  其中：

  M_fixed   = 与 batch 无关的固定临时空间
  n_ubatch  = 物理 Prefill 批大小
  n_kv      = 当前已使用的上下文长度
  A         = QKV、FFN、残差等中间激活的单位开销
  B         = Attention score/mask 的单位开销
```
{% endraw %}

#### xxx

## Questions？

### 神经网络加速芯片ANE？没有使用

目前 llama.cpp 在 iOS 上使用 Metal 时，计算主要运行在 **Apple GPU**，不会自动使用独立的 Apple Neural Engine（ANE）。

llama.cpp 官方的 ANE backend 目前仍属于研究/路线图事项，尚未成为正式 backend：[ANE backend issue](https://github.com/ggml-org/llama.cpp/issues/10453)。现有 Metal 后端代码也明确围绕 `MTLDevice` 和 GPU buffer/command 执行：[ggml-metal.cpp](https://github.com/ggml-org/llama.cpp/blob/master/ggml/src/ggml-metal/ggml-metal.cpp)。

Apple 新版本 Metal 4 引入了 Machine Learning Pass，可以在 Metal 工作流中执行 Core ML 模型，由系统选择 GPU 或 ANE。但它要求使用转换后的 Core ML ML package，并不是普通 Metal compute shader 自动迁移到 ANE。[Apple 官方说明](https://developer.apple.com/documentation/metal/machine-learning-passes)

因此，未来系统支持类似：

{% raw %}
```text
Metal command buffer
  ├─ 普通 compute pass → GPU
  └─ ML pass/Core ML   → GPU 或 ANE
```
{% endraw %}

llama.cpp 的 Metal kernel 已经针对量化权重的矩阵向量乘进行了专门优化

## Reference

1. CoreML对端侧部署的优化建议：<https://apple.github.io/coremltools/docs-guides/source/opt-overview.html>

1. Google LiteRT 的最佳实践： <https://developers.google.com/edge/litert/conversion/tensorflow/build/best_practices>

1. 2026年3月4日：试了一下Qwen3.5-0.8B-Q8, 在端上推理的效果wo觉得已经很不错了，特别支持深度思考，值得一试

- 用[GitHub - a-ghorbani/pocketpal-ai: An app that brings language models directly to your phone.](https://github.com/a-ghorbani/pocketpal-ai) 就可以尝试，这是个RN的项目，markdown支持有限, iOS直接搜索pocketpal即可

- 从huggingface上直接下载模型运行即可，当然6 token/s很慢，设备是红米K50(2022年红米旗舰)

<div class="feishu-table" role="region" aria-label="对比表，可横向滚动" tabindex="0"><table>
<tr><td><img src="{{ '/assets/posts/llama-cpp-ios/2724.jpg' | relative_url }}" alt="Llama.cpp iOS 端侧部署实践配图" loading="lazy"><br>
<img src="{{ '/assets/posts/llama-cpp-ios/2726.jpg' | relative_url }}" alt="Llama.cpp iOS 端侧部署实践配图" loading="lazy"><br>
<img src="{{ '/assets/posts/llama-cpp-ios/2728.jpg' | relative_url }}" alt="Llama.cpp iOS 端侧部署实践配图" loading="lazy"></td></tr>
</table></div>

1. [Qwen3.5 端侧小模型测评：从 0.8B 到 9B](https://zhuanlan.zhihu.com/p/2011914556159582443)

1. LLM原理超棒教程：WelchLab的教程，<https://www.welchlabs.com/>， 中译版：

<a href="https://player.bilibili.com/player.html?autoplay=0&amp;bvid=1KfYT6QE8a&amp;vd_source=11f86ef7557ad883b422796bd17918d6">观看视频</a>
