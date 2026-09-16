/**
 * Affiche un brouillon markdown : vue prose ou brut, avec copie presse-papiers.
 */
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

type Props = {
  markdown: string;
  className?: string;
};

export function MarkdownReader({ markdown, className }: Props) {
  const [showRaw, setShowRaw] = useState(false);
  const [copied, setCopied] = useState(false);

  async function copyMarkdown() {
    try {
      await navigator.clipboard.writeText(markdown);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className={cn("mt-4", className)}>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          onClick={() => setShowRaw((v) => !v)}
        >
          {showRaw ? "Vue lisible" : "Markdown brut"}
        </button>
        <button
          type="button"
          className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          onClick={() => void copyMarkdown()}
        >
          {copied ? "Copié" : "Copier"}
        </button>
      </div>

      {showRaw ? (
        <pre className="draft-markdown overflow-x-auto whitespace-pre-wrap rounded-md border border-border bg-muted/50 p-4 text-sm leading-relaxed text-foreground">
          {markdown}
        </pre>
      ) : (
        <article className="draft-prose rounded-md border border-border bg-card/80 p-4 sm:p-5">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
        </article>
      )}
    </div>
  );
}
