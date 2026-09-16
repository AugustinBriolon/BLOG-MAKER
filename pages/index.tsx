/**
 * Page d'accueil Blog Maker : outil compagnon Sanity Studio
 * (primitives @sanity/ui — https://www.sanity.io/ui/docs).
 */
import Head from "next/head";
import { FormEvent, useState } from "react";
import { useRouter } from "next/router";
import {
  Badge,
  Box,
  Button,
  Card,
  Container,
  Flex,
  Heading,
  HeadingSkeleton,
  Inline,
  Label,
  Skeleton,
  Spinner,
  Stack,
  Text,
  TextInput,
  TextSkeleton,
} from "@sanity/ui";
import { ArrowRightIcon } from "@sanity/icons/ArrowRight";
import { ChevronDownIcon } from "@sanity/icons/ChevronDown";
import { ComposeIcon } from "@sanity/icons/Compose";
import { PublishIcon } from "@sanity/icons/Publish";
import { SearchIcon } from "@sanity/icons/Search";
import type { AnalyzeResult } from "@/lib/analyze";
import type { TopicSuggestion } from "@/lib/ai/topics";
import { NumberFlowValue } from "@/components/number-flow-value";
import { StatusSwap } from "@/components/status-swap";
import { MarkdownReader } from "@/components/markdown-reader";
// Mis de côté pour V1 Sanity — plan volume réactivable plus tard.
// import {
//   EditorialVolumePlan,
//   EditorialVolumePlanSkeleton,
// } from "@/components/editorial-volume-plan";

type UiError = { message: string; action?: string };

type CrawlProgress = {
  phase: string;
  done: number;
  total: number;
  label: string;
};

const DEMO_DRAFT_TITLE =
  "Choisir une plateforme de facturation électronique pour un cabinet";

const DEMO_DRAFT_MARKDOWN = `# Choisir une plateforme de facturation électronique pour un cabinet

## Plan
- Clarifier les obligations du cabinet
- Comparer les critères techniques et métier
- Vérifier l’agrément et la conformité
- Préparer la bascule opérationnelle
- Mesurer le ROI et les risques

La facturation électronique n’est plus un sujet périphérique pour les cabinets : elle touche la relation client, la conformité et la productivité au quotidien.

## Clarifier le besoin métier
Avant de comparer les outils, cartographiez vos flux (honoraires, débours, facturation récurrente) et les intégrations indispensables (comptabilité, CRM, signature).

## Critères de choix
Privilegiez la clarté du parcours, la qualité du support, et la capacité à exporter vos données sans friction.

## Conformité
Vérifiez les exigences applicables à votre activité et documentez le contrôle interne associé.

## Bascule
Planifiez une phase pilote courte, formez l’équipe, puis généralisez avec un suivi des incidents.

Une décision informée réduit le risque et accélère l’adoption.
`;

const DEMO_RESULT: AnalyzeResult = {
  siteUrl: "https://example.com",
  host: "example.com",
  discoverySource: "homepage-only",
  pagesAnalyzed: 1,
  pagesFailed: 0,
  pageSamples: [
    {
      url: "https://example.com/",
      title: "Accueil — démo",
      wordCount: 120,
    },
  ],
  blogPosts: [],
  totalSignificantTokens: 120,
  keywords: [
    { term: "facturation", count: 12, kind: "unigram" },
    { term: "cabinet", count: 9, kind: "unigram" },
  ],
  domainGuess: "Démo lecteur markdown",
  warnings: [],
};

const DEMO_TOPICS: TopicSuggestion[] = [
  {
    title: DEMO_DRAFT_TITLE,
    reason: "Aperçu UI du brouillon rendu en prose.",
  },
];

const SOURCE_LABEL: Record<string, string> = {
  sitemap: "sitemap.xml",
  "robots-sitemap": "sitemap (robots.txt)",
  "homepage-links": "liens accueil",
  "homepage-only": "accueil",
};

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <Label size={1} muted>
      {children}
    </Label>
  );
}

