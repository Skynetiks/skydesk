"use client";

import { TicketDetail } from "@/components/TicketDetail";
import { SideNav } from "@/components/SideNav";
import { useState } from "react";
import { useSession } from "next-auth/react";
import { trpc } from "@/app/_trpc/client";
import { TicketIcon, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";

export default function TicketPage() {
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
  const params = useParams();
  const ticketId = params?.id as string;

  if (!ticketId) {
    return <div>Invalid ticket ID</div>;
  }

  if (sessionStatus === "loading" || isUserLoading) {
    return <div>Loading...</div>;
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
        <div className="p-6 lg:p-8 pt-8 lg:pt-8">
          {/* Back Button */}
          <div className="mb-4">
            <Link
              href="/tickets"
              className="inline-flex items-center gap-2 text-gray-600 hover:text-blue-700 font-medium text-sm"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Tickets
            </Link>
          </div>
          {/* Breadcrumbs */}
          <nav className="mb-4 text-sm text-gray-500" aria-label="Breadcrumb">
            <ol className="list-none p-0 inline-flex items-center gap-1">
              <li>
                <Link href="/" className="hover:text-blue-700">
                  Home
                </Link>
                <span className="mx-2">/</span>
              </li>
              <li>
                <Link href="/tickets" className="hover:text-blue-700">
                  Tickets
                </Link>
                <span className="mx-2">/</span>
              </li>
              <li
                className="text-gray-700 font-semibold truncate max-w-xs"
                title={ticketId}
              >
                {ticketId}
              </li>
            </ol>
          </nav>
          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
              <TicketIcon className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
                Ticket Details
              </h1>
              <p className="text-gray-600 mt-1">
                View and respond to this support ticket
              </p>
            </div>
          </div>

          <TicketDetail />
        </div>
      </div>
    </div>
  );
}
