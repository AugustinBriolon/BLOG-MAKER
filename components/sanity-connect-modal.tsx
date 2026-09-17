/**
 * Modal Sanity : credentials → chargement des types → Select réel → publish.
 */
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Check, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { SanitySessionCredentials } from "@/lib/sanity/session-credentials";
import { cn } from "@/lib/utils";

export type SanityModalStatus = "form" | "publishing" | "success";

export type PublishMeta = {
  id: string;
  documentType: string;
  bodyField: string;
  projectId: string;
  dataset: string;
};

const BODY_FIELD_OPTIONS = [
  { value: "bodyMarkdown", label: "bodyMarkdown (texte / markdown)" },
  { value: "markdown", label: "markdown" },
  { value: "content", label: "content" },
  { value: "text", label: "text" },
  { value: "body", label: "body (uniquement si string — pas Portable Text)" },
] as const;

type Props = {
  open: boolean;
  status: SanityModalStatus;
  initial?: SanitySessionCredentials | null;
  publishMeta?: PublishMeta | null;
  error?: string | null;
  onClose: () => void;
  onSubmit: (credentials: SanitySessionCredentials) => void;
};

type FormStep = "credentials" | "mapping";

function isUserDocumentType(type: string): boolean {
  return (
    Boolean(type) &&
    !type.startsWith("sanity.") &&
    !type.startsWith("system.") &&
    type !== "assist.instruction.context"
  );
}

