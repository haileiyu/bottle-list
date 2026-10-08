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
