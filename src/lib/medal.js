// Shared artwork for the live award and PNG export. No random geometry or external SVG assets.
export function medalPalette(place) {
  return ({1:['#fff3b8','#eac163','#a06b24','#684214'],2:['#f4fbff','#b6cbd9','#687e91','#334a5d'],3:['#ffe2c6','#dc9e70','#935330','#582d1c'],4:['#e5f9d5','#a9c3ad','#546f62','#2b453a']})[place] || ['#e5f9d5','#a9c3ad','#546f62','#2b453a'];
}
const xml=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const polygon=(cx,cy,r,n=12)=>Array.from({length:n},(_,i)=>{const a=(i/n*2-0.5)*Math.PI;return `${(cx+Math.cos(a)*r).toFixed(2)},${(cy+Math.sin(a)*r).toFixed(2)}`;}).join(' ');
export function medalSvg({place,color,avatar,prefix='medal',label='МЕСТО'}) {
  const [light,metal,dark,edge]=medalPalette(place),id=xml(prefix),href=xml(avatar),accent=xml(color);
  const ticks=Array.from({length:72},(_,i)=>`<path d="M300 151v${i%6===0?10:4}" transform="rotate(${i*5} 300 368)"/>`).join('');
  const laurels=Array.from({length:7},(_,i)=>`<ellipse cx="${157+i*6}" cy="${375+i*12}" rx="4" ry="10" transform="rotate(${-35-i*4} ${157+i*6} ${375+i*12})"/><ellipse cx="${443-i*6}" cy="${375+i*12}" rx="4" ry="10" transform="rotate(${35+i*4} ${443-i*6} ${375+i*12})"/>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 600 650" width="600" height="650" aria-hidden="true">
  <defs>
    <linearGradient id="${id}-metal" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${light}"/><stop offset=".18" stop-color="${metal}"/><stop offset=".34" stop-color="${light}"/><stop offset=".51" stop-color="${dark}"/><stop offset=".69" stop-color="${metal}"/><stop offset=".84" stop-color="${light}"/><stop offset="1" stop-color="${dark}"/></linearGradient>
    <linearGradient id="${id}-edge" x2=".3" y2="1"><stop stop-color="${light}"/><stop offset=".45" stop-color="${dark}"/><stop offset="1" stop-color="${edge}"/></linearGradient>
    <linearGradient id="${id}-enamel" x2=".7" y2="1"><stop stop-color="#314138"/><stop offset=".5" stop-color="#121e19"/><stop offset="1" stop-color="#07140f"/></linearGradient>
    <linearGradient id="${id}-ribbon"><stop stop-color="#000" stop-opacity=".35"/><stop offset=".35" stop-color="#fff" stop-opacity=".12"/><stop offset=".65" stop-color="#fff" stop-opacity=".04"/><stop offset="1" stop-color="#000" stop-opacity=".3"/></linearGradient>
    <pattern id="${id}-weave" width="5" height="4" patternUnits="userSpaceOnUse"><path d="M0 1h5M1 0v4" stroke="#fff" stroke-opacity=".13" stroke-width=".5"/></pattern>
    <pattern id="${id}-check" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M0 0h10v10H0zM10 10h10v10H10z" fill="#f6f2de"/><path d="M10 0h10v10H10zM0 10h10v10H0z" fill="#17251e"/></pattern>
    <clipPath id="${id}-portrait"><circle cx="277" cy="331" r="101"/></clipPath>
    <clipPath id="${id}-coin"><polygon points="${polygon(300,368,220)}"/></clipPath>
    <path id="${id}-arc" d="M139 369 A161 161 0 0 1 461 369"/>
  </defs>
  <ellipse cx="302" cy="620" rx="158" ry="15" fill="#000" opacity=".25"/>
  <g transform="rotate(-24 256 153)"><path d="M213 7h86v229l-43 24-43-24z" fill="${accent}"/><path d="M213 7h86v229l-43 24-43-24z" fill="url(#${id}-ribbon)"/><path d="M218 9v224M294 9v224" stroke="${light}" stroke-opacity=".65" stroke-dasharray="2 3"/><path d="M221 9h70v222h-70z" fill="url(#${id}-weave)"/><rect x="232" y="19" width="20" height="128" fill="url(#${id}-check)"/></g>
  <g transform="rotate(24 344 153)"><path d="M301 7h86v229l-43 24-43-24z" fill="${accent}"/><path d="M301 7h86v229l-43 24-43-24z" fill="url(#${id}-ribbon)"/><path d="M306 9v224M382 9v224" stroke="${light}" stroke-opacity=".65" stroke-dasharray="2 3"/><path d="M309 9h70v222h-70z" fill="url(#${id}-weave)"/><text x="358" y="94" fill="#fff" fill-opacity=".82" font-family="Arial,sans-serif" font-size="16" font-weight="900" letter-spacing="3" transform="rotate(90 358 94)">VLC / 26</text></g>
  <rect x="271" y="109" width="58" height="63" rx="15" fill="none" stroke="${edge}" stroke-width="15"/><rect x="271" y="106" width="58" height="63" rx="15" fill="none" stroke="url(#${id}-metal)" stroke-width="9"/>
  <polygon points="${polygon(300,379,232)}" fill="${edge}"/>
  <polygon points="${polygon(300,368,232)}" fill="url(#${id}-edge)" stroke="${light}" stroke-width="1.5"/>
  <polygon points="${polygon(300,368,222)}" fill="url(#${id}-metal)" stroke="${edge}" stroke-width="2"/>
  <g stroke="${edge}" stroke-width="1.4" opacity=".68">${ticks}</g>
  <circle cx="300" cy="368" r="195" fill="none" stroke="${light}" stroke-width="1.5"/><circle cx="300" cy="368" r="186" fill="url(#${id}-enamel)" stroke="${edge}" stroke-width="5"/><circle cx="300" cy="368" r="180" fill="none" stroke="${metal}" stroke-width="1" opacity=".6"/>
  <g clip-path="url(#${id}-coin)" stroke="${metal}" stroke-width=".6" opacity=".11">${[0,1,2,3,4,5].map(i=>`<path d="M${70+i*35} 559Q${155+i*32} 372 ${455+i*35} 305" fill="none"/>`).join('')}</g>
  <text fill="${light}" font-family="Arial,sans-serif" font-size="12" font-weight="700" letter-spacing="4"><textPath xlink:href="#${id}-arc" startOffset="50%" text-anchor="middle">VARNA · LOCAL CUP</textPath></text>
  <g fill="${metal}" opacity=".65">${laurels}</g>
  <circle cx="277" cy="335" r="108" fill="#000" opacity=".4"/><circle cx="277" cy="331" r="107" fill="url(#${id}-metal)"/>
  <image x="176" y="230" width="202" height="202" xlink:href="${href}" clip-path="url(#${id}-portrait)" preserveAspectRatio="xMidYMid slice"/>
  <g transform="translate(0 3)"><text x="367" y="462" text-anchor="middle" font-family="Arial,sans-serif" font-size="177" font-weight="900" fill="${edge}" stroke="#0c1812" stroke-width="15" paint-order="stroke">${place}</text></g>
  <text x="364" y="457" text-anchor="middle" font-family="Arial,sans-serif" font-size="177" font-weight="900" fill="url(#${id}-metal)" stroke="${light}" stroke-width="1" paint-order="stroke">${place}</text>
  <path d="M210 490h180" stroke="${metal}" stroke-width=".7" opacity=".5"/>
  <text x="300" y="515" text-anchor="middle" font-family="Arial,sans-serif" font-size="13" font-weight="700" fill="${light}" letter-spacing="5">${xml(label)}</text>
  <text x="300" y="540" text-anchor="middle" font-family="Arial,sans-serif" font-size="10" fill="${metal}" letter-spacing="3">13 · 09 · 2026</text>
  <path d="M294 560l6-5 6 5-6 5z" fill="${light}"/>
  <g fill="${light}"><path d="M128 224l2-12 3 12 11 3-11 2-3 12-2-12-12-2z"/><path d="M476 474l1.5-9 2 9 9 2-9 2-2 9-1.5-9-9-2z"/></g>
  </svg>`;
}
