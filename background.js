import {applyOperation, notificationTransitions, totals, money} from './core.mjs';
import {loadState, saveState, migrateLocal} from './storage.mjs';
let queue = Promise.resolve();
const serial = task => (queue = queue.catch(() => {}).then(task));
async function badge(state) {
  const ready = Object.keys(state.merchants).filter(id => totals(state, id).ready).length;
  await chrome.action.setBadgeText({text: ready ? String(ready) : ''});
  await chrome.action.setBadgeBackgroundColor({color: '#316349'});
}
chrome.runtime.onMessage.addListener((message, sender, reply) => {
  if (sender.id !== chrome.runtime.id || message?.channel !== 'bottle-list') return;
  serial(async () => {
    await migrateLocal();
    const state = await loadState();
    const next = applyOperation(state, message.action);
    const events = notificationTransitions(next);
    await saveState(state, next);
    await badge(next).catch(() => {});
    let notificationFailed = false;
    for (const event of events) {
      try {
        await chrome.notifications.create('merchant:' + event.id, {
          type: 'basic', iconUrl: 'icons/icon128.png', title: `${event.name} · Threshold reached`,
          message: `${event.bottles} item(s), ${money(event.total, event.currency)} total${event.caseDiscount != null ? ` after ${event.caseDiscount}% case discount` : ''}. Check stock, discounts and shipping terms before ordering.`
        });
      } catch { notificationFailed = true; }
    }
    reply({ok: true, notificationFailed});
  }).catch(error => reply({ok: false, error: error.message}));
  return true;
});
chrome.notifications.onClicked.addListener(id => {
  if (id.startsWith('merchant:')) chrome.tabs.create({url: chrome.runtime.getURL('dashboard.html') + '#' + encodeURIComponent(id.slice(9))});
});
const refresh = () => serial(async () => {await migrateLocal(); await badge(await loadState());}).catch(() => {});
chrome.runtime.onStartup.addListener(refresh);
chrome.runtime.onInstalled.addListener(refresh);
// Another computer synced a change.
chrome.storage.onChanged.addListener((changes, area) => {if (area === 'sync') loadState().then(badge).catch(() => {});});
