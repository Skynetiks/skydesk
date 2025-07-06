"use client";

import { useState } from "react";
import { trpc } from "@/app/_trpc/client";
import { Button } from "@/components/ui/button";
import { useSession } from "next-auth/react";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  SettingsIcon,
  EditIcon,
  SaveIcon,
  XIcon,
  RefreshCwIcon,
  MailIcon,
  ServerIcon,
  ShieldIcon,
  TestTubeIcon,
  CheckCircleIcon,
  AlertCircleIcon,
  SendIcon,
  UploadIcon,
} from "lucide-react";
import Image from "next/image";

interface ConfigItem {
  key: string;
  value: string;
  description: string;
  required: boolean;
  type: "text" | "password" | "number" | "boolean" | "file" | "select";
}

const IMAP_CONFIGS: ConfigItem[] = [
  {
    key: "IMAP_HOST",
    value: "",
    description: "IMAP server hostname (e.g., imap.gmail.com)",
    required: true,
    type: "text",
  },
  {
    key: "IMAP_PORT",
    value: "993",
    description: "IMAP server port (usually 993 for SSL, 143 for non-SSL)",
    required: true,
    type: "number",
  },
  {
    key: "IMAP_USER",
    value: "",
    description: "Email address or username for IMAP authentication",
    required: true,
    type: "text",
  },
  {
    key: "IMAP_PASS",
    value: "",
    description: "Password or app password for IMAP authentication",
    required: true,
    type: "password",
  },
  {
    key: "IMAP_SECURE",
    value: "true",
    description: "Use SSL/TLS connection (true/false)",
    required: true,
    type: "boolean",
  },
  {
    key: "INITIAL_EMAIL_LIMIT",
    value: "10",
    description: "Number of emails to process on first setup",
    required: false,
    type: "number",
  },
];

const SMTP_CONFIGS: ConfigItem[] = [
  {
    key: "EMAIL_PROVIDER",
    value: "smtp",
    description: "Choose between SMTP or AWS SES for sending emails",
    required: true,
    type: "select",
  },
  {
    key: "EMAIL_HOST",
    value: "",
    description: "SMTP server hostname (e.g., smtp.gmail.com)",
    required: true,
    type: "text",
  },
  {
    key: "EMAIL_PORT",
    value: "587",
    description: "SMTP server port (usually 587 for TLS, 465 for SSL)",
    required: true,
    type: "number",
  },
  {
    key: "EMAIL_USER",
    value: "",
    description: "Email address or username for SMTP authentication",
    required: true,
    type: "text",
  },
  {
    key: "EMAIL_PASS",
    value: "",
    description: "Password or app password for SMTP authentication",
    required: true,
    type: "password",
  },
  {
    key: "SENDER_EMAIL",
    value: "",
    description:
      "From email address for sending notifications (falls back to EMAIL_USER if not set)",
    required: false,
    type: "text",
  },
];

const AWS_CONFIGS: ConfigItem[] = [
  {
    key: "EMAIL_PROVIDER",
    value: "aws",
    description: "Choose between SMTP or AWS SES for sending emails",
    required: true,
    type: "select",
  },
  {
    key: "AWS_REGION",
    value: "",
    description: "AWS region (e.g., us-east-1, eu-west-1)",
    required: true,
    type: "text",
  },
  {
    key: "AWS_SES_SMTP_USERNAME",
    value: "",
    description: "AWS SES SMTP Username (from AWS Console)",
    required: true,
    type: "text",
  },
  {
    key: "AWS_SES_SMTP_PASSWORD",
    value: "",
    description: "AWS SES SMTP Password (from AWS Console)",
    required: true,
    type: "password",
  },
  {
    key: "AWS_SES_SENDER_EMAIL",
    value: "",
    description:
      "From email address for sending notifications (must be verified in SES)",
    required: true,
    type: "text",
  },
];

const TICKET_CONFIGS: ConfigItem[] = [
  {
    key: "CLIENT_ONLY_TICKETS",
    value: "false",
    description:
      "Only allow emails from registered clients to create tickets (true/false)",
    required: false,
    type: "boolean",
  },
];

