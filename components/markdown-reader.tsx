/**
 * Affiche un brouillon markdown : vue prose ou brut, avec copie presse-papiers.
 */
import { useEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

const COPY_FEEDBACK_MS = 1600;

type Props = {
  markdown: string;
  className?: string;
};

export function MarkdownReader({ markdown, className }: Props) {
  const [showRaw, setShowRaw] = useState(false);
  const [copied, setCopied] = useState(false);
  const resetCopiedTimer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (resetCopiedTimer.current) {
        window.clearTimeout(resetCopiedTimer.current);
      }
    };
  }, []);

  async function copyMarkdown() {
    try {
      await navigator.clipboard.writeText(markdown);
      setCopied(true);
      if (resetCopiedTimer.current) {
        window.clearTimeout(resetCopiedTimer.current);
      }
      resetCopiedTimer.current = window.setTimeout(() => {
        setCopied(false);
        resetCopiedTimer.current = null;
      }, COPY_FEEDBACK_MS);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className={cn("mt-4", className)}>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          onClick={() => setShowRaw((v) => !v)}
        >
          {showRaw ? "Vue lisible" : "Markdown brut"}
        </button>
        <CopyButton copied={copied} onCopy={() => void copyMarkdown()} />
      </div>

      {showRaw ? (
        <pre className="draft-markdown overflow-x-auto whitespace-pre-wrap rounded-md border-[1.5px] border-border bg-muted/40 p-[var(--space-3)] text-sm leading-relaxed text-foreground">
          {markdown}
        </pre>
      ) : (
        <article className="draft-prose">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
        </article>
      )}
    </div>
  );
}

function CopyButton({
  copied,
  onCopy,
}: {
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={copied ? "Copié" : "Copier le markdown"}
      data-copied={copied ? "true" : undefined}
      className="copy-btn"
      onClick={onCopy}
    >
      <Copy aria-hidden className="copy-btn__icon copy-btn__icon--copy" />
      <Check aria-hidden className="copy-btn__icon copy-btn__icon--check" />
    </button>
  );
}
