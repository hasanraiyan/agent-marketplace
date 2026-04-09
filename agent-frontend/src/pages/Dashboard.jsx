import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarSeparator,
  SidebarInset,
  SidebarInput,
} from '@/components/ui/sidebar';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { assistantsApi } from '@/lib/api';

const fallbackTrendingClones = [
  {
    id: 'demo-1',
    initials: 'DA',
    name: 'Dan Abramov',
    role: 'Software Engineer',
    description:
      'Trained on talks, blogs, and tweets about React, UI patterns, and front-end architecture.',
    chats: '45k',
    rating: 4.9,
  },
  {
    id: 'demo-2',
    initials: 'LR',
    name: 'Lenny Rachitsky',
    role: 'Product Management Expert',
    description:
      'Ask anything about building products, growth, and careers in product management.',
    chats: '112k',
    rating: 5.0,
  },
  {
    id: 'demo-3',
    initials: 'AH',
    name: 'Alex Hormozi',
    role: 'Entrepreneur / Investor',
    description:
      'Focused on offers, sales, and scaling businesses with practical, no-fluff advice.',
    chats: '89k',
    rating: 4.8,
  },
];

const interactionTypes = [
  {
    id: 1,
    title: 'Resume Review',
    description:
      'Upload your resume and get actionable feedback from a hiring manager clone.',
  },
  {
    id: 2,
    title: 'Pitch Practice',
    description:
      'Practice your startup pitch against a VC-style expert clone.',
  },
  {
    id: 3,
    title: 'Code Pairing',
    description:
      'Debug tricky issues together with a senior engineer clone.',
  },
];

const creatorFeatures = [
  {
    id: 1,
    title: 'Connect Data',
    description:
      'Train your clone on Substack, Notion, Twitter, or uploaded PDFs.',
  },
  {
    id: 2,
    title: 'Define Personality',
    description:
      'Tune tone for professional, witty, direct, or empathetic conversations.',
  },
  {
    id: 3,
    title: 'Privacy Controls',
    description:
      'Keep your clone private, share via unlisted link, or go fully public.',
  },
  {
    id: 4,
    title: 'Monetize Access',
    description:
      'Charge a subscription for premium access to your expert clone.',
  },
];

const expertTabs = ['All Experts', 'Founders & VCs', 'Software Eng', 'Marketers', 'Designers', 'Coaches'];

const expertQuestions = [
  {
    id: 1,
    initials: 'PG',
    name: 'Paul Graham',
    role: 'Startup Wisdom',
    questions: [
      'How do I know if my idea is a tarpit?',
      "What does 'do things that do not scale' mean?",
      'How to find a good co-founder?',
    ],
  },
  {
    id: 2,
    initials: 'NN',
    name: 'Nielsen Norman',
    role: 'UX Research AI',
    questions: [
      'Are carousels bad for conversion?',
      'Review the UX flow of this checkout page.',
      'Best practices for mobile navigation menus?',
    ],
  },
  {
    id: 3,
    initials: 'AH',
    name: 'Andrew Huberman',
    role: 'Neuroscience Pro',
    questions: [
      'How to optimize my sleep schedule?',
      'What is the optimal morning routine for focus?',
      'Protocols for learning new skills faster.',
    ],
  },
];

const recentChats = [
  { id: 1, initials: 'PG', label: 'Paul Graham Clone', assistantId: '1' },
  { id: 2, initials: 'SD', label: 'Sarah (My Therapist)', assistantId: '2' },
  { id: 3, initials: 'ME', label: 'Me (Test Clone)', assistantId: '3' },
];

