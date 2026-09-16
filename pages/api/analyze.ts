import type { NextApiRequest, NextApiResponse } from "next";
import { analyzeSite, AnalyzeError, type AnalyzeResult } from "@/lib/analyze";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "32kb",
    },
  },
  // Crawl séquentiel + politeness — laisser de la marge en serverless
  maxDuration: 60,
};

type ErrorBody = {
  error: string;
  code?: string;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<AnalyzeResult | ErrorBody>,
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Méthode non autorisée.", code: "METHOD" });
  }

  const url =
    typeof req.body?.url === "string"
      ? req.body.url
      : typeof req.body === "string"
        ? (() => {
            try {
              return JSON.parse(req.body).url as string;
            } catch {
              return "";
            }
          })()
        : "";

  try {
    const result = await analyzeSite(url);
    return res.status(200).json(result);
  } catch (error) {
    if (error instanceof AnalyzeError) {
      return res.status(error.status).json({
        error: error.message,
        code: error.code,
      });
    }
    console.error("[analyze]", error);
    return res.status(500).json({
      error: "Erreur interne pendant l'analyse.",
      code: "INTERNAL",
    });
  }
}
