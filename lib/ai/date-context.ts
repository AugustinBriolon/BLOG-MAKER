/**
 * Cheap “actualité” fix for SEO titles: inject today’s date into prompts
 * instead of paying for a fully up-to-date model. Timely domain news
 * drives valuable blog topics — date grounding is the first lever.
 *
 * Important: date context must NOT become year spam in titles
 * (“… en 2026” on every suggestion). Prefer evergreen / timely wording
 * without appending the year unless truly necessary.
 */
export type PromptDateContext = {
  iso: string;
  humanFr: string;
  year: number;
};

export function getPromptDateContext(now = new Date()): PromptDateContext {
  const year = now.getFullYear();
  const iso = now.toISOString().slice(0, 10);
  const humanFr = new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(now);
  return { iso, humanFr, year };
}

/** Shared prompt block for topics / draft — grounding only, no year-in-title mandate. */
export function formatDatePromptBlock(
  ctx: PromptDateContext = getPromptDateContext(),
): string {
  return `Date du jour : ${ctx.humanFr} (ISO ${ctx.iso}).
Année courante : ${ctx.year} (contexte uniquement — pour rester à jour, pas pour dater les titres).
Règles temporalité :
- Ne pas inventer d'années périmées (ex. 2023) ni de faits datés faux.
- Préférer un cadrage d'actualité / evergreen pour le domaine.
- N'inclure AUCUNE année dans les titres (ni « en ${ctx.year} », ni « pour ${ctx.year} », ni année en suffixe) sauf nécessité réelle et rare (ex. réforme légale datée).
- Titres clean, SEO, sans spam d'année.`;
}

/**
 * Safety net: strip trailing / framed year clutter the model still adds
 * (“en 2026”, “pour 2023”, bare trailing YYYY). Does NOT rewrite past years
 * into the current year (that caused year spam).
 */
export function stripYearClutterFromTitle(title: string): string {
  let out = title.trim();

  // "… en 2026" / "… pour 2023" anywhere as a year tag
  out = out.replace(/\s*\b(en|pour)\s+20\d{2}\b/gi, "");

  // trailing bare year: "Guide SEO 2026"
  out = out.replace(/\s+20\d{2}\s*$/g, "");

  // tidy leftover punctuation / spaces
  out = out
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,;:!?])/g, "$1")
    .replace(/\s+([-–—])\s*$/g, "")
    .trim();

  return out;
}

/** @deprecated use stripYearClutterFromTitle — kept name alias during migration */
export function refreshOutdatedYearsInTitle(title: string): string {
  return stripYearClutterFromTitle(title);
}
