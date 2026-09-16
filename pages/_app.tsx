/**
 * App Pages Router : Sanity UI ThemeProvider + stylesheet (docs @sanity/ui).
 * @see https://www.sanity.io/ui/docs
 * @see https://www.sanity.io/docs/app-sdk/sanity-ui-sdk
 */
import "@sanity/ui/styles.css";
import "@/styles/globals.css";
import type { AppProps } from "next/app";
import { Card, ThemeProvider } from "@sanity/ui";
import { buildTheme } from "@sanity/ui/theme";

const theme = buildTheme();

export default function App({ Component, pageProps }: AppProps) {
  return (
    <ThemeProvider scheme="light" theme={theme}>
      <Card height="fill" tone="transparent" style={{ minHeight: "100vh" }}>
        <Component {...pageProps} />
      </Card>
    </ThemeProvider>
  );
}