function DashboardSidebar() {
  return (
    <SidebarProvider>
      <Sidebar side="left" variant="sidebar" collapsible="offcanvas">
        <SidebarHeader>
          <div className="flex items-center justify-between px-1">
            <div className="flex flex-col">
              <span className="text-sm font-semibold">Me.ai</span>
              <span className="text-xs text-muted-foreground">Clone Console</span>
            </div>
          </div>
        </SidebarHeader>
        <SidebarContent>
           <SidebarGroup>
             <Button className="w-full mb-2" size="sm" asChild>
               <Link to="/clones/new">+ Clone Yourself</Link>
             </Button>
             <SidebarMenu>
               <SidebarMenuItem>
                 <SidebarMenuButton asChild isActive>
                   <Link to="/dashboard">Discover</Link>
                 </SidebarMenuButton>
               </SidebarMenuItem>
               <SidebarMenuItem>
                 <SidebarMenuButton asChild>
                   <Link to="/clones">My Clones</Link>
                 </SidebarMenuButton>
               </SidebarMenuItem>
             </SidebarMenu>
           </SidebarGroup>

          <SidebarSeparator />

          <SidebarGroup>
            <SidebarInput placeholder="Find people..." className="mb-2" />
            <SidebarGroupLabel className="text-xs text-muted-foreground">
              Recent Chats
            </SidebarGroupLabel>
            <SidebarMenu>
              {recentChats.map((chat) => (
                <SidebarMenuItem key={chat.id}>
                  <SidebarMenuButton
                    asChild
                    className="flex items-center gap-2"
                  >
                    <Link to={`/assistants/${chat.assistantId}/chat`}>
                      <Avatar className="h-6 w-6">
                        <AvatarFallback className="text-[10px]">
                          {chat.initials}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-xs">{chat.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <div className="flex items-center justify-between gap-2 px-1 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <Avatar className="h-6 w-6">
                <AvatarFallback className="text-[10px]">AZ</AvatarFallback>
              </Avatar>
              <div className="flex flex-col leading-tight">
                <span className="text-xs font-medium">AzureVole</span>
                <span className="text-[10px] text-muted-foreground">Free Plan</span>
              </div>
            </div>
          </div>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <DashboardMain />
      </SidebarInset>
    </SidebarProvider>
  );
}

function getInitials(name) {
  return (name || 'AI')
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function DashboardMain() {
  const [trendingClones, setTrendingClones] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    let isMounted = true;

    assistantsApi
      .listPublicAssistants({ page: 1, limit: 6 })
      .then((res) => {
        const data = res?.data || res;
        if (!isMounted) return;
        const items = data.assistants || [];
        setTrendingClones(items);
        setLoadError(null);
      })
      .catch((err) => {
        if (!isMounted) return;
        setTrendingClones([]);
        setLoadError(err?.message || 'Failed to load assistants');
      })
      .finally(() => {
        if (!isMounted) return;
        setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const clonesToShow = trendingClones.length ? trendingClones : fallbackTrendingClones;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <div className="flex-1 px-6 py-6 md:px-10 md:py-8">
        <div className="flex flex-col gap-6">
          <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">
                Discover Minds
              </h1>
              <p className="text-sm md:text-base text-muted-foreground">
                Talk to experts, creators, and professionals scaled by AI.
              </p>
            </div>
            <div className="w-full md:w-80">
              <Input placeholder="Search for a specific person..." className="h-9" />
            </div>
          </header>

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium text-muted-foreground">
                Trending Clones
              </h2>
              <Link
                to="/browse"
                className="text-xs font-medium text-primary hover:underline"
              >
                View all
              </Link>
            </div>
            {isLoading ? (
              <p className="text-xs text-muted-foreground">Loading assistants…</p>
            ) : loadError ? (
              <p className="text-xs text-destructive">
                {loadError} — showing example clones instead.
              </p>
            ) : null}

            <div className="grid gap-4 md:grid-cols-3 mt-2">
              {clonesToShow.map((clone) => {
                const isRealId = typeof clone.id === 'string' && clone.id.length === 24;

                return (
                  <Card key={clone.id} className="h-full">
                    <CardHeader className="flex flex-row items-start gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback>
                          {clone.initials || getInitials(clone.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <CardTitle className="text-sm font-semibold">
                          {clone.name}
                        </CardTitle>
                        <CardDescription className="text-xs">
                          {clone.role || clone.tagline}
                        </CardDescription>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {clone.description}
                      </p>
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                        <span>
                          {typeof clone.chatsCount === 'number'
                            ? `${clone.chatsCount} chats`
                            : clone.chats || ''}
                        </span>
                        {typeof clone.rating === 'number' && (
                          <span>⭐ {clone.rating.toFixed(1)}</span>
                        )}
                      </div>
                      <div className="flex justify-end">
                        {isRealId ? (
                          <Button size="sm" variant="outline" asChild>
                            <Link to={`/assistants/${clone.id}/chat`}>Chat</Link>
                          </Button>
                        ) : (
                          <Button size="sm" variant="outline" disabled>
                            Preview only
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-medium text-muted-foreground">
              Ways to Interact
            </h2>
            <div className="grid gap-4 md:grid-cols-3">
              {interactionTypes.map((item) => (
                <Card key={item.id} className="h-full">
                  <CardHeader>
                    <CardTitle className="text-sm font-semibold">
                      {item.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {item.description}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>

          <section className="space-y-4 pt-2">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-sm font-semibold">Scale Your Expertise</h2>
                <p className="text-xs text-muted-foreground">
                  Connect data, define personality, and control privacy for your clone.
                </p>
              </div>
              <button className="text-xs font-medium text-primary">Creator Features</button>
            </div>
            <div className="grid gap-3 md:grid-cols-4">
              {creatorFeatures.map((feature) => (
                <Card key={feature.id} size="sm">
                  <CardHeader>
                    <CardTitle className="text-sm font-semibold">
                      {feature.title}
                    </CardTitle>
                    <CardDescription className="text-xs">
                      {feature.description}
                    </CardDescription>
                  </CardHeader>
                </Card>
              ))}
            </div>
          </section>

          <section className="space-y-4 pb-4">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-sm font-semibold">Ask the Experts</h2>
                <p className="text-xs text-muted-foreground">
                  Start with a popular question or ask your own.
                </p>
              </div>
            </div>
            <Tabs defaultValue={expertTabs[0]} className="w-full">
              <TabsList className="w-full flex flex-wrap justify-start gap-1">
                {expertTabs.map((tab) => (
                  <TabsTrigger
                    key={tab}
                    value={tab}
                    className="px-3 py-1 text-xs"
                  >
                    {tab}
                  </TabsTrigger>
                ))}
              </TabsList>
              {expertTabs.map((tab) => (
                <TabsContent key={tab} value={tab} className="mt-4">
                  <div className="grid gap-4 md:grid-cols-3">
                    {expertQuestions.map((expert) => (
                      <Card key={expert.id} size="sm">
                        <CardHeader className="flex flex-row items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="text-xs">
                              {expert.initials}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <CardTitle className="text-xs font-semibold">
                              {expert.name}
                            </CardTitle>
                            <CardDescription className="text-[11px]">
                              {expert.role}
                            </CardDescription>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-2">
                          {expert.questions.map((q) => (
                            <button
                              key={q}
                              className={cn(
                                'w-full rounded-md border bg-background px-2 py-1 text-left text-[11px] text-muted-foreground hover:bg-muted',
                              )}
                            >
                              {q}
                            </button>
                          ))}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </TabsContent>
              ))}
            </Tabs>
          </section>
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <DashboardSidebar />
    </div>
  );
}
