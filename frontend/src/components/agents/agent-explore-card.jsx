import Link from "next/link";
import { BotIcon, MessageSquareIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function AgentExploreCard({ agent }) {
  const {
    _id,
    id,
    name,
    description,
    category,
    avatar,
    avatarUrl,
    tags = [],
    messageCount = 0,
  } = agent;

  const agentId = _id || id;
  const displayAvatar = avatarUrl || avatar;

  return (
    <Link
      href={`/dashboard/agents/${agentId}/run`}
      className="group block h-full"
    >
      <Card className="flex h-full flex-col gap-0 overflow-hidden p-0 ring-foreground/10 transition-all group-hover:shadow-lg group-hover:ring-primary/30">
        <div className="aspect-[4/3] w-full overflow-hidden bg-muted">
          {displayAvatar ? (
            <img
              src={displayAvatar}
              alt={name}
              className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="flex size-full items-center justify-center bg-gradient-to-br from-muted to-muted/50">
              <BotIcon className="size-14 text-muted-foreground/50" />
            </div>
          )}
        </div>

        <CardHeader className="gap-2 pt-4">
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="capitalize">
              {category || "other"}
            </Badge>
            <div className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
              <MessageSquareIcon className="size-3" />
              <span>{messageCount}</span>
            </div>
          </div>
          <CardTitle className="line-clamp-1 transition-colors group-hover:text-primary">
            {name}
          </CardTitle>
          <CardDescription className="line-clamp-2 min-h-[2.5rem]">
            {description || "No description"}
          </CardDescription>
        </CardHeader>

        <CardContent className="mt-auto pt-2 pb-4">
          {tags.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {tags.slice(0, 3).map((tag) => (
                <Badge key={tag} variant="outline" className="text-xs">
                  {tag}
                </Badge>
              ))}
              {tags.length > 3 && (
                <Badge variant="outline" className="text-xs">
                  +{tags.length - 3}
                </Badge>
              )}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </Link>
  );
}
