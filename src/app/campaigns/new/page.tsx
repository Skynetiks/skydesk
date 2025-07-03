"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { trpc } from "@/app/_trpc/client";
import { SideNav } from "@/components/SideNav";
import { CampaignForm } from "@/components/CampaignForm";
import { PageSkeleton } from "@/components/PageSkeleton";

export default function NewCampaignPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<
    "dashboard" | "tickets" | "clients" | "campaigns" | "config" | "users"
  >("campaigns");

  const { data: clients, isLoading: clientsLoading } =
    trpc.client.getAllForCampaigns.useQuery({
      // Fetch all clients for campaign selection
    });

  const createCampaignMutation = trpc.campaign.create.useMutation({
    onSuccess: (campaign) => {
      router.push(`/campaigns/${campaign.id}`);
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
              Create New Campaign
            </h1>
            <p className="text-gray-600 mt-1">
              Set up an email campaign to reach your clients
            </p>
          </div>

          <CampaignForm
            clients={clients || []}
            clientsLoading={clientsLoading}
            onSubmit={createCampaignMutation.mutate}
            isLoading={createCampaignMutation.status === "pending"}
            error={createCampaignMutation.error?.message}
          />
        </div>
      </main>
    </div>
  );
}
