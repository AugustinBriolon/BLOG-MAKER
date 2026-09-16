import { STOPWORDS } from "./stopwords";

export type KeywordHit = {
  term: string;
  count: number;
  kind: "unigram" | "bigram";
};

function fold(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

const FOLDED_STOPWORDS = new Set([...STOPWORDS].map(fold));

function tokenize(text: string): string[] {
  return fold(text)
    .replace(/[^a-z0-9'\-\s]/gi, " ")
    .split(/[\s/_·•|]+/)
    .map((t) => t.replace(/^'+|'+$/g, "").replace(/^-+|-+$/g, ""))
    .filter((t) => {
      if (!t || t.length < 3) return false;
      if (/^\d+$/.test(t)) return false;
      if (FOLDED_STOPWORDS.has(t)) return false;
      return true;
    });
}

function countMap(tokens: string[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const token of tokens) {
    map.set(token, (map.get(token) ?? 0) + 1);
  }
  return map;
}

function toSortedHits(
  map: Map<string, number>,
  kind: KeywordHit["kind"],
  minCount: number,
): KeywordHit[] {
  return [...map.entries()]
    .filter(([, count]) => count >= minCount)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([term, count]) => ({ term, count, kind }));
}

export function analyzeKeywords(
  corpus: string,
  options?: { topN?: number },
): {
  keywords: KeywordHit[];
  totalSignificantTokens: number;
} {
  const topN = options?.topN ?? 40;
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

  const uniHits = toSortedHits(unigrams, "unigram", 2);
  const biHits = toSortedHits(bigramMap, "bigram", 2);

  // Interleave: keep strong bigrams + top unigrams
  const merged: KeywordHit[] = [];
  const seen = new Set<string>();

  for (const hit of biHits.slice(0, Math.ceil(topN / 3))) {
    merged.push(hit);
    seen.add(hit.term);
  }
  for (const hit of uniHits) {
    if (seen.has(hit.term)) continue;
    // skip unigrams already covered by a kept bigram as first token only — keep simple
    merged.push(hit);
    seen.add(hit.term);
    if (merged.length >= topN) break;
  }

  return {
    keywords: merged.slice(0, topN),
    totalSignificantTokens: tokens.length,
  };
}

export function inferTopicsAndDomain(
  keywords: KeywordHit[],
  siteHost: string,
  titles: string[],
): {
  domainGuess: string;
  topics: string[];
} {
  const topTerms = keywords
    .filter((k) => k.kind === "unigram")
    .slice(0, 12)
    .map((k) => k.term);

  const brandish = siteHost
    .replace(/^www\./, "")
    .split(".")[0]
    ?.replace(/[-_]/g, " ");

  const domainGuess =
    topTerms.length >= 3
      ? `Site orienté « ${topTerms.slice(0, 3).join(", ")} »${
          brandish ? ` (${brandish})` : ""
        }`
      : brandish
        ? `Site « ${brandish} » — signaux textuels encore limités`
        : "Domaine difficile à inférer avec le corpus actuel";

  const topicSeeds = [
    ...keywords.filter((k) => k.kind === "bigram").slice(0, 6).map((k) => k.term),
    ...topTerms.slice(0, 8),
  ];

  const titleHints = titles
    .join(" ")
    .split(/\s+/)
    .map((t) => fold(t))
    .filter((t) => t.length > 4 && !FOLDED_STOPWORDS.has(t))
    .slice(0, 5);

  const topics = [...new Set([...topicSeeds, ...titleHints])]
    .slice(0, 10)
    .map((term) => {
      if (term.includes(" ")) {
        return `Guide : ${term}`;
      }
      return `Idées autour de « ${term} »`;
    });

  return { domainGuess, topics };
}
