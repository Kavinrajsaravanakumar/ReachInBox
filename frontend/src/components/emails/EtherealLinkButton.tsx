"use client";

function ExternalLinkIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}

export function EtherealLinkButton({ previewUrl }: { previewUrl: string | null }) {
  if (!previewUrl) return null;

  return (
    <a
      href={previewUrl}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold text-sky-600 bg-sky-50 hover:bg-sky-100 border border-sky-200/80 transition-colors"
      title="Open in Ethereal Mail preview"
    >
      <span>Open Ethereal</span>
      <ExternalLinkIcon />
    </a>
  );
}
