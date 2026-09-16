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

function LoadingSkeleton() {
  return (
    <section
      className="animate-rise-late mt-12 space-y-10"
      aria-busy="true"
      aria-live="polite"
    >
      <div>
        <div className="skeleton h-3 w-28" />
        <div className="skeleton skeleton-block mt-3 h-8 w-full max-w-xl" />
        <div className="mt-5 grid grid-cols-2 gap-3 sm:max-w-md">
          <div className="skeleton skeleton-block h-12" />
          <div className="skeleton skeleton-block h-12" />
        </div>
      </div>

      <div>
        <div className="skeleton h-3 w-24" />
        <div className="mt-4 flex flex-wrap gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="skeleton h-8"
              style={{ width: `${72 + ((i * 17) % 48)}px` }}
            />
          ))}
        </div>
      </div>

      <div>
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
    </section>
  );
}

export default function Home() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<UiError | null>(null);
  const [result, setResult] = useState<AnalyzeResult | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

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
        return;
      }

      setResult(data);
    } catch {
      setError({ message: "Serveur injoignable." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Head>
        <title>Blog Maker</title>
        <meta
          name="description"
          content="Analyse SEO : URL → mots-clés et sujets."
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

          <form onSubmit={onSubmit} className="poc-form animate-rise-delay mt-10">
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
              disabled={loading}
            />
            <button
              type="submit"
              className="button-02"
              disabled={loading || !url.trim()}
              aria-label="Analyser"
            >
              <span className="inner">Analyser</span>
              <span className="circle" aria-hidden="true">
                <span />
              </span>
            </button>
          </form>

          {loading && <LoadingSkeleton />}

          {error && !loading && (
            <div
              role="alert"
              className="animate-rise-late mt-8 text-sm text-red-800"
            >
              {error.message}
            </div>
          )}

          {result && !loading && (
            <section className="result-section animate-rise-late mt-12 space-y-10">
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

              <div>
                <h2 className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
                  Sujets
                </h2>
                <ul className="mt-4 flex flex-wrap gap-2">
                  {result.topics.map((topic) => (
                    <li key={topic} className="topic-chip">
                      {topic}
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h2 className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
                  Mots-clés
                </h2>
                <ol className="mt-4">
                  {result.keywords.map((kw, index) => (
                    <li
                      key={`${kw.kind}-${kw.term}`}
                      className="keyword-row text-sm"
                    >
                      <span className="flex min-w-0 items-baseline gap-3">
                        <span className="w-5 shrink-0 text-[var(--muted)]">
                          {index + 1}
                        </span>
                        <span className="truncate font-medium">{kw.term}</span>
                      </span>
                      <span className="shrink-0 tabular-nums text-[var(--accent)]">
                        {kw.count}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>

              {result.pageSamples.length > 0 && (
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

              {result.warnings.length > 0 && (
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
