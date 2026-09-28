import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Capacitor 配置：把静态导出产物（out/）包成安卓原生应用。
 *
 * 评分引擎是纯 TypeScript，直接跑在 WebView 里，所以 App 完全离线可用，
 * 不需要任何后端服务，也不需要在 APK 里塞 API Key。
 */
const config: CapacitorConfig = {
  appId: "com.lexscore.app",
  appName: "LexScore",
  webDir: "out",
  android: {
    // 批改会产生一些 DOM 重排，关掉不必要的混合内容加载
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,
  },
  server: {
    androidScheme: "https",
  },
};

export default config;
