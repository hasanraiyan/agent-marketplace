'use client';

import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSanitize from 'rehype-sanitize';
import {
  BotIcon,
  ChevronDown,
  ChevronUp,
  Download,
  FileCode,
  FileText,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { tryParseJson, getFileSystemActionDetails } from './utils';

function ReasoningBubble({ message }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="max-w-[92%]">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex items-center gap-1 rounded-md px-1 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
      >
        Thoughts
        {open ? (
          <ChevronUp className="size-3.5" />
        ) : (
          <ChevronDown className="size-3.5" />
        )}
      </button>
      {open ? (
        <div className="ml-3 border-l border-slate-200 pl-3 text-sm leading-6 text-slate-500 dark:border-slate-700 dark:text-slate-400 prose prose-sm max-w-none dark:prose-invert prose-p:my-1 prose-pre:my-2 prose-headings:my-2 prose-ul:my-1 prose-ol:my-1">
          {message.content ? (
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeSanitize]}
            >
              {message.content}
            </ReactMarkdown>
          ) : (
            <ThinkingText label="Thinking" />
          )}
        </div>
      ) : null}
    </div>
  );
}

export function ThinkingText({ label = 'Thinking' }) {
  return (
    <span className="inline-flex shimmer-text items-center text-sm font-bold tracking-wider">
      {label}
    </span>
  );
}

export function NewChatIcon({ className }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

export function MessageBubble({ message, agent, precedingTools = [], onOpenFile }) {
  const isUser = message.role === 'user';

  if (message.role === 'reasoning') {
    return <ReasoningBubble message={message} />;
  }

  if (!isUser && !message.content) return null;

  const fsToolCalls = precedingTools.filter((t) => {
    if (t.status !== 'completed') return false;
    const details = getFileSystemActionDetails({ name: t.name, args: tryParseJson(t.argumentsText) });
    return !!details;
  });

  const uniqueFiles = [];
  const seen = new Set();
  fsToolCalls.forEach((t) => {
    const details = getFileSystemActionDetails({ name: t.name, args: tryParseJson(t.argumentsText) });
    if (details && !seen.has(details.filePath)) {
      seen.add(details.filePath);
      uniqueFiles.push({
        ...details,
        toolName: t.name,
      });
    }
  });

  const downloadFile = (fileName, content) => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className={cn('flex w-full', isUser ? 'justify-end' : 'justify-start')}
    >
      <div
        className={cn(
          'min-w-0 text-[15px] leading-7',
          isUser
            ? 'max-w-[75%] rounded-2xl rounded-br-md bg-[#1E60FF] px-4 py-3 text-white shadow-sm'
            : 'max-w-[92%] text-slate-900 dark:text-slate-100',
        )}
      >
        {!isUser && agent ? (
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
            <Avatar className="size-6">
              <AvatarImage
                src={agent.avatarUrl || agent.avatar}
                alt={agent.name}
              />
              <AvatarFallback className="bg-slate-100 text-slate-500">
                <BotIcon className="size-3" />
              </AvatarFallback>
            </Avatar>
            {agent.name || 'Agent'}
          </div>
        ) : null}
        <div
          className={cn(
            'prose prose-sm max-w-none break-words prose-p:my-1 prose-pre:my-2 prose-headings:my-2 prose-ul:my-1 prose-ol:my-1',
            isUser ? 'prose-invert' : 'dark:prose-invert',
          )}
        >
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeSanitize]}
          >
            {message.content}
          </ReactMarkdown>
        </div>

        {/* File Artifact Cards */}
        {!isUser && uniqueFiles.length > 0 && (
          <div className="mt-3 max-w-xl space-y-2">
            {uniqueFiles.map((file, i) => {
              const fileName = file.filePath.split('/').pop() || file.filePath;
              const fileExt = fileName.includes('.') ? fileName.split('.').pop()?.toUpperCase() : 'FILE';
              const isCode = ['JS', 'JSX', 'TS', 'TSX', 'JSON', 'HTML', 'CSS', 'PY', 'SH', 'GO', 'RS', 'MD'].includes(fileExt);
              const FileIcon = isCode ? FileCode : FileText;

              let actionLabel = 'Modified file';
              let isDeleted = false;
              if (file.toolName?.toLowerCase().includes('write')) {
                actionLabel = 'Created file';
              } else if (file.toolName?.toLowerCase().includes('delete')) {
                actionLabel = 'Deleted file';
                isDeleted = true;
              }

              return (
                <div
                  key={i}
                  onClick={() => !isDeleted && onOpenFile?.(file.filePath)}
                  className={cn(
                    'flex items-center justify-between rounded-xl border border-slate-205 bg-slate-50/50 p-3 dark:border-slate-800 dark:bg-slate-905/30 shadow-[0_1px_2px_rgba(0,0,0,0.01)] hover:bg-slate-100/30 dark:hover:bg-slate-900/50 transition-colors',
                    !isDeleted ? 'cursor-pointer' : 'cursor-default'
                  )}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-slate-100 dark:bg-slate-800 dark:text-slate-200">
                      <FileIcon className="size-4.5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-xs font-bold text-slate-800 dark:text-slate-100">
                          {fileName}
                        </span>
                        <span className="shrink-0 rounded bg-slate-100 px-1 py-0.5 text-[9px] font-bold text-slate-500 dark:bg-slate-800 dark:text-slate-455">
                          {fileExt}
                        </span>
                      </div>
                      <div className="text-[10px] font-semibold text-slate-450 dark:text-slate-555">
                        {isDeleted ? actionLabel : 'Click to view preview'}
                      </div>
                    </div>
                  </div>

                  {!isDeleted && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 rounded-lg text-slate-400 hover:text-slate-650 hover:bg-slate-150/60 dark:hover:bg-slate-800 dark:hover:text-slate-350 flex items-center justify-center shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        downloadFile(fileName, file.content);
                      }}
                      title="Download file"
                    >
                      <Download className="size-4" />
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
