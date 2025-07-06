"use client";

import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { trpc } from "@/app/_trpc/client";
import { SideNav } from "@/components/SideNav";
import { CampaignDetail } from "@/components/CampaignDetail";
import { CampaignDetailSkeleton } from "@/components/CampaignDetailSkeleton";
import { PageSkeleton } from "@/components/PageSkeleton";

export default function CampaignDetailPage() {
  const { data: session, status } = useSession();
  const params = useParams();

  const campaignId = params?.id as string | undefined;
  console.log("Campaign detail page - params:", params);
  console.log("Campaign detail page - campaignId:", campaignId);

  if (!campaignId) {
    return <div>Invalid campaign ID</div>;
  }

  const {
    data: campaign,
    isLoading,
    error,
  } = trpc.campaign.getById.useQuery({
    id: campaignId,
  });

  console.log("Campaign query result:", { campaign, isLoading, error });

  const { data: stats } = trpc.campaign.getStats.useQuery({
    id: campaignId,
  });

  // Check if any campaign is currently running
  const { data: runningCampaign } = trpc.campaign.getRunningCampaign.useQuery();

  const executeCampaignMutation = trpc.campaign.execute.useMutation({
    onSuccess: () => {
      // Refetch campaign data
      window.location.reload();
    },
  });

  const updateStatusMutation = trpc.campaign.updateStatus.useMutation({
    onSuccess: () => {
      // Don't reload immediately - let the component handle the next action
    },
  });

  const deleteCampaignMutation = trpc.campaign.delete.useMutation({
    onSuccess: () => {
      // Redirect to campaigns list after successful deletion
      window.location.href = "/campaigns";
    },
  });

  const handleStartAndSend = async (
    status: "DRAFT" | "ACTIVE" | "PAUSED" | "COMPLETED" | "CANCELLED"
  ) => {
    try {
      console.log("handleStartAndSend called with status:", status);

      // First update the status
      console.log("Updating campaign status...");
      await updateStatusMutation.mutateAsync({ id: campaignId, status });
      console.log("Campaign status updated successfully");

      // Then execute the campaign
      console.log("Executing campaign...");
      executeCampaignMutation.mutate({ id: campaignId });
      console.log("Campaign execution triggered");
    } catch (error) {
      console.error("Error starting and sending campaign:", error);
    }
  };

  const handleDeleteCampaign = () => {
    if (
      confirm(
        "Are you sure you want to delete this campaign? This action cannot be undone."
      )
    ) {
      deleteCampaignMutation.mutate({ id: campaignId });
    }
  };

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

  if (isLoading) {
    return (
      <div className="flex h-screen bg-gray-50">
        <SideNav
          activeTab="campaigns"
          onTabChange={() => {}}
          isAdmin={isAdmin}
          currentUser={{
            name: session.user.name,
            role: session.user.role,
          }}
        />
        <main className="flex-1 overflow-auto">
          <div className="p-6">
            <CampaignDetailSkeleton />
          </div>
        </main>
      </div>
    );
  }

  if (error || !campaign) {
    return (
      <div className="flex h-screen bg-gray-50">
        <SideNav
          activeTab="campaigns"
          onTabChange={() => {}}
          isAdmin={isAdmin}
          currentUser={{
            name: session.user.name,
            role: session.user.role,
          }}
        />
        <main className="flex-1 overflow-auto">
          <div className="p-6">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-800">
                Error loading campaign: {error?.message || "Campaign not found"}
              </p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Convert date fields to Date objects
  const campaignWithDates = {
    ...campaign,
    createdAt: new Date(campaign.createdAt),
    updatedAt: new Date(campaign.updatedAt),
    lastExecuted: campaign.lastExecuted
      ? new Date(campaign.lastExecuted)
      : undefined,
    recipients: campaign.recipients.map((r) => ({
      ...r,
      sentAt: r.sentAt ? new Date(r.sentAt) : undefined,
      failedAt: r.failedAt ? new Date(r.failedAt) : undefined,
    })),
    executions: campaign.executions.map((e) => ({
      ...e,
      executionTime: new Date(e.executionTime),
    })),
  };

  // Convert stats.recentExecutions.executionTime to Date
  const statsWithDates = stats
    ? {
        ...stats,
        recentExecutions: stats.recentExecutions.map((e) => ({
          ...e,
          executionTime: new Date(e.executionTime),
        })),
      }
    : undefined;

  return (
    <div className="flex h-screen bg-gray-50">
      <SideNav
        activeTab="campaigns"
        onTabChange={() => {}}
        isAdmin={isAdmin}
        currentUser={{
          name: session.user.name,
          role: session.user.role,
        }}
      />

      <main className="flex-1 overflow-auto">
        <div className="p-6">
          <CampaignDetail
            campaign={campaignWithDates}
            stats={statsWithDates}
            onExecute={() => executeCampaignMutation.mutate({ id: campaignId })}
            isExecuting={executeCampaignMutation.status === "pending"}
            executionError={executeCampaignMutation.error?.message}
            onUpdateStatus={(status) => handleStartAndSend(status)}
            isUpdatingStatus={updateStatusMutation.status === "pending"}
            onDelete={handleDeleteCampaign}
            isDeleting={deleteCampaignMutation.status === "pending"}
            runningCampaign={runningCampaign}
          />
        </div>
      </main>
    </div>
  );
}
