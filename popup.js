import {$, state, mutate, wineFields, formData} from './shared.js';
import {webUrl} from './core.mjs';
$('#open').onclick = () => chrome.tabs.create({url: chrome.runtime.getURL('dashboard.html')});
let draft = {};
try {
  const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
  if (!tab?.id || !/^https?:/.test(tab.url || '')) throw new Error('Open a merchant\'s product page first, or fill in the details here manually.');
  if (/(^|\.)cellartracker\.com$/.test(new URL(tab.url).hostname)) throw new Error('This is a CellarTracker page. Edit the matching wine in "My list" and enter this page\'s community score and link.');
  const [result] = await chrome.scripting.executeScript({target: {tabId: tab.id}, files: ['extract.js']});
  draft = result.result || {};
  $('#capture-status').textContent = draft.warning + (!draft.currency ? ' Currency not detected; defaulting to USD, please confirm.' : '') + (draft.shippingHints?.length ? ' Shipping notes on page: ' + draft.shippingHints.join(' / ') : '');
} catch (error) {$('#capture-status').textContent = error.message;}
const current = await state();
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
    $('#message').textContent = (duplicate ? 'Saved wine updated.' : 'Added. Set this merchant\'s free-shipping threshold in "My list".') + (result.notificationFailed ? ' The system notification was not sent; check the list for alerts.' : '');
    $('#save').textContent = 'Saved ✓';
  } catch(error) {$('#message').className = 'error'; $('#message').textContent = error.message; $('#save').disabled = false;}
};
