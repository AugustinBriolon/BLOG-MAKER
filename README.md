# Blog Maker — POC technique

SaaS de génération d’articles de blog pour renforcer le trafic et le SEO d’un site. Ce dépôt contient le **POC** : à partir d’une URL, analyser le site (crawl poli + mots-clés), proposer des sujets (IA), puis un brouillon d’article (IA).

## Direction V1 — Sanity-first

**Blog Maker for Sanity** : esthétique **[homepage sanity.io](https://www.sanity.io/)** (marketing-clean) + scaffolding CMS. **Pas** le chrome Studio / `@sanity/ui`.

| Étape | Statut |
| --- | --- |
| Analyse → sujets → brouillon | ✅ POC |
| Plan éditorial volume | ⏸ Parké (composant conservé, appel commenté) |
| Publish Sanity | ✅ Modal credentials (session) + API |

UI : custom + shadcn, Space Grotesk + IBM Plex Mono, craft `.button-02`. Publish : modal → `POST /api/sanity/publish` avec `{ title, markdown, credentials }` (credentials en `sessionStorage`, pas dans `.env`).

## Pitch produit (court)

Coller l’URL d’un site → comprendre son domaine métier via le contenu public → obtenir des titres de blog pertinents → générer un brouillon éditable → (V1) publier vers Sanity. L’analyse mots-clés est ouverte ; les appels IA (sujets / brouillon) sont isolés pour une monétisation ultérieure (crédits).

## Architecture

Next.js **Pages Router** (App Router non utilisé pour ce POC).

| Couche | Rôle |
| --- | --- |
| `pages/_app.tsx` | Polices marketing + styles globaux |
| `pages/index.tsx` | UI marketing (analyse → sujets → brouillon → publish) |
| `pages/api/analyze.ts` | Crawl + extraction + mots-clés (+ stream NDJSON optionnel) |
| `pages/api/topics.ts` | 1–3 titres via AI Gateway |
| `pages/api/draft.ts` | Brouillon markdown via AI Gateway |
| `pages/api/sanity/publish.ts` | Publish → document Sanity (credentials requête) |
| `lib/analyze/*` | Pipeline SEO sans LLM |
| `lib/ai/*` | Prompts / appels sujets & brouillon |
| `lib/sanity/*` | Client `@sanity/client`, session credentials, publish |
| `components/*` | Markdown reader, modal Sanity, status, Number Flow, plan volume (parké), shadcn |

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
 → [optionnel] publish Sanity (modal credentials)
```

### Ciblage des pages

À partir de l’URL de départ (locale `/fr/` ou host `.fr`), le crawler **préfère** landing / produit / blog / solutions / tarifs, et **rétrograde** légal, privacy, login, auteurs, carrières, cookies, etc. Les plafonds `MAX_PAGES` / `MAX_SITEMAP_URLS` et le délai entre requêtes restent inchangés.

### Pondération des mots-clés

Le ranking reste **scoré** (bigrammes, accents, bruit) ; les compteurs UI reflètent une masse pondérée arrondie (pas le raw body-only). La homepage (ou l’URL seed / `/fr`) pèse nettement plus que les articles de blog profonds, afin d’ancrer le domain guess sur le positionnement marque plutôt que sur un guide « hero section » ou un nom d’auteur.

### IA

- Défaut : `openai/gpt-4.1-nano` via **Vercel AI Gateway**
- Sans `AI_GATEWAY_API_KEY` : `/api/analyze` OK ; topics/draft → `unavailable` (échec gracieux pour l’UI)

## Ordre des sections résultats

Après analyse, l’UI suit ce narratif :

1. **Domaine** — positionnement du site
2. ~~**Plan éditorial**~~ — volume (parké V1 Sanity)
3. **Sujets** — propositions IA
4. **Brouillon** — draft d’un sujet sélectionné (+ bouton publish Sanity)
5. **Mots-clés** — évidence, replié par défaut
6. **Pages** — échantillon, replié par défaut

(`Blog détecté` peut apparaître entre mots-clés et pages s’il y a des posts.)

## Variables d’environnement

Copier `.env.example` vers `.env.local` :

| Variable | Requis | Description |
| --- | --- | --- |
| `AI_GATEWAY_API_KEY` | pour topics/draft | Clé Vercel AI Gateway |
| `AI_TOPICS_MODEL` | non | Override modèle sujets (défaut nano) |
| `AI_DRAFT_MODEL` | non | Override modèle brouillon (défaut nano) |

### Publier vers Sanity

Les credentials **ne vont pas** dans `.env`. Au clic **Publier** :

1. Modal → Project ID, dataset, token **Editor**, **type de document** (ex. `post`) et **champ corps** (ex. `bodyMarkdown`)
2. Bouton « Charger depuis le dataset » pour lister les `_type` déjà présents
3. `createOrReplace` écrit : `title`, `slug`, `{bodyField}`, `publishedAt`
4. Le type **doit exister dans le schéma Studio** — sinon le document est dans le dataset mais **invisible** dans Structure (vérifier avec Vision : `*[_id == "…"][0]`)

V1 : champ corps = string/text markdown. Pas de Portable Text (`body` en blocks) pour l’instant.

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
| `lib/sanity/` | client, session credentials, publish |
| `components/` | lecteur markdown, modal Sanity, status swap, Number Flow, plan volume (parké), shadcn |
| `pages/api/` | `analyze`, `topics`, `draft`, `sanity/publish` |
| `styles/globals.css` | tokens marketing + `.button-02` + prose / status-swap |

## Limites / scope POC

- Pas d’auth produit, billing, ni OAuth Sanity (credentials modal / session)
- Crawl borné (≈12 pages), polite, pas un crawler exhaustif
- Domain guess heuristique (pas de taxonomie métier)
- Qualité topics/draft dépend du modèle + clé Gateway
- Sites JS-heavy / mur login : peu de texte → keywords faibles (attendu)
- `bodyMarkdown` en attendant Portable Text / schéma Studio figé

## Licence / repo

Dépôt privé / projet : [AugustinBriolon/BLOG-MAKER](https://github.com/AugustinBriolon/BLOG-MAKER).
