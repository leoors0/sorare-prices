import fs from 'fs';
import path from 'path';

const PLAYERS_FILE = 'players.json';
const HISTORY_FILE = path.join('data', 'history.json');

const QUERY = `
  query GetManagerSalesFloorPrice($slug: String!, $rarity: CardRarity!) {
    football {
      player(slug: $slug) {
        displayName
        cards(
          rarities: [$rarity]
          onSale: true
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
    }
  }
`;

async function fetchFloorPrice(slug, rarity) {
  try {
    const res = await fetch('https://api.sorare.com/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0'
      },
      body: JSON.stringify({
        query: QUERY,
        variables: { slug, rarity }
      })
    });

    const json = await res.json();
    const player = json?.data?.football?.player;
    const card = player?.cards?.nodes?.[0];

    if (!card) return { price: null, displayName: player?.displayName || null };

    const offer = card.liveSingleSaleOffer;
    console.log(`OFFERTA RICEVUTA PER ${slug} [${rarity}]:`, JSON.stringify(offer));

    let priceEur = null;

    if (offer) {
      if (offer.priceInEURCent) {
        priceEur = Math.round(offer.priceInEURCent / 100);
      } else if (offer.price) {
        // Se il prezzo è una stringa numerica in EUR o Wei
        const val = parseFloat(offer.price);
        priceEur = val > 1000000 ? Math.round((val / 1e18) * 2500) : Math.round(val);
      }
    }

    return { price: priceEur, displayName: player?.displayName || null };
  } catch (err) {
    console.error(`Errore ${slug} [${rarity}]:`, err);
    return { price: null, displayName: null };
  }
}

async function main() {
  let players = JSON.parse(fs.readFileSync(PLAYERS_FILE, 'utf8'));
  let history = fs.existsSync(HISTORY_FILE) ? JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8')) : {};

  const nowIso = new Date().toISOString();
  const raritiesMap = { limited: 'LIMITED', rare: 'RARE', super_rare: 'SUPER_RARE', unique: 'UNIQUE' };

  for (const p of players) {
    const currentPrices = { limited: null, rare: null, super_rare: null, unique: null };
    let realName = p.name;

    for (const [key, graphqlRarity] of Object.entries(raritiesMap)) {
      const result = await fetchFloorPrice(p.slug, graphqlRarity);
      currentPrices[key] = result.price;
      if (result.displayName) realName = result.displayName;
    }

    if (!history[p.slug]) history[p.slug] = { name: realName, points: [] };
    else history[p.slug].name = realName;

    history[p.slug].points.push({
      timestamp: nowIso,
      ...currentPrices
    });
  }

  const dir = path.dirname(HISTORY_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
  console.log('✅ File aggiornato!');
}

main();
