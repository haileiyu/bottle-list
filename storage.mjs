import {pack, unpack, diff, itemBytes, SYNC_ITEM_BYTES} from './core.mjs';
// Data lives in chrome.storage.sync so it follows the Chrome profile to other devices.
export const loadState = async () => unpack(await chrome.storage.sync.get(null));
// Diff against the unpacked state so placeholder merchants from unpack() are only written once they are edited.
export async function saveState(prev, next) {
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
