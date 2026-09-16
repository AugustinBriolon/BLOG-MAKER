/**
 * Page d'accueil Blog Maker : saisie d'URL, analyse SEO,
 * sujets IA proposés et génération de brouillon markdown.
 */
import Head from "next/head";
import { FormEvent, useState } from "react";
import { useRouter } from "next/router";
import { ChevronDown } from "lucide-react";
import type { AnalyzeResult } from "@/lib/analyze";
import type { TopicSuggestion } from "@/lib/ai/topics";
import { NumberFlowValue } from "@/components/number-flow-value";
import { StatusSwap } from "@/components/status-swap";
import { MarkdownReader } from "@/components/markdown-reader";
// Mis de côté pour V1 Sanity — plan volume réactivable plus tard.
// import {
//   EditorialVolumePlan,
//   EditorialVolumePlanSkeleton,
// } from "@/components/editorial-volume-plan";
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

const DEMO_DRAFT_TITLE =
  "Choisir une plateforme de facturation électronique pour un cabinet";

const DEMO_DRAFT_MARKDOWN = `# Choisir une plateforme de facturation électronique pour un cabinet

## Plan
- Clarifier les obligations du cabinet
- Comparer les critères techniques et métier
- Vérifier l’agrément et la conformité
- Préparer la bascule opérationnelle
- Mesurer le ROI et les risques

La facturation électronique n’est plus un sujet périphérique pour les cabinets : elle touche la relation client, la conformité et la productivité au quotidien.

## Clarifier le besoin métier
Avant de comparer les outils, cartographiez vos flux (honoraires, débours, facturation récurrente) et les intégrations indispensables (comptabilité, CRM, signature).

## Critères de choix
Privilegiez la clarté du parcours, la qualité du support, et la capacité à exporter vos données sans friction.

## Conformité
Vérifiez les exigences applicables à votre activité et documentez le contrôle interne associé.

## Bascule
Planifiez une phase pilote courte, formez l’équipe, puis généralisez avec un suivi des incidents.

Une décision informée réduit le risque et accélère l’adoption.
`;

const DEMO_RESULT: AnalyzeResult = {
  siteUrl: "https://example.com",
  host: "example.com",
  discoverySource: "homepage-only",
  pagesAnalyzed: 1,
  pagesFailed: 0,
  pageSamples: [
    {
      url: "https://example.com/",
      title: "Accueil — démo",
      wordCount: 120,
    },
  ],
  blogPosts: [],
  totalSignificantTokens: 120,
  keywords: [
    { term: "facturation", count: 12, kind: "unigram" },
    { term: "cabinet", count: 9, kind: "unigram" },
  ],
  domainGuess: "Démo lecteur markdown",
  warnings: [],
};

const DEMO_TOPICS: TopicSuggestion[] = [
  {
    title: DEMO_DRAFT_TITLE,
    reason: "Aperçu UI du brouillon rendu en prose.",
  },
];

const SOURCE_LABEL: Record<string, string> = {
  sitemap: "sitemap.xml",
  "robots-sitemap": "sitemap (robots.txt)",
  "homepage-links": "liens accueil",
  "homepage-only": "accueil",
};

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
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

/** Matches Domaine: label + text-2xl title + h-5 badges row */
function DomainSkeleton() {
  return (
    <div aria-busy="true">
      <Skeleton className="h-4 w-16" />
      <Skeleton className="mt-2 h-8 w-[min(100%,28rem)]" />
      <div className="mt-3 flex flex-wrap gap-2">
        <Skeleton className="h-5 w-16 rounded-4xl" />
        <Skeleton className="h-5 w-28 rounded-4xl" />
      </div>
    </div>
  );
}

