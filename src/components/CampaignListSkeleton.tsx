import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function CampaignListSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header Skeleton */}
      <div className="flex justify-between items-center">
        <div>
          <Skeleton className="h-6 w-48 mb-2" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-10 w-40" />
      </div>

      {/* Campaigns Grid Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: 6 }).map((_, index) => (
          <Card key={index} className="animate-pulse">
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-6 w-16" />
              </div>
              <Skeleton className="h-4 w-48 mt-2" />
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Statistics Skeleton */}
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-2 bg-gray-50 rounded">
                  <Skeleton className="h-4 w-8 mx-auto mb-1" />
                  <Skeleton className="h-3 w-16 mx-auto" />
                </div>
                <div className="text-center p-2 bg-gray-50 rounded">
                  <Skeleton className="h-4 w-8 mx-auto mb-1" />
                  <Skeleton className="h-3 w-16 mx-auto" />
                </div>
              </div>

              {/* Progress Skeleton */}
              <div className="space-y-2">
                <div className="flex justify-between">
                  <Skeleton className="h-3 w-12" />
                  <Skeleton className="h-3 w-12" />
                </div>
                <Skeleton className="h-2 w-full rounded-full" />
              </div>

              {/* Schedule Info Skeleton */}
              <div className="flex items-center">
                <Skeleton className="h-4 w-4 mr-2" />
                <Skeleton className="h-4 w-32" />
              </div>

              {/* Next Execution Skeleton */}
              <div className="flex items-center">
                <Skeleton className="h-4 w-4 mr-2" />
                <Skeleton className="h-4 w-24" />
              </div>

              {/* Created Info Skeleton */}
              <div className="flex items-center justify-between pt-2 border-t">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-3 w-20" />
              </div>

              {/* Actions Skeleton */}
              <div className="flex gap-2 pt-2">
                <Skeleton className="h-8 flex-1" />
                <Skeleton className="h-8 w-8" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
