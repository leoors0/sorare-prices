import fs from 'fs';
import path from 'path';

const PLAYERS_FILE = 'players.json';
const HISTORY_FILE = path.join('data', 'history.json');

// Query verificata sullo schema ufficiale di Sorare
const QUERY = `
query GetFloorPrice($slug: String!, $rarity: Rarity!) {
  player(slug: $slug) {
    lowestPriceAnyCard(rarity: $rarity) {
      liveSingleSaleOffer {
        price
        priceInFiat {
          eur
        }
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
    console.log(`[${slug} - ${rarity}] Risposta:`, JSON.stringify(json));

    const card = json?.data?.player?.lowestPriceAnyCard;
    const offer = card?.liveSingleSaleOffer;

    if (offer?.priceInFiat?.eur != null) {
      return Math.round(parseFloat(offer.priceInFiat.eur));
    }
    return null; // nessuna carta in vendita per questa rarità: è normale, non un errore
  } catch (err) {
    console.error(`Errore per ${slug} [${rarity}]:`, err);
    return null;
  }
}

async function main() {
  let players = JSON.parse(fs.readFileSync(PLAYERS_FILE, 'utf8'));
  let history = fs.existsSync(HISTORY_FILE) ? JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8')) : {};

  const nowIso = new Date().toISOString();
  const rarities = ['limited', 'rare', 'super_rare', 'unique'];

  for (const p of players) {
    console.log(`\n--- Controllo ${p.name} ---`);
    const currentPrices = { limited: null, rare: null, super_rare: null, unique: null };

    for (const rarity of rarities) {
      const price = await fetchFloorPrice(p.slug, rarity);
      currentPrices[rarity] = price;
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
