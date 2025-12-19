(async function(){
  try {
    const resp = await fetch('http://localhost:4000/search-web', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'how to deploy node express app with docker' })
    });
    const data = await resp.json();
    console.log('status:', resp.status);
    console.log(JSON.stringify(data, null, 2));
  } catch(e) { console.error(e); }
})();
