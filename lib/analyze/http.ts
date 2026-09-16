/**
 * HTTP poli pour le crawler POC : fetch, timeouts, normalisation d'URL.
 * Constantes partagées et erreurs typées `AnalyzeError`.
 */
export const USER_AGENT =
  "BlogMakerSEO-POC/0.1 (+https://github.com/AugustinBriolon/BLOG-MAKER; polite research crawler)";

export const MAX_PAGES = 12;
/** URLs gardées après priorisation (pool crawl). */
export const MAX_SITEMAP_URLS = 80;
/** Collecte brute avant filtrage / priorisation (évite un pool 100 % /author/). */
export const MAX_SITEMAP_RAW = 400;
export const FETCH_TIMEOUT_MS = 10_000;
export const FETCH_GAP_MS = 200;

export class AnalyzeError extends Error {
  status: number;
  code: string;

  constructor(message: string, status = 400, code = "ANALYZE_ERROR") {
    super(message);
    this.name = "AnalyzeError";
    this.status = status;
    this.code = code;
  }
}

export function normalizeSiteUrl(raw: string): URL {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new AnalyzeError("Veuillez saisir une URL.", 400, "EMPTY_URL");
  }

  let candidate = trimmed;
  if (!/^https?:\/\//i.test(candidate)) {
    candidate = `https://${candidate}`;
  }

  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    throw new AnalyzeError(
      "URL invalide. Exemple : https://exemple.com",
      400,
      "INVALID_URL",
    );
  }

  if (!["http:", "https:"].includes(url.protocol)) {
    throw new AnalyzeError(
      "Seules les URLs http(s) sont acceptées.",
      400,
      "INVALID_PROTOCOL",
    );
  }

  if (!url.hostname.includes(".")) {
    throw new AnalyzeError(
      "Le nom de domaine semble invalide.",
      400,
      "INVALID_HOST",
    );
  }

  url.hash = "";
  url.search = "";
  if (!url.pathname || url.pathname === "") {
    url.pathname = "/";
  }

  return url;
}

export function originFromUrl(url: URL): string {
  return url.origin;
}

export async function fetchText(
  target: string,
  options?: { accept?: string },
): Promise<{ url: string; status: number; text: string; contentType: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(target, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent": USER_AGENT,
        Accept: options?.accept ?? "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
      },
    });

    const contentType = response.headers.get("content-type") ?? "";
    const text = await response.text();

    return {
      url: response.url || target,
      status: response.status,
      text,
      contentType,
    };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new AnalyzeError(
        `Délai dépassé en récupérant ${target}`,
        504,
        "FETCH_TIMEOUT",
      );
    }
    throw new AnalyzeError(
      `Échec de récupération pour ${target}`,
      502,
      "FETCH_FAILED",
    );
  } finally {
    clearTimeout(timer);
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
