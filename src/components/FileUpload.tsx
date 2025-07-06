import React, { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Paperclip, X, Loader2 } from "lucide-react";

interface Attachment {
  id?: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
}

interface FileUploadProps {
  attachments: Attachment[];
  onAttachmentsChange: (attachments: Attachment[]) => void;
  maxFiles?: number;
  maxSize?: number; // in bytes
  compact?: boolean; // Show only upload button, not attachment list
}

export function FileUpload({
  attachments,
  onAttachmentsChange,
  maxFiles = 5,
  maxSize = 4 * 1024 * 1024, // 4MB default for Vercel
  compact = false,
}: FileUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const handleFileSelect = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setError(null);

    // Check if we're at the file limit
    if (attachments.length + files.length > maxFiles) {
      setError(`You can only upload up to ${maxFiles} files`);
      return;
    }

    setIsUploading(true);

    try {
      const newAttachments: Attachment[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];

        // Check file size
        if (file.size > maxSize) {
          setError(
            `${file.name} is too large. Maximum size is ${formatFileSize(
              maxSize
            )}`
          );
          continue;
        }

        const formData = new FormData();
        formData.append("file", file);

        const response = await fetch("/api/upload/attachment", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Upload failed");
        }

        const attachmentData = await response.json();
        newAttachments.push(attachmentData);
      }

      onAttachmentsChange([...attachments, ...newAttachments]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setIsUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const removeAttachment = (index: number) => {
    const newAttachments = attachments.filter((_, i) => i !== index);
    onAttachmentsChange(newAttachments);
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith("image/")) return "🖼️";
    if (mimeType.startsWith("video/")) return "🎥";
    if (mimeType.startsWith("audio/")) return "🎵";
    if (mimeType.includes("pdf")) return "📄";
    if (mimeType.includes("word") || mimeType.includes("document")) return "📝";
    if (mimeType.includes("excel") || mimeType.includes("spreadsheet"))
      return "📊";
    if (mimeType.includes("powerpoint") || mimeType.includes("presentation"))
      return "📈";
    if (mimeType.includes("zip") || mimeType.includes("archive")) return "📦";
    return "📎";
  };

  return (
    <div className="space-y-3">
      {/* File Input */}
      <div className="flex items-center space-x-2">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileSelect}
          className="hidden"
          accept="*/*"
          disabled={isUploading || attachments.length >= maxFiles}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading || attachments.length >= maxFiles}
          className="flex items-center space-x-2"
        >
          {isUploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Paperclip className="h-4 w-4" />
          )}
          <span>
            {isUploading
              ? "Uploading..."
              : `Add Files (${attachments.length}/${maxFiles})`}
          </span>
        </Button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="text-sm text-red-600 bg-red-50 p-2 rounded-md">
          {error}
        </div>
      )}

      {/* Attachments List - Only show if not in compact mode */}
      {!compact && attachments.length > 0 && (
        <div className="space-y-2">
          <div className="text-sm font-medium text-gray-700">
            Attachments ({attachments.length}):
          </div>
          <div className="space-y-2">
            {attachments.map((attachment, index) => (
              <div
                key={attachment.id || attachment.filename}
                className="flex items-center justify-between p-3 border border-gray-200 rounded-md bg-gray-50"
              >
                <div className="flex items-center space-x-3">
                  <span className="text-lg">
                    {getFileIcon(attachment.mimeType)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-gray-900 truncate">
                      {attachment.originalName}
                    </div>
                    <div className="text-xs text-gray-500">
                      {formatFileSize(attachment.size)} • {attachment.mimeType}
                    </div>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeAttachment(index)}
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
  );
}
