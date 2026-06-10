'use client';

import { useState, useMemo } from 'react';
import {
  FileCode,
  ListTodo,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { TodoChecklist } from './TodoChecklist';
import { FileTree } from './FileTree';
import { FilePreviewDialog } from './FilePreviewDialog';

export function AguiFilesPanel({
  state,
  open,
  onOpenChange,
  tab: tabProp,
  onTabChange,
  selectedFile: selectedFileProp,
  onSelectFile,
}) {
  const [internalTab, setInternalTab] = useState('files');
  const [internalSelectedFile, setInternalSelectedFile] = useState(null);

  const tab = tabProp ?? internalTab;
  const setTab = onTabChange ?? setInternalTab;

  const selectedFilePath = selectedFileProp ?? internalSelectedFile;
  const setSelectedFilePath = onSelectFile ?? setInternalSelectedFile;

  const filesMap = state?.files || {};
  const filesCount = Object.keys(filesMap).filter(path => {
    const data = filesMap[path];
    return !(
      path.endsWith('/') ||
      data?.is_dir === true ||
      data?.isDir === true ||
      data?.isDirectory === true ||
      data?.type === 'directory'
    );
  }).length;

  const todos = Array.isArray(state?.todos) ? state.todos : [];
  const todosDone = todos.filter((todo) => todo?.status === 'completed').length;

  const activeFile = useMemo(() => {
    if (!selectedFilePath || !filesMap[selectedFilePath]) return null;
    return {
      path: selectedFilePath,
      content: filesMap[selectedFilePath].content || '',
      size: filesMap[selectedFilePath].size || 0,
    };
  }, [selectedFilePath, filesMap]);

  if (!Object.keys(filesMap).length && !todos.length) return null;

  return (
    <>
      <aside
        className={cn(
          'fixed inset-y-0 right-0 z-50 flex w-80 flex-col border-l border-slate-200 bg-white transition-all duration-300 lg:static lg:z-0 dark:border-slate-800 dark:bg-slate-950',
          open
            ? 'translate-x-0 shadow-2xl lg:shadow-none lg:w-[450px] xl:w-[500px]'
            : 'translate-x-full lg:w-0 lg:translate-x-0 lg:border-none lg:opacity-0',
          'overflow-hidden',
        )}
      >
        <div className="flex h-14 shrink-0 flex-col items-start justify-center border-b border-slate-200 px-4 dark:border-slate-800">
          <div className="flex w-full items-center gap-2">
            <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-0.5 dark:bg-slate-900">
              <button
                type="button"
                onClick={() => setTab('plan')}
                className={cn(
                  'flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-bold transition-colors',
                  tab === 'plan'
                    ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-slate-100'
                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300',
                )}
              >
                <ListTodo className="size-3.5" />
                Plan
              </button>
              <button
                type="button"
                onClick={() => setTab('files')}
                className={cn(
                  'flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-bold transition-colors',
                  tab === 'files'
                    ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-slate-100'
                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300',
                )}
              >
                <FileCode className="size-3.5" />
                Files
              </button>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="ml-auto size-8"
              onClick={() => onOpenChange?.(false)}
            >
              <X className="size-4" />
            </Button>
          </div>
          <div className="text-[11px] font-bold text-slate-400">
            {tab === 'plan'
              ? todos.length
                ? `${todosDone} of ${todos.length} done`
                : 'No plan yet'
              : `${filesCount} Files`}
          </div>
        </div>

        {tab === 'plan' ? (
          <div className="min-h-0 flex-1 overflow-auto p-4">
            {todos.length ? (
              <>
                <div className="mb-4">
                  <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    <span>Progress</span>
                    <span className="tabular-nums">
                      {todosDone}/{todos.length}
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <div
                      className="h-full rounded-full bg-[#1E60FF] transition-all duration-500"
                      style={{
                        width: `${(todosDone / (todos.length || 1)) * 100}%`,
                      }}
                    />
                  </div>
                </div>
                <TodoChecklist todos={todos} />
              </>
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
                <ListTodo className="size-8 text-slate-300 dark:text-slate-700" />
                <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                  No plan yet
                </p>
                <p className="max-w-[220px] text-xs text-slate-400 dark:text-slate-500">
                  The agent will break complex tasks into steps and track them
                  here.
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-auto">
            <FileTree
              files={filesMap}
              onSelect={setSelectedFilePath}
              selectedPath={selectedFilePath}
            />
          </div>
        )}
      </aside>

      <FilePreviewDialog
        file={activeFile}
        open={!!activeFile}
        onOpenChange={(isOpen) => !isOpen && setSelectedFilePath(null)}
      />
    </>
  );
}
