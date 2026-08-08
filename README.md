# Artist Search

Find teaterforestillinger og koncerter, som en bestemt skuespiller eller
musiker medvirker i. Indtast et navn, vælg profession, og få en liste med
rolle, spillested, datoer og link til billetter.

Bygget med [Next.js](https://nextjs.org) (App Router).

## Datakilder

| Kilde | Dækker | Nøgle kræves |
| --- | --- | --- |
| [Teaterbilletter.dk](https://teaterbilletter.dk) | ~100 teatre i København og på Sjælland | Nej |
| [Ticketmaster Discovery](https://developer.ticketmaster.com/products-and-docs/apis/discovery-api/v2/) | Koncerter og store shows, internationalt | Ja (valgfri) |

Teaterbilletter er den vigtigste kilde for skuespillere: deres API leverer
**rollelister** (`accreditations`) med navn og funktion, så man rent faktisk
kan slå op, hvem der medvirker i hvad. Ticketmaster indekserer kun
begivenhedens egen titel, og finder derfor primært navngivne hovednavne.

### Sådan rangeres resultaterne

1. **Medvirker i** — personen er krediteret i en rolle, der passer til den
   valgte profession (skuespiller: Skuespiller, Medvirkende, Performer …;
   musiker: Musiker, Sanger, Kapelmester, Komponist …).
2. **Krediteret i en anden rolle** — samme navn står på rollelisten, men bag
   scenen (instruktør, scenograf, tekniker …).
3. **Navnet nævnes i titlen** — svageste match; ingen bekræftet rolleliste.

Navnesøgning er dansk-tolerant: `soren`, `Søren` og `soeren` giver samme
resultat, ligesom `bogelund` og `Bøgelund`.

## Kom i gang lokalt

```bash
npm install
npm run dev
```

Åbn [http://localhost:3000](http://localhost:3000). Appen virker med det
samme — der kræves ingen API-nøgle for at søge i danske teaterforestillinger.

### Valgfrit: tilføj Ticketmaster

For også at få koncerter med, hent en gratis nøgle på
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

- **Geografi.** Teaterbilletter dækker København og Sjælland. Teatre i Jylland
  og på Fyn er kun med, hvis de også sælger via Ticketmaster.
- **Billetlugen** er undersøgt, men kan ikke bruges: deres bot-beskyttelse
  blokerer al servertrafik, så hverken denne app eller en anden server kan
  hente data derfra.
- **Rollelister er ikke altid komplette.** Nogle forestillinger krediterer kun
  produktionsholdet. Mangler en skuespiller, er det som regel fordi teatret
  ikke har indberettet rollelisten.
- Data caches i 6 timer, så helt nye forestillinger kan mangle kortvarigt.
