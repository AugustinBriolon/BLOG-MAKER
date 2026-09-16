import type { NextApiRequest, NextApiResponse } from "next";
import {
  analyzeSite,
  AnalyzeError,
  explainAnalyzeError,
  type AnalyzeResult,
} from "@/lib/analyze";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "32kb",
    },
  },
  maxDuration: 60,
};

type ErrorBody = {
  error: string;
  code?: string;
  action?: string;
};

function writeNdjson(res: NextApiResponse, payload: unknown) {
  res.write(`${JSON.stringify(payload)}\n`);
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<AnalyzeResult | ErrorBody>,
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res
      .status(405)
      .json({ error: "Méthode non autorisée.", code: "METHOD" });
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

  const wantsStream =
    req.headers.accept?.includes("application/x-ndjson") ||
    req.query.stream === "1" ||
    req.body?.stream === true;

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
    if (wantsStream && res.headersSent) {
      writeNdjson(res, {
        type: "error",
        error: "Erreur interne pendant l'analyse.",
        code: "INTERNAL",
        action: "Réessayez dans un instant.",
      });
      return res.end();
    }
    return res.status(500).json({
      error: "Erreur interne pendant l'analyse.",
      code: "INTERNAL",
      action: "Réessayez dans un instant.",
    });
  }
}
