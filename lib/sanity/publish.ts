/**
 * Stub publish : après génération d’un brouillon markdown, créer / patcher
 * un document Sanity (ex. type `post`). À brancher depuis une API route
 * dédiée une fois le schéma Studio aligné.
 *
 * Flux prévu :
 * 1. UI : brouillon markdown prêt
 * 2. POST /api/sanity/publish { title, markdown, slug? }
 * 3. createOrReplace / create document `post` avec body Portable Text ou markdown
 */
import { getSanityWriteClient } from "./client";
import { getSanityEnv } from "./env";

export type PublishDraftInput = {
  title: string;
  markdown: string;
  /** Type de document Studio (défaut `post`). */
  documentType?: string;
  slug?: string;
};

export type PublishDraftResult =
  | { ok: true; id: string; unavailable?: never; error?: never; action?: never }
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

/**
 * Publie un brouillon vers Sanity (createOrReplace).
 * Si Sanity n’est pas configuré, renvoie `unavailable` (échec gracieux).
 */
export async function publishDraftToSanity(
  input: PublishDraftInput,
): Promise<PublishDraftResult> {
  const env = getSanityEnv();
  if (!env.configured) {
    return {
      ok: false,
      unavailable: true,
      error: "Sanity non configuré.",
      action:
        "Ajoutez NEXT_PUBLIC_SANITY_PROJECT_ID (et SANITY_API_WRITE_TOKEN) dans .env.local.",
    };
  }

  const client = getSanityWriteClient();
  if (!client) {
    return {
      ok: false,
      unavailable: true,
      error: "Token d’écriture Sanity absent.",
      action: "Ajoutez SANITY_API_WRITE_TOKEN (Editor) dans .env.local.",
    };
  }

  const type = input.documentType || "post";
  const slug = input.slug || slugify(input.title);
  const id = `${type}.${slug}`;

  // Corps markdown brut pour le POC — remplacer par Portable Text
  // (@portabletext/block-tools) quand le schéma Studio est figé.
  const doc = {
    _id: id,
    _type: type,
    title: input.title,
    slug: { _type: "slug", current: slug },
    bodyMarkdown: input.markdown,
    publishedAt: new Date().toISOString(),
  };

  const result = await client.createOrReplace(doc);
  return { ok: true, id: result._id };
}
