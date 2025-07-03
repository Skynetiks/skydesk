"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus, Edit, Trash2, Mail, Calendar, Clock } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { CampaignStatus } from "@prisma/client";

interface Campaign {
  id: string;
  name: string;
  subject: string;
  status: CampaignStatus;
  totalRecipients: number;
  sentCount: number;
  failedCount: number;
  concurrency: number;
  delaySeconds: number;
  createdAt: Date;
  lastExecuted?: Date | null;
  nextExecution?: Date | null;
  createdBy: {
    id: string;
    name: string;
    email: string;
  };
  schedule?: {
    frequency: string;
    interval: number;
    timeOfDay: string;
  } | null;
  _count: {
    recipients: number;
    executions: number;
  };
}

interface CampaignListProps {
  campaigns: Campaign[];
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  isDeleting?: boolean;
}

const statusColors = {
  DRAFT: "bg-gray-100 text-gray-800",
  ACTIVE: "bg-green-100 text-green-800",
  PAUSED: "bg-yellow-100 text-yellow-800",
  COMPLETED: "bg-blue-100 text-blue-800",
  CANCELLED: "bg-red-100 text-red-800",
};

export function CampaignList({
  campaigns,
  onEdit,
  onDelete,
  isDeleting,
}: CampaignListProps) {
  const router = useRouter();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [campaignToDelete, setCampaignToDelete] = useState<Campaign | null>(
    null
  );

  const handleCreateCampaign = () => {
    router.push("/campaigns/new");
  };

  const handleViewCampaign = (id: string) => {
    router.push(`/campaigns/${id}`);
  };

  const handleEditCampaign = (id: string) => {
    router.push(`/campaigns/${id}/edit`);
  };

  const handleDeleteClick = (campaign: Campaign) => {
    setCampaignToDelete(campaign);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (campaignToDelete && onDelete) {
      onDelete(campaignToDelete.id);
      setDeleteDialogOpen(false);
      setCampaignToDelete(null);
    }
  };

  const handleCancelDelete = () => {
    setDeleteDialogOpen(false);
    setCampaignToDelete(null);
  };

  const getSuccessRate = (campaign: Campaign) => {
    if (campaign.sentCount + campaign.failedCount === 0) return 0;
    return Math.round(
      (campaign.sentCount / (campaign.sentCount + campaign.failedCount)) * 100
    );
  };

  const getScheduleText = (campaign: Campaign) => {
    if (!campaign.schedule) return "No schedule";

    const { frequency, interval, timeOfDay } = campaign.schedule;
    const time = format(new Date(`2000-01-01T${timeOfDay}`), "h:mm a");

    switch (frequency) {
      case "ONCE":
        return `Once at ${time}`;
      case "DAILY":
        return `Every ${interval} day${interval > 1 ? "s" : ""} at ${time}`;
      case "WEEKLY":
        return `Every ${interval} week${interval > 1 ? "s" : ""} at ${time}`;
      case "MONTHLY":
        return `Every ${interval} month${interval > 1 ? "s" : ""} at ${time}`;
      default:
        return "Custom schedule";
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with Create Button */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            All Campaigns ({campaigns.length})
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            Manage your email campaigns and automation
          </p>
        </div>
        <Button
          onClick={handleCreateCampaign}
          className="bg-blue-600 hover:bg-blue-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          Create Campaign
        </Button>
      </div>

      {/* Campaigns Grid */}
      {campaigns.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Mail className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No campaigns yet
            </h3>
            <p className="text-gray-600 mb-4">
              Create your first email campaign to start reaching your clients
            </p>
            <Button
              onClick={handleCreateCampaign}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Your First Campaign
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {campaigns.map((campaign) => {
            const successRate = getSuccessRate(campaign);

            return (
              <Card
                key={campaign.id}
                className="hover:shadow-lg transition-shadow cursor-pointer"
              >
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <CardTitle className="text-lg font-semibold text-gray-900 line-clamp-2">
                      {campaign.name}
                    </CardTitle>
                    <Badge className={statusColors[campaign.status]}>
                      {campaign.status}
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-600 line-clamp-1">
                    {campaign.subject}
                  </p>
                </CardHeader>

                <CardContent className="space-y-4">
                  {/* Statistics */}
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="text-center p-2 bg-gray-50 rounded">
                      <div className="font-semibold text-gray-900">
                        {campaign.totalRecipients}
                      </div>
                      <div className="text-gray-600">Recipients</div>
                    </div>
                    <div className="text-center p-2 bg-gray-50 rounded">
                      <div className="font-semibold text-gray-900">
                        {successRate}%
                      </div>
                      <div className="text-gray-600">Success Rate</div>
                    </div>
                  </div>

                  {/* Progress */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs text-gray-600">
                      <span>Sent: {campaign.sentCount}</span>
                      <span>Failed: {campaign.failedCount}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-green-600 h-2 rounded-full transition-all duration-300"
                        style={{
                          width: `${
                            campaign.totalRecipients > 0
                              ? (campaign.sentCount /
                                  campaign.totalRecipients) *
                                100
                              : 0
                          }%`,
                        }}
                      />
                    </div>
                  </div>

                  {/* Schedule Info */}
                  <div className="flex items-center text-sm text-gray-600">
                    <Calendar className="w-4 h-4 mr-2" />
                    <span className="line-clamp-1">
                      {getScheduleText(campaign)}
                    </span>
                  </div>

                  {/* Next Execution */}
                  {campaign.nextExecution && (
                    <div className="flex items-center text-sm text-gray-600">
                      <Clock className="w-4 h-4 mr-2" />
                      <span>
                        Next:{" "}
                        {formatDistanceToNow(new Date(campaign.nextExecution), {
                          addSuffix: true,
                        })}
                      </span>
                    </div>
                  )}

                  {/* Created Info */}
                  <div className="flex items-center justify-between text-xs text-gray-500 pt-2 border-t">
                    <span>By {campaign.createdBy.name}</span>
                    <span>
                      {formatDistanceToNow(new Date(campaign.createdAt), {
                        addSuffix: true,
                      })}
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleViewCampaign(campaign.id)}
                      className="flex-1"
                    >
                      View
                    </Button>
                    {campaign.status === "DRAFT" && onEdit && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditCampaign(campaign.id)}
                        className="border-blue-500 text-blue-600 hover:bg-blue-50"
                      >
                        <Edit className="w-3 h-3 mr-1" />
                        Edit
                      </Button>
                    )}
                    {campaign.status !== "ACTIVE" && onDelete && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteClick(campaign)}
                        disabled={isDeleting}
                        className="border-red-500 text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="w-3 h-3 mr-1" />
                        {isDeleting ? "Deleting..." : "Delete"}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Campaign</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{campaignToDelete?.name}
              &quot;? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={handleCancelDelete}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting..." : "Delete Campaign"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
