"use client";

import { useEffect } from "react";

/**
 * 注册 Service Worker，让网页版在断网时也能打开并批改。
 *
 * 安卓 App 里不注册：资源本来就在本地，Service Worker 反而会在
 * 更新版本后继续提供旧资源。
 */
export default function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    if (!window.isSecureContext) return;
    // Capacitor 环境（安卓 App）跳过
    if ("Capacitor" in window) return;
    if (process.env.NODE_ENV !== "production") return;

    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* 注册失败不影响正常使用 */
    });
  }, []);

  return null;
}
