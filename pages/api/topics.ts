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
import {
  METHOD_NOT_ALLOWED,
  internalApiError,
  type ApiErrorBody,
} from "@/lib/api/errors";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "64kb",
    },
  },
  maxDuration: 30,
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<TopicsResult | ApiErrorBody>,
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json(METHOD_NOT_ALLOWED);
  }

  try {
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

    const topics = result.topics.slice(0, MAX_AI_TOPICS);
    return res.status(200).json({
      ...result,
      topics,
      titles: topics.map((t) => t.title),
    });
  } catch (error) {
    console.error("[topics]", error);
    return res
      .status(500)
      .json(internalApiError("Erreur interne pendant la génération des sujets."));
  }
}
