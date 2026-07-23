import fs from 'fs';
import path from 'path';

const PLAYERS_FILE = 'players.json';
const HISTORY_FILE = path.join('data', 'history.json');

// Query per ispezionare tutti i dati disponibili sul giocatore e sul mercato
const QUERY = `
  query InspectPlayer($slug: String!) {
    football {
      player(slug: $slug) {
        displayName
        slug
      }
    }
    tokens {
      cards(playerSlugs: [$slug], first: 1) {
        nodes {
          rarity
          liveSingleSaleOffer {
            price
            priceInEURCent
          }
        }
      }
    }
  }
`;

async function main() {
  console.log("=== INIZIO TEST ISPEZIONE DATO SORARE ===");
  try {
    const res = await fetch('https://api.sorare.com/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0'
      },
      body: JSON.stringify({
        query: QUERY,
        variables: { slug: "kylian-mbappe-lottin" }
      })
    });

    const json = await res.json();
    console.log("=== RISPOSTA COMPLETA DA SORARE ===");
    console.log(JSON.stringify(json, null, 2));
  } catch (err) {
    console.error("Errore chiamata API:", err);
  }
}

main();
