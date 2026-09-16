/**
 * Route API POST : analyse SEO d'une URL.
 * Réponse JSON ou flux NDJSON (progression crawl + résultat final).
 */
import type { NextApiRequest, NextApiResponse } from "next";
import {
  analyzeSite,
  AnalyzeError,
  explainAnalyzeError,
  type AnalyzeResult,
} from "@/lib/analyze";
import {
  METHOD_NOT_ALLOWED,
  internalApiError,
  type ApiErrorBody,
} from "@/lib/api/errors";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "32kb",
    },
  },
  maxDuration: 60,
};

function writeNdjson(res: NextApiResponse, payload: unknown) {
  res.write(`${JSON.stringify(payload)}\n`);
}

function parseUrlBody(body: unknown): string {
  if (typeof body === "object" && body !== null && "url" in body) {
    const url = (body as { url?: unknown }).url;
    return typeof url === "string" ? url : "";
  }
  if (typeof body === "string") {
    try {
      const parsed = JSON.parse(body) as { url?: unknown };
      return typeof parsed.url === "string" ? parsed.url : "";
    } catch {
      return "";
    }
  }
  return "";
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<AnalyzeResult | ApiErrorBody>,
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json(METHOD_NOT_ALLOWED);
  }

  const url = parseUrlBody(req.body);

  const wantsStream =
    req.headers.accept?.includes("application/x-ndjson") ||
    req.query.stream === "1" ||
    (typeof req.body === "object" &&
      req.body !== null &&
      (req.body as { stream?: unknown }).stream === true);

  try {
    if (!wantsStream) {
      const result = await analyzeSite(url);
      return res.status(200).json(result);
    }

    res.writeHead(200, {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    });

    const result = await analyzeSite(url, {
      onProgress: (progress) => {
        writeNdjson(res, { type: "progress", ...progress });
      },
    });

    writeNdjson(res, { type: "result", data: result });
    return res.end();
  } catch (error) {
    if (error instanceof AnalyzeError) {
      const explained = explainAnalyzeError(error);
      if (wantsStream && res.headersSent) {
        writeNdjson(res, {
          type: "error",
          error: explained.message,
          code: error.code,
          action: explained.action,
        });
        return res.end();
      }
      return res.status(error.status).json({
        error: explained.message,
        code: error.code,
        action: explained.action,
      });
    }
    console.error("[analyze]", error);
    const internal = internalApiError(
      "Erreur interne pendant l'analyse.",
    );
    if (wantsStream && res.headersSent) {
      writeNdjson(res, { type: "error", ...internal });
      return res.end();
    }
    return res.status(500).json(internal);
  }
}
