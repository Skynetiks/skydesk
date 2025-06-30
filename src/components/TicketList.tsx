"use client";

import { useState } from "react";
import { trpc } from "@/app/_trpc/client";
import { TicketStatus, Priority } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ClockIcon,
  UserIcon,
  CalendarIcon,
  FilterIcon,
  RefreshCwIcon,
  AlertCircleIcon,
  CheckCircleIcon,
  XCircleIcon,
  MoreHorizontalIcon,
} from "lucide-react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { TicketListSkeleton } from "@/components/TicketListSkeleton";

export function TicketList() {
  const { data: session, status: sessionStatus } = useSession();
  const [filters, setFilters] = useState({
    status: undefined as TicketStatus | undefined,
    priority: undefined as Priority | undefined,
    assignedToId: undefined as string | undefined,
  });

  // Show loading state while session is loading
  if (sessionStatus === "loading") {
    return <TicketListSkeleton />;
  }

  // Don't show anything if not authenticated
  if (sessionStatus === "unauthenticated") {
    return (
      <div className="text-center py-8 text-gray-500">
        Please sign in to view tickets.
      </div>
    );
  }

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    trpc.ticket.getAll.useInfiniteQuery(
      {
        limit: 20,
        ...filters,
      },
      {
        getNextPageParam: (lastPage) => lastPage.nextCursor,
        enabled: !!session, // Only run if user is authenticated
      }
    );

  const tickets = data?.pages.flatMap((page) => page.items) ?? [];

  const getStatusColor = (status: TicketStatus) => {
    switch (status) {
      case "OPEN":
        return "bg-red-50 text-red-700 border-red-200";
      case "IN_PROGRESS":
        return "bg-yellow-50 text-yellow-700 border-yellow-200";
      case "RESOLVED":
        return "bg-green-50 text-green-700 border-green-200";
      case "CLOSED":
        return "bg-gray-50 text-gray-700 border-gray-200";
      default:
        return "bg-gray-50 text-gray-700 border-gray-200";
    }
  };

  const getPriorityColor = (priority: Priority) => {
    switch (priority) {
      case "URGENT":
        return "bg-red-50 text-red-700 border-red-200";
      case "HIGH":
        return "bg-orange-50 text-orange-700 border-orange-200";
      case "MEDIUM":
        return "bg-yellow-50 text-yellow-700 border-yellow-200";
      case "LOW":
        return "bg-green-50 text-green-700 border-green-200";
      default:
        return "bg-gray-50 text-gray-700 border-gray-200";
    }
  };

  const getStatusIcon = (status: TicketStatus) => {
    switch (status) {
      case "OPEN":
        return <AlertCircleIcon className="w-4 h-4" />;
      case "IN_PROGRESS":
        return <ClockIcon className="w-4 h-4" />;
      case "RESOLVED":
        return <CheckCircleIcon className="w-4 h-4" />;
      case "CLOSED":
        return <XCircleIcon className="w-4 h-4" />;
      default:
        return <AlertCircleIcon className="w-4 h-4" />;
    }
  };

  if (isLoading) {
    return <TicketListSkeleton />;
  }

  return (
    <div className="space-y-6">
      {/* Enhanced Filters */}
      <Card className="bg-white/50 backdrop-blur-sm border-white/20">
        <CardContent className="p-4">
          <div className="flex flex-col space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <FilterIcon className="w-4 h-4" />
              <span>Filter Tickets</span>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <Select
                value={filters.status || "all"}
                onValueChange={(value) =>
                  setFilters((prev) => ({
                    ...prev,
                    status:
                      value === "all" ? undefined : (value as TicketStatus),
                  }))
                }
              >
                <SelectTrigger className="w-full sm:w-40 bg-white/70">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="OPEN">Open</SelectItem>
                  <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                  <SelectItem value="RESOLVED">Resolved</SelectItem>
                  <SelectItem value="CLOSED">Closed</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={filters.priority || "all"}
                onValueChange={(value) =>
                  setFilters((prev) => ({
                    ...prev,
                    priority: value === "all" ? undefined : (value as Priority),
                  }))
                }
              >
                <SelectTrigger className="w-full sm:w-40 bg-white/70">
                  <SelectValue placeholder="Priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priority</SelectItem>
                  <SelectItem value="LOW">Low</SelectItem>
                  <SelectItem value="MEDIUM">Medium</SelectItem>
                  <SelectItem value="HIGH">High</SelectItem>
                  <SelectItem value="URGENT">Urgent</SelectItem>
                </SelectContent>
              </Select>

              <Button
                variant="outline"
                className="bg-white/70 hover:bg-white/90"
                onClick={() =>
                  setFilters({
                    status: undefined,
                    priority: undefined,
                    assignedToId: undefined,
                  })
                }
              >
                Clear Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Ticket Count Summary */}
      {tickets.length > 0 && (
        <div className="flex items-center justify-between text-sm text-gray-600 px-1">
          <span>
            Showing {tickets.length} ticket{tickets.length !== 1 ? "s" : ""}
          </span>
          {hasNextPage && <span className="text-blue-600">More available</span>}
        </div>
      )}

      {/* Enhanced Ticket List */}
      <div className="space-y-4">
        {tickets.map((ticket) => (
          <Link
            key={ticket.id}
            href={`/tickets/${ticket.id}`}
            className="block"
          >
            <Card className="bg-white/70 backdrop-blur-sm border-white/20 hover:shadow-lg hover:bg-white/80 transition-all duration-300 cursor-pointer group">
              <CardContent className="p-0">
                <div className="p-4 sm:p-6">
                  {/* Header Section */}
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-blue-100 to-blue-200 rounded-lg flex items-center justify-center">
                          <span className="text-xs font-bold text-blue-700">
                            #{ticket.id.slice(-3)}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-lg font-semibold text-gray-900 truncate group-hover:text-blue-700 transition-colors">
                            {ticket.subject}
                          </h3>
                          <div className="flex items-center gap-2 mt-1 text-sm text-gray-600">
                            <UserIcon className="w-4 h-4 flex-shrink-0" />
                            <span className="truncate">
                              {ticket.fromName} ({ticket.fromEmail})
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Status and Priority Badges */}
                    <div className="flex flex-wrap gap-2 sm:flex-col sm:items-end">
                      <Badge
                        className={`${getStatusColor(
                          ticket.status
                        )} border flex items-center gap-1`}
                      >
                        {getStatusIcon(ticket.status)}
                        <span className="text-xs font-medium">
                          {ticket.status.replace("_", " ")}
                        </span>
                      </Badge>
                      <Badge
                        className={`${getPriorityColor(
                          ticket.priority
                        )} border`}
                      >
                        <span className="text-xs font-medium">
                          {ticket.priority}
                        </span>
                      </Badge>
                    </div>
                  </div>

                  {/* Content Preview */}
                  <div className="mb-4">
                    <p className="text-gray-700 text-sm leading-relaxed line-clamp-2 sm:line-clamp-3">
                      Click to view ticket details and messages
                    </p>
                  </div>

                  {/* Footer Section */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-3 border-t border-gray-100">
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <div className="flex items-center gap-1">
                        <CalendarIcon className="w-3 h-3" />
                        <span>
                          Created{" "}
                          {formatDistanceToNow(new Date(ticket.createdAt), {
                            addSuffix: true,
                          })}
                        </span>
                      </div>
                      {ticket.assignedToId && (
                        <div className="flex items-center gap-1">
                          <UserIcon className="w-3 h-3" />
                          <span>Assigned</span>
                        </div>
                      )}
                    </div>

                    <span className="w-full sm:w-auto text-gray-500 hover:text-gray-700 hover:bg-gray-100/50 flex items-center gap-2">
                      <MoreHorizontalIcon className="w-4 h-4 mr-2" />
                      View Details
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Enhanced Load More */}
      {hasNextPage && (
        <div className="text-center pt-4">
          <Button
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
            variant="outline"
            size="lg"
            className="bg-white/70 hover:bg-white/90 border-blue-200 text-blue-700 hover:border-blue-300"
          >
            {isFetchingNextPage ? (
              <>
                <RefreshCwIcon className="w-4 h-4 mr-2 animate-spin" />
                Loading...
              </>
            ) : (
              <>
                <MoreHorizontalIcon className="w-4 h-4 mr-2" />
                Load More Tickets
              </>
            )}
          </Button>
        </div>
      )}

      {/* Enhanced Empty State */}
      {tickets.length === 0 && (
        <Card className="bg-white/50 backdrop-blur-sm border-white/20">
          <CardContent className="p-12 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircleIcon className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No tickets found
            </h3>
            <p className="text-gray-500 mb-6">
              {Object.values(filters).some((f) => f !== undefined)
                ? "Try adjusting your filters to see more tickets."
                : "There are no tickets to display at the moment."}
            </p>
            {Object.values(filters).some((f) => f !== undefined) && (
              <Button
                variant="outline"
                onClick={() =>
                  setFilters({
                    status: undefined,
                    priority: undefined,
                    assignedToId: undefined,
                  })
                }
                className="bg-white/70 hover:bg-white/90"
              >
                Clear All Filters
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
