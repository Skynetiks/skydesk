"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { SideNav } from "@/components/SideNav";
import { ClientList } from "@/components/ClientList";
import { ClientListSkeleton } from "@/components/ClientListSkeleton";
import { PageSkeleton } from "@/components/PageSkeleton";
import { trpc } from "@/app/_trpc/client";
import { Building2Icon } from "lucide-react";

export default function ClientsPage() {
  const [activeTab, setActiveTab] = useState<
    "dashboard" | "tickets" | "clients" | "campaigns" | "config" | "users"
  >("clients");

  const { data: session, status: sessionStatus } = useSession();
  const { data: stats } = trpc.ticket.getStats.useQuery(undefined, {
    enabled: !!session,
  });
  const { data: currentUser, isLoading: isUserLoading } =
    trpc.user.getCurrent.useQuery(undefined, {
      enabled: !!session,
    });

  if (sessionStatus === "loading" || isUserLoading) {
    return (
      <PageSkeleton
        headerIcon={<Building2Icon className="w-6 h-6 text-white" />}
      >
        <ClientListSkeleton />
      </PageSkeleton>
    );
  }

  if (sessionStatus === "unauthenticated") {
    return <div>Please log in to access this page.</div>;
  }

  if (!session?.user || !currentUser) {
    return <div>Unable to load user data. Please try refreshing the page.</div>;
  }

  const isAdmin = currentUser?.role === "ADMIN";

  if (!isAdmin) {
    return <div>Access denied. Admin privileges required.</div>;
  }

  return (
    <div className="h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 flex overflow-hidden">
      <SideNav
        activeTab={activeTab}
        onTabChange={setActiveTab}
        isAdmin={isAdmin}
        stats={stats}
        currentUser={currentUser}
      />
      <div className="flex-1 lg:ml-0 overflow-y-auto">
        <div className="p-6 lg:p-8 pt-16 lg:pt-8">
          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-gradient-to-br from-emerald-600 to-green-600 rounded-xl flex items-center justify-center shadow-lg">
              <Building2Icon className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
                Clients
              </h1>
              <p className="text-gray-600 mt-1">Manage your client database</p>
            </div>
          </div>

          <ClientList isAdmin={isAdmin} />
        </div>
      </div>
    </div>
  );
}
