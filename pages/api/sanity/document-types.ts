/**
 * Liste les `_type` déjà présents dans le dataset (aide au mapping schéma).
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { createSanityWriteClient } from "@/lib/sanity";
import {
  METHOD_NOT_ALLOWED,
  internalApiError,
  type ApiErrorBody,
} from "@/lib/api/errors";

type TypesOk = { ok: true; types: string[] };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<TypesOk | ApiErrorBody>,
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json(METHOD_NOT_ALLOWED);
  }

  const projectId =
    typeof req.body?.projectId === "string" ? req.body.projectId.trim() : "";
  const writeToken =
    typeof req.body?.writeToken === "string" ? req.body.writeToken.trim() : "";
  const dataset =
    typeof req.body?.dataset === "string" && req.body.dataset.trim()
      ? req.body.dataset.trim()
      : "production";

  if (!projectId || !writeToken) {
    return res.status(400).json({
      error: "projectId et writeToken sont requis.",
      code: "MISSING_CREDENTIALS",
      action: "Renseignez d’abord Project ID et token Editor.",
    });
  }

  try {
    const client = createSanityWriteClient({
      projectId,
      dataset,
      writeToken,
    });
    const types = await client.fetch<string[]>(
      `array::unique(*[]._type)|order(@)`,
    );
    const filtered = (Array.isArray(types) ? types : []).filter(
      (t) =>
        Boolean(t) &&
        !t.startsWith("sanity.") &&
        !t.startsWith("system.") &&
        t !== "assist.instruction.context",
    );
    return res.status(200).json({
      ok: true,
      types: filtered,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Lecture des types impossible.";
    return res.status(500).json({
      ...internalApiError(message),
      action: "Vérifiez le Project ID, le dataset et le token.",
    });
  }
}