const COMPANY_CONFIGS: ConfigItem[] = [
  {
    key: "COMPANY_NAME",
    value: "",
    description: "Your company name (used in email templates)",
    required: true,
    type: "text",
  },
  {
    key: "COMPANY_LOGO",
    value: "",
    description:
      "Company logo URL (upload an image to get the URL). Recommended: 200x200 to 500x500 pixels, square aspect ratio.",
    required: false,
    type: "file",
  },
  {
    key: "COMPANY_WEBSITE",
    value: "",
    description: "Your company website URL",
    required: false,
    type: "text",
  },
  {
    key: "COMPANY_ADDRESS",
    value: "",
    description: "Your company address (used in email footers)",
    required: false,
    type: "text",
  },
  {
    key: "COMPANY_PHONE",
    value: "",
    description: "Your company phone number",
    required: false,
    type: "text",
  },
  {
    key: "COMPANY_EMAIL",
    value: "",
    description: "Your company support email",
    required: false,
    type: "text",
  },
];

export function ConfigurationPanel() {
  const { data: session, status: sessionStatus } = useSession();

  // State management
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [imapTestStatus, setImapTestStatus] = useState<
    "idle" | "testing" | "success" | "error"
  >("idle");
  const [smtpTestStatus, setSmtpTestStatus] = useState<
    "idle" | "testing" | "success" | "error"
  >("idle");
  const [testMessage, setTestMessage] = useState("");
  const [uploadingFile, setUploadingFile] = useState(false);

  // Show loading state while session is loading
  if (sessionStatus === "loading") {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex items-center gap-3 text-gray-500">
          <RefreshCwIcon className="w-6 h-6 animate-spin" />
          <span className="text-lg">Loading session...</span>
        </div>
      </div>
    );
  }

  // Don't show anything if not authenticated
  if (sessionStatus === "unauthenticated") {
    return (
      <div className="text-center py-8 text-gray-500">
        Please sign in to access configuration settings.
      </div>
    );
  }

  // Only show for admin users
  if (session?.user?.role !== "ADMIN") {
    return (
      <div className="text-center py-8">
        <div className="flex items-center justify-center mb-4">
          <ShieldIcon className="w-12 h-12 text-gray-400" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Access Restricted
        </h3>
        <p className="text-gray-500">
          Admin privileges required to manage email configuration.
        </p>
      </div>
    );
  }

  const {
    data: configs,
    refetch,
    isLoading,
  } = trpc.config.getAll.useQuery(undefined, {
    enabled: !!session,
  });

  const upsertMutation = trpc.config.upsert.useMutation({
    onSuccess: () => {
      refetch();
      setEditingKey(null);
      setEditValue("");
    },
  });

  const testImapMutation = trpc.config.testImap.useMutation({
    onSuccess: () => {
      setImapTestStatus("success");
      setTestMessage("IMAP connection test successful!");
    },
    onError: (error: { message?: string }) => {
      setImapTestStatus("error");
      setTestMessage(error.message || "IMAP connection test failed");
    },
  });

  const testSmtpMutation = trpc.config.testSmtp.useMutation({
    onSuccess: () => {
      setSmtpTestStatus("success");
      setTestMessage("SMTP connection test successful!");
    },
    onError: (error: { message?: string }) => {
      setSmtpTestStatus("error");
      setTestMessage(error.message || "SMTP connection test failed");
    },
  });

  const handleEdit = (config: { key: string; value: string }) => {
    setEditingKey(config.key);
    setEditValue(config.value);
  };

  const handleSave = () => {
    if (!editingKey || !editValue.trim()) return;
    upsertMutation.mutate({
      key: editingKey,
      value: editValue,
    });
  };

  const handleTestImapConnection = async () => {
    setImapTestStatus("testing");
    setTestMessage("");
    testImapMutation.mutate();
  };

  const handleTestSmtpConnection = async () => {
    setSmtpTestStatus("testing");
    try {
      await testSmtpMutation.mutateAsync();
      setSmtpTestStatus("success");
      setTestMessage("SMTP connection test successful!");
    } catch (error) {
      setSmtpTestStatus("error");
      setTestMessage(
        error instanceof Error ? error.message : "SMTP test failed"
      );
    }
  };

  const handleFileUpload = async (file: File) => {
    setUploadingFile(true);
    setTestMessage("");
    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Upload failed");
      }

      setEditValue(data.url);
      setTestMessage(
        `Logo uploaded successfully! Dimensions: ${data.dimensions.width}x${data.dimensions.height} (ratio: ${data.dimensions.aspectRatio})`
      );

      // Show success toast
      toast.success("Logo uploaded successfully!");
    } catch (error) {
      console.error("File upload failed:", error);
      const errorMessage =
        error instanceof Error
          ? error.message
          : "File upload failed. Please try again.";
      setTestMessage(errorMessage);

      // Show error toast
      toast.error(errorMessage);
    } finally {
      setUploadingFile(false);
    }
  };

  const getConfigValue = (key: string): string => {
    const config = configs?.find((c) => c.key === key);
    return config?.value || "";
  };

  const getConfigIcon = (key: string) => {
    if (key.includes("HOST") || key.includes("PORT"))
      return <ServerIcon className="w-4 h-4" />;
    if (key.includes("USER") || key.includes("PASS"))
      return <MailIcon className="w-4 h-4" />;
    if (key.includes("SECURE")) return <ShieldIcon className="w-4 h-4" />;
    if (key.includes("SENDER_EMAIL")) return <SendIcon className="w-4 h-4" />;
    return <SettingsIcon className="w-4 h-4" />;
  };

  const getConfigCategory = (key: string) => {
    if (key.includes("HOST") || key.includes("PORT")) return "Server";
    if (key.includes("USER") || key.includes("PASS")) return "Authentication";
    if (key.includes("SECURE")) return "Security";
    if (key.includes("LIMIT")) return "Processing";
    if (key.includes("SENDER_EMAIL")) return "Notifications";
    if (key.includes("CLIENT_ONLY_TICKETS")) return "Ticket";
    return "General";
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case "Server":
        return "bg-blue-50 text-blue-700 border-blue-200";
      case "Authentication":
        return "bg-green-50 text-green-700 border-green-200";
      case "Security":
        return "bg-purple-50 text-purple-700 border-purple-200";
      case "Processing":
        return "bg-orange-50 text-orange-700 border-orange-200";
      case "Notifications":
        return "bg-pink-50 text-pink-700 border-pink-200";
      case "Ticket":
        return "bg-indigo-50 text-indigo-700 border-indigo-200";
      default:
        return "bg-gray-50 text-gray-700 border-gray-200";
    }
  };

  const renderConfigSection = (
    title: string,
    description: string,
    configs: ConfigItem[],
    testFunction: () => void,
    testStatus: "idle" | "testing" | "success" | "error",
    testMutation: { isPending: boolean },
    showTestButton: boolean = false
  ) => (
    <Card className="bg-white/50 backdrop-blur-sm border-white/20 shadow-lg">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <SettingsIcon className="w-4 h-4 text-gray-600" />
          {title}
        </CardTitle>
        <CardDescription className="text-sm">{description}</CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        {/* Test Connection Button - Only show for sections that have actual test functions */}
        {showTestButton && (
          <div className="mb-4">
            <div className="flex items-center gap-3">
              <Button
                onClick={testFunction}
                disabled={testMutation.isPending || isLoading}
                size="sm"
                className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg"
              >
                {testMutation.isPending ? (
                  <>
                    <RefreshCwIcon className="w-3 h-3 mr-1 animate-spin" />
                    Testing...
                  </>
                ) : (
                  <>
                    <TestTubeIcon className="w-3 h-3 mr-1" />
                    Test Connection
                  </>
                )}
              </Button>

              {testStatus !== "idle" && (
                <div className="flex items-center gap-2">
                  {testStatus === "success" && (
                    <CheckCircleIcon className="w-4 h-4 text-green-600" />
                  )}
                  {testStatus === "error" && (
                    <AlertCircleIcon className="w-4 h-4 text-red-600" />
                  )}
                  <span
                    className={`text-xs ${
                      testStatus === "success"
                        ? "text-green-600"
                        : testStatus === "error"
                        ? "text-red-600"
                        : "text-gray-600"
                    }`}
                  >
                    {testMessage}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Configuration Items */}
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="flex items-center gap-2 text-gray-500">
              <RefreshCwIcon className="w-4 h-4 animate-spin" />
              <span className="text-sm">Loading configurations...</span>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {configs
              .filter((config) => {
                // Show all fields if no provider is selected
                const provider = getConfigValue("EMAIL_PROVIDER");
                if (!provider || provider === "smtp") return true;

                // For AWS provider, hide SMTP-specific fields and show AWS fields
                if (provider === "aws") {
                  if (config.key === "EMAIL_PROVIDER") return true; // Always show provider dropdown
                  if (config.key.startsWith("AWS_")) return true; // Show AWS fields
                  if (
                    config.key.startsWith("EMAIL_") &&
                    config.key !== "EMAIL_PROVIDER"
                  )
                    return false; // Hide SMTP fields
                }

                return true;
              })
              .map((config) => {
                const currentValue = getConfigValue(config.key);
                const category = getConfigCategory(config.key);
                const categoryColor = getCategoryColor(category);
                const isEditing = editingKey === config.key;

                return (
                  <div
                    key={config.key}
                    className="flex flex-col p-3 bg-white/70 border-white/30 rounded-lg"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <div className="p-1.5 bg-gray-100 rounded-md">
                        {getConfigIcon(config.key)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-gray-900 text-sm font-mono">
                            {config.key}
                          </span>
                          <Badge
                            variant="outline"
                            className={`text-xs ${categoryColor}`}
                          >
                            {category}
                          </Badge>
                          {config.required && (
                            <Badge variant="destructive" className="text-xs">
                              Required
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-gray-600">
                          {config.description}
                        </div>
                      </div>
                    </div>

                    <div className="flex-1">
                      {isEditing ? (
                        <div className="space-y-2">
                          {config.type === "boolean" ? (
                            <div className="flex items-center gap-2">
                              <Checkbox
                                checked={editValue === "true"}
                                onCheckedChange={(checked) =>
                                  setEditValue(checked ? "true" : "false")
                                }
                              />
                              <span className="text-sm text-gray-700">
                                {editValue === "true" ? "Enabled" : "Disabled"}
                              </span>
                            </div>
                          ) : config.type === "select" ? (
                            <div className="flex items-center gap-2">
                              <select
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                className="w-full bg-white/70 border border-gray-300 rounded px-3 py-2 text-sm focus:border-blue-300 focus:ring-blue-200"
                              >
                                <option value="smtp">SMTP</option>
                                <option value="aws">AWS SES</option>
                              </select>
                            </div>
                          ) : config.type === "file" ? (
                            <div className="space-y-2">
                              <Input
                                type="text"
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                className="w-full bg-white/70 border-white/30 focus:border-blue-300 focus:ring-blue-200 text-sm"
                                placeholder="Logo URL or upload a file"
                              />
                              <div className="flex items-center gap-2">
                                <input
                                  ref={(input) => {
                                    if (input) {
                                      input.style.display = "none";
                                    }
                                  }}
                                  type="file"
                                  accept="image/*"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                      handleFileUpload(file);
                                    }
                                  }}
                                  id={`file-upload-${config.key}`}
                                />
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  disabled={uploadingFile}
                                  className="w-full border-gray-300 hover:bg-gray-50"
                                  onClick={() => {
                                    const fileInput = document.getElementById(
                                      `file-upload-${config.key}`
                                    ) as HTMLInputElement;
                                    if (fileInput) {
                                      fileInput.click();
                                    }
                                  }}
                                >
                                  {uploadingFile ? (
                                    <RefreshCwIcon className="w-3 h-3 animate-spin mr-1" />
                                  ) : (
                                    <UploadIcon className="w-3 h-3 mr-1" />
                                  )}
                                  {uploadingFile
                                    ? "Uploading..."
                                    : "Upload Logo"}
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <Input
                              type={
                                config.type === "password" ? "password" : "text"
                              }
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              className="w-full bg-white/70 border-white/30 focus:border-blue-300 focus:ring-blue-200 text-sm"
                              placeholder={`Enter ${config.key.toLowerCase()}`}
                            />
                          )}
                          <div className="flex gap-2">
                            <Button
                              onClick={handleSave}
                              disabled={upsertMutation.isPending}
                              size="sm"
                              className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white"
                            >
                              {upsertMutation.isPending ? (
                                <RefreshCwIcon className="w-3 h-3 animate-spin" />
                              ) : (
                                <SaveIcon className="w-3 h-3" />
                              )}
                            </Button>
                            <Button
                              variant="outline"
                              onClick={() => setEditingKey(null)}
                              size="sm"
                              className="border-gray-300 hover:bg-gray-50"
                            >
                              <XIcon className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <div className="text-xs text-gray-800 font-mono break-all bg-gray-50 rounded px-2 py-1 border border-gray-200">
                            {config.type === "boolean" ? (
                              <div className="flex items-center gap-2">
                                <Checkbox
                                  checked={currentValue === "true"}
                                  disabled
                                />
                                <span>
                                  {currentValue === "true"
                                    ? "Enabled"
                                    : "Disabled"}
                                </span>
                              </div>
                            ) : config.type === "select" ? (
                              <div className="flex items-center gap-2">
                                <span className="capitalize font-semibold">
                                  {currentValue === "aws" ? "AWS SES" : "SMTP"}
                                </span>
                              </div>
                            ) : config.type === "file" && currentValue ? (
                              <div className="flex items-center gap-2">
                                <Image
                                  height={32}
                                  width={32}
                                  src={currentValue}
                                  alt="Company Logo"
                                  className="w-8 h-8 object-contain rounded"
                                  onError={(e) => {
                                    e.currentTarget.style.display = "none";
                                  }}
                                />
                                <span className="text-xs text-gray-600 truncate">
                                  Logo uploaded
                                </span>
                              </div>
                            ) : config.type === "password" && currentValue ? (
                              "••••••••"
                            ) : (
                              currentValue || "Not configured"
                            )}
                          </div>
                          <Button
                            variant="outline"
                            onClick={() =>
                              handleEdit({
                                key: config.key,
                                value: currentValue,
                              })
                            }
                            size="sm"
                            className="w-full border-gray-300 hover:bg-gray-50"
                          >
                            <EditIcon className="w-3 h-3 mr-1" />
                            Edit
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center shadow-lg">
          <SettingsIcon className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
            Email Configuration
          </h1>
          <p className="text-gray-600 text-sm">
            Configure email server settings for receiving and sending emails
          </p>
        </div>
      </div>

      {/* Email Configuration - Unified section with provider dropdown */}
      {renderConfigSection(
        "Email Server Settings (Outgoing)",
        "Configure your email server for sending notification emails",
        getConfigValue("EMAIL_PROVIDER") === "aws" ? AWS_CONFIGS : SMTP_CONFIGS,
        handleTestSmtpConnection,
        smtpTestStatus,
        testSmtpMutation,
        true // Show test button
      )}

      {/* IMAP Configuration */}
      {renderConfigSection(
        "IMAP Server Settings (Incoming)",
        "Configure your IMAP server for receiving emails (optional - webhook is recommended)",
        IMAP_CONFIGS,
        handleTestImapConnection,
        imapTestStatus,
        testImapMutation,
        true // Show test button for IMAP
      )}

      {/* Ticket Configuration */}
      {renderConfigSection(
        "Ticket Settings",
        "Configure how tickets are created from incoming emails",
        TICKET_CONFIGS,
        () => {}, // No test function for ticket settings
        "idle",
        { isPending: false },
        false // Don't show test button for ticket settings
      )}

      {/* Company Configuration */}
      {renderConfigSection(
        "Company Settings",
        "Configure company branding settings",
        COMPANY_CONFIGS,
        () => {}, // No test function for company settings
        "idle",
        { isPending: false },
        false // Don't show test button for company settings
      )}
    </div>
  );
}
