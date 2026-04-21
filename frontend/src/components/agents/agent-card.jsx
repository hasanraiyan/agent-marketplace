import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Star, Users } from "lucide-react";

export function AgentCard({ agent }) {
  const {
    _id,
    name,
    description,
    category,
    rating = 0,
    reviewCount = 0,
    usageCount = 0,
    price = 0,
    tags = [],
  } = agent;

  const displayRating = Math.min(5, Math.max(0, rating));
  const stars = Array.from({ length: 5 }, (_, i) => i < Math.floor(displayRating));

  return (
    <Card className="flex flex-col overflow-hidden transition-all hover:shadow-lg">
      {/* Header with category badge */}
      <CardHeader className="pb-3">
        <div className="mb-2 flex items-start justify-between">
          <Badge variant="secondary" className="w-fit">
            {category || "Uncategorized"}
          </Badge>
          {price > 0 && (
            <Badge variant="outline" className="font-semibold">
              ${price}
            </Badge>
          )}
        </div>

        <Link href={`/agents/${_id}`} className="group">
          <CardTitle className="line-clamp-2 group-hover:text-primary transition-colors">
            {name}
          </CardTitle>
        </Link>

        <CardDescription className="line-clamp-2 mt-1">
          {description || "No description available"}
        </CardDescription>
      </CardHeader>

      {/* Tags */}
      <CardContent className="flex-1 pb-3">
        {tags && tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {tags.slice(0, 3).map((tag, idx) => (
              <Badge key={idx} variant="outline" className="text-xs">
                {tag}
              </Badge>
            ))}
            {tags.length > 3 && (
              <Badge variant="outline" className="text-xs">
                +{tags.length - 3}
              </Badge>
            )}
          </div>
        )}
      </CardContent>

      {/* Rating and Usage Stats */}
      <div className="border-t px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex gap-0.5">
              {stars.map((filled, idx) => (
                <Star
                  key={idx}
                  className={`h-3 w-3 ${
                    filled
                      ? "fill-yellow-400 text-yellow-400"
                      : "text-muted-foreground"
                  }`}
                />
              ))}
            </div>
            <span className="text-xs text-muted-foreground">
              ({reviewCount || 0})
            </span>
          </div>

          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Users className="h-3 w-3" />
            <span>{usageCount || 0}</span>
          </div>
        </div>
      </div>

      {/* Footer with CTA */}
      <CardFooter className="border-t pt-3">
        <Link href={`/agents/${_id}`} className="w-full">
          <Button variant="outline" className="w-full">
            View Details
          </Button>
        </Link>
      </CardFooter>
    </Card>
  );
}
