/**
 * Route API POST : génère un brouillon markdown
 * pour un sujet sélectionné après l'analyse SEO.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { generateArticleDraft, type DraftResult } from "@/lib/ai/draft";
import type { BlogPostRef, KeywordHit } from "@/lib/analyze";
import {
  METHOD_NOT_ALLOWED,
  internalApiError,
  type ApiErrorBody,
} from "@/lib/api/errors";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "96kb",
    },
  },
  maxDuration: 60,
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<DraftResult | ApiErrorBody>,
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json(METHOD_NOT_ALLOWED);
  }

  try {
    const body = req.body ?? {};
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const host = typeof body.host === "string" ? body.host.trim() : "";
    const domainGuess =
      typeof body.domainGuess === "string" ? body.domainGuess.trim() : "";
    const keywords = Array.isArray(body.keywords)
      ? (body.keywords as KeywordHit[]).slice(0, 20)
      : [];
    const blogPosts = Array.isArray(body.blogPosts)
      ? (body.blogPosts as BlogPostRef[]).slice(0, 12)
      : [];

    if (!title) {
      return res.status(400).json({
        error: "Sujet manquant.",
        code: "MISSING_TITLE",
        action: "Sélectionnez un sujet proposé, puis cliquez sur Générer.",
      });
    }

    const result = await generateArticleDraft({
      title,
      host,
      domainGuess,
      keywords,
      blogPosts,
    });

    return res.status(200).json(result);
  } catch (error) {
    console.error("[draft]", error);
    return res
      .status(500)
      .json(internalApiError("Erreur interne pendant la génération du brouillon."));
  }
}