export function SanityConnectModal({
  open,
  status,
  initial,
  publishMeta = null,
  error = null,
  onClose,
  onSubmit,
}: Props) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  const [step, setStep] = useState<FormStep>("credentials");
  const [projectId, setProjectId] = useState(initial?.projectId ?? "");
  const [dataset, setDataset] = useState(initial?.dataset ?? "production");
  const [writeToken, setWriteToken] = useState(initial?.writeToken ?? "");
  const [documentType, setDocumentType] = useState(
    initial?.documentType ?? "",
  );
  const [bodyField, setBodyField] = useState(
    initial?.bodyField ?? "bodyMarkdown",
  );
  const [knownTypes, setKnownTypes] = useState<string[]>([]);
  const [typesLoading, setTypesLoading] = useState(false);
  const [typesError, setTypesError] = useState<string | null>(null);

  const busy = status === "publishing";
  const canLoadProject =
    Boolean(projectId.trim()) && Boolean(writeToken.trim()) && !busy;

  useEffect(() => {
    if (!open || status !== "form") return;

    const nextProject = initial?.projectId ?? "";
    const nextDataset = initial?.dataset ?? "production";
    const nextToken = initial?.writeToken ?? "";
    const nextType = initial?.documentType ?? "";
    const nextBody = initial?.bodyField ?? "bodyMarkdown";

    setProjectId(nextProject);
    setDataset(nextDataset);
    setWriteToken(nextToken);
    setDocumentType(nextType);
    setBodyField(nextBody);
    setKnownTypes([]);
    setTypesError(null);

    if (nextProject && nextToken) {
      setStep("credentials");
      void loadDocumentTypes({
        projectId: nextProject,
        dataset: nextDataset,
        writeToken: nextToken,
        preferredType: nextType,
        advanceOnSuccess: true,
      });
    } else {
      setStep("credentials");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset on open only
  }, [open, status, initial]);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !busy) onClose();
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    if (status === "form" && step === "credentials") {
      panelRef.current?.querySelector<HTMLInputElement>("input")?.focus();
    }

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose, busy, status, step]);

  async function loadDocumentTypes(opts: {
    projectId: string;
    dataset: string;
    writeToken: string;
    preferredType?: string;
    advanceOnSuccess?: boolean;
  }) {
    setTypesLoading(true);
    setTypesError(null);
    try {
      const response = await fetch("/api/sanity/document-types", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: opts.projectId.trim(),
          dataset: opts.dataset.trim() || "production",
          writeToken: opts.writeToken.trim(),
        }),
      });
      const data = (await response.json()) as {
        ok?: boolean;
        types?: string[];
        error?: string;
      };
      if (!response.ok) {
        setTypesError(data.error || "Impossible de charger les types.");
        setStep("credentials");
        return;
      }

      const types = (data.types ?? []).filter(isUserDocumentType);
      setKnownTypes(types);

      const preferred = opts.preferredType?.trim() ?? "";
      if (preferred && types.includes(preferred)) {
        setDocumentType(preferred);
      } else if (types.length > 0) {
        setDocumentType(types[0] ?? "");
      } else {
        setDocumentType("");
      }

      if (opts.advanceOnSuccess) {
        setStep("mapping");
      }
    } catch {
      setTypesError("Serveur injoignable.");
      setStep("credentials");
    } finally {
      setTypesLoading(false);
    }
  }

  function handleLoadProject(event: FormEvent) {
    event.preventDefault();
    if (!canLoadProject) return;
    void loadDocumentTypes({
      projectId,
      dataset,
      writeToken,
      preferredType: documentType || initial?.documentType,
      advanceOnSuccess: true,
    });
  }

  function handlePublish(event: FormEvent) {
    event.preventDefault();
    if (!documentType || !bodyField) return;
    onSubmit({
      projectId: projectId.trim(),
      dataset: dataset.trim() || "production",
      writeToken: writeToken.trim(),
      documentType: documentType.trim(),
      bodyField: bodyField.trim(),
    });
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center"
      role="presentation"
    >
      <button
        type="button"
        aria-label="Fermer"
        className="absolute inset-0 bg-foreground/40 backdrop-blur-[2px]"
        disabled={busy}
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-busy={busy || typesLoading}
        className={cn(
          "relative z-10 max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border-[1.5px] border-border bg-card p-5 shadow-lg sm:p-6",
          "animate-rise",
        )}
      >
        {status === "publishing" ? (
          <PublishingPanel titleId={titleId} />
        ) : status === "success" && publishMeta ? (
          <SuccessPanel
            titleId={titleId}
            meta={publishMeta}
            onClose={onClose}
          />
        ) : step === "credentials" || typesLoading ? (
          <CredentialsStep
            titleId={titleId}
            projectId={projectId}
            dataset={dataset}
            writeToken={writeToken}
            loading={typesLoading}
            error={typesError}
            canSubmit={canLoadProject}
            onProjectId={setProjectId}
            onDataset={setDataset}
            onWriteToken={setWriteToken}
            onClose={onClose}
            onSubmit={handleLoadProject}
          />
        ) : (
          <MappingStep
            titleId={titleId}
            projectId={projectId}
            dataset={dataset}
            knownTypes={knownTypes}
            documentType={documentType}
            bodyField={bodyField}
            formError={error}
            busy={busy}
            onDocumentType={setDocumentType}
            onBodyField={setBodyField}
            onBack={() => {
              setTypesError(null);
              setStep("credentials");
            }}
            onClose={onClose}
            onSubmit={handlePublish}
          />
        )}
      </div>
    </div>
  );
}

