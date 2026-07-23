async function main() {
  const query = `
    query IntrospectTokenOffer {
      __type(name: "TokenOffer") {
        name
        fields {
          name
          type { name kind ofType { name } }
        }
      }
    }
  `;
  const res = await fetch('https://api.sorare.com/graphql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query })
  });
  const json = await res.json();
  console.log(JSON.stringify(json, null, 2));
}
main();
