"use client";

import { useState } from "react";
import { trpc } from "@/app/_trpc/client";
import { Button } from "@/components/ui/button";
import { useSession } from "next-auth/react";

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

  const { data: users, refetch } = trpc.user.getAll.useQuery(undefined, {
    enabled: !!session, // Only run if user is authenticated
  });
  const { data: currentUser } = trpc.user.getCurrent.useQuery(undefined, {
    enabled: !!session, // Only run if user is authenticated
  });

  const createMutation = trpc.user.create.useMutation({
    onSuccess: () => {
      refetch();
      setNewUser({ email: "", name: "", password: "", role: "USER" });
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
      <div className="bg-white rounded-lg shadow p-6">
        <div className="text-center text-gray-600">Loading...</div>
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

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-semibold mb-6">User Management</h2>

      {/* Create new user */}
      <div className="mb-6 p-4 border rounded-lg">
        <h3 className="text-lg font-medium mb-4">Create New User</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <input
            type="email"
            placeholder="Email"
            className="px-3 py-2 border border-gray-300 rounded-md"
            value={newUser.email}
            onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
          />
          <input
            type="text"
            placeholder="Name"
            className="px-3 py-2 border border-gray-300 rounded-md"
            value={newUser.name}
            onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
          />
          <input
            type="password"
            placeholder="Password"
            className="px-3 py-2 border border-gray-300 rounded-md"
            value={newUser.password}
            onChange={(e) =>
              setNewUser({ ...newUser, password: e.target.value })
            }
          />
          <select
            className="px-3 py-2 border border-gray-300 rounded-md"
            value={newUser.role}
            onChange={(e) =>
              setNewUser({
                ...newUser,
                role: e.target.value as "ADMIN" | "USER",
              })
            }
          >
            <option value="USER">User</option>
            <option value="ADMIN">Admin</option>
          </select>
        </div>
        <Button
          onClick={handleCreate}
          disabled={
            !newUser.email.trim() ||
            !newUser.name.trim() ||
            !newUser.password.trim() ||
            createMutation.isPending
          }
          className="w-full"
        >
          {createMutation.isPending ? "Creating..." : "Create User"}
        </Button>
      </div>

      {/* User list */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium">Existing Users</h3>
        {users?.map((user) => (
          <div
            key={user.id}
            className="flex items-center justify-between p-4 border rounded-lg"
          >
            <div className="flex-1">
              <div className="font-medium">{user.name}</div>
              <div className="text-sm text-gray-600">{user.email}</div>
              <div className="text-xs text-gray-500">
                Role: {user.role} | Tickets: {user._count.assignedTickets}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {editingUser?.id === user.id ? (
                <>
                  <input
                    type="text"
                    value={editingUser.name}
                    onChange={(e) =>
                      setEditingUser({ ...editingUser, name: e.target.value })
                    }
                    className="px-3 py-1 border border-gray-300 rounded-md"
                  />
                  <select
                    className="px-3 py-1 border border-gray-300 rounded-md"
                    value={editingUser.role}
                    onChange={(e) =>
                      setEditingUser({
                        ...editingUser,
                        role: e.target.value as "ADMIN" | "USER",
                      })
                    }
                  >
                    <option value="USER">User</option>
                    <option value="ADMIN">Admin</option>
                  </select>
                  <Button
                    onClick={handleUpdate}
                    disabled={updateMutation.isPending}
                    size="sm"
                  >
                    {updateMutation.isPending ? "Saving..." : "Save"}
                  </Button>
                  <Button
                    onClick={() => setEditingUser(null)}
                    variant="outline"
                    size="sm"
                  >
                    Cancel
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    onClick={() => startEdit(user)}
                    variant="outline"
                    size="sm"
                  >
                    Edit
                  </Button>
                  {user.id !== currentUser?.id && (
                    <Button
                      onClick={() => handleDelete(user.id)}
                      variant="outline"
                      size="sm"
                      className="text-red-600 hover:text-red-700"
                    >
                      Delete
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {users?.length === 0 && (
        <div className="text-center py-8 text-gray-500">No users found.</div>
      )}
    </div>
  );
}
