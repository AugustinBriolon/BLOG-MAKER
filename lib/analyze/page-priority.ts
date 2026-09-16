/**
 * Priorisation des URLs à crawler : produit / landing / blog
 * plutôt que légal, login, auteurs, carrières, etc.
 * Tient compte de la locale de l'URL de départ (ex. /fr/).
 */

export type LocaleHint = "fr" | "en" | "neutral";

/** Indices de locale à partir du host + pathname. */
export function detectLocaleHint(url: URL): LocaleHint {
  const host = url.hostname.toLowerCase();
  const path = url.pathname.toLowerCase();

  if (/\.fr$/i.test(host)) return "fr";
  if (/(^|\/)(fr|fr-fr|fr_fr)(\/|$)/i.test(path)) return "fr";
  if (/(^|\/)(en|en-us|en-gb|en_us)(\/|$)/i.test(path)) return "en";
  return "neutral";
}

const DEMOTE_SEGMENTS = [
  "privacy",
  "privacy-policy",
  "confidentialite",
  "confidentialité",
  "politique-de-confidentialite",
  "legal",
  "legals",
  "mentions-legales",
  "mentions-légales",
  "terms",
  "tos",
  "conditions",
  "conditions-generales",
  "cgv",
  "cgu",
  "cookies",
  "cookie-policy",
  "login",
  "signin",
  "sign-in",
  "signup",
  "sign-up",
  "register",
  "auth",
  "account",
  "accounts",
  "user-account",
  "user-accounts",
  "service-agreement",
  "author",
  "authors",
  "auteur",
  "auteurs",
  "career",
  "careers",
  "jobs",
  "emploi",
  "emplois",
  "recrutement",
  "press",
  "presse",
  "media-kit",
  "investor",
  "investors",
  "imprint",
  "impressum",
  "gdpr",
  "rgpd",
  "dpa",
  "security",
  "trust",
  "compliance",
  "status",
  "changelog",
  "unsubscribe",
  "newsletter",
  "tag",
  "tags",
  "category",
  "categories",
  "wp-admin",
  "wp-json",
  "cart",
  "checkout",
  "wishlist",
];

const BOOST_SEGMENTS = [
  "product",
  "products",
  "produit",
  "produits",
  "feature",
  "features",
  "fonctionnalite",
  "fonctionnalites",
  "fonctionnalité",
  "fonctionnalités",
  "solution",
  "solutions",
  "pricing",
  "tarif",
  "tarifs",
  "offre",
  "offres",
  "platform",
  "plateforme",
  "software",
  "logiciel",
  "blog",
  "actualite",
  "actualites",
  "actualité",
  "actualités",
  "ressource",
  "ressources",
  "guide",
  "guides",
  "article",
  "articles",
  "use-case",
  "use-cases",
  "cas-usage",
  "cas-d-usage",
  "customers",
  "clients",
  "temoignages",
  "témoignages",
  "integrations",
  "integration",
  "api",
  "docs",
  "documentation",
  "payroll",
  "paie",
  "rh",
  "hr",
  "banking",
  "banque",
  "comptabilite",
  "comptabilité",
  "facturation",
  "invoice",
  "invoicing",
];

function pathSegments(pathname: string): string[] {
  return pathname
    .toLowerCase()
    .normalize("NFC")
    .split("/")
    .map((s) => s.replace(/\.html?$/i, ""))
    .filter(Boolean);
}

function foldSeg(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/œ/g, "oe")
    .replace(/æ/g, "ae");
}

function matchesAny(seg: string, list: string[]): boolean {
  const f = foldSeg(seg);
  return list.some((item) => {
    const t = foldSeg(item);
    return f === t || f.startsWith(`${t}-`) || f.endsWith(`-${t}`);
  });
}

function depthPenalty(depth: number): number {
  if (depth <= 1) return 0;
  if (depth === 2) return 1;
  if (depth === 3) return 3;
  return 3 + (depth - 3) * 2;
}

/**
 * Score plus bas = priorité plus haute (tri ascendant).
 * L'URL de départ (home / landing) et la locale FR sont favorisées.
 */
export function scorePageUrl(
  candidate: URL,
  startUrl: URL,
  startLocale: LocaleHint,
): number {
  const path = candidate.pathname || "/";
  const segs = pathSegments(path);
  const depth = segs.length;
  let score = depthPenalty(depth);

  // Homepage / near-home
  if (path === "/" || path === "") score -= 40;
  else if (depth === 1 && /^(fr|en|fr-fr|en-us)$/i.test(segs[0] ?? "")) {
    score -= 32; // locale root ≈ landing
  }

  // Prefer the exact start URL
  if (candidate.href === startUrl.href) score -= 50;
  else if (
    candidate.pathname === startUrl.pathname &&
    candidate.hostname === startUrl.hostname
  ) {
    score -= 45;
  }

  // Locale affinity
  const candLocale = detectLocaleHint(candidate);
  if (startLocale === "fr") {
    if (candLocale === "fr") score -= 18;
    if (candLocale === "en") score += 28;
    // Paths without locale on a .com when start was /fr — mild demote
    if (candLocale === "neutral" && !/\.fr$/i.test(candidate.hostname)) {
      score += 6;
    }
  } else if (startLocale === "en") {
    if (candLocale === "en") score -= 10;
    if (candLocale === "fr") score += 8;
  }

  // Same first content segment as start (e.g. /logiciel-avocats/)
  const startSegs = pathSegments(startUrl.pathname);
  const startContent = startSegs.find(
    (s) => !/^(fr|en|fr-fr|en-us|en-gb)$/i.test(s),
  );
  if (startContent && segs.includes(startContent)) score -= 12;

  for (const seg of segs) {
    if (matchesAny(seg, DEMOTE_SEGMENTS)) score += 55;
    if (matchesAny(seg, BOOST_SEGMENTS)) score -= 16;
  }

  // Author / tag listing patterns often have thin content
  if (/\/author\//i.test(path) || /\/tag\//i.test(path)) score += 70;
  if (/\/authors?\//i.test(path)) score += 70;

  // File-like or query-ish leftovers (search already stripped)
  if (/\.(pdf|xml|json)$/i.test(path)) score += 100;

  // Prefer shorter host-relative paths with product words in slug
  const slug = segs.join("-");
  if (
    /(logiciel|software|platform|plateforme|produit|product|solution|paie|payroll|banque|avocat)/i.test(
      slug,
    )
  ) {
    score -= 10;
  }

  return score;
}

/** Trie et plafonne la liste d'URLs éligibles selon la priorité métier. */
export function prioritizePages(
  urls: URL[],
  startUrl: URL,
  limit: number,
): URL[] {
  const startLocale = detectLocaleHint(startUrl);
  const seen = new Set<string>();
  const unique: URL[] = [];

  for (const u of urls) {
    const key = u.toString();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(u);
  }

  return unique
    .map((u) => ({
      u,
      score: scorePageUrl(u, startUrl, startLocale),
    }))
    .sort(
      (a, b) =>
        a.score - b.score ||
        a.u.pathname.length - b.u.pathname.length ||
        a.u.pathname.localeCompare(b.u.pathname, "fr"),
    )
    .slice(0, limit)
    .map((x) => x.u);
}
