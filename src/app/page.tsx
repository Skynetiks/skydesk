"use client";

import { useSession, signIn } from "next-auth/react";
import { trpc } from "@/app/_trpc/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  TicketIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  TrendingUpIcon,
  AlertCircleIcon,
  BarChart3Icon,
} from "lucide-react";
import { SideNav } from "@/components/SideNav";
import { useState } from "react";

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState<
    "dashboard" | "tickets" | "config" | "users"
  >("dashboard");
  const { data: session, status: sessionStatus } = useSession();
  const { data: stats } = trpc.ticket.getStats.useQuery(undefined, {
    enabled: !!session,
  });
  const { data: currentUser, isLoading: isUserLoading } =
    trpc.user.getCurrent.useQuery(undefined, {
      enabled: !!session,
    });

  if (sessionStatus === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
        <div className="text-lg text-gray-600">Loading session...</div>
      </div>
    );
  }

  if (sessionStatus === "unauthenticated") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
        <div className="text-center">
          <div className="text-lg text-gray-600 mb-4">
            Please sign in to continue
          </div>
          <Button onClick={() => signIn()}>Sign In</Button>
        </div>
      </div>
    );
  }

  if (isUserLoading || !currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
        <div className="text-lg text-gray-600">Loading user info...</div>
      </div>
    );
  }

  const isAdmin = currentUser?.role === "ADMIN";
  const completionRate = stats
    ? Math.round(((stats.resolved + stats.closed) / stats.total) * 100)
    : 0;

  return (
    <div className="h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 flex overflow-hidden">
      {/* Side Navigation */}
      <SideNav
        activeTab={activeTab}
        onTabChange={setActiveTab}
        isAdmin={isAdmin}
        stats={stats}
        currentUser={currentUser}
      />
      {/* Main Content Area */}
      <div className="flex-1 lg:ml-0 overflow-y-auto">
        <div className="p-6 lg:p-8 pt-16 lg:pt-8">
          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-gradient-to-br from-indigo-600 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
              <BarChart3Icon className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
                Dashboard
              </h1>
              <p className="text-gray-600 mt-1">
                Overview of ticket statistics and system performance
              </p>
            </div>
          </div>

          {/* Enhanced Statistics Dashboard - Admin only */}
          {isAdmin && stats && (
            <div className="mb-8 space-y-6">
              {/* Overview Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                {/* Total Tickets Card */}
                <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200 hover:shadow-lg transition-all duration-300">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-blue-600 mb-1">
                          Total Tickets
                        </p>
                        <p className="text-3xl font-bold text-blue-900">
                          {stats.total}
                        </p>
                        <p className="text-xs text-blue-600 mt-1 flex items-center gap-1">
                          <BarChart3Icon className="w-3 h-3" /> All time
                        </p>
                      </div>
                      <div className="w-14 h-14 bg-blue-200 rounded-full flex items-center justify-center">
                        <TicketIcon className="w-7 h-7 text-blue-600" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
                {/* Open Tickets Card */}
                <Card className="bg-gradient-to-br from-red-50 to-red-100 border-red-200 hover:shadow-lg transition-all duration-300">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-red-600 mb-1">
                          Open Tickets
                        </p>
                        <p className="text-3xl font-bold text-red-900">
                          {stats.open}
                        </p>
                        <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                          <AlertCircleIcon className="w-3 h-3" /> Needs
                          attention
                        </p>
                      </div>
                      <div className="w-14 h-14 bg-red-200 rounded-full flex items-center justify-center">
                        <XCircleIcon className="w-7 h-7 text-red-600" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
                {/* In Progress Card */}
                <Card className="bg-gradient-to-br from-yellow-50 to-yellow-100 border-yellow-200 hover:shadow-lg transition-all duration-300">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-yellow-600 mb-1">
                          In Progress
                        </p>
                        <p className="text-3xl font-bold text-yellow-900">
                          {stats.inProgress}
                        </p>
                        <p className="text-xs text-yellow-600 mt-1 flex items-center gap-1">
                          <ClockIcon className="w-3 h-3" /> Being worked on
                        </p>
                      </div>
                      <div className="w-14 h-14 bg-yellow-200 rounded-full flex items-center justify-center">
                        <ClockIcon className="w-7 h-7 text-yellow-600" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
                {/* Resolved/Closed Card */}
                <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200 hover:shadow-lg transition-all duration-300">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-green-600 mb-1">
                          Completed
                        </p>
                        <p className="text-3xl font-bold text-green-900">
                          {stats.resolved + stats.closed}
                        </p>
                        <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                          <CheckCircleIcon className="w-3 h-3" />
                          {completionRate}% completion rate
                        </p>
                      </div>
                      <div className="w-14 h-14 bg-green-200 rounded-full flex items-center justify-center">
                        <CheckCircleIcon className="w-7 h-7 text-green-600" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
              {/* Detailed Status Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                {/* Resolution Breakdown */}
                <Card className="bg-white/70 backdrop-blur-sm border-white/20 hover:shadow-lg transition-all duration-300">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                      <TrendingUpIcon className="w-5 h-5 text-blue-600" />{" "}
                      Resolution Status
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                          <span className="font-medium text-green-800">
                            Resolved
                          </span>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-bold text-green-800">
                            {stats.resolved}
                          </div>
                          <div className="text-xs text-green-600">
                            Ready for review
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="w-3 h-3 bg-gray-500 rounded-full"></div>
                          <span className="font-medium text-gray-800">
                            Closed
                          </span>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-bold text-gray-800">
                            {stats.closed}
                          </div>
                          <div className="text-xs text-gray-600">Completed</div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                {/* Progress Overview */}
                <Card className="bg-white/70 backdrop-blur-sm border-white/20 hover:shadow-lg transition-all duration-300">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                      <BarChart3Icon className="w-5 h-5 text-purple-600" />{" "}
                      Ticket Overview
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {/* Progress Bar */}
                      <div>
                        <div className="flex justify-between text-sm text-gray-600 mb-2">
                          <span>Overall Progress</span>
                          <span>{completionRate}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-3">
                          <div
                            className="bg-gradient-to-r from-blue-500 to-green-500 h-3 rounded-full transition-all duration-500"
                            style={{ width: `${completionRate}%` }}
                          ></div>
                        </div>
                      </div>
                      {/* Quick Stats */}
                      <div className="grid grid-cols-2 gap-4 pt-2">
                        <div className="text-center p-3 bg-blue-50 rounded-lg">
                          <div className="text-xl font-bold text-blue-800">
                            {stats.open + stats.inProgress}
                          </div>
                          <div className="text-xs text-blue-600">Active</div>
                        </div>
                        <div className="text-center p-3 bg-green-50 rounded-lg">
                          <div className="text-xl font-bold text-green-800">
                            {stats.resolved + stats.closed}
                          </div>
                          <div className="text-xs text-green-600">Complete</div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </div>
      </div>
      {/* Floating Action Button for Mobile */}
      <div className="fixed bottom-6 right-6 sm:hidden">
        <Button
          size="lg"
          className="w-14 h-14 rounded-full shadow-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
        >
          <TicketIcon className="w-6 h-6" />
        </Button>
      </div>
    </div>
  );
}
