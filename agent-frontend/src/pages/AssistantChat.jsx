import React, { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { SendHorizontal, Plus, Mic, MoreVertical } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  SidebarProvider,
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarInset,
} from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';
import { userClones } from '@/data/assistantsMock';

const mockConversations = [
  { id: '1', title: 'Daily notes', assistantId: '1' },
  { id: '2', title: 'Fundraising strategy', assistantId: '2' },
];

const initialMessages = [
  {
    id: 1,
    role: 'assistant',
    content: "Hey! What's on the agenda today?",
  },
];

function getAssistantById(id) {
  return (
    userClones.find((a) => a.id === id) || {
      id,
      name: 'Assistant',
      initials: 'AI',
    }
  );
}

function AssistantChatSidebar({ activeAssistantId }) {
  const activeAssistant = getAssistantById(activeAssistantId);

  return (
    <SidebarProvider>
      <Sidebar side="left" variant="sidebar" collapsible="offcanvas">
        <SidebarHeader>
          <div className="flex flex-col gap-1 px-2">
            <span className="text-sm font-semibold">Chat</span>
            <span className="text-xs text-muted-foreground">
              {activeAssistant.name}
            </span>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <Button className="w-full mb-2" size="sm" variant="outline">
              New chat
            </Button>
          </SidebarGroup>
          <SidebarGroup>
            <SidebarGroupLabel className="text-xs text-muted-foreground">
              Recent
            </SidebarGroupLabel>
            <SidebarMenu>
              {mockConversations.map((c) => (
                <SidebarMenuItem key={c.id}>
                  <SidebarMenuButton
                    isActive={c.assistantId === activeAssistantId}
                    className="flex items-center gap-2 text-xs"
                  >
                    <Avatar className="h-6 w-6">
                      <AvatarFallback className="text-[10px]">
                        {getAssistantById(c.assistantId).initials}
                      </AvatarFallback>
                    </Avatar>
                    <span className="truncate">{c.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <div className="flex items-center justify-between px-2 text-[11px] text-muted-foreground">
            <span>Projects</span>
            <MoreVertical className="h-3 w-3" />
          </div>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <AssistantChatMain assistant={activeAssistant} />
      </SidebarInset>
    </SidebarProvider>
  );
}

function AssistantChatMain({ assistant }) {
  const [messages, setMessages] = useState(initialMessages);
  const [input, setInput] = useState('');

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed) return;

    setMessages((prev) => [
      ...prev,
      { id: prev.length + 1, role: 'user', content: trimmed },
    ]);
    setInput('');
  };

  const title = useMemo(
    () => assistant?.name || 'Assistant',
    [assistant?.name],
  );

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="flex items-center justify-between border-b px-6 py-3">
        <button className="flex items-center gap-2 text-sm font-medium">
          <Avatar className="h-7 w-7">
            <AvatarFallback className="text-xs">
              {assistant.initials}
            </AvatarFallback>
          </Avatar>
          <span>{title}</span>
        </button>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Button variant="ghost" size="icon-sm">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-4 py-6">
        {messages.length <= 1 ? (
          <div className="flex flex-col items-center gap-6 text-center max-w-xl">
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">
              What's on the agenda today?
            </h1>
            <ChatInput input={input} setInput={setInput} onSend={handleSend} />
          </div>
        ) : (
          <div className="flex h-full w-full max-w-3xl flex-col gap-4">
            <ScrollArea className="flex-1 rounded-3xl border bg-muted/30 p-4">
              <div className="flex flex-col gap-4">
                {messages.map((m) => (
                  <ChatMessage key={m.id} message={m} assistant={assistant} />
                ))}
              </div>
            </ScrollArea>
            <div className="mt-4 flex justify-center">
              <ChatInput input={input} setInput={setInput} onSend={handleSend} />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function ChatMessage({ message, assistant }) {
  const isUser = message.role === 'user';

  return (
    <div
      className={cn(
        'flex gap-3 text-sm',
        isUser ? 'justify-end' : 'justify-start',
      )}
    >
      {!isUser && (
        <Avatar className="h-7 w-7">
          <AvatarFallback className="text-xs">
            {assistant.initials}
          </AvatarFallback>
        </Avatar>
      )}
      <div
        className={cn(
          'max-w-[75%] rounded-2xl px-3 py-2 text-left',
          isUser
            ? 'bg-primary text-primary-foreground'
            : 'bg-muted text-foreground',
        )}
      >
        {message.content}
      </div>
      {isUser && (
        <Avatar className="h-7 w-7">
          <AvatarFallback className="text-xs">You</AvatarFallback>
        </Avatar>
      )}
    </div>
  );
}

function ChatInput({ input, setInput, onSend }) {
  return (
    <div className="w-full max-w-2xl rounded-full border bg-background/80 shadow-sm px-3 py-1.5 flex items-center gap-2">
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="rounded-full"
      >
        <Plus className="h-4 w-4" />
      </Button>
      <Textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Ask anything"
        rows={1}
        className="min-h-0 resize-none border-none shadow-none px-0 py-1 text-sm focus-visible:ring-0"
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            onSend();
          }
        }}
      />
      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="rounded-full"
        >
          <Mic className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          size="icon-sm"
          className="rounded-full bg-primary text-primary-foreground"
          onClick={onSend}
        >
          <SendHorizontal className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export default function AssistantChat() {
  const { assistantId } = useParams();
  const activeId = assistantId || '1';

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AssistantChatSidebar activeAssistantId={activeId} />
    </div>
  );
}
