import fs from 'fs';
import path from 'path';

const QUERY = `
  query GetPlayerPrices($slug: String!) {
    football {
      player(slug: $slug) {
        displayName
        slug
        cards(first: 5) {
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

async function test() {
  const res = await fetch('https://api.sorare.com/graphql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0' },
    body: JSON.stringify({ query: QUERY, variables: { slug: 'kylian-mbappe-lottin' } })
  });
  
  const json = await res.json();
  console.log("=== RISPOSTA GREZZA DA SORARE ===");
  console.log(JSON.stringify(json, null, 2));
}

test();
