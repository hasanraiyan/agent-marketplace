"use client";

import React, { useState, useEffect } from "react";
import { ProviderList } from "./ProviderList";
import { getProviders } from "@/lib/api/providers";
import { toast } from "sonner";
import { useAuth } from "@clerk/nextjs";

export default function SettingsPage() {
  const { isLoaded, isSignedIn } = useAuth();
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchProviders = async () => {
    try {
      setLoading(true);
      const res = await getProviders();
      if (res.data && res.data.success) {
        setProviders(res.data.data);
      }
    } catch (err) {
      toast.error("Failed to fetch providers.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      fetchProviders();
    }
  }, [isLoaded, isSignedIn]);

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6 lg:p-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Manage your account settings and external integrations.
        </p>
      </div>

      <div className="flex flex-col gap-6">
        <section>
          <div className="mb-4">
            <h2 className="text-lg font-semibold tracking-tight">
              AI Providers
            </h2>
            <p className="text-sm text-muted-foreground">
              Configure OpenAI-compatible providers to power your AI models.
            </p>
          </div>
          {loading ? (
            <div className="text-sm text-muted-foreground">
              Loading providers...
            </div>
          ) : (
            <ProviderList providers={providers} onUpdate={fetchProviders} />
          )}
        </section>
      </div>
    </div>
  );
}
