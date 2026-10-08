import {emptyState, applyOperation, notificationTransitions, totals, money} from './core.mjs';
let queue = Promise.resolve();
async function badge(state) {
  const ready = Object.keys(state.merchants).filter(id => totals(state, id).ready).length;
  await chrome.action.setBadgeText({text: ready ? String(ready) : ''});
  await chrome.action.setBadgeBackgroundColor({color: '#316349'});
}
chrome.runtime.onMessage.addListener((message, sender, reply) => {
  if (sender.id !== chrome.runtime.id || message?.channel !== 'bottle-list') return;
  queue = queue.catch(() => {}).then(async () => {
    const state = (await chrome.storage.local.get('state')).state || emptyState();
    const next = applyOperation(state, message.action);
    const events = notificationTransitions(next);
    await chrome.storage.local.set({state: next});
    await badge(next).catch(() => {});
    let notificationFailed = false;
    for (const event of events) {
      try {
        await chrome.notifications.create('merchant:' + event.id, {
          type: 'basic', iconUrl: 'icons/icon128.png', title: `${event.name} · Threshold reached`,
          message: `${event.bottles} item(s), ${money(event.subtotal, event.currency)} total. Check stock, discounts and shipping terms before ordering.`
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
chrome.runtime.onStartup.addListener(async () => badge((await chrome.storage.local.get('state')).state || emptyState()));
chrome.runtime.onInstalled.addListener(async () => badge((await chrome.storage.local.get('state')).state || emptyState()));
