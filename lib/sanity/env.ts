/**
 * Configuration Sanity (côté serveur) pour la V1 Blog Maker → CMS.
 * Ne pas importer ce module dans du code client sans token write.
 */
export type SanityEnv = {
  projectId: string;
  dataset: string;
  apiVersion: string;
  /** Token avec permission write (server-only). */
  writeToken: string | undefined;
  /** Token read optionnel (CDN / preview). */
  readToken: string | undefined;
  configured: boolean;
};

export function getSanityEnv(): SanityEnv {
  const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID?.trim() ?? "";
  const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET?.trim() || "production";
  const apiVersion =
    process.env.NEXT_PUBLIC_SANITY_API_VERSION?.trim() || "2025-01-01";
  const writeToken = process.env.SANITY_API_WRITE_TOKEN?.trim() || undefined;
  const readToken = process.env.SANITY_API_READ_TOKEN?.trim() || undefined;

  return {
    projectId,
    dataset,
    apiVersion,
    writeToken,
    readToken,
    configured: Boolean(projectId),
  };
}
