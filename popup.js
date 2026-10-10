import {$, state, mutate, wineFields, formData, element} from './shared.js';
import {webUrl, titleCase, rankForScore, sameVintage} from './core.mjs';
$('#open').onclick = () => chrome.tabs.create({url: chrome.runtime.getURL('dashboard.html')});
let draft = {}, onCt = false, ctPage = {};
try {
  const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
  if (tab?.id && /^https?:/.test(tab.url || '')) {
    onCt = /(^|\.)cellartracker\.com$/.test(new URL(tab.url).hostname);
    const [result] = await chrome.scripting.executeScript({target: {tabId: tab.id}, files: [onCt ? 'extract-ct.js' : 'extract.js']});
    if (onCt) ctPage = result.result || {};
    else {draft = result.result || {}; draft.name = titleCase(draft.name); draft.size = titleCase(draft.size);}
  }
} catch {}
const current = await state();
if (onCt && ctPage.iWine) attachScore();
else {
  if (onCt) $('#message').textContent = 'To attach a score, open the wine\'s own page on CellarTracker (not the search results), then click Bottle List again.';
  saveForm();
}

// On a product page: save the wine, or update it if this link is already saved.
function saveForm() {
  const matches = current.wines.filter(w => draft.url && w.url === webUrl(draft.url) && w.status === 'watching');
  const duplicate = matches.length === 1 ? matches[0] : null;
  if (duplicate) {
    draft = {...duplicate, ...draft, size: draft.size || duplicate.size, vintage: draft.vintage || duplicate.vintage, currency: draft.currency || duplicate.currency, priceCents: draft.price ? Number(draft.price)*100 : duplicate.priceCents};
    $('#message').textContent = 'This link is already saved. Confirm it is the same vintage and size; saving updates the existing entry and keeps its quantity and CT score.';
    $('#save').textContent = 'Update saved wine';
  }
  wineFields($('#wine-form'), draft);
  $('#wine-form').onsubmit = async event => {
    event.preventDefault(); $('#save').disabled = true;
    try {
      const result = await mutate({type: 'saveWine', wine: {...(duplicate || {}), ...formData(event.target)}});
      $('#message').className = 'success';
      $('#message').textContent = (duplicate ? 'Saved wine updated.' : 'Added. Set this merchant\'s free-shipping threshold in "My list". To add its CT score, open the wine on CellarTracker and click Bottle List there.') + (result.notificationFailed ? ' The system notification was not sent; check the list for alerts.' : '');
      $('#save').textContent = 'Saved ✓';
    } catch(error) {$('#message').className = 'error'; $('#message').textContent = error.message; $('#save').disabled = false;}
  };
}

// On a CellarTracker wine page: put its community score on a wine already in the list.
function attachScore() {
  const form = $('#wine-form'), wines = rankForScore(current.wines, ctPage);
  $('#save').textContent = 'Attach score';
  form.append(element('p', `CellarTracker: ${ctPage.name || 'wine #' + ctPage.iWine}`, 'ct-page'));
  if (!wines.length) {
    $('#message').textContent = 'Your wish list is empty. Save the wine from its shop page first, then come back here to attach its score.';
    $('#save').disabled = true;
    return;
  }
  const grid = element('div', null, 'form-grid');
  const field = (title, input, className) => {const label = element('label', title, className); label.append(input); grid.append(label); return input;};
  const select = field('Attach to', element('select'), 'wide');
  select.name = 'id';
  for (const w of wines) {
    const option = element('option', [w.name, w.vintage && !w.name.includes(w.vintage) ? w.vintage : '', current.merchants[w.merchant]?.name || w.merchant].filter(Boolean).join(' · '));
    option.value = w.id; select.append(option);
  }
  const number = (name, min, max, step, value) => {const input = element('input'); Object.assign(input, {name, type: 'number', min, max, step, value, required: name === 'ctScore'}); return input;};
  field('CT community score', number('ctScore', 50, 100, '0.01', ctPage.score));
  field('Number of CT notes', number('ctNotes', 0, 1000000, '1', ctPage.notes));
  form.append(grid);
  const warning = element('p', null, 'error tiny ct-warning');
  form.append(warning, element('p', 'Read from this page\'s community average. Check it before saving; critic scores (RP / WA / JS / Vinous) do not belong here.', 'muted tiny'));
  if (!ctPage.score) $('#message').textContent = 'Could not find the community average on this page; type it in from the page.';
  const check = () => {
    const w = wines.find(w => w.id === select.value);
    warning.textContent = [
      w.vintage && ctPage.vintage && !sameVintage(w.vintage, ctPage.vintage) ? `Vintage differs: this page is ${ctPage.vintage}, the saved wine is ${w.vintage}.` : '',
      w.ctScore != null ? `Replaces its current score of ${w.ctScore.toFixed(1)}.` : ''
    ].filter(Boolean).join(' ');
  };
  select.onchange = check; check();
  form.onsubmit = async event => {
    event.preventDefault(); $('#save').disabled = true;
    try {
      const data = Object.fromEntries(new FormData(form));
      await mutate({type: 'setScore', id: data.id, ctScore: data.ctScore, ctNotes: data.ctNotes, ctUrl: ctPage.url});
      $('#message').className = 'success';
      $('#message').textContent = `Score attached to ${select.selectedOptions[0].textContent}.`;
      $('#save').textContent = 'Attached ✓';
    } catch(error) {$('#message').className = 'error'; $('#message').textContent = error.message; $('#save').disabled = false;}
  };
}
