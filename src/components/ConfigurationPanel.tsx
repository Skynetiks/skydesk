"use client";

import { useState } from "react";
import { trpc } from "@/app/_trpc/client";
import { Button } from "@/components/ui/button";
import { useSession } from "next-auth/react";
import { Input } from "@/components/ui/input";
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
} from "lucide-react";

interface ConfigItem {
  key: string;
  value: string;
  description: string;
  required: boolean;
  type: "text" | "password" | "number" | "boolean";
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
    key: "SUPPORT_EMAIL",
    value: "",
    description: "From email address for sending notifications",
    required: true,
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
    setTestMessage("");
    testSmtpMutation.mutate();
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
    if (key.includes("SUPPORT_EMAIL")) return <SendIcon className="w-4 h-4" />;
    return <SettingsIcon className="w-4 h-4" />;
  };

  const getConfigCategory = (key: string) => {
    if (key.includes("HOST") || key.includes("PORT")) return "Server";
    if (key.includes("USER") || key.includes("PASS")) return "Authentication";
    if (key.includes("SECURE")) return "Security";
    if (key.includes("LIMIT")) return "Processing";
    if (key.includes("SUPPORT_EMAIL")) return "Notifications";
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
    testMutation: { isPending: boolean }
  ) => (
    <Card className="bg-white/50 backdrop-blur-sm border-white/20 shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <SettingsIcon className="w-5 h-5 text-gray-600" />
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {/* Test Connection Button */}
        <div className="mb-6">
          <div className="flex items-center gap-4">
            <Button
              onClick={testFunction}
              disabled={testMutation.isPending || isLoading}
              className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg"
            >
              {testMutation.isPending ? (
                <>
                  <RefreshCwIcon className="w-4 h-4 mr-2 animate-spin" />
                  Testing...
                </>
              ) : (
                <>
                  <TestTubeIcon className="w-4 h-4 mr-2" />
                  Test Connection
                </>
              )}
            </Button>

            {testStatus !== "idle" && (
              <div className="flex items-center gap-2">
                {testStatus === "success" && (
                  <CheckCircleIcon className="w-5 h-5 text-green-600" />
                )}
                {testStatus === "error" && (
                  <AlertCircleIcon className="w-5 h-5 text-red-600" />
                )}
                <span
                  className={`text-sm ${
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

        {/* Configuration Items */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="flex items-center gap-3 text-gray-500">
              <RefreshCwIcon className="w-6 h-6 animate-spin" />
              <span>Loading configurations...</span>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {configs.map((config) => {
              const currentValue = getConfigValue(config.key);
              const category = getConfigCategory(config.key);
              const categoryColor = getCategoryColor(category);
              const isEditing = editingKey === config.key;

              return (
                <Card
                  key={config.key}
                  className="bg-white/70 border-white/30 shadow-sm hover:shadow-md transition-shadow"
                >
                  <CardContent className="p-4">
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="p-2 bg-gray-100 rounded-lg">
                            {getConfigIcon(config.key)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-semibold text-gray-900 text-base font-mono">
                                {config.key}
                              </span>
                              <Badge
                                variant="outline"
                                className={categoryColor}
                              >
                                {category}
                              </Badge>
                              {config.required && (
                                <Badge
                                  variant="destructive"
                                  className="text-xs"
                                >
                                  Required
                                </Badge>
                              )}
                            </div>
                            <div className="text-sm text-gray-600 mb-2">
                              {config.description}
                            </div>
                          </div>
                        </div>

                        {isEditing ? (
                          <div className="flex gap-2 mt-3">
                            <Input
                              type={
                                config.type === "password" ? "password" : "text"
                              }
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              className="flex-1 bg-white/70 border-white/30 focus:border-blue-300 focus:ring-blue-200"
                              placeholder={`Enter ${config.key.toLowerCase()}`}
                            />
                            <Button
                              onClick={handleSave}
                              disabled={upsertMutation.isPending}
                              size="sm"
                              className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white"
                            >
                              {upsertMutation.isPending ? (
                                <RefreshCwIcon className="w-4 h-4 animate-spin" />
                              ) : (
                                <SaveIcon className="w-4 h-4" />
                              )}
                            </Button>
                            <Button
                              variant="outline"
                              onClick={() => setEditingKey(null)}
                              size="sm"
                              className="border-gray-300 hover:bg-gray-50"
                            >
                              <XIcon className="w-4 h-4" />
                            </Button>
                          </div>
                        ) : (
                          <div className="text-sm text-gray-800 font-mono break-all bg-gray-50 rounded-lg px-3 py-2 border border-gray-200">
                            {config.type === "password" && currentValue
                              ? "••••••••"
                              : currentValue || "Not configured"}
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:ml-4">
                        {!isEditing && (
                          <Button
                            variant="outline"
                            onClick={() =>
                              handleEdit({
                                key: config.key,
                                value: currentValue,
                              })
                            }
                            size="sm"
                            className="border-gray-300 hover:bg-gray-50"
                          >
                            <EditIcon className="w-4 h-4 mr-1" />
                            Edit
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
          <MailIcon className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
            Email Configuration
          </h1>
          <p className="text-gray-600 mt-1">
            Configure email server settings for receiving and sending emails
          </p>
        </div>
      </div>

      {/* SMTP Configuration */}
      {renderConfigSection(
        "SMTP Server Settings (Outgoing)",
        "Configure your SMTP server for sending notification emails",
        SMTP_CONFIGS,
        handleTestSmtpConnection,
        smtpTestStatus,
        testSmtpMutation
      )}

      {/* IMAP Configuration */}
      {renderConfigSection(
        "IMAP Server Settings (Incoming)",
        "Configure your IMAP server for receiving emails (optional - webhook is recommended)",
        IMAP_CONFIGS,
        handleTestImapConnection,
        imapTestStatus,
        testImapMutation
      )}
    </div>
  );
}
