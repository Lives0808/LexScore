# LexScore

面向中国考生的雅思 / 托福写作批改工具。核心主张只有一句话：

> **告诉你「为什么这里扣了分」，而不是给一句空泛的评价。**

每一处修改都标注它对应哪个评分项、能提多少分；每一项打分都附上作文原文的引用，
直接定位到具体句子。评分逻辑透明、可复现、可审计，不依赖黑箱。

---

## 功能

### 四维评分对齐批改

| 雅思 | 托福 |
| --- | --- |
| 任务回应 TR | 任务完成 TF |
| 连贯与衔接 CC | 组织发展 OD |
| 词汇丰富度 LR | 语言使用 LU |
| 语法多样性与准确性 GRA | 句式多样性 SV |

雅思四项各 0–9，总分按官方规则取平均后进位到最近的半档（平均分以 .25 结尾进至下一半档，
以 .75 结尾进至下一整档）。托福四项各 0–5，换算总分 = 四项平均 × 6，得到 0–30。

**每一项评分都附「评分依据」**：引用原文中的对应句子 + 可验证的客观指标 +
说明这里为什么加分或扣分。不存在没有依据的分数。

### 逐句对照式批注

左侧原文、右侧修改版，一句一对照。原文中被批注的位置高亮标记，
**鼠标悬浮即显示修改原因**；每条修改都可以单独「接受」或「忽略」，
接受后右侧修改版实时更新，也可以一键复制整篇修改稿。

### 手机也能用

批改结果信息密度高，窄屏上做了一些专门的取舍：

- **悬浮提示在触摸屏上不成立**，所以按设备能力分流：能悬停的设备显示悬浮提示，
  触摸设备改为**点击高亮处跳转到批注卡片**——不做「弹出来收不回去」的提示框。
- **左右分栏在窄屏放不下**，手机上自动改为上下堆叠：上方原文、下方修改版，
  各自带标签；桌面端仍是左右对照。
- **输入框在移动端字号固定为 16px**，否则 iOS Safari 聚焦时会自动放大整个页面。
- 四维评分卡片的「评分依据」在手机上默认折叠，避免把逐句批注推到很下面；
  桌面端默认展开，核心价值直接可见。
- 顶部导航字号、触控目标（接受 / 忽略按钮）、横向溢出的长英文句子都做了处理。
- 带 **PWA 清单与应用图标**，在手机浏览器里可以「添加到主屏幕」，
  打开后是全屏独立窗口，接近原生应用的体验。

### 安卓 App

仓库里包含一个**原生安卓应用**（`android/`），构建产物是可直接安装的 APK。

关键设计：**评分引擎是纯 TypeScript、零 Node 依赖的，所以它整个跑在 App 内部**——
安卓版**完全离线可用**，不需要后端服务器，也不需要在 APK 里塞任何 API Key。
作业流程是：

```
Next.js 静态导出（out/）
      ↓  npx cap sync android
安卓工程 assets/public/
      ↓  ./gradlew assembleRelease
LexScore.apk
```

App 里用的是同一份引擎和同一套界面代码，因此**批改结果与网页版逐字节一致**，
不存在「两套实现各算各的」问题。

```bash
npm run android:apk     # 构建 release APK（需要 JDK 21 + Android SDK）
npm run android:debug   # 构建 debug APK（不需要签名配置）
```

也可以直接用脚本，它会自动定位 JDK 与 Android SDK：

```bash
./scripts/build-android.sh release
```

APK 输出在 `android/app/build/outputs/apk/release/`。

**环境要求**：JDK 21（Capacitor 8 要求）、Android SDK（platform 36 + build-tools）。
脚本会自动在常见路径下查找，也可以通过 `JAVA_HOME` / `ANDROID_HOME` 指定。

### 提分幅度说明

每条批注都标注对应评分项与提分幅度，例如：

> 此处增加逻辑衔接词，可提升 CC（连贯与衔接）项 0.5 分

### 学术搭配与话题核心词伙

批注按标签分类，其中两类直接对应考官偏好：

- **学术写作常用搭配** —— 把口语化、泛化的表达换成学术搭配
  （`a lot of` → `a considerable number of`，`things` → `factors`，`get` → `obtain`）
- **话题核心词伙** —— 识别作文属于哪个话题（教育 / 环境 / 科技 / 健康 / 工作 /
  社会 / 犯罪 / 文化 / 政策 / 媒体），指出该话题下应该覆盖但全文没出现的词伙
  （`carbon footprint`、`social mobility`、`sedentary lifestyle`…）

