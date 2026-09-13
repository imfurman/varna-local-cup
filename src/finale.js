import L from 'leaflet';
import { language, locale } from './language.js';
import { formatTime } from './lib/race.js';
import { positionAt, trackSegments, categoryStanding } from './lib/replay.js';
import { stories } from './finale-stories.js';
import { mountAwards } from './awards.js';
import { mountRaceRadio } from './race-radio.js';
import './finale.css';

export const f = (ru, bg) => language === 'bg' ? bg : ru;
const pick = pair => pair[language === 'bg' ? 1 : 0];
const num = (v, n = 1) => new Intl.NumberFormat(locale, { maximumFractionDigits: n }).format(v);
const clock = time => new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Europe/Sofia', hourCycle: 'h23' }).format(new Date(time * 1000));
const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const portrait = a => `<img src="./avatars/${a.avatar}-v2.png" alt="${esc(a.name)}" width="80" height="80" loading="lazy">`;
const button = (a, kind, label, cls = '') => `<button class="${cls}" data-${kind}="${a.id}">${label}</button>`;

export function mountFinale({ finale, course, event }) {
  const athletes = [...finale.athletes].sort((a,b)=>a.rank-b.rank);
  document.body.classList.add('race-finished');
  document.title = `${event.title} · ${f('Итоги и повтор гонки', 'Резултати и повторение')}`;
  document.querySelector('.event-date p').textContent = f('Гонка завершена.', 'Състезанието приключи.');
  document.querySelector('.start-card h3').textContent = f('Здесь всё началось', 'Тук започна всичко');
  document.querySelector('.event-schedule').remove();
  document.querySelector('.start-card .local-time').textContent = f('13 сентября 2026 · Варна', '13 септември 2026 · Варна');
  document.querySelector('.site-header nav').insertAdjacentHTML('afterbegin', `<a href="#replay">${f('Повтор', 'Повторение')}</a>`);
  document.querySelector('#route').insertAdjacentHTML('beforebegin', `
    <section class="finish-hero" aria-label="${f('Итоги гонки', 'Резултати от състезанието')}">
      <div class="finish-copy"><span class="finish-stamp">${f('13 СЕНТЯБРЯ · ИТОГИ', '13 СЕПТЕМВРИ · РЕЗУЛТАТИ')}</span><h2>${f('КАК ЭТО<br>БЫЛО.', 'КАК<br>МИНА.')}</h2><p>${f('Рывки, подъёмы, один очень долгий пит-стоп. Смотри, как это было — по нашим настоящим GPS-записям.', 'Атаки, изкачвания и един много дълъг питстоп. Виж как се случи — по истинските ни GPS записи.')}</p><a class="replay-cta" href="#replay">▶ ${f('Смотреть гонку', 'Гледай състезанието')}</a></div>
      <div class="finish-podium">${[athletes[1],athletes[0],athletes[2]].map(a=>`<a href="#story-${a.id}" class="podium-person p${a.rank}" style="--rider:${a.color}"><span class="podium-avatar">${portrait(a)}<b>${a.rank}</b></span><strong>${esc(a.name)}</strong><span>${formatTime(a.elapsed)}</span><div class="podium-block">${['','I','II','III'][a.rank]}</div></a>`).join('')}<span class="podium-caption">${f('Общий зачёт · 13 сентября 2026', 'Общо класиране · 13 септември 2026')}</span></div>
    </section>
    <section id="replay" class="replay-section" aria-labelledby="replay-title">
      <div class="section-heading"><div><p class="eyebrow">RACE REPLAY / 01</p><h2 id="replay-title">${f('Пережить ещё раз', 'Преживей отново')}</h2></div><span class="replay-date">13.09.2026 <b id="replay-clock">${clock(finale.start)}</b><small>${f('Время Варны · часы FIT', 'Време във Варна · FIT часовници')}</small></span></div>
      <div class="replay-shell"><div class="replay-map-wrap"><div id="replay-map" aria-label="${f('Одновременный повтор GPS-записей пяти участников', 'Едновременно повторение на GPS записите на петимата')}"></div><div class="replay-map-top"><span class="replay-tag">● GPS REPLAY</span><button id="replay-fit">↗ ${f('Весь маршрут', 'Цялото трасе')}</button></div><p id="replay-map-error" hidden>${f('Картографическая подложка недоступна. GPS-треки остаются видны.', 'Картната подложка е недостъпна. GPS следите остават видими.')}</p></div>
      <div class="replay-desk"><div class="replay-loading" role="status">${f('Загружаем GPS-записи…', 'Зареждане на GPS записите…')}</div><div class="transport"><button id="replay-play" disabled aria-label="${f('Воспроизвести', 'Пусни')}">▶</button><button id="replay-reset" disabled aria-label="${f('С начала', 'Отначало')}">↺</button><span id="replay-elapsed">00:00:00</span><label>${f('Скорость', 'Скорост')}<select id="replay-speed" aria-label="${f('Скорость повтора', 'Скорост на повторението')}"><option value="15">15×</option><option value="60" selected>60×</option><option value="120">120×</option><option value="300">300×</option></select></label></div>
      <input id="replay-seek" type="range" min="${finale.start}" max="${finale.end}" step="1" value="${finale.start}" disabled aria-label="${f('Момент гонки', 'Момент от състезанието')}"><div class="timeline-limits"><span>${clock(finale.start)}</span><span>${clock(finale.end)}</span></div>
      <div class="replay-events" aria-label="${f('Ключевые моменты', 'Ключови моменти')}"></div>
      <div id="replay-riders">${athletes.map(a=>`<button data-follow="${a.id}" class="replay-rider" style="--rider:${a.color}" aria-pressed="false">${portrait(a)}<span><strong>${esc(a.name)}</strong><small data-live="${a.id}">—</small></span><i><b data-progress="${a.id}"></b></i></button>`).join('')}</div>
      <label class="follow-camera"><input id="follow-camera" type="checkbox"> ${f('Камера следует за выбранным гонщиком', 'Камерата следва избрания състезател')}</label></div></div>
      <p class="replay-note">${f('Одна общая шкала реального времени. Нажми на гонщика, чтобы выделить его след. Во время разрыва GPS маркер ждёт последнюю точку; после окончания записи остаётся на месте. Цифры на портретах — итоговые места. Соседние портреты разнесены и соединены с точными координатами. Полосы показывают записанное расстояние, а не текущие места.', 'Една обща скала на реалното време. Избери състезател, за да откроиш следата му. При GPS прекъсване маркерът остава на последната точка; след края на записа също остава на място. Цифрите върху портретите са крайните места. Съседните портрети са раздалечени с линии до точните координати. Лентите показват записаното разстояние, а не текущото класиране.')}</p>
    </section>`);

  document.querySelector('#participants').innerHTML = `<div class="section-heading"><div><p class="eyebrow">THE RIDERS</p><h2 id="participants-title">${f('Участники', 'Участници')}</h2></div><span>${f('Результаты и награды', 'Резултати и награди')}</span></div><div class="finisher-grid">${athletes.map(a=>`<article class="finisher-card" style="--rider:${a.color}"><span class="finisher-place">${String(a.rank).padStart(2,'0')}<small>${f('общий зачёт', 'общо класиране')}</small></span>${portrait(a)}<h3>${esc(a.name)}</h3><p class="rider-title">${pick(stories[a.id].title)}</p><strong class="finisher-time">${a.complete?formatTime(a.elapsed):f('1-я среди женщин', '1-ва при жените')}</strong><small>${a.complete?f('Полный маршрут · с остановками', 'Цялото трасе · със спирания'):f('Сокращённая дистанция · 26,1 км', 'Съкратена дистанция · 26,1 км')}</small><div class="finisher-actions"><a href="#story-${a.id}">${f('Разбор заезда', 'Анализ на карането')} ↗</a>${button(a,'award',`✦ ${f('Забрать награду', 'Вземи наградата')}`)}</div></article>`).join('')}</div>`;

  document.querySelector('#results').innerHTML = `<div class="section-heading"><h2 id="results-title">${f('Протокол финиша', 'Финално класиране')}</h2><span>${f('13 сентября 2026', '13 септември 2026')}</span></div><div class="results-card"><div class="results-toolbar"><div class="filters">${[['all',f('Общий','Общо')],['male',f('Мужчины','Мъже')],['female',f('Женщины','Жени')]].map(([key,label])=>`<button data-final-filter="${key}" aria-pressed="${key==='all'}" class="${key==='all'?'selected':''}">${label}</button>`).join('')}</div></div><div id="final-table"></div></div><p class="results-footnote">${f('Время полного маршрута рассчитано по GPS-зонам старта и финиша, включая остановки. Женя: 5-я в общем, 1-я среди женщин; сокращённая дистанция, без времени полного финиша.', 'Времето за цялото трасе е изчислено по GPS зоните на старта и финала, със спиранията. Женя: 5-а общо и 1-ва при жените; съкратена дистанция, без време за пълно преминаване.')}</p>`;
  function renderTable(category = 'all') {
    document.querySelector('#final-table').innerHTML = `<div class="table-scroll"><table><thead><tr><th>${f('Место','Място')}</th><th>${f('Гонщик','Състезател')}</th><th>${f('Полное время','Общо време')}</th><th>${f('Разница','Разлика')}</th><th>${f('Средняя','Средна')}</th></tr></thead><tbody>${categoryStanding(athletes,category).map(a=>`<tr><td><b class="rank">${a.place}</b></td><td><a href="#story-${a.id}">${esc(a.name)}</a><span class="table-sub">${a.complete?f('Полный маршрут','Цялото трасе'):f('Сокращённая дистанция','Съкратена дистанция')}</span></td><td class="time-cell">${a.complete?formatTime(a.elapsed):'—'}</td><td>${a.complete&&a.rank>1?'+'+formatTime(a.elapsed-athletes[0].elapsed):'—'}</td><td>${a.complete?num(a.courseAverageKmh)+' '+f('км/ч','км/ч'):'—'}</td></tr>`).join('')}</tbody></table></div>`;
  }
  renderTable();
  document.querySelectorAll('[data-final-filter]').forEach(b=>b.onclick=()=>{document.querySelectorAll('[data-final-filter]').forEach(x=>{x.classList.toggle('selected',x===b);x.setAttribute('aria-pressed',String(x===b));});renderTable(b.dataset.finalFilter);});

  document.querySelector('#rules').outerHTML = `<section class="race-stories" id="stories"><div class="section-heading"><div><p class="eyebrow">BEHIND THE NUMBERS</p><h2>${f('Гонка в деталях', 'Състезанието в детайли')}</h2></div><span>${f('Ключевые отрезки и борьба за места', 'Ключови отрязъци и борба за местата')}</span></div>${athletes.map(a=>{
    const story=stories[a.id], best=Math.max(...a.splits.map(s=>s.speed));
    return `<article id="story-${a.id}" class="rider-story" style="--rider:${a.color}"><div class="story-person">${portrait(a)}<span class="story-number">0${a.rank} /</span><h3>${esc(a.name)}</h3><p>${pick(story.title)}</p>${button(a,'award',`✦ ${f('Моя награда', 'Моята награда')}`)}</div><div class="story-body"><h4>${pick(story.lead)}</h4><div class="story-highlights">${story.highlights.map(([value,ru,bg])=>`<div><b>${value}</b><span>${f(ru,bg)}</span></div>`).join('')}</div><div class="story-chapters">${story.chapters.map(c=>`<section class="story-chapter"><span>${pick(c.tag)}</span><h5>${pick(c.title)}</h5><p>${pick(c.text)}</p>${c.event?`<button data-story-event="${c.event}" disabled>▶ ${f('Этот момент на карте','Този момент на картата')}</button>`:''}</section>`).join('')}</div><details class="telemetry"><summary>${f('Телеметрия и темп по участкам', 'Телеметрия и темпо по участъци')} <span>↗</span></summary><div class="telemetry-body"><div class="split-chart"><h5>${f('Каждые 5 км · средняя с остановками', 'На всеки 5 км · средна със спиранията')}</h5>${a.splits.map(s=>`<div class="split-row"><span>${s.fromKm}–${s.toKm} ${f('км','км')}</span><div><b style="width:${s.speed/best*100}%"></b></div><strong>${num(s.speed)} <small>${f('км/ч','км/ч')}</small></strong><time>${formatTime(s.seconds)}</time></div>`).join('')}</div><dl class="telemetry-stats"><div><dt>${a.complete?f('GPS-время маршрута','GPS време по трасето'):f('Длительность записи','Продължителност на записа')}</dt><dd>${formatTime(a.elapsed)}</dd></div><div><dt>${f('Расстояние GPS¹','GPS разстояние¹')}</dt><dd>${num(a.gpsDistanceM/1000)} ${f('км','км')}</dd></div><div><dt>${f('Быстрейшее окно ≈30 с²','Най-бърз прозорец ≈30 с²')}</dt><dd>${num(a.peak.speed)} ${f('км/ч','км/ч')}</dd></div><div><dt>${f('Паузы таймера FIT','Паузи на FIT таймера')}</dt><dd>${a.movingBasis==='device'?formatTime(a.pausedSeconds):f('Нет событий паузы','Няма събития за пауза')}</dd></div>${Object.entries(a.sensors).map(([key,s])=>`<div><dt>${{heart:f('Пульс','Пулс'),power:f('Мощность','Мощност'),cadence:f('Каденс','Каданс')}[key]} · ${f('среднее / максимум','средно / максимум')}</dt><dd>${s.average} / ${s.max} <small>${{heart:f('уд/мин','уд./мин'),power:f('Вт','W'),cadence:f('об/мин','об./мин')}[key]}</small><small>${f('Покрытие записи','Покритие на записа')}: ${s.coverage}%</small></dd></div>`).join('')}</dl><p class="telemetry-note">${f('¹ Сумма GPS-сегментов; дрейф и пропуски влияют на длину. Для полного маршрута средняя считается по GPX 40,27 км. ² Средняя скорость в окне около 30 секунд, не мгновенный пик. Отметки 5 км — оценка по ближайшим GPS-точкам. Пауза таймера и остановка на местности не одно и то же.', '¹ Сбор от GPS сегменти; дрейфът и пропуските влияят на дължината. Средната за цялото трасе използва GPX 40,27 км. ² Средна скорост за около 30 секунди, не моментен пик. Отметките през 5 км са приблизителни по най-близките GPS точки. Пауза на таймера и спиране на място са различни неща.')}</p></div></details><button class="story-replay" data-watch="${a.id}">▶ ${f('Показать путь на повторе', 'Покажи пътя в повторението')}</button></div></article>`;
  }).join('')}<details class="methodology"><summary>${f('Как мы прочитали эти записи', 'Как прочетохме тези записи')}</summary><p>${f('Четыре полных трека прошли проверку 80 контрольных точек GPX. Время — разница между выбранными GPS-точками у старта и финиша, с остановками. Часы устройств не корректировались: небольшие расхождения старта и погрешность GPS остаются. У Жени показана сокращённая поездка.', 'Четири пълни следи преминаха проверката на 80 GPX контролни точки. Времето е разликата между избраните GPS точки при старта и финала, със спиранията. Часовниците не са коригирани: малките разлики при старта и GPS неточността остават. Женя е със съкратено каране.')}</p><p>${f('Повтор использует точки примерно каждые 8 секунд и сохраняет разрывы записи. Между точками до 30 секунд движение интерполируется; более длинные пропуски помечены. Отброшены 12 нереалистичных GPS-скачков Никиты свыше 100 км/ч. Долгие остановки Никиты связаны с проколом. Пульс, мощность и каденс показаны только там, где они записаны.', 'Повторението използва точки приблизително през 8 секунди и запазва прекъсванията. Между точки до 30 секунди движението се интерполира; по-дългите пропуски са отбелязани. Изключени са 12 нереалистични GPS скока на Никита над 100 км/ч. Дългите спирания на Никита са заради спукана гума. Пулс, мощност и каданс се показват само когато са записани.')}</p></details></section>`;

  mountAwards(athletes, stories, { f, pick, portrait, esc });
  mountReplay(finale, course, athletes);
}

