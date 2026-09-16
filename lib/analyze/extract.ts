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
  text: string;
  wordCount: number;
};

export function extractPageContent(
  html: string,
  pageUrl: string,
): ExtractedPage {
  const $ = cheerio.load(html);

  const title =
    $("title").first().text().trim() ||
    $('meta[property="og:title"]').attr("content")?.trim() ||
    "";
  const description =
    $('meta[name="description"]').attr("content")?.trim() ||
    $('meta[property="og:description"]').attr("content")?.trim() ||
    "";

  $(NOISE_SELECTORS).remove();

  const mainCandidate =
    $("main").first().text() ||
    $("article").first().text() ||
    $("[role='main']").first().text() ||
    $("body").text();

  const text = mainCandidate
    .replace(/\u00a0/g, " ")
    .replace(/([a-zà-ÿ])([A-ZÀ-Ÿ])/g, "$1 $2")
    .replace(/([A-Za-z])(\d)/g, "$1 $2")
    .replace(/(\d)([A-Za-z])/g, "$1 $2")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();

  const wordCount = text
    ? text.split(/\s+/).filter(Boolean).length
    : 0;

  return {
    url: pageUrl,
    title,
    description,
    text,
    wordCount,
  };
}
