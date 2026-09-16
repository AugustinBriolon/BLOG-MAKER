import Head from "next/head";
import { Bricolage_Grotesque, Figtree } from "next/font/google";
import { FormEvent, useState } from "react";
import type { AnalyzeResult } from "@/lib/analyze";

const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-bricolage",
});

const figtree = Figtree({
  subsets: ["latin"],
  variable: "--font-figtree",
});

type UiError = { message: string };

const SOURCE_LABEL: Record<string, string> = {
  sitemap: "sitemap.xml",
  "robots-sitemap": "sitemap (robots.txt)",
  "homepage-links": "liens accueil",
  "homepage-only": "accueil",
};

function DomainSkeleton() {
  return (
    <div aria-busy="true">
      <div className="skeleton h-3 w-28" />
      <div className="skeleton skeleton-block mt-3 h-8 w-full max-w-xl" />
      <div className="mt-5 grid grid-cols-2 gap-3 sm:max-w-md">
        <div className="skeleton skeleton-block h-12" />
        <div className="skeleton skeleton-block h-12" />
      </div>
    </div>
  );
}

function KeywordsSkeleton() {
  return (
    <div aria-busy="true">
      <div className="skeleton h-3 w-32" />
      <div className="mt-5 space-y-0">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center justify-between gap-4 border-b border-[var(--line)] py-3 first:border-t"
          >
            <div className="flex flex-1 items-center gap-3">
              <div className="skeleton h-3 w-5" />
              <div
                className="skeleton h-3"
                style={{ width: `${38 + ((i * 11) % 42)}%` }}
              />
            </div>
            <div className="skeleton h-3 w-8" />
          </div>
        ))}
      </div>
    </div>
  );
}

function TopicsSkeleton() {
  return (
    <div className="space-y-3" aria-busy="true">
      <div className="skeleton skeleton-block h-10 w-full max-w-lg" />
      <div className="skeleton skeleton-block h-10 w-4/5 max-w-md" />
      <div className="skeleton skeleton-block h-10 w-3/5 max-w-sm" />
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

      // Paint keywords/domain immediately — topics load separately
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

      <div
        className={`${bricolage.variable} ${figtree.variable} min-h-screen text-[var(--ink)]`}
      >
        <div className="pointer-events-none fixed inset-0 overflow-hidden">
          <div className="absolute -left-24 top-24 h-72 w-72 rounded-full bg-[var(--glow)] blur-3xl" />
          <div className="absolute right-0 top-0 h-96 w-96 rounded-full bg-[rgba(20,53,44,0.16)] blur-3xl" />
        </div>

        <main className="relative mx-auto flex min-h-screen w-full max-w-3xl flex-col px-5 pb-16 pt-14 sm:px-8 sm:pt-20">
          <header className="animate-rise">
            <p className="font-[family-name:var(--font-bricolage)] text-5xl font-bold tracking-tight text-[var(--bg-deep)] sm:text-6xl">
              Blog Maker
            </p>
          </header>

          <form
            onSubmit={onSubmit}
            className="poc-form animate-rise-delay mt-10"
          >
            <label className="sr-only" htmlFor="site-url">
              URL du site
            </label>
            <input
              id="site-url"
              className="poc-input"
              type="url"
              inputMode="url"
              required
              placeholder="https://exemple.com"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={analyzing}
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
            <div role="alert" className="mt-8 text-sm text-red-800">
              {error.message}
            </div>
          )}

          {(analyzing || showResults) && (
            <section className="result-section mt-12 space-y-10">
              {/* Domaine */}
              {analyzing && !result ? (
                <DomainSkeleton />
              ) : result ? (
                <div>
                  <p className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
                    Domaine
                  </p>
                  <p className="mt-2 font-[family-name:var(--font-bricolage)] text-2xl font-semibold leading-snug text-[var(--bg-deep)]">
                    {result.domainGuess}
                  </p>
                  <p className="mt-3 text-sm text-[var(--muted)]">
                    {result.pagesAnalyzed} pages ·{" "}
                    {SOURCE_LABEL[result.discoverySource] ??
                      result.discoverySource}
                    {result.pagesFailed > 0
                      ? ` · ${result.pagesFailed} échec${result.pagesFailed > 1 ? "s" : ""}`
                      : ""}
                  </p>
                </div>
              ) : null}

              {/* Mots-clés */}
              {analyzing && !result ? (
                <KeywordsSkeleton />
              ) : result ? (
                <div>
                  <h2 className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
                    Mots-clés
                  </h2>
                  <ol className="mt-4">
                    {(showAllKeywords
                      ? result.keywords
                      : result.keywords.slice(0, 10)
                    ).map((kw, index) => (
                      <li
                        key={`${kw.kind}-${kw.term}`}
                        className="keyword-row text-sm"
                      >
                        <span className="flex min-w-0 items-baseline gap-3">
                          <span className="w-5 shrink-0 text-[var(--muted)]">
                            {index + 1}
                          </span>
                          <span className="truncate font-medium">
                            {kw.term}
                          </span>
                        </span>
                        <span className="shrink-0 tabular-nums text-[var(--accent)]">
                          {kw.count}
                        </span>
                      </li>
                    ))}
                  </ol>
                  {result.keywords.length > 10 && (
                    <button
                      type="button"
                      className="voir-plus"
                      onClick={() => setShowAllKeywords((v) => !v)}
                      aria-expanded={showAllKeywords}
                    >
                      {showAllKeywords
                        ? "Voir moins"
                        : `Voir plus (${result.keywords.length - 10})`}
                    </button>
                  )}
                </div>
              ) : null}

              {/* Sujets IA — step séparée (peut rester en skeleton) */}
              {analyzing && !result ? (
                <div>
                  <div className="skeleton h-3 w-24 mb-4" />
                  <TopicsSkeleton />
                </div>
              ) : result ? (
                <div>
                  <h2 className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
                    Sujets
                  </h2>
                  {topicsLoading ? (
                    <div className="mt-4">
                      <TopicsSkeleton />
                    </div>
                  ) : topicTitles.length > 0 ? (
                    <ol className="mt-4 space-y-3">
                      {topicTitles.map((title, index) => (
                        <li
                          key={title}
                          className="font-[family-name:var(--font-bricolage)] text-lg font-semibold leading-snug text-[var(--bg-deep)]"
                        >
                          <span className="mr-2 text-sm font-normal text-[var(--muted)]">
                            {index + 1}.
                          </span>
                          {title}
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p className="mt-3 text-sm text-[var(--muted)]">
                      {topicsError || "Aucun sujet généré."}
                    </p>
                  )}
                </div>
              ) : null}

              {result && result.blogPosts.length > 0 && (
                <div>
                  <h2 className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
                    Blog détecté
                  </h2>
                  <ul className="mt-4 space-y-2">
                    {result.blogPosts.slice(0, 6).map((page) => (
                      <li key={page.url} className="text-sm">
                        <a
                          href={page.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="page-link"
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
                  <h2 className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
                    Pages
                  </h2>
                  <ul className="mt-4 space-y-2">
                    {result.pageSamples.map((page) => (
                      <li key={page.url} className="text-sm">
                        <a
                          href={page.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="page-link"
                        >
                          {page.title}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {result && result.warnings.length > 0 && (
                <ul className="space-y-1 text-sm text-[var(--muted)]">
                  {result.warnings.map((w) => (
                    <li key={w}>· {w}</li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </main>
      </div>
    </>
  );
}
