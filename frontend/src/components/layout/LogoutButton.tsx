"use client";

function LogoutIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

export function LogoutButton({ onLogout }: { onLogout: () => void }) {
  return (
    <button
      type="button"
      onClick={onLogout}
      className="w-full flex items-center justify-center gap-2 rounded-xl py-2.5 px-3 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 border border-red-200/80 transition-colors"
    >
      <LogoutIcon />
      <span>Logout</span>
    </button>
  );
}
