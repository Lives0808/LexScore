import type { MetadataRoute } from "next";

// 静态导出要求元数据路由显式声明为静态
export const dynamic = "force-static";

/**
 * PWA 清单。
 *
 * 让「添加到主屏幕」后的体验接近原生应用：独立窗口、自定义主题色、
 * 启动画面不闪烁白屏。批改本身需要访问服务端接口，所以不做离线缓存。
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "LexScore · 雅思托福写作批改",
    short_name: "LexScore",
    description:
      "四维评分对齐批改、逐句对照式批注、扣题度诊断与反模板检测，并自动沉淀个人写作语料库。",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f6f8fa",
    theme_color: "#1f4d8f",
    lang: "zh-CN",
    categories: ["education", "productivity"],
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
