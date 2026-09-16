/**
 * Ligne de statut avec transition type iMessage : dwell puis swap animé.
 * Coalesce les mises à jour rapides (progression d'analyse).
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Keep each status message readable (chatbot-like, but legible). */
export const STATUS_SWAP_DWELL_MS = 2000;
/** Must match CSS `.status-swap__line--*` duration. */
export const STATUS_SWAP_ANIM_MS = 750;

type Props = {
  /** Identity of the line — change triggers swap; same key updates in place. */
  lineKey: string;
  children: ReactNode;
  className?: string;
  /** Min time a message stays on screen before the next swap (ms). */
  dwellMs?: number;
};

type Queued = { key: string; node: ReactNode };

/**
 * Chatbot / iMessage-style status line: old text exits upward, new enters from below.
 * Messages dwell long enough to be read; rapid progress updates are coalesced to the latest.
 */
export function StatusSwap({
  lineKey,
  children,
  className,
  dwellMs = STATUS_SWAP_DWELL_MS,
}: Props) {
  const [activeKey, setActiveKey] = useState(lineKey);
  const [activeNode, setActiveNode] = useState<ReactNode>(children);
  const [leaving, setLeaving] = useState<ReactNode | null>(null);
  const [token, setToken] = useState(0);

  const shownAtRef = useRef(0);
  const dwellTimerRef = useRef<number | null>(null);
  const clearLeavingTimerRef = useRef<number | null>(null);
  const pendingRef = useRef<Queued | null>(null);
  const activeKeyRef = useRef(lineKey);
  const activeNodeRef = useRef<ReactNode>(children);
  const mountedRef = useRef(false);

  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      shownAtRef.current = Date.now();
    }
  }, []);

  useEffect(() => {
    activeKeyRef.current = activeKey;
  }, [activeKey]);

  useEffect(() => {
    activeNodeRef.current = activeNode;
  }, [activeNode]);

  useEffect(() => {
    return () => {
      if (dwellTimerRef.current) window.clearTimeout(dwellTimerRef.current);
      if (clearLeavingTimerRef.current) {
        window.clearTimeout(clearLeavingTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    function beginSwap(next: Queued) {
      setLeaving(activeNodeRef.current);
      setActiveKey(next.key);
      setActiveNode(next.node);
      setToken((t) => t + 1);
      shownAtRef.current = Date.now();

      if (clearLeavingTimerRef.current) {
        window.clearTimeout(clearLeavingTimerRef.current);
      }
      clearLeavingTimerRef.current = window.setTimeout(() => {
        setLeaving(null);
        clearLeavingTimerRef.current = null;
      }, STATUS_SWAP_ANIM_MS);
    }

    if (lineKey === activeKeyRef.current) {
      setActiveNode(children);
      return;
    }

    const next: Queued = { key: lineKey, node: children };
    const elapsed = Date.now() - shownAtRef.current;

    if (elapsed >= dwellMs) {
      pendingRef.current = null;
      if (dwellTimerRef.current) {
        window.clearTimeout(dwellTimerRef.current);
        dwellTimerRef.current = null;
      }
      beginSwap(next);
      return;
    }

    pendingRef.current = next;
    if (dwellTimerRef.current) window.clearTimeout(dwellTimerRef.current);
    const wait = Math.max(0, dwellMs - elapsed);
    dwellTimerRef.current = window.setTimeout(() => {
      dwellTimerRef.current = null;
      const queued = pendingRef.current;
      pendingRef.current = null;
      if (queued && queued.key !== activeKeyRef.current) {
        beginSwap(queued);
      }
    }, wait);
  }, [lineKey, children, dwellMs]);

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
          {activeNode}
        </div>
      </div>
    </div>
  );
}