function CredentialsStep({
  titleId,
  projectId,
  dataset,
  writeToken,
  loading,
  error,
  canSubmit,
  onProjectId,
  onDataset,
  onWriteToken,
  onClose,
  onSubmit,
}: {
  titleId: string;
  projectId: string;
  dataset: string;
  writeToken: string;
  loading: boolean;
  error: string | null;
  canSubmit: boolean;
  onProjectId: (v: string) => void;
  onDataset: (v: string) => void;
  onWriteToken: (v: string) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent) => void;
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <header className="space-y-1.5">
        <p className="font-mono-label text-muted-foreground">Sanity · 1/2</p>
        <h2
          id={titleId}
          className="font-heading text-xl font-semibold tracking-tight text-foreground"
        >
          Connecter le projet
        </h2>
        <p className="text-sm text-muted-foreground">
          On charge ensuite les types de documents présents dans votre dataset
          pour choisir où publier.
        </p>
      </header>

      <div className="space-y-2">
        <Label htmlFor="sanity-project-id">Project ID</Label>
        <Input
          id="sanity-project-id"
          autoComplete="off"
          spellCheck={false}
          required
          placeholder="abc123xy"
          value={projectId}
          disabled={loading}
          onChange={(e) => onProjectId(e.target.value)}
          className="rounded-xl border-[1.5px] bg-background"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="sanity-dataset">Dataset</Label>
        <Input
          id="sanity-dataset"
          autoComplete="off"
          spellCheck={false}
          placeholder="production"
          value={dataset}
          disabled={loading}
          onChange={(e) => onDataset(e.target.value)}
          className="rounded-xl border-[1.5px] bg-background"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="sanity-write-token">Token Editor</Label>
        <Input
          id="sanity-write-token"
          type="password"
          autoComplete="off"
          required
          placeholder="sk…"
          value={writeToken}
          disabled={loading}
          onChange={(e) => onWriteToken(e.target.value)}
          className="rounded-xl border-[1.5px] bg-background font-mono text-sm"
        />
        <p className="text-xs text-muted-foreground">
          <a
            href="https://www.sanity.io/manage"
            target="_blank"
            rel="noopener noreferrer"
            className="text-foreground underline-offset-3 hover:underline"
          >
            manage.sanity.io
          </a>{" "}
          → API → Tokens (Editor).
        </p>
      </div>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="ghost"
          className="rounded-full"
          disabled={loading}
          onClick={onClose}
        >
          Annuler
        </Button>
        <Button
          type="submit"
          className="rounded-full"
          disabled={!canSubmit || loading}
        >
          {loading ? (
            <span className="inline-flex items-center gap-2">
              <LoaderCircle className="size-4 animate-spin" aria-hidden />
              Chargement…
            </span>
          ) : (
            "Charger le projet"
          )}
        </Button>
      </div>
    </form>
  );
}

