import fs from 'fs';
import path from 'path';

const PLAYERS_FILE = 'players.json';
const HISTORY_FILE = path.join('data', 'history.json');

// Query corretta senza il campo 'cards' errato
const QUERY = `
  query GetPlayerPrices($slug: String!) {
    football {
      player(slug: $slug) {
        displayName
        activeCards(rarities: [limited, rare, super_rare, unique]) {
          nodes {
            rarity
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

async function fetchSorarePrices(slug) {
  try {
    const response = await fetch('https://api.sorare.com/graphql', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0'
      },
      body: JSON.stringify({
        query: QUERY,
        variables: { slug }
      })
    });

    const json = await response.json();
    const player = json?.data?.football?.player;
    if (!player) return null;

    const prices = { limited: null, rare: null, super_rare: null, unique: null };

    // Estrae i prezzi minimi dei manager per ciascuna rarità
    const cards = player.activeCards?.nodes || [];
    cards.forEach(card => {
      const rarity = card.rarity;
      const offer = card.liveSingleSaleOffer;

      if (offer) {
        let priceEur = null;

        if (offer.priceInEURCent) {
          priceEur = Math.round(offer.priceInEURCent / 100);
        } else if (offer.price) {
          priceEur = Math.round((parseFloat(offer.price) / 1e18) * 2500);
        }

        if (priceEur !== null) {
          if (prices[rarity] === null || priceEur < prices[rarity]) {
            prices[rarity] = priceEur;
          }
        }
      }
    });

    return {
      displayName: player.displayName,
      prices
    };
  } catch (err) {
    console.error(`Errore recupero Sorare per ${slug}:`, err);
    return null;
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

  for (const p of players) {
    console.log(`Aggiorno prezzi manager per ${p.name}...`);
    const data = await fetchSorarePrices(p.slug);

    const displayName = data?.displayName || p.name;
    const currentPrices = data?.prices || { limited: null, rare: null, super_rare: null, unique: null };

    if (!history[p.slug]) {
      history[p.slug] = { name: displayName, points: [] };
    } else {
      history[p.slug].name = displayName;
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
  console.log('✅ File history.json salvato con i prezzi corretti!');
}

main();