async function mountReplay(finale, course, athletes) {
  const q = selector => document.querySelector(selector);
  const map = L.map('replay-map', { scrollWheelZoom:false, zoomControl:false, zoomSnap:0.25 });
  L.control.zoom({position:'bottomright',zoomInTitle:f('Увеличить','Увеличи'),zoomOutTitle:f('Уменьшить','Намали')}).addTo(map);
  const tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'}).addTo(map);
  tiles.on('tileerror',()=>q('#replay-map-error').hidden=false);
  const courseLine = L.polyline(course.points.map(p=>[p.lat,p.lon]),{color:'#fff',weight:8,opacity:.85,interactive:false}).addTo(map);
  L.polyline(course.points.map(p=>[p.lat,p.lon]),{color:'#727b72',weight:2,dashArray:'5 7',interactive:false}).addTo(map);
  const fit=()=>map.fitBounds(courseLine.getBounds(),{padding:[45,60]}); fit();
  q('#replay-fit').onclick=fit;
  new ResizeObserver(()=>{map.invalidateSize();fit();}).observe(q('#replay-map'));
  for (const [p,label] of [[course.points[0],f('СТАРТ','СТАРТ')],[course.points.at(-1),f('ФИНИШ','ФИНАЛ')]]) L.circleMarker([p.lat,p.lon],{color:'#18271e',fillColor:'#fff',fillOpacity:1,radius:5,weight:2}).addTo(map).bindTooltip(label,{permanent:true,direction:'left'});
  let tracks;
  try {
    const response=await fetch('./race-replay.json'); if(!response.ok)throw new Error('HTTP '+response.status);
    const data=await response.json(); if(data.courseHash!==finale.courseHash||data.eventId!==finale.eventId)throw new Error('Stale replay');
    tracks=data.tracks;
    for(const a of athletes)if(!Array.isArray(tracks[a.id])||tracks[a.id].length<2)throw new Error('Missing track');
  } catch {
    q('.replay-loading').innerHTML=`${f('Не удалось загрузить повтор.', 'Неуспешно зареждане на повторението.')} <button id="retry-replay">${f('Повторить','Опитай отново')}</button>`;
    q('#retry-replay').onclick=()=>location.reload();return;
  }
  q('.replay-loading').remove();
  q('#replay-play').disabled=q('#replay-reset').disabled=q('#replay-seek').disabled=false;
  const riders=athletes.map(a=>{
    const marker=L.marker([tracks[a.id][0][1],tracks[a.id][0][2]],{title:a.name,icon:L.divIcon({className:'replay-avatar',html:`<span style="--rider:${a.color}"><img src="./avatars/${a.avatar}-v2.png" alt=""><b>${a.rank}</b></span>`,iconSize:[42,42],iconAnchor:[21,21]})}).addTo(map).bindTooltip(a.name,{direction:'top',offset:[0,-20]});
    const line=L.polyline([],{color:a.color,weight:3,opacity:.6,interactive:false}).addTo(map);
    marker.on('click',()=>select(a.id));
    const tether=L.polyline([],{color:a.color,weight:1.5,opacity:.8,interactive:false}).addTo(map);
    const anchor=L.circleMarker(marker.getLatLng(),{color:a.color,weight:2,radius:3,fillColor:'#fff',fillOpacity:1,interactive:false}).addTo(map);
    return {a,marker,line,tether,anchor,lastIndex:-1};
  });
  let time=finale.start,playing=false,selected=null,frame=0,last=0,lastPaint=0;
  const nikita=athletes.find(a=>a.id==='nikita-bez');
  const events=[
    [finale.start,f('Старт','Старт')],
    [athletes[0].splits.find(s=>s.toKm===15).end,f('Быстрый спуск','Бързо спускане')],
    [nikita.splits.find(s=>s.toKm===30).end,f('Никита впереди · 30 км','Никита води · 30 км')],
    [1789310593,f('Прокол · 31 км','Спукване · 31 км')],
    [athletes[0].end,f('Первый финиш','Първи финал')],
    [1789313778,f('Никита снова едет','Никита отново кара')],
    [finale.end,f('Все финиши','Всички финали')],
  ];
  q('.replay-events').innerHTML=events.map(([ts,label])=>`<button data-moment="${ts}">${label}</button>`).join('');
  q('.replay-events').querySelectorAll('button').forEach(b=>b.onclick=()=>{time=Number(b.dataset.moment);paint(true);});
  const statuses = {waiting:f('Ещё не началась запись','Записът още не е започнал'),gap:f('Пропуск GPS · последняя точка','GPS пропуск · последна точка'),riding:f('В движении / запись','Движение / запис')};
  function select(id) {
    selected=selected===id?null:id;
    q('#replay-riders').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.follow===selected)));
    for(const r of riders){r.line.setStyle({opacity:!selected||selected===r.a.id? .85:.17,weight:selected===r.a.id?5:3});r.marker.setZIndexOffset(selected===r.a.id?1000:0);r.marker.setOpacity(!selected||selected===r.a.id?1:.5);}
    paint(true);
  }
  q('#replay-riders').querySelectorAll('button').forEach(b=>b.onclick=()=>select(b.dataset.follow));
  document.querySelectorAll('[data-watch]').forEach(b=>b.onclick=()=>{if(selected===b.dataset.watch)selected=null;select(b.dataset.watch);time=finale.end;paint(true);q('#replay').scrollIntoView({behavior:'smooth'});});
  const radio=mountRaceRadio({map,finale,athletes,clock,f,pick,esc,seek:(at,id)=>{setPlaying(false);time=at;selected=null;select(id);}});
  function paint(force=false) {
    q('#replay-clock').textContent=clock(time);q('#replay-elapsed').textContent=formatTime(Math.round(time-finale.start));q('#replay-seek').value=Math.round(time);q('#replay-seek').setAttribute('aria-valuetext',clock(time));
    for(const r of riders){
      const state=positionAt(tracks[r.a.id],time),p=state.point;
      r.actual=L.latLng(p[1],p[2]);r.marker.setLatLng(r.actual);r.anchor.setLatLng(r.actual);r.tether.setLatLngs([]);
      r.marker.getElement()?.classList.toggle('gps-gap',state.state==='gap');
      const still=r.a.dwells.some(d=>time>=d.start&&time<=d.end);
      const label=state.state==='ended'?(r.a.complete?f('Финиш','Финал'):f('Конец сокращённой записи','Край на съкратения запис')):state.state==='gap'?statuses.gap:state.state==='waiting'?statuses.waiting:still?f('Остановка / почти без движения','Спиране / почти без движение'):num(p[4]/1000)+' '+f('км по записи','км по записа');
      q(`[data-live="${r.a.id}"]`).textContent=label;
      q(`[data-progress="${r.a.id}"]`).style.width=`${Math.min(100,p[4]/r.a.gpsDistanceM*100)}%`;
      if(force||state.index!==r.lastIndex){
        const partial=tracks[r.a.id].slice(0,state.index+1);if(state.state==='riding')partial.push(p);
        r.line.setLatLngs(trackSegments(partial));r.lastIndex=state.index;
      }
      if(selected===r.a.id&&q('#follow-camera').checked)map.panTo([p[1],p[2]],{animate:false});
    }
    spreadMarkers();
    radio.update(time,riders);
  }
  function spreadMarkers(){
    const groups=[];
    for(const rider of riders){const pixel=map.latLngToLayerPoint(rider.actual);let group=groups.find(g=>g.some(r=>map.latLngToLayerPoint(r.actual).distanceTo(pixel)<48));if(group)group.push(rider);else groups.push([rider]);}
    for(const group of groups)if(group.length>1){const radius=group.length>3?43:31;group.forEach((r,i)=>{const origin=map.latLngToLayerPoint(r.actual),angle=i*2*Math.PI/group.length-Math.PI/2;const displaced=map.layerPointToLatLng(L.point(origin.x+Math.cos(angle)*radius,origin.y+Math.sin(angle)*radius));r.marker.setLatLng(displaced);r.tether.setLatLngs([r.actual,displaced]);});}
  }
  map.on('zoomend',()=>{if(riders.every(r=>r.actual))spreadMarkers();});
  function setPlaying(value){playing=value;cancelAnimationFrame(frame);q('#replay-play').textContent=playing?'Ⅱ':'▶';q('#replay-play').setAttribute('aria-label',playing?f('Пауза','Пауза'):f('Воспроизвести','Пусни'));if(playing){if(time>=finale.end)time=finale.start;last=performance.now();frame=requestAnimationFrame(tick);}}
  function tick(now){if(!playing)return;time=Math.min(finale.end,time+(now-last)/1000*Number(q('#replay-speed').value));last=now;if(now-lastPaint>80){paint();lastPaint=now;}if(time>=finale.end){paint(true);setPlaying(false);}else frame=requestAnimationFrame(tick);}
  q('#replay-play').onclick=()=>setPlaying(!playing);
  q('#replay-reset').onclick=()=>{setPlaying(false);time=finale.start;paint(true);};
  q('#replay-seek').oninput=e=>{time=Number(e.target.value);paint(true);};
  document.addEventListener('visibilitychange',()=>{if(document.hidden)setPlaying(false);});
  paint(true);
}
