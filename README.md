# LexScore

[![Release](https://img.shields.io/github/v/release/Lives0808/LexScore?style=flat-square&color=6366F1&label=release)](https://github.com/Lives0808/LexScore/releases)
[![License](https://img.shields.io/github/license/Lives0808/LexScore?style=flat-square&color=6366F1&label=license)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-6366F1?style=flat-square&logo=nextdotjs&logoColor=white)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-6366F1?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Capacitor](https://img.shields.io/badge/Capacitor-6366F1?style=flat-square&logo=capacitor&logoColor=white)](https://capacitorjs.com)
[![Android](https://img.shields.io/badge/Android-6366F1?style=flat-square&logo=android&logoColor=white)](https://github.com/Lives0808/LexScore/tree/main/android)

**雅思 / 托福写作批改。每一处扣分都定位到原文，而不是一句空泛的评价。**

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/Lives0808/LexScore)

免费开源 · 无需注册 · 数据不出本机 · 安卓 App 离线可用

---

## 四维对齐批改

按雅思 / 托福官方评分标准拆成四个维度打分，**每一处修改都标注它对应哪个评分项、能提多少分**。

| 雅思 | 托福 |
| --- | --- |
| 任务回应 TR | 任务完成 TF |
| 连贯与衔接 CC | 组织发展 OD |
| 词汇丰富度 LR | 语言使用 LU |
| 语法多样性与准确性 GRA | 句式多样性 SV |

**价值**：不用猜「为什么我只有 6 分」。每一项分数都附评分依据的原文引用 ——
直接告诉你「这里扣了分，因为衔接词密度只有 0.3/句」。四维雷达图一眼看出短板在哪。

## 深度逻辑诊断

- **跑题检测**：提取题目关键词与指令要求，标出全文未覆盖的核心概念和疑似跑题句
- **论证空洞识别**：标记「知识很重要」这类零信息量的句子，指出哪里只是断言没有展开
- **逻辑断层标注**：衔接词密度过低、手段单一、同一衔接词反复出现，都会定位到具体句子

**价值**：语法错误老师能改，但「论证有没有说服力」最难看懂。这一层专门解决它。

## 反模板化检测

识别 `With the rapid development of society`、`Every coin has two sides`、`Last but not least`
这类**考官一眼就能认出的模板句**，给出原创度评分与逐句替换方案。

**价值**：模板句是雅思写作最常见的天花板。考官不会直接扣分，但会压缩你的任务回应上限 ——
这一层帮你把分数从「背过的作文」里解放出来。

## 拍照批改

纸面作文不用手打：拍一张照片，自动变成可批改的文本。

1. **拍摄 / 选图** —— 调用系统相机拍摄，或从相册选择已有图片
2. **自动裁剪矫正** —— 自动识别纸张四角，也可以手动拖动微调；
   透视变换把倾斜拍歪的纸面拉正（不是简单旋转，是四个角各自对齐）
3. **去阴影增强** —— 「背景除法」消除光照不均与手影，
   再做对比度拉伸，得到接近白底黑字的效果
4. **手动清理** —— 擦除笔刷 / 框选擦除，抹掉涂改痕迹和多余标注，只留作文正文
5. **离线 OCR** —— ML Kit 拉丁文字识别，模型打包在 APK 里，**图片不上传**
6. **自动分段** —— 把 OCR 断开的行按句末标点重组成段落，而不是每行一段

**价值**：手写/纸面练习也能进同一套批改流程，不用先打字。

**权限**：不需要 CAMERA 权限（用系统相机意图），也不需要存储权限
（用系统相册选择器）。APK 声明的权限为**零**。

---

## 个人语料沉淀

每次批改自动积累：**好词**（用对的学术搭配与话题词伙）、**好句**（复杂句 + 学术词汇且无语法错误）、
**高频错误**（按出现次数排序，并统计错误在评分项上的分布）。

**价值**：复习时不用再背通用范文，直接用自己写过的、已被验证的表达。
分数变化曲线让进步可见。

---

## 一分钟快速开始

### 普通用户（推荐）

**方式一：在线使用** —— 打开 https://localhost:3000 （本地）或部署后的地址，点首页右侧的
「雅思 Task 2 · 议论文」示例 → 「开始批改」，一秒看到完整批改效果。

**方式二：一键部署到 Vercel** —— 点顶部 Deploy 按钮，或手动：

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/Lives0808/LexScore)

> 纯静态站点，部署后即可用。批改全部在浏览器本地完成，不需要任何后端或 API Key。

**方式三：安卓 App（推荐）** —— 到 [Releases](https://github.com/Lives0808/LexScore/releases/latest)
下载 `LexScore-Native-*.apk`（**Kotlin + Jetpack Compose 原生界面**），
传到手机安装。**完全离线可用**，飞行模式下也能批改，不需要任何权限。

### 开发者

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # 静态导出到 out/
npm run verify     # 引擎层 + 界面层 + 产物层 三层校验

# 安卓（需要 JDK 21 + Android SDK）
npm run android-native:apk   # 原生版：Kotlin + Jetpack Compose
npm run android:apk          # 套壳版：Capacitor + WebView
```

---

## 和别的方案比

| 维度 | LexScore | Grammarly | 人工批改 |
| --- | --- | --- | --- |
| 评分标准 | 对齐雅思托福官方 | 通用语法规则 | 依赖老师水平 |
| 批改维度 | 语法 + 逻辑 + 扣题 + 结构 | 仅语法 + 表达优化 | 参差不齐 |
| 隐私性 | 本地 / 私有部署 | 全部上传云端 | 取决于机构 |
| 价格 | 免费开源 | 会员付费 | 单篇几十元 |
| 反馈速度 | 秒出 | 秒出 | 几小时到几天 |

需要说明：LexScore 用的是**确定性规则引擎**，做客观测量（统计、模式匹配、原文定位）——
对「论证是否有说服力」这类语义判断给不出可靠答案。它不替代高分段的老师，
但能把「语法、搭配、扣题、模板」这些可量化的问题一次性说清楚。

---

## 路线图

**✅ 已完成**

- 四维评分对齐批改 + 逐句评分依据（定位到原文句子）
- 逐句对照批改视图（左右分栏 / 悬浮原因 / 一键接受单条修改）
- 扣题度检测（关键词覆盖 + 跑题句定位 + 立场句检查）
- 反模板检测（模板句库 + 原创度评分 + 替换方案）
- 个人语料库（好词 / 好句 / 高频错误，按评分项分布）
- 雅思小作文数据覆盖检测（Overview / 最大最小 / 趋势 / 对比 + 逐个数值回查）
- 托福综合写作论点配对检测（IDF 加权，避免共享话题词误判）
- 本地历史记录（存在设备本地，无需登录）
- 四维评分雷达图 + 分数变化曲线
- 深色模式 / PWA 离线 / PDF 导出
- 安卓原生 App（Kotlin + Jetpack Compose，离线批改）
- 拍照批改：自动裁剪矫正 + 去阴影 + 离线 OCR

**🚧 进行中**

- 评分模型用官方真题大规模校准
- 论证展开的深度评估（不只是识别空洞句，还要给出展开方向）

**📋 计划中**

- 手写图片识别（拍照批改）
- 按话题 / 评分项做间隔重复复习模式
- iOS 版（需要 macOS + Xcode）
- 系统分享菜单接收作文（从微信 / 备忘录直接分享进 App）
- 可选的后端代理，让用户自带 API Key 接入大模型增强

---

## 已知局限

坦诚比夸大可信：

1. **规则引擎不认识语义**。它做客观测量，不能替代人工校对。
2. **托福综合写作的论点配对要求语言一致**。论点是中文、作文是英文时无法匹配，
   界面会明确说明「本条不计入覆盖判定」，而不是误报为遗漏。
3. **雅思 Task 1 需要手动粘贴图表数据**，暂不支持图片识别。
4. **数据存在浏览器 / 设备本地**。换设备或清除数据会丢失，没有账号体系与云同步。
5. **安卓 APK 用的是仓库内自签名证书**，安装时系统会提示风险。
6. **PDF 导出依赖浏览器打印**，安卓 App 内暂不支持。
7. **OCR 对印刷体效果好，手写体识别率明显下降**（ML Kit 拉丁模型主要针对印刷体）。
   识别结果可以直接在界面上修改后再填入。
8. **极端光照下自动找纸边可能失准**（强反光、深阴影），此时可以手动拖动四个角。
9. **不等同于官方考试成绩**，定位是备考训练与自我诊断工具。

---

## 技术细节

**架构**

```
作文
 ├─ 分段 / 分句 / 词频统计
 ├─ 规则分析器（连贯性 · 词汇 · 语法 · 句式 · 模板 · 扣题度）
 ├─ 覆盖检测（雅思图表数据 / 托福阅读↔听力论点配对）
 ├─ 事实层（Fact）        ← 所有结论的原料，每条都带原文定位
 ├─ 批注生成              ← target 必须在原句中逐字符可定位
 └─ 评分器（可插拔）
        ├─ rule-engine v1（默认，确定性，完全离线）
        └─ llm:<model>（可选，需独立后端或用户自带 Key）
```

核心理念：**任何一个分数变化都必须能追溯到一条可定位到原文的事实**。
整套引擎是纯 TypeScript、零 Node 依赖，所以既能在浏览器跑，也能原封不动跑在安卓 WebView 里。

**三层校验**（`npm run verify`）

- `verify:engine` —— 批注能否逐字符定位、评分依据的引用是否来自被指向的句子、分栏切分能否无损还原
- `verify:ui` —— 用服务端渲染把组件渲染成 HTML 再断言结构（含雷达图 / 走势图）
- `verify:static` —— 产物内站内资源引用是否有效、引擎是否真的被打进 bundle

**目录**

```
app/          页面（静态导出）
components/   界面组件（含雷达图 / 走势图 / 逐句对照）
lib/engine/   评分引擎（segment / analyzers / coverage / providers）
android/          安卓套壳版（Capacitor + WebView）
android-native/   安卓原生版（Kotlin + Jetpack Compose）
  app/src/main/java/com/lexscore/nativeapp/
    imaging/      拍照批改：透视矫正 / 去阴影 / OCR
    ui/camera/    拍照 → 裁剪 → 清理 → 识别 的完整流程
scripts/      校验与构建脚本
```

**两个安卓工程的区别**

| | `android-native/`（推荐） | `android/` |
| --- | --- | --- |
| 界面 | Kotlin + Jetpack Compose，**全原生** | Capacitor WebView 套壳 |
| 安装包 | 约 8 MB | 约 3.3 MB |
| 定位 | 正式分发给用户 | 快速验证 / 保留作为备选 |

两者共用**同一份评分引擎**（`lib/engine` 的 TypeScript），
区别只在界面层，因此批改结果完全一致。

**原生版怎么复用 TypeScript 引擎**

引擎不重写成 Kotlin，而是编译成一份单文件 JS（`npm run engine:bundle`）
打进 APK，交给一个不可见的 WebView 执行 —— 界面完全是原生 Compose，
只有计算层用 JS，避免维护两套算法。

> 试过 `app.cash.quickjs`（更轻量的纯 JNI 方案），但它的 JS 栈上限写死在库内部，
> 跑完整套分析（分句 + 上千次正则匹配 + 事实推导）会抛 `stack overflow`，
> 加大线程栈无效。WebView 用的是 V8，栈空间充足 —— 网页版每天都在跑同一份代码。
> 代价是多一个 WebView 实例（约 20–30MB 内存）。

**安卓构建踩坑记录**（国内网络环境下实际遇到的）

- Gradle 发行版从官方源只有 140 KB/s，换华为云镜像 8.7 MB/s；
  解压后必须补 `.zip.ok` 标记文件，Gradle 靠它判断安装完成
- 报 `Timeout waiting for exclusive access to file` 是上次构建的锁文件残留，
  清掉 `~/.gradle/wrapper/dists/**/*.lck` 即可
- 同时跑两个 Gradle 构建会互相抢锁，表现为**日志全空白、进程卡住**，很容易误判成构建慢
- `github.com` 被墙时 `git push` 不通，但 `api.github.com` 通常仍可达，
  可用 `node scripts/push-via-api.mjs` 走 Git Data API 推送

---

## 许可证

MIT © 2026 Lives0808 — 详见 [LICENSE](LICENSE)。

**关于安卓签名密钥**：`android/keystore/lexscore-release.jks` 提交在仓库里，
为的是保证后续版本能覆盖安装（Android 要求签名一致）。如果你要上架应用商店，
请**替换成你自己的密钥**并从仓库移出 —— 公开仓库里的签名密钥任何人都能用。

**关于仓库可见性**：如果仓库保持私有，README 顶部的徽章与 Vercel 一键部署按钮
只对仓库所有者有效，其他人访问会 404。
