import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { BarChart3Icon } from "lucide-react";

export function DashboardSkeleton() {
  return (
    <div className="h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 flex overflow-hidden">
      {/* Side Navigation Skeleton */}
      <div className="fixed top-0 left-0 h-screen bg-white/90 backdrop-blur-xl border-r border-white/20 shadow-xl z-40 flex flex-col w-64 lg:relative lg:translate-x-0">
        {/* Header */}
        <div className="p-4 border-b border-white/20 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Skeleton className="w-10 h-10 rounded-lg" />
              <div className="flex-1 min-w-0">
                <Skeleton className="h-5 w-16" />
              </div>
            </div>
            <div className="lg:hidden">
              <Skeleton className="w-8 h-8 rounded" />
            </div>
          </div>
        </div>

        {/* Navigation Items */}
        <div className="flex-1 p-4 space-y-2 overflow-y-auto">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="w-full p-3 rounded-lg">
              <div className="flex items-center gap-3">
                <Skeleton className="w-9 h-9 rounded-lg" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-5 w-6 rounded-full" />
                  </div>
                  <Skeleton className="h-3 w-24 mt-1" />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* User Profile & Sign Out */}
        <div className="p-4 border-t border-white/20 flex-shrink-0">
          <div className="mb-3 p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-3">
              <Skeleton className="w-8 h-8 rounded-full" />
              <div className="flex-1 min-w-0">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-5 w-12 rounded-full mt-1" />
              </div>
            </div>
          </div>
          <Skeleton className="w-full h-9 rounded" />
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 lg:ml-0 overflow-y-auto">
        <div className="p-6 lg:p-8 pt-16 lg:pt-8">
          {/* Header Skeleton */}
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-gradient-to-br from-gray-400 to-gray-500 rounded-xl flex items-center justify-center shadow-lg">
              <BarChart3Icon className="w-6 h-6 text-white" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-4 w-64" />
            </div>
          </div>

          {/* Statistics Cards Skeleton */}
          <div className="mb-8 space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
              {[...Array(4)].map((_, i) => (
                <Card
                  key={i}
                  className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200"
                >
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="space-y-2">
                        <Skeleton className="h-4 w-20" />
                        <Skeleton className="h-8 w-16" />
                        <Skeleton className="h-3 w-24" />
                      </div>
                      <Skeleton className="w-14 h-14 rounded-full" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Detailed Status Cards Skeleton */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
              {[...Array(2)].map((_, i) => (
                <Card
                  key={i}
                  className="bg-white/70 backdrop-blur-sm border-white/20"
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                      <Skeleton className="w-5 h-5" />
                      <Skeleton className="h-6 w-32" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {[...Array(4)].map((_, j) => (
                        <div
                          key={j}
                          className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                        >
                          <div className="flex items-center gap-3">
                            <Skeleton className="w-3 h-3 rounded-full" />
                            <Skeleton className="h-4 w-24" />
                          </div>
                          <Skeleton className="h-4 w-12" />
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile menu button skeleton */}
      <div className="lg:hidden">
        <Skeleton className="fixed top-4 left-4 z-50 w-9 h-9 rounded" />
      </div>
    </div>
  );
}
