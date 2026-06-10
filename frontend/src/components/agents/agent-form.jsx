"use client";

import { useState, useEffect, useRef } from "react";
import { Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { getProviders, getProviderModels } from "@/lib/api/providers";
import { getMySkills } from "@/lib/api/skills";

// Modular Form Sections
import { AgentGeneralInfo } from "./form-sections/AgentGeneralInfo";
import { AgentModelSelector } from "./form-sections/AgentModelSelector";
import { AgentToolsSelector } from "./form-sections/AgentToolsSelector";
import { AgentInstructionInput } from "./form-sections/AgentInstructionInput";

const DEFAULT_FORM = {
  name: "",
  description: "",
  avatar: "",
  tags: [],
  skills: [],
  systemPrompt: "",
  providerId: "",
  modelName: "",
  webSearchEnabled: false,
  visibility: "private",
  category: "other",
  isActive: true,
};

export function AgentForm({
  mode = "create",
  initialData,
  onSave,
  loading: saving,
}) {
  const [providers, setProviders] = useState([]);
  const [loadingProviders, setLoadingProviders] = useState(true);
  const [models, setModels] = useState([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [tagsInput, setTagsInput] = useState("");
  const [availableSkills, setAvailableSkills] = useState([]);
  const [loadingSkills, setLoadingSkills] = useState(true);

  const [form, setForm] = useState(DEFAULT_FORM);

  // Explicit, mode-aware initialization: hydrate from initialData when editing,
  // reset to a clean slate when the form transitions back to create/empty. The
  // reset only fires on an actual mode/initialData change — never on mount or
  // effect replays — so it cannot clobber the async-loaded provider defaults.
  const prevInitRef = useRef({ mode, initialData });
  useEffect(() => {
    const prev = prevInitRef.current;
    const changed = prev.mode !== mode || prev.initialData !== initialData;
    prevInitRef.current = { mode, initialData };

    if (mode === "edit" && initialData) {
      setForm({
        name: initialData.name || "",
        description: initialData.description || "",
        avatar: initialData.avatar || "",
        tags: initialData.tags || [],
        skills: (initialData.skills || []).map((s) => s._id || s.id || s),
        systemPrompt: initialData.systemPrompt || "",
        providerId: initialData.providerId || "",
        modelName: initialData.modelName || "",
        webSearchEnabled: initialData.webSearchEnabled || false,
        visibility: initialData.visibility || "private",
        category: initialData.category || "other",
        isActive: initialData.isActive !== false,
      });
    } else if (changed) {
      setForm(DEFAULT_FORM);
    }
  }, [initialData, mode]);

  useEffect(() => {
    const loadSkills = async () => {
      try {
        const res = await getMySkills();
        setAvailableSkills(res.data?.data || []);
      } catch (err) {
        toast.error("Failed to load skills");
      } finally {
        setLoadingSkills(false);
      }
    };
    loadSkills();

    const loadProviders = async () => {
      try {
        const res = await getProviders();
        const list = res.data?.data || [];
        setProviders(list);

        // Use functional update to check the CURRENT providerId state
        setForm((prev) => {
          if (!prev.providerId && list.length > 0) {
            const defaultProvider = list.find((p) => p.isDefault) || list[0];
            return {
              ...prev,
              providerId: defaultProvider.id || defaultProvider._id,
              modelName: prev.modelName || defaultProvider.defaultModel || "",
            };
          }
          return prev;
        });
      } catch (err) {
        toast.error("Failed to load providers");
      } finally {
        setLoadingProviders(false);
      }
    };
    loadProviders();
  }, []);

  useEffect(() => {
    if (!form.providerId) {
      setModels([]);
      return;
    }
    const loadModels = async () => {
      setLoadingModels(true);
      try {
        const res = await getProviderModels(form.providerId);
        const fetched = res.data?.data?.models || res.data?.data || [];
        setModels(fetched);

        // If no model is selected yet, prefer the provider's default model
        // when it exists in the fetched list.
        setForm((prev) => {
          if (prev.modelName) return prev;
          const provider = providers.find(
            (p) => (p.id || p._id) === prev.providerId,
          );
          const defaultModel = provider?.defaultModel;
          if (defaultModel && fetched.some((m) => m.id === defaultModel)) {
            return { ...prev, modelName: defaultModel };
          }
          return prev;
        });
      } catch (err) {
        setModels([]);
      } finally {
        setLoadingModels(false);
      }
    };
    loadModels();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.providerId]);

  const update = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  // A model only makes sense for the provider it belongs to, so switching
  // providers clears the selection until the new model list loads.
  const changeProvider = (providerId) => {
    setForm((prev) => {
      if (prev.providerId === providerId) return prev;
      return { ...prev, providerId, modelName: "" };
    });
  };

  const addTag = (e) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      const tag = tagsInput.trim().replace(/,$/, "");
      if (tag && !form.tags.includes(tag) && form.tags.length < 10) {
        update("tags", [...form.tags, tag]);
      }
      setTagsInput("");
    }
  };

  const removeTag = (tag) => {
    update(
      "tags",
      form.tags.filter((t) => t !== tag),
    );
  };

  const toggleSkill = (skillId) => {
    const current = form.skills || [];
    if (current.includes(skillId)) {
      update(
        "skills",
        current.filter((id) => id !== skillId),
      );
    } else {
      update("skills", [...current, skillId]);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    // Clean up empty strings for optional fields
    const sanitized = { ...form };
    if (!sanitized.description) delete sanitized.description;
    if (!sanitized.avatar) delete sanitized.avatar;
    if (!sanitized.modelName) delete sanitized.modelName;
    if (sanitized.tags?.length === 0) delete sanitized.tags;

    onSave(sanitized);
  };

  const noProviders = !loadingProviders && providers.length === 0;
  const saveDisabled =
    saving || loadingProviders || loadingModels || !form.providerId;

  return (
    <form onSubmit={handleSubmit} className="space-y-10 pb-20">
      <AgentGeneralInfo
        form={form}
        update={update}
        tagsInput={tagsInput}
        setTagsInput={setTagsInput}
        addTag={addTag}
        removeTag={removeTag}
      />

      <AgentToolsSelector
        form={form}
        update={update}
        availableSkills={availableSkills}
        loadingSkills={loadingSkills}
        toggleSkill={toggleSkill}
      />

      <AgentInstructionInput form={form} update={update} />

      <AgentModelSelector
        form={form}
        update={update}
        changeProvider={changeProvider}
        providers={providers}
        loadingProviders={loadingProviders}
        models={models}
        loadingModels={loadingModels}
        noProviders={noProviders}
      />

      <div className="pt-6">
        <Button
          type="submit"
          className="w-full h-12 text-base font-bold shadow-lg shadow-primary/20"
          disabled={saveDisabled}
        >
          {saving ? (
            <Loader2 className="mr-2 size-5 animate-spin" />
          ) : (
            <Save className="mr-2 size-5" />
          )}
          Save configuration
        </Button>
      </div>
    </form>
  );
}
