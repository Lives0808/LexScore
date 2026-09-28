"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * 响应式媒体查询 hook。
 *
 * 用 useSyncExternalStore 而不是 useEffect + setState：
 * 服务端快照固定返回 false，客户端 hydration 后自动校正，
 * 不会触发 React 的「在 effect 里同步 setState」警告，也不会产生水合不一致。
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const mq = window.matchMedia(query);
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    [query],
  );

  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/** 设备是否支持悬停（用于区分鼠标与触摸屏的交互方式） */
export function useHoverCapable(): boolean {
  return useMediaQuery("(hover: hover) and (pointer: fine)");
}

/** 是否为桌面宽度。断点与 Tailwind 的 md 保持一致（768px） */
export function useIsDesktop(): boolean {
  return useMediaQuery("(min-width: 768px)");
}
