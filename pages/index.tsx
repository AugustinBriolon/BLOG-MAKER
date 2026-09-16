import Head from "next/head";
import { FormEvent, useState } from "react";
import { ChevronDown } from "lucide-react";
import type { AnalyzeResult } from "@/lib/analyze";
import type { TopicSuggestion } from "@/lib/ai/topics";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

type UiError = { message: string; action?: string };

type CrawlProgress = {
  phase: string;
  done: number;
  total: number;
  label: string;
};

const SOURCE_LABEL: Record<string, string> = {
  sitemap: "sitemap.xml",
  "robots-sitemap": "sitemap (robots.txt)",
  "homepage-links": "liens accueil",
  "homepage-only": "accueil",
};

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
      {children}
    </p>
  );
}

function StatusBlock({
  message,
  action,
  tone = "muted",
}: {
  message: string;
  action?: string;
  tone?: "muted" | "danger";
}) {
  return (
    <div
      role={tone === "danger" ? "alert" : undefined}
      className={cn(
        "mt-3 space-y-1 text-sm",
        tone === "danger" ? "text-destructive" : "text-muted-foreground",
      )}
    >
      <p>{message}</p>
      {action ? (
        <p className="text-foreground/80">→ {action}</p>
      ) : null}
    </div>
  );
}

function DomainSkeleton() {
  return (
    <div className="space-y-3" aria-busy="true">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-8 w-full max-w-xl" />
      <div className="grid max-w-md grid-cols-2 gap-3 pt-2">
        <Skeleton className="h-12" />
        <Skeleton className="h-12" />
      </div>
    </div>
  );
}

function KeywordsSkeleton() {
  return (
    <div className="space-y-3" aria-busy="true">
      <Skeleton className="h-3 w-28" />
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center justify-between gap-4 py-1">
          <Skeleton
            className="h-3"
            style={{ width: `${40 + ((i * 9) % 40)}%` }}
          />
          <Skeleton className="h-3 w-8" />
        </div>
      ))}
    </div>
  );
}

function TopicsSkeleton() {
  return (
    <div className="space-y-3" aria-busy="true">
      <Skeleton className="h-16 w-full max-w-lg" />
      <Skeleton className="h-16 w-4/5 max-w-md" />
      <Skeleton className="h-16 w-3/5 max-w-sm" />
    </div>
  );
}

function DraftSkeleton() {
  return (
    <div className="space-y-3" aria-busy="true">
      <Skeleton className="h-6 w-2/3" />
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-4/5" />
      <Skeleton className="mt-4 h-5 w-1/3" />
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-5/6" />
    </div>
  );
}

async function readAnalyzeStream(
  response: Response,
  onProgress: (p: CrawlProgress) => void,
): Promise<AnalyzeResult> {
  if (!response.body) {
    throw new Error("Flux d’analyse indisponible.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let result: AnalyzeResult | null = null;
  let streamError: UiError | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let newline = buffer.indexOf("\n");
    while (newline >= 0) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      newline = buffer.indexOf("\n");
      if (!line) continue;

      let payload: {
        type?: string;
        phase?: string;
        done?: number;
        total?: number;
        label?: string;
        data?: AnalyzeResult;
        error?: string;
        action?: string;
        code?: string;
      };
      try {
        payload = JSON.parse(line) as typeof payload;
      } catch {
        continue;
      }

      if (payload.type === "progress") {
        onProgress({
          phase: payload.phase ?? "crawl",
          done: payload.done ?? 0,
          total: payload.total ?? 0,
          label: payload.label ?? "Analyse…",
        });
      } else if (payload.type === "result" && payload.data) {
        result = payload.data;
      } else if (payload.type === "error") {
        streamError = {
          message: payload.error || "L’analyse a échoué.",
          action: payload.action,
        };
      }
    }
  }

  if (streamError) {
    const err = new Error(streamError.message) as Error & { action?: string };
    err.action = streamError.action;
    throw err;
  }
  if (!result) {
    throw new Error("Réponse d’analyse incomplète.");
  }
  return result;
}

