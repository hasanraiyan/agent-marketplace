import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { SendHorizontal, AlertCircle, CheckCircle2 } from 'lucide-react';
import { assistantsApi } from '@/lib/api';

export default function CloneBuilder() {
  const { id } = useParams();
  const isEditing = Boolean(id);
  const navigate = useNavigate();

  const [name, setName] = useState(
    isEditing ? 'Me (General Assistant)' : 'New Clone'
  );
  const [tagline, setTagline] = useState(
    'A helpful clone of myself for everyday tasks.'
  );
  const [description, setDescription] = useState(
    'I help with brainstorming, writing, and technical questions based on my experience.'
  );
  const [systemPrompt, setSystemPrompt] = useState(
    'You are a clone of the user. Answer as they would: direct, kind, and pragmatic.'
  );
  const [status, setStatus] = useState('draft');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(isEditing);
  const [loadError, setLoadError] = useState(null);
  const [saveError, setSaveError] = useState(null);
  const [saveSuccess, setSaveSuccess] = useState(null);

  useEffect(() => {
    if (!isEditing) return;

    let isMounted = true;

    setIsLoading(true);
    setLoadError(null);

    assistantsApi
      .getAssistant(id)
      .then((res) => {
        const data = res?.data || res;
        if (!isMounted || !data) return;
        setName(data.name || 'New Clone');
        setTagline(data.tagline || '');
        setDescription(data.description || '');
        setSystemPrompt(
          data.systemPrompt ||
            'You are a clone of the user. Answer as they would: direct, kind, and pragmatic.'
        );
        if (data.status) {
          setStatus(data.status);
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        setLoadError(err?.message || 'Failed to load clone details');
      })
      .finally(() => {
        if (!isMounted) return;
        setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [id, isEditing]);

  const initials = name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const upsertPayload = (nextStatus) => ({
    name,
    tagline,
    description,
    systemPrompt,
    status: nextStatus,
  });

  const handleSave = async () => {
    if (isSaving || isLoading) return;
    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(null);
    const nextStatus = 'draft';

    try {
      if (isEditing) {
        const res = await assistantsApi.updateAssistant(id, upsertPayload(nextStatus));
        const data = res?.data || res;
        if (data?.status) setStatus(data.status);
        setSaveSuccess('Draft saved successfully');
      } else {
        const res = await assistantsApi.createAssistant(upsertPayload(nextStatus));
        const data = res?.data || res;
        if (data?.id) {
          navigate(`/clones/${data.id}/edit`, { replace: true });
        }
      }
    } catch (err) {
      setSaveError(err?.message || 'Failed to save changes');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePublish = async () => {
    if (isSaving || isLoading) return;
    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(null);
    const nextStatus = 'published';

    try {
      if (isEditing) {
        const res = await assistantsApi.updateAssistant(id, {
          ...upsertPayload(nextStatus),
          visibility: 'public',
        });
        const data = res?.data || res;
        if (data?.status) setStatus(data.status);
        setSaveSuccess('Clone updated and published');
      } else {
        const res = await assistantsApi.createAssistant({
          ...upsertPayload(nextStatus),
          visibility: 'public',
        });
        const data = res?.data || res;
        if (data?.id) {
          navigate(`/clones/${data.id}/edit`, { replace: true });
        }
      }
    } catch (err) {
      setSaveError(err?.message || 'Failed to publish clone');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex h-[100dvh] w-full flex-col bg-background text-foreground">
      {/* Header */}
      <header className="flex h-16 shrink-0 items-center justify-between border-b px-6">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <h1 className="text-sm font-semibold text-foreground">
              {isEditing ? name : 'New Clone'}
            </h1>
            <Badge
              variant={status === 'published' ? 'default' : 'secondary'}
              className="h-5 px-2 text-[10px] uppercase tracking-wider"
            >
              {status}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground hidden md:block">
            Describe yourself and configure how this assistant should behave.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isEditing && (
            <Button size="sm" variant="ghost" asChild className="hidden md:flex">
              <Link to={`/assistants/${id}`}>View page</Link>
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handleSave}
            disabled={isSaving || isLoading}
          >
            Save draft
          </Button>
          <Button
            size="sm"
            onClick={handlePublish}
            disabled={isSaving || isLoading}
          >
            {status === 'published' ? 'Update' : 'Publish'}
          </Button>
        </div>
      </header>

      {/* Status Banners */}
      {loadError && (
        <div className="flex items-center gap-2 border-b border-destructive/20 bg-destructive/10 px-6 py-2.5 text-sm text-destructive">
          <AlertCircle className="size-4" />
          <p>{loadError}</p>
        </div>
      )}
      {saveError && (
        <div className="flex items-center gap-2 border-b border-destructive/20 bg-destructive/10 px-6 py-2.5 text-sm text-destructive">
          <AlertCircle className="size-4" />
          <p>{saveError}</p>
        </div>
      )}
      {saveSuccess && !saveError && (
        <div className="flex items-center gap-2 border-b border-emerald-500/20 bg-emerald-500/10 px-6 py-2.5 text-sm text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="size-4" />
          <p>{saveSuccess}</p>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex flex-1 overflow-hidden flex-col md:flex-row">
        {/* Left: Create / Configure */}
        <div className="flex w-full flex-col border-b md:w-1/2 md:border-b-0 md:border-r lg:w-[45%]">
          <Tabs defaultValue="create" className="flex flex-1 flex-col overflow-hidden">
            <div className="border-b px-4 pt-2">
              <TabsList className="h-12 w-full justify-start rounded-none border-none bg-transparent p-0">
                <TabsTrigger
                  value="create"
                  className="relative h-full rounded-none border-b-2 border-transparent bg-transparent px-4 pb-3 pt-2 font-medium text-muted-foreground shadow-none data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=active]:shadow-none"
                >
                  Create
                </TabsTrigger>
                <TabsTrigger
                  value="configure"
                  className="relative h-full rounded-none border-b-2 border-transparent bg-transparent px-4 pb-3 pt-2 font-medium text-muted-foreground shadow-none data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=active]:shadow-none"
                >
                  Configure
                </TabsTrigger>
              </TabsList>
            </div>

            <ScrollArea className="flex-1">
              <TabsContent value="create" className="m-0 flex flex-col gap-8 p-6">
                
                {/* AI Prompt Input (Disabled for now) */}
                <div className="flex flex-col gap-3 rounded-xl border bg-muted/30 p-4">
                  <div className="flex flex-col gap-1">
                    <span className="text-sm font-medium">Describe your clone</span>
                    <span className="text-xs text-muted-foreground">
                      Natural-language clone creation is coming soon.
                    </span>
                  </div>
                  <div className="relative mt-2">
                    <Textarea
                      disabled
                      placeholder="e.g. Make a software engineer who helps debug my code..."
                      className="min-h-[80px] resize-none bg-background pb-12 shadow-sm"
                    />
                    <div className="absolute bottom-2 right-2 flex items-center">
                      <Button size="icon" variant="secondary" disabled className="size-8 rounded-full">
                        <SendHorizontal className="size-4" />
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Manual Inputs */}
                <div className="flex flex-col gap-5">
                  <h3 className="text-sm font-semibold">Basics</h3>
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium">Name</label>
                    <Input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      disabled={isLoading || isSaving}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium">Short tagline</label>
                    <Input
                      value={tagline}
                      onChange={(e) => setTagline(e.target.value)}
                      disabled={isLoading || isSaving}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium">Description</label>
                    <Textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={3}
                      className="resize-none"
                      disabled={isLoading || isSaving}
                    />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="configure" className="m-0 flex flex-col gap-8 p-6">
                <div className="flex flex-col gap-3">
                  <h3 className="text-sm font-semibold">Behavior</h3>
                  <p className="text-sm text-muted-foreground">
                    Define how this clone should speak and act. Be specific about tone, format, and boundaries.
                  </p>
                  <Textarea
                    value={systemPrompt}
                    onChange={(e) => setSystemPrompt(e.target.value)}
                    rows={8}
                    className="resize-none"
                    disabled={isLoading || isSaving}
                  />
                </div>

                <div className="flex flex-col gap-3">
                  <h3 className="text-sm font-semibold">Knowledge</h3>
                  <p className="text-sm text-muted-foreground">
                    Connect documents or links that this clone should know about. (Placeholder for future integration.)
                  </p>
                  <Button variant="outline" className="w-fit" disabled>
                    Upload files
                  </Button>
                </div>

                <div className="flex flex-col gap-3 border-t pt-6">
                  <h3 className="text-sm font-semibold">Visibility</h3>
                  <p className="text-sm text-muted-foreground">
                    Control who can access this clone.
                  </p>
                  <div className="flex items-center gap-2 pt-1">
                    <Badge variant="default" className="cursor-pointer">Private</Badge>
                    <Badge variant="outline" className="cursor-not-allowed opacity-50">Unlisted</Badge>
                    <Badge variant="outline" className="cursor-not-allowed opacity-50">Public</Badge>
                  </div>
                </div>
              </TabsContent>
            </ScrollArea>
          </Tabs>
        </div>

        {/* Right: Preview */}
        <div className="flex w-full flex-col bg-muted/10 md:w-1/2 lg:w-[55%]">
          <div className="flex h-12 shrink-0 items-center justify-between border-b px-6 bg-background">
            <span className="text-sm font-medium">Preview</span>
            <span className="text-xs text-muted-foreground">Model: Auto</span>
          </div>

          <div className="flex flex-1 items-center justify-center p-6">
            {/* Live Chat Mockup */}
            <div className="flex h-full max-h-[600px] w-full max-w-md flex-col overflow-hidden rounded-2xl border bg-background shadow-sm">
              <div className="flex shrink-0 flex-col items-center gap-2 border-b bg-muted/20 px-6 py-8 text-center">
                <Avatar className="size-16 border bg-background shadow-sm">
                  <AvatarFallback className="text-lg">{initials}</AvatarFallback>
                </Avatar>
                <div className="flex flex-col gap-1 mt-2">
                  <span className="font-semibold">{name || 'New Clone'}</span>
                  <span className="text-sm text-muted-foreground px-4 text-balance">
                    {tagline || 'Configure a tagline to see it here.'}
                  </span>
                </div>
              </div>
              
              <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
                <div className="self-start max-w-[85%] rounded-2xl rounded-tl-sm bg-muted px-4 py-2.5 text-sm text-foreground">
                  Hi! I'm {name || 'your clone'}. {description ? `I can help with: ${description}` : 'How can I help you today?'}
                </div>
              </div>

              <div className="shrink-0 p-4 pt-2">
                <div className="flex items-center gap-2 rounded-full border bg-muted/30 px-4 py-2.5 text-sm text-muted-foreground">
                  Message {name ? name.split(' ')[0] : 'Clone'}...
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}