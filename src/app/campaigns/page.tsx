"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { trpc } from "@/app/_trpc/client";
import { SideNav } from "@/components/SideNav";
import { CampaignList } from "@/components/CampaignList";
import { CampaignListSkeleton } from "@/components/CampaignListSkeleton";
import { PageSkeleton } from "@/components/PageSkeleton";

export default function CampaignsPage() {
  const { data: session, status } = useSession();
  const [activeTab, setActiveTab] = useState<
    "dashboard" | "tickets" | "clients" | "campaigns" | "config" | "users"
  >("campaigns");

  const {
    data: campaigns,
    isLoading,
    error,
  } = trpc.campaign.getAll.useQuery({
    limit: 50,
  });

  // Check if any campaign is currently running
  const { data: runningCampaign } = trpc.campaign.getRunningCampaign.useQuery();

  const deleteCampaignMutation = trpc.campaign.delete.useMutation({
    onSuccess: () => {
      // Refetch campaigns data
      window.location.reload();
    },
    onError: (error) => {
      // Show error message (you can add a toast notification here)
      console.error("Failed to delete campaign:", error.message);
      alert(`Failed to delete campaign: ${error.message}`);
    },
  });

  if (status === "loading") {
    return <PageSkeleton />;
  }

  if (!session) {
    return <div>Please sign in to access this page.</div>;
  }

  const isAdmin = session.user.role === "ADMIN";

  if (!isAdmin) {
    return <div>Access denied. Admin privileges required.</div>;
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <SideNav
        activeTab={activeTab}
        onTabChange={setActiveTab}
        isAdmin={isAdmin}
        currentUser={{
          name: session.user.name,
          role: session.user.role,
        }}
      />

      <main className="flex-1 overflow-auto">
        <div className="p-6">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">
              Email Campaigns
            </h1>
            <p className="text-gray-600 mt-1">
              Create and manage email campaigns to reach your clients
            </p>
          </div>

          {isLoading ? (
            <CampaignListSkeleton />
          ) : error ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-800">
                Error loading campaigns: {error.message}
              </p>
            </div>
          ) : (
            <CampaignList
              campaigns={(campaigns?.items || []).map((c) => ({
                ...c,
                createdAt: new Date(c.createdAt),
                updatedAt: new Date(c.updatedAt),
                lastExecuted: c.lastExecuted
                  ? new Date(c.lastExecuted)
                  : undefined,
              }))}
              onDelete={(id) => deleteCampaignMutation.mutate({ id })}
              isDeleting={deleteCampaignMutation.status === "pending"}
              runningCampaign={runningCampaign}
            />
          )}
        </div>
      </main>
    </div>
  );
}
