/* ================= VIEWS =================
   Each v*() returns the HTML for one screen. No DOM access here, so these can also be rendered in Node. */
const esc = s => String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const pc = p => `var(--p${p+1})`;   // player colours: green, wisteria, amber, rose
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
  const byName={}; allUnits().forEach(u=>{ byName[esc(u.name)]=u; });
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
// One bar split between every team's remaining health (all fighters' HP ÷ all max HP), so you can see who's ahead.
// hpOf(u) = HP to count (playback passes the HP at that moment; undefined = not on the field yet). Your team comes first.
function strengthBar(me, hpOf=u=>u.alive?u.hp:0, prevOf){
  const sideOf=f=>p=>{ const us=S.teams[p].filter(u=>f(u)!==undefined); const max=us.reduce((a,u)=>a+u.max,0); return max?us.reduce((a,u)=>a+Math.max(0,f(u)),0)/max:0; };
  // groups: one per team (2v2: your side, then the other side)
  const groups = S.duo ? [players().filter(q=>sameSide(q,me)).sort((a,b)=>(a!==me)-(b!==me)), enemiesOf(me)] : [[me], ...others(me).map(q=>[q])];
  const solo=soloView()||S.phase==='plan', share=f=>g=>{ const us=g.flatMap(q=>S.teams[q]).filter(u=>f(u)!==undefined); const max=us.reduce((a,u)=>a+u.max,0); return max?us.reduce((a,u)=>a+Math.max(0,f(u)),0)/max:0; };
  const now=groups.map(share(hpOf)), was=prevOf?groups.map(share(prevOf)):now, sum=x=>x.reduce((a,b)=>a+b,0)||1;
  const name=g=>g.length>1 ? g.map(q=>q===me&&solo?'You':nm(q)).join(' & ') : g[0]===me&&solo?'You':g[0]!==me&&solo&&nPlayers()===2?'Opponent':nm(g[0]);
  const label=(g,i)=>`<span style="color:${pc(g[0])}">${i&&groups.length===2?`<b>${Math.round(now[i]*100)}%</b> ${name(g)}`:`${name(g)} <b>${Math.round(now[i]*100)}%</b>`}</span>`;
  return `<div class="strength${groups.length>2?' multi':''}" role="img" aria-label="${groups.map((g,i)=>`${name(g)} ${Math.round(now[i]*100)}% health`).join(', ')}">
    <div class="sl">${groups.map(label).join('')}</div>
    <div class="sbar">${groups.map((g,i)=>`<i class="${was[i]!==now[i]?'drain':''}" style="width:${now[i]/sum(now)*100}%;--from:${was[i]/sum(was)*100}%;background:${pc(g[0])}"></i>`).join('')}</div></div>`;
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
  if(!rows.length) return '<p class="muted">No character records yet.</p>';
  return `<div class="records"><div class="tlabel">Character records <span class="muted">· ${plural(rows.length,'character')} played</span></div>
    <div class="recs"><div class="rec head"><span></span><span>Character</span><span>Win rate</span><span>Won</span></div>
    ${rows.map(x=>`<div class="rec">${seal(x.c,'sm')}<span class="rn">${esc(x.c.short)}</span>
      <span class="rbar"><i style="width:${x.r}%"></i><b>${x.r}%</b></span><span class="rw">${x.w} of ${x.g}</span></div>`).join('')}</div></div>`;
}
// The four modes on the main menu: key, kanji, title, caption
const MODE_CARDS = [
  ['local','二','Local Multiplayer','One phone · 2–4 players'],
  ['online','網','Online','2–4 phones'],
  ['cpu','機','Quickplay','You vs the computer'],
  ['practice','練','Practice','Draft every team yourself'],
  ['story','物','Story Mode','The Slayer’s journey'],
];
// Names for local play: up to four, remembered on this phone
const localNames = () => { const s=loadNames()||[]; return ['CK','Mia','Player 3','Player 4'].map((d,i)=>s[i]||d); };
const seg = (act, cur, opts) => `<div class="seg">${opts.map(([v,l])=>`<button data-a="${act}" data-v="${v}" class="${String(cur)===String(v)?'on':''}">${l}</button>`).join('')}</div>`;
// Match settings for the selected mode (each mode remembers its own)
function modeSettings(){
  const c=S.cfg||loadModeCfg(S.mode), n=c.players;
  const pts=`<div class="setline"><span class="tlabel">Points per team</span>${seg('cfgbudget',c.budget,BUDGETS.map(b=>[b,b]))}</div>`;
  // rarely changed options stay folded away so the panel stays simple
  const more=[c.maxTeam!==MAXTEAM?`max ${c.maxTeam} fighters`:'', c.bans?'bans on':''].filter(Boolean).join(' · ');
  const pool=`<div class="setline"><span class="tlabel">Character pool</span>${seg('cfgpool',c.poolType,[['random','Random'],['all','All']])}</div>
    <details class="subset" id="more-${S.mode}"><summary>More options <span class="muted">${more?'· '+more:''}</span></summary>
      <div class="setline"><span class="tlabel">Max fighters per team</span>${seg('cfgmax',c.maxTeam,[1,2,3,4,5,6].map(k=>[k,k]))}</div>
      <div class="setline"><span class="tlabel">Bans</span>${seg('cfgbans',c.bans?'on':'off',[['off','Off'],['on','1 each']])}
        <span class="hint">Before the draft, each player bans one character. Nobody can pick it.</span></div></details>`;
  const note = n===4 && c.duo ? `<p class="hint">2v2: ${S.mode==='local'?'players 1 &amp; 3 team up against 2 &amp; 4':'you and an allied computer against two computers'}. Heals and shields can go on your partner's fighters; a team wins when the other team has nobody left. Cards over ${FFA_MAX_COST} pts aren't dealt.</p>`
    : n>2 ? `<p class="hint">Free-for-all: every team fights every other team; last one standing wins. Specials that hit “every enemy” hit the whole team you aim at, and cards over ${FFA_MAX_COST} pts aren't dealt.</p>`
    : `<p class="hint">${{10:'Quick, chaotic games with 2–3 fighters each.',20:'The standard game.',30:'Bigger squads and stronger cards. Yoriichi and Final-Form Muzan stay rare.'}[c.budget]}</p>`;
  if(S.mode==='local'){ const names=localNames();
    return `<div class="setline"><span class="tlabel">Players</span>${seg('cfgplayers',n,[[2,'2'],[3,'3 · Triple threat'],[4,'4']])}</div>
      ${n===4?`<div class="setline"><span class="tlabel">With 4 players</span>${seg('cfgduo',c.duo?'on':'off',[['off','Free-for-all'],['on','2v2 teams']])}</div>`:''}
      <div class="names">${Array.from({length:n},(_,i)=>`<label class="pname" style="--tc:${pc(i)}"><span>Player ${i+1}</span><input id="n${i}" type="text" maxlength="14" value="${esc(names[i])}"></label>`).join('')}</div>
      ${pts}${pool}${note}<button class="btn" data-a="start">Start: spin for first pick</button>`; }
  if(S.mode==='cpu' || S.mode==='practice')
    return `${S.mode==='practice'?'<p class="hint">Curate the match: you draft for every team, the computers’ too, then fight the computers. Practice games don’t count toward your records.</p>':''}
      <label class="pname" style="--tc:${pc(0)}"><span>Your name</span><input id="n0" type="text" maxlength="14" value="${esc(S.names[0])}"></label>
      <div class="setline"><span class="tlabel">Opponents</span>${seg('cfgplayers',n,[[2,'1'],[3,'2'],[4,'3']])}</div>
      ${n===4?`<div class="setline"><span class="tlabel">With 3 computers</span>${seg('cfgduo',c.duo?'on':'off',[['off','Free-for-all'],['on','2v2: you + an ally']])}</div>`:''}
      <div class="setline"><span class="tlabel">Difficulty</span>${seg('cfglevel',c.level,Object.entries(LEVELS).map(([k,l])=>[k,l.label]))}</div>
      <p class="hint">${{easy:'Picks moves almost at random. Good for learning the cards.',normal:'Plays sensibly but makes mistakes.',hard:'Goes for knockouts, spreads damage and saves its specials.'}[c.level]}</p>
      ${pts}${pool}${n>2?note:''}<button class="btn" data-a="start">Start: spin for first pick</button>`;
  if(S.mode==='online')
    return `<label class="pname" style="--tc:${pc(0)}"><span>Your name</span><input id="n0" type="text" maxlength="14" value="${esc(S.names[0])}"></label>
      <div class="onlinebox">
      ${S.joinOpen?`<div class="joinrow"><input id="ocode" type="text" maxlength="4" autocapitalize="characters" autocomplete="off" placeholder="CODE" value="${esc(S.joinCode||'')}" aria-label="Room code"><button class="btn" data-a="ojoin">Join</button></div>
      <button class="btn ghost" data-a="ojoinopen">Back</button>`
      :`<button class="btn" data-a="ocreate">Create a game</button>
      <button class="btn ghost" data-a="ojoinopen">Join a game</button>`}
      ${S.onlineMsg?`<p class="hint onlinemsg">${esc(S.onlineMsg)}</p>`:S.joinOpen?'<p class="hint">Type the 4-letter code shown on the host’s phone.</p>':'<p class="hint">Create a game and share the code. Up to three friends join from their own phones. With 3 or 4 players it’s a free-for-all.</p>'}</div>
      ${S.joinOpen?'':`<details class="subset" id="onlineset"><summary>Room settings <span class="muted">· ${c.budget} pts · ${c.poolType==='all'?'All characters':'Random pool'}${c.duo?' · 2v2':''}</span></summary>${pts}
        <div class="setline"><span class="tlabel">If 4 players join</span>${seg('cfgduo',c.duo?'on':'off',[['off','Free-for-all'],['on','2v2 teams']])}</div>${pool}</details>`}`;
  const won=storyWon();
  return `<div class="storyhead"><div class="sprog" style="--won:${won/STAGES.length*100}"><b>${won}</b><span>of ${STAGES.length} battles won</span></div>
      <p class="hint">Relive the arcs with the canon squads, from Mount Sagiri to the last dawn, plus two Yoriichi flashbacks. Every battle opens with a scene.</p></div>
    <button class="btn" data-a="storymap">${won?'Continue the story':'Begin the story'}</button>`;
}
/* ---------- codex ---------- */
// Every card in the game, filtered by group. Locked cards say which story battle unlocks them.
const CODEX_GROUPS = [['all','All'],['slayer','Slayers'],['demon','Demons'],['helper','Helpers']];
const codexGroup = c => c.helper ? 'helper' : c.demon && !['nezuko','tamayo','yushiro'].includes(c.fam) ? 'demon' : 'slayer';
function vCodex(){
  const f=S.codexF||'all', cards=ROSTER.filter(c=>!c.spawn && (f==='all'||codexGroup(c)===f)).sort((a,b)=>b.cost-a.cost||a.name.localeCompare(b.name));
  const open=ROSTER.filter(c=>!c.spawn && isUnlocked(c.id)).length, total=ROSTER.filter(c=>!c.spawn).length;
  return `${topbar('Codex', 'Every character')}
    <p class="muted">${open} of ${total} unlocked. Win story battles to unlock the rest. Tap a card to read it.</p>
    ${seg('codexf',f,CODEX_GROUPS)}
    <div class="grid codex">${cards.map(c=>{ const lock=!isUnlocked(c.id), rec=loadRecords()[c.id];
      return `<button class="card ${glyphCls(c)}${lock?' locked':''}" data-a="codexsel" data-v="${c.id}">
        <span class="cart">${ART[c.id]?`<img src="${ART[c.id]}" alt="">`:`<span class="ck">${c.g}</span>`}</span>
        <span class="cost${c.cost>=12?' big':''}">${c.cost}<small>pts</small></span>${lock?'<span class="lockbadge">🔒</span>':''}
        <span class="cbody"><span class="cn">${esc(c.name)}</span><span class="ct">${esc(c.type)}</span>${c.helper?`<span class="ct">${esc(c.sig.tag)}</span>`:statCells(c)}</span>
        ${rec?`<span class="crec">${Math.round(rec[1]/rec[0]*100)}% · ${plural(rec[0],'game')}</span>`:''}</button>`; }).join('')}</div>`;
}
// A card's full entry in the Codex
function codexSheet(){
  const c=BYID[S.codexSel]; if(!c) return '';
  const pas=[c.passive, c.mark?MARK_PASSIVE:''].filter(Boolean), rec=loadRecords()[c.id], ui=unlockStage(c.id), lock=!isUnlocked(c.id);
  const notes=c.helper?[]:allNotesFor(c.id);
  return `<div class="scrim" data-a="unsel"></div><div class="modal"><div class="in ${glyphCls(c)}" role="dialog" aria-modal="true" aria-label="${esc(c.name)}">
    <button class="x" data-a="unsel" aria-label="Close">×</button>
    ${banner(c)}
    <div class="shead">${seal(c,'lg')}<div><div class="eyebrow">${esc(c.type)}</div><h2>${esc(c.name)}</h2></div><span class="cost${c.cost>=12?' big':''}">${c.cost}<small>pts</small></span></div>
    ${lock?`<div class="lockline">🔒 Locked. Win <b>${esc(STAGES[ui].title)}</b> (story battle ${ui+1}) to play with ${esc(c.short)} in every mode.</div>`
      : ui>=0?`<div class="muted">Unlocked in story battle ${ui+1}: ${esc(STAGES[ui].title)}.</div>`:''}
    ${c.helper?'':statCells(c)}
    <div class="sig"><div class="sname">${esc(c.sig.name)}${c.helper?'':` <span class="muted">· special, cooldown ${c.sig.cd}</span>`}</div>${esc(c.sig.desc)}</div>
    ${c.basic?`<div class="pas"><b>${esc(c.basic.name)}</b> (instead of Attack): ${esc(c.basic.desc)}</div>`:''}
    ${c.regen?`<div class="pas">Regenerates ${c.regen} HP every round.</div>`:''}
    ${pas.map(x=>`<div class="pas">${esc(x)}</div>`).join('')}
    ${c.helper?'<div class="pas">Back-pocket helper: doesn\'t fight or take a fighter slot. Use it once, on the round you choose.</div>':''}
    ${c.splits?splitTree(c):''}
    <div class="recline">${rec?`On this phone: won <b>${rec[1]} of ${plural(rec[0],'game')}</b> (${Math.round(rec[1]/rec[0]*100)}%)`:'Not played on this phone yet'}</div>
    ${notes.length?`<div class="mnotes"><div class="tlabel">Synergies and matchups</div>${notes.map(n=>`<div class="note"><div class="nh"><span class="nk ${n.kind}">${n.kind==='team'?'Same team':'Opponents'}</span></div><div class="nt">${esc(n.title)}</div><div class="nx">${esc(n.text)}</div></div>`).join('')}</div>`:''}
    <div class="row"><button class="btn ghost" data-a="unsel">Close</button></div>
  </div></div>`;
}
// Today's challenge on the main menu (built just after the menu first draws: it runs a few test battles)
function dailyCard(){
  const ch=DAILY_CACHE&&DAILY_CACHE.day===todayKey()?DAILY_CACHE:null, done=dailyDone(), streak=dailyStreak();
  if(!ch) return `<div class="daily loading"><span class="dk">日</span><div><div class="eyebrow">Daily challenge</div><div class="muted">Preparing today's battle…</div></div></div>`;
  const row=ids=>ids.map(id=>seal(BYID[id],'sm')).join('');
  return `<div class="daily${done?' done':''}"><span class="dk">日</span>
    <div class="dbody"><div class="eyebrow">Daily challenge${streak?` · 🔥 ${plural(streak,'day')}`:''}</div>
      <div class="dgoal">${esc(DAILY_GOALS[ch.goal.type](ch.goal))}</div>
      <div class="dsq">${row(ch.mine)}<span class="svs">vs</span>${row(ch.enemy)}</div></div>
    <button class="btn small${done?' ghost':''}" data-a="daily">${done?'Done ✓ Replay':'Play'}</button></div>`;
}
function vSetup(){
  return `
  <div class="setbar"><button class="btn ghost small gear" data-a="codex"><span aria-hidden="true">📖</span> Codex</button><button class="btn ghost small gear" data-a="settings" aria-label="Settings"><span aria-hidden="true">⚙</span> Settings</button></div>
  <div class="hero"><span class="kanji" aria-hidden="true">滅</span>
    <div class="eyebrow">A Demon Slayer squad battler</div><h1>Squad Draft</h1>
    <p class="muted">Draft a squad. Pick secret moves each round. Last team standing wins.</p></div>
  ${artStrip()}
  ${dailyCard()}
  <div class="modes">${MODE_CARDS.map(([k,kj,t,sub])=>`<button class="mode${S.mode===k?' on':''}" data-a="mode" data-v="${k}" aria-pressed="${S.mode===k}"><span class="mk">${kj}</span><b>${t}</b><small>${sub}</small></button>`).join('')}</div>
  <div class="panel modepanel"><div class="eyebrow">${esc(MODE_CARDS.find(m=>m[0]===S.mode)[2])}</div>${modeSettings()}</div>
  <details class="panel" id="howto"><summary>How to play</summary><ul>
    <li><b>Modes:</b> Local Multiplayer passes one phone around (2–4 players), Online uses a phone each (2–4), Quickplay is you against 1–3 computers, Practice lets you draft every team (the computers’ too) to set up the match you want, and Story Mode is 21 battles with the canon squads.</li>
    <li><b>Max fighters per team</b> (1–6, per mode) limits squad size, e.g. 1 for one-on-one duels.</li>
    <li><b>Free-for-all</b> (3 or 4 players): every team fights every other team and the last one standing wins. A special that hits “every enemy” hits the whole team you aim at. Cards over ${FFA_MAX_COST} pts aren't dealt.</li>
    <li><b>Draft:</b> a wheel decides who picks first, then snake order (A, B, B, A… or A, B, C, C, B, A…) on your points, up to 6 fighters. Tap <b>Lock team</b> when you're done; the others keep drafting until they lock or run out of points.</li>
    <li><b>Pool notes</b> list the synergies and matchups possible with the characters dealt.</li>
    <li><b>Legends:</b> Yoriichi (18) and Yoriichi at 85 (17) strike twice per Attack and cap the damage they take each round. They're rare.</li>
    <li><b>Hantengu</b> splits into his four emotions when he falls; when the last one falls they merge into Zohakuten.</li>
    <li><b>Marks ✦:</b> cost more, hit harder and recharge their special a round faster.</li>
    <li><b>Each round</b> every fighter secretly picks Attack, Defend (half damage) or their Special. Fastest goes first. ↻ Repeat copies your previous moves.</li>
    <li><b>Back pocket:</b> you may draft one 1 pt helper (Chachamaru, Kasugai Crow, Muscle Mice or Hotaru). It doesn't fight; use it once, on the round you choose.</li>
    <li><b>Health</b> is shown as a percent of each fighter's own max. It turns red at 25%.</li>
    <li><b>Damage</b> = PWR − target's DEF, but never less than half the attacker's power. Demons regenerate; poison ticks.</li>
    <li><b>Synergies</b> and matchups are listed in the draft's Pool notes and on each card.</li>
  </ul></details>`;
}

