import { Bot, Globe, EyeOff, Lock, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";

const VISIBILITY_ICONS = {
  public: Globe,
  unlisted: EyeOff,
  private: Lock,
};

export default function AgentOverviewCard({ agent, isOwner }) {
  const VisibilityIcon = VISIBILITY_ICONS[agent.visibility] || Globe;
  const rating = Math.min(5, Math.max(0, agent.rating || 0));
  const stars = Array.from({ length: 5 }, (_, i) => i < Math.floor(rating));

  return (
    <Card className="overflow-hidden border-none bg-card ring-1 ring-foreground/10 relative">
      <CardContent className="relative px-6 py-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-5">
          <Avatar className="size-20 ring-1 ring-foreground/5 rounded-full bg-card shrink-0">
            <AvatarImage
              src={agent.avatarUrl || agent.avatar}
              alt={agent.name}
            />
            <AvatarFallback className="bg-gradient-to-br from-primary/10 to-primary/5 text-primary">
              <Bot className="size-10" />
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              <Badge
                variant="secondary"
                className="capitalize text-xs font-semibold px-2.5 py-0.5 bg-primary/10 text-primary hover:bg-primary/15 border-none"
              >
                {agent.category || "other"}
              </Badge>
              <Badge
                variant="outline"
                className="capitalize text-xs font-semibold px-2.5 py-0.5 border-foreground/10 bg-background/50 flex items-center gap-1"
              >
                <VisibilityIcon className="size-3" />
                {agent.visibility || "public"}
              </Badge>
              {!agent.isActive && (
                <Badge
                  variant="destructive"
                  className="text-xs font-semibold px-2.5 py-0.5"
                >
                  Inactive
                </Badge>
              )}
            </div>

            <h2 className="text-2xl font-bold tracking-tight text-foreground truncate">
              {agent.name}
            </h2>

            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1 text-xs text-muted-foreground">
              <div className="flex gap-0.5 mr-1">
                {stars.map((filled, i) => (
                  <Star
                    key={i}
                    className={`size-3.5 ${
                      filled
                        ? "fill-yellow-400 text-yellow-400"
                        : "text-muted-foreground/30"
                    }`}
                  />
                ))}
              </div>
              <span>({agent.reviewCount || 0} reviews)</span>
              <span className="text-muted-foreground/30">•</span>
              <span>
                Created by{" "}
                <span className="font-semibold text-foreground">
                  {isOwner ? "You" : "Community Creator"}
                </span>
              </span>
            </div>
          </div>
        </div>

        <Separator className="my-5" />

        <div className="space-y-2">
          <h3 className="text-xs font-bold text-foreground/75 uppercase tracking-wider">
            About this agent
          </h3>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {agent.description || "No description provided."}
          </p>
        </div>

        {agent.tags && agent.tags.length > 0 && (
          <div className="mt-5 flex flex-wrap gap-1.5">
            {agent.tags.map((tag) => (
              <Badge
                key={tag}
                variant="outline"
                className="text-xs text-muted-foreground bg-muted/30 border-muted/50 rounded-full px-2.5 py-0.5 hover:bg-muted/50 transition-colors"
              >
                #{tag}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
