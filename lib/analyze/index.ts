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
  sleep,
} from "./http";
import { analyzeKeywords, inferDomain, type KeywordHit } from "./keywords";
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

  report(onProgress, {
    phase: "robots",
    done: 0,
    total: MAX_PAGES,
    label: "Lecture de robots.txt…",
  });
  const robots = await loadRobotsPolicy(origin);

  report(onProgress, {
    phase: "sitemap",
    done: 0,
    total: MAX_PAGES,
    label: "Recherche du sitemap…",
  });
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

  const sorted = [...eligible].sort((a, b) => {
    const aHome = a.pathname === "/" ? 0 : 1;
    const bHome = b.pathname === "/" ? 0 : 1;
    if (aHome !== bHome) return aHome - bHome;
    return a.pathname.split("/").length - b.pathname.split("/").length;
  });

  const targets = sorted.slice(0, MAX_PAGES);
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
      const { status, text, contentType, url } = await fetchText(
        target.toString(),
      );
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

  const corpus = pages
    .map((p) => [p.title, p.description, p.text].filter(Boolean).join("\n"))
    .join("\n\n");

  const { keywords, totalSignificantTokens } = analyzeKeywords(corpus, {
    topN: 40,
    siteHost: siteUrl.hostname,
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
  const domainGuess = inferDomain(keywords, siteUrl.hostname);

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
