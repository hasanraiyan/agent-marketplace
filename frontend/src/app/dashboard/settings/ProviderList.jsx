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
import { Badge } from "@/components/ui/badge";
import { Empty } from "@/components/ui/empty";

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
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <CardTitle>{provider.label}</CardTitle>
                  {provider.isDefault && (
                    <Badge variant="outline">Default</Badge>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => handleTestConnection(provider.id)}
                    title="Test Connection"
                  >
                    <PlayIcon />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => handleEdit(provider)}
                    title="Edit Provider"
                  >
                    <EditIcon />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => handleDelete(provider.id)}
                    title="Delete Provider"
                    className="text-destructive hover:text-destructive"
                  >
                    <TrashIcon />
                  </Button>
                </div>
              </div>
              <CardDescription className="truncate" title={provider.baseURL}>
                {provider.baseURL}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-1 text-sm">
                <p className="text-muted-foreground">Default Model</p>
                <p className="font-medium">{provider.defaultModel}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {providers.length === 0 && (
        <Empty
          title="No providers configured"
          description="Create your first AI provider to get started."
          action={
            <Button onClick={handleAddNew} variant="outline">
              Add your first provider
            </Button>
          }
        />
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
