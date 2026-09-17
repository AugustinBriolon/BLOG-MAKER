/**
 * Publish : crée / remplace un document Sanity selon le type + champ corps choisis.
 *
 * Important : le type doit exister dans le schéma Studio, sinon le document
 * est dans le dataset mais invisible dans Structure.
 */
import type { IdentifiedSanityDocumentStub } from "@sanity/client";
import {
  createSanityWriteClient,
  type SanityWriteCredentials,
} from "./client";

export type PublishDraftInput = {
  title: string;
  markdown: string;
  credentials: SanityWriteCredentials;
  /** Type de document Studio (requis). */
  documentType: string;
  /** Nom du champ qui reçoit le markdown (ex. bodyMarkdown, body). */
  bodyField: string;
  slug?: string;
};

export type PublishDraftResult =
  | {
      ok: true;
      id: string;
      documentType: string;
      bodyField: string;
      projectId: string;
      dataset: string;
      unavailable?: never;
      error?: never;
      action?: never;
    }
  | {
      ok: false;
      unavailable: true;
      error: string;
      action: string;
      id?: never;
    };

function slugify(title: string): string {
  return title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 96);
}

function isSafeFieldName(name: string): boolean {
  return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name);
}

/**
 * Publie un brouillon vers Sanity (createOrReplace).
 */
export async function publishDraftToSanity(
  input: PublishDraftInput,
): Promise<PublishDraftResult> {
  const { credentials } = input;
  const projectId = credentials.projectId?.trim() ?? "";
  const writeToken = credentials.writeToken?.trim() ?? "";
  const dataset = credentials.dataset?.trim() || "production";
  const documentType = input.documentType?.trim() ?? "";
  const bodyField = input.bodyField?.trim() ?? "";

  if (!projectId || !writeToken) {
    return {
      ok: false,
      unavailable: true,
      error: "Credentials Sanity manquants.",
      action:
        "Indiquez le Project ID et un token Editor dans la modal de connexion.",
    };
  }

  if (!documentType || !isSafeFieldName(documentType)) {
    return {
      ok: false,
      unavailable: true,
      error: "Type de document invalide.",
      action:
        "Utilisez le nom exact du type Studio (ex. post, article) — sans espaces.",
    };
  }

  if (!bodyField || !isSafeFieldName(bodyField)) {
    return {
      ok: false,
      unavailable: true,
      error: "Nom de champ corps invalide.",
      action:
        "Indiquez le champ texte/markdown du schéma (ex. bodyMarkdown, body).",
    };
  }

  const client = createSanityWriteClient({
    projectId,
    dataset,
    writeToken,
    apiVersion: credentials.apiVersion,
  });

  const slug = input.slug || slugify(input.title);
  const id = `${documentType}.${slug}`;

  const doc: IdentifiedSanityDocumentStub = {
    _id: id,
    _type: documentType,
    title: input.title,
    slug: { _type: "slug", current: slug },
    [bodyField]: input.markdown,
    publishedAt: new Date().toISOString(),
  };

  const result = await client.createOrReplace(doc);
  return {
    ok: true,
    id: result._id,
    documentType,
    bodyField,
    projectId,
    dataset,
  };
}
