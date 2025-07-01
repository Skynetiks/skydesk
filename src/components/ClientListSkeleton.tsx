import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function ClientListSkeleton() {
  return (
    <div className="space-y-6">
      {/* Search and Actions Skeleton */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Skeleton className="w-full h-10 rounded-md" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-10 w-32 rounded-md" />
          <Skeleton className="h-10 w-28 rounded-md" />
        </div>
      </div>

      {/* Table Skeleton */}
      <div className="bg-white rounded-lg border shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]">
                <Skeleton className="w-4 h-4 rounded" />
              </TableHead>
              <TableHead className="w-[200px]">
                <Skeleton className="h-4 w-16" />
              </TableHead>
              <TableHead className="w-[200px]">
                <Skeleton className="h-4 w-20" />
              </TableHead>
              <TableHead>
                <Skeleton className="h-4 w-16" />
              </TableHead>
              <TableHead>
                <Skeleton className="h-4 w-16" />
              </TableHead>
              <TableHead>
                <Skeleton className="h-4 w-20" />
              </TableHead>
              <TableHead className="w-[100px]">
                <Skeleton className="h-4 w-16" />
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {[...Array(8)].map((_, i) => (
              <TableRow key={i}>
                <TableCell>
                  <Skeleton className="w-4 h-4 rounded" />
                </TableCell>
                <TableCell>
                  <div className="space-y-2">
                    <Skeleton className="h-5 w-32" />
                  </div>
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-24" />
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Skeleton className="h-6 w-20 rounded-full" />
                    <Skeleton className="h-6 w-16 rounded-full" />
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Skeleton className="h-6 w-16 rounded-full" />
                  </div>
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-20" />
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Skeleton className="h-8 w-8 rounded" />
                    <Skeleton className="h-8 w-8 rounded" />
                    <Skeleton className="h-8 w-8 rounded" />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
