import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyState, applyOperation} from '../core.mjs';
const wine = (extra={})=>({name:'2016 Example Barolo',url:'https://www.example.com/wine',price:95,quantity:2,currency:'USD',vintage:'2016',size:'750 ml',...extra});
// In-memory stand-in for chrome.storage; sync rejects writes past `quota` bytes like Chrome does.
function area(quota=Infinity){
 const data={};
 return {data,
  async get(key){if(key===null)return structuredClone(data);return key in data?{[key]:structuredClone(data[key])}:{};},
  async set(items){const after={...data,...items};if(JSON.stringify(after).length>quota)throw new Error('QUOTA_BYTES quota exceeded');Object.assign(data,structuredClone(items));},
  async remove(keys){for(const k of [].concat(keys))delete data[k];}};
}
function install(quota){globalThis.chrome={storage:{local:area(),sync:area(quota)}};return globalThis.chrome.storage;}
const {loadState, saveState, migrateLocal, notSynced} = await import('../storage.mjs');
const saved=(...wines)=>wines.reduce((s,w)=>applyOperation(s,{type:'saveWine',wine:w}),emptyState());
test('A list saved before syncing moves to sync and is removed from local storage',async()=>{
 const storage=install(),before=saved(wine(),wine({url:'https://other.com/wine'}));storage.local.data.state=before;
 assert.equal(await notSynced(),true);await migrateLocal();
 assert.equal(await notSynced(),false);assert.equal(storage.local.data.state,undefined);assert.deepEqual(await loadState(),before);
 const next=applyOperation(before,{type:'deleteWine',id:before.wines[0].id});await saveState(before,next);
 assert.deepEqual(await loadState(),next);assert.equal(storage.local.data.state,undefined);
});
test('Migration merges with a list another computer already synced',async()=>{
 const storage=install(),other=saved(wine());
 for(const [k,v] of Object.entries({'m:example.com':other.merchants['example.com'],['w:'+other.wines[0].id]:other.wines[0]}))storage.sync.data[k]=v;
 storage.local.data.state=saved(wine(),wine({url:'https://other.com/wine'}));
 await migrateLocal();
 const state=await loadState();assert.equal(state.wines.length,2);assert.ok(state.wines.some(w=>w.id===other.wines[0].id));
});
test('A list too large for sync stays local, keeps saving, and moves once it fits',async()=>{
 const storage=install(800),before=saved(wine({notes:'x'.repeat(1000)}));storage.local.data.state=before;
 await migrateLocal();assert.equal(await notSynced(),true);assert.deepEqual(storage.sync.data,{});
 const next=applyOperation(before,{type:'saveWine',wine:{...before.wines[0],price:95,notes:''}});await saveState(before,next);
 assert.deepEqual(storage.local.data.state,next);assert.deepEqual(storage.sync.data,{});
 await migrateLocal();assert.equal(await notSynced(),false);assert.deepEqual(await loadState(),next);
});
