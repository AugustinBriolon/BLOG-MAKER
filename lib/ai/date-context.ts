/**
 * Cheap “actualité” fix for SEO titles: inject today’s date into prompts
 * instead of paying for a fully up-to-date model. Timely domain news
 * drives valuable blog topics — date grounding is the first lever.
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

/** Shared prompt block for topics / draft. */
export function formatDatePromptBlock(ctx: PromptDateContext = getPromptDateContext()): string {
  return `Date du jour : ${ctx.humanFr} (ISO ${ctx.iso}).
Année courante : ${ctx.year}.
Règles temporalité :
- L'année courante est ${ctx.year} ; ne jamais utiliser d'années périmées (ex. 2023, 2024 si déjà passées) sauf justification historique claire.
- Préférer un cadrage actuel / d'actualité pour le domaine (SEO « timely »).
- Les titres doivent paraître à jour pour ${ctx.year}.`;
}

/**
 * Safety net: rewrite obvious past-year suffixes the model still emits
 * (e.g. "… en 2023", trailing "2023"). Leaves unrelated mid-sentence years alone
 * when not framed as "en/pour YYYY".
 */
export function refreshOutdatedYearsInTitle(
  title: string,
  currentYear: number = getPromptDateContext().year,
): string {
  let out = title.trim();

  out = out.replace(/\b(en|pour)\s+(20\d{2})\b/gi, (full, prep: string, yearStr: string) => {
    const y = Number(yearStr);
    if (Number.isFinite(y) && y < currentYear && y >= 2000) {
      return `${prep} ${currentYear}`;
    }
    return full;
  });

  out = out.replace(/\s+(20\d{2})\s*$/g, (full, yearStr: string) => {
    const y = Number(yearStr);
    if (Number.isFinite(y) && y < currentYear && y >= 2000) {
      return ` ${currentYear}`;
    }
    return full;
  });

  return out;
}
