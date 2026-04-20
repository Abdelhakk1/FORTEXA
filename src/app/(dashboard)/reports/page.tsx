"use client";

import { Download, FileText, BarChart3, Presentation, Plus, Eye, MoreHorizontal } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { PageHeader } from "@/components/shared/page-header";
import { KpiCard } from "@/components/shared/kpi-card";

const mockTemplates = [
   { id: "t1", name: "Executive Summary", type: "Presentation", lastUsed: "2 days ago" },
   { id: "t2", name: "Detailed Vulnerability Assessment", type: "PDF Report", lastUsed: "1 week ago" },
   { id: "t3", name: "Compliance & Audit", type: "CSV Export", lastUsed: "3 days ago" },
   { id: "t4", name: "Remediation Progress tracking", type: "Interactive Dashboard map", lastUsed: "Just now" },
];

export default function ReportsPage() {
   return (
      <div>
         <PageHeader
            title="Reports & Analytics"
            description="Generate, schedule, and distribute compliance and vulnerability reports."
            actions={
               <Button className="gradient-accent text-white cursor-pointer border-0">
                  <Plus className="h-4 w-4 mr-2" /> Create Template
               </Button>
            }
         />

         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 animate-stagger">
            <KpiCard label="Reports Generated" value="48" change="+12 this month" changeType="positive" icon={<FileText className="h-5 w-5" />} />
            <KpiCard label="Scheduled Reports" value="12" change="Running smoothly" changeType="neutral" icon={<Presentation className="h-5 w-5" />} />
            <KpiCard label="Total Templates" value="6" change="1 new template added" changeType="neutral" icon={<BarChart3 className="h-5 w-5" />} />
            <KpiCard label="Active Viewers" value="14" change="+2 this week" changeType="positive" icon={<Eye className="h-5 w-5" />} />
         </div>

         <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
               <Card className="border border-[#E9ECEF] dark:border-[#27272a] bg-white dark:bg-[#141419] overflow-hidden">
                  <div className="px-5 py-4 border-b border-[#E9ECEF] dark:border-[#27272a] flex items-center justify-between">
                     <h3 className="text-sm font-semibold text-[#1A1A2E] dark:text-[#fafafa]">Recent Reports</h3>
                  </div>
                  <div className="overflow-x-auto">
                     <table className="w-full text-sm">
                        <thead>
                           <tr className="dark-table-head">
                              <th className="text-left py-3 px-4 text-xs font-semibold text-[#6B7280] dark:text-[#94A3B8] uppercase tracking-wider">Name</th>
                              <th className="text-left py-3 px-4 text-xs font-semibold text-[#6B7280] dark:text-[#94A3B8] uppercase tracking-wider">Date</th>
                              <th className="text-left py-3 px-4 text-xs font-semibold text-[#6B7280] dark:text-[#94A3B8] uppercase tracking-wider">Author</th>
                              <th className="text-left py-3 px-4 text-xs font-semibold text-[#6B7280] dark:text-[#94A3B8] uppercase tracking-wider">Actions</th>
                           </tr>
                        </thead>
                        <tbody>
                           <tr className="dark-table-row">
                              <td className="py-3 px-4">
                                 <p className="font-medium text-[#1A1A2E] dark:text-[#fafafa]">Monthly Vulnerability Summary - March</p>
                                 <p className="text-xs text-[#6B7280] dark:text-[#94A3B8]">PDF Report</p>
                              </td>
                              <td className="py-3 px-4 text-[#6B7280] dark:text-[#94A3B8]">Mar 31, 2026</td>
                              <td className="py-3 px-4 text-[#6B7280] dark:text-[#94A3B8]">System</td>
                              <td className="py-3 px-4">
                                 <Button variant="ghost" size="sm" className="h-8 w-8 p-0 cursor-pointer text-[#6B7280] dark:text-[#94A3B8] hover:text-[#0C5CAB] dark:hover:text-[#60A5FA]">
                                    <Download className="h-4 w-4" />
                                 </Button>
                              </td>
                           </tr>
                           <tr className="dark-table-row">
                              <td className="py-3 px-4">
                                 <p className="font-medium text-[#1A1A2E] dark:text-[#fafafa]">Critical Assets Exposure</p>
                                 <p className="text-xs text-[#6B7280] dark:text-[#94A3B8]">Interactive Dashboard Map</p>
                              </td>
                              <td className="py-3 px-4 text-[#6B7280] dark:text-[#94A3B8]">Mar 28, 2026</td>
                              <td className="py-3 px-4 text-[#6B7280] dark:text-[#94A3B8]">Admin User</td>
                              <td className="py-3 px-4">
                                 <Button variant="ghost" size="sm" className="h-8 w-8 p-0 cursor-pointer text-[#6B7280] dark:text-[#94A3B8] hover:text-[#0C5CAB] dark:hover:text-[#60A5FA]">
                                    <Eye className="h-4 w-4" />
                                 </Button>
                              </td>
                           </tr>
                        </tbody>
                     </table>
                  </div>
               </Card>
            </div>

            <div className="space-y-6">
               <Card className="border border-[#E9ECEF] dark:border-[#27272a] bg-white dark:bg-[#141419] p-5">
                  <div className="flex items-center justify-between mb-4">
                     <h3 className="text-sm font-semibold text-[#1A1A2E] dark:text-[#fafafa]">Report Templates</h3>
                  </div>
                  <div className="space-y-3">
                     {mockTemplates.map(template => (
                        <div key={template.id} className="p-3 rounded-xl border border-[#E9ECEF] dark:border-[#27272a] bg-[#F9FAFB] dark:bg-[#1a1a22] flex items-center justify-between">
                           <div>
                              <p className="text-sm font-medium text-[#1A1A2E] dark:text-[#fafafa]">{template.name}</p>
                              <p className="text-xs text-[#6B7280] dark:text-[#94A3B8]">{template.type} · Used {template.lastUsed}</p>
                           </div>
                           <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                 <Button variant="ghost" size="icon" className="h-8 w-8 cursor-pointer text-[#6B7280] dark:text-[#94A3B8]">
                                    <MoreHorizontal className="h-4 w-4" />
                                 </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-48 bg-white dark:bg-[#141419] border-[#E9ECEF] dark:border-[#27272a]">
                                 <DropdownMenuItem className="cursor-pointer focus:bg-[#EFF6FF] dark:focus:bg-[#1a1a22] focus:text-[#0C5CAB] dark:focus:text-[#60A5FA]">Generate Report</DropdownMenuItem>
                                 <DropdownMenuItem className="cursor-pointer focus:bg-[#EFF6FF] dark:focus:bg-[#1a1a22] focus:text-[#0C5CAB] dark:focus:text-[#60A5FA]">Edit Template</DropdownMenuItem>
                              </DropdownMenuContent>
                           </DropdownMenu>
                        </div>
                     ))}
                  </div>
               </Card>
            </div>
         </div>
      </div>
   );
}