每条都附带「为什么这个表达更符合考官偏好」，点出它在评分标准里对应哪一条。

### 雅思图表题：数据覆盖检测

粘贴图表数据后，引擎会抽取其中的数值，逐个回查是否在作文中出现，并检查结构要点：

- 是否写了 Overview（缺失会直接封顶 Band 5）
- 是否覆盖最大值、最小值、上升趋势、下降趋势、稳定 / 波动
- 是否有对比结构（`whereas` / `in contrast` / `twice as many as`）
- 是否误用主观表达（Task 1 只描述数据，不论证）

### 托福综合写作：论点配对检测

填写阅读材料的三个论点与听力材料的三个反驳点后，引擎逐条核对：

- 阅读的每个论点是否转述完整
- **听力的每个反驳点是否遗漏**（官方评分核心是听力还原度，阅读只是背景）
- 是否明确标记了「听力反驳阅读」的关系

匹配使用 IDF 加权，因此不会因为阅读句和听力句共享话题词汇（如 `chain stores`）
就把「只提了一句不同意」误判为已覆盖。

### 扣题度诊断 + 反模板检测

- **扣题度**：提取题目关键词与指令要求（`discuss both views` / `to what extent` /
  `outweigh`…），标出哪些核心概念全文没出现，定位疑似跑题的句子，
  并检查是否给出了明确可辨的立场句。
- **反模板检测**：识别 `With the rapid development of society`、
  `Every coin has two sides`、`Last but not least`、`In a word` 等
  考官一眼就能认出的模板句，给出原创度评分与替换方案。

### 个人写作语料库

每批改一篇，自动沉淀三类素材到本地语料库：

- **好词** —— 你用对的学术词汇与话题词伙，可复用到同话题写作
- **好句** —— 复杂句 + 学术词汇且未命中语法规则，可直接作为改写模板
- **高频错误** —— 按出现次数排序，并统计错误在评分项上的分布，
  指出哪些是系统性问题

---

## 快速开始

```bash
npm install
npm run dev
```

打开 http://localhost:3000 即可。**不需要任何 API Key** —— 默认的规则评分器
完全在本地运行。首页有示例作文，点一下就能看到完整的批改效果。

```bash
npm run build     # 生产构建
npm run verify    # 校验正确性（引擎 + 界面结构两层）
npm run lint
npm run typecheck
npm run format    # Prettier 格式化
npm run icons     # 重新生成全部应用图标（Web / PWA / 安卓，手写 PNG）
npm run preview   # 导出一份单文件 HTML 批改报告，用来快速看效果
npm run android:apk   # 构建安卓 release APK
```

---

## 接入真实模型（可选）

规则评分器负责**客观测量**（哪些句子有语法错误、衔接词密度多少、数据点遗漏了几个），
模型负责**把测量结果讲成自然的话并给出灵活的改写**。两者输出同一套数据结构，
UI 完全不用改。

> ⚠️ **换成静态导出后的变化。** 为了能打包进安卓 App 并离线运行，
> 应用改成了静态导出，没有服务端了。API Key 不能放在客户端里
> （会被任何人从 APK 里解出来），所以**浏览器与安卓端目前一律使用规则评分器**，
> 模型评分器的代码保留着但不会启用。
>
> 想启用模型，有两个可行方向：
> 1. 起一个独立的后端服务持有 Key，客户端改为调用它；
> 2. 做成「用户自带 Key」模式，让用户填自己的 Key 存在本机。
>
> 原有的服务端接入方式（下面这段）在 Node 环境下依然有效。

在 Node 环境（或自己加回一个服务端路由）时，配置任意 OpenAI 兼容接口即可：

```bash
LEXSCORE_LLM_BASE_URL=https://api.deepseek.com/v1
LEXSCORE_LLM_API_KEY=sk-xxxxxxxx
LEXSCORE_LLM_MODEL=deepseek-chat
```

配置后会自动切换到模型评分器；模型调用失败会自动回退到规则评分器，
并在结果里标明回退原因，不会让用户拿到空白页面。

提示词见 `lib/engine/prompts.ts`，设计上有三个关键点：

1. 作文先分句并注入句子 ID，强制模型**引用原文**而不是空泛评价；
2. 先注入规则引擎已算出的事实，让模型做解释与改写，而不是从零猜测；
3. 输出的 JSON schema 与前端渲染结构一一对应，不做二次翻译。

