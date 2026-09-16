import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type Props = {
  /** Identity of the line — change triggers swap; same key updates in place. */
  lineKey: string;
  children: ReactNode;
  className?: string;
};

/**
 * Chatbot / iMessage-style status line: old text exits upward, new enters from below.
 * Parent uses overflow:hidden; easing matches .button-02 (ease-out-quart).
 */
export function StatusSwap({ lineKey, children, className }: Props) {
  const [activeKey, setActiveKey] = useState(lineKey);
  const [leaving, setLeaving] = useState<ReactNode | null>(null);
  const [token, setToken] = useState(0);
  const snapshot = useRef(children);

  useEffect(() => {
    snapshot.current = children;
  });

  if (lineKey !== activeKey) {
    setLeaving(snapshot.current);
    setActiveKey(lineKey);
    setToken((t) => t + 1);
  }

  useEffect(() => {
    if (leaving === null) return;
    const id = window.setTimeout(() => setLeaving(null), 480);
    return () => window.clearTimeout(id);
  }, [token, leaving]);

  return (
    <div className={cn("status-swap", className)} aria-live="polite">
      <div className="status-swap__track">
        {leaving ? (
          <div
            className="status-swap__line status-swap__line--out"
            key={`out-${token}`}
            aria-hidden
          >
            {leaving}
          </div>
        ) : null}
        <div
          key={leaving ? `in-${token}` : `stable-${activeKey}`}
          className={cn(
            "status-swap__line",
            leaving && "status-swap__line--enter",
          )}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
