# Artist Search

Find teaterforestillinger og koncerter, som en bestemt skuespiller, musiker
eller et orkester medvirker i. Indtast et navn, vælg profession, og få en
liste med rolle, spillested, datoer og link til billetter.

Bygget med [Next.js](https://nextjs.org) (App Router).

## Datakilder

| Kilde | Dækker | Nøgle kræves |
| --- | --- | --- |
| [Teaterbilletter.dk](https://teaterbilletter.dk) | ~100 teatre i København og på Sjælland | Nej |
| [MigogKBH.dk](https://migogkbh.dk) | Koncerter, forestillinger m.m. i København | Nej |
| [Ticketmaster Discovery](https://developer.ticketmaster.com/products-and-docs/apis/discovery-api/v2/) | Koncerter og store shows, internationalt | Ja (valgfri) |

Teaterbilletter er den vigtigste kilde for skuespillere og orkestre: deres API
leverer **rollelister** (`accreditations`) med navn og funktion, og et
orkester optræder typisk som forestillingens `producer`/`organizer`. MigogKBH
og Ticketmaster indekserer kun begivenhedens egen titel, og finder derfor
primært navngivne hovednavne eller orkestre, hvis navnet står i titlen.

### Sådan rangeres resultaterne

1. **Medvirker i** — personen (eller orkestret) er krediteret i en rolle, der
   passer til den valgte profession (skuespiller: Skuespiller, Medvirkende,
   Performer …; musiker: Musiker, Sanger, Kapelmester, Komponist …; orkester:
   navnet matcher forestillingens producent/arrangør).
2. **Krediteret i en anden rolle** — samme navn står på rollelisten, men bag
   scenen (instruktør, scenograf, tekniker …).
3. **Navnet nævnes i titlen** — svageste match; ingen bekræftet rolleliste.

Navnesøgning er dansk-tolerant: `soren`, `Søren` og `soeren` giver samme
resultat, ligesom `bogelund` og `Bøgelund`.

## Andre kulturkalendere, der blev undersøgt

Ud over de tre kilder ovenfor blev følgende sider gennemgået for en offentlig
API: Kultunaut.dk, Billetto.dk, brugbyen.kk.dk, kulturkbh.dk,
momentdanmark.dk, oplev.frederiksberg.dk, kulturkvarteret.dk,
opdagdanmark.dk og visitorservice.kk.dk. Ingen af dem eksponerer en brugbar
offentlig JSON-API:

- **Kultunaut.dk** blokerer de relevante stier i `robots.txt` og har ingen
  synlig API — formentlig kommerciel datafeed.
- **Billetto.dk** har ingen offentlig REST-API på de gængse stier.
- **brugbyen.kk.dk** og **visitorservice.kk.dk** kører Drupal, men uden
  JSON:API-modulet slået til.
- **momentdanmark.dk** og **kulturkvarteret.dk** kører WordPress, men uden at
  begivenheds-typen er eksponeret i REST'en.
- **opdagdanmark.dk** har faktisk en `event-artist`-taksonomi med rigtige
  orkesternavne (fx "Aalborg Symfoniorkester"), men selve begivenheds-typen er
  ikke REST-eksponeret, så navnene kan ikke kobles til konkrete datoer.
- **kulturkbh.dk** og **oplev.frederiksberg.dk** har ingen synlig API og
  kræver formentlig JavaScript-rendering for at se de faktiske data.

## Kom i gang lokalt

```bash
npm install
npm run dev
```

Åbn [http://localhost:3000](http://localhost:3000). Appen virker med det
samme — der kræves ingen API-nøgle for at søge i danske forestillinger og
koncerter.

### Valgfrit: tilføj Ticketmaster

For også at få internationale koncerter med, hent en gratis nøgle på
[developer-acct.ticketmaster.com](https://developer-acct.ticketmaster.com/user/register):

```bash
cp .env.example .env.local
# udfyld TICKETMASTER_API_KEY=... i .env.local
```

Uden nøgle fungerer appen fint, men skriver i bunden af resultaterne, at
koncerter fra Ticketmaster mangler.

## Deploy

Appen er en helt almindelig Next.js-app og kan hostes hos enhver udbyder der
kører Node — f.eks. Vercel, Netlify, Cloudflare Pages eller Render. Der kræves
en server (ikke bare statiske filer), fordi API-nøglen skal holdes hemmelig,
og fordi browsere ikke må hente data på tværs af domæner.

Skal Ticketmaster med, tilføj `TICKETMASTER_API_KEY` som miljøvariabel hos
udbyderen.

## Begrænsninger

- **Geografi.** Teaterbilletter og MigogKBH dækker København og Sjælland.
  Jylland og Fyn er kun med, hvis de også sælger via Ticketmaster.
- **Billetlugen** er undersøgt, men kan ikke bruges: deres bot-beskyttelse
  blokerer al servertrafik, så hverken denne app eller en anden server kan
  hente data derfra.
- **MigogKBH matcher kun titler**, ikke rollelister — samme begrænsning som
  Ticketmaster.
- **Rollelister er ikke altid komplette.** Nogle forestillinger krediterer kun
  produktionsholdet. Mangler en skuespiller, er det som regel fordi teatret
  ikke har indberettet rollelisten.
- Data caches i 6 timer, så helt nye forestillinger kan mangle kortvarigt.
