import { loadImageAssetFromDataUrl, type LoadImageResult } from '@/import/image-loader';

export async function generateSampleScreenshotAsset(): Promise<LoadImageResult> {
  const width = 1280;
  const height = 800;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('2D canvas unavailable');
  }

  ctx.fillStyle = '#f1f5f9';
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(40, 36, width - 80, height - 72, 14);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#f8fafc';
  ctx.beginPath();
  ctx.roundRect(41, 37, width - 82, 52, [13, 13, 0, 0]);
  ctx.fill();
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(40, 89);
  ctx.lineTo(width - 40, 89);
  ctx.stroke();

  const dotColors = ['#ef4444', '#f59e0b', '#10b981'];
  dotColors.forEach((c, idx) => {
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.arc(72 + idx * 22, 63, 6.5, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#cbd5e1';
  ctx.beginPath();
  ctx.roundRect(160, 48, 560, 30, 7);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#475569';
  ctx.font = '500 13px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.fillText('https://staging.acme-cloud.internal/settings/webhooks', 176, 68);

  ctx.fillStyle = '#0f172a';
  ctx.beginPath();
  ctx.roundRect(41, 89, 220, height - 126, [0, 0, 0, 13]);
  ctx.fill();

  ctx.fillStyle = '#f8fafc';
  ctx.font = '700 16px Inter, system-ui, sans-serif';
  ctx.fillText('Acme Cloud Console', 64, 128);

  const navItems = ['Overview', 'Deployments', 'Webhooks & Keys', 'Audit Logs', 'Team Access'];
  navItems.forEach((item, i) => {
    const y = 166 + i * 42;
    if (i === 2) {
      ctx.fillStyle = '#1e293b';
      ctx.beginPath();
      ctx.roundRect(53, y - 22, 196, 34, 6);
      ctx.fill();
      ctx.fillStyle = '#38bdf8';
    } else {
      ctx.fillStyle = '#94a3b8';
    }
    ctx.font = i === 2 ? '600 14px Inter, system-ui, sans-serif' : '500 14px Inter, system-ui, sans-serif';
    ctx.fillText(item, 68, y);
  });

  ctx.fillStyle = '#0f172a';
  ctx.font = '700 24px Inter, system-ui, sans-serif';
  ctx.fillText('Production Webhook Configuration', 300, 144);

  ctx.fillStyle = '#64748b';
  ctx.font = '400 14px Inter, system-ui, sans-serif';
  ctx.fillText('Inspect delivery failures, signing credentials, and retry payloads before filing QA reports.', 300, 170);

  ctx.fillStyle = '#2563eb';
  ctx.beginPath();
  ctx.roundRect(1040, 122, 160, 38, 8);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = '600 14px Inter, system-ui, sans-serif';
  ctx.fillText('Rotate Signing Key', 1058, 146);

  ctx.fillStyle = '#fffbeb';
  ctx.strokeStyle = '#fcd34d';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(300, 200, 900, 136, 10);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#92400e';
  ctx.font = '700 14px Inter, system-ui, sans-serif';
  ctx.fillText('SENSITIVE CREDENTIALS — REDACT BEFORE SHARING EXTERNALLY', 324, 230);

  ctx.fillStyle = '#1e293b';
  ctx.font = '600 13px Inter, system-ui, sans-serif';
  ctx.fillText('Account Owner Email:', 324, 264);
  ctx.font = '500 13px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.fillStyle = '#0f172a';
  ctx.fillText('ops-lead@acme-corp.example.com', 485, 264);

  ctx.fillStyle = '#1e293b';
  ctx.font = '600 13px Inter, system-ui, sans-serif';
  ctx.fillText('Live Signing Secret:', 324, 302);
  ctx.fillStyle = '#fee2e2';
  ctx.beginPath();
  ctx.roundRect(480, 283, 430, 28, 5);
  ctx.fill();
  ctx.fillStyle = '#b91c1c';
  ctx.font = '700 13px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.fillText('whsec_live_98f4a7c210e5b3d9f1a68c42e7710b9a', 492, 302);

  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(300, 362, 900, 356, 10);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#0f172a';
  ctx.font = '700 16px Inter, system-ui, sans-serif';
  ctx.fillText('Recent Webhook Delivery #del_84920', 324, 398);

  ctx.fillStyle = '#fef2f2';
  ctx.strokeStyle = '#fecaca';
  ctx.beginPath();
  ctx.roundRect(625, 378, 128, 28, 14);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#dc2626';
  ctx.font = '700 12px Inter, system-ui, sans-serif';
  ctx.fillText('HTTP 502 Bad Gateway', 636, 396);

  ctx.fillStyle = '#0f172a';
  ctx.beginPath();
  ctx.roundRect(324, 424, 852, 268, 8);
  ctx.fill();

  const logLines = [
    { text: 'POST /webhooks/stripe-events HTTP/1.1', color: '#38bdf8' },
    { text: 'Host: api-gateway.acme-cloud.internal', color: '#94a3b8' },
    { text: 'X-Request-Id: req_77c1094e882b', color: '#94a3b8' },
    { text: '', color: '#94a3b8' },
    { text: '{', color: '#e2e8f0' },
    { text: '  "error": "UPSTREAM_TIMEOUT",', color: '#f87171' },
    { text: '  "message": "Worker pool exhausted after 30000ms awaiting DB lock",', color: '#fca5a5' },
    { text: '  "retry_scheduled_at": "2026-10-24T09:15:00Z",', color: '#fcd34d' },
    { text: '  "attempt": 4', color: '#e2e8f0' },
    { text: '}', color: '#e2e8f0' },
  ];

  ctx.font = '500 13.5px ui-monospace, SFMono-Regular, Menlo, monospace';
  logLines.forEach((line, idx) => {
    ctx.fillStyle = line.color;
    ctx.fillText(line.text, 348, 458 + idx * 23);
  });

  const dataUrl = canvas.toDataURL('image/png');
  return loadImageAssetFromDataUrl({
    dataUrl,
    name: 'sample-webhook-bug-report.png',
    mimeType: 'image/png',
  });
}