---

## 批改是怎么算出来的

```
作文
 ├─ 1. 分段 / 分句 / 词频统计          lib/engine/segment.ts
 ├─ 2. 规则分析器                      lib/engine/analyzers.ts
 │     连贯性 · 词汇 · 语法 · 句式多样性 · 模板 · 扣题度
 ├─ 3. 覆盖检测                        lib/engine/coverage.ts
 │     雅思图表数据覆盖 / 托福阅读↔听力论点配对
 ├─ 4. 事实层（Fact）                  ← 所有结论的原料，每条都带原文定位
 ├─ 5. 批注生成                        ← target 必须在原句中逐字符可定位
 └─ 6. 评分器（可插拔）
        ├─ rule-engine v1（默认，确定性，完全离线）
        └─ llm:<model>（可选，需要独立后端或用户自带 Key）
```

整条链路是纯 TypeScript、零 Node 依赖的，因此既能在浏览器里跑，
也能原封不动地跑在安卓 WebView 里 —— 这是安卓版能完全离线工作的原因。

设计原则：**任何一个分数变化都必须能追溯到一条可定位到原文的事实**。
这也是 `npm run verify` 要校验的东西，它分两层：

**引擎层**（`verify:engine`）—— 批改三篇示例作文后逐条检查：

- 每条批注的 `target` 是否能在它所属的句子里逐字符定位（否则高亮会错位）
- 每条评分依据的引用是否真的来自被指向的句子
- 左右分栏的文本切分能否无损还原原文

**界面层**（`verify:ui`）—— 报告页是客户端组件（数据来自 localStorage），
curl 只能拿到「加载中…」，所以用服务端渲染把每个组件真正渲染成 HTML 再断言结构：
原文 / 修改版两列是否都存在、移动端标签是否渲染、批注卡片数量是否对得上、
三种状态是否都能撤销、触摸设备下不应出现悬浮提示框。

**产物层**（`verify:static`，需要先 `npm run build`）—— 检查静态导出产物里
每个页面的站内资源引用是否都真实存在，以及评分引擎是否真的被打进了 bundle。
这一步对安卓尤其重要：**WebView 加载不到 JS/CSS 就是一片白屏，而且构建阶段完全
不报错**，所以 `build-android.sh` 会在打包成 APK 之前自动跑这个校验并因此中断构建。

---

## 项目结构

```
app/
  page.tsx                    输入页
  report/page.tsx             批改报告页（?id=xxx）
  corpus/page.tsx             个人语料库
  manifest.ts                 PWA 清单
components/
  GradeForm.tsx               作文输入表单
  CorpusView.tsx              语料库视图
  report/
    ReportView.tsx            报告编排
    DimensionCard.tsx         四维评分卡片（可展开评分依据）
    SentenceDiff.tsx          逐句左右对照 + 悬浮原因
    AnnotationCard.tsx        单条批注（接受 / 忽略）
    Diagnostics.tsx           扣题度 / 反模板 / 覆盖检测 / 硬性约束
  ui/Badge.tsx                徽章 / 进度条 / 分数配色
lib/
  types.ts                    核心类型契约
  rubrics.ts                  雅思托福评分标准与总分进位规则
  text.ts                     定位、分栏切分、修改稿预览
  store.ts                    localStorage 存储 + useSyncExternalStore 订阅
  hooks.ts                    媒体查询（区分鼠标 / 触摸）
  grade-client.ts             客户端批改入口（动态加载引擎）
  samples.ts                  示例题目与作文
  engine/
    index.ts                  主编排
    segment.ts                分段分句 / 词干 / 统计
    lexicon.ts                搭配升级表、模板黑名单、话题词库、中式英语规则
    analyzers.ts              规则分析器 + 事实推导 + 批注生成
    coverage.ts               图表数据覆盖 / 听力论点配对
    prompts.ts                模型提示词
    providers/                评分器抽象：mock(规则) / llm(模型)
android/                      安卓工程（Capacitor 生成）
scripts/
  verify.ts                   引擎层校验：批注定位 / 引用一致性 / 分栏切分
  render-check.tsx            界面层校验：服务端渲染后断言 DOM 结构
  build-preview.tsx           导出单文件 HTML 批改报告
  build-android.sh            安卓 APK 构建（自动定位 JDK / SDK）
  generate-icons.mjs          手写 PNG 生成 Web / PWA / 安卓全套图标
```

---

## 已知限制

