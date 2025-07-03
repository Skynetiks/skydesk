"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  ArrowLeft,
  Edit,
  Play,
  Pause,
  Mail,
  Users,
  CheckCircle,
  XCircle,
  AlertCircle,
  BarChart3,
  History,
  Send,
  Trash2,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { CampaignStatus, RecipientStatus } from "@prisma/client";

interface Campaign {
  id: string;
  name: string;
  subject: string;
  body: string;
  status: CampaignStatus;
  totalRecipients: number;
  sentCount: number;
  failedCount: number;
  concurrency: number;
  delaySeconds: number;
  createdAt: Date;
  lastExecuted?: Date | null;
  createdBy: {
    id: string;
    name: string;
    email: string;
  };
  recipients: Array<{
    id: string;
    email: string;
    name?: string | null;
    status: RecipientStatus;
    sentAt?: Date | null;
    failedAt?: Date | null;
    errorMessage?: string | null;
    client?: {
      id: string;
      name: string;
      companyName?: string | null;
    } | null;
  }>;
  executions: Array<{
    id: string;
    executionTime: Date;
    emailsSent: number;
    emailsFailed: number;
    status: string;
    errorMessage?: string | null;
  }>;
}

interface CampaignStats {
  total: number;
  sent: number;
  failed: number;
  pending: number;
  bounced: number;
  successRate: number;
  recentExecutions: Array<{
    id: string;
    executionTime: Date;
    emailsSent: number;
    emailsFailed: number;
    status: string;
  }>;
}

interface CampaignDetailProps {
  campaign: Campaign;
  stats?: CampaignStats;
  onExecute: () => void;
  isExecuting: boolean;
  executionError?: string;
  onUpdateStatus?: (
    status: "DRAFT" | "ACTIVE" | "PAUSED" | "COMPLETED" | "CANCELLED"
  ) => void;
  isUpdatingStatus?: boolean;
  onDelete?: () => void;
  isDeleting?: boolean;
}

const statusColors = {
  DRAFT: "bg-gray-100 text-gray-800",
  ACTIVE: "bg-green-100 text-green-800",
  PAUSED: "bg-yellow-100 text-yellow-800",
  COMPLETED: "bg-blue-100 text-blue-800",
  CANCELLED: "bg-red-100 text-red-800",
};

const statusIcons = {
  DRAFT: AlertCircle,
  ACTIVE: Play,
  PAUSED: Pause,
  COMPLETED: CheckCircle,
  CANCELLED: XCircle,
};

const recipientStatusColors = {
  PENDING: "bg-gray-100 text-gray-800",
  SENT: "bg-green-100 text-green-800",
  FAILED: "bg-red-100 text-red-800",
  BOUNCED: "bg-orange-100 text-orange-800",
};

