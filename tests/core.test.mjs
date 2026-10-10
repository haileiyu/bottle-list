import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyState, applyOperation, totals, notificationTransitions, normalizeWine, merchantId, titleCase, rankForScore, pack, unpack, diff, itemBytes, mergeState, SYNC_ITEM_BYTES} from '../core.mjs';
const wine = (extra={})=>({name:'2016 Example Barolo',url:'https://www.example.com/wine',price:95,quantity:2,currency:'USD',vintage:'2016',size:'750 ml',...extra});
function setup(){let state=applyOperation(emptyState(),{type:'saveWine',wine:wine()});return applyOperation(state,{type:'saveMerchant',id:'example.com',merchant:{name:'Example Wines',threshold:300,currency:'USD'}});}
test('Each merchant totals independently and crosses $300 exactly once',()=>{
 let state=setup();assert.equal(totals(state,'example.com').subtotal,19000);assert.deepEqual(notificationTransitions(state),[]);
 state=applyOperation(state,{type:'saveWine',wine:wine({url:'https://example.com/other',quantity:1,price:115})});
 assert.equal(totals(state,'example.com').subtotal,30500);assert.equal(notificationTransitions(state).length,1);assert.equal(notificationTransitions(state).length,0);
 state=applyOperation(state,{type:'saveWine',wine:wine({url:'https://other.com/wine',price:999})});assert.equal(totals(state,'example.com').subtotal,30500);assert.equal(totals(state,'other.com').ready,false);
 state=applyOperation(state,{type:'status',id:state.wines[1].id,status:'purchased'});assert.equal(notificationTransitions(state).length,0);assert.equal(totals(state,'example.com').ready,false);
 state=applyOperation(state,{type:'status',id:state.wines[1].id,status:'watching'});assert.equal(notificationTransitions(state).length,1);
});
test('Unpriced, excluded, sold out and foreign currency rows do not count',()=>{
 let state=setup();for(const [i,patch] of [{price:''},{eligible:false},{availability:'out'},{currency:'EUR'}].entries())state=applyOperation(state,{type:'saveWine',wine:wine({url:`https://example.com/${i}`,...patch})});
 assert.equal(totals(state,'example.com').subtotal,19000);assert.equal(totals(state,'example.com').excluded,4);
});
test('Unknown threshold stays unset, zero threshold needs at least one eligible wine',()=>{
 let state=applyOperation(emptyState(),{type:'saveWine',wine:wine()});assert.equal(totals(state,'example.com').ready,false);
 state=applyOperation(state,{type:'saveMerchant',id:'example.com',merchant:{currency:'USD',threshold:0}});assert.equal(totals(state,'example.com').ready,true);
 state=applyOperation(state,{type:'deleteWine',id:state.wines[0].id});assert.equal(totals(state,'example.com').ready,false);
});
test('Integer cents handle decimal prices and equality at the threshold',()=>{
 let state=applyOperation(emptyState(),{type:'saveWine',wine:wine({price:99.99,quantity:3})});state=applyOperation(state,{type:'saveMerchant',id:'example.com',merchant:{currency:'USD',threshold:299.97}});
 assert.equal(totals(state,'example.com').subtotal,29997);assert.equal(totals(state,'example.com').remaining,0);assert.equal(totals(state,'example.com').ready,true);
});
test('Input validation rejects unsafe links, impossible numbers and wrong CT origins',()=>{
 for(const patch of [{url:'javascript:alert(1)'},{price:-1},{price:'NaN'},{quantity:0},{quantity:1.5},{ctScore:101},{ctUrl:'https://cellartracker.com.evil.test/a'},{currency:'XYZ'}])assert.throws(()=>normalizeWine(wine(patch)));
 assert.equal(merchantId('https://www.example.com/wine'),'example.com');
});
test('Duplicate tracking links rejected while variants and distinct vintages remain separate',()=>{
 const state=setup();assert.throws(()=>applyOperation(state,{type:'saveWine',wine:wine({url:'https://www.example.com/wine?utm_source=email'})}));
 assert.equal(applyOperation(state,{type:'saveWine',wine:wine({vintage:'2015'})}).wines.length,2);
 assert.equal(applyOperation(state,{type:'saveWine',wine:wine({url:'https://www.example.com/wine?variant=2'})}).wines.length,2);
});
test('Case discount applies at the case size and is used for the threshold',()=>{
 let state=applyOperation(emptyState(),{type:'saveWine',wine:wine({price:25,quantity:11})});
 state=applyOperation(state,{type:'saveMerchant',id:'example.com',merchant:{currency:'USD',threshold:270,caseSize:12,caseDiscount:10}});
 let t=totals(state,'example.com');assert.equal(t.caseApplied,false);assert.equal(t.discount,0);assert.equal(t.total,27500);assert.equal(t.bottlesToCase,1);assert.equal(t.ready,true);
 state=applyOperation(state,{type:'saveWine',wine:{...state.wines[0],price:25,quantity:12}});
 t=totals(state,'example.com');assert.equal(t.caseApplied,true);assert.equal(t.subtotal,30000);assert.equal(t.discount,3000);assert.equal(t.total,27000);assert.equal(t.bottlesToCase,0);assert.equal(t.ready,true);
 state=applyOperation(state,{type:'saveMerchant',id:'example.com',merchant:{currency:'USD',threshold:300,caseSize:12,caseDiscount:10}});
 t=totals(state,'example.com');assert.equal(t.ready,false);assert.equal(t.remaining,3000);
 const [event]=notificationTransitions(applyOperation(state,{type:'saveMerchant',id:'example.com',merchant:{currency:'USD',threshold:270,caseSize:12,caseDiscount:10}}));
 assert.equal(event.total,27000);assert.equal(event.caseDiscount,10);
});
test('Case discount settings are validated and legacy merchants still total',()=>{
 const state=setup();const save=merchant=>applyOperation(state,{type:'saveMerchant',id:'example.com',merchant:{currency:'USD',threshold:300,...merchant}});
 for(const patch of [{caseSize:1,caseDiscount:10},{caseSize:1.5,caseDiscount:10},{caseSize:12,caseDiscount:0},{caseSize:12,caseDiscount:-5},{caseSize:12,caseDiscount:101},{caseSize:12},{caseDiscount:10},{caseSize:12,caseDiscount:''}])assert.throws(()=>save(patch));
 const cleared=save({caseSize:'',caseDiscount:''});assert.equal(cleared.merchants['example.com'].caseSize,null);assert.equal(totals(cleared,'example.com').caseConfigured,false);
 const legacy=structuredClone(state);delete legacy.merchants['example.com'].caseSize;delete legacy.merchants['example.com'].caseDiscount;
 const t=totals(legacy,'example.com');assert.equal(t.total,19000);assert.equal(t.discount,0);assert.equal(t.bottlesToCase,null);
});
test('All-caps and all-lowercase names become Title Case; mixed-case names are kept',()=>{
 for(const [raw,want] of [['CHABLIS VAUPRIN ROLAND LAVANTUREUX 2023 (750ML)','Chablis Vauprin Roland Lavantureux 2023 (750ml)'],["château d'yquem sauternes 2015","Château d'Yquem Sauternes 2015"],['DOMAINE DE LA ROMANÉE-CONTI','Domaine de la Romanée-Conti'],['CHÂTEAU LA MISSION HAUT-BRION','Château La Mission Haut-Brion'],['CHÂTEAUNEUF-DU-PAPE','Châteauneuf-du-Pape'],['QUINTA DO VALE VINTAGE PORT NV','Quinta do Vale Vintage Port NV'],['louis xiii cognac','Louis XIII Cognac'],["L'ÉVANGILE POMEROL","L'Évangile Pomerol"],['6 X 750ML','6 x 750ml'],['1.5L','1.5L'],["d'Arenberg The Dead Arm","d'Arenberg The Dead Arm"],['McLaren Vale Shiraz','McLaren Vale Shiraz'],['2016','2016']])assert.equal(titleCase(raw),want);
 const saved=normalizeWine(wine({name:'BAROLO RISERVA DOCG',size:'750ML'}));assert.equal(saved.name,'Barolo Riserva DOCG');assert.equal(saved.size,'750ml');
 const old={...normalizeWine(wine()),size:'750ML'};assert.throws(()=>applyOperation({...emptyState(),wines:[old]},{type:'saveWine',wine:wine({size:'750ml'})}));
});
test('Sync items round-trip, stay under the per-item limit and diff only what changed',()=>{
 let state=setup();state=applyOperation(state,{type:'saveWine',wine:wine({url:'https://other.com/wine',notes:'x'.repeat(2000)})});
 const items=pack(state);assert.deepEqual(Object.keys(items).sort(),['m:example.com','m:other.com',...state.wines.map(w=>'w:'+w.id)].sort());
 assert.deepEqual(unpack(structuredClone(items)),state);for(const [k,v] of Object.entries(items))assert.ok(itemBytes(k,v)<SYNC_ITEM_BYTES);
 const id=state.wines[0].id,changed=applyOperation(state,{type:'status',id,status:'purchased'});
 assert.deepEqual(diff(items,pack(changed)),{set:{['w:'+id]:changed.wines[0]},remove:[]});
 assert.deepEqual(diff(items,pack(applyOperation(state,{type:'deleteWine',id}))),{set:{},remove:['w:'+id]});
 const orphan=unpack({['w:'+id]:state.wines[0]});assert.equal(orphan.merchants['example.com'].currency,'USD');assert.equal(orphan.merchants['example.com'].caseSize,null);
 assert.throws(()=>normalizeWine(wine({url:'https://example.com/?q='+'a'.repeat(2000)})),/too long/);
});
test('Merging a local list into a synced one adds missing wines and keeps synced merchant settings',()=>{
 const synced=setup(),local=applyOperation(applyOperation(emptyState(),{type:'saveWine',wine:wine()}),{type:'saveWine',wine:wine({url:'https://other.com/wine'})});
 local.merchants['example.com'].thresholdCents=1;
 const merged=mergeState(synced,local);
 assert.equal(merged.wines.length,2);assert.equal(merged.merchants['example.com'].thresholdCents,30000);assert.ok(merged.merchants['other.com']);
 assert.deepEqual(mergeState(merged,local),merged);assert.equal(synced.wines.length,1);
});
test('Attaching a CT score keeps price, quantity and merchant, and later saves keep the note count',()=>{
 let state=setup();const id=state.wines[0].id;
 state=applyOperation(state,{type:'setScore',id,ctScore:'93.4',ctNotes:'41',ctUrl:'https://www.cellartracker.com/wine.asp?iWine=1'});
 const w=state.wines[0];assert.equal(w.priceCents,9500);assert.equal(w.quantity,2);assert.equal(w.merchant,'example.com');assert.equal(w.ctScore,93.4);assert.equal(w.ctNotes,41);
 state=applyOperation(state,{type:'saveWine',wine:{...w,price:w.priceCents/100,quantity:3}});assert.equal(state.wines[0].ctNotes,41);assert.equal(state.wines[0].ctUrl,'https://www.cellartracker.com/wine.asp?iWine=1');
 for(const patch of [{ctScore:''},{ctScore:101},{ctNotes:1.5},{ctNotes:-1},{ctUrl:'https://cellartracker.com.evil.test/a'}])assert.throws(()=>applyOperation(state,{type:'setScore',id,ctScore:90,...patch}));
 assert.throws(()=>applyOperation(state,{type:'setScore',id:'gone',ctScore:90}),/deleted/);
});
test('CT page matches rank the same vintage and closest name first, ignoring accents',()=>{
 let state=emptyState();
 for(const patch of [{name:'Chateau Pontet-Canet Pauillac',vintage:'2010',url:'https://a.com/1'},{name:'Chateau Pontet-Canet Pauillac',vintage:'2009',url:'https://a.com/2'},{name:'Ridge Monte Bello',vintage:'2009',url:'https://a.com/3'}])state=applyOperation(state,{type:'saveWine',wine:wine(patch)});
 state=applyOperation(state,{type:'status',id:state.wines[2].id,status:'purchased'});
 const ranked=rankForScore(state.wines,{name:'2009 Château Pontet-Canet',vintage:'2009'});
 assert.deepEqual(ranked.map(w=>w.url),['https://a.com/2','https://a.com/1']);
});
