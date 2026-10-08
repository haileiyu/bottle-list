import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyState, applyOperation, totals, notificationTransitions, normalizeWine, merchantId} from '../core.mjs';
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
