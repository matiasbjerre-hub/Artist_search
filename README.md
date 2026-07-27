# Artist Search

Find teaterforestillinger og koncerter en skuespiller eller musiker medvirker i.
Indtast et navn og vælg profession (skuespiller eller musiker) for at få en
liste over kommende forestillinger/koncerter, med dato, spillested og link
til billetkøb.

Bygget med [Next.js](https://nextjs.org) (App Router). Data hentes fra
[Ticketmasters Discovery API](https://developer.ticketmaster.com/products-and-docs/apis/discovery-api/v2/).

## Kom i gang lokalt

1. Installer afhængigheder:

   ```bash
   npm install
   ```

2. Hent en gratis API-nøgle på
   [developer-acct.ticketmaster.com](https://developer-acct.ticketmaster.com/user/register)
   og kopier `.env.example` til `.env.local`:

   ```bash
   cp .env.example .env.local
   # udfyld TICKETMASTER_API_KEY=... i .env.local
   ```

3. Start udviklingsserveren:

   ```bash
   npm run dev
   ```

   Åbn [http://localhost:3000](http://localhost:3000).

## Deploy

Appen kan deployes direkte til [Vercel](https://vercel.com/new). Husk at
tilføje miljøvariablen `TICKETMASTER_API_KEY` under projektets
**Settings → Environment Variables**.

## Begrænsninger

Resultaterne afhænger af, hvad der findes i Ticketmasters database. Ikke
alle danske teatre og spillesteder sælger billetter gennem Ticketmaster, og
skuespillere i et ensemble er ikke altid søgbare enkeltvis (kun
forestillingens eget navn er nødvendigvis søgbart). Musikere og
soloforestillinger/stand-up giver typisk de bedste resultater.
