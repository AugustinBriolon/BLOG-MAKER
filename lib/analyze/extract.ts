/**
 * Extraction du contenu textuel d'une page HTML (cheerio).
 * Titre, meta/OG, H1 et corps principal sans nav/footer/scripts.
 */
import * as cheerio from "cheerio";

const NOISE_SELECTORS = [
  "script",
  "style",
  "noscript",
  "svg",
  "iframe",
  "canvas",
  "nav",
  "footer",
  "header",
  "aside",
  "form",
  "[role='navigation']",
  "[role='banner']",
  "[role='contentinfo']",
  ".cookie",
  ".cookies",
  "#cookie",
  "#cookies",
].join(", ");

export type ExtractedPage = {
  url: string;
  title: string;
  description: string;
  ogTitle: string;
  ogDescription: string;
  h1: string;
  /** Noms d'auteurs détectés (à démoter dans les mots-clés). */
  authors: string[];
  text: string;
  wordCount: number;
};

function uniqueNonEmpty(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of values) {
    const v = raw.replace(/\s+/g, " ").trim();
    if (!v) continue;
    const key = v.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(v);
  }
  return out;
}

function extractAuthors($: cheerio.CheerioAPI): string[] {
  const found: string[] = [];

  const metaAuthor = $('meta[name="author"]').attr("content");
  if (metaAuthor) found.push(metaAuthor);

  $('[rel="author"], [itemprop="author"], .author-name, .byline').each(
    (_, el) => {
      const name =
        $(el).attr("content") ||
        $(el).find('[itemprop="name"]').first().text() ||
        $(el).text();
      if (name && name.replace(/\s+/g, " ").trim().split(" ").length <= 4) {
        found.push(name);
      }
    },
  );

  // JSON-LD Person / author
  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).text();
    try {
      const data = JSON.parse(raw) as unknown;
      const nodes = Array.isArray(data) ? data : [data];
      for (const node of nodes) {
        collectJsonAuthors(node, found);
      }
    } catch {
      // ignore invalid JSON-LD
    }
  });

  // CMS embeds (Sanity / Next) : "author":{"name":"…"}
  const html = $.html();
  const embedRe = /"author"\s*:\s*\{\s*"name"\s*:\s*"([^"]{3,60})"/gi;
  let embedMatch: RegExpExecArray | null;
  while ((embedMatch = embedRe.exec(html)) !== null) {
    found.push(embedMatch[1]);
  }

  // Bylines FR/EN : « Par Alan Chevereau »
  const bylineRe =
    /\b(?:Par|By|Auteur)\s+([A-ZÀ-ÖØÝ][a-zà-öø-ÿœæ]{1,20}(?:\s+[A-ZÀ-ÖØÝ][a-zà-öø-ÿœæ]{1,20}){1,2})/g;
  let bylineMatch: RegExpExecArray | null;
  const bodyText = $("body").text();
  while ((bylineMatch = bylineRe.exec(bodyText)) !== null) {
    found.push(bylineMatch[1]);
  }

  return uniqueNonEmpty(found)
    .filter((name) => !isFalsePositivePerson(name))
    .slice(0, 12);
}

function collectJsonAuthors(node: unknown, found: string[]) {
  if (!node || typeof node !== "object") return;
  const obj = node as Record<string, unknown>;
  if (Array.isArray(obj["@graph"])) {
    for (const child of obj["@graph"]) collectJsonAuthors(child, found);
  }
  const author = obj.author;
  if (typeof author === "string") found.push(author);
  else if (author && typeof author === "object") {
    const a = author as Record<string, unknown>;
    if (typeof a.name === "string") found.push(a.name);
    if (Array.isArray(a)) {
      for (const item of a) collectJsonAuthors(item, found);
    }
  }
  if (obj["@type"] === "Person" && typeof obj.name === "string") {
    found.push(obj.name);
  }
}

function isFalsePositivePerson(name: string): boolean {
  const folded = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
  if (
    /\b(information technology|studio|agence|direction|artistique|digital|design|web|paris|france|guide|blog|hero|section|creative|branding|rebranding|metabole)\b/i.test(
      folded,
    )
  ) {
    return true;
  }
  // Trop long = pas un nom
  if (name.trim().split(/\s+/).length > 4) return true;
  return false;
}

export function extractPageContent(
  html: string,
  pageUrl: string,
): ExtractedPage {
  const $ = cheerio.load(html);

  const title = $("title").first().text().trim() || "";
  const ogTitle =
    $('meta[property="og:title"]').attr("content")?.trim() || "";
  const description =
    $('meta[name="description"]').attr("content")?.trim() || "";
  const ogDescription =
    $('meta[property="og:description"]').attr("content")?.trim() || "";
  const h1 = $("h1").first().text().replace(/\s+/g, " ").trim() || "";
  const authors = extractAuthors($);

  $(NOISE_SELECTORS).remove();

  const mainCandidate =
    $("main").first().text() ||
    $("article").first().text() ||
    $("[role='main']").first().text() ||
    $("body").text();

  const text = mainCandidate
    .replace(/\u00AD/g, "") // soft hyphen — join, never space-split
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\u00a0/g, " ")
    // camelCase only (do NOT use À-Ÿ ranges — they swallow lowercase accents)
    .replace(/(\p{Ll})(\p{Lu})/gu, "$1 $2")
    .replace(/(\p{L})(\d)/gu, "$1 $2")
    .replace(/(\d)(\p{L})/gu, "$1 $2")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .normalize("NFC")
    .trim();

  const wordCount = text
    ? text.split(/\s+/).filter(Boolean).length
    : 0;

  return {
    url: pageUrl,
    title: title || ogTitle,
    description: description || ogDescription,
    ogTitle,
    ogDescription,
    h1,
    authors,
    text,
    wordCount,
  };
}
