export type BlogPostRef = {
  title: string;
  url: string;
};

const BLOG_PATH_RE =
  /\/(blog|blogs|actualites|actualités|actu|articles?|news|posts?|ressources?|magazine|journal|insights?|guides?)(\/|$)/i;

const BLOG_TITLE_RE =
  /\b(blog|article|actualité|actualite|tribune|dossier|guide)\b/i;

/**
 * Heuristique légère : URLs / titres qui ressemblent à du contenu éditorial existant.
 */
export function detectBlogPosts(
  pages: Array<{ url: string; title: string }>,
): BlogPostRef[] {
  const hits: BlogPostRef[] = [];
  const seen = new Set<string>();

  for (const page of pages) {
    let url: URL;
    try {
      url = new URL(page.url);
    } catch {
      continue;
    }

    const path = url.pathname;
    const title = (page.title || "").trim();
    const looksLikeBlog =
      BLOG_PATH_RE.test(path) ||
      BLOG_TITLE_RE.test(title) ||
      /\/\d{4}\/\d{2}\//.test(path);

    if (!looksLikeBlog) continue;

    // Écarte les index trop génériques sans titre utile
    if (
      /^\/(blog|actualites|actualités|articles?|news)\/?$/i.test(path) &&
      (!title || title.length < 8)
    ) {
      continue;
    }

    const key = url.origin + path.replace(/\/$/, "");
    if (seen.has(key)) continue;
    seen.add(key);

    hits.push({
      url: url.toString(),
      title: title || path,
    });
  }

  return hits.slice(0, 20);
}
