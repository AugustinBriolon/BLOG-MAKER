/**
 * Tokenisation FR et scoring unigrammes/bigrammes pour les mots-clés SEO.
 * Infère aussi une description courte du domaine à partir des termes.
 *
 * Pondération : title / meta / OG / H1 > corps ; homepage ≫ pages profondes.
 */
import { STOPWORDS } from "./stopwords";

export type KeywordHit = {
  term: string;
  count: number;
  kind: "unigram" | "bigram";
};

/** Segment de corpus avec poids (page × champ). */
export type WeightedSegment = {
  text: string;
  /** Multiplicateur (ex. home×title = 4×4). */
  weight: number;
};

/** Tokens / bigrammes trop génériques pour le domain guess et le ranking. */
const NOISE_TOKENS = new Set(
  [
    "com",
    "www",
    "http",
    "https",
    "html",
    "org",
    "net",
    "io",
    "github",
    "linkedin",
    "twitter",
    "facebook",
    "instagram",
    "youtube",
    "cookie",
    "cookies",
    "account",
    "accounts",
    "user",
    "users",
    "login",
    "password",
    "agreement",
    "privacy",
    "policy",
    "terms",
    "month",
    "included",
    "click",
    "here",
    "learn",
    "more",
    "home",
    "page",
    "pages",
    "menu",
    "footer",
    "header",
    "nav",
    "navigation",
    "cdn",
    "await",
    "domain",
    "example",
    // UI chrome / design-system noise
    "hero",
    "section",
    "sections",
    "button",
    "buttons",
    "overlay",
    "slider",
    "carousel",
    "viewport",
    "container",
    "wrapper",
    "layout",
    "grid",
    "flex",
    "parallax",
    "scroll",
    "sticky",
    "modal",
    "popup",
    "tooltip",
    "sidebar",
    "navbar",
    "breadcrumb",
    "placeholder",
    "lorem",
    "ipsum",
    "bento",
    "gsap",
    "lenis",
  ].map((t) => t.toLowerCase()),
);

const HOST_FRAGMENTS = new Set(["com", "www", "org", "net", "io", "github"]);

const NOISE_PHRASE_RE =
  /\b(user account|user accounts|service agreement|privacy policy|cookie policy|month included|github com|com ovh|example domain|await sandbox|tan stack|hit css|becomes first|firefox support|general use|personal data|project vercel|copy link|link heading|holiday pay|hero section|bento grid|design to code|next sanity|paris next|concoit experiences|experiences premium|sur-mesure travaillons|easy-using|premium paris|sanity direction|studio concoit|travaillons ensemble)\b/i;

/** Fold for stopword matching only — display tokens keep accents (NFC). */
function fold(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

const FOLDED_STOPWORDS = new Set([...STOPWORDS].map(fold));

/** Decode a few leftover entities if present outside cheerio paths. */
function decodeBasicEntities(text: string): string {
  return text
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) =>
      String.fromCodePoint(parseInt(h, 16)),
    );
}

/**
 * Prepare French/web text before tokenization:
 * - NFC
 * - remove soft hyphens (join syllables, do NOT replace with space)
 * - normalize apostrophes / dashes
 */
export function prepareText(raw: string): string {
  return decodeBasicEntities(raw)
    .normalize("NFC")
    .replace(/\u00AD/g, "") // soft hyphen
    .replace(/[\u200B-\u200D\uFEFF]/g, "") // zero-width
    .replace(/[\u2018\u2019\u02BC\u2032]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2010\u2011\u2012\u2013\u2014\u2212]/g, "-")
    .replace(/\u00A0/g, " ");
}

