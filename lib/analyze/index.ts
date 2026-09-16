/**
 * Orchestration de l'analyse site : robots → sitemap → crawl → mots-clés.
 * Point d'entrée `analyzeSite` et mapping des erreurs pour l'UI.
 */
import { detectBlogPosts, type BlogPostRef } from "./blog-posts";
import { extractPageContent, type ExtractedPage } from "./extract";
import {
  AnalyzeError,
  FETCH_GAP_MS,
  MAX_PAGES,
  fetchText,
  normalizeSiteUrl,
  originFromUrl,
  pageCacheKey,
  sleep,
  type FetchCache,
} from "./http";
import {
  analyzeKeywords,
  authorDemoteTerms,
  FIELD_WEIGHTS,
  inferDomain,
  pageWeightForUrl,
  type KeywordHit,
  type WeightedSegment,
} from "./keywords";
import { prioritizePages } from "./page-priority";
import { loadRobotsPolicy } from "./robots";
import { discoverPages } from "./sitemap";

export type AnalyzeProgress = {
  phase: "robots" | "sitemap" | "crawl" | "keywords" | "done";
  done: number;
  total: number;
  label: string;
};

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
  blogPosts: BlogPostRef[];
  totalSignificantTokens: number;
  keywords: KeywordHit[];
  domainGuess: string;
  warnings: string[];
};

export type AnalyzeOptions = {
  onProgress?: (progress: AnalyzeProgress) => void;
};

function report(
  onProgress: AnalyzeOptions["onProgress"],
  progress: AnalyzeProgress,
) {
  onProgress?.(progress);
}

/** Map error codes to a clear line + next action for the UI. */
export function explainAnalyzeError(error: AnalyzeError): {
  message: string;
  action: string;
} {
  switch (error.code) {
    case "EMPTY_URL":
    case "INVALID_URL":
    case "INVALID_PROTOCOL":
    case "INVALID_HOST":
      return {
        message: error.message,
        action: "Corrigez l’URL (ex. https://exemple.com) puis réessayez.",
      };
    case "NO_PAGES":
    case "ROBOTS_DISALLOW":
      return {
        message: "Site bloqué ou aucune page autorisée (robots.txt).",
        action:
          "Essayez la page d’accueil publique, ou un autre domaine accessible.",
      };
    case "NO_CONTENT":
      return {
        message: "Impossible d’extraire du texte utile sur ce site.",
        action:
          "Vérifiez que le site répond en HTML public (pas de login / mur).",
      };
    case "FETCH_TIMEOUT":
    case "FETCH_FAILED":
      return {
        message: "Échec de récupération des pages (réseau ou timeout).",
        action: "Réessayez dans un instant, ou testez une autre URL.",
      };
    default:
      return {
        message: error.message || "L’analyse a échoué.",
        action: "Réessayez, ou changez d’URL.",
      };
  }
}

