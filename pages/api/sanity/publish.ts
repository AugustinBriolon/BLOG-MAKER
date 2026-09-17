/**
 * API : publier un brouillon markdown vers Sanity avec credentials + mapping schéma.
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

type PublishOk = {
  ok: true;
  id: string;
  documentType: string;
  bodyField: string;
  projectId: string;
  dataset: string;
};

type CredentialsBody = {
  projectId?: unknown;
  dataset?: unknown;
  writeToken?: unknown;
  apiVersion?: unknown;
};

function parseCredentials(raw: unknown): {
  projectId: string;
  dataset: string;
  writeToken: string;
  apiVersion?: string;
} | null {
  if (!raw || typeof raw !== "object") return null;
  const c = raw as CredentialsBody;
  const projectId =
    typeof c.projectId === "string" ? c.projectId.trim() : "";
  const writeToken =
    typeof c.writeToken === "string" ? c.writeToken.trim() : "";
  const dataset =
    typeof c.dataset === "string" && c.dataset.trim()
      ? c.dataset.trim()
      : "production";
  const apiVersion =
    typeof c.apiVersion === "string" && c.apiVersion.trim()
      ? c.apiVersion.trim()
      : undefined;

  if (!projectId || !writeToken) return null;
  return { projectId, dataset, writeToken, apiVersion };
}

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
      : "";
  const bodyField =
    typeof req.body?.bodyField === "string" ? req.body.bodyField.trim() : "";
  const slug =
    typeof req.body?.slug === "string" ? req.body.slug.trim() : undefined;
  const credentials = parseCredentials(req.body?.credentials);

  if (!title || !markdown) {
    return res.status(400).json({
      error: "title et markdown sont requis.",
      code: "MISSING_FIELDS",
      action: "Passez le titre du sujet et le brouillon généré.",
    });
  }

  if (!credentials) {
    return res.status(400).json({
      error: "Credentials Sanity manquants.",
      code: "MISSING_CREDENTIALS",
      action:
        "Ouvrez la modal Publier et renseignez Project ID + token Editor.",
    });
  }

  if (!documentType || !bodyField) {
    return res.status(400).json({
      error: "documentType et bodyField sont requis.",
      code: "MISSING_SCHEMA_MAPPING",
      action:
        "Indiquez le type Studio (ex. post) et le champ corps (ex. bodyMarkdown).",
    });
  }

  try {
    const result = await publishDraftToSanity({
      title,
      markdown,
      documentType,
      bodyField,
      slug,
      credentials,
    });

    if (!result.ok) {
      return res.status(503).json({
        unavailable: true,
        error: result.error,
        action: result.action,
      });
    }

    return res.status(200).json({
      ok: true,
      id: result.id,
      documentType: result.documentType,
      bodyField: result.bodyField,
      projectId: result.projectId,
      dataset: result.dataset,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Publication Sanity impossible.";
    return res.status(500).json({
      ...internalApiError(message),
      action:
        "Vérifiez le type de document et le champ corps dans votre schéma Studio.",
    });
  }
}
