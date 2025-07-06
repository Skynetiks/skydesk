"use client";

import { formatDistanceToNow } from "date-fns";
import { Message, Attachment } from "@prisma/client";
import { Reply, User as UserIcon, Mail } from "lucide-react";

interface MessageWithUser extends Message {
  user?: {
    id: string;
    name: string;
    email: string;
  } | null;
  attachments: Attachment[];
}

interface EmailThreadProps {
  messages: MessageWithUser[];
  ticketFromEmail: string;
  ticketFromName?: string | null;
}

export function EmailThread({
  messages,
  ticketFromEmail,
  ticketFromName,
}: EmailThreadProps) {
  // Group messages by thread (using messageId and references)
  const groupMessagesByThread = (messages: MessageWithUser[]) => {
    const threads: { [key: string]: MessageWithUser[] } = {};

    messages.forEach((message) => {
      // Use messageId as thread key, fallback to inReplyTo, then references
      const threadKey =
        message.messageId ||
        message.inReplyTo ||
        message.references ||
        message.id;

      if (!threads[threadKey]) {
        threads[threadKey] = [];
      }
      threads[threadKey].push(message);
    });

    // Sort messages within each thread by creation date
    Object.keys(threads).forEach((key) => {
      threads[key].sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
    });

    return threads;
  };

  const threads = groupMessagesByThread(messages);
  const threadKeys = Object.keys(threads).sort((a, b) => {
    const aLatest = Math.max(
      ...threads[a].map((m) => new Date(m.createdAt).getTime())
    );
    const bLatest = Math.max(
      ...threads[b].map((m) => new Date(m.createdAt).getTime())
    );
    return aLatest - bLatest;
  });

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const isReply = (message: MessageWithUser) => {
    return message.inReplyTo || message.references;
  };

  const renderMessageContent = (content: string) => {
    // Convert plain text to HTML with line breaks
    const htmlContent = content
      .replace(/\n/g, "<br>")
      .replace(/\s{2}/g, "&nbsp;&nbsp;");

    return (
      <div
        className="prose prose-sm max-w-none"
        dangerouslySetInnerHTML={{ __html: htmlContent }}
      />
    );
  };

  return (
    <div className="space-y-6">
      {threadKeys.map((threadKey, threadIndex) => (
        <div key={threadKey} className="bg-white rounded-lg shadow-sm border">
          <div className="p-4 border-b bg-gray-50">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="flex items-center space-x-1">
                  {isReply(threads[threadKey][0]) && (
                    <Reply className="h-4 w-4 text-gray-500" />
                  )}
                  <span className="text-sm font-medium text-gray-700">
                    Thread {threadIndex + 1}
                  </span>
                </div>
                {threads[threadKey].length > 1 && (
                  <span className="text-xs text-gray-500">
                    ({threads[threadKey].length} messages)
                  </span>
                )}
              </div>
              <div className="text-xs text-gray-500">
                {formatDistanceToNow(
                  new Date(
                    threads[threadKey][threads[threadKey].length - 1].createdAt
                  ),
                  {
                    addSuffix: true,
                  }
                )}
              </div>
            </div>
          </div>

          <div className="divide-y divide-gray-100">
            {threads[threadKey].map((message, messageIndex) => (
              <div key={message.id} className="p-4">
                <div className="flex items-start space-x-3">
                  {/* Avatar */}
                  <div className="flex-shrink-0">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        message.isFromUser
                          ? "bg-blue-100 text-blue-600"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {message.isFromUser ? (
                        <Mail className="h-4 w-4" />
                      ) : (
                        <UserIcon className="h-4 w-4" />
                      )}
                    </div>
                  </div>

                  {/* Message Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-medium text-gray-900">
                          {message.isFromUser
                            ? ticketFromName || ticketFromEmail
                            : message.user?.name || "Agent"}
                        </span>
                        <span className="text-xs text-gray-500">
                          {message.isFromUser
                            ? ticketFromEmail
                            : message.user?.email}
                        </span>
                        {isReply(message) && messageIndex > 0 && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                            <Reply className="h-3 w-3 mr-1" />
                            Reply
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500">
                        {formatDistanceToNow(new Date(message.createdAt), {
                          addSuffix: true,
                        })}
                      </div>
                    </div>

                    {/* Message Body */}
                    <div className="text-sm text-gray-700 mb-3">
                      {renderMessageContent(message.content)}
                    </div>

                    {/* Attachments */}
                    {message.attachments && message.attachments.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-gray-100">
                        <div className="text-xs font-medium text-gray-700 mb-2">
                          Attachments ({message.attachments.length}):
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {message.attachments.map((attachment) => (
                            <a
                              key={attachment.id}
                              href={`/api/attachments/${attachment.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center p-2 border border-gray-200 rounded-md hover:bg-gray-50 transition-colors"
                            >
                              <div className="flex-shrink-0 mr-2">
                                <div className="w-6 h-6 bg-gray-100 rounded flex items-center justify-center">
                                  <span className="text-xs text-gray-600">
                                    📎
                                  </span>
                                </div>
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="text-sm font-medium text-gray-900 truncate">
                                  {attachment.originalName}
                                </div>
                                <div className="text-xs text-gray-500">
                                  {formatFileSize(attachment.size)} •{" "}
                                  {attachment.mimeType}
                                </div>
                              </div>
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
