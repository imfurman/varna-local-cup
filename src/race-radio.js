import L from 'leaflet';
import {buildCommentary,commentaryAt} from './lib/race-commentary.js';
import './race-radio.css';

export function mountRaceRadio({map,finale,athletes,seek,clock,f,pick,esc}) {
  const events=buildCommentary(finale),byId=new Map(athletes.map(a=>[a.id,a]));
  let enabled=true,lastId='',bubble=null;
  try{enabled=localStorage.getItem('vlc-commentary')!=='off';}catch{/* Optional preference. */}
  document.querySelector('.replay-shell').insertAdjacentHTML('afterend',`<section class="race-radio" aria-label="${f('Комментарии к гонке','Коментари за състезанието')}"><div class="radio-toolbar"><span class="radio-brand"><b>“</b>${f('КОММЕНТАТОР','КОМЕНТАТОР')}</span><button id="radio-toggle" aria-pressed="${enabled}"></button></div><div id="radio-live" aria-live="polite" aria-atomic="true"></div><details class="radio-archive"><summary>${f('Все эпизоды гонки','Всички епизоди')} <span>${events.length} ↗</span></summary><div class="radio-episodes">${events.map(e=>{const a=byId.get(e.riderId);return `<button data-radio-event="${e.id}" style="--rider:${a.color}"><time>${clock(e.at)}</time><span>${esc(pick(e.tag))}</span><b>↗</b></button>`;}).join('')}</div></details></section>`);
  const root=document.querySelector('.race-radio'),toggle=root.querySelector('#radio-toggle'),live=root.querySelector('#radio-live');
  let currentTime=finale.start,currentPositions=[];
  const toggleText=()=>{toggle.textContent=enabled?f('Включён','Включен'):f('Выключен','Изключен');toggle.setAttribute('aria-pressed',String(enabled));root.classList.toggle('radio-muted',!enabled);};
  toggleText();
  toggle.onclick=()=>{enabled=!enabled;try{localStorage.setItem('vlc-commentary',enabled?'on':'off');}catch{/* Optional preference. */}toggleText();lastId='';update(currentTime,currentPositions);};
  const jump=id=>{const e=events.find(e=>e.id===id);if(!e)return;seek(e.at,e.riderId);};
  root.querySelectorAll('[data-radio-event]').forEach(b=>b.onclick=()=>{jump(b.dataset.radioEvent);root.querySelector('.radio-archive').open=false;document.querySelector('#replay').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});});
  document.querySelectorAll('[data-story-event]').forEach(b=>{b.disabled=false;b.onclick=()=>{jump(b.dataset.storyEvent);document.querySelector('#replay').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});};});
  function update(time,positions){
    currentTime=time;currentPositions=positions;
    const event=commentaryAt(events,time),key=enabled?(event?.id||'waiting'):'muted';
    if(lastId!==key){
      lastId=key;
      if(!enabled)live.innerHTML=`<p class="radio-idle">${f('Только гонка. Комментарии можно включить в любой момент.','Само състезанието. Можеш да включиш коментарите по всяко време.')}</p>`;
      else if(!event)live.innerHTML=`<p class="radio-idle">${f('Сейчас начнём. Нажми ▶, чтобы смотреть гонку.','Започваме скоро. Натисни ▶, за да гледаш състезанието.')}</p>`;
      else {const a=byId.get(event.riderId);live.innerHTML=`<article class="radio-call" style="--rider:${a.color}"><img src="./avatars/${a.avatar}-v2.png" width="42" height="42" alt="${esc(a.name)}"><div><div class="radio-caption"><time>${clock(event.at)}</time><span>${esc(pick(event.tag))}</span></div><p>${esc(pick(event.text))}</p></div></article>`;}
      if(bubble){map.removeLayer(bubble);bubble=null;}
      root.querySelectorAll('[data-radio-event]').forEach(b=>{if(b.dataset.radioEvent===event?.id)b.setAttribute('aria-current','true');else b.removeAttribute('aria-current');});
    }
    const active=enabled&&event&&time-event.at<150;
    if(!active){if(bubble){map.removeLayer(bubble);bubble=null;}return;}
    const rider=positions.find(r=>r.a.id===event.riderId);
    if(!rider?.actual)return;
    if(!bubble){
      const p=map.latLngToContainerPoint(rider.actual),size=map.getSize();
      const direction=p.x>size.x-120?'left':p.x<120?'right':p.y<120?'bottom':'top';
      bubble=L.tooltip({permanent:true,direction,offset:direction==='top'?[0,-49]:direction==='bottom'?[0,49]:direction==='left'?[-40,0]:[40,0],className:'commentator-bubble',opacity:1,interactive:false})
        .setContent(`<span>${esc(pick(event.bubble))}</span>`).setLatLng(rider.actual).addTo(map);
    }else bubble.setLatLng(rider.actual);
  }
  return {update,events};
}
