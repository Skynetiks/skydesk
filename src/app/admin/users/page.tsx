"use client";

import { UserManagement } from "@/components/UserManagement";
import { useSession } from "next-auth/react";
import { trpc } from "@/app/_trpc/client";
import { SideNav } from "@/components/SideNav";
import { PageSkeleton } from "@/components/PageSkeleton";
import { UsersIcon } from "lucide-react";
import { useState } from "react";

export default function AdminUsersPage() {
  const { data: session, status } = useSession();
  const { data: stats } = trpc.ticket.getStats.useQuery(undefined, {
    enabled: !!session,
  });
  const { data: currentUser, isLoading: isUserLoading } =
    trpc.user.getCurrent.useQuery(undefined, {
      enabled: !!session,
    });
  const [activeTab, setActiveTab] = useState<
    "dashboard" | "tickets" | "clients" | "campaigns" | "config" | "users"
  >("users");

  if (status === "loading" || isUserLoading) {
    return (
      <PageSkeleton headerIcon={<UsersIcon className="w-6 h-6 text-white" />} />
    );
  }

  if (status === "unauthenticated") {
    return <div>Please log in to access this page.</div>;
  }

  if (!session?.user || !currentUser) {
    return <div>Unable to load user data. Please try refreshing the page.</div>;
  }

  if (session.user.role !== "ADMIN") {
    return <div>Access denied. Admin privileges required.</div>;
  }

  return (
    <div className="h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 flex overflow-hidden">
      <SideNav
        activeTab={activeTab}
        onTabChange={setActiveTab}
        isAdmin={true}
        stats={stats}
        currentUser={currentUser}
      />
      <div className="flex-1 lg:ml-0 overflow-y-auto">
        <div className="p-6 lg:p-8 pt-16 lg:pt-8">
          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-gradient-to-br from-green-600 to-teal-600 rounded-xl flex items-center justify-center shadow-lg">
              <UsersIcon className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
                User Management
              </h1>
              <p className="text-gray-600 mt-1">
                Manage team members and their permissions
              </p>
            </div>
          </div>

          <UserManagement />
        </div>
      </div>
    </div>
  );
}
