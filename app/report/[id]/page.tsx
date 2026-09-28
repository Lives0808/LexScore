import ReportView from "@/components/report/ReportView";

export default async function Page({ params }: PageProps<"/report/[id]">) {
  const { id } = await params;
  return <ReportView reportId={id} />;
}