/** Matches topic cards: badge row + title + reason inside padded bordered block */
function TopicsSkeleton({ withLabel = false }: { withLabel?: boolean }) {
  return (
    <div aria-busy="true">
      {withLabel ? <Skeleton className="h-4 w-14" /> : null}
      <ul className={cn("space-y-3", withLabel ? "mt-4" : undefined)}>
        {[0, 1, 2].map((i) => (
          <li key={i}>
            <div
              className="w-full rounded-xl border border-transparent px-4 py-3"
              style={{ opacity: 1 - i * 0.12 }}
            >
              <Skeleton className="h-5 w-14 rounded-4xl" />
              <Skeleton
                className="mt-2 h-6"
                style={{ width: `${92 - i * 14}%` }}
              />
              <Skeleton
                className="mt-1 h-4"
                style={{ width: `${72 - i * 10}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Matches collapsed Mots-clés header (default closed) */
function KeywordsSkeleton() {
  return (
    <div
      className="flex items-center justify-between gap-3"
      aria-busy="true"
    >
      <Skeleton className="h-4 w-20" />
      <Skeleton className="h-4 w-16" />
    </div>
  );
}

/** Matches collapsed Pages header (default closed) */
function PagesSkeleton() {
  return (
    <div
      className="flex items-center justify-between gap-3"
      aria-busy="true"
    >
      <Skeleton className="h-4 w-14" />
      <Skeleton className="h-4 w-16" />
    </div>
  );
}

/** Matches draft pre block rhythm */
function DraftSkeleton() {
  return (
    <div
      className="mt-4 space-y-3 rounded-md border border-border bg-muted/40 p-4"
      aria-busy="true"
    >
      <Skeleton className="h-5 w-3/5" />
      <Skeleton className="h-4 w-2/5" />
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-[92%]" />
      <Skeleton className="h-3 w-[78%]" />
      <Skeleton className="mt-2 h-5 w-1/3" />
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-[88%]" />
      <Skeleton className="mt-2 h-5 w-2/5" />
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-[70%]" />
    </div>
  );
}

function AnalyzeStatus({ progress }: { progress: CrawlProgress }) {
  const isCrawl = progress.phase === "crawl" && progress.total > 0;
  const lineKey = isCrawl ? "crawl" : `phase:${progress.phase}:${progress.label}`;

  return (
    <StatusSwap
      lineKey={lineKey}
      className="mt-4 text-sm text-muted-foreground"
    >
      {isCrawl ? (
        <span className="inline-flex items-baseline gap-0.5">
          <NumberFlowValue value={progress.done} />
          <span>/</span>
          <span className="tabular-nums">{progress.total}</span>
          <span className="ml-1">pages…</span>
        </span>
      ) : (
        <span>{progress.label}</span>
      )}
    </StatusSwap>
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
  const router = useRouter();
  const demoDraft =
    router.isReady && router.query.demoDraft === "1";

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
  const [pagesOpen, setPagesOpen] = useState(false);

  const viewResult = result ?? (demoDraft ? DEMO_RESULT : null);
  const viewTopics = topics.length > 0 ? topics : demoDraft ? DEMO_TOPICS : [];
  const viewSelectedTopic =
    selectedTopic ?? (demoDraft ? DEMO_DRAFT_TITLE : null);
  const viewDraftMarkdown =
    draftMarkdown ?? (demoDraft ? DEMO_DRAFT_MARKDOWN : null);

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
    setPagesOpen(false);

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

  const showResults = Boolean(viewResult) && !analyzing;
  const showWorkspace = analyzing || showResults;

  return (
    <>
      <Head>
        <title>Blog Maker for Sanity</title>
        <meta
          name="description"
          content="Blog Maker for Sanity — URL → sujets IA → brouillon → publish Sanity."
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div className="studio-chrome sticky top-0 z-40">
        <div className="mx-auto flex h-12 w-full max-w-3xl items-center justify-between gap-3 px-5 sm:px-8">
          <div className="flex min-w-0 items-baseline gap-2">
            <span className="font-heading truncate text-[15px] font-semibold tracking-tight text-foreground">
              Blog Maker
            </span>
            <span className="shrink-0 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              for Sanity
            </span>
          </div>
          <span className="hidden text-xs text-muted-foreground sm:inline">
            Analyse → sujets → brouillon
          </span>
        </div>
      </div>

      <main className="relative mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-3xl flex-col px-5 pb-20 pt-8 sm:px-8 sm:pb-14 sm:pt-10">
        <header className="animate-rise space-y-1">
          <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground sm:text-[1.75rem]">
            Analyser un site
          </h1>
          <p className="max-w-xl text-sm text-muted-foreground">
            Crawl SEO, sujets IA et brouillon prêts pour Sanity Studio.
          </p>
        </header>

        <form
          onSubmit={onSubmit}
          className="analyze-form animate-rise-delay mt-6 flex w-full flex-col gap-2.5 sm:flex-row sm:items-center"
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
            className="h-10 flex-1 rounded-md bg-card px-3 text-sm shadow-none"
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

        {analyzing && progress ? (
          <AnalyzeStatus progress={progress} />
        ) : null}

        {error && !analyzing && (
          <StatusBlock
            message={error.message}
            action={error.action}
            tone="danger"
          />
        )}

        {showWorkspace && (
          <section className="mt-8 space-y-8">
            {/* 1. Domaine */}
            {analyzing && !viewResult ? (
              <DomainSkeleton />
            ) : viewResult ? (
              <div className="rounded-md border border-border bg-card p-4 sm:p-5">
                <SectionLabel>Domaine</SectionLabel>
                <p className="font-heading mt-2 text-xl font-semibold leading-snug text-foreground sm:text-2xl">
                  {viewResult.domainGuess}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Badge variant="secondary">
                    {viewResult.pagesAnalyzed} pages
                  </Badge>
                  <Badge variant="outline">
                    {SOURCE_LABEL[viewResult.discoverySource] ??
                      viewResult.discoverySource}
                  </Badge>
                  {viewResult.pagesFailed > 0 && (
                    <Badge variant="destructive">
                      {viewResult.pagesFailed} échec
                      {viewResult.pagesFailed > 1 ? "s" : ""}
                    </Badge>
                  )}
                </div>
              </div>
            ) : null}

            {/* 2. Plan éditorial (volume) — mis de côté pour V1 Sanity */}
            {/* {analyzing && !viewResult ? (
              <EditorialVolumePlanSkeleton />
            ) : viewResult ? (
              <EditorialVolumePlan />
            ) : null} */}

            {/* 3. Sujets + 4. Brouillon */}
            {analyzing && !viewResult ? (
              <TopicsSkeleton withLabel />
            ) : viewResult ? (
              <div className="rounded-md border border-border bg-card p-4 sm:p-5">
                <SectionLabel>Sujets</SectionLabel>
                {topicsLoading ? (
                  <div className="mt-4">
                    <TopicsSkeleton />
                  </div>
                ) : viewTopics.length > 0 ? (
                  <ul className="mt-3 space-y-2">
                    {viewTopics.map((topic) => {
                      const selected = viewSelectedTopic === topic.title;
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
                              "w-full rounded-md border px-3.5 py-2.5 text-left transition-colors",
                              selected
                                ? "border-primary/35 bg-accent"
                                : "border-transparent hover:bg-muted",
                            )}
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge
                                variant="secondary"
                                className="text-[10px] uppercase"
                              >
                                proposé
                              </Badge>
                              {selected ? (
                                <span className="text-xs text-muted-foreground">
                                  sélectionné
                                </span>
                              ) : null}
                            </div>
                            <p className="font-heading mt-1.5 text-base font-semibold leading-snug text-foreground sm:text-lg">
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

                {viewTopics.length > 0 && (
                  <div className="mt-4 flex flex-col gap-2.5 sm:flex-row sm:items-center">
                    <button
                      type="button"
                      className="button-02 button-02--compact"
                      disabled={!viewSelectedTopic || draftLoading}
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
                      Brouillon markdown — prochaine étape : publish Sanity.
                    </p>
                  </div>
                )}

                {(draftLoading || viewDraftMarkdown || draftError) && (
                  <div className="mt-6">
                    <SectionLabel>Brouillon</SectionLabel>
                    {draftLoading ? (
                      <DraftSkeleton />
                    ) : draftError ? (
                      <StatusBlock
                        message={draftError.message}
                        action={draftError.action}
                      />
                    ) : viewDraftMarkdown ? (
                      <MarkdownReader markdown={viewDraftMarkdown} />
                    ) : null}
                  </div>
                )}
              </div>
            ) : null}

            {/* 5. Mots-clés (évidence, replié) */}
            {analyzing && !viewResult ? (
              <KeywordsSkeleton />
            ) : viewResult ? (
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
                    {viewResult.keywords
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

                  {viewResult.keywords.length > 10 && (
                    <button
                      type="button"
                      className="mt-3 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
                      onClick={() => setShowAllKeywords((v) => !v)}
                    >
                      {showAllKeywords
                        ? "Voir moins"
                        : `Voir plus (${viewResult.keywords.length - 10})`}
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

            {/* 6. Blog détecté (secondaire) */}
            {viewResult && viewResult.blogPosts.length > 0 && (
              <div>
                <SectionLabel>Blog détecté</SectionLabel>
                <ul className="mt-4 space-y-2">
                  {viewResult.blogPosts.slice(0, 6).map((page) => (
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

            {/* 7. Pages (échantillon, replié) */}
            {analyzing && !viewResult ? (
              <PagesSkeleton />
            ) : viewResult && viewResult.pageSamples.length > 0 ? (
              <Collapsible open={pagesOpen} onOpenChange={setPagesOpen}>
                <div className="flex items-center justify-between gap-3">
                  <SectionLabel>Pages</SectionLabel>
                  <CollapsibleTrigger
                    className={cn(
                      "inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground",
                    )}
                  >
                    {pagesOpen ? "Masquer" : "Afficher"}
                    <ChevronDown
                      className={cn(
                        "size-4 transition-transform duration-300 ease-[cubic-bezier(0.165,0.84,0.44,1)]",
                        pagesOpen && "rotate-180",
                      )}
                    />
                  </CollapsibleTrigger>
                </div>
                <CollapsibleContent>
                  <Separator className="my-3" />
                  <ul className="space-y-2">
                    {viewResult.pageSamples.map((page) => (
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
                </CollapsibleContent>
              </Collapsible>
            ) : null}

            {viewResult && viewResult.warnings.length > 0 && (
              <ul className="space-y-1 text-sm text-muted-foreground">
                {viewResult.warnings.map((w) => (
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
