import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const code=readFileSync(new URL('../extract.js',import.meta.url),'utf8');
function extract(json, {url='https://example.com/wine',meta={},body='',title='Wine',h1=''}={}) {
  const document={title,body:{innerText:body},querySelectorAll:()=>[{textContent:JSON.stringify(json)}],querySelector:s=>s==='h1'?(h1?{textContent:h1}:null):meta[s.match(/\[property="([^"]+)"\]/)?.[1]]?{content:meta[s.match(/\[property="([^"]+)"\]/)[1]]}:null};
  return vm.runInNewContext(code,{document,location:{href:url},URL});
}
test('Reads product metadata with decimal USD price and vintage',()=>{
 const result=extract({'@type':'Product',name:'2016 Example Barolo 750 ml',offers:{price:'95.50',priceCurrency:'USD',availability:'https://schema.org/InStock'}});
 assert.equal(result.price,'95.50');assert.equal(result.vintage,'2016');assert.equal(result.size,'750 ml');assert.equal(result.availability,'in');
});
test('Multiple offers do not silently use the cheapest price',()=>{
 const result=extract({'@type':'Product',name:'Wine',offers:[{price:10},{price:100}]});assert.equal(result.price,'');assert.match(result.warning,/several sizes/);
});
test('Selected variant matches the offer URL',()=>{
 const result=extract({'@graph':[{'@type':'Product',name:'Wine',offers:[{url:'https://example.com/wine?variant=1',price:10},{url:'https://example.com/wine?variant=2',price:100}]}]},{url:'https://example.com/wine?variant=2'});assert.equal(result.price,'100');
});
test('Aggregate low price and list pages leave price blank',()=>{
 assert.equal(extract({'@type':'Product',offers:{'@type':'AggregateOffer',lowPrice:5,highPrice:500}}).price,'');
 assert.equal(extract([{'@type':'Product',name:'A',offers:{price:5}},{'@type':'Product',name:'B',offers:{price:500}}]).price,'');
});
test('Product meta fallback keeps shipping hints separate from item price',()=>{
 const result=extract({}, {meta:{'og:title':'Wine 2015','product:price:amount':'129.99','product:price:currency':'USD'},body:'Free shipping on orders over $300. Sale $100.'});assert.equal(result.price,'129.99');assert.equal(result.currency,'USD');assert.equal(result.shippingHints.length,1);
});
const ctCode=readFileSync(new URL('../extract-ct.js',import.meta.url),'utf8');
function extractCt({url='https://www.cellartracker.com/wine.asp?iWine=874157',title='2009 Château Pontet-Canet, France, Bordeaux, Pauillac - CellarTracker',description='',body=''}={}) {
  const document={title,body:{innerText:body},querySelector:s=>s.startsWith('meta')?(description?{content:description}:null):null};
  return vm.runInNewContext(ctCode,{document,location:{href:url},URL});
}
test('CellarTracker page: reads the community average and note count from either wording',()=>{
 const a=extractCt({description:'Average of 95.4 points in 641 community wine reviews on 2009 Château Pontet-Canet'});
 assert.deepEqual({...a},{iWine:'874157',url:'https://www.cellartracker.com/wine.asp?iWine=874157',name:'2009 Château Pontet-Canet',vintage:'2009',score:'95.4',notes:'641'});
 const b=extractCt({url:'https://www.cellartracker.com/notes.asp?iWine=9353&foo=1',title:'Community Tasting Notes - NV Opus One Overture - CellarTracker',body:'Community Tasting Notes (average 92.3 pts. and 1,429 notes)'});
 assert.equal(b.score,'92.3');assert.equal(b.notes,'1429');assert.equal(b.name,'NV Opus One Overture');assert.equal(b.vintage,'NV');assert.equal(b.url,'https://www.cellartracker.com/wine.asp?iWine=9353');
});
test('CellarTracker page: ignores critic and personal scores, and pages without a wine',()=>{
 const a=extractCt({body:'WA 98 points. My score 99 pts. Robert Parker average 97 points. Community Tasting Notes (average 94.1 pts. and 12 notes)'});
 assert.equal(a.score,'94.1');assert.equal(a.notes,'12');
 const none=extractCt({body:'WA 98 points. My score 99 pts.'});assert.equal(none.score,'');assert.equal(none.notes,'');assert.equal(none.iWine,'874157');
 assert.deepEqual({...extractCt({url:'https://www.cellartracker.com/list.asp?szSearch=pontet'})},{});
});
test('CellarTracker page: the tasting-notes count wins over the review count',()=>{
 const a=extractCt({description:'Average of 89.9 points in 909 community wine reviews',body:'Community Tasting Notes (average 90.1 pts. and 429 notes)'});
 assert.equal(a.score,'90.1');assert.equal(a.notes,'429');
});
test('Reads the producer from the product brand when the shop tags one',()=>{
 assert.equal(extract({'@type':'Product',name:'Dureuil Janthial 2023 Rully Rouge',brand:{'@type':'Brand',name:'Dureuil-Janthial'},offers:{price:'45'}}).producer,'Dureuil-Janthial');
 assert.equal(extract({'@type':'Product',name:'Wine',brand:'Ridge',offers:{price:'45'}}).producer,'Ridge');
 assert.equal(extract({'@type':'Product',name:'Wine',offers:{price:'45'}}).producer,'');
});
