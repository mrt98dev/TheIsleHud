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
        <div className="fullMapBody">
          <LiveMapTab authed={authed} onLogin={onLogin} />
        </div>
      </div>
    </div>
  );
}
