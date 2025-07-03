"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { trpc } from "@/app/_trpc/client";
import { SideNav } from "@/components/SideNav";
import { CampaignForm } from "@/components/CampaignForm";
import { PageSkeleton } from "@/components/PageSkeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

export default function EditCampaignPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();

  const campaignId = params?.id as string | undefined;
  if (!campaignId) {
    return <div>Invalid campaign ID</div>;
  }

  const [activeTab, setActiveTab] = useState<
    "dashboard" | "tickets" | "clients" | "campaigns" | "config" | "users"
  >("campaigns");

  const { data: campaign, isLoading: campaignLoading } =
    trpc.campaign.getById.useQuery({
      id: campaignId,
    });

  const { data: clients, isLoading: clientsLoading } =
    trpc.client.getAllForCampaigns.useQuery({});

  const updateCampaignMutation = trpc.campaign.update.useMutation({
    onSuccess: () => {
      router.push(`/campaigns/${campaignId}`);
    },
  });

  if (status === "loading" || campaignLoading) {
    return <PageSkeleton />;
  }

  if (!session) {
    return <div>Please sign in to access this page.</div>;
  }

  const isAdmin = session.user.role === "ADMIN";

  if (!isAdmin) {
    return <div>Access denied. Admin privileges required.</div>;
  }

  if (!campaign) {
    return <div>Campaign not found</div>;
  }

  // Check if campaign can be edited
  if (campaign.status !== "DRAFT") {
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
            <Alert className="border-red-200 bg-red-50">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-800">
                This campaign cannot be edited because it is in{" "}
                {campaign.status} status. Only campaigns in DRAFT status can be
                edited.
              </AlertDescription>
            </Alert>
          </div>
        </main>
      </div>
    );
  }

  // Prepare initial data for the form
  const initialData = {
    name: campaign.name,
    subject: campaign.subject,
    body: campaign.body,
    concurrency: campaign.concurrency,
    delaySeconds: campaign.delaySeconds,
    clientIds: campaign.recipients
      .map((r) => r.clientId)
      .filter(Boolean) as string[],
    additionalEmails: campaign.recipients
      .filter((r) => !r.clientId)
      .map((r) => r.email),
  };

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
            <h1 className="text-2xl font-bold text-gray-900">Edit Campaign</h1>
            <p className="text-gray-600 mt-1">
              Update your email campaign settings
            </p>
          </div>

          <CampaignForm
            clients={clients || []}
            clientsLoading={clientsLoading}
            onSubmit={(data) =>
              updateCampaignMutation.mutate({ id: campaignId, ...data })
            }
            isLoading={updateCampaignMutation.status === "pending"}
            error={updateCampaignMutation.error?.message}
            initialData={initialData}
            isEditing={true}
          />
        </div>
      </main>
    </div>
  );
}
