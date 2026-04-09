import React, { useEffect, useMemo, useState } from 'react';
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
import { assistantsApi, chatApi } from '@/lib/api';

function getInitials(name) {
  return (name || 'AI')
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function AssistantChatSidebar({ activeAssistant, conversations, onNewChat, onSelectConversation, activeConversationId }) {

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
             <Button className="w-full mb-2" size="sm" variant="outline" onClick={onNewChat}>
               New chat
             </Button>
           </SidebarGroup>
           <SidebarGroup>
            <SidebarGroupLabel className="text-xs text-muted-foreground">
              Recent
            </SidebarGroupLabel>
             <SidebarMenu>
               {conversations.map((c) => (
                 <SidebarMenuItem key={c.id}>
                  <SidebarMenuButton
                    isActive={c.id === activeConversationId}
                     className="flex items-center gap-2 text-xs"
                    onClick={() => onSelectConversation(c.id)}
                  >
                    <Avatar className="h-6 w-6">
                      <AvatarFallback className="text-[10px]">
                        {getInitials(activeAssistant.name)}
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
         <AssistantChatMain
           assistant={activeAssistant}
           activeConversationId={activeConversationId}
           onNewChat={onNewChat}
         />
       </SidebarInset>
      </SidebarProvider>
  );
}

function AssistantChatMain({ assistant, activeConversationId, onNewChat }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');

  // Load messages when conversation changes
  useEffect(() => {
    if (!activeConversationId) {
      setMessages([]);
      return;
    }

    let isMounted = true;

    chatApi
      .listMessages(assistant.id, activeConversationId)
      .then((res) => {
        const data = res?.data || res;
        if (!isMounted) return;
        setMessages(data.messages || []);
      })
      .catch(() => {
        if (!isMounted) return;
        setMessages([]);
      });

    return () => {
      isMounted = false;
    };
  }, [assistant.id, activeConversationId]);

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    if (!activeConversationId) {
      // Auto-create conversation if none exists
      await onNewChat(trimmed);
      setInput('');
      return;
    }

    try {
      const res = await chatApi.sendMessage(assistant.id, activeConversationId, {
        content: trimmed,
      });
      const data = res?.data || res;
      const userMessage = data.userMessage || data?.userMessage;
      const assistantMessage = data.assistantMessage || data?.assistantMessage;

      setMessages((prev) => [
        ...prev,
        ...(userMessage ? [userMessage] : []),
        ...(assistantMessage ? [assistantMessage] : []),
      ]);
      setInput('');
    } catch {
      // keep existing messages on error
    }
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
              {getInitials(assistant.name)}
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
         {!activeConversationId && messages.length === 0 ? (
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
            {getInitials(assistant.name)}
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
  const [assistant, setAssistant] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [activeConversationId, setActiveConversationId] = useState(null);

  useEffect(() => {
    let isMounted = true;

    assistantsApi
      .getAssistant(assistantId)
      .then((res) => {
        const data = res?.data || res;
        if (!isMounted) return;
        setAssistant(data);
      })
      .catch(() => {
        if (!isMounted) return;
        setAssistant({ id: assistantId, name: 'Assistant' });
      });

    return () => {
      isMounted = false;
    };
  }, [assistantId]);

  useEffect(() => {
    if (!assistant) return;

    let isMounted = true;

    chatApi
      .listConversations(assistant.id)
      .then((res) => {
        const data = res?.data || res;
        if (!isMounted) return;
        setConversations(data.conversations || []);
        if (!activeConversationId && data.conversations?.[0]) {
          setActiveConversationId(data.conversations[0].id);
        }
      })
      .catch(() => {
        if (!isMounted) return;
        setConversations([]);
      });

    return () => {
      isMounted = false;
    };
  }, [assistant, activeConversationId]);

  const handleNewChat = async (initialMessage) => {
    if (!assistant) return;
    try {
      const res = await chatApi.createConversation(assistant.id, {});
      const data = res?.data || res;
      const conversation = data;
      setConversations((prev) => [conversation, ...prev]);
      setActiveConversationId(conversation.id);

      if (initialMessage) {
        await chatApi.sendMessage(assistant.id, conversation.id, {
          content: initialMessage,
        });
      }
    } catch {
      // ignore for now
    }
  };

  const handleSelectConversation = (conversationId) => {
    setActiveConversationId(conversationId);
  };

  if (!assistant) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading chat…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AssistantChatSidebar
        activeAssistant={assistant}
        conversations={conversations}
        activeConversationId={activeConversationId}
        onNewChat={handleNewChat}
        onSelectConversation={handleSelectConversation}
      />
    </div>
  );
}
