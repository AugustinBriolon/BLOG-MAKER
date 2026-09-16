/**
 * Route API POST : génère un brouillon markdown
 * pour un sujet sélectionné après l'analyse SEO.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { generateArticleDraft, type DraftResult } from "@/lib/ai/draft";
import type { BlogPostRef, KeywordHit } from "@/lib/analyze";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "96kb",
    },
  },
  maxDuration: 60,
};

type ErrorBody = { error: string; code?: string; action?: string };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<DraftResult | ErrorBody>,
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res
      .status(405)
      .json({ error: "Méthode non autorisée.", code: "METHOD" });
  }

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
}