function StatusBlock({
  message,
  action,
  tone = "default",
}: {
  message: string;
  action?: string;
  tone?: "default" | "critical";
}) {
  return (
    <Stack gap={2} marginTop={3} role={tone === "critical" ? "alert" : undefined}>
      <Text size={1} muted={tone !== "critical"}>
        {message}
      </Text>
      {action ? (
        <Text size={1}>→ {action}</Text>
      ) : null}
    </Stack>
  );
}

function DomainSkeleton() {
  return (
    <Card border padding={4} radius={2} aria-busy="true">
      <Stack gap={3}>
        <Skeleton animated style={{ width: 64, height: 12 }} radius={1} />
        <HeadingSkeleton animated style={{ width: "70%" }} />
        <Inline gap={2}>
          <Skeleton animated style={{ width: 64, height: 20 }} radius={2} />
          <Skeleton animated style={{ width: 112, height: 20 }} radius={2} />
        </Inline>
      </Stack>
    </Card>
  );
}

function TopicsSkeleton({ withLabel = false }: { withLabel?: boolean }) {
  return (
    <Card border padding={4} radius={2} aria-busy="true">
      <Stack gap={3}>
        {withLabel ? (
          <Skeleton animated style={{ width: 56, height: 12 }} radius={1} />
        ) : null}
        {[0, 1, 2].map((i) => (
          <Card
            key={i}
            padding={3}
            radius={2}
            tone="transparent"
            style={{ opacity: 1 - i * 0.12 }}
          >
            <Stack gap={2}>
              <Skeleton animated style={{ width: 56, height: 18 }} radius={2} />
              <TextSkeleton animated style={{ width: `${92 - i * 14}%` }} />
              <TextSkeleton animated style={{ width: `${72 - i * 10}%` }} size={1} />
            </Stack>
          </Card>
        ))}
      </Stack>
    </Card>
  );
}

function KeywordsSkeleton() {
  return (
    <Flex align="center" justify="space-between" aria-busy="true">
      <Skeleton animated style={{ width: 80, height: 12 }} radius={1} />
      <Skeleton animated style={{ width: 64, height: 12 }} radius={1} />
    </Flex>
  );
}

function PagesSkeleton() {
  return (
    <Flex align="center" justify="space-between" aria-busy="true">
      <Skeleton animated style={{ width: 56, height: 12 }} radius={1} />
      <Skeleton animated style={{ width: 64, height: 12 }} radius={1} />
    </Flex>
  );
}

function DraftSkeleton() {
  return (
    <Card border padding={4} radius={2} marginTop={3} aria-busy="true">
      <Stack gap={3}>
        <TextSkeleton animated style={{ width: "60%" }} />
        <TextSkeleton animated style={{ width: "40%" }} size={1} />
        <TextSkeleton animated />
        <TextSkeleton animated style={{ width: "92%" }} size={1} />
        <TextSkeleton animated style={{ width: "78%" }} size={1} />
        <TextSkeleton animated style={{ width: "33%" }} />
        <TextSkeleton animated size={1} />
        <TextSkeleton animated style={{ width: "88%" }} size={1} />
      </Stack>
    </Card>
  );
}

function AnalyzeStatus({ progress }: { progress: CrawlProgress }) {
  const isCrawl = progress.phase === "crawl" && progress.total > 0;
  const lineKey = isCrawl
    ? "crawl"
    : `phase:${progress.phase}:${progress.label}`;

  return (
    <Flex align="center" gap={2} marginTop={3}>
      <Spinner muted />
      <Box flex={1}>
        <StatusSwap lineKey={lineKey} className="status-swap">
          {isCrawl ? (
            <Text size={1} muted as="span">
              <NumberFlowValue value={progress.done} />
              <span>/</span>
              <span>{progress.total}</span>
              <span> pages…</span>
            </Text>
          ) : (
            <Text size={1} muted>
              {progress.label}
            </Text>
          )}
        </StatusSwap>
      </Box>
    </Flex>
  );
}

