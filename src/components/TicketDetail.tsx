"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { trpc } from "@/app/_trpc/client";
import { Button } from "@/components/ui/button";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { EmailThread } from "@/components/EmailThread";
import { TicketDetailSkeleton } from "@/components/TicketDetailSkeleton";
import { formatDistanceToNow } from "date-fns";
import { useSession } from "next-auth/react";
import { Send, Paperclip, AlertCircle } from "lucide-react";
import { TicketStatus, Priority } from "@prisma/client";

const priorityColors = {
  LOW: "bg-green-100 text-green-800",
  MEDIUM: "bg-yellow-100 text-yellow-800",
  HIGH: "bg-orange-100 text-orange-800",
  URGENT: "bg-red-100 text-red-800",
};

const statusColors = {
  OPEN: "bg-blue-100 text-blue-800",
  IN_PROGRESS: "bg-purple-100 text-purple-800",
  RESOLVED: "bg-green-100 text-green-800",
  CLOSED: "bg-gray-100 text-gray-800",
};

export function TicketDetail() {
  const { data: session, status: sessionStatus } = useSession();
  const params = useParams();
  const ticketId = params?.id as string;
  const [replyContent, setReplyContent] = useState("");
  const [showReplyForm, setShowReplyForm] = useState(false);

  const {
    data: ticket,
    isLoading,
    refetch,
  } = trpc.ticket.getById.useQuery(
    {
      id: ticketId,
    },
    {
      enabled: !!session,
    }
  );

  const { data: users } = trpc.user.getAll.useQuery(undefined, {
    enabled: !!session,
  });
  const { data: currentUser } = trpc.user.getCurrent.useQuery(undefined, {
    enabled: !!session,
  });

  const assignMutation = trpc.ticket.assign.useMutation({
    onSuccess: () => refetch(),
  });

  const updateStatusMutation = trpc.ticket.updateStatus.useMutation({
    onSuccess: () => refetch(),
  });

  const updatePriorityMutation = trpc.ticket.updatePriority.useMutation({
    onSuccess: () => refetch(),
  });

  const replyMutation = trpc.ticket.reply.useMutation({
    onSuccess: () => {
      setReplyContent("");
      setShowReplyForm(false);
      refetch();
    },
  });

  // Show loading state while session is loading
  if (sessionStatus === "loading") {
    return <TicketDetailSkeleton />;
  }

  // Don't show anything if not authenticated
  if (sessionStatus === "unauthenticated") {
    return (
      <div className="text-center py-8 text-gray-500">
        Please sign in to view tickets.
      </div>
    );
  }

  if (isLoading) {
    return <TicketDetailSkeleton />;
  }

  if (!ticket) {
    return (
      <div className="text-center py-8 text-gray-500">Ticket not found.</div>
    );
  }

  const handleReply = () => {
    if (!replyContent.trim()) return;

    replyMutation.mutate({
      ticketId: ticket.id,
      content: replyContent,
    });
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const isAdmin = currentUser?.role === "ADMIN";
  const canAssign = isAdmin;
  const canUpdatePriority = isAdmin;
  const canUpdateStatus = isAdmin || ticket.assignedToId === currentUser?.id;
  const canReply = isAdmin || ticket.assignedToId === currentUser?.id;

  return (
    <div className="space-y-6">
      {/* Ticket Header */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-900">
              {ticket.subject}
            </h1>
            <p className="text-gray-600 mt-2">
              From: {ticket.fromName || ticket.fromEmail}
            </p>
            {ticket.client && (
              <div className="flex items-center gap-2 mt-1">
                <p className="text-gray-600">
                  Client: {ticket.client.companyName || ticket.client.name}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 px-2 text-xs"
                  onClick={() => {
                    window.location.href = `/clients?view=${ticket.client?.id}`;
                  }}
                >
                  View Client
                </Button>
              </div>
            )}
            <p className="text-gray-600">
              Created:{" "}
              {formatDistanceToNow(new Date(ticket.createdAt), {
                addSuffix: true,
              })}
            </p>
            {ticket.lastReplied && (
              <p className="text-gray-600">
                Last replied:{" "}
                {formatDistanceToNow(new Date(ticket.lastReplied), {
                  addSuffix: true,
                })}
              </p>
            )}
          </div>
          <div className="flex flex-col items-end space-y-2">
            <div className="flex gap-2">
              <span
                className={`px-3 py-1 text-sm font-medium rounded-full ${
                  priorityColors[ticket.priority]
                }`}
              >
                {ticket.priority}
              </span>
              <span
                className={`px-3 py-1 text-sm font-medium rounded-full ${
                  statusColors[ticket.status]
                }`}
              >
                {ticket.status.replace("_", " ")}
              </span>
            </div>
            {ticket.assignedTo && (
              <p className="text-sm text-gray-600">
                Assigned to: {ticket.assignedTo.name}
              </p>
            )}
          </div>
        </div>

        {/* Ticket Actions */}
        <div className="flex gap-4 mt-6 pt-6 border-t">
          {canAssign && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Assign to:
              </label>
              <select
                className="px-3 py-2 border border-gray-300 rounded-md"
                value={ticket.assignedToId || ""}
                onChange={(e) =>
                  assignMutation.mutate({
                    ticketId: ticket.id,
                    userId: e.target.value,
                  })
                }
              >
                <option value="">Unassigned</option>
                {users?.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {canUpdateStatus && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status:
              </label>
              <select
                className="px-3 py-2 border border-gray-300 rounded-md"
                value={ticket.status}
                onChange={(e) =>
                  updateStatusMutation.mutate({
                    ticketId: ticket.id,
                    status: e.target.value as TicketStatus,
                  })
                }
              >
                <option value="OPEN">Open</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="RESOLVED">Resolved</option>
                <option value="CLOSED">Closed</option>
              </select>
            </div>
          )}

          {canUpdatePriority && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Priority:
              </label>
              <select
                className="px-3 py-2 border border-gray-300 rounded-md"
                value={ticket.priority}
                onChange={(e) =>
                  updatePriorityMutation.mutate({
                    ticketId: ticket.id,
                    priority: e.target.value as Priority,
                  })
                }
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Email Thread */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Email Thread</h2>
            {canReply && (
              <Button
                onClick={() => setShowReplyForm(!showReplyForm)}
                className="flex items-center space-x-2"
              >
                <Send className="h-4 w-4" />
                <span>Reply</span>
              </Button>
            )}
          </div>
        </div>
        <div className="p-6">
          <EmailThread
            messages={ticket.messages.map((m) => ({
              ...m,
              createdAt: new Date(m.createdAt),
              attachments: m.attachments.map((a) => ({
                ...a,
                createdAt: new Date(a.createdAt),
              })),
            }))}
            ticketFromEmail={ticket.fromEmail}
            ticketFromName={ticket.fromName}
          />
        </div>
      </div>

      {/* Reply Form */}
      {showReplyForm && canReply && (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Send Reply</h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowReplyForm(false)}
            >
              Cancel
            </Button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                To: {ticket.fromName || ticket.fromEmail}
              </label>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Subject: Re: {ticket.subject}
              </label>
            </div>

            <RichTextEditor
              content={replyContent}
              onChange={setReplyContent}
              placeholder="Type your reply..."
              className="min-h-[300px]"
            />

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-sm text-gray-500">
                <Paperclip className="h-4 w-4" />
                <span>Attachments not supported in this version</span>
              </div>

              <div className="flex items-center space-x-3">
                {!canReply && (
                  <div className="flex items-center space-x-1 text-sm text-amber-600">
                    <AlertCircle className="h-4 w-4" />
                    <span>You need to be assigned to reply</span>
                  </div>
                )}
                <Button
                  onClick={handleReply}
                  disabled={
                    !replyContent.trim() || replyMutation.isPending || !canReply
                  }
                  className="flex items-center space-x-2"
                >
                  <Send className="h-4 w-4" />
                  <span>
                    {replyMutation.isPending ? "Sending..." : "Send Reply"}
                  </span>
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Ticket Attachments */}
      {ticket.attachments && ticket.attachments.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Ticket Attachments</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {ticket.attachments.map((attachment) => (
              <a
                key={attachment.id}
                href={attachment.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block p-3 border rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="font-medium text-blue-600">
                  {attachment.originalName}
                </div>
                <div className="text-sm text-gray-500">
                  {formatFileSize(attachment.size)} • {attachment.mimeType}
                </div>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
