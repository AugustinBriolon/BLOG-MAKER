import Head from "next/head";
import { FormEvent, useState } from "react";
import { ChevronDown } from "lucide-react";
import type { AnalyzeResult } from "@/lib/analyze";
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

type UiError = { message: string };

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
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex items-center justify-between gap-4 py-1">
          <Skeleton className="h-3" style={{ width: `${40 + ((i * 9) % 40)}%` }} />
          <Skeleton className="h-3 w-8" />
        </div>
      ))}
    </div>
  );
}

function TopicsSkeleton() {
  return (
    <div className="space-y-3" aria-busy="true">
      <Skeleton className="h-10 w-full max-w-lg" />
      <Skeleton className="h-10 w-4/5 max-w-md" />
      <Skeleton className="h-10 w-3/5 max-w-sm" />
    </div>
  );
}

export default function Home() {
  const [url, setUrl] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [topicsLoading, setTopicsLoading] = useState(false);
  const [error, setError] = useState<UiError | null>(null);
  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const [topicTitles, setTopicTitles] = useState<string[]>([]);
  const [topicsError, setTopicsError] = useState<string | null>(null);
  const [showAllKeywords, setShowAllKeywords] = useState(false);

  async function loadTopics(analysis: AnalyzeResult) {
    setTopicsLoading(true);
    setTopicsError(null);
    setTopicTitles([]);

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
        titles?: string[];
        error?: string;
        unavailable?: boolean;
      };

      if (!response.ok) {
        setTopicsError(data.error || "Sujets IA indisponibles.");
        return;
      }

      setTopicTitles(data.titles ?? []);
      if (data.unavailable || data.error) {
        setTopicsError(data.error || "Sujets IA indisponibles.");
      }
    } catch {
      setTopicsError("Sujets IA indisponibles.");
    } finally {
      setTopicsLoading(false);
    }
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setAnalyzing(true);
    setTopicsLoading(false);
    setError(null);
    setResult(null);
    setTopicTitles([]);
    setTopicsError(null);
    setShowAllKeywords(false);

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      const data = (await response.json()) as AnalyzeResult & {
        error?: string;
      };

      if (!response.ok) {
        setError({
          message: data.error || "L'analyse a échoué.",
        });
        setAnalyzing(false);
        return;
      }

      setResult(data);
      setAnalyzing(false);
      void loadTopics(data);
    } catch {
      setError({ message: "Serveur injoignable." });
      setAnalyzing(false);
    }
  }

  const showResults = Boolean(result) && !analyzing;

  return (
    <>
      <Head>
        <title>Blog Maker</title>
        <meta
          name="description"
          content="Analyse SEO : URL → mots-clés et sujets IA."
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <main className="relative mx-auto flex min-h-screen w-full max-w-3xl flex-col px-5 pb-16 pt-14 sm:px-8 sm:pt-20">
        <header className="animate-rise">
          <p className="font-heading text-5xl font-bold tracking-tight text-foreground sm:text-6xl">
            Blog Maker
          </p>
        </header>

        <form
          onSubmit={onSubmit}
          className="animate-rise-delay mt-10 flex w-full flex-col gap-3 sm:flex-row sm:items-center"
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

        {error && !analyzing && (
          <p role="alert" className="mt-8 text-sm text-destructive">
            {error.message}
          </p>
        )}

        {(analyzing || showResults) && (
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

              {analyzing && !result ? (
              <KeywordsSkeleton />
            ) : result ? (
              <div>
                <SectionLabel>Mots-clés</SectionLabel>
                <ol className="mt-4">
                  {result.keywords.slice(0, 10).map((kw, index) => (
                    <li
                      key={`${kw.kind}-${kw.term}`}
                      className="keyword-row text-sm"
                    >
                      <span className="flex min-w-0 items-baseline gap-3">
                        <span className="w-5 shrink-0 text-muted-foreground">
                          {index + 1}
                        </span>
                        <span className="truncate font-medium">{kw.term}</span>
                      </span>
                      <span className="shrink-0 tabular-nums text-chart-3">
                        {kw.count}
                      </span>
                    </li>
                  ))}
                </ol>

                {result.keywords.length > 10 && (
                  <Collapsible
                    open={showAllKeywords}
                    onOpenChange={setShowAllKeywords}
                    className="mt-2"
                  >
                    <CollapsibleContent>
                      <ol>
                        {result.keywords.slice(10).map((kw, index) => (
                          <li
                            key={`${kw.kind}-${kw.term}`}
                            className="keyword-row text-sm"
                          >
                            <span className="flex min-w-0 items-baseline gap-3">
                              <span className="w-5 shrink-0 text-muted-foreground">
                                {index + 11}
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
                    </CollapsibleContent>
                    <CollapsibleTrigger
                      className={cn(
                        "mt-3 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground",
                      )}
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
                    </CollapsibleTrigger>
                  </Collapsible>
                )}
              </div>
            ) : null}

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
                ) : topicTitles.length > 0 ? (
                  <ol className="mt-4 space-y-3">
                    {topicTitles.map((title, index) => (
                      <li
                        key={title}
                        className="font-heading text-lg font-semibold leading-snug text-foreground"
                      >
                        <span className="mr-2 text-sm font-normal text-muted-foreground">
                          {index + 1}.
                        </span>
                        {title}
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="mt-3 text-sm text-muted-foreground">
                    {topicsError || "Aucun sujet généré."}
                  </p>
                )}
              </div>
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
