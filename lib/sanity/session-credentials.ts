/**
 * Credentials + mapping schéma Sanity (session navigateur uniquement).
 */
export type SanitySessionCredentials = {
  projectId: string;
  dataset: string;
  writeToken: string;
  /** Type Studio (ex. post, article) — doit exister dans le schéma. */
  documentType: string;
  /** Champ texte/markdown qui reçoit le brouillon. */
  bodyField: string;
};

const STORAGE_KEY = "blog-maker:sanity-credentials";

function canUseSessionStorage(): boolean {
  return typeof window !== "undefined" && typeof sessionStorage !== "undefined";
}

function normalize(
  parsed: Partial<SanitySessionCredentials>,
): SanitySessionCredentials | null {
  const projectId =
    typeof parsed.projectId === "string" ? parsed.projectId.trim() : "";
  const writeToken =
    typeof parsed.writeToken === "string" ? parsed.writeToken.trim() : "";
  const dataset =
    typeof parsed.dataset === "string" && parsed.dataset.trim()
      ? parsed.dataset.trim()
      : "production";
  const documentType =
    typeof parsed.documentType === "string" && parsed.documentType.trim()
      ? parsed.documentType.trim()
      : "post";
  const bodyField =
    typeof parsed.bodyField === "string" && parsed.bodyField.trim()
      ? parsed.bodyField.trim()
      : "bodyMarkdown";
  if (!projectId || !writeToken) return null;
  return { projectId, dataset, writeToken, documentType, bodyField };
}

export function getSanitySessionCredentials(): SanitySessionCredentials | null {
  if (!canUseSessionStorage()) return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return normalize(JSON.parse(raw) as Partial<SanitySessionCredentials>);
  } catch {
    return null;
  }
}

export function setSanitySessionCredentials(
  credentials: SanitySessionCredentials,
): void {
  if (!canUseSessionStorage()) return;
  const next = normalize(credentials);
  if (!next) return;
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

export function clearSanitySessionCredentials(): void {
  if (!canUseSessionStorage()) return;
  sessionStorage.removeItem(STORAGE_KEY);
}

export function hasSanitySessionCredentials(): boolean {
  return getSanitySessionCredentials() !== null;
}
