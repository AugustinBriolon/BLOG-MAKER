/**
 * App Pages Router : polices marketing (géométrique + mono) et styles globaux.
 * Direction visuelle = sanity.io homepage (éditorial), pas @sanity/ui Studio.
 */
import "@/styles/globals.css";
import type { AppProps } from "next/app";
import { IBM_Plex_Mono, Space_Grotesk } from "next/font/google";

const sans = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["400", "500", "600", "700"],
});

const heading = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-heading",
  weight: ["400", "500", "600", "700"],
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "500"],
});

export default function App({ Component, pageProps }: AppProps) {
  return (
    <div
      className={`${sans.variable} ${heading.variable} ${mono.variable} min-h-screen font-sans`}
    >
      <Component {...pageProps} />
    </div>
  );
}
