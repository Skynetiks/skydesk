import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function CampaignDetailSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header Skeleton */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Skeleton className="h-9 w-20" />
          <div>
            <Skeleton className="h-8 w-64 mb-2" />
            <Skeleton className="h-4 w-48" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-6 w-16" />
          <Skeleton className="h-9 w-20" />
        </div>
      </div>

      {/* Quick Actions Skeleton */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div>
                <Skeleton className="h-4 w-24 mb-1" />
                <Skeleton className="h-9 w-24" />
              </div>
              <Skeleton className="h-4 w-32" />
            </div>
            <Skeleton className="h-9 w-32" />
          </div>
        </CardContent>
      </Card>

      {/* Tabs Skeleton */}
      <div className="border-b border-gray-200">
        <div className="flex space-x-8">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-10 w-20" />
          ))}
        </div>
      </div>

      {/* Content Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Campaign Information Skeleton */}
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
          </CardHeader>
          <CardContent className="space-y-4">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index}>
                <Skeleton className="h-4 w-24 mb-1" />
                <Skeleton className="h-4 w-32" />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Statistics Skeleton */}
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <div
                  key={index}
                  className="text-center p-4 bg-gray-50 rounded-lg"
                >
                  <Skeleton className="h-8 w-12 mx-auto mb-1" />
                  <Skeleton className="h-3 w-16 mx-auto" />
                </div>
              ))}
            </div>
            <div className="mt-4 p-3 bg-blue-50 rounded-lg">
              <div className="text-center">
                <Skeleton className="h-6 w-32 mx-auto mb-1" />
                <Skeleton className="h-4 w-48 mx-auto" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