export default function Home() {
  const [url, setUrl] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [progress, setProgress] = useState<CrawlProgress | null>(null);
  const [topicsLoading, setTopicsLoading] = useState(false);
  const [draftLoading, setDraftLoading] = useState(false);
  const [error, setError] = useState<UiError | null>(null);
  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const [topics, setTopics] = useState<TopicSuggestion[]>([]);
  const [topicsError, setTopicsError] = useState<UiError | null>(null);
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [draftMarkdown, setDraftMarkdown] = useState<string | null>(null);
  const [draftError, setDraftError] = useState<UiError | null>(null);
  const [showAllKeywords, setShowAllKeywords] = useState(false);
  const [keywordsOpen, setKeywordsOpen] = useState(false);

  async function loadTopics(analysis: AnalyzeResult) {
    setTopicsLoading(true);
    setTopicsError(null);
    setTopics([]);
    setSelectedTopic(null);
    setDraftMarkdown(null);
    setDraftError(null);

    try {
      const response = await fetch("/api/topics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          host: analysis.host,
          domainGuess: analysis.domainGuess,
          keywords: analysis.keywords.slice(0, 20),
          blogPosts: analysis.blogPosts,
        }),
      });

      const data = (await response.json()) as {
        topics?: TopicSuggestion[];
        titles?: string[];
        error?: string;
        action?: string;
        unavailable?: boolean;
      };

      if (!response.ok) {
        setTopicsError({
          message: data.error || "Sujets IA indisponibles.",
          action: data.action || "Réessayez après l’analyse.",
        });
        return;
      }

      const nextTopics =
        data.topics && data.topics.length > 0
          ? data.topics
          : (data.titles ?? []).map((title) => ({
              title,
              reason: "Opportunité SEO proposée pour ce domaine.",
            }));

      setTopics(nextTopics);
      if (nextTopics[0]) {
        setSelectedTopic(nextTopics[0].title);
      }
      if (data.unavailable || data.error) {
        setTopicsError({
          message: data.error || "Clé IA absente — sujets non générés.",
          action:
            data.action ||
            "Ajoutez AI_GATEWAY_API_KEY dans .env.local.",
        });
      }
    } catch {
      setTopicsError({
        message: "Sujets IA indisponibles.",
        action: "Vérifiez la connexion, puis réessayez.",
      });
    } finally {
      setTopicsLoading(false);
    }
  }

  async function generateDraft() {
    if (!result || !selectedTopic) return;

    setDraftLoading(true);
    setDraftError(null);
    setDraftMarkdown(null);

    try {
      const response = await fetch("/api/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: selectedTopic,
          host: result.host,
          domainGuess: result.domainGuess,
          keywords: result.keywords.slice(0, 15),
          blogPosts: result.blogPosts,
        }),
      });

      const data = (await response.json()) as {
        markdown?: string;
        error?: string;
        action?: string;
        unavailable?: boolean;
      };

      if (!response.ok) {
        setDraftError({
          message: data.error || "Génération impossible.",
          action: data.action || "Réessayez.",
        });
        return;
      }

      if (data.unavailable || data.error || !data.markdown) {
        setDraftError({
          message: data.error || "Clé IA absente — brouillon non généré.",
          action:
            data.action ||
            "Ajoutez AI_GATEWAY_API_KEY dans .env.local.",
        });
        return;
      }

      setDraftMarkdown(data.markdown);
    } catch {
      setDraftError({
        message: "Serveur injoignable pour le brouillon.",
        action: "Réessayez dans un instant.",
      });
    } finally {
      setDraftLoading(false);
    }
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setAnalyzing(true);
    setProgress({
      phase: "robots",
      done: 0,
      total: 0,
      label: "Démarrage de l’analyse…",
    });
    setTopicsLoading(false);
    setDraftLoading(false);
    setError(null);
    setResult(null);
    setTopics([]);
    setTopicsError(null);
    setSelectedTopic(null);
    setDraftMarkdown(null);
    setDraftError(null);
    setShowAllKeywords(false);
    setKeywordsOpen(false);

    try {
      const response = await fetch("/api/analyze?stream=1", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/x-ndjson",
        },
        body: JSON.stringify({ url, stream: true }),
      });

      if (
        !response.ok &&
        !response.headers.get("content-type")?.includes("ndjson")
      ) {
        const data = (await response.json()) as {
          error?: string;
          action?: string;
        };
        setError({
          message: data.error || "L’analyse a échoué.",
          action: data.action,
        });
        setAnalyzing(false);
        setProgress(null);
        return;
      }

      const data = await readAnalyzeStream(response, setProgress);
      setResult(data);
      setAnalyzing(false);
      setProgress(null);
      void loadTopics(data);
    } catch (err) {
      const action =
        err && typeof err === "object" && "action" in err
          ? String((err as { action?: string }).action ?? "")
          : undefined;
      setError({
        message:
          err instanceof Error ? err.message : "Serveur injoignable.",
        action: action || "Réessayez, ou changez d’URL.",
      });
      setAnalyzing(false);
      setProgress(null);
    }
  }

  const showResults = Boolean(result) && !analyzing;
  const showWorkspace = analyzing || showResults;

  return (
    <>
      <Head>
        <title>Blog Maker</title>
        <meta
          name="description"
          content="Analyse SEO : URL → sujets IA → brouillon article."
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <main className="relative mx-auto flex min-h-screen w-full max-w-3xl flex-col px-5 pb-24 pt-14 sm:px-8 sm:pb-16 sm:pt-20">
        <header className="animate-rise">
          <p className="font-heading text-5xl font-bold tracking-tight text-foreground sm:text-6xl">
            Blog Maker
          </p>
        </header>

        <form
          onSubmit={onSubmit}
          className="analyze-form animate-rise-delay mt-10 flex w-full flex-col gap-3 sm:flex-row sm:items-center"
        >
          <label className="sr-only" htmlFor="site-url">
            URL du site
          </label>
          <Input
            id="site-url"
            type="url"
            inputMode="url"
            required
            placeholder="https://exemple.com"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={analyzing}
            className="h-12 flex-1 rounded-full bg-background/80 px-5 text-base shadow-xs backdrop-blur-sm"
          />
          <button
            type="submit"
            className="button-02"
            disabled={analyzing || !url.trim()}
            aria-label="Analyser"
          >
            <div className="inner">Analyser</div>
            <div className="circle" aria-hidden="true">
              <span>→</span>
            </div>
          </button>
        </form>

        {analyzing && progress && (
          <p
            className="mt-4 text-sm text-muted-foreground"
            aria-live="polite"
          >
            {progress.phase === "crawl" && progress.total > 0
              ? `${progress.done}/${progress.total} pages…`
              : progress.label}
          </p>
        )}

        {error && !analyzing && (
          <StatusBlock
            message={error.message}
            action={error.action}
            tone="danger"
          />
        )}

        {showWorkspace && (
          <section className="mt-12 space-y-10">
            {analyzing && !result ? (
              <DomainSkeleton />
            ) : result ? (
              <div>
                <SectionLabel>Domaine</SectionLabel>
                <p className="font-heading mt-2 text-2xl font-semibold leading-snug text-foreground">
                  {result.domainGuess}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Badge variant="secondary">
                    {result.pagesAnalyzed} pages
                  </Badge>
                  <Badge variant="outline">
                    {SOURCE_LABEL[result.discoverySource] ??
                      result.discoverySource}
                  </Badge>
                  {result.pagesFailed > 0 && (
                    <Badge variant="destructive">
                      {result.pagesFailed} échec
                      {result.pagesFailed > 1 ? "s" : ""}
                    </Badge>
                  )}
                </div>
              </div>
            ) : null}

            {/* Sujets above keywords — SaaS value first */}
            {analyzing && !result ? (
              <div>
                <Skeleton className="mb-4 h-3 w-20" />
                <TopicsSkeleton />
              </div>
            ) : result ? (
              <div>
                <SectionLabel>Sujets</SectionLabel>
                {topicsLoading ? (
                  <div className="mt-4">
                    <TopicsSkeleton />
                  </div>
                ) : topics.length > 0 ? (
                  <ul className="mt-4 space-y-3">
                    {topics.map((topic) => {
                      const selected = selectedTopic === topic.title;
                      return (
                        <li key={topic.title}>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedTopic(topic.title);
                              setDraftMarkdown(null);
                              setDraftError(null);
                            }}
                            className={cn(
                              "w-full rounded-xl border px-4 py-3 text-left transition-colors",
                              selected
                                ? "border-foreground/25 bg-foreground/[0.04]"
                                : "border-transparent hover:bg-muted/60",
                            )}
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge
                                variant="secondary"
                                className="text-[10px] uppercase tracking-wide"
                              >
                                proposé
                              </Badge>
                              {selected ? (
                                <span className="text-xs text-muted-foreground">
                                  sélectionné
                                </span>
                              ) : null}
                            </div>
                            <p className="font-heading mt-2 text-lg font-semibold leading-snug text-foreground">
                              {topic.title}
                            </p>
                            {topic.reason ? (
                              <p className="mt-1 text-sm text-muted-foreground">
                                {topic.reason}
                              </p>
                            ) : null}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <StatusBlock
                    message={
                      topicsError?.message || "Aucun sujet généré."
                    }
                    action={topicsError?.action}
                  />
                )}

                {topics.length > 0 && (
                  <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
                    <button
                      type="button"
                      className="button-02 button-02--compact"
                      disabled={!selectedTopic || draftLoading}
                      onClick={() => void generateDraft()}
                      aria-label="Générer le brouillon"
                    >
                      <div className="inner">
                        {draftLoading ? "Génération…" : "Générer"}
                      </div>
                      <div className="circle" aria-hidden="true">
                        <span>→</span>
                      </div>
                    </button>
                    <p className="text-xs text-muted-foreground">
                      Étape séparée : brouillon markdown (outline + intro +
                      H2).
                    </p>
                  </div>
                )}

                {(draftLoading || draftMarkdown || draftError) && (
                  <div className="mt-8">
                    <SectionLabel>Brouillon</SectionLabel>
                    {draftLoading ? (
                      <div className="mt-4">
                        <DraftSkeleton />
                      </div>
                    ) : draftError ? (
                      <StatusBlock
                        message={draftError.message}
                        action={draftError.action}
                      />
                    ) : draftMarkdown ? (
                      <pre className="draft-markdown mt-4 overflow-x-auto whitespace-pre-wrap rounded-xl border border-border bg-background/70 p-4 text-sm leading-relaxed text-foreground">
                        {draftMarkdown}
                      </pre>
                    ) : null}
                  </div>
                )}
              </div>
            ) : null}

            {/* Keywords secondary / collapsible */}
            {analyzing && !result ? (
              <KeywordsSkeleton />
            ) : result ? (
              <Collapsible
                open={keywordsOpen}
                onOpenChange={setKeywordsOpen}
              >
                <div className="flex items-center justify-between gap-3">
                  <SectionLabel>Mots-clés</SectionLabel>
                  <CollapsibleTrigger
                    className={cn(
                      "inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground",
                    )}
                  >
                    {keywordsOpen ? "Masquer" : "Afficher"}
                    <ChevronDown
                      className={cn(
                        "size-4 transition-transform duration-300 ease-[cubic-bezier(0.165,0.84,0.44,1)]",
                        keywordsOpen && "rotate-180",
                      )}
                    />
                  </CollapsibleTrigger>
                </div>
                <CollapsibleContent>
                  <ol className="mt-4">
                    {result.keywords
                      .slice(0, showAllKeywords ? undefined : 10)
                      .map((kw, index) => (
                        <li
                          key={`${kw.kind}-${kw.term}`}
                          className="keyword-row text-sm"
                        >
                          <span className="flex min-w-0 items-baseline gap-3">
                            <span className="w-5 shrink-0 text-muted-foreground">
                              {index + 1}
                            </span>
                            <span className="truncate font-medium">
                              {kw.term}
                            </span>
                          </span>
                          <span className="shrink-0 tabular-nums text-chart-3">
                            {kw.count}
                          </span>
                        </li>
                      ))}
                  </ol>

                  {result.keywords.length > 10 && (
                    <button
                      type="button"
                      className="mt-3 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
                      onClick={() => setShowAllKeywords((v) => !v)}
                    >
                      {showAllKeywords
                        ? "Voir moins"
                        : `Voir plus (${result.keywords.length - 10})`}
                      <ChevronDown
                        className={cn(
                          "size-4 transition-transform duration-300 ease-[cubic-bezier(0.165,0.84,0.44,1)]",
                          showAllKeywords && "rotate-180",
                        )}
                      />
                    </button>
                  )}
                </CollapsibleContent>
              </Collapsible>
            ) : null}

            {result && result.blogPosts.length > 0 && (
              <div>
                <SectionLabel>Blog détecté</SectionLabel>
                <ul className="mt-4 space-y-2">
                  {result.blogPosts.slice(0, 6).map((page) => (
                    <li key={page.url} className="text-sm">
                      <a
                        href={page.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-foreground underline-offset-4 transition-colors hover:text-chart-3 hover:underline"
                      >
                        {page.title}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {result && result.pageSamples.length > 0 && (
              <div>
                <SectionLabel>Pages</SectionLabel>
                <Separator className="my-3" />
                <ul className="space-y-2">
                  {result.pageSamples.map((page) => (
                    <li key={page.url} className="text-sm">
                      <a
                        href={page.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-foreground underline-offset-4 transition-colors hover:text-chart-3 hover:underline"
                      >
                        {page.title}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {result && result.warnings.length > 0 && (
              <ul className="space-y-1 text-sm text-muted-foreground">
                {result.warnings.map((w) => (
                  <li key={w}>· {w}</li>
                ))}
              </ul>
            )}
          </section>
        )}
      </main>
    </>
  );
}
