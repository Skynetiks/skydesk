"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  SearchIcon,
  PlusIcon,
  EditIcon,
  TrashIcon,
  EyeIcon,
  UploadIcon,
  Loader2Icon,
  Trash2Icon,
} from "lucide-react";
import { trpc } from "@/app/_trpc/client";
import { ClientDetail } from "./ClientDetail";
import { ClientForm } from "./ClientForm";
import { ExcelUpload } from "./ExcelUpload";
import { toast } from "sonner";

interface ClientListProps {
  isAdmin: boolean;
}

export function ClientList({ isAdmin }: ClientListProps) {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedClient, setSelectedClient] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [statusFilter, setStatusFilter] = useState<
    "all" | "active" | "inactive"
  >("all");

  // Check for view parameter in URL
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const viewClientId = urlParams.get("view");
    if (viewClientId) {
      setSelectedClient(viewClientId);
      // Clear the URL parameter
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete("view");
      window.history.replaceState({}, "", newUrl.toString());
    }
  }, []);
  const [editingClient, setEditingClient] = useState<{
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
  } | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [selectedClients, setSelectedClients] = useState<Set<string>>(
    new Set()
  );
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteProgress, setDeleteProgress] = useState({
    current: 0,
    total: 0,
  });
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  const [clientToDelete, setClientToDelete] = useState<string | null>(null);
  const [isUpdatingActive, setIsUpdatingActive] = useState(false);
  const [updateActiveProgress, setUpdateActiveProgress] = useState({
    current: 0,
    total: 0,
  });

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);

    return () => clearTimeout(timer);
  }, [search]);

  // Infinite query for clients
  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    refetch,
  } = trpc.client.getAll.useInfiniteQuery(
    {
      limit: 20,
      search: debouncedSearch || undefined,
      isActive: statusFilter === "all" ? undefined : statusFilter === "active",
    },
    {
      getNextPageParam: (lastPage) => lastPage.nextCursor,
    }
  );

  // Flatten all pages into a single array
  const allClients = data?.pages.flatMap((page) => page.items) ?? [];

  const deleteMutation = trpc.client.delete.useMutation({
    onSuccess: () => {
      refetch();
    },
  });

  const updateMutation = trpc.client.update.useMutation({
    onSuccess: () => {
      refetch();
    },
  });

  const handleDelete = async (id: string) => {
    setClientToDelete(id);
    setShowDeleteDialog(true);
  };

  const confirmDelete = async () => {
    if (!clientToDelete) return;

    try {
      await deleteMutation.mutateAsync({ id: clientToDelete });
      toast.success("Client deleted successfully");
    } catch (error) {
      console.error("Failed to delete client:", error);
      toast.error("Failed to delete client. Please try again.");
    } finally {
      setShowDeleteDialog(false);
      setClientToDelete(null);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedClients.size === 0) return;
    setShowBulkDeleteDialog(true);
  };

  const handleBulkToggleActive = async (isActive: boolean) => {
    if (selectedClients.size === 0) return;

    setIsUpdatingActive(true);
    setUpdateActiveProgress({ current: 0, total: selectedClients.size });

    const toastId = toast.loading(
      `${isActive ? "Activating" : "Deactivating"} ${
        selectedClients.size
      } client${selectedClients.size > 1 ? "s" : ""}...`
    );

    try {
      const clientIds = Array.from(selectedClients);

      // Update clients one by one with progress tracking
      for (let i = 0; i < clientIds.length; i++) {
        const clientId = clientIds[i];
        await updateMutation.mutateAsync({
          id: clientId,
          isActive,
        });
        setUpdateActiveProgress({ current: i + 1, total: clientIds.length });
      }

      setSelectedClients(new Set()); // Clear selection
      toast.success(
        `Successfully ${isActive ? "activated" : "deactivated"} ${
          clientIds.length
        } client${clientIds.length > 1 ? "s" : ""}`,
        { id: toastId }
      );
    } catch (error) {
      console.error("Failed to update clients:", error);
      toast.error(
        `Failed to ${
          isActive ? "activate" : "deactivate"
        } some clients. Please try again.`,
        {
          id: toastId,
        }
      );
    } finally {
      setIsUpdatingActive(false);
      setUpdateActiveProgress({ current: 0, total: 0 });
    }
  };

  const confirmBulkDelete = async () => {
    setIsDeleting(true);
    setDeleteProgress({ current: 0, total: selectedClients.size });

    const toastId = toast.loading(
      `Deleting ${selectedClients.size} client${
        selectedClients.size > 1 ? "s" : ""
      }...`
    );

    try {
      const clientIds = Array.from(selectedClients);

      // Delete clients one by one with progress tracking
      for (let i = 0; i < clientIds.length; i++) {
        const clientId = clientIds[i];
        await deleteMutation.mutateAsync({ id: clientId });
        setDeleteProgress({ current: i + 1, total: clientIds.length });
      }

      setSelectedClients(new Set()); // Clear selection
      toast.success(
        `Successfully deleted ${clientIds.length} client${
          clientIds.length > 1 ? "s" : ""
        }`,
        { id: toastId }
      );
    } catch (error) {
      console.error("Failed to delete clients:", error);
      toast.error("Failed to delete some clients. Please try again.", {
        id: toastId,
      });
    } finally {
      setIsDeleting(false);
      setDeleteProgress({ current: 0, total: 0 });
      setShowBulkDeleteDialog(false);
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedClients(new Set(allClients.map((client) => client.id)));
    } else {
      setSelectedClients(new Set());
    }
  };

  const handleSelectClient = (clientId: string, checked: boolean) => {
    const newSelected = new Set(selectedClients);
    if (checked) {
      newSelected.add(clientId);
    } else {
      newSelected.delete(clientId);
    }
    setSelectedClients(newSelected);
  };

  const isAllSelected =
    allClients.length > 0 && selectedClients.size === allClients.length;
  const isIndeterminate =
    selectedClients.size > 0 && selectedClients.size < allClients.length;

  const handleEdit = (client: {
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
    setEditingClient(client);
    setShowForm(true);
  };

  const handleView = (id: string) => {
    setSelectedClient(id);
  };

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

  const handleFormClose = () => {
    setShowForm(false);
    setEditingClient(null);
    refetch();
  };

  const handleUploadClose = () => {
    setShowUpload(false);
    refetch();
  };

  if (selectedClient) {
    return (
      <ClientDetail
        clientId={selectedClient}
        onBack={() => setSelectedClient(null)}
        onEdit={handleEdit}
        isAdmin={isAdmin}
      />
    );
  }

  if (showForm) {
    return (
      <ClientForm
        client={editingClient}
        onClose={handleFormClose}
        isAdmin={isAdmin}
      />
    );
  }

  if (showUpload) {
    return <ExcelUpload onClose={handleUploadClose} isAdmin={isAdmin} />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clients</h1>
          <p className="text-gray-600">Manage your client database</p>
        </div>
        {isAdmin && (
          <div className="flex gap-2">
            <Button
              onClick={() => setShowUpload(true)}
              variant="outline"
              className="flex items-center gap-2"
            >
              <UploadIcon className="w-4 h-4" />
              Upload Excel
            </Button>
            <Button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-2"
            >
              <PlusIcon className="w-4 h-4" />
              Add Client
            </Button>
          </div>
        )}
      </div>

      {/* Search and Bulk Actions */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex items-center gap-4 flex-1">
          <div className="relative flex-1">
            <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search clients by name, company, or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value as "all" | "active" | "inactive")
              }
              className="text-sm border border-gray-300 rounded-md px-3 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>

        {/* Bulk Actions */}
        {isAdmin && selectedClients.size > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">
              {selectedClients.size} selected
            </span>
            {isDeleting ? (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Loader2Icon className="w-4 h-4 animate-spin" />
                  <span>
                    Deleting {deleteProgress.current} of {deleteProgress.total}
                    ...
                  </span>
                </div>
                <div className="w-32 bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-red-600 h-2 rounded-full transition-all duration-300"
                    style={{
                      width: `${
                        (deleteProgress.current / deleteProgress.total) * 100
                      }%`,
                    }}
                  />
                </div>
              </div>
            ) : isUpdatingActive ? (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Loader2Icon className="w-4 h-4 animate-spin" />
                  <span>
                    Updating {updateActiveProgress.current} of{" "}
                    {updateActiveProgress.total}...
                  </span>
                </div>
                <div className="w-32 bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{
                      width: `${
                        (updateActiveProgress.current /
                          updateActiveProgress.total) *
                        100
                      }%`,
                    }}
                  />
                </div>
              </div>
            ) : (
              <>
                <Button
                  onClick={() => handleBulkToggleActive(true)}
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2"
                >
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  Activate All
                </Button>
                <Button
                  onClick={() => handleBulkToggleActive(false)}
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2"
                >
                  <div className="w-2 h-2 rounded-full bg-gray-400" />
                  Deactivate All
                </Button>
                <Button
                  onClick={handleBulkDelete}
                  variant="destructive"
                  size="sm"
                  className="flex items-center gap-2"
                >
                  <Trash2Icon className="w-4 h-4" />
                  Delete Selected
                </Button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Client Table */}
      <div className="bg-white rounded-lg border shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              {isAdmin && (
                <TableHead className="w-[50px]">
                  <Checkbox
                    checked={isAllSelected}
                    onCheckedChange={handleSelectAll}
                    disabled={isDeleting}
                    ref={(el) => {
                      if (el) {
                        (el as HTMLInputElement).indeterminate =
                          isIndeterminate;
                      }
                    }}
                  />
                </TableHead>
              )}
              <TableHead className="w-[200px]">Name</TableHead>
              <TableHead className="w-[200px]">Company</TableHead>
              <TableHead>Emails</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Location</TableHead>
              <TableHead className="w-[100px]">Status</TableHead>
              <TableHead className="w-[120px]">Tickets</TableHead>
              <TableHead className="w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell
                  colSpan={isAdmin ? 9 : 8}
                  className="text-center py-8"
                >
                  <div className="flex items-center justify-center gap-2">
                    <Loader2Icon className="w-4 h-4 animate-spin" />
                    <span>Loading clients...</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : allClients.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={isAdmin ? 9 : 8}
                  className="text-center py-8"
                >
                  <p className="text-gray-500">No clients found</p>
                  {isAdmin && (
                    <Button onClick={() => setShowForm(true)} className="mt-4">
                      Add your first client
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ) : (
              <>
                {allClients.map((client) => (
                  <TableRow
                    key={client.id}
                    className={`hover:bg-gray-50 ${
                      isDeleting && selectedClients.has(client.id)
                        ? "opacity-50 bg-red-50"
                        : !client.isActive
                        ? "opacity-60 bg-gray-50"
                        : ""
                    }`}
                  >
                    {isAdmin && (
                      <TableCell>
                        <Checkbox
                          checked={selectedClients.has(client.id)}
                          onCheckedChange={(checked) =>
                            handleSelectClient(client.id, checked as boolean)
                          }
                          disabled={isDeleting}
                        />
                      </TableCell>
                    )}
                    <TableCell className="font-medium">
                      <div>
                        <div className="font-semibold text-gray-900">
                          {client.name}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {client.companyName ? (
                        <span className="text-gray-700">
                          {client.companyName}
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {client.emails.slice(0, 2).map((email, index) => (
                          <Badge
                            key={index}
                            variant="secondary"
                            className="text-xs"
                          >
                            {email}
                          </Badge>
                        ))}
                        {client.emails.length > 2 && (
                          <Badge variant="outline" className="text-xs">
                            +{client.emails.length - 2} more
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {client.phone && client.phone.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {client.phone.slice(0, 2).map((phone, index) => (
                            <Badge
                              key={index}
                              variant="outline"
                              className="text-xs"
                            >
                              {phone}
                            </Badge>
                          ))}
                          {client.phone.length > 2 && (
                            <Badge variant="outline" className="text-xs">
                              +{client.phone.length - 2} more
                            </Badge>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {client.city || client.state || client.country ? (
                        <span className="text-gray-700">
                          {[client.city, client.state, client.country]
                            .filter(Boolean)
                            .join(", ")}
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-2 h-2 rounded-full ${
                            client.isActive ? "bg-green-500" : "bg-gray-400"
                          }`}
                        />
                        <Badge
                          variant={client.isActive ? "default" : "secondary"}
                          className="text-xs"
                        >
                          {client.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {client._count?.tickets || 0} tickets
                        </Badge>
                        {client._count?.tickets > 0 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleView(client.id)}
                            className="h-6 w-6 p-0 text-blue-600 hover:text-blue-700"
                          >
                            <EyeIcon className="w-3 h-3" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleView(client.id)}
                          disabled={isDeleting}
                          className="h-8 w-8 p-0"
                        >
                          <EyeIcon className="w-4 h-4" />
                        </Button>
                        {isAdmin && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(client)}
                              disabled={isDeleting || isUpdatingActive}
                              className="h-8 w-8 p-0"
                            >
                              <EditIcon className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleToggleActive(client)}
                              disabled={isDeleting || isUpdatingActive}
                              className={`h-8 w-8 p-0 ${
                                client.isActive
                                  ? "text-green-600 hover:text-green-700"
                                  : "text-gray-600 hover:text-gray-700"
                              }`}
                              title={
                                client.isActive
                                  ? "Deactivate client"
                                  : "Activate client"
                              }
                            >
                              <div
                                className={`w-3 h-3 rounded-full ${
                                  client.isActive
                                    ? "bg-green-500"
                                    : "bg-gray-400"
                                }`}
                              />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(client.id)}
                              disabled={isDeleting}
                              className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                            >
                              <TrashIcon className="w-4 h-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </>
            )}
          </TableBody>
        </Table>

        {/* Load More Button */}
        {hasNextPage && (
          <div className="flex justify-center p-4 border-t">
            <Button
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
              variant="outline"
              className="flex items-center gap-2"
            >
              {isFetchingNextPage ? (
                <>
                  <Loader2Icon className="w-4 h-4 animate-spin" />
                  Loading...
                </>
              ) : (
                "Load More"
              )}
            </Button>
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Client</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this client? This action cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Delete Confirmation Dialog */}
      <Dialog
        open={showBulkDeleteDialog}
        onOpenChange={setShowBulkDeleteDialog}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Multiple Clients</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {selectedClients.size} selected
              client{selectedClients.size > 1 ? "s" : ""}? This action cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowBulkDeleteDialog(false)}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmBulkDelete}>
              Delete {selectedClients.size} Client
              {selectedClients.size > 1 ? "s" : ""}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
