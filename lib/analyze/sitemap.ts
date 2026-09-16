/**
 * Découverte des pages à crawler : sitemap XML (index inclus)
 * ou repli sur les liens internes de la homepage.
 */
import {
  fetchText,
  sleep,
  FETCH_GAP_MS,
  MAX_SITEMAP_RAW,
  MAX_SITEMAP_URLS,
  originFromUrl,
  pageCacheKey,
  type FetchCache,
} from "./http";
import { prioritizePages } from "./page-priority";
import type { RobotsPolicy } from "./robots";

function extractLocs(xml: string): string[] {
  const locs: string[] = [];
  const re = /<loc>\s*([^<\s]+)\s*<\/loc>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(xml)) !== null) {
    locs.push(match[1].trim());
  }
  return locs;
}

function isSitemapIndex(xml: string): boolean {
  return /<sitemapindex[\s>]/i.test(xml);
}

function sameHost(candidate: string, origin: string): boolean {
  try {
    const u = new URL(candidate);
    const o = new URL(origin);
    return u.hostname === o.hostname || u.hostname.endsWith(`.${o.hostname}`);
  } catch {
    return false;
  }
}

/** Préfère les sitemaps produit/pages aux sitemaps auteurs / légal. */
function scoreSitemapChild(url: string): number {
  const u = url.toLowerCase();
  let score = 0;
  if (/author|auteurs?|tag|category|legal|privacy|cookie/.test(u)) score += 50;
  if (/page|product|produit|post|blog|content|main|fr/.test(u)) score -= 20;
  return score;
}

function uniqueByPageKey(urls: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const url of urls) {
    const key = pageCacheKey(url);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(url);
  }
  return out;
}

async function collectFromSitemap(
  sitemapUrl: string,
  origin: string,
  cache: FetchCache | undefined,
  depth = 0,
): Promise<string[]> {
  if (depth > 2) return [];

  const { status, text, contentType, cached } = await fetchText(sitemapUrl, {
    accept: "application/xml,text/xml,*/*;q=0.8",
    cache,
  });
  if (!cached) await sleep(FETCH_GAP_MS);

  if (status >= 400) return [];
  if (
    contentType &&
    !/xml|text|html/i.test(contentType) &&
    !text.includes("<")
  ) {
    return [];
  }

  const locs = extractLocs(text);
  if (locs.length === 0) return [];

  if (isSitemapIndex(text)) {
    const children = [...locs].sort(
      (a, b) => scoreSitemapChild(a) - scoreSitemapChild(b),
    );
    const nested: string[] = [];
    for (const child of children.slice(0, 8)) {
      if (!sameHost(child, origin) && !child.includes("sitemap")) continue;
      const more = await collectFromSitemap(child, origin, cache, depth + 1);
      nested.push(...more);
      if (nested.length >= MAX_SITEMAP_RAW) break;
    }
    return nested;
  }

  return locs.filter((loc) => sameHost(loc, origin));
}

/** Découverte légère : liens internes sur une page HTML (homepage ou landing). */
async function discoverLinksFromPage(
  pageUrl: string,
  cache?: FetchCache,
): Promise<string[]> {
  const { status, text, cached } = await fetchText(pageUrl, { cache });
  if (!cached) await sleep(FETCH_GAP_MS);
  if (status >= 400) return [pageUrl];

  const origin = originFromUrl(new URL(pageUrl));
  const hrefs = new Set<string>([pageUrl, origin]);

  const re = /href\s*=\s*["']([^"'#]+)["']/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    const raw = match[1].trim();
    if (
      raw.startsWith("mailto:") ||
      raw.startsWith("tel:") ||
      raw.startsWith("javascript:")
    ) {
      continue;
    }
    try {
      const absolute = new URL(raw, pageUrl);
      if (absolute.origin !== new URL(origin).origin) continue;
      absolute.hash = "";
      absolute.search = "";
      if (/\.(pdf|jpg|jpeg|png|gif|svg|webp|css|js|zip|xml)$/i.test(absolute.pathname)) {
        continue;
      }
      hrefs.add(absolute.toString());
    } catch {
      // ignore
    }
  }

  return [...hrefs];
}

async function discoverFromHomepage(
  origin: string,
  cache?: FetchCache,
): Promise<string[]> {
  return discoverLinksFromPage(origin, cache);
}

function rankDiscoveryPool(rawUrls: string[], siteUrl: URL): string[] {
  const parsed = uniqueByPageKey(rawUrls)
    .map((u) => {
      try {
        return new URL(u);
      } catch {
        return null;
      }
    })
    .filter((u): u is URL => Boolean(u));

  // Toujours injecter l'URL de départ dans le pool
  const startKey = pageCacheKey(siteUrl.toString());
  if (!parsed.some((u) => pageCacheKey(u.toString()) === startKey)) {
    parsed.unshift(siteUrl);
  }

  return prioritizePages(parsed, siteUrl, MAX_SITEMAP_URLS).map((u) =>
    u.toString(),
  );
}

export type PageDiscovery = {
  source: "sitemap" | "robots-sitemap" | "homepage-links" | "homepage-only";
  urls: string[];
  warnings: string[];
};

export async function discoverPages(
  siteUrl: URL,
  robots: RobotsPolicy,
  cache?: FetchCache,
): Promise<PageDiscovery> {
  const origin = originFromUrl(siteUrl);
  const warnings: string[] = [];
  const candidates = [
    ...robots.sitemapHints,
    `${origin}/sitemap.xml`,
    `${origin}/sitemap_index.xml`,
    `${origin}/sitemap-index.xml`,
  ];

  const tried = new Set<string>();
  for (const sitemapUrl of candidates) {
    if (!sitemapUrl || tried.has(sitemapUrl)) continue;
    tried.add(sitemapUrl);
    try {
      const urls = await collectFromSitemap(sitemapUrl, origin, cache);
      const unique = uniqueByPageKey(urls).slice(0, MAX_SITEMAP_RAW);
      if (unique.length > 0) {
        // Enrichit avec les liens de la landing saisie (souvent /fr/ produit)
        let merged = unique;
        try {
          const fromStart = await discoverLinksFromPage(
            siteUrl.toString(),
            cache,
          );
          merged = uniqueByPageKey([...fromStart, ...unique]).slice(
            0,
            MAX_SITEMAP_RAW,
          );
        } catch {
          // keep sitemap-only pool
        }
        return {
          source: robots.sitemapHints.includes(sitemapUrl)
            ? "robots-sitemap"
            : "sitemap",
          urls: rankDiscoveryPool(merged, siteUrl),
          warnings,
        };
      }
    } catch {
      // try next
    }
  }

  warnings.push(
    "Aucun sitemap exploitable trouvé — découverte via les liens de la page d'accueil.",
  );

  try {
    const discovered = await discoverFromHomepage(origin, cache);
    if (discovered.length > 1) {
      return {
        source: "homepage-links",
        urls: rankDiscoveryPool(
          discovered.slice(0, MAX_SITEMAP_RAW),
          siteUrl,
        ),
        warnings,
      };
    }
    return {
      source: "homepage-only",
      urls: [origin],
      warnings: [
        ...warnings,
        "Peu de liens internes détectés — analyse limitée à la page d'accueil.",
      ],
    };
  } catch {
    return {
      source: "homepage-only",
      urls: [origin],
      warnings: [
        ...warnings,
        "Échec de découverte étendue — analyse limitée à la page d'accueil.",
      ],
    };
  }
}
