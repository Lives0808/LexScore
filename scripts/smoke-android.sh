#!/usr/bin/env bash
#
# 在模拟器上验证安卓 release 包。
#
# 把「启动模拟器 → 等待 → 装包 → autorun → 截图 → 关模拟器」放在同一个脚本里，
# 因为模拟器进程如果在单独的作业里启动，作业结束时就可能被一起回收。
#
# 用法：./scripts/smoke-android.sh [apk路径]
#
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APK="${1:-$ROOT/android-native/app/build/outputs/apk/release/app-release.apk}"
AVD="${LEXSCORE_AVD:-lingoswift}"
OUT="${LEXSCORE_SMOKE_OUT:-/tmp}"

export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
ADB="$ANDROID_HOME/platform-tools/adb"

cleanup() {
  echo "▸ 关闭模拟器"
  "$ADB" emu kill >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "▸ 启动模拟器（${AVD}）"
"$ANDROID_HOME/emulator/emulator" -avd "$AVD" -no-snapshot -no-audio -no-boot-anim \
  -gpu swiftshader_indirect > "$OUT/emulator-smoke.log" 2>&1 &
EMU_PID=$!

"$ADB" wait-for-device
for i in $(seq 1 40); do
  BOOT="$("$ADB" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')"
  [ "$BOOT" = "1" ] && { echo "  已启动（等待 $((i * 8)) 秒）"; break; }
  sleep 8
done

echo "▸ 安装 ${APK}"
"$ADB" uninstall com.lexscore.nativeapp >/dev/null 2>&1
"$ADB" install "$APK" 2>&1 | tail -1

echo "▸ 用示例自动跑一遍批改"
"$ADB" logcat -c
"$ADB" shell am start -n com.lexscore.nativeapp/.MainActivity --ez lexscore_autorun true >/dev/null 2>&1
sleep 25

PID="$("$ADB" shell pidof com.lexscore.nativeapp | tr -d '\r')"
echo "▸ 进程 PID: ${PID:-未启动}"

echo "▸ 异常检查"
if "$ADB" logcat -d --pid="$PID" 2>/dev/null | grep -iE "AndroidRuntime|FATAL|LexScore: .*failed" | head -5; then
  echo "  （以上是命中的异常行，空则无异常）"
fi

echo "▸ 截图"
"$ADB" exec-out screencap -p > "$OUT/smoke-01-home.png"

# 滚到报告页的 Agent 轨迹区块附近
for _ in 1 2 3 4 5 6 7 8 9 10 11 12; do
  "$ADB" shell input swipe 540 1900 540 600 150
  sleep 0.3
done
sleep 2
"$ADB" exec-out screencap -p > "$OUT/smoke-02-scrolled.png"

echo "✓ 完成，截图在 ${OUT}/smoke-0*.png"
