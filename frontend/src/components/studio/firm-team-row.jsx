"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import {
  ConciergeBellIcon,
  CpuIcon,
  Loader2Icon,
  SaveIcon,
  Settings2Icon,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Field, FieldLabel } from "@/components/ui/field";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { updateMyFirm, updateMyFirmTeamMember } from "@/lib/api/firms";
import { studioRoutes } from "@/lib/studio-routes";
import { useFirm } from "@/components/studio/firm-context";
import { AgentAvatar } from "@/components/studio/firm-primitives";

const FACING = [
  { value: "client", label: "Client-facing", hint: "Talks to clients" },
  { value: "internal", label: "Internal", hint: "Delegated to by other employees" },
  { value: "owner", label: "Owner-facing", hint: "Reports to you" },
];

const toRole = (agent) => ({
  title: agent.role?.title || "",
  mandate: agent.role?.mandate || "",
  facing: agent.role?.facing || "client",
});

export function FirmTeamRow({ agent, index, onChange, onRefresh }) {
  const { setFirm } = useFirm();
  const [role, setRole] = useState(() => toRole(agent));
  const [toggling, setToggling] = useState(false);
  const [savingRole, setSavingRole] = useState(false);
  const [settingDesk, setSettingDesk] = useState(false);

  useEffect(() => {
    setRole(toRole(agent));
  }, [agent]);

  const dirty =
    role.title !== (agent.role?.title || "") ||
    role.mandate !== (agent.role?.mandate || "") ||
    role.facing !== (agent.role?.facing || "client");

  const toggleMember = async (member) => {
    setToggling(true);
    try {
      const res = await updateMyFirmTeamMember(agent._id, { member });
      const updated = res.data?.data || {};
      onChange({
        ...agent,
        role: updated.role || agent.role,
        isMember: member,
        isFrontDesk: member ? agent.isFrontDesk : false,
      });
      toast.success(member ? `${agent.name} joined the firm` : `${agent.name} left the firm`);
      // Leaving clears the front desk on the backend; keep the firm in sync.
      if (!member && agent.isFrontDesk) onRefresh?.();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update employee");
    } finally {
      setToggling(false);
    }
  };

  const saveRole = async () => {
    setSavingRole(true);
    try {
      const res = await updateMyFirmTeamMember(agent._id, {
        role: {
          title: role.title.trim(),
          mandate: role.mandate.trim(),
          facing: role.facing,
        },
      });
      onChange({ ...agent, role: res.data?.data?.role || role });
      toast.success("Role saved");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save role");
    } finally {
      setSavingRole(false);
    }
  };

  const setFrontDesk = async () => {
    setSettingDesk(true);
    try {
      const res = await updateMyFirm({ frontDeskAgentId: agent._id });
      setFirm(res.data?.data);
      toast.success(`${agent.name} is now the front desk`);
      onRefresh?.();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to set front desk");
    } finally {
      setSettingDesk(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index, 8) * 0.04 }}
      className="flex flex-col gap-4 rounded-2xl border border-slate-150/70 bg-white p-4 dark:border-slate-850/60 dark:bg-slate-950/40"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <AgentAvatar agent={agent} className="size-11" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="truncate text-sm font-bold text-slate-900 dark:text-slate-100">
                {agent.name}
              </span>
              {agent.isFrontDesk ? (
                <span className="inline-flex h-5 items-center gap-1 rounded-full bg-[#1E60FF]/10 px-2 text-[10px] font-bold text-[#1E60FF]">
                  <ConciergeBellIcon className="size-3" />
                  Front desk
                </span>
              ) : null}
              {agent.isMember && agent.role?.title ? (
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  · {agent.role.title}
                </span>
              ) : null}
            </div>
            <p className="line-clamp-1 text-xs font-medium text-slate-500 dark:text-slate-400">
              {agent.description || "No description yet."}
            </p>
            <div className="mt-1 flex items-center gap-1 text-[11px] font-bold text-slate-400 dark:text-slate-500">
              <CpuIcon className="size-3" />
              {agent.skillCount || 0} skill{agent.skillCount === 1 ? "" : "s"}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
          <Link href={studioRoutes.agentBuild(agent._id)}>
            <Button variant="ghost" size="sm" className="rounded-full font-bold">
              <Settings2Icon />
              Configure agent
            </Button>
          </Link>
          <label className="flex items-center gap-2 rounded-full border border-slate-150/70 py-1.5 pr-2 pl-3 text-xs font-bold text-slate-700 dark:border-slate-850/60 dark:text-slate-300">
            Employee of the firm
            <Switch
              checked={Boolean(agent.isMember)}
              disabled={toggling}
              onCheckedChange={toggleMember}
            />
          </label>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {agent.isMember ? (
          <motion.div
            key="role"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="grid grid-cols-1 gap-4 border-t border-slate-150/70 pt-4 md:grid-cols-[1fr_180px] dark:border-slate-850/60">
              <Field>
                <FieldLabel htmlFor={`role-title-${agent._id}`}>Role title</FieldLabel>
                <Input
                  id={`role-title-${agent._id}`}
                  value={role.title}
                  onChange={(e) => setRole((r) => ({ ...r, title: e.target.value }))}
                  placeholder="Deck strategist"
                  maxLength={80}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor={`role-facing-${agent._id}`}>Facing</FieldLabel>
                <NativeSelect className="w-full">
                  <select
                    id={`role-facing-${agent._id}`}
                    value={role.facing}
                    onChange={(e) => setRole((r) => ({ ...r, facing: e.target.value }))}
                  >
                    {FACING.map((f) => (
                      <NativeSelectOption key={f.value} value={f.value}>
                        {f.label} — {f.hint}
                      </NativeSelectOption>
                    ))}
                  </select>
                </NativeSelect>
              </Field>
              <Field className="md:col-span-2">
                <FieldLabel htmlFor={`role-mandate-${agent._id}`}>Mandate</FieldLabel>
                <Textarea
                  id={`role-mandate-${agent._id}`}
                  value={role.mandate}
                  onChange={(e) => setRole((r) => ({ ...r, mandate: e.target.value }))}
                  rows={2}
                  maxLength={600}
                  placeholder="Owns the narrative and slide structure. Hands numbers to the analyst."
                />
              </Field>
              <div className="flex flex-wrap items-center gap-2 md:col-span-2">
                <Button
                  type="button"
                  size="sm"
                  disabled={!dirty || savingRole}
                  onClick={saveRole}
                  className="rounded-full px-4 font-bold"
                >
                  {savingRole ? <Loader2Icon className="animate-spin" /> : <SaveIcon />}
                  Save role
                </Button>
                {!agent.isFrontDesk ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={settingDesk}
                    onClick={setFrontDesk}
                    className="rounded-full font-bold"
                  >
                    {settingDesk ? <Loader2Icon className="animate-spin" /> : <ConciergeBellIcon />}
                    Set as front desk
                  </Button>
                ) : null}
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.div>
  );
}
