# Artist Search

Find teaterforestillinger og koncerter en skuespiller eller musiker
medvirker i. Indtast et navn, vælg profession, og få en liste med
rolle, produktion, spillested og link.

Ren statisk side: `index.html` (HTML + CSS + JS, ingen build, intet
framework) søger client-side i `data/events.json`. Data genereres af
Python-scripts i `scripts/`, der scraper offentlige sider hos syv danske
teatre og spillesteder. Deployes til GitHub Pages via
`.github/workflows/deploy-pages.yml`, som publicerer repo-roden ved push.

## Kør lokalt

Åbn `index.html` i en browser (eller `python3 -m http.server` og gå til
`localhost:8000`) — ingen server eller build nødvendig.

## Gendan data

```bash
pip install -r scripts/requirements.txt
python3 scripts/build_data.py
```

Skriver `data/events.json`. Hver kilde scrapes uafhængigt — fejler én
kilde (netværk, ændret HTML), fortsætter de andre, og fejlen logges.

## Kilder og hvad der rent faktisk blev fundet

Alle syv URL'er fra opgavebeskrivelsen blev afprøvet med rigtige
HTTP-kald (robots.txt + faktiske sider), ikke gættet ud fra søgning.

| Kilde | robots.txt | Struktur | Cast-data |
| --- | --- | --- | --- |
| **kglteater.dk** | `Allow: /` | Server-renderet HTML | Ja — men delvist. Hver forestilling har en "cast grid" (fotokort) og en separat "contribution group"-liste (instruktør, koreograf, komponist, designere — altid komplet). For store produktioner (ballet/opera) viser cast-grid kun 1-2 navne plus en "Se alle medvirkende"-knap, der loader resten via JavaScript. Vi fandt ikke det bagvedliggende API trods forsøg. Koncert-sider (kategori `/koncert/`) har ofte ingen liste — der er kunstnerens navn selve titlen, ligesom hos et spillested. |
| **aveny-t.dk** | Squarespace-standard robots.txt: disallow `/api/`, `/search`, `/config`, `/account`, diverse `?format=`-parametre. Indhold på `/forestillinger/*` er tilladt. | Server-renderet HTML | Ja — fri tekst-credits ("**MEDVIRKENDE** Navn1, Navn2, Navn3") udtrækkes med regex. |
| **aarhusteater.dk** | `Allow: /` | **Client-renderet React SPA** — både listen og hver forestillingsside er samme ~2 KB HTML-skal (`<div id="root">`). | Fandt et rigtigt JSON-API, `GET /api/shows`, med alle aktuelle forestillinger (titel, spillested, datoer, billetlink) — men **ingen cast-data**. Bundlen refererer et Umbraco-agtigt `/api/content/<sti>`-endpoint, men enhver sti vi prøvede gav 404. Forestillinger indekseres derfor uden medvirkende (se Begrænsninger). |
| **odenseteater.dk** | `Disallow: /App_Plugins/`, `/umbraco/` (kun CMS-admin) | Server-renderet HTML (Umbraco) | Ja — cast står som fri tekst under en "medvirkende"-overskrift (rolle + navn i par), fundet ved at søge på overskriftens tekst frem for en CSS-klasse, da klasserne genbruges andre steder på siden. |
| **vega.dk** | `www.vega.dk` redirecter til `vega.dk`, hvis robots.txt tillader alt (`Disallow:` tom) | Next.js, server-renderet (`__NEXT_DATA__`) | **Delvis.** Kalendersiden indlejrer de ~25 nærmeste kommende koncerter (ud af i alt ~200) direkte i HTML. Resten hentes af en "Load more"-knap via en klient-API (`/api/events`), som konsekvent gav HTTP 500 uanset hvilke query-parametre vi prøvede, og `?page=N` på selve kalender-URL'en ignoreres server-side. Vi forsøgte at finde det rigtige kald med en headless browser (Playwright/Chromium), men miljøets udgående netværk går gennem en proxy som Chromium ikke selv ville route igennem. Titlen er selve kunstnernavnet; en evt. opvarmningsakt (`contributor`-feltet) tilføjes som egen linje. |
| **drkoncerthuset.dk** | robots.txt selv giver **HTTP 403 "Access Denied"** fra en Akamai-edge, uanset user agent — men den faktiske `/kalender/`-side svarer 200. Vi kunne derfor ikke bekræfte crawl-tilladelser og scraper konservativt: ét enkelt kald til denne side, intet andet fra domænet. | Server-renderet HTML | Ja — hele kalenderen (299 koncerter) ligger allerede i siden som en HTML-escaped JSON-blob i et Vue-komponent-attribut (`data-component-args`). Feltet `info.label` ("DR Vokalensemblet \| Carsten Seyer-Hansen dirigent") splittes på "\|" og navn/rolle adskilles med en ordliste over kendte roller (dirigent, klaver, sopran, …). |
| **ab-b.dk** (Amager Bio) | `Disallow:` tom (Yoast SEO-standard) | Server-renderet HTML (WordPress) | Ja — hovednavn er sidens `<h1>`, support-acts står i `.support-bands`. WordPress REST API (`/wp-json/`) er blokeret af et sikkerhedsplugin, så vi bruger den almindelige HTML-side. Alle sider findes via `concert-sitemap.xml`, ikke ved at gætte en listeside. |

## Kendte begrænsninger

- **Aarhus Teater har ingen medvirkende-data.** Kun forestillingens titel
  indekseres (som `skuespiller`), så et opslag på stykket stadig finder
  det — men individuelle skuespillere fra dette teater kan ikke søges frem.
- **VEGA dækker kun de ~25 nærmeste koncerter**, ikke hele kalenderen.
  Se tabellen ovenfor for hvorfor.
- **kglteater.dk: store ensemble-produktioners fulde danserliste mangler**
  (kun instruktør/koreograf/komponist/dirigent + evt. første solist er med).
- **DR Koncerthusets robots.txt kunne ikke bekræftes** (selve filen blokeres
  af deres edge-beskyttelse); vi har derfor holdt os til ét høfligt kald.
- Al scraping bruger en fast pause mellem kald (`REQUEST_DELAY_SECONDS` i
  `scripts/common.py`) og en identificerbar User-Agent, og respekterer
  `robots.txt` hvor den kunne læses.
- Profession (`skuespiller`/`musiker`) er en heuristik: teater-kilder
  tagges `skuespiller` som udgangspunkt, medmindre rollen matcher en liste
  af musik-relaterede ord (dirigent, sanger, musiker, …); spillested-kilder
  tagges altid `musiker`. Det er en forenkling, ikke en garanti.

## Dansk-tolerant søgning

Både `index.html` (klient) og `scripts/build_data.py` (ved generering)
folder navne ens, så `søren`, `soren` og `soeren` — og `bøgelund` /
`bogelund` / `boegelund` — giver samme resultat: æ/ø/å konverteres først
til deres udskrevne form (`æ`→a, `ø`→o, `å`→a, og omvendt `ae`/`oe`/`aa`→
samme bogstav) inden der søges. `æøå` er selvstændige Unicode-tegn (ikke
et grundbogstav + kombinerende accent), så NFKD-normalisering alene ikke
er nok.

## Netværksadgang i denne session

Udgående HTTP virkede (testet mod `kglteater.dk` og `google.com` før
scraping gik i gang) — modsat en tidligere session hvor netværkspolitikken
blokerede alt undtagen GitHub.
