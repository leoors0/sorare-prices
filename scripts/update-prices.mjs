async function main() {
  const query = `
    query Diag($slugs: [String!]!, $rarity: Rarity!) {
      players(slugs: $slugs) {
        slug
        lowestPriceAnyCard(rarity: $rarity) {
          liveSingleSaleOffer {
            senderSide {
              amounts {
                referenceCurrency
                eur
              }
            }
            receiverSide {
              amounts {
                referenceCurrency
                eur
              }
            }
          }
        }
      }
    }
  `;
  const res = await fetch('https://api.sorare.com/graphql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query,
      variables: { slugs: ['kylian-mbappe-lottin'], rarity: 'limited' }
    })
  });
  const json = await res.json();
  console.log(JSON.stringify(json, null, 2));
}
main();
