# Blog Maker — POC technique

SaaS de génération d’articles de blog pour renforcer le trafic et le SEO d’un site. Ce dépôt contient le **POC** : à partir d’une URL, analyser le site (crawl poli + mots-clés), proposer des sujets (IA), puis un brouillon d’article (IA).

## Pitch produit (court)

Coller l’URL d’un site → comprendre son domaine métier via le contenu public → obtenir des titres de blog pertinents → générer un brouillon éditable. L’analyse mots-clés est ouverte ; les appels IA (sujets / brouillon) sont isolés pour une monétisation ultérieure (crédits).

## Architecture

Next.js **Pages Router** (App Router non utilisé pour ce POC).

| Couche | Rôle |
| --- | --- |
| `pages/index.tsx` | UI progressive (progress crawl, skeletons par section, lecteur MD) |
| `pages/api/analyze.ts` | Crawl + extraction + mots-clés (+ stream NDJSON optionnel) |
| `pages/api/topics.ts` | 1–3 titres via AI Gateway |
| `pages/api/draft.ts` | Brouillon markdown via AI Gateway |
| `lib/analyze/*` | Pipeline SEO sans LLM |
| `lib/ai/*` | Prompts / appels sujets & brouillon |
| `components/*` | UI (status, Number Flow, markdown, shadcn) |

## Pipeline

```
URL
 → robots.txt
 → sitemap (ou fallback liens homepage)
 → sélection priorisée des pages (plafond 12)
 → fetch poli (gap ~200 ms) + extraction texte (cheerio)
 → tokens / bigrammes pondérés :
      title · meta · OG · H1 ≫ corps ;
      homepage / locale home ≫ pages profondes ;
      démotion auteurs + chrome UI (hero, section…)
 → domain guess
 → [optionnel] topics IA
 → [optionnel] draft IA
```

### Ciblage des pages

À partir de l’URL de départ (locale `/fr/` ou host `.fr`), le crawler **préfère** landing / produit / blog / solutions / tarifs, et **rétrograde** légal, privacy, login, auteurs, carrières, cookies, etc. Les plafonds `MAX_PAGES` / `MAX_SITEMAP_URLS` et le délai entre requêtes restent inchangés.

### Pondération des mots-clés

Le ranking reste **scoré** (bigrammes, accents, bruit) ; les compteurs UI reflètent une masse pondérée arrondie (pas le raw body-only). La homepage (ou l’URL seed / `/fr`) pèse nettement plus que les articles de blog profonds, afin d’ancrer le domain guess sur le positionnement marque plutôt que sur un guide « hero section » ou un nom d’auteur.

### IA

- Défaut : `openai/gpt-4.1-nano` via **Vercel AI Gateway**
- Sans `AI_GATEWAY_API_KEY` : `/api/analyze` OK ; topics/draft → `unavailable` (échec gracieux pour l’UI)

## Variables d’environnement

Copier `.env.example` vers `.env.local` :

| Variable | Requis | Description |
| --- | --- | --- |
| `AI_GATEWAY_API_KEY` | pour topics/draft | Clé Vercel AI Gateway |
| `AI_TOPICS_MODEL` | non | Override modèle sujets (défaut nano) |
| `AI_DRAFT_MODEL` | non | Override modèle brouillon (défaut nano) |

## Lancer en local

```bash
npm install
npm run dev
```

Ouvrir [http://localhost:3000](http://localhost:3000).

Autres scripts : `npm run build`, `npm start`, `npm run lint`.

### API (smoke)

```bash
curl -s -X POST http://localhost:3000/api/analyze \
  -H 'Content-Type: application/json' \
  -d '{"url":"https://www.zlawyer.fr/logiciel-avocats/"}'
```

## Dossiers clés

| Chemin | Contenu |
| --- | --- |
| `lib/analyze/` | robots, sitemap, http poli, extract, keywords, priorisation URL, blog-posts |
| `lib/ai/` | topics, draft, contexte date (anti spam année) |
| `components/` | lecteur markdown, status swap, Number Flow, UI shadcn |
| `pages/api/` | `analyze`, `topics`, `draft` |
| `styles/globals.css` | tokens + styles POC (dont `.button-02`) |

## Limites / scope POC

- Pas d’auth, billing, ni publication CMS
- Crawl borné (≈12 pages), polite, pas un crawler exhaustif
- Domain guess heuristique (pas de taxonomie métier)
- Qualité topics/draft dépend du modèle + clé Gateway
- Sites JS-heavy / mur login : peu de texte → keywords faibles (attendu)

## Licence / repo

Dépôt privé / projet : [AugustinBriolon/BLOG-MAKER](https://github.com/AugustinBriolon/BLOG-MAKER).
