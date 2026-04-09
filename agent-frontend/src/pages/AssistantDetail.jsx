import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { userClones } from '@/data/assistantsMock';

function getInitials(name) {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export default function AssistantDetail() {
  const { assistantId } = useParams();
  const clone = userClones.find((c) => c.id === assistantId);
  const data =
    clone || {
      id: assistantId,
      name: 'Assistant',
      tagline: 'Custom clone',
      description: 'A custom assistant in the Agent Marketplace.',
      category: 'General',
      visibility: 'Public',
      rating: 5,
      chats: '0',
      tags: ['assistant'],
    };

  const initials = getInitials(data.name);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <main className="flex-1 container mx-auto px-4 py-8 max-w-4xl">
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="mb-4 px-0 text-xs text-muted-foreground"
        >
          <Link to="/dashboard">← Back to dashboard</Link>
        </Button>

        <Card className="mb-6">
          <CardHeader className="flex flex-row items-start gap-4">
            <Avatar className="h-12 w-12">
              <AvatarFallback className="text-sm">{initials}</AvatarFallback>
            </Avatar>
            <div className="flex-1 flex flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="text-xl font-semibold">
                  {data.name}
                </CardTitle>
                <Badge variant="secondary">{data.category}</Badge>
                <Badge variant="outline">{data.visibility}</Badge>
              </div>
              <CardDescription className="text-sm">{data.tagline}</CardDescription>
              <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                <span>⭐ {data.rating.toFixed(1)} rating</span>
                <span>{data.chats} chats</span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground leading-relaxed">
              {data.description}
            </p>
            <div className="flex flex-wrap gap-2 text-xs">
              {data.tags.map((tag) => (
                <Badge key={tag} variant="outline">
                  {tag}
                </Badge>
              ))}
            </div>
            <div className="mt-2 flex flex-wrap gap-3">
              <Button asChild>
                <Link to={`/assistants/${data.id}/chat`}>Chat with this clone</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Share</CardTitle>
            <CardDescription className="text-xs">
              Share this link so others can open this clone directly.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-2 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <code className="rounded-md bg-muted px-2 py-1 text-[11px]">
                  /assistants/{data.id}
                </code>
                <span className="text-muted-foreground">
                  (Copy & share this URL)
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
