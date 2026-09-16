/**
 * Tokenisation FR et scoring unigrammes/bigrammes pour les mots-clés SEO.
 * Infère aussi une description courte du domaine à partir des termes.
 */
import { STOPWORDS } from "./stopwords";

export type KeywordHit = {
  term: string;
  count: number;
  kind: "unigram" | "bigram";
};

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

function countMap(tokens: string[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const token of tokens) {
    map.set(token, (map.get(token) ?? 0) + 1);
  }
  return map;
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
  if (demote?.has(fold(term))) score *= 0.25;
  // Demote brand unigram if it appears inside a demoted brand stem
  if (kind === "unigram" && demote) {
    for (const d of demote) {
      if (d.length >= 4 && fold(term).includes(d)) {
        score *= 0.35;
        break;
      }
    }
  }
  return score;
}

function toRankedHits(
  map: Map<string, number>,
  kind: KeywordHit["kind"],
  minCount: number,
  demote?: Set<string>,
): KeywordHit[] {
  return [...map.entries()]
    .filter(([, count]) => count >= minCount)
    .map(([term, count]) => ({ term, count, kind }))
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

export function analyzeKeywords(
  corpus: string,
  options?: { topN?: number; siteHost?: string },
): {
  keywords: KeywordHit[];
  totalSignificantTokens: number;
} {
  const topN = options?.topN ?? 40;
  const demote = brandDemoteTerms(options?.siteHost);
  const tokens = tokenize(corpus);
  const unigrams = countMap(tokens);

  const bigramMap = new Map<string, number>();
  for (let i = 0; i < tokens.length - 1; i++) {
    const a = tokens[i];
    const b = tokens[i + 1];
    if (a === b) continue;
    const key = `${a} ${b}`;
    bigramMap.set(key, (bigramMap.get(key) ?? 0) + 1);
  }

  const uniHits = toRankedHits(unigrams, "unigram", 2, demote);
  const biHits = toRankedHits(bigramMap, "bigram", 2, demote);

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

  merged.sort(
    (a, b) =>
      scoreHit(b.term, b.count, b.kind, demote) -
        scoreHit(a.term, a.count, a.kind, demote) ||
      b.count - a.count ||
      a.term.localeCompare(b.term, "fr"),
  );

  return {
    keywords: merged.slice(0, topN),
    totalSignificantTokens: tokens.length,
  };
}

export function inferDomain(
  keywords: KeywordHit[],
  siteHost: string,
): string {
  const phrases = keywords.filter((k) => k.kind === "bigram").slice(0, 10);
  const unigrams = keywords.filter((k) => k.kind === "unigram").slice(0, 10);

  const brandish = siteHost
    .replace(/^www\./, "")
    .split(".")[0]
    ?.replace(/[-_]/g, " ");

  const domainSeeds = [
    ...phrases.slice(0, 3).map((k) => k.term),
    ...unigrams.slice(0, 3).map((k) => k.term),
  ].slice(0, 3);

  if (domainSeeds.length >= 2) {
    return `Site orienté « ${domainSeeds.join(", ")} »${
      brandish ? ` (${brandish})` : ""
    }`;
  }

  if (brandish) {
    return `Site « ${brandish} » — signaux textuels encore limités`;
  }

  return "Domaine difficile à inférer avec le corpus actuel";
}
