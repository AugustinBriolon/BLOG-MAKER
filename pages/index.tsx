import Head from "next/head";
import { Bricolage_Grotesque, Figtree } from "next/font/google";
import { FormEvent, useState } from "react";
import type { AnalyzeResult } from "@/lib/analyze";
import { MAX_PAGES } from "@/lib/analyze/http";

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
  "homepage-links": "liens de la page d'accueil",
  "homepage-only": "page d'accueil seule",
};

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
          message: data.error || "L'analyse a échoué. Réessayez.",
        });
        return;
      }

      setResult(data);
    } catch {
      setError({
        message:
          "Impossible de joindre le serveur d'analyse. Vérifiez votre connexion.",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Head>
        <title>Blog Maker — mots-clés SEO</title>
        <meta
          name="description"
          content="POC Blog Maker : analysez une URL pour inférer mots-clés et sujets de blog."
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div
        className={`${bricolage.variable} ${figtree.variable} min-h-screen text-[var(--ink)]`}
      >
        <div className="pointer-events-none fixed inset-0 overflow-hidden">
          <div className="absolute -left-24 top-24 h-72 w-72 rounded-full bg-[var(--glow)] blur-3xl" />
          <div className="absolute right-0 top-0 h-96 w-96 rounded-full bg-[rgba(20,53,44,0.18)] blur-3xl" />
        </div>

        <main className="relative mx-auto flex min-h-screen w-full max-w-5xl flex-col px-5 pb-20 pt-10 sm:px-8 sm:pt-14">
          <header className="animate-rise">
            <p className="font-[family-name:var(--font-bricolage)] text-4xl font-bold tracking-tight text-[var(--bg-deep)] sm:text-6xl">
              Blog Maker
            </p>
            <h1 className="mt-4 max-w-2xl font-[family-name:var(--font-bricolage)] text-2xl font-semibold leading-tight text-[var(--bg-mid)] sm:text-3xl">
              Trouvez les mots-clés SEO de votre site
            </h1>
            <p className="mt-3 max-w-xl text-base leading-relaxed text-[var(--muted)] sm:text-lg">
              Collez l&apos;URL d&apos;un site : on lit le sitemap, on extrait le
              texte utile, puis on remonte les termes et sujets pour positionner
              un blog.
            </p>
          </header>

          <form
            onSubmit={onSubmit}
            className="animate-rise-delay mt-10 flex w-full flex-col gap-3 sm:flex-row sm:items-stretch"
          >
            <label className="sr-only" htmlFor="site-url">
              URL du site
            </label>
            <input
              id="site-url"
              type="url"
              inputMode="url"
              required
              placeholder="https://exemple.com"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={loading}
              className="w-full flex-1 rounded-2xl border border-[var(--line)] bg-white/80 px-4 py-3.5 text-base shadow-[0_10px_40px_rgba(16,36,30,0.06)] outline-none backdrop-blur transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-soft)] disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={loading || !url.trim()}
              className="rounded-2xl bg-[var(--bg-deep)] px-6 py-3.5 text-base font-semibold text-[var(--bg-soft)] transition hover:bg-[var(--bg-mid)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Analyse…" : "Analyser"}
            </button>
          </form>

          {loading && (
            <section
              className="animate-rise-late mt-10 space-y-4"
              aria-live="polite"
            >
              <div className="flex items-center gap-3 text-[var(--muted)]">
                <span className="loader-orb inline-block h-3 w-3 rounded-full bg-[var(--accent)]" />
                Récupération du sitemap et extraction du contenu…
              </div>
              <div className="skeleton h-24 rounded-2xl" />
              <div className="skeleton h-40 rounded-2xl" />
            </section>
          )}

          {error && !loading && (
            <div
              role="alert"
              className="animate-rise-late mt-8 rounded-2xl border border-red-200 bg-red-50/90 px-4 py-3 text-red-900"
            >
              {error.message}
            </div>
          )}

          {result && !loading && (
            <section className="animate-rise-late mt-12 space-y-10">
              <div className="grid gap-6 sm:grid-cols-[1.2fr_0.8fr]">
                <div>
                  <p className="text-sm uppercase tracking-[0.14em] text-[var(--muted)]">
                    Domaine inféré
                  </p>
                  <p className="mt-2 font-[family-name:var(--font-bricolage)] text-2xl font-semibold leading-snug text-[var(--bg-deep)]">
                    {result.domainGuess}
                  </p>
                </div>
                <dl className="grid grid-cols-2 gap-4 text-sm text-[var(--muted)]">
                  <div>
                    <dt>Pages analysées</dt>
                    <dd className="mt-1 text-xl font-semibold text-[var(--ink)]">
                      {result.pagesAnalyzed}
                    </dd>
                  </div>
                  <div>
                    <dt>Source</dt>
                    <dd className="mt-1 text-xl font-semibold text-[var(--ink)]">
                      {SOURCE_LABEL[result.discoverySource] ??
                        result.discoverySource}
                    </dd>
                  </div>
                  <div>
                    <dt>Jetons utiles</dt>
                    <dd className="mt-1 text-xl font-semibold text-[var(--ink)]">
                      {result.totalSignificantTokens}
                    </dd>
                  </div>
                  <div>
                    <dt>Échecs fetch</dt>
                    <dd className="mt-1 text-xl font-semibold text-[var(--ink)]">
                      {result.pagesFailed}
                    </dd>
                  </div>
                </dl>
              </div>

              <div>
                <h2 className="font-[family-name:var(--font-bricolage)] text-xl font-semibold text-[var(--bg-deep)]">
                  Sujets suggérés
                </h2>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  Pistes de positionnement blog à partir du corpus.
                </p>
                <ul className="mt-4 flex flex-wrap gap-2">
                  {result.topics.map((topic) => (
                    <li
                      key={topic}
                      className="rounded-full border border-[var(--line)] bg-white/70 px-3 py-1.5 text-sm text-[var(--ink)]"
                    >
                      {topic}
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h2 className="font-[family-name:var(--font-bricolage)] text-xl font-semibold text-[var(--bg-deep)]">
                  Top mots-clés
                </h2>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  Termes significatifs (stopwords FR/EN exclus).
                </p>
                <ol className="mt-5 divide-y divide-[var(--line)] border-y border-[var(--line)]">
                  {result.keywords.map((kw, index) => (
                    <li
                      key={`${kw.kind}-${kw.term}`}
                      className="flex items-baseline justify-between gap-4 py-2.5"
                    >
                      <span className="flex min-w-0 items-baseline gap-3">
                        <span className="w-6 shrink-0 text-sm text-[var(--muted)]">
                          {index + 1}
                        </span>
                        <span className="truncate font-medium">{kw.term}</span>
                        <span className="shrink-0 text-xs uppercase tracking-wide text-[var(--muted)]">
                          {kw.kind === "bigram" ? "bi" : "mono"}
                        </span>
                      </span>
                      <span className="shrink-0 tabular-nums text-[var(--accent)]">
                        {kw.count}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>

              <div>
                <h2 className="font-[family-name:var(--font-bricolage)] text-xl font-semibold text-[var(--bg-deep)]">
                  Pages échantillonnées
                </h2>
                <ul className="mt-4 space-y-3">
                  {result.pageSamples.map((page) => (
                    <li key={page.url} className="text-sm">
                      <a
                        href={page.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-[var(--bg-mid)] underline-offset-2 hover:underline"
                      >
                        {page.title}
                      </a>
                      <p className="truncate text-[var(--muted)]">{page.url}</p>
                      <p className="text-[var(--muted)]">
                        ~{page.wordCount} mots extraits
                      </p>
                    </li>
                  ))}
                </ul>
              </div>

              {result.warnings.length > 0 && (
                <div className="rounded-2xl border border-[var(--line)] bg-white/50 px-4 py-3">
                  <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
                    Avertissements
                  </h2>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[var(--muted)]">
                    {result.warnings.map((w) => (
                      <li key={w}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          )}

          <footer className="mt-auto pt-16 text-sm text-[var(--muted)]">
            POC Blog Maker — pas d&apos;auth, pas de génération d&apos;articles.
            Crawl plafonné ({MAX_PAGES} pages) et espacé.
          </footer>
        </main>
      </div>
    </>
  );
}
