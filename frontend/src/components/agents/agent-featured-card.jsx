import Link from "next/link";
import { BotIcon, MessageSquareIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function AgentFeaturedCard({ agent }) {
  const {
    _id,
    id,
    name,
    description,
    category,
    avatar,
    avatarUrl,
    messageCount = 0,
  } = agent;

  const agentId = _id || id;
  const displayAvatar = avatarUrl || avatar;

  return (
    <Link href={`/agents/${agentId}`} className="group block h-full">
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl bg-muted ring-foreground/10 transition-all group-hover:shadow-xl group-hover:ring-primary/30">
        {/* Image */}
        {displayAvatar ? (
          <img
            src={displayAvatar}
            alt={name}
            className="size-full object-cover transition-transform duration-500 group-hover:scale-110"
          />
        ) : (
          <div className="flex size-full items-center justify-center bg-gradient-to-br from-muted to-muted/50">
            <BotIcon className="size-16 text-muted-foreground/50" />
          </div>
        )}

        {/* Overlay - Gradient for legibility */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-60 transition-opacity duration-300 group-hover:opacity-90" />

        {/* Category Badge - Always visible */}
        <div className="absolute top-3 left-3 z-10">
          <Badge className="bg-white/10 text-white backdrop-blur-md hover:bg-white/20 capitalize border-none">
            {category || "other"}
          </Badge>
        </div>

        {/* Content Reveal on Hover */}
        <div className="absolute inset-0 flex flex-col justify-end p-4 text-white">
          <div className="transition-transform duration-300 group-hover:-translate-y-2">
            <h3 className="text-lg font-bold leading-tight sm:text-xl line-clamp-1">
              {name}
            </h3>
            <div className="grid grid-rows-[0fr] transition-[grid-template-rows] duration-300 group-hover:grid-rows-[1fr]">
              <div className="overflow-hidden">
                <p className="mt-1 line-clamp-1 text-xs opacity-0 transition-opacity duration-300 group-hover:opacity-100 sm:text-sm">
                  {description || "No description"}
                </p>
                
                <div className="mt-3 flex items-center gap-3 opacity-0 transition-opacity duration-500 group-hover:opacity-100">
                    <div className="flex items-center gap-1.5 text-xs">
                        <MessageSquareIcon className="size-3.5" />
                        <span>{messageCount} chats</span>
                    </div>
                    <div className="h-1 w-1 rounded-full bg-white/40" />
                    <span className="text-xs font-medium text-primary-foreground">Try now →</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
