"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeftIcon,
  EditIcon,
  MailIcon,
  PhoneIcon,
  MapPinIcon,
  BuildingIcon,
  CalendarIcon,
  TicketIcon,
} from "lucide-react";
import { trpc } from "@/app/_trpc/client";
import { format } from "date-fns";
import Link from "next/link";
import { toast } from "sonner";

interface ClientDetailProps {
  clientId: string;
  onBack: () => void;
  onEdit: (client: {
    id: string;
    name: string;
    emails: string[];
    phone?: string[];
    address?: string | null;
    city?: string | null;
    state?: string | null;
    country?: string | null;
    companyName?: string | null;
    isActive?: boolean;
  }) => void;
  isAdmin: boolean;
}

export function ClientDetail({
  clientId,
  onBack,
  onEdit,
  isAdmin,
}: ClientDetailProps) {
  const { data: client, isLoading } = trpc.client.getById.useQuery({
    id: clientId,
  });

  const updateMutation = trpc.client.update.useMutation({
    onSuccess: () => {
      // Refetch the client data
      window.location.reload();
    },
  });

  const handleToggleActive = async (client: {
    id: string;
    name: string;
    emails: string[];
    phone?: string[];
    address?: string | null;
    city?: string | null;
    state?: string | null;
    country?: string | null;
    companyName?: string | null;
    isActive?: boolean;
  }) => {
    try {
      await updateMutation.mutateAsync({
        id: client.id,
        isActive: !client.isActive,
      });
      toast.success(
        `Client ${client.name} ${
          client.isActive ? "deactivated" : "activated"
        } successfully`
      );
    } catch (error) {
      console.error("Failed to update client:", error);
      toast.error("Failed to update client status. Please try again.");
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={onBack}>
            <ArrowLeftIcon className="w-4 h-4 mr-2" />
            Back
          </Button>
        </div>
        <Card>
          <CardContent className="p-6">
            <div className="animate-pulse space-y-4">
              <div className="h-6 bg-gray-200 rounded w-1/3"></div>
              <div className="space-y-2">
                <div className="h-4 bg-gray-200 rounded"></div>
                <div className="h-4 bg-gray-200 rounded w-2/3"></div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={onBack}>
            <ArrowLeftIcon className="w-4 h-4 mr-2" />
            Back
          </Button>
        </div>
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-gray-500">Client not found</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={onBack}>
            <ArrowLeftIcon className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">
                {client.name}
              </h1>
              <div className="flex items-center gap-2">
                <div
                  className={`w-3 h-3 rounded-full ${
                    client.isActive ? "bg-green-500" : "bg-gray-400"
                  }`}
                />
                <Badge
                  variant={client.isActive ? "default" : "secondary"}
                  className="text-sm"
                >
                  {client.isActive ? "Active" : "Inactive"}
                </Badge>
              </div>
            </div>
            {client.companyName && (
              <p className="text-gray-600">{client.companyName}</p>
            )}
          </div>
        </div>
        {isAdmin && (
          <div className="flex items-center gap-2">
            <Button
              onClick={() => onEdit(client)}
              className="flex items-center gap-2"
            >
              <EditIcon className="w-4 h-4" />
              Edit Client
            </Button>
            <Button
              onClick={() => handleToggleActive(client)}
              variant="outline"
              className="flex items-center gap-2"
            >
              <div
                className={`w-3 h-3 rounded-full ${
                  client.isActive ? "bg-green-500" : "bg-gray-400"
                }`}
              />
              {client.isActive ? "Deactivate" : "Activate"}
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Client Information */}
        <div className="lg:col-span-2 space-y-6">
          {/* Contact Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MailIcon className="w-5 h-5" />
                Contact Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2">
                  Email Addresses
                </h4>
                <div className="flex flex-wrap gap-2">
                  {client.emails.map((email, index) => (
                    <Badge
                      key={index}
                      variant="secondary"
                      className="flex items-center gap-1"
                    >
                      <MailIcon className="w-3 h-3" />
                      {email}
                    </Badge>
                  ))}
                </div>
              </div>

              {client.phone && client.phone.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">
                    Phone Numbers
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {client.phone.map((phone, index) => (
                      <Badge
                        key={index}
                        variant="outline"
                        className="flex items-center gap-1"
                      >
                        <PhoneIcon className="w-3 h-3" />
                        {phone}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Address Information */}
          {(client.address ||
            client.city ||
            client.state ||
            client.country) && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPinIcon className="w-5 h-5" />
                  Address Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {client.address && (
                    <p className="text-sm text-gray-600">{client.address}</p>
                  )}
                  <p className="text-sm text-gray-600">
                    {[client.city, client.state, client.country]
                      .filter(Boolean)
                      .join(", ")}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Tickets */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TicketIcon className="w-5 h-5" />
                Tickets ({client.tickets.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {client.tickets.length > 0 ? (
                <div className="space-y-3">
                  {client.tickets.map((ticket) => (
                    <Link
                      key={ticket.id}
                      href={`/tickets/${ticket.id}`}
                      className="block"
                    >
                      <div className="border rounded-lg p-3 hover:bg-gray-50 transition-colors cursor-pointer">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h4 className="font-medium text-gray-900">
                              {ticket.subject}
                            </h4>
                            <p className="text-sm text-gray-600 mt-1">
                              From: {ticket.fromEmail}
                            </p>
                            <div className="flex items-center gap-4 mt-2">
                              <Badge
                                variant={
                                  ticket.status === "OPEN"
                                    ? "default"
                                    : ticket.status === "IN_PROGRESS"
                                    ? "secondary"
                                    : "outline"
                                }
                              >
                                {ticket.status.replace("_", " ")}
                              </Badge>
                              <Badge
                                variant={
                                  ticket.priority === "HIGH" ||
                                  ticket.priority === "URGENT"
                                    ? "destructive"
                                    : "outline"
                                }
                              >
                                {ticket.priority}
                              </Badge>
                              <span className="text-xs text-gray-500">
                                {format(
                                  new Date(ticket.createdAt),
                                  "MMM d, yyyy"
                                )}
                              </span>
                            </div>
                          </div>
                          {ticket.assignedTo && (
                            <div className="text-right">
                              <p className="text-xs text-gray-500">
                                Assigned to
                              </p>
                              <p className="text-sm font-medium">
                                {ticket.assignedTo.name}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-4">
                  No tickets found for this client
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Client Details */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BuildingIcon className="w-5 h-5" />
                Client Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-xs text-gray-500">Created</p>
                <p className="text-sm font-medium flex items-center gap-1">
                  <CalendarIcon className="w-3 h-3" />
                  {format(new Date(client.createdAt), "MMM d, yyyy")}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Last Updated</p>
                <p className="text-sm font-medium flex items-center gap-1">
                  <CalendarIcon className="w-3 h-3" />
                  {format(new Date(client.updatedAt), "MMM d, yyyy")}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Total Tickets</p>
                <p className="text-sm font-medium">{client.tickets.length}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Status</p>
                <Badge
                  variant={client.isActive ? "default" : "secondary"}
                  className="text-xs"
                >
                  {client.isActive ? "Active" : "Inactive"}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          {isAdmin && (
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => onEdit(client)}
                >
                  <EditIcon className="w-4 h-4 mr-2" />
                  Edit Client
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
