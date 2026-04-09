import React, { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { SendHorizontal } from 'lucide-react';

export default function CloneBuilder() {
  const { id } = useParams();
  const isEditing = Boolean(id);

  const [name, setName] = useState(
    isEditing ? 'Me (General Assistant)' : 'New Clone',
  );
  const [tagline, setTagline] = useState(
    'A helpful clone of myself for everyday tasks.',
  );
  const [description, setDescription] = useState(
    "I help with brainstorming, writing, and technical questions based on my experience.",
  );
  const [systemPrompt, setSystemPrompt] = useState(
    'You are a clone of the user. Answer as they would: direct, kind, and pragmatic.',
  );
  const [status, setStatus] = useState('draft');

  const initials = name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const handlePublish = () => {
    setStatus('published');
  };

  const handleSave = () => {
    // Placeholder: wire to backend later
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="flex items-center justify-between border-b px-6 py-3">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-medium">
              {isEditing ? name : 'New Clone'}
            </h1>
            <Badge
              variant={status === 'published' ? 'default' : 'secondary'}
            >
              {status === 'published' ? 'Published' : 'Draft'}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Describe yourself and configure how this assistant should behave.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleSave}>
            Save draft
          </Button>
          <Button size="sm" onClick={handlePublish}>
            {status === 'published' ? 'Update' : 'Publish'}
          </Button>
          {isEditing && (
            <Button size="sm" variant="ghost" asChild>
              <Link to={`/assistants/${id}`}>View page</Link>
            </Button>
          )}
        </div>
      </header>

      <main className="flex flex-1 flex-col md:flex-row">
        {/* Left: Create / Configure */}
        <div className="w-full md:w-1/2 border-b md:border-b-0 md:border-r flex flex-col">
          <Tabs defaultValue="create" className="flex-1 flex flex-col">
            <TabsList className="px-4 pt-4 pb-2 justify-start">
              <TabsTrigger value="create">Create</TabsTrigger>
              <TabsTrigger value="configure">Configure</TabsTrigger>
            </TabsList>

            <TabsContent value="create" className="flex-1 px-4 pb-4 pt-2">
              <Card className="h-full flex flex-col">
                <CardHeader>
                  <CardTitle className="text-sm font-medium">
                    Describe your clone
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Hi! I&apos;ll help you build a new assistant. You can say
                    something like, &quot;make a creative who helps generate
                    visuals for new products&quot; or &quot;make a software engineer
                    who helps debug my code.&quot;
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-4 flex-1">
                  <div className="flex-1 rounded-2xl border bg-muted/30 p-3 flex flex-col justify-between gap-3">
                    <p className="text-xs text-muted-foreground">
                      What would you like to make?
                    </p>
                    <div className="flex items-center gap-2 rounded-full border bg-background px-3 py-1.5 mt-auto">
                      <Textarea
                        rows={1}
                        placeholder="Describe the assistant you want to build"
                        className="min-h-0 resize-none border-none shadow-none px-0 py-1 text-xs focus-visible:ring-0"
                      />
                      <Button
                        type="button"
                        size="icon-sm"
                        className="rounded-full"
                      >
                        <SendHorizontal className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <p className="text-xs font-medium text-muted-foreground">
                      Basics
                    </p>
                    <div className="space-y-2">
                      <label className="text-[11px] font-medium">Name</label>
                      <Input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="h-8 text-xs"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[11px] font-medium">
                        Short tagline
                      </label>
                      <Input
                        value={tagline}
                        onChange={(e) => setTagline(e.target.value)}
                        className="h-8 text-xs"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[11px] font-medium">
                        Description
                      </label>
                      <Textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        rows={3}
                        className="text-xs"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="configure" className="flex-1 px-4 pb-4 pt-2">
              <ScrollArea className="h-full rounded-xl border bg-muted/20 p-3">
                <div className="space-y-4 text-xs">
                  <div className="space-y-2">
                    <h2 className="text-[13px] font-medium">Behavior</h2>
                    <p className="text-xs text-muted-foreground">
                      Define how this clone should speak and act.
                    </p>
                    <Textarea
                      value={systemPrompt}
                      onChange={(e) => setSystemPrompt(e.target.value)}
                      rows={5}
                      className="text-xs"
                    />
                  </div>

                  <div className="space-y-2">
                    <h2 className="text-[13px] font-medium">Knowledge</h2>
                    <p className="text-xs text-muted-foreground">
                      Connect documents or links that this clone should know
                      about. (Placeholder for future integration.)
                    </p>
                    <Button size="sm" variant="outline" disabled>
                      Upload files (coming soon)
                    </Button>
                  </div>

                  <div className="space-y-2">
                    <h2 className="text-[13px] font-medium">Visibility</h2>
                    <p className="text-xs text-muted-foreground">
                      Control who can access this clone. (UI only for now.)
                    </p>
                    <div className="flex gap-2">
                      <Badge variant="default">Private</Badge>
                      <Badge variant="outline">Unlisted</Badge>
                      <Badge variant="outline">Public</Badge>
                    </div>
                  </div>
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </div>

        {/* Right: Preview */}
        <div className="w-full md:w-1/2 flex flex-col">
          <div className="flex items-center justify-between border-b px-6 py-3">
            <div className="flex items-center gap-3">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="text-xs">{initials}</AvatarFallback>
              </Avatar>
              <div className="flex flex-col">
                <span className="text-sm font-medium">Preview</span>
                <span className="text-xs text-muted-foreground">
                  How your clone appears in chat.
                </span>
              </div>
            </div>
            <div className="text-xs text-muted-foreground">Model: Auto</div>
          </div>

          <div className="flex-1 flex items-center justify-center px-4 py-6">
            <Card className="w-full max-w-xl shadow-sm">
              <CardHeader className="flex flex-row items-center gap-3">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="text-xs">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col">
                  <CardTitle className="text-sm font-medium">{name}</CardTitle>
                  <CardDescription className="text-xs">{tagline}</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 pb-4">
                <div className="rounded-2xl border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                  Start by defining your clone. For example: &quot;Help me write
                  thoughtful product update emails in my tone.&quot;
                </div>
                <div className="rounded-full border bg-background/80 px-3 py-1.5 text-xs text-muted-foreground">
                  Ask anything
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
