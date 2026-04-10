import React, { useEffect, useState } from 'react';
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
import { assistantsApi } from '@/lib/api';

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
  const [assistant, setAssistant] = useState(null);
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    let isMounted = true;

    assistantsApi
      .getAssistant(assistantId)
      .then((res) => {
        const data = res?.data || res;
        if (!isMounted) return;
        setAssistant(data);
        setLoadError(null);
      })
      .catch((err) => {
        if (!isMounted) return;
        setLoadError(
          err?.status === 404
            ? 'This assistant could not be found. Showing a placeholder instead.'
            : err?.message || 'Failed to load assistant. Showing a placeholder instead.',
        );
        setAssistant({
          id: assistantId,
          name: 'Assistant',
          tagline: 'Custom clone',
          description: 'A custom assistant in the Agent Marketplace.',
          category: 'General',
          visibility: 'public',
          rating: 5,
          chatsCount: 0,
          tags: ['assistant'],
        });
      });

    return () => {
      isMounted = false;
    };
  }, [assistantId]);

  if (!assistant) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col">
        <main className="flex-1 container mx-auto px-4 py-8 max-w-4xl">
          <p className="text-sm text-muted-foreground">Loading assistant…</p>
        </main>
      </div>
    );
  }

  const initials = getInitials(assistant.name || 'Assistant');

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <main className="flex-1 container mx-auto px-4 py-8 max-w-4xl">
        {loadError && (
          <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
            {loadError}
          </div>
        )}

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
                  {assistant.name}
                </CardTitle>
                {assistant.status && (
                  <Badge
                    variant={
                      assistant.status === 'published' ? 'default' : 'secondary'
                    }
                  >
                    {assistant.status}
                  </Badge>
                )}
                {assistant.category && (
                  <Badge variant="secondary">{assistant.category}</Badge>
                )}
                {assistant.visibility && (
                  <Badge variant="outline">{assistant.visibility}</Badge>
                )}
              </div>
              {assistant.tagline && (
                <CardDescription className="text-sm">
                  {assistant.tagline}
                </CardDescription>
              )}
              <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                {typeof assistant.rating === 'number' && (
                  <span>⭐ {assistant.rating.toFixed(1)} rating</span>
                )}
                {typeof assistant.chatsCount === 'number' && (
                  <span>{assistant.chatsCount} chats</span>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground leading-relaxed">
              {assistant.description}
            </p>
            {Array.isArray(assistant.tags) && assistant.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 text-xs">
                {assistant.tags.map((tag) => (
                  <Badge key={tag} variant="outline">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
            <div className="mt-2 flex flex-wrap gap-3">
              <Button asChild>
                <Link to={`/assistants/${assistant.id}/chat`}>
                  Chat with this clone
                </Link>
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
                  /assistants/{assistant.id}
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
