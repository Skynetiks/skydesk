"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Mail, AlertCircle, Info } from "lucide-react";

interface Client {
  id: string;
  name: string;
  emails: string[];
  companyName?: string | null;
  isActive?: boolean;
}

interface CampaignFormData {
  name: string;
  subject: string;
  body: string;
  concurrency: number;
  clientIds: string[];
  additionalEmails: string[];
}

interface CampaignFormProps {
  clients: Client[];
  clientsLoading: boolean;
  onSubmit: (data: CampaignFormData) => void;
  isLoading: boolean;
  error?: string;
  initialData?: Partial<CampaignFormData>;
  isEditing?: boolean;
}

type ClientFilter = "all" | "active" | "inactive";

export function CampaignForm({
  clients,
  clientsLoading,
  onSubmit,
  isLoading,
  error,
  initialData,
  isEditing = false,
}: CampaignFormProps) {
  const [formData, setFormData] = useState<CampaignFormData>({
    name: initialData?.name || "",
    subject: initialData?.subject || "",
    body: initialData?.body || "",
    concurrency: initialData?.concurrency || 5,
    clientIds: initialData?.clientIds || [],
    additionalEmails: initialData?.additionalEmails || [],
  });

  // Auto-select all clients when form loads (if not editing)
  useEffect(() => {
    if (!isEditing && clients.length > 0 && formData.clientIds.length === 0) {
      const allClientIds = clients.map((client) => client.id);
      setFormData((prev) => ({
        ...prev,
        clientIds: allClientIds,
      }));
      setClientFilter("all");
    }
  }, [clients, isEditing, formData.clientIds.length]);

  const [clientFilter, setClientFilter] = useState<ClientFilter>("all");

  const handleInputChange = <K extends keyof CampaignFormData>(
    field: K,
    value: CampaignFormData[K]
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSelectAllActive = () => {
    const activeClientIds = clients
      .filter((client) => client.isActive)
      .map((client) => client.id);
    setFormData((prev) => ({
      ...prev,
      clientIds: activeClientIds,
    }));
    setClientFilter("active");
  };

  const handleSelectAllInactive = () => {
    const inactiveClientIds = clients
      .filter((client) => !client.isActive)
      .map((client) => client.id);
    setFormData((prev) => ({
      ...prev,
      clientIds: inactiveClientIds,
    }));
    setClientFilter("inactive");
  };

  const handleSelectAllClients = () => {
    const allClientIds = clients.map((client) => client.id);
    setFormData((prev) => ({
      ...prev,
      clientIds: allClientIds,
    }));
    setClientFilter("all");
  };

  const handleClearSelection = () => {
    setFormData((prev) => ({
      ...prev,
      clientIds: [],
    }));
    setClientFilter("all");
  };

  const getFilteredClients = () => {
    // Debug: Log the clients data
    console.log("CampaignForm - All clients:", clients);
    console.log("CampaignForm - Client filter:", clientFilter);

    const filtered = (() => {
      switch (clientFilter) {
        case "active":
          return clients.filter((client) => client.isActive);
        case "inactive":
          return clients.filter((client) => !client.isActive);
        default:
          return clients;
      }
    })();

    console.log("CampaignForm - Filtered clients:", filtered);
    return filtered;
  };

  const getClientCounts = () => {
    const activeCount = clients.filter((client) => client.isActive).length;
    const inactiveCount = clients.filter((client) => !client.isActive).length;
    const totalCount = clients.length;
    return { activeCount, inactiveCount, totalCount };
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Submitting campaign form with data:", formData);
    console.log("Selected client IDs:", formData.clientIds);
    console.log("Additional emails:", formData.additionalEmails);
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <Alert className="border-red-200 bg-red-50">
          <AlertCircle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800">{error}</AlertDescription>
        </Alert>
      )}

      {/* Basic Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5" />
            Campaign Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="name">Campaign Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleInputChange("name", e.target.value)}
                placeholder="Enter campaign name"
                required
              />
            </div>
            <div>
              <Label htmlFor="concurrency" className="flex items-center gap-2">
                Concurrency
                <div className="group relative">
                  <Info className="w-4 h-4 text-gray-400 cursor-help" />
                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap z-10">
                    <div className="font-medium mb-1">
                      ⚠️ Email Server Limits
                    </div>
                    <div>Be careful with concurrency settings!</div>
                    <div>• Gmail: ~500/day, ~20/hour</div>
                    <div>• Outlook: ~300/day, ~10/hour</div>
                    <div>• AWS SES: ~50,000/day (sandbox), ~14/sec</div>
                    <div>• Custom SMTP: Check your provider&apos;s limits</div>
                    <div className="mt-1 text-yellow-200">
                      High concurrency may trigger rate limits
                    </div>
                  </div>
                </div>
              </Label>
              <Input
                id="concurrency"
                type="number"
                min="1"
                max="50"
                value={formData.concurrency}
                onChange={(e) =>
                  handleInputChange("concurrency", parseInt(e.target.value))
                }
                placeholder="5"
              />
              <p className="text-xs text-gray-500 mt-1">
                Emails sent simultaneously
              </p>
            </div>
          </div>
          {clientsLoading ? (
            <div className="text-sm text-gray-500 mt-2">Loading clients...</div>
          ) : (
            <>
              <div className="mb-4">
                <div className="text-sm font-medium text-gray-700 mb-2">
                  Audience Selection
                </div>
                <div className="text-xs text-gray-500 mb-2">
                  Showing {getFilteredClients().length} of {clients.length}{" "}
                  clients
                  {clientFilter === "active" && " (active only)"}
                  {clientFilter === "inactive" && " (inactive only)"}
                </div>
                {clientFilter !== "all" && (
                  <div className="text-xs text-blue-600 font-medium">
                    Filter:{" "}
                    {clientFilter === "active"
                      ? "Active Clients"
                      : "Inactive Clients"}
                  </div>
                )}
                <div className="text-xs text-green-600 font-medium mt-2">
                  Campaign will include: {formData.clientIds.length} clients
                  with{" "}
                  {clients
                    .filter((client) => formData.clientIds.includes(client.id))
                    .reduce(
                      (total, client) => total + client.emails.length,
                      0
                    )}{" "}
                  total email addresses
                  {formData.additionalEmails.length > 0 &&
                    ` + ${formData.additionalEmails.length} additional emails`}
                </div>
              </div>

              {/* Selection Buttons */}
              <div className="flex flex-wrap gap-2 mb-4">
                <Button
                  type="button"
                  variant={clientFilter === "active" ? "default" : "outline"}
                  size="sm"
                  onClick={handleSelectAllActive}
                  className={`flex items-center gap-2 ${
                    clientFilter === "active"
                      ? "bg-green-600 hover:bg-green-700 text-white"
                      : ""
                  }`}
                >
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  Select All Active ({getClientCounts().activeCount})
                </Button>
                <Button
                  type="button"
                  variant={clientFilter === "inactive" ? "default" : "outline"}
                  size="sm"
                  onClick={handleSelectAllInactive}
                  className={`flex items-center gap-2 ${
                    clientFilter === "inactive"
                      ? "bg-gray-600 hover:bg-gray-700 text-white"
                      : ""
                  }`}
                >
                  <div className="w-2 h-2 rounded-full bg-gray-400" />
                  Select All Inactive ({getClientCounts().inactiveCount})
                </Button>
                <Button
                  type="button"
                  variant={clientFilter === "all" ? "default" : "outline"}
                  size="sm"
                  onClick={handleSelectAllClients}
                  className={`flex items-center gap-2 ${
                    clientFilter === "all"
                      ? "bg-blue-600 hover:bg-blue-700 text-white"
                      : ""
                  }`}
                >
                  Select All Clients ({getClientCounts().totalCount})
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleClearSelection}
                  className="text-red-600 hover:text-red-700"
                >
                  Clear Selection
                </Button>
              </div>
            </>
          )}

          <div>
            <Label htmlFor="subject">Email Subject *</Label>
            <Input
              id="subject"
              value={formData.subject}
              onChange={(e) => handleInputChange("subject", e.target.value)}
              placeholder="Enter email subject"
              required
            />
          </div>

          <div>
            <Label htmlFor="body">Email Body *</Label>
            <RichTextEditor
              content={formData.body}
              onChange={(value) => handleInputChange("body", value)}
              placeholder="Write your email content..."
            />
          </div>

          <div>
            <Label htmlFor="additionalEmails">
              Additional Email Addresses (Optional)
            </Label>
            <Input
              id="additionalEmails"
              value={formData.additionalEmails.join(", ")}
              onChange={(e) => {
                const emails = e.target.value
                  .split(",")
                  .map((email) => email.trim())
                  .filter((email) => email.length > 0);
                handleInputChange("additionalEmails", emails);
              }}
              placeholder="email1@example.com, email2@example.com"
            />
            <p className="text-xs text-gray-500 mt-1">
              Add email addresses separated by commas (for testing)
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Submit Button */}
      <div className="flex justify-end gap-4">
        <Button
          type="button"
          variant="outline"
          onClick={() => window.history.back()}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={
            isLoading || !formData.name || !formData.subject || !formData.body
          }
        >
          {isLoading
            ? "Creating..."
            : isEditing
            ? "Update Campaign"
            : "Create Campaign"}
        </Button>
      </div>
    </form>
  );
}
