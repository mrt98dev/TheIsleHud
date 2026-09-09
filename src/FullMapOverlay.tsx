import { useEffect } from "react";
import { LiveMapTab } from "./LiveMapTab";

export function FullMapOverlay({
  open,
  onClose,
  authed,
  onLogin,
}: {
  open: boolean;
  onClose: () => void;
  authed: boolean;
  onLogin: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fullMapBackdrop interactive-region" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="fullMapPanel">
        <div className="fullMapHeader">
          <button type="button" className="iconBtn danger" onClick={onClose} aria-label="Close map" title="Close map">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <path d="M6 6 18 18M18 6 6 18" />
            </svg>
          </button>
        </div>
        <div className="fullMapBody">
          <LiveMapTab authed={authed} onLogin={onLogin} />
        </div>
      </div>
    </div>
  );
}
