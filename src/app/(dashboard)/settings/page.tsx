"use client";

import { Save, User, Shield, Bell, Database, Key } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";

export default function SettingsPage() {
  return (
    <div>
      <PageHeader
        title="Settings & Configurations"
        description="Manage your account, organization preferences, and platform integrations"
        actions={
          <Button className="gradient-accent text-white cursor-pointer border-0">
            <Save className="h-4 w-4 mr-2" /> Save Changes
          </Button>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="space-y-1">
          <Button variant="ghost" className="w-full justify-start text-[#0C5CAB] dark:text-[#60A5FA] bg-[#EFF6FF] dark:bg-[#1a1a22] font-semibold cursor-pointer"><User className="mr-2 h-4 w-4" /> Profile</Button>
          <Button variant="ghost" className="w-full justify-start text-[#6B7280] dark:text-[#94A3B8] hover:text-[#0C5CAB] dark:hover:text-[#60A5FA] hover:bg-[#EFF6FF] dark:hover:bg-[#1a1a22] cursor-pointer"><Shield className="mr-2 h-4 w-4" /> Security</Button>
          <Button variant="ghost" className="w-full justify-start text-[#6B7280] dark:text-[#94A3B8] hover:text-[#0C5CAB] dark:hover:text-[#60A5FA] hover:bg-[#EFF6FF] dark:hover:bg-[#1a1a22] cursor-pointer"><Bell className="mr-2 h-4 w-4" /> Notifications</Button>
          <Button variant="ghost" className="w-full justify-start text-[#6B7280] dark:text-[#94A3B8] hover:text-[#0C5CAB] dark:hover:text-[#60A5FA] hover:bg-[#EFF6FF] dark:hover:bg-[#1a1a22] cursor-pointer"><Database className="mr-2 h-4 w-4" /> Integrations</Button>
          <Button variant="ghost" className="w-full justify-start text-[#6B7280] dark:text-[#94A3B8] hover:text-[#0C5CAB] dark:hover:text-[#60A5FA] hover:bg-[#EFF6FF] dark:hover:bg-[#1a1a22] cursor-pointer"><Key className="mr-2 h-4 w-4" /> API Keys</Button>
        </div>

        <div className="md:col-span-3 space-y-6">
          <Card className="p-6 border border-[#E9ECEF] dark:border-[#27272a] bg-white dark:bg-[#141419]">
            <h3 className="text-lg font-bold text-[#1A1A2E] dark:text-[#fafafa] mb-4">Profile Information</h3>
            <div className="space-y-4">
              <div className="grid gap-2">
                <label className="text-sm font-medium text-[#1A1A2E] dark:text-[#fafafa]">Full Name</label>
                <input type="text" defaultValue="Admin User" className="flex h-10 w-full rounded-md border border-[#E9ECEF] dark:border-[#27272a] bg-[#F9FAFB] dark:bg-[#1a1a22] px-3 py-2 text-sm text-[#1A1A2E] dark:text-[#fafafa] focus:outline-none focus:ring-2 focus:ring-[#0C5CAB] dark:focus:ring-[#3B82F6] focus:border-transparent" />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium text-[#1A1A2E] dark:text-[#fafafa]">Email Address</label>
                <input type="email" defaultValue="admin@fortexa.com" className="flex h-10 w-full rounded-md border border-[#E9ECEF] dark:border-[#27272a] bg-[#F9FAFB] dark:bg-[#1a1a22] px-3 py-2 text-sm text-[#1A1A2E] dark:text-[#fafafa] focus:outline-none focus:ring-2 focus:ring-[#0C5CAB] dark:focus:ring-[#3B82F6] focus:border-transparent" />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium text-[#1A1A2E] dark:text-[#fafafa]">Role</label>
                <input type="text" defaultValue="Administrator" disabled className="flex h-10 w-full rounded-md border border-[#E9ECEF] dark:border-[#27272a] bg-[#F3F4F6] dark:bg-[#0f0f13] px-3 py-2 text-sm text-[#9CA3AF] dark:text-[#64748B] cursor-not-allowed" />
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
