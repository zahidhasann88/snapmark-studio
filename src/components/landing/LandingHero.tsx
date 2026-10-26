'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  Download,
  FileJson,
  ImagePlus,
  Layers,
  Moon,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Sun,
  UploadCloud,
} from 'lucide-react';
import { useFileImporter } from '@/import/useFileImporter';
import { useEditorStore } from '@/store/editor-store';
import { Button } from '@/components/ui/button';
import { ImportErrorBanner } from '@/components/editor/ImportErrorBanner';
import { LogoMark } from '@/components/brand/LogoMark';

export function LandingHero() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { importFile, importSampleScreenshot } = useFileImporter();
  const importError = useEditorStore((s) => s.importError);
  const setImportError = useEditorStore((s) => s.setImportError);

  const [isDragging, setIsDragging] = useState(false);
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains('dark'));

    const onPaste = (evt: ClipboardEvent) => {
      const items = evt.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item && item.kind === 'file' && item.type.startsWith('image/')) {
          const blob = item.getAsFile();
          if (blob) {
            evt.preventDefault();
            const ext = item.type.split('/')[1] || 'png';
            const file = new File([blob], `pasted-screenshot.${ext}`, {
              type: item.type,
            });
            void importFile(file, {
              onSuccessNavigate: () => router.push('/editor'),
            });
            return;
          }
        }
      }
    };

    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [importFile, router]);

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        if (e.currentTarget.contains(e.relatedTarget as Node)) return;
        setIsDragging(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file) {
          void importFile(file, {
            onSuccessNavigate: () => router.push('/editor'),
          });
        }
      }}
      className="min-h-[100dvh] flex flex-col bg-background text-foreground"
    >
      <input
        ref={fileInputRef}
        type="file"
        data-testid="landing-file-input"
        accept="image/png,image/jpeg,image/webp,.snapmark,.json"
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            void importFile(file, {
              onSuccessNavigate: () => router.push('/editor'),
            });
          }
          e.target.value = '';
        }}
      />

      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
        <div className="flex items-center gap-2.5">
          <LogoMark className="h-8 w-8 drop-shadow-sm" />
          <span className="text-base font-bold tracking-tight">
            SnapMark Studio
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="iconSm"
            aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
            onClick={() => {
              const next = !isDark;
              setIsDark(next);
              document.documentElement.classList.toggle('dark', next);
            }}
          >
            {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          <Button asChild size="sm" data-testid="nav-open-editor-btn">
            <Link href="/editor">
              Open Studio
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center px-4 py-4 sm:px-6">
        <div className="max-w-2xl text-center">
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Fast, Private{' '}
            <span className="bg-gradient-to-r from-indigo-600 via-violet-600 to-pink-600 bg-clip-text dark:from-indigo-400 dark:via-violet-400 dark:to-pink-400 text-transparent">
              Screenshot Annotation
            </span>{' '}
            & Redaction
          </h1>
          <p className="mt-2 text-base leading-relaxed text-muted-foreground">
            Mark up any screenshot in seconds — add arrows, highlights, numbered steps, and text, hide private details for good, and save it as a PNG or JPEG. Everything stays on your device: no uploads, no sign-up.
          </p>

          <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg" data-testid="hero-launch-editor-btn">
              <Link href="/editor">
                Launch Screenshot Editor
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>

            <Button
              variant="outline"
              size="lg"
              data-testid="hero-sample-btn"
              onClick={() => {
                void importSampleScreenshot(() => router.push('/editor'));
              }}
            >
              <Sparkles className="h-4 w-4 text-amber-500" />
              Try Sample Screenshot
            </Button>
          </div>
        </div>

        {importError && (
          <div className="mt-4 w-full max-w-xl">
            <ImportErrorBanner
              error={importError}
              onDismiss={() => setImportError(null)}
              onChooseAnotherFile={() => fileInputRef.current?.click()}
            />
          </div>
        )}

        <div
          onClick={() => fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              fileInputRef.current?.click();
            }
          }}
          aria-label="Upload or drop a screenshot to open directly in the editor"
          className={`mt-5 flex w-full max-w-2xl cursor-pointer flex-col items-center rounded-2xl border-2 border-dashed px-6 py-5 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
            isDragging
              ? 'border-primary bg-primary/10'
              : 'border-border bg-card/70 hover:border-primary/60 hover:bg-accent/40'
          }`}
        >
          <UploadCloud className="h-7 w-7 text-primary" />
          <p className="mt-2 text-sm font-semibold text-foreground">
            Drop an image here, press{' '}
            <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-xs">
              Ctrl/Cmd+V
            </kbd>{' '}
            to paste, or click to choose a file
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Works with PNG, JPG, and WebP images, or a SnapMark project you saved earlier
          </p>
          <div className="mt-3 flex flex-wrap justify-center gap-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1">
              <ImagePlus className="h-3.5 w-3.5" /> Keeps full image quality
            </span>
            <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1">
              <FileJson className="h-3.5 w-3.5" /> Save and keep editing later
            </span>
          </div>
        </div>

        <section
          aria-label="Key capabilities"
          className="mt-5 grid w-full max-w-4xl grid-cols-1 gap-4 sm:grid-cols-3"
        >
          <div className="rounded-xl border border-border bg-card p-3.5">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Layers className="h-4 w-4 text-primary" />
              Every Markup Tool You Need
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
              Arrows, boxes, circles, lines, a pen, a highlighter, text notes, and numbered steps to walk anyone through anything.
            </p>
          </div>

          <div className="rounded-xl border border-border bg-card p-3.5">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <ShieldAlert className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              Hide Private Info for Good
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
              Blur or pixelate to soften details, or cover them with a solid block that is permanently removed from the saved image. No one can undo it.
            </p>
          </div>

          <div className="rounded-xl border border-border bg-card p-3.5">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Download className="h-4 w-4 text-primary" />
              Save or Share in One Click
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
              Download a sharp PNG or a smaller JPG at any size, or copy it straight to your clipboard to paste into a chat or email.
            </p>
          </div>
        </section>
      </main>

      <footer className="border-t border-border py-3 text-center text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
          No account needed · Nothing is tracked · Your images never leave your browser.
        </span>
      </footer>
    </div>
  );
}
