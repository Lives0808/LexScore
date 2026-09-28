#!/usr/bin/env bash
#
# 构建原生安卓 APK（Kotlin + Jetpack Compose）。
#
# 做四件事：
#   1. 定位 JDK 与 Android SDK
#   2. 把评分引擎打包成单文件 JS（供 QuickJS 调用）
#   3. 调用 Gradle 打包
#   4. 报告产物路径与体积
#
# 用法：
#   ./scripts/build-android-native.sh            # release
#   ./scripts/build-android-native.sh debug      # debug（不需要签名配置）
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROJECT="$ROOT/android-native"
MODE="${1:-release}"

# ---------- 1. 环境 ----------

if [[ -z "${JAVA_HOME:-}" ]] || [[ ! -x "${JAVA_HOME}/bin/java" ]]; then
  for candidate in \
    "$HOME/Library/Java/JavaVirtualMachines/temurin-21.jdk/Contents/Home" \
    "$HOME/Library/Java/JavaVirtualMachines/temurin-17.jdk/Contents/Home" \
    /Library/Java/JavaVirtualMachines/temurin-21.jdk/Contents/Home; do
    if [[ -x "$candidate/bin/java" ]]; then
      export JAVA_HOME="$candidate"
      break
    fi
  done
fi

if [[ -z "${JAVA_HOME:-}" ]]; then
  echo "找不到 JDK。请安装 JDK 17 或 21。" >&2
  exit 1
fi

if [[ -z "${ANDROID_HOME:-}" ]]; then
  for candidate in "$HOME/Library/Android/sdk" "$HOME/Android/Sdk"; do
    [[ -d "$candidate" ]] && export ANDROID_HOME="$candidate" && break
  done
fi

if [[ -z "${ANDROID_HOME:-}" || ! -d "$ANDROID_HOME" ]]; then
  echo "找不到 Android SDK。请设置 ANDROID_HOME。" >&2
  exit 1
fi

export ANDROID_SDK_ROOT="$ANDROID_HOME"
export PATH="$JAVA_HOME/bin:$PATH"

echo "JDK         $("$JAVA_HOME/bin/java" -version 2>&1 | head -1)"
echo "Android SDK $ANDROID_HOME"
echo "构建模式    $MODE"
echo

# ---------- 2. 引擎 bundle ----------

if [[ "$MODE" == "release" && ! -f "$PROJECT/keystore.properties" ]]; then
  echo "缺少 android-native/keystore.properties，无法签名 release APK。" >&2
  echo "若要快速验证，可改用：./scripts/build-android-native.sh debug" >&2
  exit 1
fi

echo "▸ 打包评分引擎（TypeScript → 单文件 JS）…"
cd "$ROOT"
node scripts/build-engine-bundle.mjs

# ---------- 3. 打包 ----------

cd "$PROJECT"
echo "sdk.dir=$ANDROID_HOME" > local.properties

TASK="assembleRelease"
[[ "$MODE" == "debug" ]] && TASK="assembleDebug"

echo
echo "▸ Gradle $TASK …"
./gradlew "$TASK" --no-daemon --console=plain

# ---------- 4. 结果 ----------

APK_DIR="app/build/outputs/apk/$MODE"
APK="$(find "$APK_DIR" -name '*.apk' -type f | head -1)"

if [[ -z "$APK" ]]; then
  echo "构建结束但没有找到 APK。" >&2
  exit 1
fi

echo
echo "✓ 构建完成"
echo "  $PROJECT/$APK"
echo "  $(du -h "$PROJECT/$APK" | cut -f1)"
