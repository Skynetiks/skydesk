"use client";

import { useState } from "react";
import { trpc } from "@/app/_trpc/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSession } from "next-auth/react";
import {
  Plus,
  User,
  Shield,
  Mail,
  Edit2,
  Trash2,
  Save,
  X,
  Users,
} from "lucide-react";

export function UserManagement() {
  const { data: session, status: sessionStatus } = useSession();
  const [newUser, setNewUser] = useState({
    email: "",
    name: "",
    password: "",
    role: "USER" as "ADMIN" | "USER",
  });
  const [editingUser, setEditingUser] = useState<{
    id: string;
    email: string;
    name: string;
    role: "ADMIN" | "USER";
  } | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);

  const { data: users, refetch } = trpc.user.getAll.useQuery(undefined, {
    enabled: !!session,
  });
  const { data: currentUser } = trpc.user.getCurrent.useQuery(undefined, {
    enabled: !!session,
  });

  const createMutation = trpc.user.create.useMutation({
    onSuccess: () => {
      refetch();
      setNewUser({ email: "", name: "", password: "", role: "USER" });
      setShowCreateForm(false);
    },
  });

  const updateMutation = trpc.user.update.useMutation({
    onSuccess: () => {
      refetch();
      setEditingUser(null);
    },
  });

  const deleteMutation = trpc.user.delete.useMutation({
    onSuccess: () => refetch(),
  });

  // Show loading state while session is loading
  if (sessionStatus === "loading") {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="p-6">
            <div className="text-center text-gray-600">Loading...</div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Don't show anything if not authenticated
  if (sessionStatus === "unauthenticated") {
    return null;
  }

  // Only show for admin users
  if (currentUser?.role !== "ADMIN") {
    return null;
  }

  const handleCreate = () => {
    if (!newUser.email || !newUser.name || !newUser.password) return;
    createMutation.mutate(newUser);
  };

  const handleUpdate = () => {
    if (!editingUser) return;
    updateMutation.mutate({
      id: editingUser.id,
      email: editingUser.email,
      name: editingUser.name,
      role: editingUser.role,
    });
  };

  const handleDelete = (userId: string) => {
    if (confirm("Are you sure you want to delete this user?")) {
      deleteMutation.mutate({ id: userId });
    }
  };

  const startEdit = (user: {
    id: string;
    email: string;
    name: string;
    role: "ADMIN" | "USER";
  }) => {
    setEditingUser({ ...user });
  };

  const resetForm = () => {
    setNewUser({ email: "", name: "", password: "", role: "USER" });
    setShowCreateForm(false);
  };

  return (
    <div className="space-y-6">
      {/* Create New User Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                <Plus className="w-5 h-5 text-white" />
              </div>
              <div>
                <CardTitle className="text-xl">Create New User</CardTitle>
                <CardDescription>
                  Add a new team member to the system
                </CardDescription>
              </div>
            </div>
            {!showCreateForm && (
              <Button onClick={() => setShowCreateForm(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Add User
              </Button>
            )}
          </div>
        </CardHeader>

        {showCreateForm && (
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label
                  htmlFor="email"
                  className="text-sm font-medium text-gray-700"
                >
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="user@company.com"
                    value={newUser.email}
                    onChange={(e) =>
                      setNewUser({ ...newUser, email: e.target.value })
                    }
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="name"
                  className="text-sm font-medium text-gray-700"
                >
                  Full Name
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    id="name"
                    type="text"
                    placeholder="John Doe"
                    value={newUser.name}
                    onChange={(e) =>
                      setNewUser({ ...newUser, name: e.target.value })
                    }
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="password"
                  className="text-sm font-medium text-gray-700"
                >
                  Password
                </label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={newUser.password}
                  onChange={(e) =>
                    setNewUser({ ...newUser, password: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="role"
                  className="text-sm font-medium text-gray-700"
                >
                  Role
                </label>
                <div className="relative">
                  <Shield className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Select
                    value={newUser.role}
                    onValueChange={(value) =>
                      setNewUser({
                        ...newUser,
                        role: value as "ADMIN" | "USER",
                      })
                    }
                  >
                    <SelectTrigger className="pl-10">
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USER">User</SelectItem>
                      <SelectItem value="ADMIN">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-4">
              <Button
                onClick={handleCreate}
                disabled={
                  !newUser.email.trim() ||
                  !newUser.name.trim() ||
                  !newUser.password.trim() ||
                  createMutation.isPending
                }
                className="flex-1"
              >
                {createMutation.isPending ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 mr-2" />
                    Create User
                  </>
                )}
              </Button>
              <Button variant="outline" onClick={resetForm}>
                <X className="w-4 h-4 mr-2" />
                Cancel
              </Button>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Existing Users Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-xl">Existing Users</CardTitle>
              <CardDescription>
                Manage team members and their permissions
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <div className="space-y-4">
            {users?.map((user) => (
              <div
                key={user.id}
                className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-4 flex-1">
                  <div className="w-10 h-10 bg-gradient-to-br from-gray-400 to-gray-600 rounded-full flex items-center justify-center">
                    <User className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-gray-900">
                        {user.name}
                      </h3>
                      <Badge
                        variant={
                          user.role === "ADMIN" ? "default" : "secondary"
                        }
                      >
                        {user.role}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <span className="flex items-center gap-1">
                        <Mail className="w-3 h-3" />
                        {user.email}
                      </span>
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3" />
                        {user._count.assignedTickets} tickets
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {editingUser?.id === user.id ? (
                    <>
                      <div className="flex items-center gap-2">
                        <Input
                          value={editingUser.name}
                          onChange={(e) =>
                            setEditingUser({
                              ...editingUser,
                              name: e.target.value,
                            })
                          }
                          className="w-32"
                        />
                        <Select
                          value={editingUser.role}
                          onValueChange={(value) =>
                            setEditingUser({
                              ...editingUser,
                              role: value as "ADMIN" | "USER",
                            })
                          }
                        >
                          <SelectTrigger className="w-24">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="USER">User</SelectItem>
                            <SelectItem value="ADMIN">Admin</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <Button
                        onClick={handleUpdate}
                        disabled={updateMutation.isPending}
                        size="sm"
                      >
                        {updateMutation.isPending ? (
                          <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <Save className="w-3 h-3" />
                        )}
                      </Button>
                      <Button
                        onClick={() => setEditingUser(null)}
                        variant="outline"
                        size="sm"
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        onClick={() => startEdit(user)}
                        variant="outline"
                        size="sm"
                      >
                        <Edit2 className="w-3 h-3 mr-1" />
                        Edit
                      </Button>
                      {user.id !== currentUser?.id && (
                        <Button
                          onClick={() => handleDelete(user.id)}
                          variant="outline"
                          size="sm"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>

          {users?.length === 0 && (
            <div className="text-center py-12">
              <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No users found
              </h3>
              <p className="text-gray-600">
                Get started by creating your first team member.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
