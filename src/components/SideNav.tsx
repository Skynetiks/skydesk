"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  TicketIcon,
  SettingsIcon,
  UsersIcon,
  XIcon,
  LogOutIcon,
  UserIcon,
  BarChart3Icon,
  ChevronRight,
  Building2Icon,
  MailIcon,
} from "lucide-react";
import { signOut } from "next-auth/react";
import { useRouter } from "next/navigation";

interface SideNavProps {
  activeTab:
    | "dashboard"
    | "tickets"
    | "clients"
    | "campaigns"
    | "config"
    | "users";
  onTabChange: (
    tab: "dashboard" | "tickets" | "clients" | "campaigns" | "config" | "users"
  ) => void;
  isAdmin: boolean;
  stats?: {
    total: number;
    open: number;
    inProgress: number;
    resolved: number;
    closed: number;
    unassigned: number;
  };
  currentUser?: {
    name?: string;
    role?: string;
  };
}

export function SideNav({
  activeTab,
  onTabChange,
  isAdmin,
  stats,
  currentUser,
}: SideNavProps) {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const router = useRouter();

  const navigationItems = [
    {
      id: "dashboard" as const,
      label: "Dashboard",
      icon: BarChart3Icon,
      description: "Overview & stats",
      color: "from-indigo-600 to-blue-600",
      hoverColor: "hover:from-indigo-700 hover:to-blue-700",
      route: "/",
    },
    {
      id: "tickets" as const,
      label: "Tickets",
      icon: TicketIcon,
      description: isAdmin
        ? "Active & unassigned tickets"
        : "Your active tickets",
      color: "from-blue-600 to-indigo-600",
      hoverColor: "hover:from-blue-700 hover:to-indigo-700",
      count: isAdmin
        ? (stats?.inProgress || 0) + (stats?.unassigned || 0) // Admin: in progress + unassigned
        : stats?.inProgress || 0, // Non-admin: only in progress
      route: "/tickets",
    },
    ...(isAdmin
      ? [
          {
            id: "clients" as const,
            label: "Clients",
            icon: Building2Icon,
            description: "Manage client database",
            color: "from-emerald-600 to-green-600",
            hoverColor: "hover:from-emerald-700 hover:to-green-700",
            route: "/clients",
          },
          {
            id: "campaigns" as const,
            label: "Campaigns",
            icon: MailIcon,
            description: "Email campaigns & automation",
            color: "from-orange-600 to-red-600",
            hoverColor: "hover:from-orange-700 hover:to-red-700",
            route: "/campaigns",
          },
          {
            id: "config" as const,
            label: "Configuration",
            icon: SettingsIcon,
            description: "System settings & email config",
            color: "from-purple-600 to-pink-600",
            hoverColor: "hover:from-purple-700 hover:to-pink-700",
            route: "/admin/config",
          },
          {
            id: "users" as const,
            label: "User Management",
            icon: UsersIcon,
            description: "Manage team members",
            color: "from-green-600 to-teal-600",
            hoverColor: "hover:from-green-700 hover:to-teal-700",
            route: "/admin/users",
          },
        ]
      : []),
  ];

  const handleSignOut = () => {
    signOut({ callbackUrl: "/auth/signin" });
  };

  const handleNavigation = (item: (typeof navigationItems)[0]) => {
    router.push(item.route);
    onTabChange(item.id);
    // Close mobile sidebar after navigation
    setIsMobileOpen(false);
  };

  return (
    <>
      {/* Mobile overlay backdrop */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-30 lg:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={`fixed top-0 left-0 h-screen bg-white/90 backdrop-blur-xl border-r border-white/20 shadow-xl z-40 transition-all duration-300 flex flex-col w-64 lg:relative lg:translate-x-0 ${
          isMobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        {/* Header */}
        <div className="p-4 border-b border-white/20 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center shadow-lg flex-shrink-0">
                <TicketIcon className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="text-lg font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent truncate">
                  SkyDesk
                </h1>
              </div>
            </div>

            {/* Mobile close button - only show on mobile when sidebar is open */}
            <div className="lg:hidden">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsMobileOpen(false)}
                className="bg-white/80 backdrop-blur-sm border-white/20 shadow-lg"
              >
                <XIcon className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Navigation Items */}
        <div className="flex-1 p-4 space-y-2 overflow-y-auto">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNavigation(item)}
                className={`w-full group relative p-3 rounded-lg transition-all duration-200 ${
                  isActive
                    ? `bg-gradient-to-r ${item.color} text-white shadow-lg`
                    : "text-gray-700 hover:bg-gray-100 hover:text-gray-900"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`p-2 rounded-lg flex-shrink-0 ${
                      isActive
                        ? "bg-white/20"
                        : "bg-gray-100 group-hover:bg-gray-200"
                    }`}
                  >
                    <Icon
                      className={`w-5 h-5 ${
                        isActive ? "text-white" : "text-gray-600"
                      }`}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm truncate">
                        {item.label}
                      </span>
                      {item.count !== undefined && (
                        <Badge
                          className={`ml-2 ${
                            isActive
                              ? "bg-white/20 text-white border-white/30"
                              : "bg-blue-100 text-blue-700 border-blue-200"
                          }`}
                        >
                          {item.count}
                        </Badge>
                      )}
                    </div>
                    <p
                      className={`text-xs mt-1 truncate ${
                        isActive ? "text-white/80" : "text-gray-500"
                      }`}
                    >
                      {item.description}
                    </p>
                  </div>
                </div>
                {isActive && (
                  <div className="absolute right-2 top-1/2 transform -translate-y-1/2 w-2 h-2 bg-white rounded-full"></div>
                )}
              </button>
            );
          })}
        </div>

        {/* User Profile & Sign Out - Fixed at bottom */}
        <div className="p-4 border-t border-white/20 flex-shrink-0">
          {currentUser && (
            <div className="mb-3 p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-full flex items-center justify-center">
                  <UserIcon className="w-4 h-4 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {currentUser.name}
                  </p>
                  {currentUser.role && (
                    <Badge className="text-xs bg-blue-100 text-blue-700 border-blue-200">
                      {currentUser.role}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          )}
          <Button
            onClick={handleSignOut}
            variant="outline"
            size="sm"
            className="w-full border-gray-200 text-gray-700 hover:bg-gray-50"
          >
            <LogOutIcon className="w-4 h-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </div>

      {/* Mobile menu button - only show when sidebar is closed */}
      {!isMobileOpen && (
        <div className="lg:hidden">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsMobileOpen(true)}
            className="fixed top-4 left-4 z-50 bg-white/80 backdrop-blur-sm border-white/20 shadow-lg"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}
    </>
  );
}