我们倾向于把限制写清楚，而不是让用户自己踩坑：

1. **规则评分器不认识语义。** 它做的是客观测量（统计、模式匹配、定位）。
   语法规则库覆盖的是中国考生的高频错误，不能替代人工校对；
   像「论证是否真的有说服力」这类判断，规则引擎给不出可靠答案，
   需要接模型。
2. **模型评分器的分数不稳定。** 即使 temperature 设为 0.2，
   同一篇作文两次批改仍可能有 0.5 分的波动。规则评分器是完全可复现的。
3. **托福综合写作的论点配对要求语言一致。** 如果论点是中文、作文是英文，
   关键词无法匹配。这种情况界面会明确说明「本条不计入覆盖判定」，
   而不是误报为遗漏。
4. **雅思 Task 1 需要手动粘贴图表数据。** 目前不支持上传图片识别图表。
5. **数据存在浏览器 localStorage 里。** 换浏览器或清理缓存会丢失，
   没有账号体系，也没有服务端数据库。
6. **只有安卓版，没有 iOS 版。** `android/` 下的 APK 可以直接安装使用，
   评分完全离线。iOS 需要 macOS 上的 Xcode 才能构建，目前没有做。
7. **APK 用的是仓库里的自签名密钥。** 见 `android/keystore.properties` 的说明：
   同一把密钥必须持续使用，否则已安装的用户无法覆盖升级。
   要上架任何应用商店，请替换成你自己的密钥。
8. **数据存在设备本地。** 报告与语料库在 WebView 的 localStorage 里，
   换设备或清除应用数据会丢失，没有账号体系与云同步。
9. **不等同于官方成绩。** 这是一个备考训练与自我诊断工具。

### 安卓构建踩坑记录

这几个问题都是在国内网络环境下实际遇到的，写在这里省得重复排查：

**1. Gradle 发行版下载极慢（约 140 KB/s）。**
wrapper 会从 `services.gradle.org` 拉 214MB 的 `gradle-8.14.3-all.zip`。
换成国内镜像快很多：

```bash
DIST=~/.gradle/wrapper/dists/gradle-8.14.3-all/*/
curl -fL --http1.1 -o "$DIST/gradle-8.14.3-all.zip" \
  https://repo.huaweicloud.com/gradle/gradle-8.14.3-all.zip
cd "$DIST" && unzip -q -o gradle-8.14.3-all.zip && touch gradle-8.14.3-all.zip.ok
```

最后那个 `.zip.ok` 标记不能少 —— Gradle 靠它判断发行版已安装完成。

**2. 报错 `Timeout of 120000 reached waiting for exclusive access to file`。**
这是上一个构建进程被杀后留下的锁文件导致的，wrapper 会一直等锁直到超时。
清掉即可：

```bash
find ~/.gradle/wrapper/dists -name "*.lck" -delete
pkill -f "appname=gradlew"      # 先确认没有残留的构建进程
```

**3. 一定要确认只有一个构建进程在跑。**
同时跑两个 `assembleRelease` 会互相抢锁，表现为**日志完全为空、进程卡住不动**，
很容易误判成「构建太慢」。

**4. Maven 依赖拉不动。**
`android/build.gradle` 里已经把阿里云镜像放在官方源之前，
镜像缺包时会自动回落到 `google()` / `mavenCentral()`。

**5. JDK 必须是 21。**
Capacitor 8 的 `capacitor.build.gradle` 里写死了
`sourceCompatibility JavaVersion.VERSION_21`，用 JDK 17 会直接编译失败。


---

## 技术栈

Next.js 16（App Router / Turbopack，静态导出）· React 19 · TypeScript · Tailwind CSS v4 · Prettier
· Capacitor 8（安卓）· Gradle 8.14 / AGP 8.13（已配置阿里云镜像源）

---

## 路线图

- [x] PWA（添加到主屏幕，独立窗口运行）
- [x] 安卓 App（离线批改，APK 可直接安装）
- [ ] iOS 版（需要 Xcode 构建）
- [ ] 用系统分享菜单接收作文（从微信 / 备忘录直接分享进 App）
- [ ] 服务端存储与账号体系，支持跨设备同步语料库
- [ ] 按话题 / 评分项做语料库复习模式（间隔重复）
- [ ] 历史作文的进步曲线（同一评分项的分数变化）
- [ ] 导出 PDF 批改报告
- [ ] 接入视觉模型，直接识别图表图片

---

私有项目，暂未开源授权。
