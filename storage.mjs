import {pack, unpack, diff, itemBytes, mergeState, SYNC_ITEM_BYTES} from './core.mjs';
// The list lives in chrome.storage.sync so it follows the Chrome profile to other computers.
// Earlier versions kept it under one chrome.storage.local key. That copy stays in use until migrateLocal() moves it to sync.
const localState = async () => (await chrome.storage.local.get('state')).state;
export const notSynced = async () => Boolean(await localState());
export const loadState = async () => (await localState()) || unpack(await chrome.storage.sync.get(null));
export async function saveState(prev, next) {
  if (await localState()) await chrome.storage.local.set({state: next});
  else await writeSync(prev, next);
}
// Writes only the wines and merchants that changed, to stay within sync's write limits.
async function writeSync(prev, next) {
  const {set, remove} = diff(pack(prev), pack(next));
  for (const [key, value] of Object.entries(set)) {
    if (itemBytes(key, value) > SYNC_ITEM_BYTES) throw new Error(key.startsWith('w:') ? 'This wine is too large to sync. Shorten its name, notes or links.' : 'This merchant\'s settings are too large to sync. Shorten its notes.');
  }
  try {
    if (remove.length) await chrome.storage.sync.remove(remove);
    if (Object.keys(set).length) await chrome.storage.sync.set(set);
  } catch (error) {
    if (/QUOTA_BYTES|MAX_ITEMS/.test(error.message)) throw new Error('Chrome sync storage is full (about 100 KB). Export a backup, then delete purchased wines to free space.');
    if (/MAX_WRITE_OPERATIONS/.test(error.message)) throw new Error('Too many changes in a short time. Wait a minute and try again.');
    throw error;
  }
}
// Moves a list saved before syncing into chrome.storage.sync, merged with anything another computer has synced already.
// If it does not fit, it stays local and is tried again before the next save.
export async function migrateLocal() {
  const local = await localState();
  if (!local) return;
  const synced = unpack(await chrome.storage.sync.get(null));
  try {await writeSync(synced, mergeState(synced, local));} catch {return;}
  await chrome.storage.local.remove('state');
}
