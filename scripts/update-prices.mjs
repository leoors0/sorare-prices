import fs from 'fs';
import path from 'path';

const PLAYERS_FILE = 'players.json';
const HISTORY_FILE = path.join('data', 'history.json');

const QUERY = `
  query GetPlayerPrices($slug: String!) {
    football {
      player(slug: $slug) {
        displayName
        cards(rarities: [limited, rare, super_rare, unique]) {
          rarity
          liveSingleSaleOffer {
            price
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
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: QUERY,
        variables: { slug }
      })
    });

    const json = await response.json();
    const player = json?.data?.football?.player;
    if (!player) return null;

    const prices = { limited: null, rare: null, super_rare: null, unique: null };

    player.cards?.forEach(card => {
      const rarity = card.rarity;
      const priceWei = card.liveSingleSaleOffer?.price;
      if (priceWei && prices[rarity] === null) {
        // Conversione stima EUR
        prices[rarity] = Math.round((parseFloat(priceWei) / 1e18) * 2500);
      }
    });

    return {
      displayName: player.displayName,
      prices
    };
  } catch (err) {
    console.error(`Errore per ${slug}:`, err);
    return null;
  }
}

async function main() {
  let players = [];
  try {
    players = JSON.parse(fs.readFileSync(PLAYERS_FILE, 'utf8'));
  } catch (e) {
    console.error('Errore nel caricamento di players.json:', e);
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
    console.log(`Scarico da Sorare per ${p.name} (${p.slug})...`);
    const data = await fetchSorarePrices(p.slug);

    const displayName = data?.displayName || p.name;
    const currentPrices = data?.prices || { limited: null, rare: null, super_rare: null, unique: null };

    if (!history[p.slug]) {
      history[p.slug] = {
        name: displayName,
        points: []
      };
    } else {
      history[p.slug].name = displayName;
      if (!history[p.slug].points) {
        history[p.slug].points = [];
      }
    }

    // Aggiunge un punto nello storico esattamente nel formato letto da index.html
    history[p.slug].points.push({
      timestamp: nowIso,
      limited: currentPrices.limited,
      rare: currentPrices.rare,
      super_rare: currentPrices.super_rare,
      unique: currentPrices.unique
    });
  }

  // Assicura che la cartella data esista
  const dir = path.dirname(HISTORY_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
  console.log('✅ File history.json aggiornato con successo!');
}

main();
