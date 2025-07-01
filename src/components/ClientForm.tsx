"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { XIcon, PlusIcon } from "lucide-react";
import { trpc } from "@/app/_trpc/client";

interface ClientFormProps {
  client?: {
    id: string;
    name: string;
    emails: string[];
    phone?: string[] | null;
    address?: string | null;
    city?: string | null;
    state?: string | null;
    country?: string | null;
    companyName?: string | null;
  } | null;
  onClose: () => void;
  isAdmin: boolean;
}

export function ClientForm({ client, onClose }: ClientFormProps) {
  const [formData, setFormData] = useState({
    name: "",
    emails: [""],
    phone: [""],
    address: "",
    city: "",
    state: "",
    country: "",
    companyName: "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const createMutation = trpc.client.create.useMutation({
    onSuccess: () => {
      onClose();
    },
  });

  const updateMutation = trpc.client.update.useMutation({
    onSuccess: () => {
      onClose();
    },
  });

  useEffect(() => {
    if (client) {
      setFormData({
        name: client.name || "",
        emails: client.emails?.length > 0 ? client.emails : [""],
        phone:
          Array.isArray(client.phone) && client.phone.length > 0
            ? client.phone
            : [""],
        address: client.address || "",
        city: client.city || "",
        state: client.state || "",
        country: client.country || "",
        companyName: client.companyName || "",
      });
    }
  }, [client]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = "Name is required";
    }

    const validEmails = formData.emails.filter((email) => email.trim());
    if (validEmails.length === 0) {
      newErrors.emails = "At least one email is required";
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const invalidEmails = validEmails.filter(
        (email) => !emailRegex.test(email)
      );
      if (invalidEmails.length > 0) {
        newErrors.emails = "Invalid email format";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    const submitData = {
      name: formData.name.trim(),
      emails: formData.emails.filter((email) => email.trim()),
      phone: formData.phone.filter((phone) => phone.trim()),
      address: formData.address.trim() || undefined,
      city: formData.city.trim() || undefined,
      state: formData.state.trim() || undefined,
      country: formData.country.trim() || undefined,
      companyName: formData.companyName.trim() || undefined,
    };

    try {
      if (client) {
        await updateMutation.mutateAsync({
          id: client.id,
          ...submitData,
        });
      } else {
        await createMutation.mutateAsync(submitData);
      }
    } catch (error) {
      console.error("Failed to save client:", error);
    }
  };

  const addEmail = () => {
    setFormData((prev) => ({
      ...prev,
      emails: [...prev.emails, ""],
    }));
  };

  const removeEmail = (index: number) => {
    if (formData.emails.length > 1) {
      setFormData((prev) => ({
        ...prev,
        emails: prev.emails.filter((_, i) => i !== index),
      }));
    }
  };

  const updateEmail = (index: number, value: string) => {
    setFormData((prev) => ({
      ...prev,
      emails: prev.emails.map((email, i) => (i === index ? value : email)),
    }));
  };

  const addPhone = () => {
    setFormData((prev) => ({
      ...prev,
      phone: [...prev.phone, ""],
    }));
  };

  const removePhone = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      phone: prev.phone.filter((_, i) => i !== index),
    }));
  };

  const updatePhone = (index: number, value: string) => {
    setFormData((prev) => ({
      ...prev,
      phone: prev.phone.map((phone, i) => (i === index ? value : phone)),
    }));
  };

  return (
    <div className="max-w-2xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>{client ? "Edit Client" : "Add New Client"}</span>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <XIcon className="w-4 h-4" />
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900">
                Basic Information
              </h3>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name *
                </label>
                <Input
                  value={formData.name}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, name: e.target.value }))
                  }
                  placeholder="Enter client name"
                  className={errors.name ? "border-red-500" : ""}
                />
                {errors.name && (
                  <p className="text-sm text-red-600 mt-1">{errors.name}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Company Name
                </label>
                <Input
                  value={formData.companyName}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      companyName: e.target.value,
                    }))
                  }
                  placeholder="Enter company name"
                />
              </div>
            </div>

            {/* Contact Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900">
                Contact Information
              </h3>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email Addresses *
                </label>
                <div className="space-y-2">
                  {formData.emails.map((email, index) => (
                    <div key={index} className="flex gap-2">
                      <Input
                        type="email"
                        value={email}
                        onChange={(e) => updateEmail(index, e.target.value)}
                        placeholder="Enter email address"
                        className="flex-1"
                      />
                      {formData.emails.length > 1 && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => removeEmail(index)}
                          className="px-2"
                        >
                          <XIcon className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addEmail}
                    className="flex items-center gap-2"
                  >
                    <PlusIcon className="w-4 h-4" />
                    Add Email
                  </Button>
                </div>
                {errors.emails && (
                  <p className="text-sm text-red-600 mt-1">{errors.emails}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Phone Numbers
                </label>
                <div className="space-y-2">
                  {formData.phone.map((phone, index) => (
                    <div key={index} className="flex gap-2">
                      <Input
                        type="tel"
                        value={phone}
                        onChange={(e) => updatePhone(index, e.target.value)}
                        placeholder="Enter phone number"
                        className="flex-1"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => removePhone(index)}
                        className="px-2"
                      >
                        <XIcon className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addPhone}
                    className="flex items-center gap-2"
                  >
                    <PlusIcon className="w-4 h-4" />
                    Add Phone
                  </Button>
                </div>
              </div>
            </div>

            {/* Address Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900">
                Address Information
              </h3>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Address
                </label>
                <Input
                  value={formData.address}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      address: e.target.value,
                    }))
                  }
                  placeholder="Enter street address"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    City
                  </label>
                  <Input
                    value={formData.city}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, city: e.target.value }))
                    }
                    placeholder="Enter city"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    State
                  </label>
                  <Input
                    value={formData.state}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        state: e.target.value,
                      }))
                    }
                    placeholder="Enter state"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Country
                  </label>
                  <Input
                    value={formData.country}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        country: e.target.value,
                      }))
                    }
                    placeholder="Enter country"
                  />
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {createMutation.isPending || updateMutation.isPending
                  ? "Saving..."
                  : client
                  ? "Update Client"
                  : "Create Client"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
