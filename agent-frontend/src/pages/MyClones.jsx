import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { userClones } from '@/data/assistantsMock';

export default function MyClones() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <main className="flex-1 container mx-auto px-4 py-8 max-w-5xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">My Clones</h1>
            <p className="text-sm text-muted-foreground">
              Create, edit, and publish your personal assistants.
            </p>
          </div>
          <Button asChild>
            <Link to="/clones/new">+ New Clone</Link>
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {userClones.map((clone) => (
            <Card key={clone.id} className="flex flex-col h-full">
              <CardHeader>
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-base">{clone.name}</CardTitle>
                  <div className="flex items-center gap-1">
                    <Badge
                      variant={
                        clone.status === 'published' ? 'default' : 'secondary'
                      }
                    >
                      {clone.status === 'published' ? 'Published' : 'Draft'}
                    </Badge>
                    <Badge variant="outline">{clone.visibility}</Badge>
                  </div>
                </div>
                <CardDescription className="text-xs">
                  {clone.description}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-1" />
              <CardFooter className="flex items-center justify-between border-t pt-3">
                <div className="text-xs text-muted-foreground">
                  ID: {clone.id}
                </div>
                <div className="flex items-center gap-2">
                  {clone.status === 'published' && (
                    <Button size="sm" variant="ghost" asChild>
                      <Link to={`/assistants/${clone.id}`}>View page</Link>
                    </Button>
                  )}
                  <Button size="sm" variant="outline" asChild>
                    <Link to={`/clones/${clone.id}/edit`}>Edit</Link>
                  </Button>
                  <Button size="sm" variant="ghost" asChild>
                    <Link to={`/assistants/${clone.id}/chat`}>Open Chat</Link>
                  </Button>
                </div>
              </CardFooter>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}
