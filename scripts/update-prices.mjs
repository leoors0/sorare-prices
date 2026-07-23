import fs from 'fs';
import path from 'path';

const PLAYERS_FILE = 'players.json';
const HISTORY_FILE = path.join('data', 'history.json');

// Query GraphQL identica a quella usata dal sito ufficiale Sorare per le Manager Sales
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
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
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
    let priceEur = null;

    if (offer) {
      if (offer.priceInEURCent) {
        priceEur = Math.round(offer.priceInEURCent / 100);
      } else if (offer.price) {
        // Conversione da Wei in EUR
        priceEur = Math.round((parseFloat(offer.price) / 1e18) * 2500);
      }
    }

    return { price: priceEur, displayName: player?.displayName || null };
  } catch (err) {
    console.error(`Errore recupero ${slug} [${rarity}]:`, err);
    return { price: null, displayName: null };
  }
}

async function main() {
  let players = [];
  try {
    players = JSON.parse(fs.readFileSync(PLAYERS_FILE, 'utf8'));
  } catch (e) {
    console.error('Errore lettura players.json:', e);
    return;
  }

  let history = {};
  if (fs.existsSync(HISTORY_FILE)) {
    try {
      history = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'));
    } catch {
      history = {};
    }
  }

  const nowIso = new Date().toISOString();
  // Rarità formattate secondo l'enum di Sorare (in maiuscolo)
  const raritiesMap = {
    limited: 'LIMITED',
    rare: 'RARE',
    super_rare: 'SUPER_RARE',
    unique: 'UNIQUE'
  };

  for (const p of players) {
    console.log(`Sto recuperando i prezzi delle Manager Sales per ${p.name}...`);
    
    const currentPrices = { limited: null, rare: null, super_rare: null, unique: null };
    let realName = p.name;

    for (const [key, graphqlRarity] of Object.entries(raritiesMap)) {
      const result = await fetchFloorPrice(p.slug, graphqlRarity);
      currentPrices[key] = result.price;
      if (result.displayName) realName = result.displayName;
    }

    if (!history[p.slug]) {
      history[p.slug] = { name: realName, points: [] };
    } else {
      history[p.slug].name = realName;
      if (!history[p.slug].points) history[p.slug].points = [];
    }

    history[p.slug].points.push({
      timestamp: nowIso,
      limited: currentPrices.limited,
      rare: currentPrices.rare,
      super_rare: currentPrices.super_rare,
      unique: currentPrices.unique
    });
  }

  const dir = path.dirname(HISTORY_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
  console.log('✅ Prezzi salvati con successo in history.json!');
}

main();