/* ---------- who picks first ---------- */
function vSpin(){
  const sp=S.spin, done=sp&&sp.state==='done', R=96, segs=wheelSegs(), seg=360/segs, n=nPlayers(), guest=isOnline()&&!iAmHost();
  const pt=(a,r)=>{ const t=a*Math.PI/180; return `${(100+r*Math.sin(t)).toFixed(2)} ${(100-r*Math.cos(t)).toFixed(2)}`; };
  const slices=Array.from({length:segs},(_,i)=>{ const p=i%n, a0=i*seg, a1=a0+seg;
    return `<path d="M100 100 L${pt(a0,R)} A${R} ${R} 0 0 1 ${pt(a1,R)} Z" style="fill:${pc(p)}"/>
      <text x="100" y="${n>2?32:40}" transform="rotate(${a0+seg/2} 100 100)"${n>2?' style="font-size:9px"':''}>${esc(S.names[p].slice(0,8))}</text>`; }).join('');
  const wheel=`<div class="wheelbox"><span class="pointer" aria-hidden="true"></span>
    <svg class="wheel" viewBox="0 0 200 200" style="transform:rotate(${done?sp.angle:0}deg)" role="img" aria-label="Wheel with ${players().map(nm).join(', ')}">
      <circle cx="100" cy="100" r="99" class="rim"/>${slices}</svg>
    <button class="hubbtn${sp||guest?'':' ready'}" data-a="spin" ${sp||guest?'disabled':''} aria-label="Spin the wheel">滅</button></div>`;
  const status = done
    ? `<div class="spinres" style="color:${pc(sp.r)}">${nm(sp.r)} picks first</div>${actionbar(guest?`<button class="btn" disabled>Waiting for ${nm(0)} to start…</button>`:`<button class="btn team" data-a="toDraft" style="--bc:${pc(sp.r)}">Start the draft</button>`)}`
    : `<div class="spinhint">${sp?'Spinning…':guest?`${nm(0)} spins the wheel`:'Tap the 滅 seal to spin'}</div>`;
  return `${topbar('Before the draft', 'Who picks first?')}<div class="spin">${wheel}${status}</div>`;
}

