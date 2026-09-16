import { generateText, Output } from "ai";
import { z } from "zod";
import type { BlogPostRef, KeywordHit } from "@/lib/analyze";
import {
  formatDatePromptBlock,
  getPromptDateContext,
  refreshOutdatedYearsInTitle,
} from "./date-context";
import {
  DEFAULT_TOPICS_MODEL,
  hasAiCredentials,
  missingAiKeyMessage,
} from "./topics";

export type DraftRequest = {
  title: string;
  host: string;
  domainGuess: string;
  keywords: KeywordHit[];
  blogPosts: BlogPostRef[];
};

export type DraftResult = {
  title: string;
  markdown: string;
  model: string;
  unavailable?: boolean;
  error?: string;
  action?: string;
};

const draftSchema = z.object({
  markdown: z
    .string()
    .min(200)
    .describe(
      "Brouillon markdown FR : # titre, ## Plan (liste), intro courte, puis 3–5 ## sections avec 1–2 paragraphes chacune",
    ),
});

export async function generateArticleDraft(
  input: DraftRequest,
): Promise<DraftResult> {
  const model =
    process.env.AI_DRAFT_MODEL?.trim() ||
    process.env.AI_TOPICS_MODEL?.trim() ||
    DEFAULT_TOPICS_MODEL;

  if (!hasAiCredentials()) {
    const missing = missingAiKeyMessage();
    return {
      title: input.title,
      markdown: "",
      model,
      unavailable: true,
      error: "Clé IA absente — brouillon non généré.",
      action: missing.action,
    };
  }

  const title = input.title.trim();
  if (title.length < 8) {
    return {
      title,
      markdown: "",
      model,
      error: "Choisissez un sujet valide.",
      action: "Sélectionnez l’un des sujets proposés, puis Générer.",
    };
  }

  const topKeywords = input.keywords.slice(0, 15).map((k) => k.term).join(", ");
  const existing = input.blogPosts
    .slice(0, 8)
    .map((p) => `- ${p.title}`)
    .join("\n");

  const dateCtx = getPromptDateContext();
  const dateBlock = formatDatePromptBlock(dateCtx);
  const safeTitle = refreshOutdatedYearsInTitle(title, dateCtx.year);

  const prompt = `Tu rédiges un PREMIER BROUILLON d'article de blog SEO (français) pour Blog Maker.
Ce n'est PAS un roman : brouillon solide, concis, prêt à itérer.

${dateBlock}

Titre imposé : ${safeTitle}

Structure markdown obligatoire :
1. # ${safeTitle}
2. ## Plan (liste à puces de 4–6 points)
3. Un paragraphe d'introduction (3–5 phrases)
4. 3 à 5 sections ## avec 1–2 paragraphes chacune (conseils concrets)
5. Pas de conclusion marketing longue ; une phrase de cloture suffit

Contraintes :
- Aligné au domaine : ${input.domainGuess}
- Site : ${input.host}
- Mots-clés utiles : ${topKeywords || "(n/a)"}
- Évite de dupliquer ces contenus existants :
${existing || "(aucun)"}
- Ton professionnel, clair, sans emoji ; cadrage actuel (${dateCtx.year})
- Sortie : UNIQUEMENT le markdown dans le champ prévu`;

  try {
    const { output } = await generateText({
      model,
      output: Output.object({
        name: "ArticleDraft",
        description: "Brouillon markdown d'article de blog",
        schema: draftSchema,
      }),
      prompt,
      temperature: 0.55,
    });

    const markdown = (output?.markdown ?? "").trim();
    if (!markdown) {
      return {
        title: safeTitle,
        markdown: "",
        model,
        error: "Brouillon vide renvoyé par le modèle.",
        action: "Réessayez la génération.",
      };
    }

    return { title: safeTitle, markdown, model };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Génération impossible";
    console.error("[draft]", message);
    return {
      title: safeTitle,
      markdown: "",
      model,
      error: "Impossible de générer le brouillon pour le moment.",
      action: "Réessayez, ou vérifiez votre clé AI Gateway.",
    };
  }
}
