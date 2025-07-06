"use client";

import { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import { trpc } from "@/app/_trpc/client";
import { Button } from "@/components/ui/button";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { EmailThread } from "@/components/EmailThread";
import { TicketDetailSkeleton } from "@/components/TicketDetailSkeleton";
import { FileUpload } from "@/components/FileUpload";
import { formatDistanceToNow } from "date-fns";
import { useSession } from "next-auth/react";
import { Send, AlertCircle, X } from "lucide-react";
import { TicketStatus, Priority } from "@prisma/client";
import { toast } from "sonner";

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
  const [attachments, setAttachments] = useState<
    Array<{
      id?: string;
      filename: string;
      originalName: string;
      mimeType: string;
      size: number;
      url: string;
    }>
  >([]);
  const replyFormRef = useRef<HTMLDivElement>(null);

  // Scroll to reply form when it becomes visible
  useEffect(() => {
    if (showReplyForm && replyFormRef.current) {
      replyFormRef.current.scrollIntoView({
        behavior: "smooth",
        block: "end",
      });
    }
  }, [showReplyForm]);

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
    onSuccess: () => {
      refetch();
      toast.success("Ticket assigned successfully!");
    },
    onError: (error) => {
      console.error("Assignment failed:", error);
      toast.error("Failed to assign ticket. Please try again.", {
        description: error.message || "An unexpected error occurred.",
      });
    },
  });

  const updateStatusMutation = trpc.ticket.updateStatus.useMutation({
    onSuccess: () => {
      refetch();
      toast.success("Ticket status updated successfully!");
    },
    onError: (error) => {
      console.error("Status update failed:", error);
      toast.error("Failed to update ticket status. Please try again.", {
        description: error.message || "An unexpected error occurred.",
      });
    },
  });

  const updatePriorityMutation = trpc.ticket.updatePriority.useMutation({
    onSuccess: () => {
      refetch();
      toast.success("Ticket priority updated successfully!");
    },
    onError: (error) => {
      console.error("Priority update failed:", error);
      toast.error("Failed to update ticket priority. Please try again.", {
        description: error.message || "An unexpected error occurred.",
      });
    },
  });

  const replyMutation = trpc.ticket.reply.useMutation({
    onSuccess: () => {
      setReplyContent("");
      setAttachments([]);
      setShowReplyForm(false);
      refetch();
      toast.success("Reply sent successfully!");
    },
    onError: (error) => {
      console.error("Reply failed:", error);

      // Check if it's an email configuration error
      if (
        error.message?.includes("email configuration") ||
        error.message?.includes("SMTP")
      ) {
        toast.error(
          "Failed to send reply due to email configuration issues. Please check your email settings.",
          {
            description:
              "Contact your administrator to verify SMTP/AWS SES configuration.",
            duration: 8000,
          }
        );
      } else {
        toast.error("Failed to send reply. Please try again.", {
          description: error.message || "An unexpected error occurred.",
          duration: 5000,
        });
      }
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
      attachments: attachments.length > 0 ? attachments : undefined,
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
        <div ref={replyFormRef} className="bg-white rounded-lg shadow p-6">
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
              {/* Reply Attachments */}
              {attachments.length > 0 && (
                <div className="p-2">
                  <h3 className="text-lg font-semibold mb-4">
                    Reply Attachments
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {attachments.map((attachment, index) => (
                      <div
                        key={attachment.id || attachment.filename}
                        className="flex items-center justify-between p-3 border border-gray-200 rounded-md bg-gray-50"
                      >
                        <div className="flex items-center space-x-3">
                          <span className="text-lg">
                            {attachment.mimeType.startsWith("image/")
                              ? "🖼️"
                              : attachment.mimeType.includes("pdf")
                              ? "📄"
                              : attachment.mimeType.includes("word")
                              ? "📝"
                              : attachment.mimeType.includes("excel")
                              ? "📊"
                              : attachment.mimeType.includes("powerpoint")
                              ? "📈"
                              : attachment.mimeType.includes("zip")
                              ? "📦"
                              : "📎"}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium text-gray-900 truncate">
                              {attachment.originalName}
                            </div>
                            <div className="text-xs text-gray-500">
                              {formatFileSize(attachment.size)} •{" "}
                              {attachment.mimeType}
                            </div>
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            const newAttachments = attachments.filter(
                              (_, i) => i !== index
                            );
                            setAttachments(newAttachments);
                          }}
                          className="text-gray-400 hover:text-red-600"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <RichTextEditor
              content={replyContent}
              onChange={setReplyContent}
              placeholder="Type your reply..."
              className="min-h-[300px]"
            />

            <div className="flex items-center justify-between">
              <FileUpload
                attachments={attachments}
                onAttachmentsChange={setAttachments}
                maxFiles={5}
                maxSize={4 * 1024 * 1024} // 4MB for Vercel
                compact={true}
              />
              <div className="flex items-center space-x-3">
                {!canReply && (
                  <div className="flex items-center space-x-1 text-sm text-amber-600">
                    <AlertCircle className="h-4 w-4" />
                    <span>You need to be assigned to reply</span>
                  </div>
                )}
              </div>
              <Button
                onClick={handleReply}
                disabled={
                  !replyContent.trim() || replyMutation.isPending || !canReply
                }
                className="flex items-center space-x-2 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg"
              >
                <Send className="h-4 w-4" />
                <span>
                  {replyMutation.isPending ? "Sending..." : "Send Reply"}
                </span>
              </Button>
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
                href={`/api/attachments/${attachment.id}`}
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
