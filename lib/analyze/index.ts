import { extractPageContent, type ExtractedPage } from "./extract";
import {
  AnalyzeError,
  FETCH_GAP_MS,
  MAX_PAGES,
  fetchText,
  normalizeSiteUrl,
  originFromUrl,
  sleep,
} from "./http";
import { analyzeKeywords, inferTopicsAndDomain, type KeywordHit } from "./keywords";
import { loadRobotsPolicy } from "./robots";
import { discoverPages } from "./sitemap";

export type AnalyzeResult = {
  siteUrl: string;
  host: string;
  discoverySource: string;
  pagesAnalyzed: number;
  pagesFailed: number;
  pageSamples: Array<{
    url: string;
    title: string;
    wordCount: number;
  }>;
  totalSignificantTokens: number;
  keywords: KeywordHit[];
  domainGuess: string;
  topics: string[];
  warnings: string[];
};

export async function analyzeSite(rawUrl: string): Promise<AnalyzeResult> {
  const siteUrl = normalizeSiteUrl(rawUrl);
  const origin = originFromUrl(siteUrl);
  const warnings: string[] = [];

  const robots = await loadRobotsPolicy(origin);
  const discovery = await discoverPages(siteUrl, robots);
  warnings.push(...discovery.warnings);

  const eligible = discovery.urls
    .map((u) => {
      try {
        return new URL(u);
      } catch {
        return null;
      }
    })
    .filter((u): u is URL => Boolean(u))
    .filter((u) => robots.allowsPath(u.pathname));

  if (eligible.length === 0) {
    throw new AnalyzeError(
      "Aucune page autorisée à analyser (robots.txt ou découverte vide).",
      422,
      "NO_PAGES",
    );
  }

  // Prefer homepage first, then diversity by path depth
  const sorted = [...eligible].sort((a, b) => {
    const aHome = a.pathname === "/" ? 0 : 1;
    const bHome = b.pathname === "/" ? 0 : 1;
    if (aHome !== bHome) return aHome - bHome;
    return a.pathname.split("/").length - b.pathname.split("/").length;
  });

  const targets = sorted.slice(0, MAX_PAGES);
  const pages: ExtractedPage[] = [];
  let pagesFailed = 0;

  for (const target of targets) {
    try {
      const { status, text, contentType, url } = await fetchText(target.toString());
      await sleep(FETCH_GAP_MS);

      if (status >= 400) {
        pagesFailed += 1;
        continue;
      }
      if (contentType && !/html|xml|text/i.test(contentType)) {
        pagesFailed += 1;
        continue;
      }

      const extracted = extractPageContent(text, url);
      if (extracted.wordCount < 20) {
        warnings.push(`Peu de texte extrait sur ${url}`);
      }
      pages.push(extracted);
    } catch {
      pagesFailed += 1;
    }
  }

  if (pages.length === 0) {
    throw new AnalyzeError(
      "Impossible d'extraire du contenu textuel des pages trouvées.",
      502,
      "NO_CONTENT",
    );
  }

  const corpus = pages
    .map((p) => [p.title, p.description, p.text].filter(Boolean).join("\n"))
    .join("\n\n");

  const { keywords, totalSignificantTokens } = analyzeKeywords(corpus, {
    topN: 40,
  });

  if (keywords.length === 0) {
    warnings.push(
      "Aucun terme significatif récurrent — le site est peut-être trop court ou trop générique.",
    );
  }

  const { domainGuess, topics } = inferTopicsAndDomain(
    keywords,
    siteUrl.hostname,
    pages.map((p) => p.title),
  );

  return {
    siteUrl: origin,
    host: siteUrl.hostname.replace(/^www\./, ""),
    discoverySource: discovery.source,
    pagesAnalyzed: pages.length,
    pagesFailed,
    pageSamples: pages.slice(0, 8).map((p) => ({
      url: p.url,
      title: p.title || "(sans titre)",
      wordCount: p.wordCount,
    })),
    totalSignificantTokens,
    keywords,
    domainGuess,
    topics,
    warnings: [...new Set(warnings)].slice(0, 12),
  };
}

export { AnalyzeError, normalizeSiteUrl };
export type { KeywordHit } from "./keywords";
