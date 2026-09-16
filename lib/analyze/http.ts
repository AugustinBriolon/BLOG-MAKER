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

export type FetchResult = {
  url: string;
  status: number;
  text: string;
  contentType: string;
  /** true si servi depuis le cache in-memory de la requête. */
  cached: boolean;
};

/** Cache HTML/XML borné à une seule analyse (évite double fetch seed). */
export type FetchCache = Map<string, Promise<FetchResult>>;

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

/** Clé canonique pour dédup (/fr vs /fr/, host case). */
export function pageCacheKey(target: string): string {
  try {
    const u = new URL(target);
    const path = u.pathname.replace(/\/+$/, "") || "/";
    return `${u.protocol}//${u.hostname.toLowerCase()}${path}`;
  } catch {
    return target.trim().toLowerCase();
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

const DEFAULT_ACCEPT =
  "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8";

function cacheSlotKey(target: string, accept: string): string {
  return `${pageCacheKey(target)}::${accept}`;
}

async function fetchTextNetwork(
  target: string,
  accept: string,
): Promise<FetchResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(target, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent": USER_AGENT,
        Accept: accept,
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
      cached: false,
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

/**
 * Fetch texte ; `cache` optionnel = mémoire d'une seule analyse
 * (réutilise la landing déjà lue en discovery).
 */
export async function fetchText(
  target: string,
  options?: { accept?: string; cache?: FetchCache },
): Promise<FetchResult> {
  const accept = options?.accept ?? DEFAULT_ACCEPT;
  const cache = options?.cache;

  if (!cache) {
    return fetchTextNetwork(target, accept);
  }

  const key = cacheSlotKey(target, accept);
  const existing = cache.get(key);
  if (existing) {
    const hit = await existing;
    return { ...hit, cached: true };
  }

  const pending = fetchTextNetwork(target, accept).then((result) => {
    const finalKey = cacheSlotKey(result.url, accept);
    if (finalKey !== key) {
      cache.set(finalKey, Promise.resolve({ ...result, cached: true }));
    }
    return result;
  });

  cache.set(key, pending);
  return pending;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