async function readAnalyzeStream(
  response: Response,
  onProgress: (p: CrawlProgress) => void,
): Promise<AnalyzeResult> {
  if (!response.body) {
    throw new Error("Flux d’analyse indisponible.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let result: AnalyzeResult | null = null;
  let streamError: UiError | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let newline = buffer.indexOf("\n");
    while (newline >= 0) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      newline = buffer.indexOf("\n");
      if (!line) continue;

      let payload: {
        type?: string;
        phase?: string;
        done?: number;
        total?: number;
        label?: string;
        data?: AnalyzeResult;
        error?: string;
        action?: string;
        code?: string;
      };
      try {
        payload = JSON.parse(line) as typeof payload;
      } catch {
        continue;
      }

      if (payload.type === "progress") {
        onProgress({
          phase: payload.phase ?? "crawl",
          done: payload.done ?? 0,
          total: payload.total ?? 0,
          label: payload.label ?? "Analyse…",
        });
      } else if (payload.type === "result" && payload.data) {
        result = payload.data;
      } else if (payload.type === "error") {
        streamError = {
          message: payload.error || "L’analyse a échoué.",
          action: payload.action,
        };
      }
    }
  }

  if (streamError) {
    const err = new Error(streamError.message) as Error & { action?: string };
    err.action = streamError.action;
    throw err;
  }
  if (!result) {
    throw new Error("Réponse d’analyse incomplète.");
  }
  return result;
}

