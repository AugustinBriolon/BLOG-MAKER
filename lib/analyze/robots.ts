import { fetchText, sleep, FETCH_GAP_MS, AnalyzeError } from "./http";

export type RobotsPolicy = {
  fetched: boolean;
  allowsPath: (path: string) => boolean;
  sitemapHints: string[];
};

const ALLOW_ALL: RobotsPolicy = {
  fetched: false,
  allowsPath: () => true,
  sitemapHints: [],
};

/**
 * Parse basique de robots.txt pour User-agent: * (POC).
 * En cas d'échec, on autorise par défaut (politesse best-effort).
 */
export async function loadRobotsPolicy(origin: string): Promise<RobotsPolicy> {
  try {
    const { status, text } = await fetchText(`${origin}/robots.txt`, {
      accept: "text/plain,*/*;q=0.8",
    });
    await sleep(FETCH_GAP_MS);

    if (status >= 400) {
      return ALLOW_ALL;
    }

    const lines = text.split(/\r?\n/);
    let inStar = false;
    const disallows: string[] = [];
    const allows: string[] = [];
    const sitemapHints: string[] = [];

    for (const raw of lines) {
      const line = raw.replace(/#.*$/, "").trim();
      if (!line) continue;

      const lower = line.toLowerCase();
      if (lower.startsWith("user-agent:")) {
        const agent = line.slice("user-agent:".length).trim().toLowerCase();
        inStar = agent === "*";
        continue;
      }

      if (lower.startsWith("sitemap:")) {
        const loc = line.slice("sitemap:".length).trim();
        if (loc) sitemapHints.push(loc);
        continue;
      }

      if (!inStar) continue;

      if (lower.startsWith("disallow:")) {
        const path = line.slice("disallow:".length).trim();
        if (path) disallows.push(path);
        continue;
      }

      if (lower.startsWith("allow:")) {
        const path = line.slice("allow:".length).trim();
        if (path) allows.push(path);
      }
    }

    return {
      fetched: true,
      sitemapHints,
      allowsPath(pathname: string) {
        // Empty Disallow means allow all
        if (disallows.length === 1 && disallows[0] === "") {
          return true;
        }

        const matchedAllow = allows
          .filter((p) => pathname.startsWith(p))
          .sort((a, b) => b.length - a.length)[0];
        const matchedDisallow = disallows
          .filter((p) => p !== "" && pathname.startsWith(p))
          .sort((a, b) => b.length - a.length)[0];

        if (!matchedDisallow) return true;
        if (!matchedAllow) return false;
        return matchedAllow.length >= matchedDisallow.length;
      },
    };
  } catch {
    return ALLOW_ALL;
  }
}

export function assertAllowed(
  policy: RobotsPolicy,
  url: URL,
): void {
  if (!policy.allowsPath(url.pathname)) {
    throw new AnalyzeError(
      `robots.txt interdit l'accès à ${url.pathname}`,
      403,
      "ROBOTS_DISALLOW",
    );
  }
}
