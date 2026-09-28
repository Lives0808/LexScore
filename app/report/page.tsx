import { Suspense } from "react";
import ReportView from "@/components/report/ReportView";

/**
 * 批改报告页。
 *
 * 用查询参数（/report?id=xxx）而不是动态路由（/report/[id]）：
 * 报告数据存在浏览器 localStorage 里，构建时无法枚举出 id，
 * 而静态导出要求动态路由必须提供 generateStaticParams。
 * 查询参数方案对静态托管和安卓 WebView 都更简单可靠。
 */
export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="text-ink-faint mx-auto max-w-[640px] px-5 py-24 text-center text-[13px]">
          加载中…
        </div>
      }
    >
      <ReportView />
    </Suspense>
  );
}
