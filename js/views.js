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
// In battle, a fighter's picture is a button that opens their info card (stats, special, passive, status)
const sealBtn = (u, cls='') => `<button class="sealbtn" data-a="info" data-v="${u.uid}" aria-label="About ${esc(u.name)}">${seal(u,cls)}</button>`;
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
  const aimed=o.aimed&&o.aimed.length?`<span class="aimed"><span class="aimx" aria-hidden="true">◎</span>${o.aimed.map(a=>seal(a,'pip')).join('')}<span class="sr">by ${o.aimed.map(a=>esc(a.name)).join(', ')}</span></span>`:'';
  const body=`<div class="tb">${health(u,o)}${aimed}${up&&!o.simple?meta(u)+(playing?'':statusChips(u,true)):''}</div>`;
  // the picture opens the info card; when targeting, the rest of the tile is the target button
  const main = tap ? `<button class="tilebtn" data-a="tgt" data-u="${o.tgtFor}" data-v="${u.uid}" aria-pressed="${!!o.picked}" aria-label="Target ${esc(u.name)}">${body}</button>` : body;
  const art=ART[u.id]?`;--art:url('${ART[u.id]}')`:'';
  return `<div class="${cls}${art?' hasart':''}" style="--tc:${pc(u.p)};--i:${o.i||0}${art}">${sealBtn(u)}${main}</div>`;
}
// One bar split between both sides' remaining health (all fighters' HP ÷ all max HP), so you can see who's ahead.
// hpOf(u) = HP to count (playback passes the HP at that moment; undefined = not on the field yet).
function strengthBar(me, hpOf=u=>u.alive?u.hp:0, prevOf){
  const sideOf=f=>p=>{ const us=S.teams[p].filter(u=>f(u)!==undefined); const max=us.reduce((a,u)=>a+u.max,0); return max?us.reduce((a,u)=>a+Math.max(0,f(u)),0)/max:0; };
  const side=sideOf(hpOf), split=(x,y)=>x+y?x/(x+y)*100:50;
  const a=side(me), b=side(1-me), share=split(a,b), solo=soloView()||S.phase==='plan';
  const from=prevOf?split(sideOf(prevOf)(me),sideOf(prevOf)(1-me)):share;
  const name=p=>p===me&&solo?'You':p!==me&&solo?'Opponent':nm(p);
  return `<div class="strength" role="img" aria-label="${name(me)} ${Math.round(a*100)}% health, ${name(1-me)} ${Math.round(b*100)}%">
    <div class="sl"><span style="color:${pc(me)}">${name(me)} <b>${Math.round(a*100)}%</b></span><span style="color:${pc(1-me)}"><b>${Math.round(b*100)}%</b> ${name(1-me)}</span></div>
    <div class="sbar"><i class="${from!==share?'drain':''}" style="width:${share}%;--from:${from}%;background:${pc(me)}"></i><i style="flex:1;background:${pc(1-me)}"></i></div></div>`;
}
const vsDivider = () => '<div class="vsdiv" aria-hidden="true"><span>VS</span></div>';
function teamBlock(p, label, moment, simple, hint){
  const os=S.teams[p].map(u=>Object.assign(moment?moment(u):{}, simple?{simple:true}:{})), shown=S.teams[p].filter((u,i)=>!os[i].hidden);
  const up=S.teams[p].filter((u,i)=>!os[i].hidden && (os[i].hp===undefined?u.alive:os[i].hp>0)).length;
  return `<section class="side"><div class="sidehead"><span class="tname" style="color:${pc(p)}">${label||nm(p)}</span>
    ${hint?`<span class="taphint">${hint}</span>`:simple?'':`<span class="muted">${up} of ${shown.length} standing</span>`}</div>
    ${simple?'':synChips(p)}<div class="tiles${simple?' simple':''}">${S.teams[p].map((u,i)=>tile(u,{...os[i],i})).join('')}</div></section>`;
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
  <div class="setbar"><button class="btn ghost small gear" data-a="settings" aria-label="Settings"><span aria-hidden="true">⚙</span> Settings</button></div>
  <div class="hero"><span class="kanji" aria-hidden="true">滅</span>
    <div class="eyebrow">A Demon Slayer squad battler</div><h1>Squad Draft</h1>
    <p class="muted">Draft a squad on ${budget()} points. Pick secret moves each round. Last team standing wins.</p></div>
  ${artStrip()}
  <div class="modes">${[['2p','二','2 Players','One phone'],['online','網','Online','Two phones'],['cpu','機','Vs Computer',`${LEVELS[S.level].label}`],['story','物','Story',`${loadStory().cleared.length} of ${STAGES.length} stages`]]
    .map(([k,kj,t,sub])=>`<button class="mode${S.mode===k?' on':''}" data-a="mode" data-v="${k}" aria-pressed="${S.mode===k}"><span class="mk">${kj}</span><b>${t}</b><small>${sub}</small></button>`).join('')}</div>
  <div class="panel">
    <div class="row">
      <label for="n0">${S.mode==='story'||S.mode==='online'?'Your name':'Player 1'}<input id="n0" type="text" maxlength="14" value="${esc(S.names[0])}"></label>
      ${S.mode==='story'||S.mode==='online'?'':`<label for="n1">${S.mode==='cpu'?'Opponent':'Player 2'}<input id="n1" type="text" maxlength="14" value="${esc(S.mode==='cpu'?'Muzan AI':S.names[1])}" ${S.mode==='cpu'?'disabled':''}></label>`}
    </div>
    ${S.mode==='cpu'?`<div class="levelpick"><span class="tlabel">Muzan AI difficulty</span><div class="seg">${Object.entries(LEVELS).map(([k,l])=>`<button data-a="level" data-v="${k}" class="${S.level===k?'on':''}">${l.label}</button>`).join('')}</div>
      <span class="hint">${{easy:'Picks moves almost at random. Good for learning the cards.',normal:'Plays sensibly but makes mistakes.',hard:'Goes for knockouts, spreads damage and saves its specials.'}[S.level]}</span></div>`:''}
    ${S.mode==='online'?`<div class="onlinebox">
      ${S.joinOpen?`<div class="joinrow"><input id="ocode" type="text" maxlength="4" autocapitalize="characters" autocomplete="off" placeholder="CODE" value="${esc(S.joinCode||'')}" aria-label="Room code"><button class="btn" data-a="ojoin">Join</button></div>
      <button class="btn ghost" data-a="ojoinopen">Back</button>`
      :`<button class="btn" data-a="ocreate">Create a game</button>
      <button class="btn ghost" data-a="ojoinopen">Join a game</button>`}
      ${S.onlineMsg?`<p class="hint onlinemsg">${esc(S.onlineMsg)}</p>`:S.joinOpen?'<p class="hint">Type the 4-letter code shown on the other phone.</p>':'<p class="hint">One phone creates the game and gets a code; the other taps Join and types it. Points and pool come from the creator\'s Settings.</p>'}</div>`
    :S.mode==='story'?`<p class="hint">Fight through the arcs with the Demon Slayer Corps, from Final Selection to dawn. ${loadStory().cleared.length} of ${STAGES.length} stages cleared.</p>
    <button class="btn" data-a="storymap">${loadStory().cleared.length?'Continue the story':'Begin the story'}</button>`
    :'<button class="btn" data-a="start">Start the draft</button>'}
  </div>
  <div class="panel"><div class="eyebrow">All-time wins on this phone</div>
    <div class="score">${Object.keys(sc).length ? Object.entries(sc).sort((a,b)=>b[1]-a[1]).slice(0,3).map(([k,v])=>`<div><b>${v}</b>${esc(k)}</div>`).join('') : '<div class="muted">No matches yet</div>'}</div>
  </div>
  ${recordsPanel()}
  <details class="panel" id="howto"><summary>How to play</summary><ul>
    <li><b>The pool:</b> each draft deals 10 random characters, one version of each (base, Mark-awakened, or Yoriichi young or old). Every card shows its cost and stats before you pick.</li>
    <li><b>Draft:</b> a wheel decides who picks first, then snake order (A, B, B, A, A, B…) on a ${budget()}-point budget (change it in ⚙ Settings: 10, 20 or 30), up to 6 fighters. Tap <b>Lock team</b> when you're done; the other player keeps drafting until they lock or run out of points.</li>
    <li><b>Pool notes</b> list the synergies and matchups possible with the characters dealt. In ⚙ Settings you can switch the pool from Random to All characters.</li>
    <li><b>Legends:</b> Yoriichi (18) and Yoriichi at 85 (15) strike twice per Attack and cap the damage they take each round. They're rare: Yoriichi is dealt in about 1 draft in 8.</li>
    <li><b>Hantengu</b> splits when knocked out: into Sekido and Karaku, who become Aizetsu and Urogi when they fall. Beat all five.</li>
    <li><b>Marks ✦:</b> cost more, hit harder and recharge their special a round faster.</li>
    <li><b>Each round</b> every fighter secretly picks Attack, Defend (half damage) or their Special. Fastest goes first. ↻ Repeat last round copies your previous moves.</li>
    <li><b>Back pocket:</b> you may draft one helper: Chachamaru, Kasugai Crow or Muscle Mice (1 pt). It doesn't fight or take a fighter slot. Use it once, on the round you choose, with the chip next to Lock in moves: Chachamaru heals your most hurt fighter by half their current health, the Crow shows you the enemy's moves so you can change yours, the Mice give your team +2 PWR for that round.</li>
    <li><b>Story mode:</b> nine stages from Final Selection to Muzan. You see the enemy first, then build a squad from the Corps.</li>
    <li><b>Health</b> is shown as a percent of each fighter's own max. It turns red at 25%.</li>
    <li><b>Damage</b> = PWR − target's DEF, but never less than half the attacker's power. Demons regenerate; poison ticks.</li>
    <li><b>Synergies:</b> Kamaboko Squad +2 SPD · Siblings counter · 2+ Hashira +1 PWR · 2+ Upper Moons +1 regen · Muzan's Blood +1 PWR · 2+ Marks +1 SPD · Tamayo + Yushiro: Yushiro +2 PWR · Yoriichi + Tanjiro: Tanjiro +2 PWR · Urokodaki: Tanjiro and Giyu +1 DEF · Kagaya: Hashira +1 DEF. Facing Yoriichi, Muzan loses 3 PWR and Kokushibo 1 DEF. Facing Tamayo, Muzan regenerates 2 less. Facing Kaigaku, Zenitsu gets +2 PWR.</li>
    <li><b>Vs computer:</b> choose Easy, Normal or Hard before the draft.</li>
  </ul></details>`;
}

/* ---------- who picks first ---------- */
function vSpin(){
  const sp=S.spin, done=sp&&sp.state==='done', R=96, seg=360/WHEEL_SEGS, guest=isOnline()&&!iAmHost();
  const pt=(a,r)=>{ const t=a*Math.PI/180; return `${(100+r*Math.sin(t)).toFixed(2)} ${(100-r*Math.cos(t)).toFixed(2)}`; };
  const slices=Array.from({length:WHEEL_SEGS},(_,i)=>{ const p=i%2, a0=i*seg, a1=a0+seg;
    return `<path d="M100 100 L${pt(a0,R)} A${R} ${R} 0 0 1 ${pt(a1,R)} Z" style="fill:${pc(p)}"/>
      <text x="100" y="40" transform="rotate(${a0+seg/2} 100 100)">${esc(S.names[p].slice(0,8))}</text>`; }).join('');
  const wheel=`<div class="wheelbox"><span class="pointer" aria-hidden="true"></span>
    <svg class="wheel" viewBox="0 0 200 200" style="transform:rotate(${done?sp.angle:0}deg)" role="img" aria-label="Wheel with ${nm(0)} and ${nm(1)}">
      <circle cx="100" cy="100" r="99" class="rim"/>${slices}</svg>
    <button class="hubbtn${sp||guest?'':' ready'}" data-a="spin" ${sp||guest?'disabled':''} aria-label="Spin the wheel">滅</button></div>`;
  const status = done
    ? `<div class="spinres" style="color:${pc(sp.r)}">${nm(sp.r)} picks first</div>${actionbar(guest?`<button class="btn" disabled>Waiting for ${nm(0)} to start…</button>`:`<button class="btn team" data-a="toDraft" style="--bc:${pc(sp.r)}">Start the draft</button>`)}`
    : `<div class="spinhint">${sp?'Spinning…':guest?`${nm(0)} spins the wheel`:'Tap the 滅 seal to spin'}</div>`;
  return `${topbar('Before the draft', 'Who picks first?')}<div class="spin">${wheel}${status}</div>`;
}

/* ---------- draft ---------- */
function cardHTML(c,p){
  const owner=S.picks[0].includes(c.id)?0:S.picks[1].includes(c.id)?1:-1;
  const ok = canPick(p,c.id);
  const badge = c.legend?'Legend':c.mark?'✦ Mark':'';
  // picture-first card: art on top (kanji if no picture), name and type over its lower edge, stats below
  return `<button class="card ${glyphCls(c)}${ok?'':' off'}${S.sel===c.id?' sel':''}${owner>=0?' taken':''}" data-a="sel" data-v="${c.id}" ${ok?'':'aria-disabled="true"'}>
    <span class="cart">${ART[c.id]?`<img src="${ART[c.id]}" alt="">`:`<span class="ck">${c.g}</span>`}</span>
    <span class="cost${c.cost>=12?' big':''}">${c.cost}<small>pts</small></span>
    ${badge?`<span class="badge">${badge}</span>`:''}
    <span class="cbody"><span class="cn">${esc(c.name)}</span><span class="ct">${esc(c.type)}</span>${statCells(c)}</span>
    ${owner>=0?`<span class="tag" style="background:${pc(owner)}">${nm(owner)}</span>`:''}</button>`;
}
function teamBox(q,p){
  const left=budget()-spent(q);
  return `<div class="tbox${p===q&&!S.locked[q]?' active':''}" style="--tc:${pc(q)}">
    <div class="tn"><span>${nm(q)}</span><span>${S.mode==='story'&&q===1?'Enemy':S.locked[q]?'Locked':left+' pts left'}</span></div>
    <div class="meter" role="img" aria-label="${spent(q)} of ${budget()} points spent"><i style="width:${Math.min(100,spent(q)/budget()*100)}%"></i></div>
    <div class="slots">${S.picks[q].map(id=>seal(BYID[id],'xs')).join('')}${!S.locked[q]&&S.picks[q].length<MAXTEAM?'<span class="slot empty"></span>':''}</div></div>`;
}
function vDraft(){
  // cpuTurn = the other side is picking (the computer, or the other phone online): this phone waits
  const p = turn(), cpuTurn = (S.mode==='cpu' && p===1) || (isOnline() && p!==S.me), story = S.mode==='story';
  const fresh = !S.picks[0].length && !S.picks[1].length, left=budget()-spent(p);
  // second pick in a row (snake order), or the other player has locked and this one keeps going
  const again = S.lastPicker===p && !S.locked[1-p];
  const verb = S.locked[1-p] && S.picks[1-p].length ? 'keeps picking' : again ? 'picks again' : cpuTurn ? 'is picking' : 'picks';
  const lockbar = !cpuTurn && fighterIds(p).length ? `<div class="lockbar"><span>${story?'Ready to fight?':'Done picking?'}${left?` ${left} pts go unused.`:''}</span>
    <button class="btn team small" data-a="lock" style="--bc:${pc(p)}">${story?'Fight':'Lock team'}</button></div>` : '';
  // Undo the latest pick (2 players: either player's; vs computer: only your own)
  const un=undoable(), undo = un && (S.mode==='2p' || un.p===myP())
    ? `<button class="btn ghost small undo" data-a="undo">↶ Undo ${nm(un.p)}'s ${esc(BYID[un.id].short)}</button>` : '';
  const st=story&&STAGES[S.stage];
  return `<div class="draftlayout"><div class="dtop">
    ${story?topbar(`Story · Stage ${S.stage+1} · ${esc(st.title)}`,'Build your squad'):topbar('Draft', `<span style="color:${pc(p)}">${nm(p)}</span> ${verb}${cpuTurn?'…':''}`)}
    ${story?`<p class="hint">${esc(st.blurb)} You have ${budget()} points. Only the Corps and its allies fight for you.</p>`:''}
    ${orderStrip(p)}
    <div class="teams">${teamBox(0,p)}${teamBox(1,p)}</div>
    ${lockbar}
    <div class="dealt"><span>${(n=>story?`The Corps · ${n} characters`:S.poolType==='all'?`All ${n} characters`:`${n} characters dealt`)(S.pool.filter(id=>!isHelper(id)).length)} · tap one to see it</span>${undo}${fresh&&!cpuTurn&&!story&&S.poolType!=='all'&&(!isOnline()||iAmHost())?'<button class="btn ghost small" data-a="redeal">Re-deal</button>':''}</div></div>
    ${notesPanel()}
    <div class="grid">${S.pool.filter(id=>!isHelper(id)).map(id=>cardHTML(BYID[id],p)).join('')}</div>
    ${pocketDraft(p)}</div>`;
}
// The back-pocket helpers in the draft: a slim optional row at the bottom. 1 pt, one helper per player.
function pocketDraft(p){
  const hs=S.pool.filter(isHelper); if(!hs.length) return '';
  return `<section class="pocket"><div class="pockethead"><span class="tlabel">Back pocket</span><span class="muted">Optional · pick one 1 pt helper · used once in battle</span></div>
    <div class="pocketrow">${hs.map(id=>{ const c=BYID[id], owner=S.picks[0].includes(id)?0:S.picks[1].includes(id)?1:-1, ok=canPick(p,id);
      return `<button class="hchip${ok?'':' off'}${S.sel===id?' sel':''}${owner>=0?' owned':''}" data-a="sel" data-v="${id}" ${ok?'':'aria-disabled="true"'} ${owner>=0?`style="--tc:${pc(owner)}"`:''}>${seal(c,'pip')}
        <span><b>${esc(c.short)}</b><small>${owner>=0?nm(owner):esc(c.sig.tag)}</small></span></button>`; }).join('')}</div></section>`;
}
// Move screen: your helper (if not used yet) as a small toggle next to "Lock in moves"
function pocketChip(p){
  const id=S.helpers&&S.helpers[p]&&S.helpers[p][0]; if(!id || S.scouting) return '';
  const c=BYID[id], on=(S.helperPlan[p]||[]).includes(id);
  return `<button class="pchip${on?' on':''}" data-a="helper" data-v="${id}" aria-pressed="${on}" title="${esc(c.sig.desc)}">${seal(c,'pip')}<span><b>${on?'Using':'Use'} ${esc(c.short)}</b><small>${esc(c.sig.tag)}</small></span></button>`;
}
// What the crow saw: the other side's locked-in moves
function crowReport(p){
  return `<div class="crow"><div class="crowhead">${seal(BYID.crow,'sm')}<b>Crow report</b><span class="muted">${nm(1-p)}'s moves this round</span></div>
    ${alive(1-p).map(e=>`<div class="crowline">${seal(e,'pip')}<b>${esc(e.name)}</b><span>${moveSummary(e)}</span></div>`).join('')}
    ${(S.helperPlan[1-p]||[]).length?`<div class="crowline"><span>Back pocket: ${(S.helperPlan[1-p]).map(id=>esc(BYID[id].short)).join(', ')}</span></div>`:''}</div>`;
}
// The crow is back: see the enemy's moves, then change yours or keep them
function vScout(){
  const p=S.scoutP;
  if(isOnline() && p!==S.me) return waitScreen(`Round ${S.round}`, `${nm(p)}'s Kasugai Crow is scouting…`, `${nm(p)} is seeing your moves and may change theirs.`);
  return `${topbar(`Round ${S.round} · Kasugai Crow`, `<span style="color:${pc(p)}">${nm(p)}</span>, your crow is back`)}
    ${crowReport(p)}
    <p class="hint">You can change your moves now that you know theirs. Back-pocket choices stay as they are.</p>
    ${actionbar(`<button class="btn ghost" data-a="keepmoves">Keep my moves</button><button class="btn team" data-a="rescout" style="--bc:${pc(p)}">Change my moves</button>`)}`;
}
// A simple "waiting for the other phone" screen (online play)
function waitScreen(eyebrow, title, line){
  return `${topbar(eyebrow, title)}<div class="waiting"><div class="dots" aria-hidden="true"><i></i><i></i><i></i></div><p class="muted">${line}</p></div>`;
}
// Online lobby: the host shares the room code; the guest waits for the host to start
function vLobby(){
  const L=S.lobby||{}, host=iAmHost(), joined=L.peer || !host;
  return `${topbar('Online game', host?'Your room':'Joined')}
    <div class="lobby">
      <div class="tlabel">Room code</div><div class="roomcode">${esc(L.code||'····')}</div>
      ${host?`<p class="muted">${joined?`${nm(1)} has joined.`:'Tell the other player to tap Online → Join and type this code.'}</p>`
        :`<p class="muted">You're in ${nm(0)}'s room. Waiting for ${nm(0)} to start…</p>`}
      <div class="lobbyteams"><span style="color:var(--p1)">${nm(0)}</span><span class="rx">VS</span><span style="color:var(--p2)">${joined?nm(1):'…'}</span></div>
    </div>
    ${host?actionbar(`<button class="btn" data-a="ostart" ${joined?'':'disabled'}>${joined?'Start: spin for first pick':'Waiting for a player…'}</button>`):''}`;
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
// Fighter info card in battle: tap any picture (yours or the opponent's). Shows current stats, which include
// team bonuses and anything gained in the match, plus the special's cooldown, passives and status effects.
function vInfo(){
  const u=findU(S.info); if(!u) return '';
  const c=BYID[u.id], pas=[c.passive, c.mark?MARK_PASSIVE:''].filter(Boolean);
  const yours = soloView() ? u.p===myP() : S.phase==='plan' ? u.p===S.planFor : null;
  const side = yours===null ? nm(u.p) : yours ? 'Your team' : 'Opponent';
  return `<div class="scrim" data-a="unsel"></div><div class="modal"><div class="in info ${glyphCls(u)}" role="dialog" aria-modal="true" aria-label="${esc(u.name)}">
    <button class="x" data-a="unsel" aria-label="Close">×</button>
    ${banner(u)}
    <div class="shead">${seal(u,'lg')}<div><div class="eyebrow" style="color:${pc(u.p)}">${side} · ${esc(c.type)}</div><h2>${esc(c.name)}</h2></div></div>
    <div class="ihp"><span class="tlabel">Health</span>${health(u,{simple:true})}</div>
    <span class="stats"><span><i>PWR</i>${u.pow}</span><span><i>DEF</i>${u.def}</span><span><i>SPD</i>${u.spd}</span><span><i>REGEN</i>${u.regen?pct(u,u.regen)+'%':'–'}</span></span>
    <div class="sig"><div class="sname">${esc(u.sig.name)} <span class="muted">· ${!u.alive?'knocked out':u.cd>0?`ready in ${plural(u.cd,'round')}`:'ready now'}</span></div>${esc(u.sig.desc)}</div>
    ${u.legend?`<div class="pas">Strikes ×${u.strikes} per Attack · takes at most ${pct(u,u.cap)}% a round.</div>`:''}
    ${pas.map(x=>`<div class="pas">${esc(x)}</div>`).join('')}
    ${statusChips(u,false)}
    ${S.syn&&S.syn[u.p].length?`<div class="ibonus"><span class="tlabel">Team bonuses</span>${synChips(u.p)}</div>`:''}
    <div class="row"><button class="btn ghost" data-a="unsel">Close</button></div>
  </div></div>`;
}
// Two players: after both lock in, wait for a tap before the round plays out
function vReady(){
  const row=p=>`<div class="rteam" style="--tc:${pc(p)}"><span class="rname">${nm(p)}</span><span class="rseals">${alive(p).map(u=>seal(u,'sm')).join('')}</span></div>`;
  return `<div class="pass ready"><div class="eyebrow">Round ${S.round}</div>
    <div class="big">Both squads are ready</div>
    <div class="rvs">${row(0)}<span class="rx">VS</span>${row(1)}</div>
    <p class="muted">Put the phone where you can both see it.</p>
    <button class="btn" data-a="fight">Start the battle</button></div>`;
}
// Settings (gear on the main screen): points per team
function vSettings(){
  const blurb={10:'Quick, chaotic games with 2–3 fighters each. Only cards costing 6 or less are dealt.',20:'The standard game.',30:'Bigger squads: 14 characters are dealt and stronger ones come up more often. Yoriichi and Final-Form Muzan stay rare. Still up to 6 fighters.'};
  return `<div class="scrim" data-a="unsel"></div><div class="modal"><div class="in" role="dialog" aria-modal="true" aria-label="Settings">
    <button class="x" data-a="unsel" aria-label="Close">×</button>
    <h2>Settings</h2>
    <div class="setgroup"><div class="tlabel">Points per team</div>
      <div class="seg">${BUDGETS.map(b=>`<button data-a="budget" data-v="${b}" class="${budget()===b?'on':''}">${b}${b===DEFAULT_BUDGET?' <small>default</small>':''}</button>`).join('')}</div>
      <div class="hint">${blurb[budget()]}</div></div>
    <div class="setgroup"><div class="tlabel">Character pool</div>
      <div class="seg">${[['random','Random'],['all','All']].map(([k,l])=>`<button data-a="pooltype" data-v="${k}" class="${S.poolType===k?'on':''}">${l}${k==='random'?' <small>default</small>':''}</button>`).join('')}</div>
      <div class="hint">${S.poolType==='all'?'Every character is available to draft. Each one can still only be picked once (taking Giyu also rules out Giyu ✦).':`A random hand of ${poolSize()} characters is dealt each draft.`}</div></div>
    <div class="setgroup"><div class="tlabel">Playback speed</div>
      <div class="seg">${[['slow','Slow'],['normal','Normal'],['fast','Fast']].map(([k,l])=>`<button data-a="speed" data-v="${k}" class="${S.speed===k?'on':''}">${l}${k==='normal'?' <small>default</small>':''}</button>`).join('')}</div>
      <div class="hint">How long each action stays on screen during a round.</div></div>
    <div class="setgroup"><div class="tlabel">Sound effects</div>
      <div class="seg"><button data-a="sound" data-v="on" class="${S.soundOn?'on':''}">On <small>default</small></button><button data-a="sound" data-v="off" class="${S.soundOn?'':'on'}">Off</button></div></div>
    <div class="hint">Saved on this phone. Points and pool apply from the next draft.</div>
    <div class="row"><button class="btn" data-a="unsel">Done</button></div>
  </div></div>`;
}
// Wide picture across the top of a detail card (only when the character has a picture)
const banner = c => ART[c.id] ? `<div class="mbanner" aria-hidden="true"><img src="${ART[c.id]}" alt=""></div>` : '';
// Main menu: a slowly scrolling strip of character art (only once pictures have loaded)
function artStrip(){
  const ids=['tanjiro','nezuko','zenitsu','inosuke','rengoku','giyu','shinobu','mitsuri','tengen','muichiro','akaza','doma','kokushibo','muzan','yoriichi','kanao'].filter(id=>ART[id]);
  if(ids.length<6) return '';
  const row=ids.map(id=>`<img src="${ART[id]}" alt="">`).join('');
  return `<div class="artstrip" aria-hidden="true"><div class="track">${row}${row}</div></div>`;
}
// Card detail, centred on screen, when a card is tapped during the draft (or a fighter's info card in battle)
function vSheet(){
  if(S.settings) return vSettings();
  if(S.info) return vInfo();
  if(S.phase!=='draft' || !S.sel) return '';
  const c=BYID[S.sel], p=isOnline()?S.me:turn(), ok=canPick(p,c.id) && (!isOnline() || turn()===S.me);
  if(c.helper) return `<div class="scrim" data-a="unsel"></div><div class="modal"><div class="in" role="dialog" aria-modal="true" aria-label="${esc(c.name)}">
    <button class="x" data-a="unsel" aria-label="Close">×</button>
    <div class="shead">${seal(c,'lg')}<div><div class="eyebrow">${esc(c.type)}</div><h2>${esc(c.name)}</h2></div><span class="cost">${c.cost}<small>pt</small></span></div>
    <div class="sig"><div class="sname">${esc(c.sig.name)}</div>${esc(c.sig.desc)}</div>
    <div class="pas">Back-pocket helper: doesn't fight, can't be attacked and doesn't take a fighter slot. On the move screen, tap Use on the round you want. It acts first that round, then leaves.</div>
    <div class="row"><button class="btn ghost" data-a="unsel">Close</button>${ok?`<button class="btn team" data-a="confirmPick" style="--bc:${pc(p)}">Confirm ${esc(c.short)}</button>`:''}</div>
  </div></div>`;
  const pas=[c.passive, c.mark?MARK_PASSIVE:''].filter(Boolean);
  const notes=notesForCard(c.id, p);   // only partners this player could afford alongside this card
  const rec=loadRecords()[c.id];
  return `<div class="scrim" data-a="unsel"></div><div class="modal"><div class="in ${glyphCls(c)}" role="dialog" aria-modal="true" aria-label="${esc(c.name)}">
    <button class="x" data-a="unsel" aria-label="Close">×</button>
    ${banner(c)}
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
  const name = pl.type==='attack'?(u.basic?esc(u.basic.name):'Attack'):pl.type==='defend'?'Defend':esc(u.sig.name);
  if(!needsTarget(u,pl)) return name;
  const t=pl.t&&findU(pl.t);
  return t ? `${name} → ${esc(t.name)}` : `${name} · pick a target`;
}
function fighter(u, open){
  const ready=unitReady(u), pl=S.plans[u.p][u.uid]||{};
  const head=`<div class="fhead">${sealBtn(u)}<button class="fmain" data-a="focus" data-v="${u.uid}" aria-expanded="${open}" ${u.stun?'disabled':''}>
    <span class="tb">${health(u)}<span class="sum${ready?' ok':''}">${ready&&!u.stun?'✓ ':''}${moveSummary(u)}</span></span></button></div>`;
  if(!open) return `<div class="fighter" style="--tc:${pc(u.p)}">${head}</div>`;
  // kept short on purpose: stats and the full special text are one tap away on the fighter's picture
  const mv=(v,k,label,sub,dis)=>`<button data-a="act" data-u="${u.uid}" data-v="${v}" class="${pl.type===v?'on':''}" ${dis?'disabled':''}><span class="mk" aria-hidden="true">${k}</span>${label}${sub?`<small>${sub}</small>`:''}</button>`;
  const opts=targetOptions(u,pl);
  const tgt=x=>`<button class="tg${x.p===u.p?' ally':''}${pl.t===x.uid?' on':''}" data-a="tgt" data-u="${u.uid}" data-v="${x.uid}">
    ${seal(x,'sm')}${esc(x.name)}<span class="${pct(x)<=LOW?'lo':''}">${pct(x)}%</span></button>`;
  return `<div class="fighter open" style="--tc:${pc(u.p)}">${head}<div class="fbody">
    ${statusChips(u,false)}
    <div class="moves">${u.basic?mv('attack','琵',esc(u.basic.name),esc(u.basic.tag)):mv('attack','攻','Attack',u.strikes>1?'×'+u.strikes:'')}${mv('defend','守','Defend',u.noDefend?'berserk':'',u.noDefend)}${mv('special','技',`<span class="spn">${esc(u.sig.name.split(':')[0])}</span>`,u.cd>0?`<span class="cdn">ready in ${u.cd}</span>`:esc(u.sig.tag),u.cd>0)}</div>
    ${opts.length?`<div class="targets"><span class="tlabel">${isAllyMove(u,pl)?'Ally':'Target'}</span>${opts.map(tgt).join('')}</div>`:''}
  </div></div>`;
}
function vPass(){
  const p=S.planFor;
  return `<div class="pass"><div class="eyebrow">Round ${S.round}</div>
    <div class="big" style="color:${pc(p)}">Hand the phone to ${nm(p)}</div>
    <p class="muted">${S.passScout?`${nm(p)}'s Kasugai Crow is back with a report. ${nm(1-p)}, look away.`:`${nm(1-p)}, no peeking at their moves.`}</p>
    <button class="btn team" data-a="reveal" style="--bc:${pc(p)}">I'm ${nm(p)}. Show my team</button></div>`;
}
function vPlan(){
  const p=S.planFor, open=focusOf(p), ready=planReady(p), mine=alive(p);
  if(isOnline() && S.movesLocked && S.movesLocked[p] && !S.scouting)
    return waitScreen(`Round ${S.round}`, 'Moves locked in', `Waiting for ${nm(1-p)} to choose…`);
  // the open fighter needs an enemy target: opponents become tappable
  const ou=open&&findU(open), opl=ou&&S.plans[p][ou.uid]||{}, picking=ou && needsTarget(ou,opl) && !isAllyMove(ou,opl);
  const aimers=e=>mine.filter(m=>{ const q=S.plans[p][m.uid]; return q && q.t===e.uid && needsTarget(m,q) && !isAllyMove(m,q); });
  // knocked-out fighters aren't shown on the move screen (either side)
  const enemyMoment=e=>!e.alive ? {hidden:true} : ({aimed:aimers(e), ...(picking?{tgtFor:ou.uid, picked:opl.t===e.uid}:{})});
  return `${topbar(`Round ${S.round}`, `<span style="color:${pc(p)}">${nm(p)}</span>, choose`)}
    ${strengthBar(p)}
    ${teamBlock(1-p,'Opponent',enemyMoment,true,picking?`Tap to target with ${esc(ou.name)}`:'')}
    <section class="side"><div class="sidehead"><span class="tname" style="color:${pc(p)}">Your team</span>${S.lastPlans&&S.lastPlans[p]?'<button class="btn ghost small" data-a="repeat">↻ Repeat</button>':''}</div>
      ${S.scouting?crowReport(p):''}<div class="fighters">${alive(p).map(u=>fighter(u,u.uid===open)).join('')}</div></section>
    ${actionbar(`${pocketChip(p)}<button class="btn team" data-a="lockMoves" ${ready?'':'disabled'} style="--bc:${pc(p)}">${ready?'Lock in moves':`${mine.filter(unitReady).length} of ${plural(mine.length,'fighter')} ready`}</button>`)}`;
}

/* ---------- results ---------- */
// The fight stage for one playback line: the attacker's picture lunges at the target's, a mark flashes on impact,
// and the health change floats up. Lines with one fighter (regen, poison, specials…) animate just that fighter.
const FX_MARK = {hit:'斬', miss:'避', block:'防', ko:'KO', heal:'癒', revive:'蘇', poison:'毒', stun:'眠', guard:'守', buff:'鍛', special:'技', burn:'陽', spawn:'分'};
function stage(line){
  const by=line.by&&findU(line.by), on=line.on&&findU(line.on), type=line.fx||'', duo=by&&on&&by!==on;
  // breathing style of the fighter acting (their Attack or Special look): colour, kanji mark and drawing
  const style = by && ['hit','ko','burn','special','miss','block'].includes(type) ? styleOf(by, line.move) : null;
  const art = style && ['hit','ko','burn'].includes(type) ? fxArt(style) : '';
  // Teams keep their side of the stage (player 1 left, player 2 right), so a hit back swings the other way
  // instead of the two cards swapping places. "rev" = the actor is on the right, attacking leftwards.
  const rev = duo && by.p!==on.p && by.p===1;
  const amt=line.t.match(/\[([+-])(\d+%)\]/);
  const pop=amt?`<span class="pop ${amt[1]==='-'?'dmg':'gain'}">${amt[1]==='-'?'−':'+'}${amt[2]}</span>`:'';
  const who=(u,role)=>`<div class="st-${role}">${seal(u,'stg')}${role==='on'?art+pop:''}${role==='by'&&type==='special'&&style?fxArt(style,'aura'):''}<span class="st-nm" style="color:${pc(u.p)}">${esc(u.name)}</span></div>`;
  if(line.helper){ const h=BYID[line.helper];   // a back-pocket helper acting
    return `<div class="stage fx-${type} solo helperfx" aria-hidden="true"><span class="st-mark">${FX_MARK[type]||''}</span><div class="st-on">${seal(h,'stg')}<span class="st-nm">${esc(h.short)}</span></div></div>`; }
  const mark=`<span class="st-mark">${style&&(type==='hit'||type==='special')?STYLE_KANJI[style]:FX_MARK[type]||''}</span>`;
  const solo=on||by;
  return `<div class="stage fx-${type||'none'} ${duo?'duo':'solo'}${rev?' rev':''}${style?' sty sty-'+style:''}" aria-hidden="true">
    ${duo ? (rev ? who(on,'on')+mark+who(by,'by') : who(by,'by')+mark+who(on,'on')) : solo ? mark+who(solo, on?'on':'by') : mark}</div>`;
}
// One beat for a special that hits several enemies: the attacker strikes once, every target recoils together with
// its own damage number, and any it knocks out topple over
function stageGroup(lines){
  const by=findU(lines[0].by), style=styleOf(by,'special'), rev=by.p===1;
  const hits=lines.filter(l=>GROUP_FX.includes(l.fx));
  const target=l=>{ const t=findU(l.on), amt=l.t.match(/\[([+-])(\d+%)\]/), ko=lines.some(m=>m.fx==='ko'&&m.on===l.on);
    return `<div class="st-on${ko?' koed':''}${l.fx!=='hit'?' missed':''}">${seal(t,'stg')}${l.fx==='hit'?fxArt(style):''}${amt?`<span class="pop dmg">−${amt[2]}</span>`:l.fx!=='hit'?`<span class="pop">${l.fx==='miss'?'miss':'blocked'}</span>`:''}<span class="st-nm" style="color:${pc(t.p)}">${esc(t.name)}</span></div>`; };
  const attacker=`<div class="st-by">${seal(by,'stg')}<span class="st-nm" style="color:${pc(by.p)}">${esc(by.name)}</span></div>`;
  const row=`<div class="st-targets">${hits.map(target).join('')}</div>`, mark=`<span class="st-mark">${STYLE_KANJI[style]}</span>`;
  return `<div class="stage group duo fx-hit sty sty-${style}${rev?' rev':''}" aria-hidden="true">${rev?row+mark+attacker:attacker+mark+row}</div>`;
}
// During playback each team is a slim row of small portraits with a thin health line, so the stage is the focus.
// `moment` gives HP at this beat; `involved` = uids in the current action.
function miniTeam(p, moment, involved){
  const us=S.teams[p].map(u=>({u,o:moment(u)})).filter(x=>!x.o.hidden);
  return `<div class="mini" style="--tc:${pc(p)}">${us.map(({u,o})=>{
    const hp=o.hp===undefined?u.hp:o.hp, up=hp>0, h=up?pct(u,hp):0, from=o.from===undefined?h:Math.max(0,pct(u,o.from));
    return `<div class="m${up?'':' dead'}${involved.has(u.uid)?' inv':''}${o.flash?' '+o.flash:''}">${sealBtn(u,'mini')}
      <span class="mb${up&&h<=LOW?' low':''}"><i class="${from!==h?'drain':''}" style="width:${h}%;--from:${from}%"></i></span></div>`; }).join('')}</div>`;
}
// One line for a group attack: "Frozen Lotus hits 4 enemies · 1 knocked out"
function groupSummary(lines){
  const by=findU(lines[0].by), n=lines.filter(l=>l.fx==='hit').length, ko=lines.filter(l=>l.fx==='ko').length;
  return `${seal(by,'ls')}<b>${esc(by.sig.name.split(':')[0])}</b> hits ${plural(n,'enemy').replace('enemys','enemies')}${ko?` · <b class="dmg">${ko} knocked out</b>`:''}`;
}
// Knockouts and hits of 30%+ shake the stage
const bigHit = line => line.fx==='ko' || (/\[-(\d+)%\]/.exec(line.t)||[])[1] >= 30;
const logHTML = () => `<div class="log">${S.log.filter(l=>l.c!=='r').map(l=>`<div class="${l.c}">${fmtLog(l.t)}</div>`).join('')}</div>`;
// The round plays back one log line at a time (S.play.k = the line being shown); tiles show HP at that moment
function vResult(){
  const done=!S.play||S.play.done, steps=S.play&&S.play.steps;
  const [from,to]=done?[S.log.length-1,S.log.length-1]:steps[S.play.k], k=to, cur=S.log[to], prev=S.log[Math.max(0,from-1)];
  const lines=S.log.slice(from,to+1), group=to>from;
  // the fighter acting: the line's attacker, or the one whose name starts it
  const actor=done?null:(cur.by&&findU(lines[0].by))||S.teams[0].concat(S.teams[1]).filter(u=>cur.t.startsWith(u.name)).sort((a,b)=>b.name.length-a.name.length)[0];
  const moment = u => done ? {} : cur.hp[u.uid]===undefined ? {hidden:true} : {hp:cur.hp[u.uid], from:prev.hp[u.uid]??cur.hp[u.uid],
    flash: lines.some(l=>l.ko===u.uid) ? 'ko' : prev.hp[u.uid]===undefined ? 'spawn' : cur.hp[u.uid]<prev.hp[u.uid] ? 'hit' : cur.hp[u.uid]>prev.hp[u.uid] ? 'heal' : actor===u ? 'acting' : ''};
  const step=done?0:S.play.k, total=done?0:steps.length-1;
  // fighters in this beat (attacker and targets) stay bright in the slim team rows; the rest fade back
  const involved=new Set(lines.flatMap(l=>[l.by,l.on,l.ko]).filter(Boolean));
  // vs computer the screen is yours, so label the teams from your side; two players share it, so keep names
  const solo=soloView(), me=myP(), them=1-me;
  const waiting = isOnline() && S.readyNext && S.readyNext[me] && !S.final;
  const next = S.final ? '<button class="btn" data-a="finish">See who won</button>'
    : waiting ? `<button class="btn" disabled>Waiting for ${nm(them)}…</button>` : '<button class="btn" data-a="next">Next round</button>';
  return `${topbar(`Round ${S.round}${done?'':` · ${step} of ${total}`}`, done?'What happened':'The clash', false)}
    ${strengthBar(me, done?undefined:u=>cur.hp[u.uid], done?undefined:u=>prev.hp[u.uid])}
    ${done?teamBlock(them,solo?'Opponent':null,moment):miniTeam(them,moment,involved)}
    ${done?vsDivider():group?`<div class="now${lines.some(bigHit)?' big':''}${lines.some(l=>l.fx==='ko')?' k':''}" aria-live="polite">${stageGroup(lines)}<span>${groupSummary(lines)}</span></div>`
      :k?`<div class="now ${cur.c}${bigHit(cur)?' big':''}" aria-live="polite">${stage(cur)}${cur.fx==='special'&&findU(cur.by)&&findU(cur.by).sig.quote?`<span class="quote">“${esc(findU(cur.by).sig.quote)}”</span>`:''}<span>${fmtLog(cur.t)}</span></div>`
      :`<div class="now intro" aria-live="polite"><span class="ir">Round ${S.round}</span><span class="ig">Fight!</span></div>`}
    ${done?teamBlock(me,solo?'Your team':null,moment):miniTeam(me,moment,involved)}
    ${done?`<div class="panel"><div class="tlabel">Round log</div>${logHTML()}</div>`:''}
    ${actionbar(done ? next : '<button class="btn ghost" data-a="skip">Skip</button>')}`;
}
// MVP of the match plus a few awards, from S.stats (see tallyRound in engine.js)
function mvpPanel(){
  const all=S.teams[0].concat(S.teams[1]).filter(u=>!u.spawn || S.stats[u.uid]).map(u=>({u, s:S.stats[u.uid]||{dmg:0,kos:0,heal:0,best:0}}));
  if(!all.length) return '';
  const top=(f)=>all.slice().sort((a,b)=>f(b.s)-f(a.s))[0];
  const mvp=top(mvpScore); if(!mvpScore(mvp.s)) return '';
  const line=s=>[s.dmg?`${s.dmg} damage`:'', s.kos?plural(s.kos,'knockout'):'', s.heal?`${s.heal} healed`:''].filter(Boolean).join(' · ');
  const award=(label,x,val)=>x&&val?`<div class="award">${seal(x.u,'sm')}<span><b>${label}</b> ${esc(x.u.name)} · ${val}</span></div>`:'';
  const dm=top(s=>s.dmg), ko=top(s=>s.kos), bh=top(s=>s.best), hl=top(s=>s.heal);
  return `<section class="mvp" style="--tc:${pc(mvp.u.p)}"><div class="mvpmain">${seal(mvp.u,'lg')}<div><div class="tlabel">Match MVP</div>
    <div class="mvpname">${esc(mvp.u.name)}</div><div class="muted">${line(mvp.s)}</div></div></div>
    <div class="awards">${award('Most damage',dm,dm.s.dmg?`${dm.s.dmg}`:'')}${award('Most knockouts',ko,ko.s.kos?`${ko.s.kos}`:'')}${award('Biggest hit',bh,bh.s.best?`${bh.s.best}`:'')}${award('Best healer',hl,hl.s.heal?`${hl.s.heal} HP`:'')}</div></section>`;
}
// Story map: the stages in order, with the enemy team, points and difficulty of each
function vStory(){
  const done=loadStory().cleared;
  return `${topbar('Story mode', 'The Demon Slayer Corps')}
    <p class="muted">${done.length} of ${STAGES.length} stages cleared. Clear a stage to unlock the next.</p>
    <div class="stages">${STAGES.map((st,i)=>{ const open=stageUnlocked(i), clear=stageCleared(i);
      return `<button class="stagecard${clear?' clear':''}${open?'':' locked'}" data-a="stage" data-v="${i}" ${open?'':'disabled'}>
        <span class="snum">${clear?'✓':open?i+1:'🔒'}</span>
        <span class="sinfo"><span class="stitle">${esc(st.title)}</span><span class="splace">${esc(st.place)} · vs ${esc(st.foe)}</span>
          <span class="sblurb">${esc(st.blurb)}</span>
          <span class="sfoot"><span class="sseals">${st.enemy.map(id=>seal(BYID[id],'sm')).join('')}</span><span class="smeta">${st.budget} pts · ${LEVELS[st.level].label}</span></span></span></button>`; }).join('')}</div>`;
}
function vOver(){
  const w=S.winner;
  return `<div class="win${w<0?'':' victory'}" style="--wc:${w<0?'var(--muted)':pc(w)}"><span class="burst" aria-hidden="true"></span>
    ${w<0?'':`<div class="winseals" aria-hidden="true">${S.teams[w].map((u,i)=>`<span style="--i:${i}">${seal(u,'lg')}</span>`).join('')}</div>`}
    <div class="eyebrow">After ${plural(S.round,'round')}</div>
    <div class="big" style="color:${w<0?'var(--fg)':pc(w)}">${w<0?'Both squads fall':nm(w)+' wins'}</div>
    <p class="muted">${S.mode==='story' ? (w===0 ? (S.stage+1<STAGES.length?`Stage ${S.stage+1} cleared. ${esc(STAGES[S.stage+1].title)} is unlocked.`:'The sun rises. The story is complete!') : 'Defeated. Rethink your squad and try again.')
      : w<0?'Nobody is left standing at dawn.':'Win and character records saved on this phone.'}</p></div>
    ${mvpPanel()}
    <div class="overteams">${teamBlock(0)}${teamBlock(1)}</div>
    <details class="panel" id="finallog"><summary>Final round</summary>${logHTML()}</details>
    ${actionbar(S.mode==='story'
      ? `<button class="btn ghost" data-a="storymap">Story map</button>${w===0&&S.stage+1<STAGES.length?`<button class="btn" data-a="stage" data-v="${S.stage+1}">Next stage</button>`:w===0?'':`<button class="btn" data-a="stage" data-v="${S.stage}">Try again</button>`}`
      : isOnline() ? '<button class="btn ghost" data-a="home">Leave room</button><button class="btn" data-a="rematch">Rematch</button>'
      : '<button class="btn ghost" data-a="home">Main menu</button><button class="btn" data-a="rematch">Rematch</button>')}`;
}
