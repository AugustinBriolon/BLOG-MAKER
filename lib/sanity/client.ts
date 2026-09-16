/**
 * Client Sanity minimal pour le POC « Blog Maker for Sanity ».
 * Lecture CDN si configuré ; écriture uniquement avec SANITY_API_WRITE_TOKEN.
 */
import { createClient, type SanityClient } from "@sanity/client";
import { getSanityEnv } from "./env";

let cachedRead: SanityClient | null = null;
let cachedWrite: SanityClient | null = null;

/** Client lecture (CDN). Retourne null si projectId absent. */
export function getSanityReadClient(): SanityClient | null {
  const env = getSanityEnv();
  if (!env.configured) return null;
  if (cachedRead) return cachedRead;

  cachedRead = createClient({
    projectId: env.projectId,
    dataset: env.dataset,
    apiVersion: env.apiVersion,
    useCdn: true,
    token: env.readToken,
  });
  return cachedRead;
}

/**
 * Client écriture (mutations). Server-only.
 * Retourne null si projectId ou write token manquant.
 */
export function getSanityWriteClient(): SanityClient | null {
  const env = getSanityEnv();
  if (!env.configured || !env.writeToken) return null;
  if (cachedWrite) return cachedWrite;

  cachedWrite = createClient({
    projectId: env.projectId,
    dataset: env.dataset,
    apiVersion: env.apiVersion,
    useCdn: false,
    token: env.writeToken,
  });
  return cachedWrite;
}
