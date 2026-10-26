'use client';

import React from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react';
import { useEditorStore } from '@/store/editor-store';
import { cn } from '@/lib/utils';

export function ToastRegion() {
  const toasts = useEditorStore((s) => s.toasts);
  const dismissToast = useEditorStore((s) => s.dismissToast);

  return (
    <div
      role="region"
      aria-label="Notifications"
      aria-live="polite"
      className="pointer-events-none fixed bottom-10 right-4 z-50 flex max-w-sm flex-col gap-2"
    >
      {toasts.map((toast) => {
        const Icon =
          toast.variant === 'success'
            ? CheckCircle2
            : toast.variant === 'warning'
              ? AlertTriangle
              : toast.variant === 'error'
                ? XCircle
                : Info;

        return (
          <div
            key={toast.id}
            data-testid="toast-notice"
            className={cn(
              'pointer-events-auto flex items-start gap-2.5 rounded-lg border px-3.5 py-2.5 text-sm shadow-lg backdrop-blur-sm transition-all',
              toast.variant === 'error'
                ? 'border-red-500/40 bg-red-950/95 text-red-100'
                : toast.variant === 'warning'
                  ? 'border-amber-500/40 bg-amber-950/95 text-amber-100'
                  : toast.variant === 'success'
                    ? 'border-emerald-500/40 bg-slate-900/95 text-slate-100'
                    : 'border-slate-700 bg-slate-900/95 text-slate-100'
            )}
          >
            <Icon
              className={cn(
                'mt-0.5 h-4 w-4 shrink-0',
                toast.variant === 'success'
                  ? 'text-emerald-400'
                  : toast.variant === 'warning'
                    ? 'text-amber-400'
                    : toast.variant === 'error'
                      ? 'text-red-400'
                      : 'text-violet-400'
              )}
            />
            <div className="flex-1 space-y-0.5">
              <div className="font-medium leading-snug">{toast.title}</div>
              {toast.description && (
                <div className="text-xs text-slate-300">{toast.description}</div>
              )}
            </div>
            <button
              type="button"
              aria-label="Dismiss notification"
              onClick={() => dismissToast(toast.id)}
              className="rounded p-0.5 text-slate-400 hover:bg-slate-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
