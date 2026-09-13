import { formatTime } from './lib/race.js';

export function mountAwards(athletes, stories, {f,pick,portrait,esc}) {
  document.body.insertAdjacentHTML('beforeend',`<dialog id="award-dialog" aria-labelledby="award-name"><button class="award-close" aria-label="${f('Закрыть','Затвори')}">×</button><div id="award-content"></div><div class="award-share"><button id="award-save" disabled>↓ ${f('Скачать медаль PNG','Изтегли медала PNG')}</button><button id="award-share" disabled>↗ ${f('Поделиться','Сподели')}</button><button id="award-link">${f('Скопировать ссылку','Копирай връзката')}</button></div><p id="award-status" role="status"></p></dialog>`);
  const dialog=document.querySelector('#award-dialog'),status=document.querySelector('#award-status');
  let current=null,file=null,generation=0,returnFocus=null;
  const awardURL = a => {const url=new URL(location.href);url.hash=`award-${a.id}`;return url.href;};
  const place = a => a.gender==='female'?a.categoryRank:a.rank;
  const category=a=>a.gender==='female'?f('ЖЕНСКИЙ ЗАЧЁТ','КЛАСИРАНЕ ЖЕНИ'):f('ОБЩИЙ ЗАЧЁТ','ОБЩО КЛАСИРАНЕ');
  async function open(id){
    const a=athletes.find(a=>a.id===id);if(!a)return;
    current=a;file=null;const request=++generation;returnFocus=document.activeElement;
    document.querySelector('#award-save').disabled=document.querySelector('#award-share').disabled=true;
    const medal=place(a),metal=medal===1?'gold':medal===2?'silver':medal===3?'bronze':'finisher';
    document.querySelector('#award-content').innerHTML=`<div class="award-stage ${metal}" style="--rider:${a.color}"><div class="award-confetti" aria-hidden="true">${Array.from({length:28},(_,i)=>`<i style="--i:${i};--angle:${i*360/28}deg;--color:${['#f8c846',a.color,'#fff','#f175ac'][i%4]}"></i>`).join('')}</div><span class="award-kicker">VARNA LOCAL CUP / 13.09.2026</span><div class="medal-ribbons" aria-hidden="true"></div><div class="personal-medal"><div class="medal-face">${portrait(a)}<span class="medal-place">${medal}</span><span class="medal-caption">${f('МЕСТО','МЯСТО')}</span></div></div><span class="award-category">${category(a)}</span><h2 id="award-name">${esc(a.name)}</h2><p class="award-tagline">${pick(stories[a.id].tagline)}</p><strong class="award-time">${a.complete?formatTime(a.elapsed):f('26,1 км · свой путь','26,1 км · свой път')}</strong><p class="award-fine">${a.complete?f('40,27 км · полный маршрут · с остановками','40,27 км · цялото трасе · със спиранията'):f('Сокращённая дистанция. 1-я среди женщин и 5-я в общем по решению организатора.','Съкратена дистанция. 1-ва при жените и 5-а общо по решение на организатора.')}</p></div>`;
    status.textContent=f('Готовим карточку для скачивания…','Подготвяме картата за изтегляне…');
    if(!dialog.open)dialog.showModal();
    try {const blob=await drawMedal(a);if(request!==generation)return;file=new File([blob],`varna-local-cup-${a.avatar}.png`,{type:'image/png'});document.querySelector('#award-save').disabled=document.querySelector('#award-share').disabled=false;status.textContent=f('Твоя медаль готова. Сохрани или отправь друзьям.','Медалът ти е готов. Запази го или го изпрати на приятели.');}
    catch {if(request===generation)status.textContent=f('Не удалось подготовить PNG. Ссылкой на награду можно поделиться ниже.','PNG не е готов. Можеш да споделиш връзката към наградата.');}
  }
  document.querySelectorAll('[data-award]').forEach(b=>b.onclick=()=>open(b.dataset.award));
  document.querySelector('.award-close').onclick=()=>dialog.close();
  dialog.addEventListener('close',()=>{generation++;returnFocus?.focus();});
  dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});
  function download(){if(!file)return;const url=URL.createObjectURL(file),link=document.createElement('a');link.href=url;link.download=file.name;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);status.textContent=f('PNG сохранён через загрузки браузера. Его можно отправить в Telegram.','PNG е изпратен към изтеглянията на браузъра. Можеш да го изпратиш в Telegram.');}
  document.querySelector('#award-save').onclick=download;
  document.querySelector('#award-share').onclick=async()=>{
    if(!file)return;
    try{if(navigator.canShare?.({files:[file]}))await navigator.share({files:[file],title:`Varna Local Cup · ${current.name}`,text:pick(stories[current.id].tagline)});else download();}
    catch(error){if(error.name!=='AbortError')status.textContent=f('Не удалось отправить. Скачай PNG и приложи его к сообщению.','Неуспешно споделяне. Изтегли PNG и го прикачи към съобщение.');}
  };
  document.querySelector('#award-link').onclick=async()=>{try{await navigator.clipboard.writeText(awardURL(current));status.textContent=f('Ссылка на персональную награду скопирована.','Връзката към персоналната награда е копирана.');}catch{status.textContent=awardURL(current);}};
  const fromHash=()=>{if(location.hash.startsWith('#award-'))open(location.hash.slice(7));};
  window.addEventListener('hashchange',fromHash);fromHash();

  async function drawMedal(a){
    await document.fonts.ready;
    const img=new Image();img.src=`./avatars/${a.avatar}.png`;await img.decode();
    const canvas=document.createElement('canvas');canvas.width=1080;canvas.height=1350;
    const c=canvas.getContext('2d'),rank=place(a),gold=rank===1?'#f2bd45':rank===2?'#c6d8e4':rank===3?'#d39868':'#dfc25d';
    c.fillStyle='#14271f';c.fillRect(0,0,1080,1350);
    const glow=c.createRadialGradient(540,470,50,540,470,680);glow.addColorStop(0,a.color+'88');glow.addColorStop(1,'#14271f00');c.fillStyle=glow;c.fillRect(0,0,1080,1350);
    for(let i=0;i<44;i++){const x=(i*193+83)%1080,y=(i*137+130)%1040;c.save();c.translate(x,y);c.rotate(i);c.fillStyle=[gold,a.color,'#ffffff66'][i%3];c.fillRect(-3,-7,6,14);c.restore();}
    c.textAlign='center';c.fillStyle='#ffffff';c.font='600 42px Oswald';c.fillText('VARNA LOCAL CUP',540,100);c.font='600 22px "Manrope Variable", sans-serif';c.fillStyle='#b5c9bd';c.fillText('13.09.2026  /  VARNA, BULGARIA',540,144);
    c.fillStyle=a.color;c.beginPath();c.moveTo(390,190);c.lineTo(490,190);c.lineTo(540,350);c.lineTo(450,410);c.closePath();c.fill();c.beginPath();c.moveTo(590,190);c.lineTo(690,190);c.lineTo(630,410);c.lineTo(540,350);c.closePath();c.fill();
    c.shadowColor='#0008';c.shadowBlur=50;c.shadowOffsetY=25;c.fillStyle=gold;c.beginPath();c.arc(540,510,245,0,Math.PI*2);c.fill();c.shadowBlur=0;c.shadowOffsetY=0;
    c.strokeStyle='#fff8';c.lineWidth=3;c.beginPath();c.arc(540,510,228,0,Math.PI*2);c.stroke();
    c.save();c.beginPath();c.arc(540,456,158,0,Math.PI*2);c.clip();c.drawImage(img,382,298,316,316);c.restore();
    c.fillStyle='#14271f';c.beginPath();c.arc(540,637,72,0,Math.PI*2);c.fill();c.fillStyle=gold;c.font='600 86px Oswald';c.fillText(String(rank),540,669);c.font='800 16px "Manrope Variable", sans-serif';c.fillText(f('МЕСТО','МЯСТО'),540,695);
    c.fillStyle=gold;c.font='800 24px "Manrope Variable", sans-serif';c.fillText(category(a),540,825);
    c.fillStyle='#fff';c.font='600 65px Oswald';c.fillText(a.name,540,907,950);
    function wrap(text,y,size,maxWidth,lineHeight){c.font=`600 ${size}px "Manrope Variable", sans-serif`;let line='',rows=[];for(const word of text.split(' ')){if(c.measureText(line+' '+word).width>maxWidth&&line){rows.push(line);line=word;}else line+=(line?' ':'')+word;}if(line)rows.push(line);for(const row of rows)c.fillText(row,540,y),y+=lineHeight;return y;}
    c.fillStyle='#d8e8dc';wrap(pick(stories[a.id].tagline),969,27,880,40);
    c.fillStyle='#fff';c.font='600 70px Oswald';c.fillText(a.complete?formatTime(a.elapsed):f('26,1 КМ','26,1 КМ'),540,1112);
    c.fillStyle='#b5c9bd';wrap(a.complete?f('40,27 км · полный маршрут · с остановками','40,27 км · цялото трасе · със спиранията'):f('Сокращённая дистанция. 1-я среди женщин, 5-я в общем — решение организатора.','Съкратена дистанция. 1-ва при жените, 5-а общо — решение на организатора.'),1161,22,900,32);
    c.fillStyle=gold;c.fillRect(80,1250,920,2);c.font='600 21px "Manrope Variable", sans-serif';c.fillText('imfurman.github.io/varna-local-cup',540,1301);
    return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('PNG export failed')),'image/png'));
  }
}
