'use client';

import { useEffect, useRef, useState } from 'react';
import {
  BotIcon,
  Loader2,
  Sparkles,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  AlertCircle,
  Wrench,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useAguiChat } from '@/lib/agui/use-agui-chat';
import { getSuggestedPrompts, tryParseJson } from './utils';
import { MessageBubble, ThinkingText, NewChatIcon } from './MessageBubble';
import { ToolTrace } from './ToolTrace';
import { ApprovalCard, ClarificationCard } from './ApprovalCard';
import { ChatComposer } from './ChatComposer';
import { toast } from 'sonner';

const PREMIUM_MINDS_DETAILS = {
  "moses moody": {
    tags: "NBA | Warriors | Arkansas",
    mindCount: "42.1K Mind",
    verified: true,
    description: [
      "I am Moses Moody, professional basketball player for the Golden State Warriors. Drafted in the first round of the 2021 NBA draft, I won an NBA championship with the Warriors in my rookie season.",
      "Ask me about shot mechanics, playing in the NBA, Steve Kerr's coaching, and my journey to the league."
    ],
    prompts: [
      "What's your training routine look like?",
      "How is it playing under Coach Steve Kerr?",
      "What was it like winning a championship in your rookie year?"
    ],
    socials: {
      x: "https://x.com/mosesmoody",
      linkedin: "https://linkedin.com",
      youtube: "https://youtube.com"
    }
  },
  "brian halligan": {
    tags: "HubSpot | Sequoia | MIT",
    mindCount: "26.4K Mind",
    verified: true,
    description: [
      "I am HubSpot's co-founder and was its long time CEO. Along that journey, I learned a lot about creating a category (inbound), going from an app to a platform, creating a remark-able culture, etc.",
      "Today, I spend a lot of my time building Sequoia's CEO practice. I have a community of CEOs, coach CEOs, and create content for CEOs (Long Strange Trip podcast). From HubSpot and communing with some of the world's best startup CEOs, I have a perspective on the job.",
      "Ask me anything you like."
    ],
    prompts: [
      "What are the best practices for a startup founder to evolve into a scale-up CEO?",
      "What are the biggest pitfalls on the CEOs journey from startup founder to scale-up CEO?",
      "How can I create my company's second act?"
    ],
    socials: {
      x: "https://x.com/bhalligan",
      linkedin: "https://linkedin.com/in/brianhalligan",
      youtube: "https://youtube.com"
    }
  },
  "emily mcdonald": {
    tags: "Neuroscientist | Brain Coach | @emonthebrain",
    mindCount: "38.9K Mind",
    verified: true,
    description: [
      "I am Emily McDonald, neuroscientist, brain coach, and content creator. I specialize in teaching people how to optimize their brain health, enhance mental focus, build positive cognitive habits, and use science-backed biohacking and mindfulness techniques to live a better life."
    ],
    prompts: [
      "How can I optimize my brain health today?",
      "What are the best habits to improve focus and productivity?",
      "Explain the neuroscience behind mindfulness."
    ],
    socials: {
      x: "https://x.com/emonthebrain",
      linkedin: "https://linkedin.com",
      youtube: "https://youtube.com"
    }
  },
  "ben greenfield": {
    tags: "Biohacker | Triathlete | Author",
    mindCount: "31.2K Mind",
    verified: true,
    description: [
      "I am Ben Greenfield, biohacker, human performance consultant, ex-bodybuilder, and triathlete. I focus on helping you optimize physical performance, longevity, sleep, nutrition, and deep wellness through scientific protocols, biohacking tools, and holistic health practices."
    ],
    prompts: [
      "What are the top biohacks for deep sleep?",
      "Can you recommend a longevity nutrition protocol?",
      "What are the best active recovery routines?"
    ],
    socials: {
      x: "https://x.com/bengreenfield",
      linkedin: "https://linkedin.com/in/ben-greenfield-8a032822",
      youtube: "https://youtube.com"
    }
  },
  "vanessa van edwards": {
    tags: "Author | Captivate | Science of People",
    mindCount: "53.4K Mind",
    verified: true,
    description: [
      "I am Vanessa Van Edwards, lead behavioral investigator at Science of People and author of the best-selling books 'Captivate' and 'Cues'. I teach people-skills, body language, charisma, and how to communicate effectively to build instant rapport and make unforgettable first impressions."
    ],
    prompts: [
      "How can I make a great first impression?",
      "What body language cues should I use in high-stakes negotiations?",
      "How do I build rapport quickly with new connections?"
    ],
    socials: {
      x: "https://x.com/vvanedwards",
      linkedin: "https://linkedin.com/in/vanessavanedwards",
      youtube: "https://youtube.com"
    }
  },
  "zack kass": {
    tags: "AI Futurist | OpenAI | Advisor",
    mindCount: "18.9K Mind",
    verified: true,
    description: [
      "I am Zack Kass, AI Futurist and former Head of Go-To-Market at OpenAI. I work with organizations to navigate the future of Artificial General Intelligence (AGI), build corporate AI strategies, and encourage human-centric adaptation that empowers society."
    ],
    prompts: [
      "How do we restore humanity in the age of AI?",
      "What are key strategies for corporate AI implementation?",
      "What does the road to AGI look like?"
    ],
    socials: {
      x: "https://x.com/zackkass",
      linkedin: "https://linkedin.com/in/zackkass",
      youtube: "https://youtube.com"
    }
  }
};