/* ---------- draft ---------- */
function cardHTML(c,p){
  const owner=S.picks.findIndex(t=>t.includes(c.id)), ban=(S.bans||[]).find(b=>BYID[b.id].fam===c.fam);
  const ok = S.banning ? canBan(p,c.id) : canPick(p,c.id);
  const badge = c.legend?'Legend':c.mark?'✦ Mark':'';
  // picture-first card: art on top (kanji if no picture), name and type over its lower edge, stats below
  return `<button class="card ${glyphCls(c)}${ok?'':' off'}${S.sel===c.id?' sel':''}${owner>=0?' taken':''}" data-a="sel" data-v="${c.id}" ${ok?'':'aria-disabled="true"'}>
    <span class="cart">${ART[c.id]?`<img src="${ART[c.id]}" alt="">`:`<span class="ck">${c.g}</span>`}</span>
    <span class="cost${c.cost>=12?' big':''}">${c.cost}<small>pts</small></span>
    ${badge?`<span class="badge">${badge}</span>`:''}
    <span class="cbody"><span class="cn">${esc(c.name)}</span><span class="ct">${esc(c.type)}</span>${statCells(c)}</span>
    ${owner>=0?`<span class="tag" style="background:${pc(owner)}">${nm(owner)}</span>`:ban?`<span class="tag banned">Banned · ${nm(ban.p)}</span>`:''}</button>`;
}
function teamBox(q,p){
  const left=budget()-spent(q);
  return `<div class="tbox${p===q&&!S.locked[q]?' active':''}" style="--tc:${pc(q)}">
    <div class="tn"><span>${nm(q)}${q===myP()&&soloView()&&S.mode!=='story'?' <small>(you)</small>':''}${S.duo?` <small class="tside">Team ${sideOf(q)+1}</small>`:''}</span><span>${S.mode==='story'&&q===1?'Enemy':S.locked[q]?'Locked':left+' pts left'}</span></div>
    <div class="meter" role="img" aria-label="${spent(q)} of ${budget()} points spent"><i style="width:${Math.min(100,spent(q)/budget()*100)}%"></i></div>
    <div class="slots">${S.picks[q].map(id=>seal(BYID[id],'xs')).join('')}${!S.locked[q]&&fighterIds(q).length<teamCap()?'<span class="slot empty"></span>':''}</div></div>`;
}
function vDraft(){
  // cpuTurn = the other side is picking (the computer, or the other phone online): this phone waits
  const p = turn(), cpuTurn = (S.mode==='cpu' && p!==0) || (isOnline() && p!==S.me), story = S.mode==='story', forCpu = isPractice() && p!==0;
  const fresh = allPicks().length===0, left=budget()-spent(p);
  // second pick in a row (snake order), or everyone else has locked and this one keeps going
  const restLocked = others(p).every(q=>S.locked[q]);
  const again = S.lastPicker===p && !restLocked;
  const verb = restLocked && others(p).some(q=>S.picks[q].length) ? 'keeps picking' : again ? 'picks again' : cpuTurn ? 'is picking' : 'picks';
  const lockbar = !cpuTurn && !S.banning && fighterIds(p).length ? `<div class="lockbar"><span>${story?'Ready to fight?':forCpu?`Done picking for ${nm(p)}?`:'Done picking?'}${left?` ${left} pts go unused.`:''}</span>
    <button class="btn team small" data-a="lock" style="--bc:${pc(p)}">${story?'Fight':forCpu?`Lock ${nm(p)}`:'Lock team'}</button></div>` : '';
  // Undo the latest pick (2 players: either player's; vs computer: only your own)
  const un=!S.banning && undoable(), undo = un && (S.mode==='local' || isPractice() || un.p===myP())
    ? `<button class="btn ghost small undo" data-a="undo">↶ Undo ${nm(un.p)}'s ${esc(BYID[un.id].short)}</button>` : '';
  const st=story&&STAGES[S.stage];
  return `<div class="draftlayout"><div class="dtop">
    ${story?topbar(`Story · Battle ${S.stage+1} · ${esc(st.title)}`,'Draft replay'):topbar(S.banning?`Ban round · ${S.bans.length+1} of ${nPlayers()}`:forCpu?'Practice · you pick for the computer':'Draft',
      S.banning ? (forCpu?`Ban for <span style="color:${pc(p)}">${nm(p)}</span>`:`<span style="color:${pc(p)}">${nm(p)}</span> ${cpuTurn?'is banning…':'bans a character'}`)
      : forCpu?`Pick for <span style="color:${pc(p)}">${nm(p)}</span>`:`<span style="color:${pc(p)}">${nm(p)}</span> ${verb}${cpuTurn?'…':''}`)}
    ${S.banning?`<p class="hint">Tap a card and ban it: nobody can pick that character this match.${S.bans.length?` Banned so far: ${S.bans.map(b=>esc(BYID[b.id].short)).join(', ')}.`:''}</p>`:''}
    ${story?`<p class="hint">${esc(st.blurb)} You have ${budget()} points. Only the Corps and its allies fight for you.</p>`:''}
    ${S.banning?'':orderStrip(p)}
    <div class="teams${nPlayers()>2?' many':''}">${players().map(q=>teamBox(q,p)).join('')}</div>
    ${lockbar}
    <div class="dealt"><span>${(n=>story?`The Corps · ${n} characters`:S.poolType==='all'?`All ${n} characters`:`${n} characters dealt`)(S.pool.filter(id=>!isHelper(id)).length)} · tap one to see it</span>${undo}${fresh&&!cpuTurn&&!story&&S.poolType!=='all'&&(!isOnline()||iAmHost())?'<button class="btn ghost small" data-a="redeal">Re-deal</button>':''}</div></div>
    ${notesPanel()}
    <div class="grid">${S.pool.filter(id=>!isHelper(id)).map(id=>cardHTML(BYID[id],p)).join('')}</div>
    ${S.banning?'':pocketDraft(p)}</div>`;
}
// The back-pocket helpers in the draft: a slim optional row at the bottom. 1 pt, one helper per player.
function pocketDraft(p){
  const hs=S.pool.filter(isHelper); if(!hs.length) return '';
  return `<section class="pocket"><div class="pockethead"><span class="tlabel">Back pocket</span><span class="muted">Optional · pick one 1 pt helper · used once in battle</span></div>
    <div class="pocketrow">${hs.map(id=>{ const c=BYID[id], owner=S.picks.findIndex(t=>t.includes(id)), ok=canPick(p,id);
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
  return `<div class="crow"><div class="crowhead">${seal(BYID.crow,'sm')}<b>Crow report</b><span class="muted">${nPlayers()>2?'Everyone else':nm(others(p)[0])+"'s"} moves this round</span></div>
    ${others(p).filter(q=>alive(q).length).map(q=>`${nPlayers()>2?`<div class="crowteam" style="color:${pc(q)}">${nm(q)}</div>`:''}
      ${alive(q).map(e=>`<div class="crowline">${seal(e,'pip')}<b>${esc(e.name)}</b><span>${moveSummary(e)}</span></div>`).join('')}
      ${(S.helperPlan[q]||[]).length?`<div class="crowline"><span>Back pocket: ${(S.helperPlan[q]).map(id=>esc(BYID[id].short)).join(', ')}</span></div>`:''}`).join('')}</div>`;
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
// Online lobby: the host shares the room code; up to three guests take seats 2–4. The host starts when ready.
function vLobby(){
  const L=S.lobby||{}, host=iAmHost(), seats=L.seats||[], taken=seats.filter(x=>x&&x.on).length, ok=taken>=1 && seats.slice(0,taken).every(x=>x&&x.on);
  const seat=(i,name,on)=>`<div class="seat${on?' on':''}" style="--tc:${pc(i)}"><span class="sn">${i+1}</span><b>${on?esc(name):'Open seat'}</b>${i===0?'<small>host</small>':i===S.me&&!host?'<small>you</small>':''}</div>`;
  return `${topbar('Online game', host?'Your room':'Joined')}
    <div class="lobby">
      <div class="tlabel">Room code</div><div class="roomcode">${esc(L.code||'····')}</div>
      <p class="muted">${host?(taken?`${plural(taken+1,'player')} in the room. Start whenever everyone's in (up to 4).`:'Friends tap Online → Join a game and type this code.')
        :`You're in ${nm(0)}'s room. Waiting for ${nm(0)} to start…`}</p>
      <div class="seats">${[0,1,2,3].map(i=>i===0?seat(0,S.lobbyHost||S.names[0],true):seat(i,(seats[i-1]||{}).name,(seats[i-1]||{}).on)).join('')}</div>
      ${taken>=2?'<p class="hint">3 or 4 players: free-for-all. Every team fights every other team.</p>':''}
    </div>
    ${host?actionbar(`<button class="btn" data-a="ostart" ${ok?'':'disabled'}>${ok?`Start with ${taken+1}: spin for first pick`:'Waiting for players…'}</button>`):''}`;
}
// Who picks next: the current pick and the next few, so a double pick is never a surprise
function orderStrip(p){
  if(S.locked.filter(x=>!x).length<2) return '';
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
// Hantengu's split forms, shown on his card: each form, what it becomes when it falls, and the form they merge into
function splitTree(c){
  const form=id=>{ const f=BYID[id]; return `<div class="sform">${seal(f,'sm')}<div><b>${esc(f.short)}</b> <span class="muted">${f.hp} HP · PWR ${f.pow} · SPD ${f.spd}</span><br><span class="sx">${esc(f.sig.name)}: ${esc(f.sig.desc)}</span>${f.splits?`<div class="sthen">falls → ${f.splits.map(k=>esc(BYID[k].short)).join(', ')}</div>`:''}</div></div>`; };
  const all=[]; const walk=id=>{ (BYID[id].splits||[]).forEach(k=>{ all.push(k); }); (BYID[id].splits||[]).forEach(walk); }; walk(c.id);
  const merged=[...new Set(all.map(id=>BYID[id].merge).filter(Boolean))];
  return `<div class="splits"><div class="tlabel">Splits into</div>${all.map(form).join('')}
    ${merged.map(id=>`<div class="tlabel">When the last one falls, they merge into</div>${form(id)}`).join('')}</div>`;
}
// Fighter info card in battle: tap any picture (yours or the opponent's). Shows current stats, which include
// team bonuses and anything gained in the match, plus the special's cooldown, passives and status effects.
function vInfo(){
  const u=findU(S.info); if(!u) return '';
  const c=BYID[u.id], pas=[c.passive, c.mark?MARK_PASSIVE:''].filter(Boolean);
  const yours = soloView() ? u.p===myP() : S.phase==='plan' ? u.p===S.planFor : null;
  const side = yours===null || (!yours && nPlayers()>2) ? nm(u.p) : yours ? 'Your team' : 'Opponent';
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
    <div class="big">${standing().length>2?'All squads are ready':'Both squads are ready'}</div>
    <div class="rvs">${standing().map(row).join('<span class="rx">VS</span>')}</div>
    <p class="muted">Put the phone where everyone can see it.</p>
    <button class="btn" data-a="fight">Start the battle</button></div>`;
}
// Stats (a tab in Settings): wins per player name and per-character records, on this phone.
// Only Local, Online and Quickplay games count: not Story (preset, boosted fights) or Practice (curated matches).
function statsTab(){
  const sc=loadScore(), top=Object.entries(sc).sort((a,b)=>b[1]-a[1]);
  return `<div class="setgroup"><div class="tlabel">All-time wins</div>
      <div class="score">${top.length ? top.slice(0,6).map(([k,v])=>`<div><b>${v}</b>${esc(k)}</div>`).join('') : '<div class="muted">No matches yet</div>'}</div></div>
    ${recordsPanel()}
    <div class="hint">Counts Local, Online and Quickplay games on this phone. Story and Practice battles don't count.</div>`;
}
// Settings (gear on the main screen): general options only. Match settings live with each mode on the main menu.
function vSettings(){
  return `<div class="scrim" data-a="unsel"></div><div class="modal"><div class="in" role="dialog" aria-modal="true" aria-label="Settings">
    <button class="x" data-a="unsel" aria-label="Close">×</button>
    <h2>Settings</h2>
    ${seg('settab',S.setTab||'general',[['general','General'],['stats','Stats']])}
    ${S.setTab==='stats'?statsTab():`<div class="setgroup"><div class="tlabel">Playback speed</div>
      ${seg('speed',S.speed||'normal',[['slow','Slow'],['normal','Normal'],['fast','Fast']])}
      <div class="hint">How long each action stays on screen during a round.</div></div>
    <div class="setgroup"><div class="tlabel">Sound effects</div>${seg('sound',S.soundOn?'on':'off',[['on','On'],['off','Off']])}</div>
    <div class="setgroup"><div class="tlabel">Vibration on knockouts</div>${seg('vibe',S.vibeOn===false?'off':'on',[['on','On'],['off','Off']])}
      <div class="hint">Android phones only (iPhones don't allow it).</div></div>
    <div class="hint">Saved on this phone. Players, points, pool and difficulty are set per mode on the main menu.</div>`}
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
  if(S.phase==='codex') return codexSheet();
  if(S.info) return vInfo();
  if(S.phase!=='draft' || !S.sel) return '';
  const c=BYID[S.sel], p=isOnline()?S.me:turn(), ok=(S.banning?canBan(p,c.id):canPick(p,c.id)) && (!isOnline() || turn()===S.me), verbBtn=S.banning?'Ban':'Confirm';
  if(c.helper) return `<div class="scrim" data-a="unsel"></div><div class="modal"><div class="in" role="dialog" aria-modal="true" aria-label="${esc(c.name)}">
    <button class="x" data-a="unsel" aria-label="Close">×</button>
    <div class="shead">${seal(c,'lg')}<div><div class="eyebrow">${esc(c.type)}</div><h2>${esc(c.name)}</h2></div><span class="cost">${c.cost}<small>pt</small></span></div>
    <div class="sig"><div class="sname">${esc(c.sig.name)}</div>${esc(c.sig.desc)}</div>
    <div class="pas">Back-pocket helper: doesn't fight, can't be attacked and doesn't take a fighter slot. On the move screen, tap Use on the round you want. It acts first that round, then leaves.</div>
    <div class="row"><button class="btn ghost" data-a="unsel">Close</button>${ok?`<button class="btn team${S.banning?' banbtn':''}" data-a="confirmPick" style="--bc:${pc(p)}">${verbBtn} ${esc(c.short)}</button>`:''}</div>
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
    <div class="row"><button class="btn ghost" data-a="unsel">Close</button>${ok?`<button class="btn team${S.banning?' banbtn':''}" data-a="confirmPick" style="--bc:${pc(p)}">${verbBtn} ${esc(c.short)}</button>`:''}</div>
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
    <p class="muted">${S.passScout?`${nm(p)}'s Kasugai Crow is back with a report. Everyone else, look away.`:`${others(p).length>1?'Everyone else':nm(others(p)[0])}, no peeking at their moves.`}</p>
    <button class="btn team" data-a="reveal" style="--bc:${pc(p)}">I'm ${nm(p)}. Show my team</button></div>`;
}
function vPlan(){
  const p=S.planFor, open=focusOf(p), ready=planReady(p), mine=alive(p);
  if(isOnline() && !mine.length) return waitScreen(`Round ${S.round}`, "You're out", 'Your squad has fallen. You can keep watching the others fight.');
  if(isOnline() && S.movesLocked && S.movesLocked[p] && !S.scouting){
    const wait=players().filter(q=>q!==p && alive(q).length && !S.movesLocked[q]);
    return waitScreen(`Round ${S.round}`, 'Moves locked in', `Waiting for ${wait.length?wait.map(nm).join(', '):'the others'} to choose…`); }
  // the open fighter needs an enemy target: opponents become tappable
  const ou=open&&findU(open), opl=ou&&S.plans[p][ou.uid]||{}, picking=ou && needsTarget(ou,opl) && !isAllyMove(ou,opl);
  const aimers=e=>mine.filter(m=>{ const q=S.plans[p][m.uid]; return q && q.t===e.uid && needsTarget(m,q) && !isAllyMove(m,q); });
  // knocked-out fighters aren't shown on the move screen (either side)
  const enemyMoment=e=>!e.alive ? {hidden:true} : ({aimed:aimers(e), ...(picking?{tgtFor:ou.uid, picked:opl.t===e.uid}:{})});
  const goal = S.mode==='story' && STAGES[S.stage] ? twistText(STAGES[S.stage]) : '';
  return `${topbar(`Round ${S.round}`, `<span style="color:${pc(p)}">${nm(p)}</span>, choose`)}
    ${goal?`<div class="goal">${esc(goal)}${S.twist&&S.twist.survive?` · ${plural(Math.max(0,S.twist.survive-S.round+1),'round')} to go`:''}</div>`:''}
    ${strengthBar(p)}
    <div class="planwide"><div class="opps${nPlayers()>2?' many':''}">${enemiesOf(p).filter(q=>alive(q).length).map(q=>teamBlock(q,nPlayers()>2?null:'Opponent',enemyMoment,true,picking?`Tap to target with ${esc(ou.name)}`:'')).join('')}
      ${partnersOf(p).filter(q=>alive(q).length).map(q=>teamBlock(q,`${nm(q)} · your partner`,e=>!e.alive?{hidden:true}:{},true)).join('')}</div>
    ${picking&&aimsTeam(ou)&&opl.type==='special'?`<p class="hint aimhint">${esc(ou.sig.name.split(':')[0])} hits every fighter on the team you aim at.</p>`:''}
    <section class="side"><div class="sidehead"><span class="tname" style="color:${pc(p)}">Your team</span>${S.lastPlans&&S.lastPlans[p]?'<button class="btn ghost small" data-a="repeat">↻ Repeat</button>':''}</div>
      ${S.scouting?crowReport(p):''}<div class="fighters">${alive(p).map(u=>fighter(u,u.uid===open)).join('')}</div></section></div>
    ${actionbar(`${pocketChip(p)}<button class="btn team" data-a="lockMoves" ${ready?'':'disabled'} style="--bc:${pc(p)}">${ready?'Lock in moves':`${mine.filter(unitReady).length} of ${plural(mine.length,'fighter')} ready`}</button>`)}`;
}

/* ---------- results ---------- */
// The team drawn on the left of the fight stage: yours (or player 1 when the phone is shared)
const leftSide = () => soloView() ? myP() : 0;
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
  const rev = duo && by.p!==on.p && by.p!==leftSide();
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
// Special-move cut-in: the fighter's art slides across a slanted band with the move's name and their line,
// from the left for the team on the left of the stage, from the right for everyone else
function cutin(u){
  const style=styleOf(u,'special'), right=u.p!==leftSide();
  return `<div class="cutin sty sty-${style}${right?' right':''}" style="--tc:${pc(u.p)}" aria-hidden="true">
    <span class="lines"></span>
    <div class="band"><span class="cimg">${ART[u.id]?`<img src="${ART[u.id]}" alt="">`:`<span class="ck">${u.g}</span>`}</span>
      <div class="ctext"><span class="cwho" style="color:${pc(u.p)}">${esc(u.name)}</span><span class="cmove">${esc(u.sig.name)}</span>${u.sig.quote?`<span class="cquote">“${esc(u.sig.quote)}”</span>`:''}</div></div>
    <span class="ckanji">${STYLE_KANJI[style]||'技'}</span></div>`;
}
// One beat for a special that hits several enemies: the attacker strikes once, every target recoils together with
// its own damage number, and any it knocks out topple over
function stageGroup(lines){
  const by=findU(lines[0].by), style=styleOf(by,'special'), rev=by.p!==leftSide();
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
  const actor=done?null:(cur.by&&findU(lines[0].by))||allUnits().filter(u=>cur.t.startsWith(u.name)).sort((a,b)=>b.name.length-a.name.length)[0];
  const moment = u => done ? {} : cur.hp[u.uid]===undefined ? {hidden:true} : {hp:cur.hp[u.uid], from:prev.hp[u.uid]??cur.hp[u.uid],
    flash: lines.some(l=>l.ko===u.uid) ? 'ko' : prev.hp[u.uid]===undefined ? 'spawn' : cur.hp[u.uid]<prev.hp[u.uid] ? 'hit' : cur.hp[u.uid]>prev.hp[u.uid] ? 'heal' : actor===u ? 'acting' : ''};
  const step=done?0:S.play.k, total=done?0:steps.length-1;
  // fighters in this beat (attacker and targets) stay bright in the slim team rows; the rest fade back
  const involved=new Set(lines.flatMap(l=>[l.by,l.on,l.ko]).filter(Boolean));
  // vs computer the screen is yours, so label the teams from your side; two players share it, so keep names
  const solo=soloView(), me=myP(), them=[...enemiesOf(me), ...partnersOf(me)], multi=nPlayers()>2;
  const waiting = isOnline() && S.readyNext && S.readyNext[me] && !S.final;
  const slow = them.filter(q=>S.readyNext&&!S.readyNext[q]);
  const next = S.final ? '<button class="btn" data-a="finish">See who won</button>'
    : waiting ? `<button class="btn" disabled>Waiting for ${slow.length?slow.map(nm).join(', '):'the others'}…</button>` : '<button class="btn" data-a="next">Next round</button>';
  return `${topbar(`Round ${S.round}${done?'':` · ${step} of ${total}`}`, done?'What happened':'The clash', false)}
    ${strengthBar(me, done?undefined:u=>cur.hp[u.uid], done?undefined:u=>prev.hp[u.uid])}
    <div class="reswide${done?' done':''}"><div class="rcol">${them.map(q=>done?teamBlock(q,solo&&!multi?'Opponent':null,moment):miniTeam(q,moment,involved)).join('')}</div>
    ${done?vsDivider():group?`<div class="now${lines.some(bigHit)?' big':''}${lines.some(l=>l.fx==='ko')?' k':''}" aria-live="polite">${stageGroup(lines)}<span>${groupSummary(lines)}</span></div>`
      :k&&cur.fx==='special'&&findU(cur.by)?`<div class="now cut" aria-live="polite">${cutin(findU(cur.by))}<span class="sr">${fmtLog(cur.t)}</span></div>`
      :k?`<div class="now ${cur.c}${bigHit(cur)?' big':''}" aria-live="polite">${stage(cur)}<span>${fmtLog(cur.t)}</span></div>`
      :`<div class="now intro" aria-live="polite"><span class="ir">Round ${S.round}</span><span class="ig">Fight!</span></div>`}
    <div class="rcol">${done?teamBlock(me,solo?'Your team':null,moment):miniTeam(me,moment,involved)}</div></div>
    ${done?`<div class="panel"><div class="tlabel">Round log</div>${logHTML()}</div>`:''}
    ${actionbar(done ? next : '<button class="btn ghost" data-a="skip">Skip</button>')}`;
}
// MVP of the match plus a few awards, from S.stats (see tallyRound in engine.js)
function mvpPanel(){
  const all=allUnits().filter(u=>!u.spawn || S.stats[u.uid]).map(u=>({u, s:S.stats[u.uid]||{dmg:0,kos:0,heal:0,best:0}}));
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
// Story map: the stages in order, grouped by arc. Each shows your preset squad vs the enemy, and its twist.
// A cleared stage can be replayed with a draft (same points as the preset squad).
function vStory(){
  const done=loadStory().cleared;
  let arc='';
  return `${topbar('Story mode', 'The Demon Slayer Corps')}
    <p class="muted">${done.filter(id=>STAGES.some(s=>s.id===id)).length} of ${STAGES.length} battles won. Win one to unlock the next. Won battles can be replayed with your own draft.</p>
    <div class="stages">${STAGES.map((st,i)=>{ const open=stageUnlocked(i), clear=stageCleared(i), tw=twistText(st);
      const head = st.arc!==arc ? `<div class="archead">${(arc=st.arc, `<span class="arcg">${ARCS[st.arc].g}</span>${esc(ARCS[st.arc].title)}`)}</div>` : '';
      return `${head}<div class="stagecard${clear?' clear':''}${open?'':' locked'}${st.arc==='flashback'?' flash':''}">
        <span class="snum">${clear?'✓':open?i+1:'🔒'}</span>
        <span class="sinfo"><span class="stitle">${esc(st.title)}</span><span class="splace">${esc(st.place)} · vs ${esc(st.foe)}</span>
          <span class="sblurb">${esc(st.blurb)}</span>
          ${tw||st.boosts?`<span class="stags">${tw?`<span class="stwist">${esc(tw)}</span>`:''}${(st.boosts||[]).map(b=>`<span class="stwist ${b.side?'foe':'ally'}">${esc(b.label)}</span>`).join('')}</span>`:''}
          <span class="sfoot"><span class="sseals">${st.mine.map(id=>seal(BYID[id],'sm')).join('')}<span class="svs">vs</span>${st.enemy.map(id=>seal(BYID[id],'sm')).join('')}</span></span>
          ${open?`<span class="sbtns"><button class="btn small" data-a="stage" data-v="${i}">${clear?'Play again':'Play'}</button>${clear?`<button class="btn ghost small" data-a="stagedraft" data-v="${i}">Draft replay · ${stageBudget(st)} pts</button>`:''}</span>`:''}</span></div>`; }).join('')}</div>`;
}
// Particles drifting over each arc's scene (embers, snow, petals…)
const ARC_FX = {prologue:'snow', asakusa:'petal', flashback:'ember', tsuzumi:'dust', natagumo:'thread', mugen:'ember', district:'petal', swordsmith:'leaf', castle:'dust', dawn:'ember'};
// The scene before a story battle: allies speak from the left, enemies from the right, the line types itself out.
// Tap to finish the line, tap again for the next. After the last line, a versus card shows both squads and the twist.
function vScene(){
  const st=STAGES[S.stage], lines=st.scene;
  const fx=`<span class="particles p-${ARC_FX[st.arc]||'dust'}" aria-hidden="true">${Array.from({length:14},(_,i)=>`<i style="--x:${(i*37)%100}%;--d:${(i*0.73)%6}s;--s:${0.6+(i%5)*0.15}"></i>`).join('')}</span>`;
  const head=`<div class="scenetop"><div><div class="eyebrow">${esc(ARCS[st.arc].title)} · Battle ${S.stage+1} of ${STAGES.length}</div><div class="title">${esc(st.title)}</div><div class="splace">${esc(st.place)}</div></div>
      <button class="btn ghost small" data-a="sceneskip">Skip</button></div>`;
  if(S.sceneVs){
    const tw=twistText(st), row=ids=>ids.filter(id=>!BYID[id].helper).map(id=>`<span class="vsc">${seal(BYID[id],'lg')}<small>${esc(BYID[id].short)}</small></span>`).join('');
    const mine=S.storyDraft?'<span class="muted">Your draft</span>':row(st.mine);
    return `<div class="scene arc-${st.arc} vscard"><span class="lbox t" aria-hidden="true"></span>${fx}<span class="scenebg" aria-hidden="true">${ARCS[st.arc].g}</span>${head}
      <div class="vsrow l">${mine}</div><div class="vsmid"><span>VS</span></div><div class="vsrow r">${row(st.enemy)}</div>
      ${tw||st.boosts?`<div class="stags">${tw?`<span class="stwist">${esc(tw)}</span>`:''}${(st.boosts||[]).map(b=>`<span class="stwist ${b.side?'foe':'ally'}">${esc(b.label)}</span>`).join('')}</div>`:''}
      <button class="btn big" data-a="sceneskip">Fight</button><span class="lbox b" aria-hidden="true"></span></div>`;
  }
  const [who,text]=lines[S.sceneAt], c=who&&BYID[who], side=c?sceneSide(st,who):'n';
  // the other speakers in this scene stand dimmed behind the line
  const cast=[...new Set(lines.map(l=>l[0]).filter(Boolean))].filter(id=>id!==who).slice(0,2);
  const typed=S.sceneInstant ? esc(text) : [...text].map((ch,i)=>`<span style="--i:${i}">${esc(ch)}</span>`).join('');
  return `<div class="scene arc-${st.arc}" data-a="scenenext"><span class="lbox t" aria-hidden="true"></span>${fx}
    <span class="scenebg" aria-hidden="true">${ARCS[st.arc].g}</span>${head}
    <div class="stagecast">${cast.map(id=>`<span class="extra ${sceneSide(st,id)}">${seal(BYID[id],'lg')}</span>`).join('')}
      ${c?`<span class="lead ${side}" key="${S.sceneAt}">${seal(c,'lg')}</span>`:''}</div>
    <div class="sceneline ${side}${S.sceneInstant?' instant':''}" aria-live="polite">${c?`<span class="sname">${esc(c.short)}</span>`:''}
      <p class="typed">${typed}</p></div>
    <div class="scenefoot"><span class="dots">${lines.map((_,i)=>`<i class="${i===S.sceneAt?'on':i<S.sceneAt?'done':''}"></i>`).join('')}</span>
      <span class="muted">Tap to continue</span></div><span class="lbox b" aria-hidden="true"></span></div>`;
}
function vOver(){
  const w=S.winner;
  return `<div class="win${w<0?'':' victory'}" style="--wc:${w<0?'var(--muted)':pc(w)}"><span class="burst" aria-hidden="true"></span>
    ${w<0?'':`<div class="winseals" aria-hidden="true">${S.teams[w].map((u,i)=>`<span style="--i:${i}">${seal(u,'lg')}</span>`).join('')}</div>`}
    <div class="eyebrow">After ${plural(S.round,'round')}</div>
    <div class="big" style="color:${w<0?'var(--fg)':pc(w)}">${w<0?(nPlayers()>2?'Nobody survives':'Both squads fall'):S.duo?players().filter(q=>sameSide(q,w)).map(nm).join(' & ')+' win':nm(w)+' wins'}</div>
    ${nPlayers()>2&&!S.duo?`<div class="places">${placings().map((g,i)=>g.map(q=>`<span class="place" style="--tc:${pc(q)}"><b>${['1st','2nd','3rd','4th'][w<0?i+1:i]}</b>${nm(q)}</span>`).join('')).join('')}</div>`:''}
    ${S.mode==='daily' ? `<p class="dres ${S.dailyMet?'ok':''}">${S.dailyMet?'Challenge complete!':'Challenge not met.'} <span class="muted">${esc(DAILY_GOALS[S.daily.goal.type](S.daily.goal))}</span></p>` : ''}
    <p class="muted">${S.mode==='daily' ? (S.dailyMet?`Come back tomorrow for a new one.${dailyStreak()>1?` Streak: ${plural(dailyStreak(),'day')}.`:''}`:'Try again: same squads, same goal.') : S.mode==='story' ? (w===0 ? (S.survived?'You held out until dawn. ':'')+(S.stage+1<STAGES.length?`Battle ${S.stage+1} won. ${esc(STAGES[S.stage+1].title)} is unlocked.`:'The sun rises. The story is complete!') : S.storyDraft ? 'Defeated. Rethink your squad and try again.' : 'Defeated. Try a different plan.')
      : w<0?'Nobody is left standing at dawn.':'Win and character records saved on this phone.'}</p></div>
    ${S.mode==='story' && S.newUnlocks && S.newUnlocks.length ? `<section class="unlocked"><div class="tlabel">Unlocked for every mode</div>
      <div class="ulist">${S.newUnlocks.map((id,i)=>`<span class="ucard" style="--i:${i}">${seal(BYID[id],'lg')}<b>${esc(BYID[id].short)}</b></span>`).join('')}</div></section>` : ''}
    ${mvpPanel()}
    <div class="overteams${nPlayers()>2?' many':''}">${players().map(q=>teamBlock(q)).join('')}</div>
    <details class="panel" id="finallog"><summary>Final round</summary>${logHTML()}</details>
    ${actionbar(S.mode==='daily' ? `<button class="btn ghost" data-a="home">Main menu</button><button class="btn" data-a="daily">${S.dailyMet?'Play again':'Try again'}</button>` : S.mode==='story'
      ? `<button class="btn ghost" data-a="storymap">Story map</button>${w===0&&S.stage+1<STAGES.length?`<button class="btn" data-a="stage" data-v="${S.stage+1}">Next battle</button>`:w===0?'':`<button class="btn" data-a="${S.storyDraft?'stagedraft':'stage'}" data-v="${S.stage}">Try again</button>`}`
      : isOnline() ? '<button class="btn ghost" data-a="home">Leave room</button><button class="btn" data-a="rematch">Rematch</button>'
      : '<button class="btn ghost" data-a="home">Main menu</button><button class="btn" data-a="rematch">Rematch</button>')}`;
}
