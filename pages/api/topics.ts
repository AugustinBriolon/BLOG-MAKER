/**
 * Route API POST : génère des sujets d'articles IA
 * à partir du contexte d'analyse (host, mots-clés, blog existant).
 */
import type { NextApiRequest, NextApiResponse } from "next";
import {
  generateTopicTitles,
  MAX_AI_TOPICS,
  type TopicsResult,
} from "@/lib/ai/topics";
import type { BlogPostRef, KeywordHit } from "@/lib/analyze";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "64kb",
    },
  },
  maxDuration: 30,
};

type ErrorBody = { error: string; code?: string; action?: string };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<TopicsResult | ErrorBody>,
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res
      .status(405)
      .json({ error: "Méthode non autorisée.", code: "METHOD" });
  }

  const body = req.body ?? {};
  const host = typeof body.host === "string" ? body.host.trim() : "";
  const domainGuess =
    typeof body.domainGuess === "string" ? body.domainGuess.trim() : "";
  const keywords = Array.isArray(body.keywords)
    ? (body.keywords as KeywordHit[]).slice(0, 40)
    : [];
  const blogPosts = Array.isArray(body.blogPosts)
    ? (body.blogPosts as BlogPostRef[]).slice(0, 20)
    : [];

  if (!host && !domainGuess && keywords.length === 0) {
    return res.status(400).json({
      error: "Contexte d'analyse manquant pour les sujets IA.",
      code: "MISSING_CONTEXT",
      action: "Relancez d’abord l’analyse d’URL.",
    });
  }

  const result = await generateTopicTitles({
    host,
    domainGuess,
    keywords,
    blogPosts,
  });

  return res.status(200).json({
    ...result,
    topics: result.topics.slice(0, MAX_AI_TOPICS),
    titles: result.topics.map((t) => t.title).slice(0, MAX_AI_TOPICS),
  });
}
