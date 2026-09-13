import { formatTime } from './lib/race.js';
import { medalSvg, medalPalette } from './lib/medal.js';
import './awards.css';

export function mountAwards(athletes, stories, {f,pick,esc}) {
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
    const [light,accent]=medalPalette(medal);
    dialog.style.setProperty('--award-accent',accent);
    document.querySelector('#award-content').innerHTML=`<div class="award-v2 ${metal}" style="--rider:${a.color};--metal:${accent};--metal-light:${light}"><header class="award-masthead"><span>VLC<span>/</span></span><p>VARNA LOCAL CUP<small>13.09.2026 · RACE 01</small></p></header><div class="award-art"><div class="award-orbit" aria-hidden="true"></div><div class="award-confetti" aria-hidden="true">${Array.from({length:28},(_,i)=>`<i style="--i:${i};--angle:${i*360/28}deg;--color:${[accent,a.color,'#fff'][i%3]}"></i>`).join('')}</div><button class="medal-turn" type="button" aria-label="${f('Повернуть медаль','Завърти медала')} · ${medal} ${f('место','място')}"><span class="medal-object">${medalSvg({place:medal,color:a.color,avatar:`./avatars/${a.avatar}-v2.png`,label:f('МЕСТО','МЯСТО')})}</span></button><span class="medal-turn-hint">↻ ${f('нажми на медаль','натисни медала')}</span></div><div class="award-inscription"><span class="award-category">${category(a)}</span><h2 id="award-name">${esc(a.name)}</h2><p class="award-tagline">${pick(stories[a.id].tagline)}</p><div class="award-result-strip"><div><small>${a.complete?f('ФИНИШНОЕ ВРЕМЯ','ФИНАЛНО ВРЕМЕ'):f('МОЯ ДИСТАНЦИЯ','МОЯТА ДИСТАНЦИЯ')}</small><strong>${a.complete?formatTime(a.elapsed):f('26,1 км','26,1 км')}</strong></div><span class="award-result-divider"></span><div><small>${f('УЧАСТНИК','УЧАСТНИК')}</small><strong class="award-bib">№ ${String(a.bib).padStart(2,'0')}</strong></div></div><p class="award-fine">${a.complete?f('40,27 км · полный маршрут · с остановками','40,27 км · цялото трасе · със спиранията'):f('Сокращённая дистанция. 1-я среди женщин и 5-я в общем.','Съкратена дистанция. 1-ва при жените и 5-а общо.')}</p></div></div>`;
    const turn=document.querySelector('.medal-turn'),object=turn.querySelector('.medal-object');
    turn.onclick=()=>{object.classList.remove('medal-spinning');void object.offsetWidth;object.classList.add('medal-spinning');};
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
    const response=await fetch(`./avatars/${a.avatar}-v2.png`);
    if(!response.ok)throw new Error('Portrait unavailable');
    const avatar=await new Promise((resolve,reject)=>{response.blob().then(blob=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(blob);}).catch(reject);});
    const svg=medalSvg({place:place(a),color:a.color,avatar,prefix:'export-medal',label:f('МЕСТО','МЯСТО')});
    const imageUrl=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml;charset=utf-8'}));
    const img=new Image();
    try {img.src=imageUrl;await img.decode();} finally {URL.revokeObjectURL(imageUrl);}
    const canvas=document.createElement('canvas');canvas.width=1080;canvas.height=1350;
    const c=canvas.getContext('2d'),[light,metal]=medalPalette(place(a));
    c.fillStyle='#101b17';c.fillRect(0,0,1080,1350);
    const glow=c.createRadialGradient(540,530,20,540,530,590);glow.addColorStop(0,a.color+'32');glow.addColorStop(1,'#101b1700');c.fillStyle=glow;c.fillRect(0,0,1080,1350);
    c.strokeStyle=metal+'35';c.lineWidth=1;
    for(let i=0;i<3;i++){c.beginPath();c.arc(540,540,290+i*80,0,Math.PI*2);c.stroke();}
    c.save();c.strokeStyle=metal+'13';for(let i=0;i<36;i++){c.beginPath();const angle=i*Math.PI/18;c.moveTo(540+Math.cos(angle)*340,540+Math.sin(angle)*340);c.lineTo(540+Math.cos(angle)*450,540+Math.sin(angle)*450);c.stroke();}c.restore();
    c.strokeStyle=metal+'55';c.strokeRect(30,30,1020,1290);
    for(const [x,y,dx,dy] of [[30,30,1,1],[1050,30,-1,1],[30,1320,1,-1],[1050,1320,-1,-1]]){c.strokeStyle=light;c.lineWidth=3;c.beginPath();c.moveTo(x+45*dx,y);c.lineTo(x,y);c.lineTo(x,y+45*dy);c.stroke();}
    c.textAlign='left';c.fillStyle='#faf6e6';c.font='600 68px Oswald';c.fillText('VLC',76,116);c.fillStyle=metal;c.fillText('/',181,116);
    c.textAlign='right';c.font='800 23px "Manrope Variable",sans-serif';c.fillStyle='#faf6e6';c.fillText('VARNA LOCAL CUP',1004,86);c.font='500 18px "Manrope Variable",sans-serif';c.fillStyle='#9fac9e';c.fillText('13.09.2026  /  RACE 01',1004,117);
    c.drawImage(img,204,140,672,728);
    c.textAlign='center';c.fillStyle=metal;c.font='800 22px "Manrope Variable",sans-serif';c.fillText(category(a),540,895);
    c.fillStyle='#faf6e6';c.font='600 68px Oswald';c.fillText(a.name,540,976,950);
    function wrap(text,y,size,maxWidth,lineHeight){c.font=`500 ${size}px "Manrope Variable",sans-serif`;let line='',rows=[];for(const word of text.split(' ')){if(c.measureText(line+' '+word).width>maxWidth&&line){rows.push(line);line=word;}else line+=(line?' ':'')+word;}if(line)rows.push(line);for(const row of rows){c.fillText(row,540,y);y+=lineHeight;}return y;}
    c.fillStyle='#c1ccbc';wrap(pick(stories[a.id].tagline),1020,24,900,32);
    c.fillStyle='#ffffff06';c.fillRect(90,1072,900,121);c.strokeStyle=metal+'40';c.lineWidth=1;c.beginPath();c.moveTo(90,1072);c.lineTo(990,1072);c.moveTo(690,1094);c.lineTo(690,1173);c.stroke();
    c.textAlign='left';c.fillStyle='#9fad9a';c.font='700 17px "Manrope Variable",sans-serif';c.fillText(a.complete?f('ФИНИШНОЕ ВРЕМЯ','ФИНАЛНО ВРЕМЕ'):f('МОЯ ДИСТАНЦИЯ','МОЯТА ДИСТАНЦИЯ'),120,1106);c.fillText(f('УЧАСТНИК','УЧАСТНИК'),740,1106);
    c.font='600 53px Oswald';c.fillStyle=light;c.fillText(a.complete?formatTime(a.elapsed):f('26,1 КМ','26,1 КМ'),120,1169);c.fillStyle='#d5dfd0';c.fillText('№ '+String(a.bib).padStart(2,'0'),740,1169);
    c.textAlign='center';c.fillStyle='#9fab96';wrap(a.complete?f('40,27 км · полный маршрут · с остановками','40,27 км · цялото трасе · със спиранията'):f('Сокращённая дистанция. 1-я среди женщин, 5-я в общем.','Съкратена дистанция. 1-ва при жените, 5-а общо.'),1222,19,920,27);
    c.fillStyle=metal;c.font='600 16px "Manrope Variable",sans-serif';c.fillText('imfurman.github.io/varna-local-cup',540,1290);
    return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('PNG export failed')),'image/png'));
  }
}
