import {emptyState, applyOperation, notificationTransitions, totals, money} from './core.mjs';
let queue = Promise.resolve();
async function badge(state) {
  const ready = Object.keys(state.merchants).filter(id => totals(state, id).ready).length;
  await chrome.action.setBadgeText({text: ready ? String(ready) : ''});
  await chrome.action.setBadgeBackgroundColor({color: '#316349'});
}
chrome.runtime.onMessage.addListener((message, sender, reply) => {
  if (sender.id !== chrome.runtime.id || message?.channel !== 'wine-queue') return;
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
          type: 'basic', iconUrl: 'icons/icon128.png', title: `${event.name} · 已达设定门槛`,
          message: `${event.bottles} 件，共 ${money(event.subtotal, event.currency)}。下单前请核实库存、折扣及寄送条件。`
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
