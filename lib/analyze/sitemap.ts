/**
 * Découverte des pages à crawler : sitemap XML (index inclus)
 * ou repli sur les liens internes de la homepage.
 */
import {
  fetchText,
  sleep,
  FETCH_GAP_MS,
  MAX_SITEMAP_URLS,
  originFromUrl,
} from "./http";
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

async function collectFromSitemap(
  sitemapUrl: string,
  origin: string,
  depth = 0,
): Promise<string[]> {
  if (depth > 2) return [];

  const { status, text, contentType } = await fetchText(sitemapUrl, {
    accept: "application/xml,text/xml,*/*;q=0.8",
  });
  await sleep(FETCH_GAP_MS);

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
    const nested: string[] = [];
    for (const child of locs.slice(0, 5)) {
      if (!sameHost(child, origin) && !child.includes("sitemap")) continue;
      const more = await collectFromSitemap(child, origin, depth + 1);
      nested.push(...more);
      if (nested.length >= MAX_SITEMAP_URLS) break;
    }
    return nested;
  }

  return locs.filter((loc) => sameHost(loc, origin));
}

/** Découverte légère : liens internes sur la homepage. */
async function discoverFromHomepage(origin: string): Promise<string[]> {
  const { status, text } = await fetchText(origin);
  await sleep(FETCH_GAP_MS);
  if (status >= 400) return [origin];

  const hrefs = new Set<string>([origin]);
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
      const absolute = new URL(raw, origin);
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

export type PageDiscovery = {
  source: "sitemap" | "robots-sitemap" | "homepage-links" | "homepage-only";
  urls: string[];
  warnings: string[];
};

export async function discoverPages(
  siteUrl: URL,
  robots: RobotsPolicy,
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
      const urls = await collectFromSitemap(sitemapUrl, origin);
      const unique = [...new Set(urls)].slice(0, MAX_SITEMAP_URLS);
      if (unique.length > 0) {
        return {
          source: robots.sitemapHints.includes(sitemapUrl)
            ? "robots-sitemap"
            : "sitemap",
          urls: unique,
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
    const discovered = await discoverFromHomepage(origin);
    if (discovered.length > 1) {
      return {
        source: "homepage-links",
        urls: discovered.slice(0, MAX_SITEMAP_URLS),
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
