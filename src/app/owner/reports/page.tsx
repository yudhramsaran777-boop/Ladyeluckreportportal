import { PageHeader } from "@/components/page-header";
import { OwnerReportContent } from "@/components/owner/owner-report-content";

export const dynamic = "force-dynamic";

export default async function OwnerReportsPage({
  searchParams,
}: {
  searchParams?: { start?: string; end?: string };
}) {
  return (
    <div className="space-y-6">
      <PageHeader title="Owner Reports" showDateFilter={false} />
      <OwnerReportContent searchParams={searchParams} detailed />
    </div>
  );
}
