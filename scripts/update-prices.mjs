import fs from 'fs';
import path from 'path';

const PLAYERS_FILE = 'players.json';
const HISTORY_FILE = path.join('data', 'history.json');

// Query basata sulla chiamata ufficiale della pagina del sito Sorare
const QUERY = `
  query GetManagerSalesPagePrice($slug: String!, $rarity: CardRarity!) {
    publicMarketCards(
      playerSlugs: [$slug]
      rarities: [$rarity]
      first: 1
    ) {
      nodes {
        liveSingleSaleOffer {
          priceInEURCent
          price
        }
      }
    }
  }
`;

async function fetchFloorPrice(slug, rarity) {
  try {
    const res = await fetch('https://api.sorare.com/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      },
      body: JSON.stringify({
        query: QUERY,
        variables: { slug, rarity }
      })
    });

    const json = await res.json();
    
    // Stampa di sicurezza nei log per vedere esattamente cosa risponde Sorare
    console.log(`[${slug} - ${rarity}] Risposta:`, JSON.stringify(json));

    const card = json?.data?.publicMarketCards?.nodes?.[0];
    const offer = card?.liveSingleSaleOffer;

    let priceEur = null;
    if (offer) {
      if (offer.priceInEURCent) {
        priceEur = Math.round(offer.priceInEURCent / 100);
      } else if (offer.price) {
        const val = parseFloat(offer.price);
        priceEur = val > 1000000 ? Math.round((val / 1e18) * 2500) : Math.round(val);
      }
    }

    return priceEur;
  } catch (err) {
    console.error(`Errore per ${slug} [${rarity}]:`, err);
    return null;
  }
}

async function main() {
  let players = JSON.parse(fs.readFileSync(PLAYERS_FILE, 'utf8'));
  let history = fs.existsSync(HISTORY_FILE) ? JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8')) : {};

  const nowIso = new Date().toISOString();
  const raritiesMap = { limited: 'LIMITED', rare: 'RARE', super_rare: 'SUPER_RARE', unique: 'UNIQUE' };

  for (const p of players) {
    console.log(`\n--- Controllo ${p.name} ---`);
    const currentPrices = { limited: null, rare: null, super_rare: null, unique: null };

    for (const [key, graphqlRarity] of Object.entries(raritiesMap)) {
      const price = await fetchFloorPrice(p.slug, graphqlRarity);
      currentPrices[key] = price;
    }

    if (!history[p.slug]) history[p.slug] = { name: p.name, points: [] };

    history[p.slug].points.push({
      timestamp: nowIso,
      ...currentPrices
    });
  }

  const dir = path.dirname(HISTORY_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
  console.log('\n✅ File history.json aggiornato!');
}

main();
