(() => {
'use strict';
if (document.getElementById('up-card-shipping-helper')) return;
const ROUTE = '#/cardManage/cardApply';
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const txt = el => (el?.textContent || '').replace(/\s+/g, ' ').trim();
const compact = el => txt(el).replace(/\s+/g, '');
const visible = el => !!el && el.isConnected && el.getClientRects().length > 0;
const all = (selector, root = document) => [...root.querySelectorAll(selector)];
const done = new Set(), skipped = new Map();
let running = false, busy = false, generation = 0, completed = 0;
const host = document.createElement('aside');
host.id = 'up-card-shipping-helper';
host.style.cssText = 'position:fixed;right:16px;top:90px;z-index:2147483647;width:310px';
const shadow = host.attachShadow({mode:'closed'});
shadow.innerHTML = `<style>:host{font:14px/1.5 system-ui,sans-serif;color:#172033}section{background:#fff;border:1px solid #cbd5e1;border-radius:12px;padding:14px;box-shadow:0 8px 28px #0003}header{display:flex;align-items:center;justify-content:space-between;cursor:move;touch-action:none;user-select:none}h3{font-size:15px;margin:0}section.folded #body{display:none}button{border:0;border-radius:5px;padding:8px 14px;background:#1677ff;color:white;cursor:pointer}header button{padding:2px 9px;background:#e2e8f0;color:#172033}p{white-space:pre-wrap;line-height:1.5}small{color:#64748b;display:block;white-space:pre-wrap;max-height:180px;overflow:auto}</style><section><header><h3>寄送卡片助手 · v1.9</h3><button id="fold" title="收起或展开">−</button></header><div id="body"><p id="status">先筛选项目和“制卡中”，再点击开始。</p><small id="count">已确认 0 笔；跳过 0 笔</small><p><button id="toggle">开始处理</button> <button id="export" style="background:#64748b">下载异常记录</button></p></div></section>`;
document.body.appendChild(host);
const key = 'up-card-shipping-panel-v1';
let folded = false, drag = null;
const clamp = (n, min, max) => Math.min(Math.max(n, min), Math.max(min, max));
function place(x,y) { const r = host.getBoundingClientRect(); host.style.right = 'auto'; host.style.left = clamp(x,0,innerWidth-r.width)+'px'; host.style.top = clamp(y,0,innerHeight-r.height)+'px'; }
function save() { const r=host.getBoundingClientRect(); try { localStorage.setItem(key,JSON.stringify({x:r.x,y:r.y,folded})); } catch {} }
function fold(value) { folded=value; shadow.querySelector('section').classList.toggle('folded',value); shadow.getElementById('fold').textContent=value?'+':'−'; const r=host.getBoundingClientRect(); place(r.x,r.y); save(); }
try { const p=JSON.parse(localStorage.getItem(key)); if(p&&Number.isFinite(p.x)&&Number.isFinite(p.y)){place(p.x,p.y);fold(!!p.folded);} } catch {}
shadow.getElementById('fold').onclick=()=>fold(!folded);
const header=shadow.querySelector('header');
header.addEventListener('pointerdown', e=>{if(e.button!==0||e.target.closest('button'))return;const r=host.getBoundingClientRect();drag={id:e.pointerId,dx:e.clientX-r.x,dy:e.clientY-r.y};header.setPointerCapture(e.pointerId);e.preventDefault();});
header.addEventListener('pointermove',e=>{if(drag?.id===e.pointerId)place(e.clientX-drag.dx,e.clientY-drag.dy);});
for(const name of ['pointerup','pointercancel'])header.addEventListener(name,()=>{if(drag){drag=null;save();}});
addEventListener('resize',()=>{const r=host.getBoundingClientRect();place(r.x,r.y);save();});
const status = s => {
  shadow.getElementById('status').textContent=s;
  const recent=[...skipped].slice(-5).map(([id,e])=>`${id}：${e.reason}${e.retryable?'（待重试）':'（需核对）'}`).join('\n');
  shadow.getElementById('count').textContent=`已确认 ${completed} 笔；待处理异常 ${skipped.size} 笔`+(recent?'\n'+recent:'');
};
function check(t){if(!running||t!==generation||location.hash!==ROUTE)throw new Error('已暂停或页面已切换');}
async function waitFor(fn,t,label,ms=10000){const end=Date.now()+ms;while(Date.now()<end){check(t);const v=fn();if(v)return v;await sleep(150);}throw new Error(label+'超时');}
function rows(){return all('table tbody tr').filter(visible).filter(r=>!r.querySelector('.ant-table-placeholder'));}
function idOf(r){return txt(r.querySelector('td:first-child'))+'|'+txt(r.querySelector('td:nth-child(2)'));}
function statusOf(r){const h=all('thead th',r.closest('table')).map(txt),i=h.findIndex(s=>s==='状态'||s==='申请状态');return i<0?null:txt(r.querySelectorAll('td')[i]);}
function selectedMaking(){return all('label,.ant-form-item-label').filter(e=>/^状态\s*[:：]?$/.test(txt(e))).some(e=>/制卡中/.test(txt((e.closest('.ant-form-item')||e.parentElement?.parentElement)?.querySelector('.ant-select-selection-item'))));}
function modal(){return all('.ant-modal').find(e=>visible(e)&&txt(e.querySelector('.ant-modal-title,.ant-modal-header')).includes('寄送卡片'));}
function item(d,name){return all('.ant-form-item',d).find(e=>txt(e.querySelector('label,.ant-form-item-label')).replace(/[＊*\s:：]/g,'').includes(name));}
function fill(input,value){if(!input||input.disabled)throw new Error('找不到可填写字段');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));}
function digits(){const a=new Uint8Array(12);crypto.getRandomValues(a);return [...a].map((n,i)=>String(i?n%10:n%9+1)).join('');}
async function upload(d,t){
  const box=item(d,'物流照片'), input=box?.querySelector('input[type=file]')||d.querySelector('input[type=file]');
  if(!box||!input)throw new Error('找不到图片上传控件');
  const response=await fetch(chrome.runtime.getURL('up-logo.jpeg'));
  if(!response.ok)throw new Error('读取图片失败');
  const file=new File([await response.blob()],'up-logo.jpeg',{type:'image/jpeg'}),dt=new DataTransfer();
  dt.items.add(file); input.files=dt.files; input.dispatchEvent(new Event('change',{bubbles:true}));
  await waitFor(()=>{
    if(box.querySelector('.ant-upload-list-item-error'))throw new Error('图片上传失败');
    const image=all('img',box).find(e=>visible(e)&&e.complete&&e.naturalWidth>0);
    return image||box.querySelector('.ant-upload-list-item-done');
  },t,'图片显示',15000);
  await sleep(800); check(t);
}
function selectedAddress(box){return txt(box?.querySelector('.ant-select-selection-item'));}
async function address(d,t){
  let lastError='';
  for(let attempt=1;attempt<=4;attempt++){
    check(t);
    const dialog=modal()||d;
    const box=item(dialog,'地址选择');
    const select=box?.querySelector('.ant-select');
    const input=select?.querySelector('input[role="combobox"]');
    const selector=select?.querySelector('.ant-select-selector');
    if(!selector||!input)throw new Error('找不到地址选择');
    if(selectedAddress(box))return;
    status(`正在选择地址（第 ${attempt} 次）……`);
    try{
      if(input.getAttribute('aria-expanded')!=='true')selector.dispatchEvent(new MouseEvent('mousedown',{bubbles:true,button:0}));
      let dropdown;
      try{
        dropdown=await waitFor(()=>{
          const linked=document.getElementById(input.getAttribute('aria-controls'))?.closest('.ant-select-dropdown');
          if(visible(linked))return linked;
          const open=all('.ant-select-dropdown').filter(visible);
          return open.length===1?open[0]:null;
        },t,'地址列表打开',2500);
      }catch(e){
        if(!running||t!==generation)throw e;
        selector.click();
        dropdown=await waitFor(()=>all('.ant-select-dropdown').find(visible),t,'地址列表打开',3500);
      }
      const options=await waitFor(()=>{
        const a=all('.ant-select-item-option',dropdown).filter(visible).filter(e=>!e.classList.contains('ant-select-item-option-disabled'));
        return a.length?a:null;
      },t,'地址选项',5000);
      const bytes=new Uint32Array(1);crypto.getRandomValues(bytes);
      const option=options[bytes[0]%options.length];
      const optionId=option.getAttribute('shippinginfoid')||option.getAttribute('title')||txt(option);
      // Visible Ant Design options can be recycled between reads; reacquire immediately before clicking.
      const current=all('.ant-select-item-option',dropdown).find(e=>visible(e)&&(e.getAttribute('shippinginfoid')||e.getAttribute('title')||txt(e))===optionId);
      if(!current){lastError='地址选项刷新';continue;}
      current.click();
      await waitFor(()=>selectedAddress(item(modal()||dialog,'地址选择')),t,'地址显示',3500);
      await sleep(350);check(t);
      return;
    }catch(e){
      if(!running||t!==generation)throw e;
      if(selectedAddress(item(modal()||dialog,'地址选择')))return;
      lastError=e.message;
      await sleep(700);
    }
  }
  throw new Error(`地址连续 4 次未能选中：${lastError}`);
}
async function closeDialog(t){
  const d=modal();if(!d)return;
  const cancel=all('button',d).find(e=>compact(e)==='取消'&&visible(e));
  (cancel||d.querySelector('.ant-modal-close'))?.click();
  await waitFor(()=>!modal(),t,'关闭失败弹窗',5000);
}
async function process(id,t,retry=false){
  let submitted=false, definitelyRejected=false;
  try{
    const row=rows().find(r=>idOf(r)===id);
    if(!row)throw new Error('列表中已找不到该订单');
    const button=all('button,a',row).find(e=>compact(e)==='寄送卡片'&&visible(e));
    if(!button)throw new Error('找不到寄送卡片操作');
    button.click();
    let d=await waitFor(modal,t,'寄送卡片弹窗');
    fill(item(d,'物流公司(中文)')?.querySelector('input'),'Fedex');
    fill(item(d,'物流公司(英文)')?.querySelector('input'),'Fedex');
    fill(item(d,'物流单号')?.querySelector('input'),digits());
    await upload(d,t);
    d=modal()||d;await address(d,t);
    d=await waitFor(modal,t,'确认前弹窗');
    await waitFor(()=>selectedAddress(item(d,'地址选择')),t,'确认前地址',3000);
    let confirm=all('button',d).find(e=>e.classList.contains('send-card-btn')&&visible(e));
    if(!confirm)confirm=all('button',d).find(e=>compact(e)==='确定'&&visible(e));
    if(!confirm)throw new Error('找不到确定按钮');
    if(confirm.disabled)throw new Error('确定按钮被页面禁用');
    check(t);status(`正在点击确定：${id}${retry?'（重试）':''}`);
    const noticeSelector='.ant-message-notice-content,.ant-notification-notice,.ant-form-item-explain-error,[role="alert"]';
    const before=new Map(all(noticeSelector).filter(visible).map(el=>[el,txt(el)]));
    submitted=true;confirm.click();
    const outcome=await waitFor(()=>{
      const fresh=all(noticeSelector).filter(visible).filter(el=>!before.has(el)||before.get(el)!==txt(el)).map(txt).filter(Boolean);
      const errors=fresh.filter(message=>/网络繁忙|网络异常|系统繁忙|服务繁忙|请求过于频繁|请稍后重试|失败|错误|不能为空|请选择/.test(message));
      if(errors.length)return {error:errors.join('；')};
      if(!modal())return {success:true};
      return null;
    },t,'提交结果未确认',20000);
    if(outcome.error){definitelyRejected=true;throw new Error(outcome.error);}
    await sleep(1000);check(t);
    const lateErrors=all(noticeSelector).filter(visible).filter(el=>!before.has(el)||before.get(el)!==txt(el)).map(txt).filter(message=>/网络繁忙|网络异常|系统繁忙|服务繁忙|请求过于频繁|请稍后重试|失败|错误/.test(message));
    if(lateErrors.length){definitelyRejected=true;throw new Error(lateErrors.join('；'));}
    // The modal must close on its own. Upload toasts are never counted as shipping success.
    done.add(id);skipped.delete(id);completed++;status(`已确认 ${id}，继续下一笔。`);
    return true;
  }catch(error){
    if(!running||t!==generation)throw error;
    const previous=skipped.get(id);
    const attempts=(previous?.attempts||0)+1;
    const transient=/网络繁忙|网络异常|系统繁忙|服务繁忙|请求过于频繁|请稍后重试|请求失败|服务器繁忙/.test(error.message);
    const retryable=attempts<3&&(!submitted||(definitelyRejected&&transient));
    const after=Date.now()+(transient?Math.min(30000,8000*attempts):3000);
    skipped.set(id,{reason:error.message,attempts,retryable,after});
    status(`${id} 失败：${error.message}。${retryable?'先跳过，稍后重试。':'跳过并继续。'}`);
    try{await closeDialog(t);}catch(closeError){throw new Error(`${id}：${error.message}；${closeError.message}，已停止以免操作错单`);}
    return false;
  }
}
async function retryOutstanding(t){
  if(![...skipped.values()].some(e=>e.retryable))return;
  status('首轮结束，正在查找并重试待处理异常……');
  const first=all('.ant-pagination-item').find(e=>e.getAttribute('title')==='1'||compact(e)==='1');
  if(first&&!first.classList.contains('ant-pagination-item-active')){
    const before=rows().map(idOf).join(',');first.click();
    await waitFor(()=>rows().map(idOf).join(',')!==before,t,'返回第一页');
  }
  while(true){
    check(t);
    const candidates=[...skipped].filter(([id,e])=>e.retryable&&rows().some(r=>idOf(r)===id));
    for(const [id] of candidates){
      check(t);
      const entry=skipped.get(id);if(!entry?.retryable)continue;
      const row=rows().find(r=>idOf(r)===id);
      if(row&&statusOf(row)!==null&&statusOf(row)!=='制卡中'){
        entry.retryable=false;entry.reason+='；当前状态已变化，请核对';status(`订单 ${id} 状态已变化，停止自动重试`);continue;
      }
      const delay=Math.max(0,entry.after-Date.now());
      if(delay){status(`等待 ${Math.ceil(delay/1000)} 秒后重试 ${id}……`);await sleep(delay);check(t);}
      status(`稍后重试 ${id}……`);await process(id,t,true);await sleep(2500);
    }
    const next=all('.ant-pagination-next').find(visible);
    if(!next||next.classList.contains('ant-pagination-disabled')||next.getAttribute('aria-disabled')==='true')break;
    const before=rows().map(idOf).join(',');(next.querySelector('button,a')||next).click();
    await waitFor(()=>{const after=rows().map(idOf).join(',');return after&&after!==before;},t,'重试时翻页');
  }
}
async function run(t){
  if(busy)return;busy=true;
  try{
    if(location.hash!==ROUTE)throw new Error('请打开开卡申请管理页面');
    if(!selectedMaking())throw new Error('请先把状态筛选为“制卡中”并点击搜索');
    if(!rows().length)throw new Error('当前列表没有记录');
    while(true){
      check(t);
      const pageTried=new Set();
      while(true){
        check(t);
        const row=rows().find(r=>{const id=idOf(r),state=statusOf(r);return id&&!pageTried.has(id)&&!done.has(id)&&!skipped.has(id)&&(state===null||state==='制卡中');});
        if(!row)break;
        const id=idOf(row);pageTried.add(id);status(`正在处理 ${id}`);
        await process(id,t);await sleep(2500);
      }
      const retryIds=[...skipped].filter(([id,e])=>e.retryable&&rows().some(r=>idOf(r)===id)).map(([id])=>id);
      for(const id of retryIds){check(t);const delay=Math.max(0,(skipped.get(id)?.after||0)-Date.now());if(delay)await sleep(delay);check(t);status(`正在重试 ${id}`);await process(id,t,true);await sleep(2500);}
      const next=all('.ant-pagination-next').find(visible);
      if(!next||next.classList.contains('ant-pagination-disabled')||next.getAttribute('aria-disabled')==='true')break;
      const before=rows().map(idOf).join(',');(next.querySelector('button,a')||next).click();
      await waitFor(()=>{const after=rows().map(idOf).join(',');return after&&after!==before;},t,'翻页');
    }
    await retryOutstanding(t);
    status(`当前筛选结果处理完毕。后台确认 ${completed} 笔，待核对 ${skipped.size} 笔。`);
  }catch(error){status(`已停止：${error.message}`);}
  finally{running=false;busy=false;shadow.getElementById('toggle').textContent='开始处理';}
}
shadow.getElementById('export').onclick=()=>{
  const lines=['订单ID\t尝试次数\t错误原因\t是否待重试',...[...skipped].map(([id,e])=>`${id}\t${e.attempts}\t${e.reason}\t${e.retryable?'是':'否'}`)];
  const url=URL.createObjectURL(new Blob([lines.join('\n')],{type:'text/plain;charset=utf-8'}));
  const link=document.createElement('a');link.href=url;link.download='寄送卡片异常记录.txt';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
};
shadow.getElementById('toggle').onclick=()=>{if(running){running=false;generation++;status('已暂停。');shadow.getElementById('toggle').textContent='开始处理';return;}if(busy)return;done.clear();skipped.clear();completed=0;running=true;generation++;shadow.getElementById('toggle').textContent='暂停';run(generation);};
function syncRoute(){
  const onList=location.hash===ROUTE;
  host.hidden=!onList;
  if(!onList&&running){
    running=false;generation++;
    shadow.getElementById('toggle').textContent='开始处理';
    status('已离开开卡申请管理，自动处理已暂停。');
  }
}
syncRoute();
addEventListener('hashchange',syncRoute);
setInterval(syncRoute,500);
})();
