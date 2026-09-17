/**
 * Client Sanity minimal pour la V1 Blog Maker.
 * Lecture CDN (env) ; écriture via env ou credentials de requête (éphémères).
 */
import { createClient, type SanityClient } from "@sanity/client";
import { getSanityEnv } from "./env";

export type SanityWriteCredentials = {
  projectId: string;
  dataset: string;
  writeToken: string;
  apiVersion?: string;
};

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
 * Client écriture (mutations) depuis l’env serveur.
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

/**
 * Client écriture éphémère (credentials fournis à la requête).
 * Pas de cache — chaque appel crée un client neuf.
 */
export function createSanityWriteClient(
  credentials: SanityWriteCredentials,
): SanityClient {
  const env = getSanityEnv();
  return createClient({
    projectId: credentials.projectId,
    dataset: credentials.dataset || "production",
    apiVersion: credentials.apiVersion?.trim() || env.apiVersion,
    useCdn: false,
    token: credentials.writeToken,
  });
}
