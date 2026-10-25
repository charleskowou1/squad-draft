/* ================= VIEWS =================
   Each v*() returns the HTML for one screen. No DOM access here, so these can also be rendered in Node. */
const esc = s => String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const pc = p => p===0?'var(--p1)':'var(--p2)';
const nm = p => esc(S.names[p]);
const glyphCls = c => c.legend?'leg':c.mark?'mk':'';
const plural = (n,w) => `${n} ${w}${n===1?'':'s'}`;
// Character pictures found in img/ (filled in by app.js at startup): card id → file path
const ART = {};
// A character's seal: their picture if there is one, otherwise their kanji
const seal = (c, cls='') => `<span class="gl ${glyphCls(c)} ${cls}">${ART[c.id]?`<img src="${ART[c.id]}" alt="">`:c.g}</span>`;

/* ---------- shared pieces ---------- */
function topbar(eyebrow, title, quit=true){
  return `<header class="top"><div><div class="eyebrow">${eyebrow}</div><div class="title">${title}</div></div>
    ${quit?'<button class="btn ghost small" data-a="home">Quit</button>':''}</header>`;
}
const actionbar = inner => `<div class="actionbar"><div class="in">${inner}</div></div>`;
const statCells = c => `<span class="stats"><span><i>HP</i>${c.hp}</span><span><i>PWR</i>${c.pow}</span><span><i>SPD</i>${c.spd}</span><span><i>DEF</i>${c.def}</span></span>`;
// A battle log line for the screen: each fighter's picture before their name, damage in red (−17%),
// healing in green (+5%), other percents in bold. Engine lines tag health changes as [-17%] / [+5%].
function fmtLog(t){
  const byName={}; (S.teams?S.teams[0].concat(S.teams[1]):[]).forEach(u=>{ byName[esc(u.name)]=u; });
  const names=Object.keys(byName).sort((a,b)=>b.length-a.length).map(n=>n.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'));
  const re=new RegExp('\\[([+-])(\\d+%)\\]|(\\d+%)'+(names.length?'|('+names.join('|')+')':''),'g');
  return esc(t).replace(re,(m,sign,n,plain,name)=> sign ? `<b class="${sign==='-'?'dmg':'gain'}">${sign==='-'?'−':'+'}${n}</b>`
    : plain ? `<b>${plain}</b>` : `<span class="who">${seal(byName[name],'ls')}${name}</span>`);
}

// Name, percent and health bar. During round playback `o.hp` is the HP at that moment and `o.from` the HP a step earlier.
function health(u, o={}){
  const live=o.hp===undefined, hp=live?u.hp:o.hp, up=live?u.alive:hp>0;
  const h=up?pct(u,hp):0, low=up && h<=LOW ? ' low' : '';
  const from=o.from===undefined ? h : Math.max(0,pct(u,o.from));
  const bar=`<span class="bar${low}" role="img" aria-label="${h}% health"><i class="${from!==h?'drain':''}" style="width:${h}%;--from:${from}%"></i></span>`;
  const pctTag=`<span class="hp${low}">${up?h+'%':'KO'}</span>`;
  // simple tiles: name on its own line, percent beside the bar, so narrow tiles don't cut the name off
  if(o.simple) return `<span class="un"><span class="nm">${esc(u.name)}</span></span><span class="hprow">${bar}${pctTag}</span>`;
  return `<span class="un"><span class="nm">${esc(u.name)}</span>${pctTag}</span>
    ${bar}`;
}
const meta = u => `<div class="meta">PWR ${u.pow} · DEF ${u.def} · SPD ${u.spd}${u.regen?` · Regen ${pct(u,u.regen)}%`:''}</div>`;
function statusChips(u, showSpecial){
  if(!u.alive) return '';
  const out=[];
  if(u.legend) out.push(`<span class="chip s">Strikes ×${u.strikes} · takes max ${pct(u,u.cap)}%/round</span>`);
  if(u.grit) out.push('<span class="chip good">Somehow Survives</span>');
  if(u.defending) out.push('<span class="chip good">Guarding</span>');
  if(u.devoured) out.push(`<span class="chip bad">Wisteria −${pct(u,u.devoured)}%/round</span>`);
  if(u.sunburn) out.push('<span class="chip bad">Sunburned</span>');
  if(u.poison) out.push(`<span class="chip bad">Poison −${pct(u,u.poison.dmg)}% × ${u.poison.turns}</span>`);
  if(u.stun) out.push('<span class="chip bad">Stunned</span>');
  if(showSpecial) out.push(u.cd>0?`<span class="chip">Special in ${u.cd}</span>`:'<span class="chip s">Special ready</span>');
  return out.length?`<div class="chips">${out.join('')}</div>`:'';
}
const synChips = p => S.syn[p].length ? `<div class="chips">${S.syn[p].map(s=>s[0]==='!'?`<span class="chip bad">${esc(s.slice(1))}</span>`:`<span class="chip s">${esc(s)}</span>`).join('')}</div>` : '';

// Fighter tile: enemies, results and the end screen. `o` is the playback moment (see health()), plus o.flash.
// o.simple = just the picture, name and health (the opponent's team while you choose moves).
// o.tgtFor = uid of your fighter picking a target: the tile becomes a button that targets this enemy.
// o.picked = it's that fighter's current target; o.aimed = your fighters already aiming here.
function tile(u, o={}){
  if(o.hidden) return '';
  const playing=o.hp!==undefined, up=playing?o.hp>0:u.alive, tap=o.tgtFor && up;
  const cls=`tile${up?'':' dead'}${o.flash?' '+o.flash:''}${tap?' targetable':''}${o.picked?' picked':''}`;
  const aimed=o.aimed&&o.aimed.length?`<span class="aimed"><span>Aimed</span>${o.aimed.map(a=>seal(a,'pip')).join('')}<span class="sr">by ${o.aimed.map(a=>esc(a.name)).join(', ')}</span></span>`:'';
  const inner=`${seal(u)}<div class="tb">${health(u,o)}${aimed}${up&&!o.simple?meta(u)+(playing?'':statusChips(u,true)):''}</div>`;
  return tap ? `<button class="${cls}" style="--tc:${pc(u.p)}" data-a="tgt" data-u="${o.tgtFor}" data-v="${u.uid}" aria-pressed="${!!o.picked}">${inner}</button>`
    : `<div class="${cls}" style="--tc:${pc(u.p)}">${inner}</div>`;
}
// One bar split between both sides' remaining health (all fighters' HP ÷ all max HP), so you can see who's ahead.
// hpOf(u) = HP to count (playback passes the HP at that moment; undefined = not on the field yet).
function strengthBar(me, hpOf=u=>u.alive?u.hp:0){
  const side=p=>{ const us=S.teams[p].filter(u=>hpOf(u)!==undefined); const max=us.reduce((a,u)=>a+u.max,0); return max?us.reduce((a,u)=>a+Math.max(0,hpOf(u)),0)/max:0; };
  const a=side(me), b=side(1-me), share=a+b?a/(a+b)*100:50, solo=S.mode==='cpu'||S.phase==='plan';
  const name=p=>p===me&&solo?'You':p!==me&&solo?'Opponent':nm(p);
  return `<div class="strength" role="img" aria-label="${name(me)} ${Math.round(a*100)}% health, ${name(1-me)} ${Math.round(b*100)}%">
    <div class="sl"><span style="color:${pc(me)}">${name(me)} <b>${Math.round(a*100)}%</b></span><span style="color:${pc(1-me)}"><b>${Math.round(b*100)}%</b> ${name(1-me)}</span></div>
    <div class="sbar"><i style="width:${share}%;background:${pc(me)}"></i><i style="flex:1;background:${pc(1-me)}"></i></div></div>`;
}
const vsDivider = () => '<div class="vsdiv" aria-hidden="true"><span>VS</span></div>';
function teamBlock(p, label, moment, simple, hint){
  const os=S.teams[p].map(u=>Object.assign(moment?moment(u):{}, simple?{simple:true}:{})), shown=S.teams[p].filter((u,i)=>!os[i].hidden);
  const up=S.teams[p].filter((u,i)=>!os[i].hidden && (os[i].hp===undefined?u.alive:os[i].hp>0)).length;
  return `<section class="side"><div class="sidehead"><span class="tname" style="color:${pc(p)}">${label||nm(p)}</span>
    ${hint?`<span class="taphint">${hint}</span>`:`<span class="muted">${up} of ${shown.length} standing</span>`}</div>
    ${simple?'':synChips(p)}<div class="tiles${simple?' simple':''}">${S.teams[p].map((u,i)=>tile(u,os[i])).join('')}</div></section>`;
}

/* ---------- setup ---------- */
function recordsPanel(){
  const rec=loadRecords();
  const rows=Object.entries(rec).filter(([id])=>BYID[id]).map(([id,[g,w]])=>({c:BYID[id],g,w,r:Math.round(w/g*100)}))
    .sort((a,b)=>b.r-a.r||b.g-a.g);
  if(!rows.length) return '';
  return `<details class="panel records" id="records"><summary>Character records <span class="muted">· ${plural(rows.length,'character')} played</span></summary>
    <div class="recs"><div class="rec head"><span></span><span>Character</span><span>Win rate</span><span>Won</span></div>
    ${rows.map(x=>`<div class="rec">${seal(x.c,'sm')}<span class="rn">${esc(x.c.short)}</span>
      <span class="rbar"><i style="width:${x.r}%"></i><b>${x.r}%</b></span><span class="rw">${x.w} of ${x.g}</span></div>`).join('')}</div></details>`;
}
function vSetup(){
  const sc = loadScore();
  const seg=(k,v,l)=>`<button data-a="${k}" data-v="${v}" class="${S[k]===v?'on':''}">${l}</button>`;
  return `
  <div class="hero"><span class="kanji" aria-hidden="true">滅</span>
    <div class="eyebrow">A Demon Slayer squad battler</div><h1>Squad Draft</h1>
    <p class="muted">Draft a squad on 20 points. Pick secret moves each round. Last team standing wins.</p></div>
  <div class="panel">
    <div class="seg">${seg('mode','2p','2 players, one phone')}${seg('mode','cpu','Vs computer')}</div>
    <div class="row">
      <label for="n0">Player 1<input id="n0" type="text" maxlength="14" value="${esc(S.names[0])}"></label>
      <label for="n1">${S.mode==='cpu'?'Opponent':'Player 2'}<input id="n1" type="text" maxlength="14" value="${esc(S.mode==='cpu'?'Muzan AI':S.names[1])}" ${S.mode==='cpu'?'disabled':''}></label>
    </div>
    ${S.mode==='cpu'?`<div class="levelpick"><span class="tlabel">Muzan AI difficulty</span><div class="seg">${Object.entries(LEVELS).map(([k,l])=>`<button data-a="level" data-v="${k}" class="${S.level===k?'on':''}">${l.label}</button>`).join('')}</div>
      <span class="hint">${{easy:'Picks moves almost at random. Good for learning the cards.',normal:'Plays sensibly but makes mistakes.',hard:'Goes for knockouts, spreads damage and saves its specials.'}[S.level]}</span></div>`:''}
    <button class="btn" data-a="start">Start the draft</button>
  </div>
  <div class="panel"><div class="eyebrow">All-time wins on this phone</div>
    <div class="score">${Object.keys(sc).length ? Object.entries(sc).sort((a,b)=>b[1]-a[1]).slice(0,3).map(([k,v])=>`<div><b>${v}</b>${esc(k)}</div>`).join('') : '<div class="muted">No matches yet</div>'}</div>
  </div>
  ${recordsPanel()}
  <details class="panel" id="howto"><summary>How to play</summary><ul>
    <li><b>The pool:</b> each draft deals 10 random characters, one version of each (base, Mark-awakened, or Yoriichi young or old). Every card shows its cost and stats before you pick.</li>
    <li><b>Draft:</b> a wheel decides who picks first, then snake order (A, B, B, A, A, B…) on a 20-point budget, up to 6 fighters. Tap <b>Lock team</b> when you're done; the other player keeps drafting until they lock or run out of points.</li>
    <li><b>Pool notes</b> list the synergies and matchups possible with the characters dealt.</li>
    <li><b>Legends:</b> Yoriichi (18) and Yoriichi at 85 (15) strike twice per Attack and cap the damage they take each round. They're rare: Yoriichi is dealt in about 1 draft in 8.</li>
    <li><b>Hantengu</b> splits when knocked out: into Sekido and Karaku, who become Aizetsu and Urogi when they fall. Beat all five.</li>
    <li><b>Marks ✦:</b> cost more, hit harder and recharge their special a round faster.</li>
    <li><b>Each round</b> every fighter secretly picks Attack, Defend (half damage) or their Special. Fastest goes first.</li>
    <li><b>Health</b> is shown as a percent of each fighter's own max. It turns red at 25%.</li>
    <li><b>Damage</b> = PWR − target's DEF, but never less than half the attacker's power. Demons regenerate; poison ticks.</li>
    <li><b>Synergies:</b> Kamaboko Squad +2 SPD · Siblings counter · 2+ Hashira +1 PWR · 2+ Upper Moons +1 regen · Muzan's Blood +1 PWR · 2+ Marks +1 SPD · Tamayo + Yushiro: Yushiro +2 PWR · Yoriichi + Tanjiro: Tanjiro +2 PWR · Urokodaki: Tanjiro and Giyu +1 DEF · Kagaya: Hashira +1 DEF. Facing Yoriichi, Muzan loses 3 PWR and Kokushibo 1 DEF. Facing Tamayo, Muzan regenerates 2 less. Facing Kaigaku, Zenitsu gets +2 PWR.</li>
    <li><b>Vs computer:</b> choose Easy, Normal or Hard before the draft.</li>
  </ul></details>`;
}

/* ---------- who picks first ---------- */
function vSpin(){
  const sp=S.spin, done=sp&&sp.state==='done', R=96, seg=360/WHEEL_SEGS;
  const pt=(a,r)=>{ const t=a*Math.PI/180; return `${(100+r*Math.sin(t)).toFixed(2)} ${(100-r*Math.cos(t)).toFixed(2)}`; };
  const slices=Array.from({length:WHEEL_SEGS},(_,i)=>{ const p=i%2, a0=i*seg, a1=a0+seg;
    return `<path d="M100 100 L${pt(a0,R)} A${R} ${R} 0 0 1 ${pt(a1,R)} Z" style="fill:${pc(p)}"/>
      <text x="100" y="40" transform="rotate(${a0+seg/2} 100 100)">${esc(S.names[p].slice(0,8))}</text>`; }).join('');
  const wheel=`<div class="wheelbox"><span class="pointer" aria-hidden="true"></span>
    <svg class="wheel" viewBox="0 0 200 200" style="transform:rotate(${done?sp.angle:0}deg)" role="img" aria-label="Wheel with ${nm(0)} and ${nm(1)}">
      <circle cx="100" cy="100" r="99" class="rim"/>${slices}</svg>
    <button class="hubbtn${sp?'':' ready'}" data-a="spin" ${sp?'disabled':''} aria-label="Spin the wheel">滅</button></div>`;
  const status = done
    ? `<div class="spinres" style="color:${pc(sp.r)}">${nm(sp.r)} picks first</div>${actionbar(`<button class="btn team" data-a="toDraft" style="--bc:${pc(sp.r)}">Start the draft</button>`)}`
    : `<div class="spinhint">${sp?'Spinning…':'Tap the 滅 seal to spin'}</div>`;
  return `${topbar('Before the draft', 'Who picks first?')}<div class="spin">${wheel}${status}</div>`;
}

/* ---------- draft ---------- */
function cardHTML(c,p){
  const owner=S.picks[0].includes(c.id)?0:S.picks[1].includes(c.id)?1:-1;
  const ok = canPick(p,c.id);
  const badge = c.legend?'Legend':c.mark?'✦ Mark':'';
  return `<button class="card ${glyphCls(c)}${ok?'':' off'}${S.sel===c.id?' sel':''}" data-a="sel" data-v="${c.id}" ${ok?'':'aria-disabled="true"'}>
    <span class="cost${c.cost>=12?' big':''}">${c.cost}<small>pts</small></span>${ART[c.id]?`<span class="g art"><img src="${ART[c.id]}" alt=""></span>`:`<span class="g">${c.g}</span>`}
    ${badge?`<span class="badge">${badge}</span>`:''}<span class="cn">${esc(c.name)}</span><span class="ct">${esc(c.type)}</span>
    ${statCells(c)}${owner>=0?`<span class="tag" style="background:${pc(owner)}">${nm(owner)}</span>`:''}</button>`;
}
function teamBox(q,p){
  const left=BUDGET-spent(q);
  return `<div class="tbox${p===q&&!S.locked[q]?' active':''}" style="--tc:${pc(q)}">
    <div class="tn"><span>${nm(q)}</span><span>${S.locked[q]?'Locked':left+' pts left'}</span></div>
    <div class="meter" role="img" aria-label="${spent(q)} of ${BUDGET} points spent"><i style="width:${spent(q)/BUDGET*100}%"></i></div>
    <div class="slots">${S.picks[q].map(id=>seal(BYID[id],'xs')).join('')}${!S.locked[q]&&S.picks[q].length<MAXTEAM?'<span class="slot empty"></span>':''}</div></div>`;
}
function vDraft(){
  const p = turn(), cpuTurn = S.mode==='cpu' && p===1;
  const fresh = !S.picks[0].length && !S.picks[1].length, left=BUDGET-spent(p);
  // second pick in a row (snake order), or the other player has locked and this one keeps going
  const again = S.lastPicker===p && !S.locked[1-p];
  const verb = S.locked[1-p] && S.picks[1-p].length ? 'keeps picking' : again ? 'picks again' : cpuTurn ? 'is picking' : 'picks';
  const lockbar = !cpuTurn && S.picks[p].length ? `<div class="lockbar"><span>Done picking?${left?` ${left} pts go unused.`:''}</span>
    <button class="btn team small" data-a="lock" style="--bc:${pc(p)}">Lock team</button></div>` : '';
  return `<div class="draftlayout"><div class="dtop">
    ${topbar('Draft', `<span style="color:${pc(p)}">${nm(p)}</span> ${verb}${cpuTurn?'…':''}`)}
    ${orderStrip(p)}
    <div class="teams">${teamBox(0,p)}${teamBox(1,p)}</div>
    ${lockbar}
    <div class="dealt"><span>${POOL_SIZE} characters dealt · tap one to see it</span>${fresh&&!cpuTurn?'<button class="btn ghost small" data-a="redeal">Re-deal</button>':''}</div></div>
    ${notesPanel()}
    <div class="grid">${S.pool.map(id=>cardHTML(BYID[id],p)).join('')}</div></div>`;
}
// Who picks next: the current pick and the next few, so a double pick is never a surprise
function orderStrip(p){
  if(S.locked[0]||S.locked[1]) return '';
  return `<div class="order" aria-label="Pick order"><span class="tlabel">Pick order</span>${pickOrder(6).map((q,i)=>`<span class="op${i===0?' cur':''}" style="--tc:${pc(q)}">${i===0?'Now: ':''}${nm(q)}</span>`).join('<span class="oarrow" aria-hidden="true">›</span>')}</div>`;
}
// Synergies and matchups possible in this deal. Folds away on phones; always open beside the cards on wide screens.
function notesPanel(){
  const notes=poolNotes();
  if(!notes.length) return '';
  const live=notes.filter(n=>n.state!=='off').length;
  return `<aside class="notes${S.notesOpen?' open':''}">
    <button class="nhead" data-a="notes" aria-expanded="${!!S.notesOpen}"><span class="ntitle">Pool notes</span>
      <span class="muted">${live===1?'1 synergy or matchup':`${live} synergies and matchups`} in this deal</span><span class="chev" aria-hidden="true">▾</span></button>
    <div class="nbody">${notes.map(n=>noteHTML(n)).join('')}</div></aside>`;
}
// One note. `self` = the card being viewed, left out of the name chips.
function noteHTML(n, self){
  const status = n.state==='on' ? (n.kind==='team' ? `<span class="nst" style="color:${pc(n.p)}">${nm(n.p)} has it</span>` : '<span class="nst live">In play</span>')
    : n.state==='off' ? '<span class="nst">No longer possible</span>' : '';
  const who=n.ids.filter(id=>id!==self);
  return `<div class="note ${n.state}"><div class="nh"><span class="nk ${n.kind}">${n.kind==='team'?'Same team':'Opponents'}</span>${status}</div>
    <div class="nt">${esc(n.title)}</div><div class="nx">${esc(n.text)}</div>
    ${who.length?`<div class="nwho">${self?'<span class="tlabel">With</span>':''}${who.map(id=>`<button class="nc" data-a="sel" data-v="${id}">${seal(BYID[id],'sm')}${esc(BYID[id].short)}</button>`).join('')}</div>`:''}</div>`;
}
// Hantengu's split forms, shown on his card: each form and what it becomes when it falls
function splitTree(c){
  const form=id=>{ const f=BYID[id]; return `<div class="sform">${seal(f,'sm')}<div><b>${esc(f.short)}</b> <span class="muted">${f.hp} HP · PWR ${f.pow} · SPD ${f.spd}</span><br><span class="sx">${esc(f.sig.name)}: ${esc(f.sig.desc)}</span>${f.splits?`<div class="sthen">falls → ${f.splits.map(k=>esc(BYID[k].short)).join(', ')}</div>`:''}</div></div>`; };
  const all=[]; const walk=id=>{ (BYID[id].splits||[]).forEach(k=>{ all.push(k); }); (BYID[id].splits||[]).forEach(walk); }; walk(c.id);
  return `<div class="splits"><div class="tlabel">Splits into</div>${all.map(form).join('')}</div>`;
}
// Card detail, centred on screen, when a card is tapped during the draft
function vSheet(){
  if(S.phase!=='draft' || !S.sel) return '';
  const c=BYID[S.sel], p=turn(), ok=canPick(p,c.id);
  const pas=[c.passive, c.mark?MARK_PASSIVE:''].filter(Boolean);
  const notes=poolNotes().filter(n=>n.ids.includes(c.id));
  const rec=loadRecords()[c.id];
  return `<div class="scrim" data-a="unsel"></div><div class="modal"><div class="in ${glyphCls(c)}" role="dialog" aria-modal="true" aria-label="${esc(c.name)}">
    <button class="x" data-a="unsel" aria-label="Close">×</button>
    <div class="shead">${seal(c,'lg')}
      <div><div class="eyebrow">${esc(c.type)}</div><h2>${esc(c.name)}</h2></div><span class="cost${c.cost>=12?' big':''}">${c.cost}<small>pts</small></span></div>
    ${statCells(c)}
    <div class="sig"><div class="sname">${esc(c.sig.name)} <span class="muted">· special, cooldown ${c.sig.cd}</span></div>${esc(c.sig.desc)}</div>
    ${c.regen?`<div class="pas">Regenerates ${c.regen} HP every round.</div>`:''}
    ${pas.map(x=>`<div class="pas">${esc(x)}</div>`).join('')}
    ${c.splits?splitTree(c):''}
    <div class="recline">${rec?`On this phone: won <b>${rec[1]} of ${plural(rec[0],'game')}</b> (${Math.round(rec[1]/rec[0]*100)}%)`:'Not played on this phone yet'}</div>
    ${notes.length?`<div class="mnotes"><div class="tlabel">Notes for ${esc(c.short)} in this deal</div>${notes.map(n=>noteHTML(n,c.id)).join('')}</div>`:''}
    <div class="row"><button class="btn ghost" data-a="unsel">Close</button>${ok?`<button class="btn team" data-a="confirmPick" style="--bc:${pc(p)}">Confirm ${esc(c.short)}</button>`:''}</div>
  </div></div>`;
}

/* ---------- planning ---------- */
// Which of the player's fighters is open: the one they tapped, else the first without a move
function focusOf(p){
  if(S.focus==='none') return null;
  const a=alive(p).filter(u=>!u.stun);
  if(S.focus && a.some(u=>u.uid===S.focus)) return S.focus;
  const n=a.find(u=>!unitReady(u)); return n?n.uid:null;
}
function moveSummary(u){
  if(u.stun) return 'Stunned · skips this round';
  const pl=S.plans[u.p][u.uid];
  if(!pl||!pl.type) return 'Choose a move';
  const name = pl.type==='attack'?'Attack':pl.type==='defend'?'Defend':esc(u.sig.name);
  if(!needsTarget(u,pl)) return name;
  const t=pl.t&&findU(pl.t);
  return t ? `${name} → ${esc(t.name)}` : `${name} · pick a target`;
}
function fighter(u, open){
  const ready=unitReady(u), pl=S.plans[u.p][u.uid]||{};
  const head=`<button class="fhead" data-a="focus" data-v="${u.uid}" aria-expanded="${open}" ${u.stun?'disabled':''}>
    ${seal(u)}<span class="tb">${health(u)}<span class="sum${ready?' ok':''}">${ready&&!u.stun?'✓ ':''}${moveSummary(u)}</span></span></button>`;
  if(!open) return `<div class="fighter" style="--tc:${pc(u.p)}">${head}</div>`;
  const mv=(v,k,label,sub,dis)=>`<button data-a="act" data-u="${u.uid}" data-v="${v}" class="${pl.type===v?'on':''}" ${dis?'disabled':''}><span class="mk" aria-hidden="true">${k}</span>${label}<small>${sub}</small></button>`;
  const opts=targetOptions(u,pl);
  const tgt=x=>`<button class="tg${x.p===u.p?' ally':''}${pl.t===x.uid?' on':''}" data-a="tgt" data-u="${u.uid}" data-v="${x.uid}">
    ${seal(x,'sm')}${esc(x.name)}<span class="${pct(x)<=LOW?'lo':''}">${pct(x)}%</span></button>`;
  return `<div class="fighter open" style="--tc:${pc(u.p)}">${head}<div class="fbody">
    ${meta(u)}${statusChips(u,false)}
    <div class="moves">${mv('attack','攻','Attack',u.strikes>1?'hits ×'+u.strikes:'hit one enemy')}${mv('defend','守','Defend','half damage')}${mv('special','技',`<span class="spn">${esc(u.sig.name.split(':')[0])}</span>`,u.cd>0?`ready in ${u.cd}`:'ready',u.cd>0)}</div>
    ${pl.type==='special'?`<div class="hint"><b>${esc(u.sig.name)}.</b> ${esc(u.sig.desc)}</div>`:''}
    ${opts.length?`<div class="tlabel">${isAllyMove(u,pl)?'Choose an ally':'Choose a target, or tap one above'}</div><div class="targets">${opts.map(tgt).join('')}</div>`:''}
  </div></div>`;
}
function vPass(){
  const p=S.planFor;
  return `<div class="pass"><div class="eyebrow">Round ${S.round}</div>
    <div class="big" style="color:${pc(p)}">Hand the phone to ${nm(p)}</div>
    <p class="muted">${nm(1-p)}, no peeking at their moves.</p>
    <button class="btn team" data-a="reveal" style="--bc:${pc(p)}">I'm ${nm(p)}. Show my team</button></div>`;
}
function vPlan(){
  const p=S.planFor, open=focusOf(p), ready=planReady(p), mine=alive(p);
  // the open fighter needs an enemy target: opponents become tappable
  const ou=open&&findU(open), opl=ou&&S.plans[p][ou.uid]||{}, picking=ou && needsTarget(ou,opl) && !isAllyMove(ou,opl);
  const aimers=e=>mine.filter(m=>{ const q=S.plans[p][m.uid]; return q && q.t===e.uid && needsTarget(m,q) && !isAllyMove(m,q); });
  const enemyMoment=e=>({aimed:aimers(e), ...(picking?{tgtFor:ou.uid, picked:opl.t===e.uid}:{})});
  return `${topbar(`Round ${S.round} · secret moves`, `<span style="color:${pc(p)}">${nm(p)}</span>, choose`)}
    ${strengthBar(p)}
    ${teamBlock(1-p,'Opponent',enemyMoment,true,picking?`Tap to target with ${esc(ou.name)}`:'')}
    ${vsDivider()}
    <section class="side"><div class="sidehead"><span class="tname" style="color:${pc(p)}">Your team</span><span class="muted">Tap a fighter to change</span></div>
      ${synChips(p)}<div class="fighters">${S.teams[p].map(u=>u.alive?fighter(u,u.uid===open):tile(u)).join('')}</div></section>
    ${actionbar(`<button class="btn team" data-a="lockMoves" ${ready?'':'disabled'} style="--bc:${pc(p)}">${ready?'Lock in moves':`${mine.filter(unitReady).length} of ${plural(mine.length,'fighter')} ready`}</button>`)}`;
}

/* ---------- results ---------- */
const logHTML = () => `<div class="log">${S.log.filter(l=>l.c!=='r').map(l=>`<div class="${l.c}">${fmtLog(l.t)}</div>`).join('')}</div>`;
// The round plays back one log line at a time (S.play.k = the line being shown); tiles show HP at that moment
function vResult(){
  const done=!S.play||S.play.done, k=done?S.log.length-1:S.play.k, cur=S.log[k], prev=S.log[Math.max(0,k-1)];
  // the fighter acting on this line: the one whose name starts it
  const actor=done?null:S.teams[0].concat(S.teams[1]).filter(u=>cur.t.startsWith(u.name)).sort((a,b)=>b.name.length-a.name.length)[0];
  const moment = u => done ? {} : cur.hp[u.uid]===undefined ? {hidden:true} : {hp:cur.hp[u.uid], from:prev.hp[u.uid]??cur.hp[u.uid],
    flash: cur.ko===u.uid ? 'ko' : prev.hp[u.uid]===undefined ? 'spawn' : cur.hp[u.uid]<prev.hp[u.uid] ? 'hit' : cur.hp[u.uid]>prev.hp[u.uid] ? 'heal' : actor===u ? 'acting' : ''};
  const step=S.log.slice(1,k+1).length, total=S.log.length-1;
  // vs computer the screen is yours, so label the teams from your side; two players share it, so keep names
  const vsCpu=S.mode==='cpu';
  const next = S.final ? '<button class="btn" data-a="finish">See who won</button>' : '<button class="btn" data-a="next">Next round</button>';
  return `${topbar(`Round ${S.round}${done?'':` · ${step} of ${total}`}`, done?'What happened':'The clash', false)}
    ${strengthBar(0, done?undefined:u=>cur.hp[u.uid])}
    ${teamBlock(1,vsCpu?'Opponent':null,moment)}
    ${done?vsDivider():`<div class="now ${cur.c}" aria-live="polite"><span>${k?fmtLog(cur.t):'…'}</span></div>`}
    ${teamBlock(0,vsCpu?'Your team':null,moment)}
    ${done?`<div class="panel"><div class="tlabel">Round log</div>${logHTML()}</div>`:''}
    ${actionbar(done ? next : '<button class="btn ghost" data-a="skip">Skip</button>')}`;
}
function vOver(){
  const w=S.winner;
  return `<div class="win"><div class="eyebrow">After ${plural(S.round,'round')}</div>
    <div class="big" style="color:${w<0?'var(--fg)':pc(w)}">${w<0?'Both squads fall':nm(w)+' wins'}</div>
    <p class="muted">${w<0?'Nobody is left standing at dawn.':'Win and character records saved on this phone.'}</p></div>
    ${teamBlock(0)}${teamBlock(1)}
    <details class="panel" id="finallog"><summary>Final round</summary>${logHTML()}</details>
    ${actionbar('<button class="btn ghost" data-a="home">Main menu</button><button class="btn" data-a="rematch">Rematch</button>')}`;
}
