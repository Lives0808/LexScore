import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import ServiceWorkerRegistrar from "@/components/ServiceWorkerRegistrar";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "LexScore · 雅思托福写作批改",
  description:
    "四维评分对齐批改、逐句对照式批注、扣题度诊断与反模板检测，并自动沉淀个人写作语料库。",
  applicationName: "LexScore",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "LexScore",
    statusBarStyle: "default",
  },
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    // 显式声明：一旦设置了 metadata.icons，Next.js 就不再自动注入文件约定生成的
    // apple-touch-icon 链接，需要在这里手动补上，否则 iOS 添加到主屏会没有图标。
    apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // 允许缩放：批改内容字号小，禁缩放会伤害可读性与无障碍
  maximumScale: 5,
  themeColor: "#f6f8fa",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="zh-CN"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <header className="border-line bg-card/85 sticky top-0 z-30 border-b backdrop-blur">
          <div className="mx-auto flex h-14 max-w-[1200px] items-center gap-6 px-5">
            <Link href="/" className="flex items-baseline gap-2">
              <span className="text-ink text-[17px] font-semibold tracking-tight">
                LexScore
              </span>
              <span className="text-ink-faint hidden text-[11px] sm:inline">
                雅思托福写作批改
              </span>
            </Link>
            <nav className="ml-auto flex items-center gap-1 text-[13px]">
              <Link
                href="/"
                className="text-ink-soft hover:bg-accent-soft hover:text-accent rounded-md px-3 py-1.5 transition"
              >
                批改
              </Link>
              <Link
                href="/corpus"
                className="text-ink-soft hover:bg-accent-soft hover:text-accent rounded-md px-3 py-1.5 transition"
              >
                我的语料库
              </Link>
            </nav>
          </div>
        </header>
        <main className="flex-1">{children}</main>
        <ServiceWorkerRegistrar />
        <footer className="border-line border-t py-6">
          <div className="text-ink-faint mx-auto max-w-[1200px] px-5 text-[11.5px] leading-relaxed">
            LexScore 的评分依据来自可定位到原文的客观指标与公开评分标准，
            用于备考训练与自我诊断，不等同于官方考试成绩。
          </div>
        </footer>
      </body>
    </html>
  );
}
