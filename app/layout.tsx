import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
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
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="zh-CN"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <header className="sticky top-0 z-30 border-b border-line bg-card/85 backdrop-blur">
          <div className="mx-auto flex h-14 max-w-[1200px] items-center gap-6 px-5">
            <Link href="/" className="flex items-baseline gap-2">
              <span className="text-[17px] font-semibold tracking-tight text-ink">
                LexScore
              </span>
              <span className="text-[11px] text-ink-faint">
                雅思托福写作批改
              </span>
            </Link>
            <nav className="ml-auto flex items-center gap-1 text-[13px]">
              <Link
                href="/"
                className="rounded-md px-3 py-1.5 text-ink-soft transition hover:bg-accent-soft hover:text-accent"
              >
                批改
              </Link>
              <Link
                href="/corpus"
                className="rounded-md px-3 py-1.5 text-ink-soft transition hover:bg-accent-soft hover:text-accent"
              >
                我的语料库
              </Link>
            </nav>
          </div>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="border-t border-line py-6">
          <div className="mx-auto max-w-[1200px] px-5 text-[11.5px] leading-relaxed text-ink-faint">
            LexScore 的评分依据来自可定位到原文的客观指标与公开评分标准，
            用于备考训练与自我诊断，不等同于官方考试成绩。
          </div>
        </footer>
      </body>
    </html>
  );
}
