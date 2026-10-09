import {totals, money} from './core.mjs';
import {$, state, mutate, element as el, link, ctSearch, wsSearch, wineFields, formData, download} from './shared.js';
import {notSynced} from './storage.mjs';
let data = await state(), filter = 'watching';
const message = text => {$('#message').textContent = text;};
async function act(action) {const result = await mutate(action); data = await state(); render(); if(result.notificationFailed) message('Saved. The system notification was not sent; check the list for threshold alerts.');}
function button(text, handler, className = '') {const b = el('button', text, className); b.type = 'button'; b.onclick = async () => {try {await handler();} catch(e) {message(e.message);}}; return b;}
function stat(label, value) {const box = el('div', null, 'stat'); box.append(el('span', label, 'muted'), el('strong', value)); return box;}
function render() {
  const ids = Object.keys(data.merchants), active = data.wines.filter(w => w.status === 'watching');
  const ready = ids.filter(id => totals(data, id).ready);
  $('#stats').replaceChildren(stat('Wines to buy', String(active.length).padStart(2,'0')), stat('Merchants', String(new Set(active.map(w=>w.merchant)).size).padStart(2,'0')), stat('Thresholds reached', String(ready.length).padStart(2,'0')));
  const container = $('#merchants'); container.replaceChildren();
  const term = $('#search').value.trim().toLowerCase();
  ids.sort((a,b) => Number(totals(data,b).ready) - Number(totals(data,a).ready));
  for (const id of ids) {
    const m = data.merchants[id], t = totals(data,id);
    if (filter === 'ready' && !t.ready) continue;
    let wines = data.wines.filter(w => w.merchant === id && w.status === (filter === 'purchased' ? 'purchased' : 'watching'));
    wines = wines.filter(w => `${w.name} ${w.vintage} ${m.name} ${id}`.toLowerCase().includes(term));
    wines.sort((a,b) => $('#sort').value === 'score' ? (b.ctScore ?? -1)-(a.ctScore ?? -1) : $('#sort').value === 'price' ? (a.priceCents ?? Infinity)-(b.priceCents ?? Infinity) : b.updatedAt.localeCompare(a.updatedAt));
    if (!wines.length) continue;
    const card = el('section', null, 'merchant'); card.id = id;
    const head = el('div', null, 'merchant-head');
    const title = el('h2'), site = link(m.name,'https://' + id); site.title = id; title.append(site);
    const controls = el('div', null,'actions'); controls.append(el('span',t.ready ? '✓ Threshold reached' : !t.configured ? 'Threshold not set' : `${money(t.remaining,m.currency)} to go`,t.ready ? 'pill green' : 'pill'),button('Shipping settings',()=>editMerchant(id)));
    head.append(title,controls); card.append(head);
    const summary = el('div',null,'merchant-summary');
    const sumText = el('div'); sumText.append(el('strong',money(t.total,m.currency)),document.createTextNode(` / ${t.configured ? money(m.thresholdCents,m.currency) : 'not set'} · ${t.bottles} item(s) counted`));
    summary.append(sumText);
    const track = el('div',null,'progress'); const fill = el('div',null,t.ready ? 'complete' : ''); fill.style.width = (t.configured ? (m.thresholdCents === 0 ? (t.ready ? 100 : 0) : Math.min(100,t.total/m.thresholdCents*100)) : 0) + '%'; track.append(fill); summary.append(track);
    if (t.caseConfigured) summary.append(el('small',t.caseApplied ? `Includes −${money(t.discount,m.currency)} case discount (${m.caseDiscount}% off ${money(t.subtotal,m.currency)} at ${m.caseSize}+ items).` : `${t.bottlesToCase} more item(s) for the ${m.caseDiscount}% case discount (${m.caseSize}+ items).`,t.caseApplied ? 'success' : 'muted'));
    if (t.excluded) summary.append(el('small',`${t.excluded} wine(s) not counted: check price, currency, stock or exclusion settings.`,'muted'));
    if (m.notes) summary.append(el('small',m.notes,'muted'));
    card.append(summary);
    const wrap = el('div',null,'table-wrap'), table = el('table'), header = el('tr');
    for (const title of ['Wine / Size','Unit price','Qty','Subtotal','CT community score','Status / Updated','Actions']) header.append(el('th',title));
    const thead = el('thead'); thead.append(header); table.append(thead); const tbody = el('tbody');
    for (const w of wines) {
      const row = el('tr');
      const name = el('td',null,'wine-name'); name.append(link(w.name,w.url),el('small',[w.vintage,w.size].filter(Boolean).join(' · ') || 'Vintage / size to confirm','muted'));
      if (w.notes) name.append(el('small',w.notes,'muted'));
      const qty = el('td'); const input = el('input'); input.type='number'; input.className='quantity'; input.value=w.quantity; input.min=1; input.max=999; input.setAttribute('aria-label',`${w.name} quantity`);
      input.onchange = async()=>{if(!input.reportValidity())return; input.disabled=true; try {await act({type:'saveWine',wine:{...w,price:w.priceCents == null?'':w.priceCents/100,quantity:input.value}});}catch(e){message(e.message);input.value=w.quantity;input.disabled=false;}}; qty.append(input);
      const score = el('td'); score.append(link(w.ctScore == null ? 'Find score ↗' : w.ctScore.toFixed(1),w.ctUrl || ctSearch(w.name + ' ' + w.vintage),w.ctScore == null ? 'tiny' : 'score'));
      if(w.ctScore!=null) score.append(el('small',w.ctUrl?'Manual · Source ↗':'Manual · No source','muted tiny'));
      const price = el('td'), findPrice = el('small'); findPrice.append(link('Find price ↗',wsSearch(w.name,w.vintage),'tiny')); price.append(money(w.priceCents,w.currency),findPrice);
      const [statusText,statusDot] = w.status==='purchased'?['Purchased','done']:w.availability==='out'?['Out of stock','bad']:!w.eligible?['Not counted','']:w.priceCents==null?['Price needed','warn']:w.currency!==m.currency?['Currency mismatch','warn']:w.availability==='unknown'?['Stock unverified','warn']:['To buy','ok'];
      const status = el('td'); status.append(el('span',statusText,'status ' + statusDot),el('small',new Date(w.updatedAt).toLocaleDateString('en-US'),'muted'));
      const actions = el('td',null,'row-actions'); actions.append(button('Edit',()=>editWine(w),'text-button'),button(w.status==='purchased'?'Restore':'Bought',()=>act({type:'status',id:w.id,status:w.status==='purchased'?'watching':'purchased'}),'text-button'),button('Delete',()=>{if(confirm(`Delete "${w.name}" from the list?`))return act({type:'deleteWine',id:w.id});},'text-button muted'));
      row.append(name,price,qty,el('td',money(w.priceCents==null?null:w.priceCents*w.quantity,w.currency)),score,status,actions); tbody.append(row);
    }
    table.append(tbody); wrap.append(table); card.append(wrap); container.append(card);
  }
  if(!container.childElementCount) {const empty=el('div',null,'empty'); empty.append(el('h2',filter==='ready'?'No merchant has reached its threshold yet':term?'No matching wines':filter==='purchased'?'No purchases yet':'No wines saved yet'),el('p','Open a merchant\'s product page and click the Bottle List icon in your browser to save it, or add one manually.','muted'),button('+ Add wine',()=>editWine(), 'primary')); container.append(empty);}
}
function openDialog(title) {$('#dialog-title').textContent=title; $('#edit-form').replaceChildren(); $('#dialog-error').textContent=''; $('#dialog-save').disabled=false; $('#dialog').showModal(); return $('#edit-form');}
function submitDialog(form, handler) {form.onsubmit=async event=>{event.preventDefault();$('#dialog-save').disabled=true;try {await handler();$('#dialog').close();}catch(e){$('#dialog-error').textContent=e.message;}finally{$('#dialog-save').disabled=false;}};}
function editWine(wine={}) {const form=openDialog(wine.id?'Edit wine':'Add wine'); wineFields(form,wine); submitDialog(form,()=>act({type:'saveWine',wine:{...wine,...formData(form)}}));}
function editMerchant(id) {
  const m=data.merchants[id],form=openDialog('Merchant & free-shipping settings');
  for(const [name,title,value,type,attrs] of [['name','Merchant name',m.name,'text'],['threshold','Free-shipping threshold (pre-tax, after case discount; leave blank for no alert)',m.thresholdCents==null?'':m.thresholdCents/100,'number',{min:0,step:'0.01',max:'10000000',placeholder:'e.g. 300'}],['caseSize','Case discount: minimum items (leave blank if none)',m.caseSize??'','number',{min:2,step:1,max:999,placeholder:'e.g. 12'}],['caseDiscount','Case discount: percent off',m.caseDiscount??'','number',{min:0.01,step:'0.01',max:100,placeholder:'e.g. 10'}],['notes','Regions / membership / exclusions',m.notes,'text']]) {
    const label=el('label',title),input=el('input');input.name=name;input.value=value;input.type=type;Object.assign(input,attrs);label.append(input);form.append(label);
  }
  const label=el('label','Threshold currency'),select=el('select');select.name='currency';for(const currency of ['USD','EUR','GBP','CAD','HKD','JPY','AUD']){const option=el('option',currency);option.value=currency;select.append(option);}select.value=m.currency;label.append(select);form.append(label,el('p','Confirm the threshold from the merchant\'s shipping policy. Reaching it only means you hit the amount you set; check at checkout whether it still qualifies after discounts and whether they ship to New York. The case discount takes the percent off the whole counted order once it has at least that many items, counting Qty as entered (a 6-bottle case with Qty 1 counts as one item).','muted tiny'));
  submitDialog(form,()=>act({type:'saveMerchant',id,merchant:Object.fromEntries(new FormData(form))}));
}
$('#close').onclick=()=>$('#dialog').close();
$('#add').onclick=()=>editWine();
$('#search').oninput=render;$('#sort').onchange=render;
for(const button of document.querySelectorAll('[data-filter]'))button.onclick=()=>{filter=button.dataset.filter;document.querySelectorAll('[data-filter]').forEach(b=>b.classList.toggle('active',b===button));render();};
$('#backup').onclick=()=>download('bottle-list-backup.json',JSON.stringify(data,null,2),'application/json');
$('#export').onclick=()=>{
  const rows=[['Merchant','URL','Wine','Vintage','Size','Unit price','Currency','Quantity','CT community score','CT link','Stock','Counts toward threshold','Status','Updated','Notes'],...data.wines.map(w=>[data.merchants[w.merchant].name,w.url,w.name,w.vintage,w.size,w.priceCents==null?'':w.priceCents/100,w.currency,w.quantity,w.ctScore??'',w.ctUrl,w.availability,w.eligible,w.status,w.updatedAt,w.notes])];
  const quote=value=>'"'+String(value).replace(/^[=+@\-\t\r]/,s=>"'"+s).replace(/"/g,'""')+'"';
  download('bottle-list.csv','\ufeff'+rows.map(row=>row.map(quote).join(',')).join('\r\n'),'text/csv;charset=utf-8');
};
chrome.storage.onChanged.addListener(async(changes,area)=>{if(area==='sync'||(area==='local'&&changes.state)){data=await state();render();}});
render();
if(await notSynced()) message('Your list is too large for Chrome sync (about 100 KB), so it is kept on this computer only. Delete purchased wines to make room; it will start syncing on your next change.');
if(location.hash) document.getElementById(decodeURIComponent(location.hash.slice(1)))?.scrollIntoView();
