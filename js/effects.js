/* ================= FIGHT EFFECTS =================
   Breathing-style effects for the fight stage. Every character has a style for their Attack and, when it looks
   different, for their Special (Tanjiro: Water, then Sun for Hinokami Kagura). A style is a kanji impact mark, a colour
   (css: .sty-<name>) and a small SVG drawing that CSS animates (.draw, .burst, .flick…). No DOM. */
const STYLE_KANJI = {
  water:'水', flame:'炎', thunder:'雷', darkthunder:'雷', sun:'日', mist:'霞', wind:'風', stone:'岩', love:'恋', serpent:'蛇',
  sound:'音', insect:'蟲', beast:'獣', flower:'花', moon:'月', ice:'氷', blood:'血', compass:'拳', thread:'糸', drum:'鼓',
  claw:'爪', dream:'夢', slash:'斬',
};
// character (sk) → style, or {attack, special} when the special has its own look
const FIGHT_STYLE = {
  yoriichi:'sun', yoriichi_old:'sun', tanjiro:{attack:'water', special:'sun'}, giyu:'water', urokodaki:'water', sabito:'water',
  murata:'water', rengoku:'flame', zenitsu:'thunder', kaigaku:'darkthunder', muichiro:'mist', sanemi:'wind', gyomei:'stone',
  mitsuri:'love', obanai:'serpent', tengen:'sound', tengen_retired:'sound', shinobu:'insect', inosuke:'beast', kanao:'flower',
  genya:'claw', nezuko:'blood', tamayo:'blood', yushiro:'blood', kagaya:'slash',
  muzan:'blood', muzan_final:'blood', kokushibo:'moon', doma:'ice', akaza:'compass', gyutaro:'blood', gyokko:'water',
  hantengu:'claw', sekido:'thunder', karaku:'wind', aizetsu:'slash', urogi:'sound', enmu:'dream', rui:'thread', kyogai:'drum',
  hand:'claw', swamp:'claw',
  daki:'thread', nakime:'sound', zohakuten:{attack:'thunder', special:'beast'}, susamaru:'compass', yahaba:'wind', kanae:'flower',
  tanjiro_demon:'blood', nezuko_awakened:'blood', typezero:'slash',
};
const styleOf = (u, move) => { const s=FIGHT_STYLE[u.sk]||'slash'; return typeof s==='string' ? s : (s[move]||s.attack); };

