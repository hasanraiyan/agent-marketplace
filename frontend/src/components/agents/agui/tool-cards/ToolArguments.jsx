'use client';

import { tryParseJson } from '../utils';

export function ToolArguments({ argumentsText }) {
  if (!argumentsText) return null;
  const parsed = tryParseJson(argumentsText);
  if (!parsed || typeof parsed !== 'object') {
    return (
      <div className="text-xs font-mono bg-slate-100/50 dark:bg-slate-900/50 p-2.5 rounded-xl border border-slate-150 dark:border-slate-800/60 leading-relaxed max-h-36 overflow-auto scrollbar-thin">
        {argumentsText}
      </div>
    );
  }

  const keys = Object.keys(parsed);
  if (keys.length === 1) {
    const key = keys[0];
    return (
      <div className="rounded-xl border border-slate-100 bg-white p-3 dark:border-slate-850 dark:bg-slate-950 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
        <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">
          {key.replace(/_/g, ' ')}
        </div>
        <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">
          {typeof parsed[key] === 'object' ? (
            <pre className="mt-1 font-mono text-xs bg-slate-50 dark:bg-slate-900/30 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800/80 max-h-40 overflow-auto scrollbar-thin">
              {JSON.stringify(parsed[key], null, 2)}
            </pre>
          ) : (
            `"${String(parsed[key])}"`
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-100 bg-white p-3 dark:border-slate-850 dark:bg-slate-950 grid grid-cols-1 gap-2.5 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
      {Object.entries(parsed).map(([key, val]) => (
        <div key={key} className="text-xs">
          <div className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-0.5">
            {key.replace(/_/g, ' ')}
          </div>
          <div className="font-semibold text-slate-800 dark:text-slate-200 break-words font-mono text-[11px] leading-relaxed">
            {typeof val === 'object' ? JSON.stringify(val) : String(val)}
          </div>
        </div>
      ))}
    </div>
  );
}
