import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * 静态导出。
   *
   * 整套评分引擎是纯 TypeScript，可以直接在浏览器 / Android WebView 中运行，
   * 因此不需要服务端。产物是纯静态文件，既能部署到任意静态托管，
   * 也能直接打包进安卓 App，并且离线可用。
   */
  output: "export",

  // 静态导出要求目录形式的路由（/report/ → report/index.html），
  // 这样安卓 WebView 的资源加载器能正确解析。
  trailingSlash: true,

  // 静态导出没有图片优化服务
  images: { unoptimized: true },

  // 移动端 WebView 不需要把源码映射发出去
  productionBrowserSourceMaps: false,
};

export default nextConfig;