export function AguiAgentChat({
  agent,
  url,
  agentId,
  threadId,
  headers,
  initialMessages = [],
  initialState = {},
  title = 'Sage',
  emptyTitle = 'Sage',
  emptyDescription = 'Tell me what you want to build, change, or explore.',
  className,
  onToolResult,
  onStateChange,
  onCreateThread,
  onNewChat,
  onRunFinished,
  onTitleGenerated,
  showHeader = true,
  contentClassName,
}) {
  const [input, setInput] = useState('');
  const [resettingChat, setResettingChat] = useState(false);
  const scrollRef = useRef(null);
  const chat = useAguiChat({
    url,
    agentId,
    threadId,
    headers,
    initialMessages,
    initialState,
    onToolResult,
    onCreateThread,
    onRunFinished,
    onTitleGenerated,
  });

  const startNewChat = async () => {
    setInput('');
    if (!onNewChat) {
      chat.clear();
      return;
    }
    // Parent creates a fresh backend thread; local state resets when the
    // threadId prop changes. Fall back to a local clear only on failure.
    setResettingChat(true);
    try {
      await onNewChat();
    } catch (err) {
      console.error('Failed to start a new chat thread:', err);
      chat.clear();
    } finally {
      setResettingChat(false);
    }
  };

  useEffect(() => {
    onStateChange?.(chat.agentState);
  }, [chat.agentState, onStateChange]);

  useEffect(() => {
    if (!scrollRef.current || chat.conversation.length === 0) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  });

  const send = () => {
    const text = input;
    setInput('');
    chat.send(text);
  };

  const messageById = (messageId) =>
    chat.messages.find((message) => message.id === messageId);
  const toolById = (toolId) =>
    chat.toolCalls.find((tool) => tool.id === toolId);

  return (
    <div
      className={cn(
        'flex h-full min-h-0 flex-col bg-white dark:bg-slate-950',
        className,
      )}
    >
      {showHeader ? (
        <div className="flex h-14 shrink-0 items-center gap-3 border-b border-slate-200 px-5 dark:border-slate-800">
          <div className="flex size-8 items-center justify-center rounded-full bg-[#1E60FF]/10 text-[#1E60FF]">
            <Sparkles className="size-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-base font-semibold text-slate-950 dark:text-white">
              {title}
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-9 rounded-full"
            onClick={startNewChat}
            disabled={resettingChat}
            title="New Chat"
          >
            {resettingChat ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <NewChatIcon className="size-4" />
            )}
          </Button>
        </div>
      ) : null}

      <style dangerouslySetInnerHTML={{__html: `
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}} />

      <div
        ref={scrollRef}
        className={cn(
          "min-h-0 flex-1 overflow-y-auto px-4 py-5",
          chat.conversation.length === 0 && "no-scrollbar"
        )}
      >
        {chat.conversation.length === 0 &&
        !chat.pendingApproval &&
        !chat.pendingClarification ? (
          <div
            className={cn(
              'mx-auto flex w-full max-w-4xl flex-col justify-start px-6 pt-2 pb-8 text-left bg-white dark:bg-slate-950',
              contentClassName,
            )}
          >
            {(() => {
              const agentName = (agent?.name || "").toLowerCase();
              let details = {
                tags: agent?.tags?.join(' | ') || agent?.category || 'Agent',
                mindCount: '12.5K Mind',
                verified: false,
                description: [agent?.description || 'Ask this agent to work on your request.'],
                prompts: getSuggestedPrompts(agent).map(p => p.prompt),
                socials: {
                  x: "https://x.com",
                  linkedin: "https://linkedin.com",
                  youtube: "https://youtube.com"
                }
              };

              if (agentName.includes("moses") || agentName.includes("moody")) {
                details = PREMIUM_MINDS_DETAILS["moses moody"];
              } else if (agentName.includes("brian") || agentName.includes("halligan")) {
                details = PREMIUM_MINDS_DETAILS["brian halligan"];
              } else if (agentName.includes("emily") || agentName.includes("mcdonald")) {
                details = PREMIUM_MINDS_DETAILS["emily mcdonald"];
              } else if (agentName.includes("ben") || agentName.includes("greenfield")) {
                details = PREMIUM_MINDS_DETAILS["ben greenfield"];
              } else if (agentName.includes("vanessa")) {
                details = PREMIUM_MINDS_DETAILS["vanessa van edwards"];
              } else if (agentName.includes("zack") || agentName.includes("kass")) {
                details = PREMIUM_MINDS_DETAILS["zack kass"];
              }

              const handleShare = () => {
                if (typeof window !== "undefined") {
                  navigator.clipboard.writeText(window.location.href);
                  toast.success("Agent chat link copied!");
                }
              };

              return (
                <div className="flex flex-col items-start w-full">
                  {/* Top Row: Square Avatar + Share button */}
                  <div className="flex w-full items-start justify-between">
                    <div className="relative">
                      <img
                        src={agent?.avatarUrl || agent?.avatar}
                        alt={agent?.name || 'Agent'}
                        className="w-24 h-24 sm:w-28 sm:h-28 rounded-[28px] sm:rounded-[36px] object-cover border border-slate-150/80 dark:border-slate-800"
                      />
                    </div>

                    <button
                      onClick={handleShare}
                      className="flex items-center gap-1.5 rounded-full bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-900 dark:hover:bg-slate-800 px-4 py-2 text-xs font-bold text-slate-800 dark:text-slate-200 transition-colors cursor-pointer select-none border border-slate-200 dark:border-slate-800"
                    >
                      <svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="18" cy="5" r="3" />
                        <circle cx="6" cy="12" r="3" />
                        <circle cx="18" cy="19" r="3" />
                        <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                        <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                      </svg>
                      Share
                    </button>
                  </div>

                  {/* Name */}
                  <h1 className="text-3xl sm:text-4.5xl font-bold tracking-tight text-slate-900 dark:text-white mt-6">
                    {agent?.name || emptyTitle}
                  </h1>

                  {/* Meta Row: Verified Badge + Subtitle Tags + Mind Count */}
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 mt-3 text-xs sm:text-sm font-semibold text-slate-500 dark:text-slate-400">
                    {details.verified && (
                      <span className="inline-flex text-[#1E60FF] shrink-0" title="Verified Professional">
                        <svg className="size-4.5 fill-current" viewBox="0 0 24 24">
                          <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                        </svg>
                      </span>
                    )}
                    <span className="text-slate-700 dark:text-slate-350 font-bold">{details.tags}</span>
                    <span className="text-slate-300 dark:text-slate-800">|</span>
                    <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-500 font-bold">
                      <svg className="size-4 fill-emerald-500" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
                      </svg>
                      <span>{details.mindCount}</span>
                    </div>
                  </div>

                  {/* Description Paragraphs */}
                  <div className="mt-4 text-slate-650 dark:text-slate-350 text-[14.5px] sm:text-[15.5px] leading-relaxed space-y-3 font-medium max-w-4xl">
                    {details.description.map((para, i) => (
                      <p key={i}>{para}</p>
                    ))}
                  </div>

                  {/* Ask me about Card */}
                  <div className="bg-slate-50/80 dark:bg-slate-900/40 p-4 sm:p-5 rounded-3xl mt-5 w-full max-w-4xl border border-slate-100/60 dark:border-slate-900/60">
                    <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2.5 mb-4 select-none">
                      <svg className="size-5 text-slate-805 dark:text-slate-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                      Ask me about
                    </h3>
                    <div className="flex flex-col gap-2.5 items-start">
                      {details.prompts.map((promptText, i) => (
                        <button
                          key={i}
                          onClick={() => chat.send(promptText)}
                          className="text-left bg-white hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800/80 text-slate-800 dark:text-slate-200 px-5 py-2.5 rounded-full text-xs sm:text-[13.5px] font-semibold border border-slate-200 dark:border-slate-850 cursor-pointer transition-colors"
                        >
                          {promptText}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Social Follow */}
                  <div className="mt-6">
                    <p className="text-[13px] font-bold text-slate-450 dark:text-slate-500 select-none">
                      Follow {agent?.name || 'them'} for more...
                    </p>
                    <div className="flex items-center gap-2.5 mt-3.5">
                      <a
                        href={details.socials.x}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="size-9 rounded-full bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-900 dark:hover:bg-slate-850 flex items-center justify-center text-slate-800 dark:text-slate-200 transition-colors border border-transparent dark:border-slate-850"
                      >
                        <svg className="size-4 fill-current" viewBox="0 0 24 24">
                          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                        </svg>
                      </a>
                      <a
                        href={details.socials.linkedin}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="size-9 rounded-full bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-900 dark:hover:bg-slate-850 flex items-center justify-center text-slate-800 dark:text-slate-200 transition-colors border border-transparent dark:border-slate-850"
                      >
                        <svg className="size-4.5 fill-current" viewBox="0 0 24 24">
                          <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.779-1.75-1.75s.784-1.75 1.75-1.75 1.75.779 1.75 1.75-.784 1.75-1.75 1.75zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
                        </svg>
                      </a>
                      <a
                        href={details.socials.youtube}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="size-9 rounded-full bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-900 dark:hover:bg-slate-850 flex items-center justify-center text-slate-800 dark:text-slate-200 transition-colors border border-transparent dark:border-slate-850"
                      >
                        <svg className="size-4.5 fill-current" viewBox="0 0 24 24">
                          <path d="M23.498 6.163a3.003 3.003 0 0 0-2.11-2.11C19.517 3.545 12 3.545 12 3.545s-7.517 0-9.388.507a3.003 3.003 0 0 0-2.11 2.11C0 8.033 0 12 0 12s0 3.967.502 5.837a3.003 3.003 0 0 0 2.11 2.11c1.871.507 9.388.507 9.388.507s7.517 0 9.388-.507a3.003 3.003 0 0 0 2.11-2.11C24 15.967 24 12 24 12s0-3.967-.502-5.837zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                        </svg>
                      </a>
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="mt-10 pt-4 border-t border-slate-100 dark:border-slate-900 w-full text-[11.5px] font-semibold text-slate-450 dark:text-slate-600 select-none">
                    © 2026 {agent?.name || 'Agent'} • Terms • Privacy
                  </div>
                </div>
              );
            })()}
          </div>
        ) : (
          <div
            className={cn(
              'mx-auto w-full max-w-4xl space-y-4',
              contentClassName,
            )}
          >
            {(() => {
              const renderItems = [];
              let currentToolGroup = [];

              const flushToolGroup = () => {
                if (currentToolGroup.length > 0) {
                  renderItems.push({
                    type: 'tool_group',
                    id: `group-${currentToolGroup[0].id}`,
                    tools: [...currentToolGroup],
                  });
                  currentToolGroup = [];
                }
              };

              chat.conversation.forEach((entry) => {
                if (entry.type === 'message') {
                  flushToolGroup();
                  const message = messageById(entry.refId);
                  if (message) {
                    renderItems.push({
                      type: 'message',
                      id: entry.id,
                      data: message,
                    });
                  }
                } else if (entry.type === 'tool') {
                  const tool = toolById(entry.refId);
                  if (tool) {
                    currentToolGroup.push(tool);
                  }
                }
              });

              flushToolGroup();

              return renderItems.map((item) => {
                if (item.type === 'message') {
                  return (
                    <MessageBubble
                      key={item.id}
                      message={item.data}
                      agent={agent}
                    />
                  );
                }
                if (item.type === 'tool_group') {
                  return (
                    <CollapsibleToolGroup
                      key={item.id}
                      tools={item.tools}
                    />
                  );
                }
                return null;
              });
            })()}
            {chat.pendingApproval ? (
              <ApprovalCard
                approval={chat.pendingApproval}
                onRespond={chat.respondToApproval}
                disabled={chat.isRunning}
              />
            ) : null}
            {chat.isRunning ? <ThinkingText label="Thinking" /> : null}
          </div>
        )}
      </div>

      {chat.error ? (
        <div
          className={cn(
            'mx-auto w-full max-w-4xl px-4 pb-2 text-sm text-red-500',
            contentClassName,
          )}
        >
          {chat.error}
        </div>
      ) : null}
      <div className="sticky bottom-0 z-10 shrink-0 border-t border-slate-100 bg-white/95 px-4 pb-4 pt-3 backdrop-blur-sm dark:border-slate-800/50 dark:bg-slate-950/95">
        <div className={cn('mx-auto w-full max-w-4xl space-y-2', contentClassName)}>
          {chat.pendingClarification ? (
            <ClarificationCard
              key={chat.pendingClarification.currentIndex}
              clarification={chat.pendingClarification}
              onRespond={chat.respondToClarification}
              disabled={chat.isRunning}
            />
          ) : null}
          <ChatComposer
            value={input}
            onChange={setInput}
            onSend={send}
            onStop={chat.stop}
            isRunning={chat.isRunning}
            disabled={!threadId || !url}
            placeholder={
              chat.pendingApproval
                ? 'Reply with feedback, or use the buttons above...'
                : chat.pendingClarification
                  ? 'Reply directly, or use the choices above...'
                : 'Write a message...'
            }
          />
        </div>
      </div>
    </div>
  );
}

function CollapsibleToolGroup({ tools }) {
  const allDone = tools.every((t) => t.status === 'completed');
  const hasError = tools.some((t) => {
    const parsed = tryParseJson(t.resultText);
    return parsed?.status === 'error';
  });
  const anyRunning = tools.some((t) => t.status !== 'completed');

  const [isOpen, setIsOpen] = useState(anyRunning);
  const [prevAnyRunning, setPrevAnyRunning] = useState(anyRunning);

  if (anyRunning && !prevAnyRunning) {
    setIsOpen(true);
    setPrevAnyRunning(anyRunning);
  } else if (!anyRunning && prevAnyRunning) {
    setPrevAnyRunning(anyRunning);
  }

  return (
    <div className="max-w-[92%] rounded-xl bg-transparent py-1">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between px-1 py-1.5 text-left text-xs font-semibold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
      >
        <div className="flex items-center gap-2">
          {anyRunning ? (
            <Loader2 className="size-4 animate-spin text-orange-500" />
          ) : hasError ? (
            <AlertCircle className="size-4 text-red-500" />
          ) : (
            <CheckCircle2 className="size-4 text-emerald-500" />
          )}
          <span>
            {anyRunning
              ? `Running tools (${tools.filter((t) => t.status !== 'completed').length} active)...`
              : `Used ${tools.length} tool${tools.length > 1 ? 's' : ''}`}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-slate-400 dark:text-slate-500 font-normal">
            {isOpen ? 'Click to collapse' : 'Click to expand'}
          </span>
          {isOpen ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
        </div>
      </button>

      {isOpen && (
        <div className="mt-2 space-y-2 pl-4">
          {tools.map((tool) => (
            <ToolTrace key={tool.id} tool={tool} />
          ))}
        </div>
      )}
    </div>
  );
}
