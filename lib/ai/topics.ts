import { generateText, Output } from "ai";
import { z } from "zod";
import type { BlogPostRef } from "@/lib/analyze";
import type { KeywordHit } from "@/lib/analyze";

export const MAX_AI_TOPICS = 3;

/** Cheapest capable default via AI Gateway — override with AI_TOPICS_MODEL. */
export const DEFAULT_TOPICS_MODEL = "openai/gpt-4.1-nano";

export type TopicsRequest = {
  host: string;
  domainGuess: string;
  keywords: KeywordHit[];
  blogPosts: BlogPostRef[];
};

export type TopicsResult = {
  titles: string[];
  model: string;
  unavailable?: boolean;
  error?: string;
};

const topicsSchema = z.object({
  titles: z
    .array(z.string().min(8).max(120))
    .min(1)
    .max(MAX_AI_TOPICS)
    .describe("1 à 3 titres d'articles de blog SEO, en français"),
});

export function hasAiCredentials(): boolean {
  return Boolean(
    process.env.AI_GATEWAY_API_KEY ||
      process.env.VERCEL_OIDC_TOKEN ||
      process.env.AI_TOPICS_API_KEY,
  );
}

export async function generateTopicTitles(
  input: TopicsRequest,
): Promise<TopicsResult> {
  const model =
    process.env.AI_TOPICS_MODEL?.trim() || DEFAULT_TOPICS_MODEL;

  if (!hasAiCredentials()) {
    return {
      titles: [],
      model,
      unavailable: true,
      error:
        "Clé IA absente — définissez AI_GATEWAY_API_KEY (ou déployez sur Vercel avec OIDC).",
    };
  }

  const topKeywords = input.keywords.slice(0, 20).map((k) => k.term);
  const existing = input.blogPosts
    .slice(0, 12)
    .map((p) => `- ${p.title} (${p.url})`)
    .join("\n");

  const prompt = `Tu es un stratège SEO francophone pour Blog Maker.
Propose exactement entre 1 et 3 titres d'articles de blog (titres seuls, pas de corps).

Contraintes :
- Maximum ${MAX_AI_TOPICS} titres
- Français, concrets, orientés opportunité SEO
- Alignés avec le domaine métier et les mots-clés
- Ne duplique PAS les contenus déjà détectés (titres/URLs fournis)
- Pas de numérotation, pas de guillemets superflus, pas d'emoji

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
        description: "Titres de sujets de blog SEO (1 à 3)",
        schema: topicsSchema,
      }),
      prompt,
      temperature: 0.6,
    });

    const titles = (output?.titles ?? [])
      .map((t) => t.trim().replace(/^["«]|["»]$/g, ""))
      .filter(Boolean)
      .slice(0, MAX_AI_TOPICS);

    return { titles, model };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Génération IA impossible";
    console.error("[topics]", message);
    return {
      titles: [],
      model,
      error: "Impossible de générer les sujets pour le moment.",
    };
  }
}
