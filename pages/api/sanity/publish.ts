/**
 * API stub : publier un brouillon markdown vers Sanity.
 * Branche le flux UI « Générer » → publish une fois le schéma Studio aligné.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { publishDraftToSanity } from "@/lib/sanity";
import {
  METHOD_NOT_ALLOWED,
  internalApiError,
  type ApiErrorBody,
} from "@/lib/api/errors";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "256kb",
    },
  },
  maxDuration: 30,
};

type PublishOk = { ok: true; id: string };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<
    PublishOk | ApiErrorBody | { unavailable: true; error: string; action: string }
  >,
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json(METHOD_NOT_ALLOWED);
  }

  const title =
    typeof req.body?.title === "string" ? req.body.title.trim() : "";
  const markdown =
    typeof req.body?.markdown === "string" ? req.body.markdown.trim() : "";
  const documentType =
    typeof req.body?.documentType === "string"
      ? req.body.documentType.trim()
      : undefined;
  const slug =
    typeof req.body?.slug === "string" ? req.body.slug.trim() : undefined;

  if (!title || !markdown) {
    return res.status(400).json({
      error: "title et markdown sont requis.",
      code: "MISSING_FIELDS",
      action: "Passez le titre du sujet et le brouillon généré.",
    });
  }

  try {
    const result = await publishDraftToSanity({
      title,
      markdown,
      documentType,
      slug,
    });

    if (!result.ok) {
      return res.status(503).json({
        unavailable: true,
        error: result.error,
        action: result.action,
      });
    }

    return res.status(200).json({ id: result.id, ok: true });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Publication Sanity impossible.";
    return res.status(500).json({
      ...internalApiError(message),
      action: "Vérifiez le token, le dataset et le type de document Studio.",
    });
  }
}
