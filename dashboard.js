import {totals, money} from './core.mjs';
import {$, state, mutate, element as el, link, ctSearch, wineFields, formData, download} from './shared.js';
let data = await state(), filter = 'watching';
const message = text => {$('#message').textContent = text;};
async function act(action) {const result = await mutate(action); data = await state(); render(); if(result.notificationFailed) message('已保存。系统通知未发出；请查看清单中的达标提示。');}
function button(text, handler, className = '') {const b = el('button', text, className); b.type = 'button'; b.onclick = async () => {try {await handler();} catch(e) {message(e.message);}}; return b;}
function stat(label, value, caption) {const box = el('div', null, 'stat'); box.append(el('span', label, 'muted'), el('strong', value), el('small', caption, 'muted')); return box;}
function render() {
  const ids = Object.keys(data.merchants), active = data.wines.filter(w => w.status === 'watching');
  const ready = ids.filter(id => totals(data, id).ready);
  $('#stats').replaceChildren(stat('待购酒款', String(active.length).padStart(2,'0'), '跨酒商收藏，集中整理'), stat('收藏酒商', String(new Set(active.map(w=>w.merchant)).size).padStart(2,'0'), '每家酒商独立累计'), stat('已达设定门槛', String(ready.length).padStart(2,'0'), ready.length ? '可以开始核对订单了' : '好酒值得慢慢凑'));
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
    const title = el('div'); title.append(el('h2',m.name), link(id,'https://' + id,'muted tiny'));
    const controls = el('div', null,'actions'); controls.append(el('span',t.ready ? '✓ 已达设定门槛' : !t.configured ? '待设置门槛' : `还差 ${money(t.remaining,m.currency)}`,t.ready ? 'pill green' : 'pill'),button('运费设置',()=>editMerchant(id)));
    head.append(title,controls); card.append(head);
    const summary = el('div',null,'merchant-summary');
    const sumText = el('div'); sumText.append(el('strong',money(t.subtotal,m.currency)),document.createTextNode(` / ${t.configured ? money(m.thresholdCents,m.currency) : '未设置'} · ${t.bottles} 件计入`));
    summary.append(sumText);
    const track = el('div',null,'progress'); const fill = el('div',null,t.ready ? 'complete' : ''); fill.style.width = (t.configured ? (m.thresholdCents === 0 ? (t.ready ? 100 : 0) : Math.min(100,t.subtotal/m.thresholdCents*100)) : 0) + '%'; track.append(fill); summary.append(track);
    if (t.excluded) summary.append(el('small',`${t.excluded} 款未计入：请检查价格、币种、库存或排除设置。`,'muted'));
    if (m.notes) summary.append(el('small',m.notes,'muted'));
    card.append(summary);
    const wrap = el('div',null,'table-wrap'), table = el('table'), header = el('tr');
    for (const title of ['酒款 / 规格','单价','数量','小计','CT 社区分','状态 / 更新日期','操作']) header.append(el('th',title));
    const thead = el('thead'); thead.append(header); table.append(thead); const tbody = el('tbody');
    for (const w of wines) {
      const row = el('tr');
      const name = el('td',null,'wine-name'); name.append(link(w.name,w.url),el('small',[w.vintage,w.size].filter(Boolean).join(' · ') || '年份 / 规格待确认','muted'));
      if (w.notes) name.append(el('small',w.notes,'muted'));
      const qty = el('td'); const input = el('input'); input.type='number'; input.className='quantity'; input.value=w.quantity; input.min=1; input.max=999; input.setAttribute('aria-label',`${w.name} 数量`);
      input.onchange = async()=>{if(!input.reportValidity())return; input.disabled=true; try {await act({type:'saveWine',wine:{...w,price:w.priceCents == null?'':w.priceCents/100,quantity:input.value}});}catch(e){message(e.message);input.value=w.quantity;input.disabled=false;}}; qty.append(input);
      const score = el('td'); score.append(link(w.ctScore == null ? '查评分 ↗' : w.ctScore.toFixed(1),w.ctUrl || ctSearch(w.name + ' ' + w.vintage),w.ctScore == null ? 'tiny' : 'score'));
      if(w.ctScore!=null) score.append(el('small',w.ctUrl?'手动 · 来源 ↗':'手动 · 未附来源','muted tiny'));
      const status = el('td'); status.append(el('span',w.status==='purchased'?'已购买':w.availability==='out'?'缺货':!w.eligible?'不计入':w.priceCents==null?'待填价格':w.currency!==m.currency?'币种不符':w.availability==='unknown'?'库存待核实':'待购买','status'),el('small',new Date(w.updatedAt).toLocaleDateString('zh-CN'),'muted'));
      const actions = el('td',null,'row-actions'); actions.append(button('编辑',()=>editWine(w),'text-button'),button(w.status==='purchased'?'恢复':'已买',()=>act({type:'status',id:w.id,status:w.status==='purchased'?'watching':'purchased'}),'text-button'),button('删除',()=>{if(confirm(`从清单删除「${w.name}」？`))return act({type:'deleteWine',id:w.id});},'text-button muted'));
      row.append(name,el('td',money(w.priceCents,w.currency)),qty,el('td',money(w.priceCents==null?null:w.priceCents*w.quantity,w.currency)),score,status,actions); tbody.append(row);
    }
    table.append(tbody); wrap.append(table); card.append(wrap); container.append(card);
  }
  if(!container.childElementCount) {const empty=el('div',null,'empty'); empty.append(el('h2',filter==='ready'?'还没有酒商达到门槛':term?'没有匹配的酒款':filter==='purchased'?'还没有已购记录':'下一瓶好酒，从这里开始。'),el('p','打开酒商的商品详情页，点击浏览器里的 Wine Queue 图标收藏；也可以手动添加。','muted'),button('＋ 添加酒款',()=>editWine(), 'primary')); container.append(empty);}
}
function openDialog(title) {$('#dialog-title').textContent=title; $('#edit-form').replaceChildren(); $('#dialog-error').textContent=''; $('#dialog-save').disabled=false; $('#dialog').showModal(); return $('#edit-form');}
function submitDialog(form, handler) {form.onsubmit=async event=>{event.preventDefault();$('#dialog-save').disabled=true;try {await handler();$('#dialog').close();}catch(e){$('#dialog-error').textContent=e.message;}finally{$('#dialog-save').disabled=false;}};}
function editWine(wine={}) {const form=openDialog(wine.id?'编辑酒款':'添加酒款'); wineFields(form,wine); submitDialog(form,()=>act({type:'saveWine',wine:{...wine,...formData(form)}}));}
function editMerchant(id) {
  const m=data.merchants[id],form=openDialog('酒商与免运费设置');
  for(const [name,title,value,type] of [['name','酒商名称',m.name,'text'],['threshold','免运费门槛（税前金额；留空不提醒）',m.thresholdCents==null?'':m.thresholdCents/100,'number'],['notes','适用地区 / 会员 / 排除条件',m.notes,'text']]) {
    const label=el('label',title),input=el('input');input.name=name;input.value=value;input.type=type;if(type==='number'){input.min=0;input.step='0.01';input.max='10000000';input.placeholder='例如 300';}label.append(input);form.append(label);
  }
  const label=el('label','门槛币种'),select=el('select');select.name='currency';for(const currency of ['USD','EUR','GBP','CAD','HKD','JPY','AUD']){const option=el('option',currency);option.value=currency;select.append(option);}select.value=m.currency;label.append(select);form.append(label,el('p','请从酒商运费政策确认门槛。满额只表示达到你设定的金额；折扣后是否满足、纽约能否寄送，需在结账页核实。','muted tiny'));
  submitDialog(form,()=>act({type:'saveMerchant',id,merchant:Object.fromEntries(new FormData(form))}));
}
$('#close').onclick=()=>$('#dialog').close();
$('#add').onclick=()=>editWine();
$('#search').oninput=render;$('#sort').onchange=render;
for(const button of document.querySelectorAll('[data-filter]'))button.onclick=()=>{filter=button.dataset.filter;document.querySelectorAll('[data-filter]').forEach(b=>b.classList.toggle('active',b===button));render();};
$('#backup').onclick=()=>download('wine-queue-backup.json',JSON.stringify(data,null,2),'application/json');
$('#export').onclick=()=>{
  const rows=[['酒商','网站','酒名','年份','规格','单价','币种','数量','CT社区评分','CT链接','库存','计入门槛','状态','更新时间','备注'],...data.wines.map(w=>[data.merchants[w.merchant].name,w.url,w.name,w.vintage,w.size,w.priceCents==null?'':w.priceCents/100,w.currency,w.quantity,w.ctScore??'',w.ctUrl,w.availability,w.eligible,w.status,w.updatedAt,w.notes])];
  const quote=value=>'"'+String(value).replace(/^[=+@\-\t\r]/,s=>"'"+s).replace(/"/g,'""')+'"';
  download('wine-queue.csv','\ufeff'+rows.map(row=>row.map(quote).join(',')).join('\r\n'),'text/csv;charset=utf-8');
};
chrome.storage.onChanged.addListener(async(changes,area)=>{if(area==='local'&&changes.state){data=await state();render();}});
render();
if(location.hash) document.getElementById(decodeURIComponent(location.hash.slice(1)))?.scrollIntoView();
