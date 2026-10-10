// Runs only on the current CellarTracker page when the user clicks the extension.
// Reads the community average and note count; never a critic score or the user's own rating.
(() => {
  const current = new URL(location.href);
  const id = [...current.searchParams].find(([key]) => key.toLowerCase() === 'iwine')?.[1] || '';
  if (!/^\d+$/.test(id)) return {};
  const clean = text => String(text || '').replace(/\s+/g, ' ').trim();
  const description = clean(document.querySelector('meta[name="description"],meta[property="og:description"]')?.content);
  const body = clean(document.body?.innerText);
  // "Average of 89.9 points in 55 community wine reviews" or "Community Tasting Notes (average 92.3 pts. and 14 notes)".
  const patterns = [
    /\baverage of (\d{2,3}(?:\.\d+)?) points? in ([\d,]+) community (?:wine )?(?:reviews|notes)\b/i,
    /\bcommunity tasting notes \(average (\d{2,3}(?:\.\d+)?) pts?\.? and ([\d,]+) notes?\)/i
  ];
  let score = '', notes = '';
  for (const text of [description, body]) {
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && Number(match[1]) >= 50 && Number(match[1]) <= 100) {score = match[1]; notes = match[2].replace(/,/g, ''); break;}
    }
    if (score) break;
  }
  // Titles read "2019 Luce della Vite Lucé, Italy, Tuscany, Toscana IGT - CellarTracker"
  // or "Community Tasting Notes - 2009 Château Pontet-Canet - CellarTracker".
  const title = clean(document.title).replace(/^community tasting notes\s*-\s*/i, '').replace(/\s*-\s*cellartracker\s*$/i, '');
  const name = (title || clean(document.querySelector('h1')?.textContent)).split(',')[0].trim().slice(0, 500);
  return {iWine: id, url: 'https://www.cellartracker.com/wine.asp?iWine=' + id, name, vintage: name.match(/^(?:(?:19|20)\d{2}|NV)\b/i)?.[0].toUpperCase() || '', score, notes};
})();