const TOKEN_RE =
  /[A-Za-zÀ-ÖØ-öø-ÿŒœÆæ]+(?:['’][A-Za-zÀ-ÖØ-öø-ÿŒœÆæ]+)?(?:-[A-Za-zÀ-ÖØ-öø-ÿŒœÆæ]+)*/g;

function stripProclitic(token: string): string {
  return token.replace(/^(l|d|n|c|j|m|t|s|qu)'/i, "");
}

function isKeepableToken(raw: string): boolean {
  const t = raw.toLowerCase().normalize("NFC");
  if (!t || t.length < 3 || t.length > 40) return false;
  if (/^\d+$/.test(t)) return false;
  if (FOLDED_STOPWORDS.has(fold(t))) return false;

  const stripped = stripProclitic(t);
  if (stripped !== t) {
    if (stripped.length < 3) return false;
    if (FOLDED_STOPWORDS.has(fold(stripped))) return false;
  }

  const folded = fold(stripped || t).replace(/'/g, "");
  if (folded.length >= 3 && !/[aeiouy]/.test(folded)) return false;
  return true;
}

export function tokenize(text: string): string[] {
  const prepared = prepareText(text).toLowerCase();
  const matches = prepared.match(TOKEN_RE) ?? [];
  const out: string[] = [];

  for (const match of matches) {
    const token = match.replace(/'/g, "'").normalize("NFC");
    if (!isKeepableToken(token)) continue;
    out.push(token);
  }

  return out;
}

/** Construit un set de termes à démoter à partir de noms d'auteurs. */
export function authorDemoteTerms(authors: string[]): Set<string> {
  const out = new Set<string>();
  for (const author of authors) {
    const tokens = tokenize(author);
    for (const t of tokens) {
      if (t.length >= 3) out.add(fold(t));
    }
    if (tokens.length >= 2) {
      out.add(fold(tokens.join(" ")));
      // First + last only (ignore middle particles)
      out.add(fold(`${tokens[0]} ${tokens[tokens.length - 1]}`));
    }
  }
  return out;
}

/**
 * Heuristique prénom+nom : uniquement sur bylines explicites
 * (« Par Alan Chevereau », « By Jane Doe »), pas sur les titres métier.
 */
export function guessPersonNameDemotes(texts: string[]): Set<string> {
  const out = new Set<string>();
  const bylineRe =
    /\b(?:Par|By|Auteur|Author)\s+([A-ZÀ-ÖØÝ][a-zà-öø-ÿœæ]{1,20}(?:\s+[A-ZÀ-ÖØÝ][a-zà-öø-ÿœæ]{1,20}){1,2})\b/g;
  for (const text of texts) {
    if (!text) continue;
    const prepared = prepareText(text);
    let m: RegExpExecArray | null;
    while ((m = bylineRe.exec(prepared)) !== null) {
      const name = m[1];
      const tokens = tokenize(name);
      for (const t of tokens) {
        if (t.length >= 3) out.add(fold(t));
      }
      if (tokens.length >= 2) {
        out.add(fold(tokens.join(" ")));
      }
    }
  }
  return out;
}

function addWeighted(
  map: Map<string, number>,
  key: string,
  weight: number,
) {
  map.set(key, (map.get(key) ?? 0) + weight);
}

function scoreHit(
  term: string,
  count: number,
  kind: KeywordHit["kind"],
  demote?: Set<string>,
): number {
  let score = count;
  if (kind === "bigram") score *= 2.6;
  if (/[àâäéèêëïîôùûüçœæ]/i.test(term)) score *= 1.12;
  if (term.includes("-") || /'/.test(term)) score *= 1.06;
  if (kind === "unigram" && term.length <= 3) score *= 0.35;
  // Demote brand stems only on unigrams / exact phrase — not every bigram part,
  // sinon « facturation électronique » est tué si « electronique » a été mal
  // classé comme nom propre.
  if (demote?.has(fold(term))) score *= 0.08;
  if (kind === "unigram" && demote) {
    for (const d of demote) {
      if (d.length >= 4 && !d.includes(" ") && fold(term) === d) {
        score *= 0.2;
        break;
      }
      if (d.length >= 4 && !d.includes(" ") && fold(term).includes(d)) {
        score *= 0.35;
        break;
      }
    }
  }
  // Person full-name bigram demotion
  if (kind === "bigram" && demote?.has(fold(term))) {
    score *= 0.08;
  } else if (kind === "bigram" && demote) {
    const parts = fold(term).split(/\s+/);
    // Only demote if ALL parts are person-name tokens (full name), not métier words
    if (parts.length >= 2 && parts.every((p) => demote.has(p))) {
      score *= 0.08;
    }
  }
  if (isNoiseTerm(term)) score *= 0.12;
  // CTA / chrome FR bigrams
  if (/\b(j'utilise|utilisez|découvrir|en savoir|sur-mesure travaillons)\b/i.test(term)) {
    score *= 0.15;
  }
  return score;
}

function isNoiseTerm(term: string): boolean {
  const folded = fold(term);
  if (NOISE_PHRASE_RE.test(term)) return true;
  const parts = folded.split(/\s+/);
  if (parts.length === 1) return NOISE_TOKENS.has(parts[0]);
  if (parts.every((p) => NOISE_TOKENS.has(p))) return true;
  // TLD / host fragment bigrams: "com ovh", "github com"
  if (parts.some((p) => HOST_FRAGMENTS.has(p))) return true;
  // Any part is hard UI chrome
  if (parts.some((p) => ["hero", "section", "bento", "gsap"].includes(p))) {
    return true;
  }
  return false;
}

/** Keep terms that can describe a métier (for domain guess). */
function isDomainSeedCandidate(hit: KeywordHit, demote?: Set<string>): boolean {
  if (isNoiseTerm(hit.term)) return false;
  if (demote?.has(fold(hit.term))) return false;
  const parts = fold(hit.term).split(/\s+/);
  if (parts.some((p) => NOISE_TOKENS.has(p))) return false;
  if (parts.some((p) => demote?.has(p))) return false;
  // Prefer multi-word métier phrases; allow strong unigrams
  if (hit.kind === "unigram") {
    if (hit.term.length < 5) return false;
    if (hit.count < 6) return false;
  }
  return true;
}

function toRankedHits(
  map: Map<string, number>,
  kind: KeywordHit["kind"],
  minCount: number,
  demote?: Set<string>,
): KeywordHit[] {
  return [...map.entries()]
    .filter(([, count]) => count >= minCount)
    .map(([term, count]) => ({
      term,
      count: Math.round(count * 10) / 10,
      kind,
    }))
    .sort(
      (a, b) =>
        scoreHit(b.term, b.count, b.kind, demote) -
          scoreHit(a.term, a.count, a.kind, demote) ||
        b.count - a.count ||
        a.term.localeCompare(b.term, "fr"),
    );
}

function coversUnigram(phrase: string, uni: string): boolean {
  return phrase.split(/\s+/).includes(uni);
}

function brandDemoteTerms(host?: string): Set<string> {
  if (!host) return new Set();
  const base = host.replace(/^www\./, "").split(".")[0] ?? "";
  const parts = base
    .toLowerCase()
    .split(/[-_]/)
    .flatMap((p) => {
      const out = [p];
      // zlawyer → lawyer (prefix marque courte + radical)
      const m = p.match(/^[bcdfghjklmnpqrstvwxz]([a-zà-ÿ]{5,})$/i);
      if (m) out.push(m[1]);
      return out;
    })
    .filter((p) => p.length >= 4);
  return new Set(parts.map(fold));
}

function accumulateSegments(
  segments: WeightedSegment[],
): {
  unigrams: Map<string, number>;
  bigrams: Map<string, number>;
  totalSignificantTokens: number;
} {
  const unigrams = new Map<string, number>();
  const bigrams = new Map<string, number>();
  let totalSignificantTokens = 0;

  for (const segment of segments) {
    if (!segment.text?.trim() || segment.weight <= 0) continue;
    const tokens = tokenize(segment.text);
    totalSignificantTokens += tokens.length;
    const w = segment.weight;
    for (const token of tokens) {
      addWeighted(unigrams, token, w);
    }
    for (let i = 0; i < tokens.length - 1; i++) {
      const a = tokens[i];
      const b = tokens[i + 1];
      if (a === b) continue;
      addWeighted(bigrams, `${a} ${b}`, w);
    }
  }

  return { unigrams, bigrams, totalSignificantTokens };
}

export function analyzeKeywords(
  corpus: string | WeightedSegment[],
  options?: {
    topN?: number;
    siteHost?: string;
    /** Termes supplémentaires à démoter (auteurs, etc.). */
    extraDemote?: Set<string>;
  },
): {
  keywords: KeywordHit[];
  totalSignificantTokens: number;
} {
  const topN = options?.topN ?? 40;
  const demote = brandDemoteTerms(options?.siteHost);
  if (options?.extraDemote) {
    for (const t of options.extraDemote) demote.add(t);
  }

  const segments: WeightedSegment[] = Array.isArray(corpus)
    ? corpus
    : [{ text: corpus, weight: 1 }];

  const { unigrams, bigrams, totalSignificantTokens } =
    accumulateSegments(segments);

  // minCount: weighted — homepage meta alone can clear 2
  const uniHits = toRankedHits(unigrams, "unigram", 2, demote);
  const biHits = toRankedHits(bigrams, "bigram", 2, demote);

  const merged: KeywordHit[] = [];
  const seen = new Set<string>();
  const phraseBudget = Math.max(8, Math.ceil(topN * 0.55));

  for (const hit of biHits) {
    if (merged.length >= phraseBudget) break;
    if (seen.has(hit.term)) continue;
    merged.push(hit);
    seen.add(hit.term);
  }

  for (const hit of uniHits) {
    if (merged.length >= topN) break;
    if (seen.has(hit.term)) continue;
    if (
      merged.some((m) => m.kind === "bigram" && coversUnigram(m.term, hit.term))
    ) {
      if (hit.count < 12) continue;
    }
    merged.push(hit);
    seen.add(hit.term);
  }

  // Display count as integer (weighted mass rounded)
  for (const hit of merged) {
    hit.count = Math.max(1, Math.round(hit.count));
  }

  merged.sort(
    (a, b) =>
      scoreHit(b.term, b.count, b.kind, demote) -
        scoreHit(a.term, a.count, a.kind, demote) ||
      b.count - a.count ||
      a.term.localeCompare(b.term, "fr"),
  );

  return {
    keywords: merged.slice(0, topN),
    totalSignificantTokens,
  };
}

export function inferDomain(
  keywords: KeywordHit[],
  siteHost: string,
  extraDemote?: Set<string>,
): string {
  const brandish = siteHost
    .replace(/^www\./, "")
    .split(".")[0]
    ?.replace(/[-_]/g, " ");

  const demote = brandDemoteTerms(siteHost);
  if (extraDemote) {
    for (const t of extraDemote) demote.add(t);
  }

  const seeds = keywords
    .filter((k) => isDomainSeedCandidate(k, demote))
    .slice(0, 16)
    .sort(
      (a, b) =>
        scoreHit(b.term, b.count, b.kind, demote) -
          scoreHit(a.term, a.count, a.kind, demote) ||
        b.count - a.count,
    );

  // Prefer bigrams, then fill with unigrams
  const picked: string[] = [];
  const seen = new Set<string>();
  for (const hit of seeds.filter((k) => k.kind === "bigram")) {
    if (picked.length >= 3) break;
    const key = fold(hit.term);
    if (seen.has(key)) continue;
    seen.add(key);
    picked.push(hit.term);
  }
  for (const hit of seeds.filter((k) => k.kind === "unigram")) {
    if (picked.length >= 3) break;
    const key = fold(hit.term);
    if (seen.has(key)) continue;
    // Skip unigram already covered by a phrase
    if (picked.some((p) => coversUnigram(p, hit.term))) continue;
    seen.add(key);
    picked.push(hit.term);
  }

  if (picked.length >= 2) {
    const [a, b, c] = picked;
    if (c) {
      return brandish
        ? `${brandish} — activité autour de « ${a} », « ${b} » et « ${c} »`
        : `Activité autour de « ${a} », « ${b} » et « ${c} »`;
    }
    return brandish
      ? `${brandish} — spécialisé dans « ${a} » et « ${b} »`
      : `Spécialisé dans « ${a} » et « ${b} »`;
  }

  if (picked.length === 1) {
    return brandish
      ? `${brandish} — focus « ${picked[0]} »`
      : `Focus « ${picked[0]} »`;
  }

  if (brandish) {
    return `Site « ${brandish} » — signaux textuels encore limités`;
  }

  return "Domaine difficile à inférer avec le corpus actuel";
}

/** Poids page : homepage / locale home / URL seed ≫ pages profondes.
 *  Le boost fort s'applique surtout aux champs SEO ; le body reste modéré
 *  pour ne pas noyer les bigrammes métier des pages produit. */
export function pageWeightForUrl(
  pageUrl: string,
  startUrl: URL,
): { seo: number; body: number } {
  let path: string;
  try {
    path = new URL(pageUrl).pathname || "/";
  } catch {
    return { seo: 1, body: 1 };
  }
  const normalized = path.replace(/\/+$/, "") || "/";
  const startPath = (startUrl.pathname || "/").replace(/\/+$/, "") || "/";

  const isHome =
    normalized === "/" ||
    normalized === "" ||
    normalized === startPath ||
    /^\/(fr|en|fr-fr|en-us|en-gb)$/i.test(normalized);

  if (isHome) return { seo: 5, body: 1.35 };
  if (/^\/(fr|en)\/[^/]+$/i.test(normalized)) return { seo: 1.4, body: 1.1 };
  return { seo: 1, body: 1 };
}

/** Poids des champs SEO vs corps. */
export const FIELD_WEIGHTS = {
  title: 4,
  ogTitle: 3.5,
  h1: 3.5,
  description: 3,
  ogDescription: 3,
  body: 1,
} as const;
