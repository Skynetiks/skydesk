"use client";

import { TicketList } from "@/components/TicketList";
import { TicketListSkeleton } from "@/components/TicketListSkeleton";
import { PageSkeleton } from "@/components/PageSkeleton";
import { SideNav } from "@/components/SideNav";
import { TicketIcon } from "lucide-react";
import { useState } from "react";
import { useSession } from "next-auth/react";
import { trpc } from "@/app/_trpc/client";

export default function TicketsPage() {
  const [activeTab, setActiveTab] = useState<
    "dashboard" | "tickets" | "config" | "users"
  >("tickets");
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
        headerIcon={<TicketIcon className="w-6 h-6 text-white" />}
        headerTitle="Support Tickets"
        headerDescription="Manage and respond to customer support requests"
      >
        <TicketListSkeleton />
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
            <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
              <TicketIcon className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
                Support Tickets
              </h1>
              <p className="text-gray-600 mt-1">
                Manage and respond to customer support requests
              </p>
            </div>
          </div>

          <TicketList />
        </div>
      </div>
    </div>
  );
}
