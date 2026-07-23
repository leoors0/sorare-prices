import fs from 'fs';
import path from 'path';

const PLAYERS_FILE = 'players.json';
const HISTORY_FILE = path.join('data', 'history.json');

async function fetchFloorPrices(slug) {
  const rarities = ['limited', 'rare', 'super_rare', 'unique'];
  const prices = { limited: null, rare: null, super_rare: null, unique: null };
  let displayName = null;

  for (const rarity of rarities) {
    try {
      // Cerca le carte messe in vendita dai manager per questa rarità
      // ordinate per prezzo CRESCENTE (il primo risultato è il prezzo minimo in vendita)
      const url = `https://api.sorare.com/api/v1/cards?player_slugs=${slug}&rarity=${rarity}&on_sale=true&sort=price_asc&limit=1`;
      
      const response = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });

      if (response.ok) {
        const cards = await response.json();
        if (Array.isArray(cards) && cards.length > 0) {
          const cheapestCard = cards[0];
          
          if (!displayName && cheapestCard.player?.display_name) {
            displayName = cheapestCard.player.display_name;
          }

          // Prende il prezzo in Euro impostato dal manager che vende
          if (cheapestCard.active_order?.price_in_eur) {
            prices[rarity] = Math.round(cheapestCard.active_order.price_in_eur);
          }
        }
      }
    } catch (err) {
      console.error(`Errore per ${slug} (${rarity}):`, err);
    }
  }

  return {
    displayName: displayName || slug,
    prices
  };
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
    console.log(`Cerco il prezzo minimo in vendita per ${p.name}...`);
    const data = await fetchFloorPrices(p.slug);

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
  console.log('✅ history.json aggiornato con i prezzi minimi dei manager!');
}

main();3
