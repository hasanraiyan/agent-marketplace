"use client";

import React, { useState } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ProviderForm } from "./ProviderForm";
import { deleteProvider, testProviderConnection } from "@/lib/api/providers";
import { toast } from "sonner";
import { TrashIcon, EditIcon, CheckCircleIcon, PlayIcon } from "lucide-react";

export function ProviderList({ providers, onUpdate }) {
  const [editingProvider, setEditingProvider] = useState(null);
  const [isFormOpen, setIsFormOpen] = useState(false);

  const handleDelete = async (id) => {
    if (!confirm("Are you sure you want to delete this provider?")) return;
    try {
      await deleteProvider(id);
      toast.success("Provider deleted successfully");
      onUpdate();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to delete provider");
    }
  };

  const handleTestConnection = async (id) => {
    try {
      const res = await testProviderConnection(id);
      if (res.data && res.data.success) {
        toast.success(res.data.data.message || "Connection successful!");
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Connection failed");
    }
  };

  const handleEdit = (provider) => {
    setEditingProvider(provider);
    setIsFormOpen(true);
  };

  const handleAddNew = () => {
    setEditingProvider(null);
    setIsFormOpen(true);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button onClick={handleAddNew}>Add Provider</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {providers.map((provider) => (
          <Card key={provider.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  {provider.label}
                  {provider.isDefault && (
                    <CheckCircleIcon className="w-4 h-4 text-green-500" />
                  )}
                </CardTitle>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => handleTestConnection(provider.id)}
                    title="Test Connection"
                  >
                    <PlayIcon className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => handleEdit(provider)}
                    title="Edit Provider"
                  >
                    <EditIcon className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => handleDelete(provider.id)}
                    title="Delete Provider"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <CardDescription className="truncate" title={provider.baseURL}>
                {provider.baseURL}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-sm">
                <span className="text-muted-foreground mr-2">
                  Default Model:
                </span>
                <span className="font-medium">{provider.defaultModel}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {providers.length === 0 && (
        <div className="text-center p-8 border rounded-lg bg-muted/20">
          <p className="text-muted-foreground mb-4">
            No AI Providers configured.
          </p>
          <Button onClick={handleAddNew} variant="outline">
            Add your first provider
          </Button>
        </div>
      )}

      {isFormOpen && (
        <ProviderForm
          open={isFormOpen}
          onOpenChange={setIsFormOpen}
          provider={editingProvider}
          onSuccess={() => {
            setIsFormOpen(false);
            onUpdate();
          }}
        />
      )}
    </div>
  );
}
