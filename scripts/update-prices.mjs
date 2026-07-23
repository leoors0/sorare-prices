import fs from 'fs';
import path from 'path';

const PLAYERS_FILE = 'players.json';
const HISTORY_FILE = path.join('data', 'history.json');

// Query GraphQL per Sorare
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

    // Inizializza prezzi
    const prices = { limited: null, rare: null, super_rare: null, unique: null };

    // Estrai offerta più bassa o ultimo prezzo disponibile
    player.cards?.forEach(card => {
      const rarity = card.rarity;
      const priceWei = card.liveSingleSaleOffer?.price;
      if (priceWei && !prices[rarity]) {
        // Conversione approssimativa / gestione prezzo (o valore raw se desiderato)
        prices[rarity] = Math.round(parseFloat(priceWei) / 1e18 * 2500); // Stima EUR
      }
    });

    return {
      displayName: player.displayName,
      prices
    };
  } catch (err) {
    console.error(`Errore durante il recupero per ${slug}:`, err);
    return null;
  }
}

async function main() {
  const players = JSON.parse(fs.readFileSync(PLAYERS_FILE, 'utf8'));
  let history = {};

  if (fs.existsSync(HISTORY_FILE)) {
    try {
      history = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'));
    } catch {
      history = {};
    }
  }

  const today = new Date().toISOString().split('T')[0];

  for (const p of players) {
    console.log(`Scarico prezzi Sorare per ${p.name} (${p.slug})...`);
    const data = await fetchSorarePrices(p.slug);

    const displayName = data?.displayName || p.name;
    const currentPrices = data?.prices || { limited: 0, rare: 0, super_rare: 0, unique: 0 };

    if (!history[p.slug]) {
      history[p.slug] = {
        name: displayName,
        displayName: displayName,
        lastUpdate: today,
        limited: currentPrices.limited || 0,
        rare: currentPrices.rare || 0,
        super_rare: currentPrices.super_rare || 0,
        unique: currentPrices.unique || 0,
        prices: []
      };
    }

    // Aggiorna valori correnti
    history[p.slug].lastUpdate = today;
    history[p.slug].limited = currentPrices.limited || 0;
    history[p.slug].rare = currentPrices.rare || 0;
    history[p.slug].super_rare = currentPrices.super_rare || 0;
    history[p.slug].unique = currentPrices.unique || 0;

    // Aggiungi alla cronologia
    history[p.slug].prices.push({
      date: today,
      limited: currentPrices.limited || 0,
      rare: currentPrices.rare || 0,
      superRare: currentPrices.super_rare || 0,
      unique: currentPrices.unique || 0
    });
  }

  fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
  console.log('✅ Dati aggiornati con successo da Sorare API!');
}

main();
