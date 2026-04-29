import { notFound } from "next/navigation";
import { requireActiveOrganization, requirePermission } from "@/lib/auth";
import { buildReport } from "@/lib/services/reports";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { PrintButton } from "./print-button";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function getValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ReportPreviewPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requirePermission("reports.read");
  const active = await requireActiveOrganization();
  const definitionId = getValue((await searchParams).definitionId);

  if (!definitionId) {
    notFound();
  }

  const report = await buildReport(active.organization.id, definitionId);

  return (
    <div>
      <PageHeader
        title={report.name}
        description={`${report.description} · generated preview from real Fortexa data`}
        actions={<PrintButton />}
      />

      <div className="space-y-6">
        {report.sections.map((section) => {
          const headers = Array.from(
            section.rows.reduce<Set<string>>((acc, row) => {
              Object.keys(row).forEach((key) => acc.add(key));
              return acc;
            }, new Set())
          );

          return (
            <Card
              key={section.title}
              className="overflow-hidden rounded-2xl border border-[#E9ECEF] bg-white dark:border-[#27272a] dark:bg-[#141419]"
            >
              <div className="border-b border-[#E9ECEF] px-5 py-4 dark:border-[#27272a]">
                <h2 className="text-sm font-semibold text-[#1A1A2E] dark:text-[#fafafa]">
                  {section.title}
                </h2>
              </div>
              {section.rows.length === 0 ? (
                <div className="px-5 py-8 text-sm text-[#6B7280] dark:text-[#94A3B8]">
                  No data available for this section.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="dark-table-head border-b border-[#F3F4F6] dark:border-[#27272a]">
                        {headers.map((header) => (
                          <th
                            key={header}
                            className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#6B7280] dark:text-[#94A3B8]"
                          >
                            {header.replaceAll("_", " ")}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {section.rows.map((row, index) => (
                        <tr
                          key={index}
                          className="dark-table-row border-b border-[#F3F4F6] last:border-0 dark:border-[#27272a]"
                        >
                          {headers.map((header) => (
                            <td
                              key={header}
                              className="px-4 py-3 text-[#1A1A2E] dark:text-[#fafafa]"
                            >
                              {row[header] ?? "—"}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
