/**
 * Affiche un brouillon markdown : vue prose ou brut, avec copie presse-papiers.
 * Primitives @sanity/ui.
 */
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Box, Button, Card, Flex, Stack } from "@sanity/ui";
import { Code } from "@sanity/ui/code";
import { ClipboardIcon } from "@sanity/icons/Clipboard";
import { CodeIcon } from "@sanity/icons/Code";
import { DocumentTextIcon } from "@sanity/icons/DocumentText";

type Props = {
  markdown: string;
};

export function MarkdownReader({ markdown }: Props) {
  const [showRaw, setShowRaw] = useState(false);
  const [copied, setCopied] = useState(false);

  async function copyMarkdown() {
    try {
      await navigator.clipboard.writeText(markdown);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <Stack gap={3} marginTop={3}>
      <Flex gap={2} wrap="wrap">
        <Button
          mode="ghost"
          fontSize={1}
          padding={2}
          text={showRaw ? "Vue lisible" : "Markdown brut"}
          icon={showRaw ? DocumentTextIcon : CodeIcon}
          onClick={() => setShowRaw((v) => !v)}
        />
        <Button
          mode="ghost"
          fontSize={1}
          padding={2}
          text={copied ? "Copié" : "Copier"}
          icon={ClipboardIcon}
          onClick={() => void copyMarkdown()}
        />
      </Flex>

      {showRaw ? (
        <Card border padding={3} radius={2} tone="transparent">
          <Code language="markdown" size={1}>
            {markdown}
          </Code>
        </Card>
      ) : (
        <Card border padding={[3, 4]} radius={2} tone="transparent">
          <Box className="draft-prose">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
          </Box>
        </Card>
      )}
    </Stack>
  );
}
