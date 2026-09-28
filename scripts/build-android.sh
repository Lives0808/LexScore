#!/usr/bin/env bash
#
# 构建安卓 APK。
#
# 做四件事：
#   1. 定位 JDK 21 与 Android SDK
#   2. 把 Next.js 静态导出到 out/
#   3. 用 Capacitor 同步进安卓工程
#   4. 调用 Gradle 打包 release APK
#
# 用法：
#   ./scripts/build-android.sh              # release APK
#   ./scripts/build-android.sh debug        # debug APK（不需要签名配置）
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
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
  echo "找不到 JDK。Capacitor 8 需要 JDK 21。" >&2
  echo "macOS 可用：brew install --cask temurin@21" >&2
  exit 1
fi

if [[ -z "${ANDROID_HOME:-}" ]]; then
  for candidate in \
    "$HOME/Library/Android/sdk" \
    "$HOME/Android/Sdk" \
    /usr/local/share/android-sdk; do
    if [[ -d "$candidate" ]]; then
      export ANDROID_HOME="$candidate"
      break
    fi
  done
fi

if [[ -z "${ANDROID_HOME:-}" || ! -d "$ANDROID_HOME" ]]; then
  echo "找不到 Android SDK。请安装 Android SDK 并设置 ANDROID_HOME。" >&2
  exit 1
fi

export ANDROID_SDK_ROOT="$ANDROID_HOME"
export PATH="$JAVA_HOME/bin:$PATH"

echo "JDK        $("$JAVA_HOME/bin/java" -version 2>&1 | head -1)"
echo "Android SDK $ANDROID_HOME"
echo "构建模式   $MODE"
echo

# ---------- 2. 签名密钥 ----------

if [[ "$MODE" == "release" && ! -f "$ROOT/android/keystore.properties" ]]; then
  echo "缺少 android/keystore.properties，无法签名 release APK。" >&2
  echo "若要快速验证，可改用：./scripts/build-android.sh debug" >&2
  exit 1
fi

# ---------- 3. 构建 Web 产物 ----------

cd "$ROOT"
echo "▸ 构建 Web 产物（静态导出到 out/）…"
npm run build

echo
echo "▸ 校验静态产物完整性…"
# 资源引用断了在 App 里是白屏，且构建阶段不报错，必须在这里拦住
node scripts/verify-static.mjs

echo
echo "▸ 同步到安卓工程…"
npx cap sync android

# ---------- 4. 打包 ----------

cd "$ROOT/android"
# 确保 Gradle 能找到 SDK
echo "sdk.dir=$ANDROID_HOME" > local.properties

TASK="assembleRelease"
[[ "$MODE" == "debug" ]] && TASK="assembleDebug"

echo
echo "▸ Gradle $TASK …"
./gradlew "$TASK" --no-daemon

# ---------- 5. 结果 ----------

APK_DIR="app/build/outputs/apk/$MODE"
APK="$(find "$APK_DIR" -name '*.apk' -type f | head -1)"

if [[ -z "$APK" ]]; then
  echo "构建结束但没有找到 APK，请检查上面的 Gradle 输出。" >&2
  exit 1
fi

echo
echo "✓ 构建完成"
echo "  $ROOT/android/$APK"
echo "  $(du -h "$ROOT/android/$APK" | cut -f1)"
