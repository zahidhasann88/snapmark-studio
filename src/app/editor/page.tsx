'use client';

import dynamic from 'next/dynamic';

const EditorShell = dynamic(
  () => import('@/components/editor/EditorShell').then((mod) => mod.EditorShell),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[100dvh] w-full items-center justify-center bg-background text-sm text-muted-foreground">
        Initializing SnapMark Studio…
      </div>
    ),
  }
);

export default function EditorPage() {
  return <EditorShell />;
}