export default function Home() {
  const router = useRouter();
  const demoDraft = router.isReady && router.query.demoDraft === "1";

  const [url, setUrl] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [progress, setProgress] = useState<CrawlProgress | null>(null);
  const [topicsLoading, setTopicsLoading] = useState(false);
  const [draftLoading, setDraftLoading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<UiError | null>(null);
  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const [topics, setTopics] = useState<TopicSuggestion[]>([]);
  const [topicsError, setTopicsError] = useState<UiError | null>(null);
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [draftMarkdown, setDraftMarkdown] = useState<string | null>(null);
  const [draftError, setDraftError] = useState<UiError | null>(null);
  const [publishError, setPublishError] = useState<UiError | null>(null);
  const [publishId, setPublishId] = useState<string | null>(null);
  const [showAllKeywords, setShowAllKeywords] = useState(false);
  const [keywordsOpen, setKeywordsOpen] = useState(false);
  const [pagesOpen, setPagesOpen] = useState(false);

  const viewResult = result ?? (demoDraft ? DEMO_RESULT : null);
  const viewTopics = topics.length > 0 ? topics : demoDraft ? DEMO_TOPICS : [];
  const viewSelectedTopic =
    selectedTopic ?? (demoDraft ? DEMO_DRAFT_TITLE : null);
  const viewDraftMarkdown =
    draftMarkdown ?? (demoDraft ? DEMO_DRAFT_MARKDOWN : null);

  async function loadTopics(analysis: AnalyzeResult) {
    setTopicsLoading(true);
    setTopicsError(null);
    setTopics([]);
    setSelectedTopic(null);
    setDraftMarkdown(null);
    setDraftError(null);
    setPublishError(null);
    setPublishId(null);

    try {
      const response = await fetch("/api/topics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          host: analysis.host,
          domainGuess: analysis.domainGuess,
          keywords: analysis.keywords.slice(0, 20),
          blogPosts: analysis.blogPosts,
        }),
      });

      const data = (await response.json()) as {
        topics?: TopicSuggestion[];
        titles?: string[];
        error?: string;
        action?: string;
        unavailable?: boolean;
      };

      if (!response.ok) {
        setTopicsError({
          message: data.error || "Sujets IA indisponibles.",
          action: data.action || "Réessayez après l’analyse.",
        });
        return;
      }

      const nextTopics =
        data.topics && data.topics.length > 0
          ? data.topics
          : (data.titles ?? []).map((title) => ({
              title,
              reason: "Opportunité SEO proposée pour ce domaine.",
            }));

      setTopics(nextTopics);
      if (nextTopics[0]) {
        setSelectedTopic(nextTopics[0].title);
      }
      if (data.unavailable || data.error) {
        setTopicsError({
          message: data.error || "Clé IA absente — sujets non générés.",
          action:
            data.action ||
            "Ajoutez AI_GATEWAY_API_KEY dans .env.local.",
        });
      }
    } catch {
      setTopicsError({
        message: "Sujets IA indisponibles.",
        action: "Vérifiez la connexion, puis réessayez.",
      });
    } finally {
      setTopicsLoading(false);
    }
  }

  async function generateDraft() {
    if (!result || !selectedTopic) return;

    setDraftLoading(true);
    setDraftError(null);
    setDraftMarkdown(null);
    setPublishError(null);
    setPublishId(null);

    try {
      const response = await fetch("/api/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: selectedTopic,
          host: result.host,
          domainGuess: result.domainGuess,
          keywords: result.keywords.slice(0, 15),
          blogPosts: result.blogPosts,
        }),
      });

      const data = (await response.json()) as {
        markdown?: string;
        error?: string;
        action?: string;
        unavailable?: boolean;
      };

      if (!response.ok) {
        setDraftError({
          message: data.error || "Génération impossible.",
          action: data.action || "Réessayez.",
        });
        return;
      }

      if (data.unavailable || data.error || !data.markdown) {
        setDraftError({
          message: data.error || "Clé IA absente — brouillon non généré.",
          action:
            data.action ||
            "Ajoutez AI_GATEWAY_API_KEY dans .env.local.",
        });
        return;
      }

      setDraftMarkdown(data.markdown);
    } catch {
      setDraftError({
        message: "Serveur injoignable pour le brouillon.",
        action: "Réessayez dans un instant.",
      });
    } finally {
      setDraftLoading(false);
    }
  }

  async function publishToSanity() {
    if (!viewSelectedTopic || !viewDraftMarkdown) return;

    setPublishing(true);
    setPublishError(null);
    setPublishId(null);

    try {
      const response = await fetch("/api/sanity/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: viewSelectedTopic,
          markdown: viewDraftMarkdown,
        }),
      });

      const data = (await response.json()) as {
        ok?: boolean;
        id?: string;
        error?: string;
        action?: string;
        unavailable?: boolean;
      };

      if (!response.ok) {
        setPublishError({
          message: data.error || "Publication Sanity impossible.",
          action:
            data.action ||
            "Vérifiez NEXT_PUBLIC_SANITY_PROJECT_ID et SANITY_API_WRITE_TOKEN.",
        });
        return;
      }

      if (data.id) {
        setPublishId(data.id);
      }
    } catch {
      setPublishError({
        message: "Serveur injoignable pour le publish Sanity.",
        action: "Réessayez dans un instant.",
      });
    } finally {
      setPublishing(false);
    }
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setAnalyzing(true);
    setProgress({
      phase: "robots",
      done: 0,
      total: 0,
      label: "Démarrage de l’analyse…",
    });
    setTopicsLoading(false);
    setDraftLoading(false);
    setPublishing(false);
    setError(null);
    setResult(null);
    setTopics([]);
    setTopicsError(null);
    setSelectedTopic(null);
    setDraftMarkdown(null);
    setDraftError(null);
    setPublishError(null);
    setPublishId(null);
    setShowAllKeywords(false);
    setKeywordsOpen(false);
    setPagesOpen(false);

    try {
      const response = await fetch("/api/analyze?stream=1", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/x-ndjson",
        },
        body: JSON.stringify({ url, stream: true }),
      });

      if (
        !response.ok &&
        !response.headers.get("content-type")?.includes("ndjson")
      ) {
        const data = (await response.json()) as {
          error?: string;
          action?: string;
        };
        setError({
          message: data.error || "L’analyse a échoué.",
          action: data.action,
        });
        setAnalyzing(false);
        setProgress(null);
        return;
      }

      const data = await readAnalyzeStream(response, setProgress);
      setResult(data);
      setAnalyzing(false);
      setProgress(null);
      void loadTopics(data);
    } catch (err) {
      const action =
        err && typeof err === "object" && "action" in err
          ? String((err as { action?: string }).action ?? "")
          : undefined;
      setError({
        message:
          err instanceof Error ? err.message : "Serveur injoignable.",
        action: action || "Réessayez, ou changez d’URL.",
      });
      setAnalyzing(false);
      setProgress(null);
    }
  }

  const showResults = Boolean(viewResult) && !analyzing;
  const showWorkspace = analyzing || showResults;

  return (
    <>
      <Head>
        <title>Blog Maker · Sanity</title>
        <meta
          name="description"
          content="Blog Maker — outil compagnon Sanity Studio : URL → sujets → brouillon → publish."
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <Card borderBottom paddingX={[3, 4]} paddingY={3} tone="default" shadow={1}>
        <Container width={2}>
          <Flex align="center" justify="space-between" gap={3}>
            <Inline gap={2}>
              <Text size={2} weight="semibold">
                Blog Maker
              </Text>
              <Badge fontSize={0} tone="primary">
                for Sanity
              </Badge>
            </Inline>
            <Text size={1} muted>
              Analyse → sujets → brouillon → publish
            </Text>
          </Flex>
        </Container>
      </Card>

      <Container width={2} paddingX={[3, 4]} paddingY={[4, 5]}>
        <Stack gap={5}>
          <Stack gap={2}>
            <Heading as="h1" size={2}>
              Analyser un site
            </Heading>
            <Text muted size={1}>
              Crawl SEO, sujets IA et brouillon prêts pour Sanity Studio.
            </Text>
          </Stack>

          <Box as="form" onSubmit={onSubmit}>
            <Flex
              direction={["column", "row"]}
              gap={2}
              align={["stretch", "center"]}
            >
              <Box flex={1}>
                <TextInput
                  id="site-url"
                  type="url"
                  inputMode="url"
                  required
                  icon={SearchIcon}
                  placeholder="https://exemple.com"
                  value={url}
                  onChange={(e) => setUrl(e.currentTarget.value)}
                  disabled={analyzing}
                  fontSize={2}
                  padding={3}
                  radius={2}
                />
              </Box>
              <Button
                type="submit"
                text="Analyser"
                iconRight={ArrowRightIcon}
                tone="primary"
                fontSize={2}
                padding={3}
                radius={2}
                disabled={analyzing || !url.trim()}
                loading={analyzing}
              />
            </Flex>
          </Box>

          {analyzing && progress ? <AnalyzeStatus progress={progress} /> : null}

          {error && !analyzing ? (
            <Card padding={3} radius={2} tone="critical" border>
              <StatusBlock
                message={error.message}
                action={error.action}
                tone="critical"
              />
            </Card>
          ) : null}

          {showWorkspace ? (
            <Stack gap={4}>
              {analyzing && !viewResult ? (
                <DomainSkeleton />
              ) : viewResult ? (
                <Card border padding={4} radius={2}>
                  <Stack gap={3}>
                    <SectionLabel>Domaine</SectionLabel>
                    <Heading as="h2" size={1}>
                      {viewResult.domainGuess}
                    </Heading>
                    <Inline gap={2}>
                      <Badge tone="primary">
                        {viewResult.pagesAnalyzed} pages
                      </Badge>
                      <Badge>
                        {SOURCE_LABEL[viewResult.discoverySource] ??
                          viewResult.discoverySource}
                      </Badge>
                      {viewResult.pagesFailed > 0 ? (
                        <Badge tone="critical">
                          {viewResult.pagesFailed} échec
                          {viewResult.pagesFailed > 1 ? "s" : ""}
                        </Badge>
                      ) : null}
                    </Inline>
                  </Stack>
                </Card>
              ) : null}

              {/* Plan éditorial (volume) — mis de côté pour V1 Sanity */}
              {/* {analyzing && !viewResult ? (
                <EditorialVolumePlanSkeleton />
              ) : viewResult ? (
                <EditorialVolumePlan />
              ) : null} */}

              {analyzing && !viewResult ? (
                <TopicsSkeleton withLabel />
              ) : viewResult ? (
                <Card border padding={4} radius={2}>
                  <Stack gap={4}>
                    <SectionLabel>Sujets</SectionLabel>

                    {topicsLoading ? (
                      <TopicsSkeleton />
                    ) : viewTopics.length > 0 ? (
                      <Stack gap={2} as="ul" style={{ listStyle: "none", margin: 0, padding: 0 }}>
                        {viewTopics.map((topic) => {
                          const selected = viewSelectedTopic === topic.title;
                          return (
                            <Box as="li" key={topic.title}>
                              <Card
                                as="button"
                                type="button"
                                padding={3}
                                radius={2}
                                border
                                tone={selected ? "primary" : "default"}
                                selected={selected}
                                onClick={() => {
                                  setSelectedTopic(topic.title);
                                  setDraftMarkdown(null);
                                  setDraftError(null);
                                  setPublishError(null);
                                  setPublishId(null);
                                }}
                                style={{
                                  width: "100%",
                                  textAlign: "left",
                                  cursor: "pointer",
                                }}
                              >
                                <Stack gap={2}>
                                  <Inline gap={2}>
                                    <Badge fontSize={0} tone="primary">
                                      proposé
                                    </Badge>
                                    {selected ? (
                                      <Text size={1} muted>
                                        sélectionné
                                      </Text>
                                    ) : null}
                                  </Inline>
                                  <Text size={2} weight="semibold">
                                    {topic.title}
                                  </Text>
                                  {topic.reason ? (
                                    <Text size={1} muted>
                                      {topic.reason}
                                    </Text>
                                  ) : null}
                                </Stack>
                              </Card>
                            </Box>
                          );
                        })}
                      </Stack>
                    ) : (
                      <StatusBlock
                        message={
                          topicsError?.message || "Aucun sujet généré."
                        }
                        action={topicsError?.action}
                      />
                    )}

                    {viewTopics.length > 0 ? (
                      <Flex
                        direction={["column", "row"]}
                        gap={3}
                        align={["stretch", "center"]}
                      >
                        <Button
                          text={draftLoading ? "Génération…" : "Générer"}
                          icon={ComposeIcon}
                          tone="primary"
                          mode="default"
                          disabled={!viewSelectedTopic || draftLoading}
                          loading={draftLoading}
                          onClick={() => void generateDraft()}
                          fontSize={1}
                          padding={3}
                          radius={2}
                        />
                        <Text size={1} muted>
                          Brouillon markdown — ensuite publish Sanity.
                        </Text>
                      </Flex>
                    ) : null}

                    {draftLoading || viewDraftMarkdown || draftError ? (
                      <Stack gap={3}>
                        <SectionLabel>Brouillon</SectionLabel>
                        {draftLoading ? (
                          <DraftSkeleton />
                        ) : draftError ? (
                          <StatusBlock
                            message={draftError.message}
                            action={draftError.action}
                          />
                        ) : viewDraftMarkdown ? (
                          <>
                            <MarkdownReader markdown={viewDraftMarkdown} />
                            <Flex
                              direction={["column", "row"]}
                              gap={3}
                              align={["stretch", "center"]}
                            >
                              <Button
                                text={
                                  publishing
                                    ? "Publication…"
                                    : publishId
                                      ? "Republier sur Sanity"
                                      : "Publier sur Sanity"
                                }
                                icon={PublishIcon}
                                tone="positive"
                                disabled={publishing}
                                loading={publishing}
                                onClick={() => void publishToSanity()}
                                fontSize={1}
                                padding={3}
                                radius={2}
                              />
                              {publishId ? (
                                <Text size={1} muted>
                                  Document <code>{publishId}</code>
                                </Text>
                              ) : null}
                            </Flex>
                            {publishError ? (
                              <Card padding={3} radius={2} tone="caution" border>
                                <StatusBlock
                                  message={publishError.message}
                                  action={publishError.action}
                                />
                              </Card>
                            ) : null}
                          </>
                        ) : null}
                      </Stack>
                    ) : null}
                  </Stack>
                </Card>
              ) : null}

              {analyzing && !viewResult ? (
                <KeywordsSkeleton />
              ) : viewResult ? (
                <Card border padding={3} radius={2}>
                  <Stack gap={3}>
                    <Flex align="center" justify="space-between" gap={3}>
                      <SectionLabel>Mots-clés</SectionLabel>
                      <Button
                        mode="bleed"
                        fontSize={1}
                        padding={2}
                        text={keywordsOpen ? "Masquer" : "Afficher"}
                        iconRight={ChevronDownIcon}
                        onClick={() => setKeywordsOpen((v) => !v)}
                      />
                    </Flex>
                    {keywordsOpen ? (
                      <Stack gap={2} as="ol" style={{ margin: 0, padding: 0, listStyle: "none" }}>
                        {viewResult.keywords
                          .slice(0, showAllKeywords ? undefined : 10)
                          .map((kw, index) => (
                            <Flex
                              as="li"
                              key={`${kw.kind}-${kw.term}`}
                              justify="space-between"
                              gap={3}
                            >
                              <Inline gap={3}>
                                <Text size={1} muted style={{ width: 20 }}>
                                  {index + 1}
                                </Text>
                                <Text size={1} weight="medium">
                                  {kw.term}
                                </Text>
                              </Inline>
                              <Text size={1} muted>
                                {kw.count}
                              </Text>
                            </Flex>
                          ))}
                        {viewResult.keywords.length > 10 ? (
                          <Button
                            mode="bleed"
                            fontSize={1}
                            padding={2}
                            text={
                              showAllKeywords
                                ? "Voir moins"
                                : `Voir plus (${viewResult.keywords.length - 10})`
                            }
                            iconRight={ChevronDownIcon}
                            onClick={() => setShowAllKeywords((v) => !v)}
                            style={{ alignSelf: "flex-start" }}
                          />
                        ) : null}
                      </Stack>
                    ) : null}
                  </Stack>
                </Card>
              ) : null}

              {viewResult && viewResult.blogPosts.length > 0 ? (
                <Card border padding={3} radius={2}>
                  <Stack gap={3}>
                    <SectionLabel>Blog détecté</SectionLabel>
                    <Stack gap={2} as="ul" style={{ listStyle: "none", margin: 0, padding: 0 }}>
                      {viewResult.blogPosts.slice(0, 6).map((page) => (
                        <Box as="li" key={page.url}>
                          <Text size={1}>
                            <a href={page.url} target="_blank" rel="noopener noreferrer">
                              {page.title}
                            </a>
                          </Text>
                        </Box>
                      ))}
                    </Stack>
                  </Stack>
                </Card>
              ) : null}

              {analyzing && !viewResult ? (
                <PagesSkeleton />
              ) : viewResult && viewResult.pageSamples.length > 0 ? (
                <Card border padding={3} radius={2}>
                  <Stack gap={3}>
                    <Flex align="center" justify="space-between" gap={3}>
                      <SectionLabel>Pages</SectionLabel>
                      <Button
                        mode="bleed"
                        fontSize={1}
                        padding={2}
                        text={pagesOpen ? "Masquer" : "Afficher"}
                        iconRight={ChevronDownIcon}
                        onClick={() => setPagesOpen((v) => !v)}
                      />
                    </Flex>
                    {pagesOpen ? (
                      <Stack gap={2} as="ul" style={{ listStyle: "none", margin: 0, padding: 0 }}>
                        {viewResult.pageSamples.map((page) => (
                          <Box as="li" key={page.url}>
                            <Text size={1}>
                              <a
                                href={page.url}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                {page.title}
                              </a>
                            </Text>
                          </Box>
                        ))}
                      </Stack>
                    ) : null}
                  </Stack>
                </Card>
              ) : null}

              {viewResult && viewResult.warnings.length > 0 ? (
                <Stack gap={2} as="ul" style={{ listStyle: "none", margin: 0, padding: 0 }}>
                  {viewResult.warnings.map((w) => (
                    <Box as="li" key={w}>
                      <Text size={1} muted>
                        · {w}
                      </Text>
                    </Box>
                  ))}
                </Stack>
              ) : null}
            </Stack>
          ) : null}
        </Stack>
      </Container>
    </>
  );
}
