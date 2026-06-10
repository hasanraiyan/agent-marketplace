'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, Folder, FolderOpen } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getFileIcon } from './utils';

function buildTree(files) {
  const tree = {};
  Object.entries(files).forEach(([path, data]) => {
    const parts = path.split('/').filter(Boolean);
    let current = tree;
    parts.forEach((part, index) => {
      if (!current[part]) {
        current[part] = {
          name: part,
          path: parts.slice(0, index + 1).join('/'),
          children: {},
          isDir: false,
        };
      }
      if (index === parts.length - 1) {
        current[part].isDir = !!(
          data?.is_dir ||
          data?.isDir ||
          data?.isDirectory ||
          data?.type === 'directory' ||
          path.endsWith('/')
        );
        current[part].content = data?.content;
        current[part].size = data?.size;
      } else {
        current[part].isDir = true;
      }
      current = current[part].children;
    });
  });
  return tree;
}

function TreeItem({ item, level = 0, onSelect, selectedPath }) {
  const [isOpen, setIsOpen] = useState(true);
  const isSelected = selectedPath === item.path;

  const toggleOpen = (e) => {
    e.stopPropagation();
    setIsOpen(!isOpen);
  };

  const handleSelect = () => {
    if (item.isDir) {
      setIsOpen(!isOpen);
    } else {
      onSelect(item.path);
    }
  };

  const children = Object.values(item.children).sort((a, b) => {
    if (a.isDir && !b.isDir) return -1;
    if (!a.isDir && b.isDir) return 1;
    return a.name.localeCompare(b.name);
  });

  return (
    <div className="select-none">
      <button
        type="button"
        onClick={handleSelect}
        className={cn(
          'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-slate-100 dark:hover:bg-slate-800',
          isSelected && 'bg-slate-100 dark:bg-slate-800 text-[#1E60FF] font-semibold'
        )}
        style={{ paddingLeft: `${level * 12 + 8}px` }}
      >
        <span className="flex size-4 items-center justify-center">
          {item.isDir ? (
            <span onClick={toggleOpen} className="cursor-pointer">
              {isOpen ? (
                <ChevronDown className="size-3 text-slate-400" />
              ) : (
                <ChevronRight className="size-3 text-slate-400" />
              )}
            </span>
          ) : null}
        </span>
        <span className="flex size-4 items-center justify-center">
          {item.isDir ? (
            isOpen ? (
              <FolderOpen className="size-4 text-amber-500" />
            ) : (
              <Folder className="size-4 text-amber-500" />
            )
          ) : (
            getFileIcon(item.path)
          )}
        </span>
        <span className="truncate">{item.name}</span>
      </button>
      {item.isDir && isOpen && (
        <div>
          {children.map((child) => (
            <TreeItem
              key={child.path}
              item={child}
              level={level + 1}
              onSelect={onSelect}
              selectedPath={selectedPath}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function FileTree({ files = {}, onSelect, selectedPath }) {
  const tree = buildTree(files);
  const rootItems = Object.values(tree).sort((a, b) => {
    if (a.isDir && !b.isDir) return -1;
    if (!a.isDir && b.isDir) return 1;
    return a.name.localeCompare(b.name);
  });

  if (Object.keys(files).length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-slate-400">
        <Folder className="mb-2 size-8 opacity-20" />
        <p className="text-xs">No files available</p>
      </div>
    );
  }

  return (
    <div className="space-y-0.5 p-2">
      {rootItems.map((item) => (
        <TreeItem
          key={item.path}
          item={item}
          onSelect={onSelect}
          selectedPath={selectedPath}
        />
      ))}
    </div>
  );
}