export async function analyzeSite(
  rawUrl: string,
  options: AnalyzeOptions = {},
): Promise<AnalyzeResult> {
  const { onProgress } = options;
  const siteUrl = normalizeSiteUrl(rawUrl);
  const origin = originFromUrl(siteUrl);
  const warnings: string[] = [];
  /** Mémoire fetch d'une seule analyse (discovery ↔ crawl). */
  const fetchCache: FetchCache = new Map();

  report(onProgress, {
    phase: "robots",
    done: 0,
    total: MAX_PAGES,
    label: "Lecture de robots.txt…",
  });
  const robots = await loadRobotsPolicy(origin, fetchCache);

  report(onProgress, {
    phase: "sitemap",
    done: 0,
    total: MAX_PAGES,
    label: "Recherche du sitemap…",
  });
  const discovery = await discoverPages(siteUrl, robots, fetchCache);
  warnings.push(...discovery.warnings);

  const seenEligible = new Set<string>();
  const eligible: URL[] = [];
  for (const raw of discovery.urls) {
    let u: URL;
    try {
      u = new URL(raw);
    } catch {
      continue;
    }
    if (!robots.allowsPath(u.pathname)) continue;
    const key = pageCacheKey(u.toString());
    if (seenEligible.has(key)) continue;
    seenEligible.add(key);
    eligible.push(u);
  }

  // Always consider the URL saisie (landing / locale) si robots l'autorise
  if (robots.allowsPath(siteUrl.pathname)) {
    const startKey = pageCacheKey(siteUrl.toString());
    if (!seenEligible.has(startKey)) {
      seenEligible.add(startKey);
      eligible.unshift(siteUrl);
    }
  }

  if (eligible.length === 0) {
    throw new AnalyzeError(
      "Aucune page autorisée à analyser (robots.txt ou découverte vide).",
      422,
      "NO_PAGES",
    );
  }

  // Prefer product / landing / blog (locale-aware); demote legal / author / login…
  const targets = prioritizePages(eligible, siteUrl, MAX_PAGES);
  const total = targets.length;
  const pages: ExtractedPage[] = [];
  let pagesFailed = 0;

  for (let i = 0; i < targets.length; i++) {
    const target = targets[i];
    report(onProgress, {
      phase: "crawl",
      done: i,
      total,
      label: `Crawl ${i}/${total} pages…`,
    });

    try {
      const { status, text, contentType, url, cached } = await fetchText(
        target.toString(),
        { cache: fetchCache },
      );
      // Gap poli uniquement après un vrai aller-réseau (pas sur cache hit / dernière page)
      if (!cached && i < targets.length - 1) {
        await sleep(FETCH_GAP_MS);
      }

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

    report(onProgress, {
      phase: "crawl",
      done: i + 1,
      total,
      label: `Crawl ${i + 1}/${total} pages…`,
    });
  }

  if (pages.length === 0) {
    throw new AnalyzeError(
      "Impossible d'extraire du contenu textuel des pages trouvées.",
      502,
      "NO_CONTENT",
    );
  }

  report(onProgress, {
    phase: "keywords",
    done: total,
    total,
    label: "Extraction des mots-clés…",
  });

  const segments: WeightedSegment[] = [];
  const authorNames: string[] = [];

  for (const page of pages) {
    const pageW = pageWeightForUrl(page.url, siteUrl);
    const push = (text: string, fieldW: number, kind: "seo" | "body") => {
      if (!text?.trim()) return;
      const pageMul = kind === "seo" ? pageW.seo : pageW.body;
      segments.push({ text, weight: pageMul * fieldW });
    };
    push(page.title, FIELD_WEIGHTS.title, "seo");
    push(page.ogTitle, FIELD_WEIGHTS.ogTitle, "seo");
    push(page.h1, FIELD_WEIGHTS.h1, "seo");
    push(page.description, FIELD_WEIGHTS.description, "seo");
    push(page.ogDescription, FIELD_WEIGHTS.ogDescription, "seo");
    push(page.text, FIELD_WEIGHTS.body, "body");

    authorNames.push(...page.authors);
  }

  const extraDemote = authorDemoteTerms([...new Set(authorNames)]);
  // Filtrer les faux positifs Title Case métier déjà exclus côté extract
  for (const bad of [
    "information technology",
    "information",
    "technology",
  ]) {
    extraDemote.delete(bad);
  }

  const { keywords, totalSignificantTokens } = analyzeKeywords(segments, {
    topN: 40,
    siteHost: siteUrl.hostname,
    extraDemote,
  });

  if (keywords.length === 0) {
    warnings.push(
      "Aucun terme significatif récurrent — le site est peut-être trop court ou trop générique.",
    );
  }

  const pageRefs = pages.map((p) => ({
    url: p.url,
    title: p.title || "(sans titre)",
  }));
  const blogPosts = detectBlogPosts(pageRefs);
  const domainGuess = inferDomain(keywords, siteUrl.hostname, extraDemote);

  const result: AnalyzeResult = {
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
    blogPosts,
    totalSignificantTokens,
    keywords,
    domainGuess,
    warnings: [...new Set(warnings)].slice(0, 12),
  };

  report(onProgress, {
    phase: "done",
    done: total,
    total,
    label: "Analyse terminée",
  });

  return result;
}

export { AnalyzeError, normalizeSiteUrl, MAX_PAGES };
export type { KeywordHit } from "./keywords";
export type { BlogPostRef } from "./blog-posts";
