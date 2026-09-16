/**
 * Forme d'erreur JSON partagée par les routes `/api/*`.
 */
export type ApiErrorBody = {
  error: string;
  code?: string;
  action?: string;
};

export const METHOD_NOT_ALLOWED: ApiErrorBody = {
  error: "Méthode non autorisée.",
  code: "METHOD",
  action: "Utilisez la méthode POST.",
};

export function internalApiError(message: string): ApiErrorBody {
  return {
    error: message,
    code: "INTERNAL",
    action: "Réessayez dans un instant.",
  };
}