export function CampaignDetail({
  campaign,
  stats,
  onExecute,
  isExecuting,
  executionError,
  onUpdateStatus,
  isUpdatingStatus,
  onDelete,
  isDeleting,
}: CampaignDetailProps) {
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<
    "overview" | "recipients" | "executions"
  >("overview");

  const StatusIcon = statusIcons[campaign.status];

  const handleExecute = () => {
    onExecute();
  };

  const handleBack = () => {
    router.push("/campaigns");
  };

  const handleStartCampaign = () => {
    onUpdateStatus?.("ACTIVE");
  };

  const handleStartAndSendCampaign = () => {
    // The parent component now handles both status update and execution
    onUpdateStatus?.("ACTIVE");
  };

  const handlePauseCampaign = () => {
    onUpdateStatus?.("PAUSED");
  };

  const handleStopCampaign = () => {
    onUpdateStatus?.("CANCELLED");
  };

  const handleEdit = () => {
    router.push(`/campaigns/${campaign.id}/edit`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={handleBack}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {campaign.name}
            </h1>
            <p className="text-gray-600">{campaign.subject}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge className={statusColors[campaign.status]}>
            <StatusIcon className="w-3 h-3 mr-1" />
            {campaign.status}
          </Badge>
        </div>
      </div>

      {executionError && (
        <Alert className="border-red-200 bg-red-50">
          <XCircle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800">
            {executionError}
          </AlertDescription>
        </Alert>
      )}

      {/* Quick Actions */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="text-sm text-gray-600">
                {campaign.status === "ACTIVE" &&
                  `${stats?.pending || 0} pending recipients`}
                {campaign.status === "DRAFT" &&
                  "Campaign is ready to start and send"}
                {campaign.status === "PAUSED" && "Campaign is paused"}
                {campaign.status === "COMPLETED" &&
                  `Campaign completed - ${stats?.sent || 0} sent, ${
                    stats?.failed || 0
                  } failed`}
                {campaign.status === "CANCELLED" && "Campaign cancelled"}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* Status Control Buttons */}
              {campaign.status === "DRAFT" && (
                <>
                  <Button
                    onClick={handleEdit}
                    variant="outline"
                    className="border-blue-500 text-blue-600 hover:bg-blue-50"
                  >
                    <Edit className="w-4 h-4 mr-2" />
                    Edit Campaign
                  </Button>
                  <Button
                    onClick={handleStartAndSendCampaign}
                    disabled={isUpdatingStatus || isExecuting}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <Play className="w-4 h-4 mr-2" />
                    {isUpdatingStatus
                      ? "Starting..."
                      : isExecuting
                      ? "Sending..."
                      : "Start & Send"}
                  </Button>
                  {onDelete && (
                    <Button
                      onClick={onDelete}
                      disabled={isDeleting}
                      variant="outline"
                      className="border-red-500 text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      {isDeleting ? "Deleting..." : "Delete"}
                    </Button>
                  )}
                </>
              )}
              {campaign.status === "ACTIVE" && (
                <>
                  <Button
                    onClick={handlePauseCampaign}
                    disabled={isUpdatingStatus}
                    variant="outline"
                    className="border-yellow-500 text-yellow-600 hover:bg-yellow-50"
                  >
                    <Pause className="w-4 h-4 mr-2" />
                    {isUpdatingStatus ? "Pausing..." : "Pause"}
                  </Button>
                  <Button
                    onClick={handleStopCampaign}
                    disabled={isUpdatingStatus}
                    variant="outline"
                    className="border-red-500 text-red-600 hover:bg-red-50"
                  >
                    <XCircle className="w-4 h-4 mr-2" />
                    {isUpdatingStatus ? "Stopping..." : "Stop"}
                  </Button>
                </>
              )}
              {campaign.status === "PAUSED" && (
                <>
                  <Button
                    onClick={handleStartCampaign}
                    disabled={isUpdatingStatus}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <Play className="w-4 h-4 mr-2" />
                    {isUpdatingStatus ? "Starting..." : "Resume"}
                  </Button>
                  <Button
                    onClick={handleStopCampaign}
                    disabled={isUpdatingStatus}
                    variant="outline"
                    className="border-red-500 text-red-600 hover:bg-red-50"
                  >
                    <XCircle className="w-4 h-4 mr-2" />
                    {isUpdatingStatus ? "Stopping..." : "Stop"}
                  </Button>
                  {onDelete && (
                    <Button
                      onClick={onDelete}
                      disabled={isDeleting}
                      variant="outline"
                      className="border-red-500 text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      {isDeleting ? "Deleting..." : "Delete"}
                    </Button>
                  )}
                </>
              )}
              {campaign.status === "COMPLETED" && (
                <>
                  <Button
                    onClick={() => setActiveTab("recipients")}
                    variant="outline"
                    className="border-blue-500 text-blue-600 hover:bg-blue-50"
                  >
                    <Users className="w-4 h-4 mr-2" />
                    View Results
                  </Button>
                  <Button
                    onClick={() => setActiveTab("executions")}
                    variant="outline"
                    className="border-green-500 text-green-600 hover:bg-green-50"
                  >
                    <History className="w-4 h-4 mr-2" />
                    View Executions
                  </Button>
                  {onDelete && (
                    <Button
                      onClick={onDelete}
                      disabled={isDeleting}
                      variant="outline"
                      className="border-red-500 text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      {isDeleting ? "Deleting..." : "Delete"}
                    </Button>
                  )}
                </>
              )}
              {campaign.status === "CANCELLED" && onDelete && (
                <>
                  <Button
                    onClick={onDelete}
                    disabled={isDeleting}
                    variant="outline"
                    className="border-red-500 text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    {isDeleting ? "Deleting..." : "Delete"}
                  </Button>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: "overview", label: "Overview", icon: BarChart3 },
            { id: "recipients", label: "Recipients", icon: Users },
            { id: "executions", label: "Executions", icon: History },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() =>
                  setActiveTab(
                    tab.id as "overview" | "recipients" | "executions"
                  )
                }
                className={`flex items-center gap-2 py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.id
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Campaign Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="w-5 h-5" />
                Campaign Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-sm font-medium text-gray-700">
                  Created by
                </Label>
                <p className="text-sm text-gray-900">
                  {campaign.createdBy.name}
                </p>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-700">
                  Created
                </Label>
                <p className="text-sm text-gray-900">
                  {formatDistanceToNow(new Date(campaign.createdAt), {
                    addSuffix: true,
                  })}
                </p>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-700">
                  Last executed
                </Label>
                <p className="text-sm text-gray-900">
                  {campaign.lastExecuted
                    ? formatDistanceToNow(new Date(campaign.lastExecuted), {
                        addSuffix: true,
                      })
                    : "Never"}
                </p>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-700">
                  Concurrency
                </Label>
                <p className="text-sm text-gray-900">
                  {campaign.concurrency} emails simultaneously
                </p>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-700">
                  Delay between batches
                </Label>
                <p className="text-sm text-gray-900">
                  {campaign.delaySeconds} seconds
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Statistics */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                Statistics
              </CardTitle>
            </CardHeader>
            <CardContent>
              {stats ? (
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <div className="text-2xl font-bold text-gray-900">
                      {stats.total}
                    </div>
                    <div className="text-sm text-gray-600">
                      Total Recipients
                    </div>
                  </div>
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">
                      {stats.sent}
                    </div>
                    <div className="text-sm text-gray-600">Sent</div>
                  </div>
                  <div className="text-center p-4 bg-yellow-50 rounded-lg">
                    <div className="text-2xl font-bold text-yellow-600">
                      {stats.pending}
                    </div>
                    <div className="text-sm text-gray-600">Pending</div>
                  </div>
                  <div className="text-center p-4 bg-red-50 rounded-lg">
                    <div className="text-2xl font-bold text-red-600">
                      {stats.failed}
                    </div>
                    <div className="text-sm text-gray-600">Failed</div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  Loading statistics...
                </div>
              )}

              {stats && (
                <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                  <div className="text-center">
                    <div className="text-lg font-semibold text-blue-900">
                      {stats.successRate.toFixed(1)}% Success Rate
                    </div>
                    <div className="text-sm text-blue-700">
                      {stats.sent} of {stats.total} emails delivered
                      successfully
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === "recipients" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Recipients ({campaign.recipients.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-2">Email</th>
                    <th className="text-left py-2 px-2">Name</th>
                    <th className="text-left py-2 px-2">Client</th>
                    <th className="text-left py-2 px-2">Status</th>
                    <th className="text-left py-2 px-2">Sent/Failed</th>
                  </tr>
                </thead>
                <tbody>
                  {campaign.recipients.map((recipient) => (
                    <tr key={recipient.id} className="border-b">
                      <td className="py-2 px-2 text-sm">{recipient.email}</td>
                      <td className="py-2 px-2 text-sm">
                        {recipient.name || "-"}
                      </td>
                      <td className="py-2 px-2 text-sm">
                        {recipient.client?.name || "-"}
                      </td>
                      <td className="py-2 px-2">
                        <Badge
                          className={recipientStatusColors[recipient.status]}
                        >
                          {recipient.status}
                        </Badge>
                      </td>
                      <td className="py-2 px-2 text-sm">
                        {recipient.sentAt &&
                          format(new Date(recipient.sentAt), "MMM d, h:mm a")}
                        {recipient.failedAt && (
                          <div className="text-red-600">
                            {format(
                              new Date(recipient.failedAt),
                              "MMM d, h:mm a"
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === "executions" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="w-5 h-5" />
              Execution History ({campaign.executions.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {campaign.executions.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No executions yet
              </div>
            ) : (
              <div className="space-y-4">
                {campaign.executions.map((execution) => (
                  <div
                    key={execution.id}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div>
                      <div className="font-medium">
                        {format(
                          new Date(execution.executionTime),
                          "MMM d, yyyy 'at' h:mm a"
                        )}
                      </div>
                      <div className="text-sm text-gray-600">
                        {execution.emailsSent} sent, {execution.emailsFailed}{" "}
                        failed
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        className={
                          execution.status === "COMPLETED"
                            ? "bg-green-100 text-green-800"
                            : execution.status === "FAILED"
                            ? "bg-red-100 text-red-800"
                            : "bg-yellow-100 text-yellow-800"
                        }
                      >
                        {execution.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