function MappingStep({
  titleId,
  projectId,
  dataset,
  knownTypes,
  documentType,
  bodyField,
  formError,
  busy,
  onDocumentType,
  onBodyField,
  onBack,
  onClose,
  onSubmit,
}: {
  titleId: string;
  projectId: string;
  dataset: string;
  knownTypes: string[];
  documentType: string;
  bodyField: string;
  formError: string | null;
  busy: boolean;
  onDocumentType: (v: string) => void;
  onBodyField: (v: string) => void;
  onBack: () => void;
  onClose: () => void;
  onSubmit: (event: FormEvent) => void;
}) {
  const hasTypes = knownTypes.length > 0;
  const selectedBody =
    BODY_FIELD_OPTIONS.find((o) => o.value === bodyField)?.label ?? bodyField;

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <header className="space-y-1.5">
        <p className="font-mono-label text-muted-foreground">Sanity · 2/2</p>
        <h2
          id={titleId}
          className="font-heading text-xl font-semibold tracking-tight text-foreground"
        >
          Où publier ?
        </h2>
        <p className="text-sm text-muted-foreground">
          Projet <code className="font-mono text-foreground">{projectId}</code>
          {" · "}
          dataset{" "}
          <code className="font-mono text-foreground">
            {dataset || "production"}
          </code>
        </p>
      </header>

      <div className="space-y-2">
        <Label htmlFor="sanity-document-type">Type de document</Label>
        {hasTypes ? (
          <Select
            value={documentType}
            onValueChange={(value) => {
              if (typeof value === "string") onDocumentType(value);
            }}
            disabled={busy}
          >
            <SelectTrigger
              id="sanity-document-type"
              className="h-10 w-full rounded-xl border-[1.5px] bg-background px-3"
            >
              <SelectValue placeholder="Choisir un type">
                {documentType || "Choisir un type"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent align="start" alignItemWithTrigger className="z-[60]">
              {knownTypes.map((type) => (
                <SelectItem key={type} value={type}>
                  <span className="font-mono text-sm">{type}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <div className="rounded-xl border-[1.5px] border-dashed border-border bg-muted/30 px-3.5 py-3 text-sm text-muted-foreground">
            Aucun type utilisateur dans ce dataset. Créez d’abord un type dans
            Studio (ex. <code className="font-mono">post</code>), publiez un
            document, puis rechargez le projet.
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          Liste des <code className="font-mono">_type</code> déjà présents —
          le type doit aussi être déclaré dans votre schéma Studio.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="sanity-body-field">Champ corps</Label>
        <Select
          value={bodyField}
          onValueChange={(value) => {
            if (typeof value === "string") onBodyField(value);
          }}
          disabled={busy || !hasTypes}
        >
          <SelectTrigger
            id="sanity-body-field"
            className="h-10 w-full rounded-xl border-[1.5px] bg-background px-3"
          >
            <SelectValue placeholder="Choisir un champ">
              {selectedBody}
            </SelectValue>
          </SelectTrigger>
          <SelectContent align="start" alignItemWithTrigger className="z-[60]">
            {BODY_FIELD_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Champ string/text du schéma. Portable Text (blocks) non supporté en
          V1.
        </p>
      </div>

      {formError ? (
        <p className="text-sm text-destructive" role="alert">
          {formError}
        </p>
      ) : null}

      <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-between">
        <Button
          type="button"
          variant="ghost"
          className="rounded-full"
          disabled={busy}
          onClick={onBack}
        >
          Retour
        </Button>
        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          <Button
            type="button"
            variant="ghost"
            className="rounded-full"
            disabled={busy}
            onClick={onClose}
          >
            Annuler
          </Button>
          <Button
            type="submit"
            className="rounded-full"
            disabled={busy || !hasTypes || !documentType || !bodyField}
          >
            Publier
          </Button>
        </div>
      </div>
    </form>
  );
}

function PublishingPanel({ titleId }: { titleId: string }) {
  return (
    <div className="flex flex-col items-center gap-4 py-6 text-center">
      <LoaderCircle
        className="size-8 animate-spin text-foreground"
        aria-hidden
      />
      <div className="space-y-1.5">
        <h2
          id={titleId}
          className="font-heading text-xl font-semibold tracking-tight"
        >
          Publication en cours
        </h2>
        <p className="text-sm text-muted-foreground">
          Écriture du document dans votre dataset Sanity…
        </p>
      </div>
    </div>
  );
}

function SuccessPanel({
  titleId,
  meta,
  onClose,
}: {
  titleId: string;
  meta: PublishMeta;
  onClose: () => void;
}) {
  const manageUrl = `https://www.sanity.io/manage/project/${meta.projectId}`;
  const visionHint = `*[_id == "${meta.id}"][0]`;

  return (
    <div className="flex flex-col gap-4 py-2">
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="flex size-10 items-center justify-center rounded-full bg-foreground text-background">
          <Check className="size-5" aria-hidden strokeWidth={2.5} />
        </span>
        <div className="space-y-1.5">
          <h2
            id={titleId}
            className="font-heading text-xl font-semibold tracking-tight"
          >
            Document créé
          </h2>
          <p className="text-sm text-muted-foreground">
            Dataset <code className="font-mono">{meta.dataset}</code> · type{" "}
            <code className="font-mono">{meta.documentType}</code>
          </p>
        </div>
      </div>

      <dl className="space-y-2 rounded-xl border-[1.5px] border-border bg-muted/30 px-3.5 py-3 text-sm">
        <div className="flex flex-col gap-0.5">
          <dt className="text-xs text-muted-foreground">ID</dt>
          <dd className="break-all font-mono text-xs">{meta.id}</dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="text-xs text-muted-foreground">Champs écrits</dt>
          <dd className="font-mono text-xs">
            title, slug, {meta.bodyField}, publishedAt
          </dd>
        </div>
      </dl>

      <p className="text-xs leading-relaxed text-muted-foreground">
        Invisible dans Structure ? Le type n’est peut‑être pas dans le schéma.
        Vision :
      </p>
      <pre className="overflow-x-auto rounded-lg border border-border bg-background px-3 py-2 font-mono text-[0.7rem] leading-relaxed">
        {visionHint}
      </pre>

      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        <a
          href={manageUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-9 items-center justify-center rounded-full border-[1.5px] border-border bg-background px-4 text-sm font-medium transition-colors hover:bg-muted"
        >
          Ouvrir Manage
        </a>
        <Button type="button" className="rounded-full" onClick={onClose}>
          Fermer
        </Button>
      </div>
    </div>
  );
}