const rep = (n, f) => Array.from({length:n}, (_,i)=>f(i)).join('');
// One drawing per style, in a 100×100 box centred on the fighter. Classes pick the animation (see style.css).
const FX_ART = {
  water: () => `<path class="draw" d="M4 70 Q30 6 56 42 T96 24"/><path class="draw d2" d="M8 86 Q38 34 62 60 T96 44"/>`
    + rep(4, i=>`<circle class="spray" cx="${52+i*8}" cy="${38+i*6}" r="3.5" style="--dx:${12+i*7}px;--dy:${-16+i*9}px"/>`),
  flame: () => rep(3, i=>`<path class="burst" style="--d:${i*.06}s" d="M${34+i*14} 78 C${22+i*14} 56 ${40+i*14} 46 ${32+i*14} ${22+(i%2)*12} C${50+i*14} 40 ${50+i*14} 60 ${42+i*14} 78 Z"/>`)
    + rep(6, i=>`<circle class="spray" cx="50" cy="56" r="2.5" style="--dx:${(i-2.5)*16}px;--dy:${-22-(i%3)*12}px"/>`),
  thunder: () => `<polyline class="flick" points="44,0 58,34 44,38 66,100"/><polyline class="flick f2" points="58,34 78,46 70,58"/>`,
  sun: () => `<circle class="spin" cx="50" cy="50" r="20"/>` + rep(8, i=>`<line class="spin" x1="50" y1="50" x2="${50+46*Math.cos(i*Math.PI/4)}" y2="${50+46*Math.sin(i*Math.PI/4)}" style="stroke-dasharray:0 26 30"/>`),
  mist: () => rep(3, i=>`<ellipse class="drift" style="--d:${i*.12}s" cx="${36+i*14}" cy="${40+i*10}" rx="22" ry="10"/>`),
  wind: () => rep(3, i=>`<path class="draw" style="animation-delay:${.26+i*.07}s,${.8+i*.07}s" d="M6 ${30+i*18} Q50 ${6+i*18} 94 ${36+i*16}"/>`),
  stone: () => rep(6, i=>`<polygon class="spray solid" points="${44+i*3},44 ${54+i*3},40 ${50+i*3},54" style="--dx:${(i-2.5)*18}px;--dy:${(i%2?-1:1)*(14+i*4)}px"/>`),
  love: () => `<path class="draw thick" d="M2 64 C24 20 46 92 70 40 S96 30 98 46"/><path class="draw thick d2" d="M4 80 C30 40 54 100 76 58 S96 52 98 64"/>`,
  serpent: () => `<path class="draw" d="M2 50 C14 26 26 26 38 50 S62 74 74 50 S94 30 98 44"/><circle class="spray" cx="96" cy="44" r="4" style="--dx:6px;--dy:-4px"/>`,
  sound: () => rep(3, i=>`<circle class="ringx" style="--d:${i*.12}s" cx="50" cy="50" r="${18+i*12}"/>`),
  insect: () => rep(3, i=>`<g class="flutter" style="--d:${i*.12}s;--dx:${(i-1)*26}px;--dy:${-30-i*8}px"><ellipse class="solid" cx="${42+i*8}" cy="${50+i*4}" rx="9" ry="6" transform="rotate(-30 ${42+i*8} ${50+i*4})"/><ellipse class="solid" cx="${52+i*8}" cy="${50+i*4}" rx="9" ry="6" transform="rotate(30 ${52+i*8} ${50+i*4})"/></g>`),
  beast: () => `<polyline class="draw" points="8,14 24,30 18,40 40,56 32,66 60,92"/><polyline class="draw d2" points="92,10 74,30 82,40 60,56 68,66 40,94"/>`,
  flower: () => rep(6, i=>`<ellipse class="spray solid" cx="50" cy="50" rx="7" ry="3.5" style="--dx:${36*Math.cos(i*Math.PI/3)}px;--dy:${36*Math.sin(i*Math.PI/3)}px" transform="rotate(${i*60} 50 50)"/>`),
  moon: () => rep(3, i=>`<path class="slice solid" style="--d:${i*.08}s" d="M${20+i*20} ${18+i*10} A30 30 0 1 0 ${44+i*20} ${70+i*6} A24 24 0 1 1 ${20+i*20} ${18+i*10} Z"/>`),
  ice: () => `<g class="spin">${rep(6, i=>{ const a=i*Math.PI/3, x=50+38*Math.cos(a), y=50+38*Math.sin(a); return `<line x1="50" y1="50" x2="${x}" y2="${y}"/><line x1="${50+24*Math.cos(a)}" y1="${50+24*Math.sin(a)}" x2="${50+24*Math.cos(a)+9*Math.cos(a+.9)}" y2="${50+24*Math.sin(a)+9*Math.sin(a+.9)}"/>`; })}</g>`
    + rep(4, i=>`<polygon class="spray solid" points="50,46 54,50 50,54 46,50" style="--dx:${(i%2?1:-1)*(20+i*6)}px;--dy:${(i<2?-1:1)*22}px"/>`),
  blood: () => rep(3, i=>`<path class="draw thick" style="animation-delay:${.24+i*.06}s,${.8+i*.06}s" d="M4 ${24+i*24} C32 ${4+i*24} 52 ${52+i*18} 96 ${30+i*20}"/>`),
  compass: () => `<g class="spin"><circle cx="50" cy="50" r="12"/>${rep(8, i=>`<line x1="50" y1="50" x2="${50+44*Math.cos(i*Math.PI/4)}" y2="${50+44*Math.sin(i*Math.PI/4)}"/>`)}</g>`,
  thread: () => rep(4, i=>`<line class="draw thin" style="animation-delay:${.24+i*.05}s,${.8+i*.05}s" x1="${i%2?96:4}" y1="${10+i*22}" x2="${i%2?4:96}" y2="${30+i*18}"/>`),
  drum: () => rep(3, i=>`<rect class="ringx" style="--d:${i*.12}s" x="${36-i*10}" y="${36-i*10}" width="${28+i*20}" height="${28+i*20}" rx="4"/>`),
  claw: () => rep(3, i=>`<line class="draw" style="animation-delay:${.24+i*.05}s,${.8+i*.05}s" x1="${22+i*16}" y1="10" x2="${42+i*16}" y2="90"/>`),
  dream: () => `<path class="draw" d="M50 50 m0 -6 a6 6 0 1 1 -6 6 a12 12 0 1 1 12 12 a18 18 0 1 1 -18 -18 a26 26 0 1 1 26 26"/>`,
  slash: () => `<line class="draw" x1="10" y1="16" x2="90" y2="84"/>`,
};
// Big moments for a few specials (CK): drawn over the whole screen on the special's first hit, keyed by character (sk).
// Akaza's is drawn under his target instead. Tengen's plays on every hit, like a drum.
const SPECIAL_FX = {zenitsu:'bolt', doma:'frost', muichiro:'mist', tengen:'drum', inosuke:'claws', tanjiro:'firering'};
const SFX_ART = {
  bolt: () => `<svg viewBox="0 0 100 40" preserveAspectRatio="none"><polyline class="b1" points="-2,12 18,20 30,8 46,24 60,10 76,26 102,14"/><polyline class="b2" points="-2,12 18,20 30,8 46,24 60,10 76,26 102,14"/></svg>`,
  frost: () => rep(4, i=>`<svg class="fc c${i}" viewBox="0 0 100 100"><polygon points="0,0 100,0 70,12 86,26 52,24 60,48 34,34 28,62 16,40 0,100"/></svg>`),
  mist: () => rep(5, i=>`<i style="--d:${i*.09}s;--y:${8+i*19}%"></i>`),
  drum: () => rep(3, i=>`<i style="--d:${i*.16}s"></i>`),
  claws: () => `<svg viewBox="0 0 100 100" preserveAspectRatio="none">${rep(3, i=>`<line class="c1" style="--d:${i*.05}s" x1="${8+i*24}" y1="-4" x2="${38+i*24}" y2="104"/>`)}${rep(3, i=>`<line class="c2" style="--d:${.26+i*.05}s" x1="${92-i*24}" y1="-4" x2="${62-i*24}" y2="104"/>`)}</svg>`,
  firering: () => `<span class="firering"><i></i><i></i><i></i></span>`,
};
const compassFx = () => `<svg class="compassfx" viewBox="0 0 100 100" aria-hidden="true"><g>${rep(8, i=>`<line x1="50" y1="50" x2="${50+48*Math.cos(i*Math.PI/4)}" y2="${50+48*Math.sin(i*Math.PI/4)}"/>`)}${rep(6, i=>`<polygon points="50,6 54,16 50,26 46,16" transform="rotate(${i*60} 50 50)"/>`)}<circle cx="50" cy="50" r="30"/><circle cx="50" cy="50" r="46"/></g></svg>`;
// The effect drawn over a fighter: style art plus the style's colour class
const fxArt = (style, extra='') => `<svg class="fxl sty-${style} ${extra}" viewBox="0 0 100 100" aria-hidden="true">${(FX_ART[style]||FX_ART.slash)()}</svg>`;
