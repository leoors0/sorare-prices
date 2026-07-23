import { readFile, writeFile } from "node:fs/promises";

const RARITIES = ["limited", "rare", "super_rare", "unique"];

const QUERY = `
query PlayerPrices($slug: String!) {
  player(slug: $slug) {
    slug
    displayName
    limited: lowestPriceAnyCard(rarity: limited) {
      ... on Card {
        liveSingleSaleOffer { amounts { eur } }
        latestEnglishAuction { bestBid { amountInFiat { eur } } }
      }
    }
    rare: lowestPriceAnyCard(rarity: rare) {
      ... on Card {
        liveSingleSaleOffer { amounts { eur } }
        latestEnglishAuction { bestBid { amountInFiat { eur } } }
      }
    }
    super_rare: lowestPriceAnyCard(rarity: super_rare) {
      ... on Card {
        liveSingleSaleOffer { amounts { eur } }
        latestEnglishAuction { bestBid { amountInFiat { eur } } }
      }
    }
    unique: lowestPriceAnyCard(rarity: unique) {
      ... on Card {
        liveSingleSaleOffer { amounts { eur } }
        latestEnglishAuction { bestBid { amountInFiat { eur } } }
      }
    }
  }
}`;

function extractPrice(node) {
  if (!node) return null;
  const offer = node.liveSingleSaleOffer?.amounts?.eur;
  const auction = node.latestEnglishAuction?.bestBid?.amountInFiat?.eur;
  const val = offer ?? auction;
  return val != null ? Number(val) : null;
}

async function fetchPlayer(slug) {
  const res = await fetch("https://api.sorare.com/graphql", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: QUERY, variables: { slug } }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for slug "${slug}"`);
  const json = await res.json();
  if (json.errors?.length) throw new Error(json.errors.map((e) => e.message).join("; "));
  if (!json.data?.player) throw new Error(`Nessun giocatore trovato per slug "${slug}"`);
  return json.data.player;
}

async function main() {
  const players = JSON.parse(await readFile("players.json", "utf-8"));
  let history = {};
  try {
    history = JSON.parse(await readFile("data/history.json", "utf-8"));
  } catch {
    history = {};
  }

  const timestamp = new Date().toISOString();

  for (const p of players) {
    try {
      const data = await fetchPlayer(p.slug);
      const point = { timestamp };
      RARITIES.forEach((r) => (point[r] = extractPrice(data[r])));

      if (!history[p.slug]) {
        history[p.slug] = { name: data.displayName || p.name, points: [] };
      }
      history[p.slug].name = data.displayName || p.name;
      history[p.slug].points.push(point);
      history[p.slug].points = history[p.slug].points.slice(-500);

      console.log(`OK: ${p.name} ->`, point);
    } catch (err) {
      console.error(`ERRORE per ${p.name} (slug: ${p.slug}):`, err.message);
    }
  }

  await writeFile("data/history.json", JSON.stringify(history, null, 2));
}

main();
