import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";

export function TicketListSkeleton() {
  return (
    <div className="space-y-6">
      {/* Filters Skeleton */}
      <Card className="bg-white/50 backdrop-blur-sm border-white/20">
        <CardContent className="p-4">
          <div className="flex flex-col space-y-4">
            <div className="flex items-center gap-2">
              <Skeleton className="w-4 h-4" />
              <Skeleton className="h-4 w-24" />
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-10 w-full sm:w-40" />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Ticket Cards Skeleton */}
      <div className="space-y-4">
        {[...Array(6)].map((_, i) => (
          <Card
            key={i}
            className="bg-white/70 backdrop-blur-sm border-white/20 hover:shadow-lg transition-all duration-300"
          >
            <CardContent className="p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex-1 space-y-3">
                  {/* Title and Status */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-5 w-3/4" />
                      <Skeleton className="h-4 w-1/2" />
                    </div>
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-6 w-16 rounded-full" />
                      <Skeleton className="h-6 w-20 rounded-full" />
                    </div>
                  </div>

                  {/* Description */}
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-2/3" />
                  </div>

                  {/* Meta Information */}
                  <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
                    <div className="flex items-center gap-1">
                      <Skeleton className="w-4 h-4" />
                      <Skeleton className="h-4 w-20" />
                    </div>
                    <div className="flex items-center gap-1">
                      <Skeleton className="w-4 h-4" />
                      <Skeleton className="h-4 w-24" />
                    </div>
                    <div className="flex items-center gap-1">
                      <Skeleton className="w-4 h-4" />
                      <Skeleton className="h-4 w-16" />
                    </div>
                  </div>
                </div>

                {/* Action Button */}
                <div className="flex items-center gap-2">
                  <Skeleton className="w-4 h-4" />
                  <Skeleton className="h-9 w-20" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Load More Button Skeleton */}
      <div className="flex justify-center pt-4">
        <Skeleton className="h-10 w-32" />
      </div>
    </div>
  );
}
