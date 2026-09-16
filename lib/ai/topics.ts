import { generateText, Output } from "ai";
import { z } from "zod";
import type { BlogPostRef, KeywordHit } from "@/lib/analyze";
import {
  formatDatePromptBlock,
  getPromptDateContext,
  refreshOutdatedYearsInTitle,
} from "./date-context";

export const MAX_AI_TOPICS = 3;

/** Cheapest capable default via AI Gateway — override with AI_TOPICS_MODEL. */
export const DEFAULT_TOPICS_MODEL = "openai/gpt-4.1-nano";

export type TopicSuggestion = {
  title: string;
  reason: string;
};

export type TopicsRequest = {
  host: string;
  domainGuess: string;
  keywords: KeywordHit[];
  blogPosts: BlogPostRef[];
};

export type TopicsResult = {
  topics: TopicSuggestion[];
  /** @deprecated use topics[].title */
  titles: string[];
  model: string;
  unavailable?: boolean;
  error?: string;
  action?: string;
};

const topicsSchema = z.object({
  topics: z
    .array(
      z.object({
        title: z
          .string()
          .min(8)
          .max(120)
          .describe("Titre d'article de blog SEO, en français"),
        reason: z
          .string()
          .min(12)
          .max(140)
          .describe(
            "Demi-phrase : pourquoi ce sujet (opportunité SEO / écart vs contenus existants)",
          ),
      }),
    )
    .min(1)
    .max(MAX_AI_TOPICS),
});

export function hasAiCredentials(): boolean {
  return Boolean(
    process.env.AI_GATEWAY_API_KEY ||
      process.env.VERCEL_OIDC_TOKEN ||
      process.env.AI_TOPICS_API_KEY,
  );
}

export function missingAiKeyMessage(): { error: string; action: string } {
  return {
    error: "Clé IA absente — sujets non générés.",
    action:
      "Ajoutez AI_GATEWAY_API_KEY dans .env.local (ou déployez sur Vercel avec OIDC).",
  };
}

export async function generateTopicTitles(
  input: TopicsRequest,
): Promise<TopicsResult> {
  const model =
    process.env.AI_TOPICS_MODEL?.trim() || DEFAULT_TOPICS_MODEL;

  if (!hasAiCredentials()) {
    const missing = missingAiKeyMessage();
    return {
      topics: [],
      titles: [],
      model,
      unavailable: true,
      error: missing.error,
      action: missing.action,
    };
  }

  const topKeywords = input.keywords.slice(0, 20).map((k) => k.term);
  const existing = input.blogPosts
    .slice(0, 12)
    .map((p) => `- ${p.title} (${p.url})`)
    .join("\n");

  // Cheap first fix for “actualité” SEO: ground the cheap model in today’s date
  // rather than upgrading to a fully up-to-date (costlier) model.
  const dateCtx = getPromptDateContext();
  const dateBlock = formatDatePromptBlock(dateCtx);

  const prompt = `Tu es un stratège SEO francophone pour Blog Maker.
Propose entre 1 et ${MAX_AI_TOPICS} sujets de blog.

${dateBlock}

Pour chaque sujet, fournis :
- title : titre d'article concret et actuel (année ${dateCtx.year} si une année est citée)
- reason : une demi-phrase (max ~20 mots) expliquant l'opportunité SEO ou l'écart vs le blog existant

Contraintes :
- Français, orientés SEO, cadrage d'actualité / timely pour le domaine
- Alignés domaine + mots-clés
- Ne duplique PAS les contenus déjà détectés
- Pas d'emoji, pas de numérotation
- Interdit : titres datés d'années périmées (ex. « … en 2023 »)

Site : ${input.host}
Domaine inféré : ${input.domainGuess}
Mots-clés top : ${topKeywords.join(", ") || "(aucun)"}
Contenus existants :
${existing || "(aucun article blog détecté)"}`;

  try {
    const { output } = await generateText({
      model,
      output: Output.object({
        name: "BlogTopics",
        description: "Sujets de blog SEO avec raison courte (1 à 3)",
        schema: topicsSchema,
      }),
      prompt,
      temperature: 0.6,
    });

    const topics = (output?.topics ?? [])
      .map((t) => ({
        title: refreshOutdatedYearsInTitle(
          t.title.trim().replace(/^["«]|["»]$/g, ""),
          dateCtx.year,
        ),
        reason: t.reason.trim().replace(/^["«]|["»]$/g, ""),
      }))
      .filter((t) => t.title.length >= 8)
      .slice(0, MAX_AI_TOPICS);

    return {
      topics,
      titles: topics.map((t) => t.title),
      model,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Génération IA impossible";
    console.error("[topics]", message);
    return {
      topics: [],
      titles: [],
      model,
      error: "Impossible de générer les sujets pour le moment.",
      action: "Réessayez, ou vérifiez votre clé AI Gateway.",
    };
  }
}
