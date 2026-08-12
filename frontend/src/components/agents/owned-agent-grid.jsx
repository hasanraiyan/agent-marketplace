"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bot,
  Edit,
  Globe,
  Lock,
  MessageSquare,
  MoreVertical,
  Play,
  Shield,
  Sparkles,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TiltCard } from "@/components/ui/tilt-card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export const VISIBILITY_CONFIG = {
  public: { variant: "default", icon: Globe, label: "Public" },
  unlisted: { variant: "secondary", icon: Shield, label: "Unlisted" },
  private: { variant: "outline", icon: Lock, label: "Private" },
};

/**
 * Grid of agents the signed-in user owns.
 *
 * Shared by the consumer dashboard ("My Agents") and Agent Studio so both
 * surfaces render identical cards while pointing at different destinations:
 * the dashboard opens a chat, Studio opens the agent workspace.
 *
 * @param {object[]} agents      already-filtered agents to render
 * @param {(id: string) => string} openHref   card click + primary button target
 * @param {(id: string) => string} editHref   "Edit" menu target
 * @param {(agent: object) => void} onDelete  opens the caller's confirm dialog
 */
export function OwnedAgentGrid({
  agents,
  openHref,
  editHref,
  onDelete,
  primaryLabel = "Launch",
  primaryIcon: PrimaryIcon = Play,
  primaryIconClassName = "fill-current",
  editLabel = "Edit Details",
}) {
  const router = useRouter();

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {agents.map((agent) => {
        const agentId = agent.id || agent._id;
        const visibility =
          VISIBILITY_CONFIG[agent.visibility] || VISIBILITY_CONFIG.private;
        const displayAvatar = agent.avatarUrl || agent.avatar;

        return (
          <TiltCard
            key={agentId}
            onClick={() => router.push(openHref(agentId))}
            className="group flex flex-col overflow-hidden rounded-[24px] sm:rounded-[32px] h-[300px] sm:h-[360px] bg-zinc-950 border border-white/10 transition-colors hover:border-white/20 cursor-pointer"
          >
            {/* Photo Background */}
            {displayAvatar ? (
              <img
                src={displayAvatar}
                alt={agent.name}
                className="absolute inset-0 size-full object-cover transition-transform duration-700 group-hover:scale-105"
              />
            ) : (
              <div className="absolute inset-0 flex size-full items-center justify-center bg-gradient-to-br from-zinc-800 to-zinc-950">
                <Bot className="size-16 text-zinc-600" />
              </div>
            )}

            {/* Gradient Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-transparent z-10" />

            {/* Top Overlay Area (Badges + Actions) */}
            <div className="absolute top-4 left-4 right-4 z-20 flex items-center justify-between">
              <div className="flex gap-1.5">
                {agent.isMainAgent && (
                  <Badge
                    variant="secondary"
                    className="bg-[#1E60FF]/90 text-white backdrop-blur-md border border-white/10 px-2.5 py-0.5 text-[9px] uppercase tracking-wider font-extrabold flex items-center gap-1"
                  >
                    <Sparkles className="size-2.5" />
                    Main Clone
                  </Badge>
                )}
                <Badge
                  variant="secondary"
                  className="bg-black/40 text-white backdrop-blur-md border border-white/10 px-2.5 py-0.5 text-[9px] uppercase tracking-wider font-extrabold"
                >
                  {agent.category || "other"}
                </Badge>
                <Badge
                  variant={visibility.variant}
                  className="bg-black/40 text-white backdrop-blur-md border border-white/10 px-2.5 py-0.5 text-[9px] uppercase tracking-wider font-extrabold flex items-center gap-1"
                >
                  <visibility.icon className="size-2.5" />
                  {visibility.label}
                </Badge>
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="size-7 rounded-full bg-black/40 hover:bg-black/60 text-white hover:text-white aria-expanded:bg-black/60 aria-expanded:text-white border border-white/10 backdrop-blur-md"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreVertical className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="rounded-xl shadow-md border-zinc-200"
                >
                  <Link href={editHref(agentId)}>
                    <DropdownMenuItem
                      className="cursor-pointer font-semibold text-xs py-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Edit className="mr-2 size-3.5 text-zinc-500" />{" "}
                      {editLabel}
                    </DropdownMenuItem>
                  </Link>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="cursor-pointer text-destructive focus:text-destructive font-semibold text-xs py-2"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(agent);
                    }}
                  >
                    <Trash2 className="mr-2 size-3.5" /> Delete Agent
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Bottom Content Area */}
            <div className="absolute bottom-4 sm:bottom-5 left-4 sm:left-5 right-4 sm:right-5 z-20 flex flex-col justify-end text-white select-none">
              <h3 className="font-display line-clamp-1 text-base sm:text-lg font-semibold tracking-tight leading-snug">
                {agent.name}
              </h3>
              <p className="mt-1 line-clamp-2 text-[11px] sm:text-xs text-white/70 leading-relaxed font-medium">
                {agent.description || "No description provided."}
              </p>

              <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-3">
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-white/50 uppercase tracking-tight">
                  <MessageSquare className="size-3.5" />
                  <span>{agent.messageCount || 0} chats</span>
                </div>

                <Link
                  href={openHref(agentId)}
                  onClick={(e) => e.stopPropagation()}
                >
                  <Button
                    size="xs"
                    className="h-7 px-3.5 text-[10px] font-bold uppercase tracking-tight rounded-full bg-white hover:bg-white/90 text-zinc-900 border-none shadow-sm active:scale-95 transition-all"
                  >
                    <PrimaryIcon
                      className={`mr-1 size-2.5 ${primaryIconClassName}`}
                    />
                    {primaryLabel}
                  </Button>
                </Link>
              </div>
            </div>
          </TiltCard>
        );
      })}
    </div>
  );
}
