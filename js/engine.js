/* ================= ENGINE =================
   Game state, draft rules and battle rules. No DOM in this file: tools/balance-sim.js runs it in Node. */
const MAXTEAM = 6;
// Points per team: chosen in Settings (10, 20 or 30) and remembered on this phone
const BUDGETS = [10, 20, 30], DEFAULT_BUDGET = 20;
const budget = () => S.budget || DEFAULT_BUDGET;
// How a draft is dealt at each team budget:
//  size    = characters dealt
//  maxCost = most one card may cost. 10-point games stop at 6 so every team gets at least two fighters
//            (one 9–10 point card alone against two or three cheap ones was a coin flip decided by matchups).
//  strong  = favour stronger characters: pricier characters come up more, Mark versions beat base versions 2 to 1
const DEALS = {
  10: {size:10, maxCost:6},
  20: {size:10, maxCost:20},
  30: {size:14, maxCost:30, strong:true},
};
const deal = () => DEALS[budget()] || DEALS[DEFAULT_BUDGET];
const poolSize = () => deal().size;
const maxCardCost = () => deal().maxCost;
const SNAKE = [0,1,1,0];

/* ---------- state / storage ---------- */
const SCORE_KEY = 'squad-draft-score', NAMES_KEY = 'squad-draft-names';
function loadScore(){ try{ return JSON.parse(localStorage.getItem(SCORE_KEY))||{} }catch(e){ return {} } }
function saveScore(s){ try{ localStorage.setItem(SCORE_KEY,JSON.stringify(s)) }catch(e){} }
function loadNames(){ try{ return JSON.parse(localStorage.getItem(NAMES_KEY)) }catch(e){ return null } }
function saveNames(n){ try{ localStorage.setItem(NAMES_KEY,JSON.stringify(n)) }catch(e){} }
// Per-character records on this phone: card id → [games played, games won]
const RECORDS_KEY = 'squad-draft-records';
function loadRecords(){ try{ return JSON.parse(localStorage.getItem(RECORDS_KEY))||{} }catch(e){ return {} } }
function recordMatch(){
  const rec=loadRecords();
  [0,1].forEach(p=>S.teams[p].filter(u=>!u.spawn).forEach(u=>{ const r=rec[u.id]||(rec[u.id]=[0,0]); r[0]++; if(S.winner===p) r[1]++; }));
  try{ localStorage.setItem(RECORDS_KEY,JSON.stringify(rec)) }catch(e){}
}

// Character pool: 'random' deals a hand of characters (default), 'all' offers every character
const POOL_TYPES = ['random','all'];
function loadPoolType(){ try{ const t=localStorage.getItem('squad-draft-pooltype'); return POOL_TYPES.includes(t)?t:'random' }catch(e){ return 'random' } }
function savePoolType(v){ try{ localStorage.setItem('squad-draft-pooltype',v) }catch(e){} }
function loadBudget(){ try{ const b=+localStorage.getItem('squad-draft-budget'); return BUDGETS.includes(b)?b:DEFAULT_BUDGET }catch(e){ return DEFAULT_BUDGET } }
function saveBudget(v){ try{ localStorage.setItem('squad-draft-budget',v) }catch(e){} }
function loadLevel(){ try{ return localStorage.getItem('squad-draft-level')||'normal' }catch(e){ return 'normal' } }
function saveLevel(v){ try{ localStorage.setItem('squad-draft-level',v) }catch(e){} }

let S = {phase:'setup', mode:'2p', level: loadLevel(), budget: loadBudget(), poolType: loadPoolType(), soundOn: true, names: loadNames() || ['CK','Mia']};
const rnd = a => a[Math.floor(Math.random()*a.length)];
// Playing against the computer (normal vs-computer games and story mode); the screen belongs to player 1
const vsCpu = () => S.mode==='cpu' || S.mode==='story';
// One person per screen (vs computer, story, online): label sides "You" / "Opponent" from that person's view
const soloView = () => S.mode!=='2p';
// Health is shown as a percent of each fighter's own max HP (display only; the engine keeps raw HP)
const pct = (u,n=u.hp) => Math.round(n/u.max*100);
const LOW = 25;
// Log tags for health changes: the screens show [-17%] as red −17% and [+5%] as green +5%
const lost = (u,n) => `[-${pct(u,n)}%]`, gained = (u,n) => `[+${pct(u,n)}%]`;

/* ---------- draft ---------- */
// How likely a character is to be dealt, relative to 1 for everyone else. Yoriichi is rare (about 1 draft in 8),
// and when he is dealt, the old version is twice as likely as the prime one.
const FAMILY_ODDS = {yoriichi:.4};
const VERSION_ODDS = {yoriichi:.5, muzan_final:.5};   // the stronger version of these comes up less often
// 30-point games deal more and stronger cards, so the hard pulls get their own odds to stay hard pulls
const STRONG_FAMILY_ODDS = {yoriichi:.4};
const STRONG_VERSION_ODDS = {yoriichi:.5, muzan_final:.2};
// How likely a family / version is to be dealt in the current mode (relative to 1)
function familyOdds(fam, cards){
  if(!deal().strong) return FAMILY_ODDS[fam] ?? 1;
  if(fam in STRONG_FAMILY_ODDS) return STRONG_FAMILY_ODDS[fam];
  const top=Math.max(...cards.filter(c=>c.fam===fam).map(c=>c.cost));
  return 0.5 + top/8;   // a 2-pt character ×0.75, an 8-pt ×1.5, a 16-pt ×2.5
}
const versionOdds = c => deal().strong ? (STRONG_VERSION_ODDS[c.id] ?? (c.mark ? 2 : 1)) : (VERSION_ODDS[c.id] ?? 1);
// Weighted pick without replacement: takes one item out of `list` and returns it
function takeWeighted(list, w){
  let r=Math.random()*list.reduce((a,x)=>a+w(x),0);
  const i=Math.max(0, list.findIndex(x=>(r-=w(x))<0));
  return list.splice(i,1)[0];
}
// Deal random characters (10, or 14 in 30-point games), one version each (base OR Mark OR old/young Yoriichi). Always at least 3 cheap (≤4) picks.
// Split-off forms (Hantengu's emotions) are never dealt, nor is anything over maxCardCost().
// The back-pocket helpers are offered in every draft, on top of the characters dealt
const HELPERS = ROSTER.filter(c=>c.helper).map(c=>c.id);
const isHelper = id => !!BYID[id].helper;
const fighterIds = p => S.picks[p].filter(id=>!isHelper(id));
function buildPool(){
  const cards=ROSTER.filter(c=>!c.spawn && !c.helper && c.cost<=maxCardCost()), fams=[...new Set(cards.map(c=>c.fam))];
  // "All" pool: every character and every version (still one version per character per draft, via famTaken)
  if(S.poolType==='all') return cards.map(c=>c.id).sort((a,b)=>BYID[b].cost-BYID[a].cost || BYID[a].name.localeCompare(BYID[b].name)).concat(HELPERS);
  for(let tries=0;tries<200;tries++){
    const left=fams.slice(), f=[];
    while(f.length<poolSize()) f.push(takeWeighted(left, x=>familyOdds(x,cards)));
    const ids=f.map(fam=>takeWeighted(cards.filter(c=>c.fam===fam), versionOdds).id);
    if(ids.filter(id=>BYID[id].cost<=4).length>=3) return ids.sort((a,b)=>BYID[b].cost-BYID[a].cost).concat(HELPERS);
  }
  return cards.slice(0,poolSize()).map(c=>c.id).concat(HELPERS);
}
// first = the player who won the spin and picks first (0 or 1)
function newDraft(first=0){
  Object.assign(S,{phase:'draft', first, lastPicker:null, history:[], picks:[[],[]], locked:[false,false], k:0, sel:null, pool:buildPool()});
}
// Who picks first: a fair coin flip, shown as a wheel. Returns the winner and how far to turn the wheel.
const WHEEL_SEGS = 8;
function spinWheel(){
  const r = Math.random()<.5 ? 0 : 1, seg = 360/WHEEL_SEGS;
  const i = r + 2*Math.floor(Math.random()*WHEEL_SEGS/2);   // even slices are Player 1, odd are Player 2
  const at = i*seg + seg*(.15 + Math.random()*.7);           // land inside the slice, never on a line
  return {r, angle: 360*6 + (360-at)};
}
const spent = p => S.picks[p].reduce((a,id)=>a+BYID[id].cost,0);
const famTaken = fam => S.picks[0].concat(S.picks[1]).some(id=>BYID[id].fam===fam);
const taken = id => famTaken(BYID[id].fam);
// helpers don't take one of the 6 fighter slots, but each player may have only one helper
function canPick(p,id){ const c=BYID[id]; return !taken(id) && !S.locked[p] && (c.helper ? !S.picks[p].some(isHelper) : fighterIds(p).length<MAXTEAM) && c.cost <= budget()-spent(p); }
const canAny = p => S.pool.some(id=>canPick(p,id));
// Whose pick it is: snake order, skipping a player who has locked
function turn(){ return turnAt(S.k); }
function turnAt(k){ const p = SNAKE[k%4] ^ (S.first||0); return S.locked[p] ? 1-p : p; }
// The next n picks in order (shown on the draft screen so players can see a double pick coming)
const pickOrder = n => Array.from({length:n},(_,i)=>turnAt(S.k+i));
function checkLocks(){ [0,1].forEach(p=>{ if(!S.locked[p] && !canAny(p)) S.locked[p]=true; }); }
function afterTurn(){
  checkLocks();
  if(S.locked[0] && S.locked[1]) startBattle();
}
function doPick(id){
  const p=turn();
  S.history.push({p, id, lastPicker:S.lastPicker, locked:S.locked.slice()});   // for Undo
  S.picks[p].push(id); S.lastPicker=p; S.k++;
  S.sel=null; afterTurn();
}
function doLock(p){ S.history.push({lock:true}); S.locked[p]=true; S.lastPicker=p; S.sel=null; S.k++; afterTurn(); }
// The pick Undo would take back: the latest action, if it was a pick and the draft is still going (else null)
const undoable = () => { const h=S.phase==='draft' && S.history && S.history[S.history.length-1]; return h && !h.lock ? h : null; };
function undoPick(){
  const h=undoable(); if(!h) return;
  S.history.pop(); S.picks[h.p].pop(); S.k--; S.lastPicker=h.lastPicker; S.locked=h.locked; S.sel=null;
}
// Two-character synergies the computer drafter looks for
const PAIRS = [['urokodaki','sabito'],['sabito','tanjiro'],['tanjiro','nezuko'],['tamayo','yushiro'],['yoriichi','tanjiro'],['urokodaki','tanjiro'],['urokodaki','giyu'],
  ['tanjiro','zenitsu'],['tanjiro','inosuke'],['zenitsu','inosuke']];
// Computer difficulty. Easy plays like the original simple computer; Normal plays smart but with sloppier choices;
// Hard is the full planner. Noise = random wobble added to every option's score (bigger = more mistakes).
const LEVELS = {easy:{label:'Easy', draftNoise:12}, normal:{label:'Normal', draftNoise:6, noise:22}, hard:{label:'Hard', draftNoise:3, noise:4}};
function cpuDraftStep(level='hard'){
  const p=turn();
  const left=budget()-spent(p);
  if(fighterIds(p).length && left<=2 && Math.random()<.5){ doLock(p); return; }
  const mine=S.picks[p].map(id=>BYID[id]);
  const ok=S.pool.map(id=>BYID[id]).filter(c=>canPick(p,c.id));
  ok.forEach(c=>{
    // value cost, but leave room so the remaining budget is usable
    const rest=left-c.cost;
    c._w = c.cost*1.2 + Math.random()*LEVELS[level].draftNoise
      + (c.upper && mine.some(m=>m.upper)?3:0)
      + (c.demon && mine.some(m=>m.fam==='muzan')?2:0)
      + (c.hashira && mine.some(m=>m.hashira||m.fam==='kagaya')?2:0)
      + (c.fam==='kagaya' && mine.some(m=>m.hashira)?2:0)
      + (PAIRS.some(([a,b])=>(c.fam===a&&mine.some(m=>m.fam===b))||(c.fam===b&&mine.some(m=>m.fam===a)))?3:0)
      + (rest>0 && rest<3 ? -2 : 0);
  });
  ok.sort((a,b)=>b._w-a._w); doPick(ok[0].id);
}

/* ---------- battle setup ---------- */
let UID=0;
function mkUnit(id,p){ const c=BYID[id]; return {uid:'u'+(UID++),id,fam:c.fam,sk:c.sk,p,name:c.short,g:c.g,hp:c.hp,max:c.hp,pow:c.pow,spd:c.spd,def:c.def,
  regen:c.regen||0,revive:c.revive||0,demon:!!c.demon,mark:!!c.mark,legend:!!c.legend,strikes:c.strikes||1,cap:c.cap||0,taken:0,grit:c.id==='murata',
  sig:c.sig,cd:0,alive:true,spawn:!!c.spawn,splits:c.splits||null,poison:null,stun:false,stunNext:false,defending:false,evade:false,sunburn:false}; }
// Applies team bonuses to the units and returns their labels ('!' prefix = a penalty)
function synergies(p){
  const t=S.teams[p], e=S.teams[1-p], has=f=>t.some(u=>u.fam===f), out=[];
  if(has('tanjiro')&&has('zenitsu')&&has('inosuke')){ t.forEach(u=>u.spd+=2); out.push('Kamaboko Squad +2 SPD'); }
  if(has('tanjiro')&&has('nezuko')){ S.sib[p]=true; out.push('Siblings counter'); }
  const ha=t.filter(u=>BYID[u.id].hashira); if(ha.length>=2){ ha.forEach(u=>u.pow+=1); out.push('Hashira +1 PWR'); }
  const um=t.filter(u=>BYID[u.id].upper); if(um.length>=2){ um.forEach(u=>u.regen+=1); out.push('Upper Moons +1 regen'); }
  if(has('muzan') && t.some(u=>u.demon && u.fam!=='muzan' && u.fam!=='nezuko')){ t.filter(u=>u.demon&&u.fam!=='nezuko').forEach(u=>u.pow+=1); out.push("Muzan's Blood +1 PWR"); }
  const mk=t.filter(u=>u.mark); if(mk.length>=2){ mk.forEach(u=>u.spd+=1); out.push('Marks spread +1 SPD'); }
  if(has('tamayo')&&has('yushiro')){ t.filter(u=>u.fam==='yushiro').forEach(u=>u.pow+=2); out.push('Devoted: Yushiro +2 PWR'); }
  if(has('muzan') && e.some(u=>u.fam==='tamayo')){ t.filter(u=>u.fam==='muzan').forEach(u=>u.regen=Math.max(0,u.regen-2)); out.push("!Tamayo's medicine −2 regen"); }
  if(has('yoriichi')&&has('tanjiro')){ t.filter(u=>u.fam==='tanjiro').forEach(u=>u.pow+=2); out.push('Sun Lineage: Tanjiro +2 PWR'); }
  if(has('muzan') && e.some(u=>u.fam==='yoriichi')){ t.filter(u=>u.fam==='muzan').forEach(u=>{u.pow-=3; u.spd-=2;}); out.push('!Muzan fears the Sun −3 PWR'); }
  if(has('kokushibo') && e.some(u=>u.fam==='yoriichi')){ t.filter(u=>u.fam==='kokushibo').forEach(u=>u.def-=1); out.push('!Kokushibo shaken −1 DEF'); }
  const pupils=t.filter(u=>u.fam==='tanjiro'||u.fam==='giyu'||u.fam==='sabito'); if(has('urokodaki') && pupils.length){ pupils.forEach(u=>u.def+=1); out.push('Mentor: pupils +1 DEF'); }
  if(has('kagaya') && ha.length){ ha.forEach(u=>u.def+=1); out.push('Corps Master: Hashira +1 DEF'); }
  if(has('zenitsu') && e.some(u=>u.fam==='kaigaku')){ t.filter(u=>u.fam==='zenitsu').forEach(u=>u.pow+=2); out.push('Rival: Zenitsu +2 PWR'); }
  return out;
}
function startBattle(){
  S.teams=[fighterIds(0).map(id=>mkUnit(id,0)), fighterIds(1).map(id=>mkUnit(id,1))];
  S.helpers=[S.picks[0].filter(isHelper), S.picks[1].filter(isHelper)]; S.helperPlan=[[],[]]; S.scoutQueue=[]; S.scouting=false;
  S.sib=[false,false]; S.syn=[synergies(0),synergies(1)];
  S.round=1; S.plans=[{},{}]; S.lastPlans=[null,null]; S.log=[]; S.planFor=S.me||0; S.focus=null; S.stats={};
  S.movesLocked=[false,false]; S.readyNext=[false,false]; S.roundId=0;   // online play
  S.phase = S.mode==='2p' ? 'pass' : 'plan';
}
const alive = p => S.teams[p].filter(u=>u.alive);
const findU = uid => S.teams[0].concat(S.teams[1]).find(u=>u.uid===uid);

/* ---------- move planning ---------- */
const isAllyMove = (u,pl) => pl.type==='special' && u.sig.kind==='ally';
const needsTarget = (u,pl) => pl.type==='attack' || (pl.type==='special' && (u.sig.kind==='single'||u.sig.kind==='ally'));
const targetOptions = (u,pl) => !needsTarget(u,pl) ? [] : isAllyMove(u,pl) ? alive(u.p) : alive(1-u.p);
function unitReady(u){ if(u.stun) return true; const pl=S.plans[u.p][u.uid]; if(!pl||!pl.type) return false; return !needsTarget(u,pl) || !!pl.t; }
const planReady = p => alive(p).every(unitReady);
function setMove(u,type){
  const pl=S.plans[u.p][u.uid]||{};
  if(pl.type!==type){ const wasAlly=pl.type && isAllyMove(u,pl); pl.type=type; if(wasAlly!==isAllyMove(u,pl)) delete pl.t; }
  // only one possible target: pick it for them
  const opts=targetOptions(u,pl); if(!pl.t && opts.length===1) pl.t=opts[0].uid;
  S.plans[u.p][u.uid]=pl;
}

/* ---------- computer player ----------
   Scores each option (attack each enemy, or the special) and takes the best. Damage is scored as % of the
   target's max HP, with a big bonus for a knockout. Fighters planned earlier in the round "reserve" the damage
   they expect to do, so the team spreads out instead of overkilling one target. */
// Damage a hit of `base` would do to `t`, by the same formula as hit() (ignores guards and dodges)
function estHit(t, base, o={}){
  let d = o.ignoreDef ? base : Math.max(1, base - t.def, Math.ceil(base/2));
  return Math.max(0, t.cap ? Math.min(d, t.cap) : d);
}
// Damage specials: what they hit and how hard. Specials not listed here are scored by hand in cpuPlan().
const SIG_EST = {
  yoriichi: u=>({all:true, base:u.pow, o:{ignoreDef:true}}),
  yoriichi_old: u=>({base:u.pow+10, o:{ignoreDef:true}}),
  tanjiro: u=>({base:u.pow+5, o:{ignoreDef:true}}),
  nezuko: ()=>({all:true, base:5, o:{ignoreDef:true}}),
  zenitsu: u=>({base:u.pow*2}),
  inosuke: u=>({random:2, base:u.pow-1}),
  kanao: u=>({base:u.pow+4}),
  murata: u=>({base:u.pow+2}),
  urokodaki: u=>({base:u.pow+3}),
  gyomei: u=>({all:true, base:u.pow-3}),
  sanemi: u=>({base:u.pow, bonus:1.6}),          // also hits a second enemy
  kaigaku: u=>({base:u.pow+3, bonus:1.3}),
  muichiro: u=>({base:u.pow+2}),
  mitsuri: u=>({all:true, base:u.pow-3}),
  obanai: u=>({base:u.pow+4}),
  rengoku: u=>({base:u.pow+8}),
  tengen: u=>({all:true, base:u.pow-2}),
  rui: u=>({base:u.pow, stun:true}),
  hand: u=>({base:u.pow+3}),
  swamp: u=>({base:u.pow+1}),
  gyutaro: ()=>({all:true, base:8, o:{ignoreDef:true}}),   // 4 now plus 4 of poison
  akaza: u=>({base:u.pow+6}),
  doma: u=>({all:true, base:u.pow-4, o:{ignoreDef:true}}),
  kokushibo: u=>({all:true, base:u.pow-4, o:{ignoreDef:true}}),
  muzan: u=>({all:true, base:u.pow-7, o:{ignoreDef:true}}),
  muzan_final: u=>({all:true, base:u.pow-6, o:{ignoreDef:true}}),
  gyokko: u=>({base:u.pow-2, o:{ignoreDef:true}, stun:true}),
  sekido: ()=>({all:true, base:4, o:{ignoreDef:true}}),
  karaku: u=>({base:u.pow+3}),
  aizetsu: u=>({base:u.pow+4}),
  urogi: u=>({base:u.pow+2}),
};
// Easy: the original simple computer. Specials at random when ready, always hits whoever has the least HP.
function cpuPlanEasy(p){
  const enemy=alive(1-p);
  alive(p).forEach(u=>{
    if(u.stun) return;
    const low=enemy.slice().sort((a,b)=>a.hp-b.hp)[0];
    let type='attack';
    if(u.cd===0 && Math.random()<.7) type='special';
    else if(u.hp<u.max*.3 && Math.random()<.35) type='defend';
    let t=low.uid;
    if(u.sig.kind==='ally'){ const hurt=alive(p).slice().sort((a,b)=>a.hp/a.max-b.hp/b.max)[0]; t=hurt.uid; if(type==='special' && u.sk==='tamayo' && hurt.hp>hurt.max*.75) type='attack'; if(type==='attack') t=low.uid; }
    S.plans[p][u.uid]={type, t};
  });
}
// "Repeat last round": give each fighter the move they used last round. A special still recharging becomes Attack;
// a target that's gone is dropped (or replaced when there's only one choice left).
function repeatPlans(p){
  const last=S.lastPlans && S.lastPlans[p]; if(!last) return;
  alive(p).forEach(u=>{
    const q=last[u.uid]; if(u.stun || !q || !q.type) return;
    setMove(u, q.type==='special' && u.cd>0 ? 'attack' : q.type);
    const pl=S.plans[p][u.uid], opts=targetOptions(u,pl);
    if(needsTarget(u,pl)) pl.t = q.t && opts.some(o=>o.uid===q.t) ? q.t : opts.length===1 ? opts[0].uid : undefined;
  });
}
function cpuPlan(p, level='hard'){
  if(level==='easy') return cpuPlanEasy(p);
  const noise=LEVELS[level].noise;
  const foes=alive(1-p), mine=alive(p), planned={};
  const left = t => t.hp - (planned[t.uid]||0);
  const threat = t => t.pow*t.strikes + (t.cd===0?4:0);
  const score = (t,d) => { const l=left(t); if(l<=0) return 0; d=Math.min(d,l); return d/t.max*100 + (d>=l ? 40+threat(t) : 0); };
  const best = (base,o) => foes.reduce((b,t)=>{ const s=score(t,estHit(t,base,o))+threat(t)*.5+Math.random()*noise; return s>b.s?{t,s}:b; },{t:foes[0],s:-1}).t;
  const pctHurt = m => m.hp/m.max;
  mine.forEach(u=>{
    if(u.stun) return;
    const at=best(u.pow), atD=estHit(at,u.pow)*u.strikes;
    let plan={type:'attack', t:at.uid, v:score(at,atD), hits:[[at,atD]]};
    if(u.cd===0){
      const e=SIG_EST[u.sk]; let sp=null;
      if(e){ const x=e(u);
        if(x.all){ sp={type:'special', v:0, hits:[]}; foes.forEach(t=>{ const d=estHit(t,x.base,x.o); sp.v+=score(t,d); sp.hits.push([t,d]); }); }
        else if(x.random){ sp={type:'special', v:x.random*foes.reduce((a,t)=>a+score(t,estHit(t,x.base)),0)/foes.length, hits:[]}; }
        else { const t=best(x.base,x.o), d=estHit(t,x.base,x.o); sp={type:'special', t:t.uid, v:score(t,d)*(x.bonus||1)+(x.stun?10+threat(t):0), hits:[[t,d]]}; }
      } else {
        const hurt=mine.slice().sort((a,b)=>pctHurt(a)-pctHurt(b))[0];
        switch(u.sk){
          case 'giyu': { const danger=foes.filter(f=>f.cd===0).reduce((a,f)=>a+f.pow,0); sp={type:'special', v: danger>=12 || pctHurt(hurt)<.4 ? 30+danger : 0}; break; }
          case 'genya': sp={type:'special', v: S.round<=3 ? 40 : u.hp<u.max*.6 ? 30 : 12}; break;
          case 'tamayo': { const sick=mine.find(m=>m.poison), t=sick||hurt; sp={type:'special', t:t.uid, v:Math.min(10,t.max-t.hp)/t.max*100+(sick?20:0)}; break; }
          case 'yushiro': sp={type:'special', t:hurt.uid, v: pctHurt(hurt)<.4 ? 45 : 0}; break;
          case 'sabito': { const t=mine.slice().sort((a,b)=>b.pow*b.strikes-a.pow*a.strikes)[0]; sp={type:'special', t:t.uid, v: S.round<=4 ? 35 : 15}; break; }
          case 'tengen_retired': sp={type:'special', t:hurt.uid, v: pctHurt(hurt)<.5 ? 30 : 0}; break;
          case 'hantengu': sp={type:'special', v: u.hp<u.max*.7 ? 35 : 10}; break;
          case 'kagaya': sp={type:'special', v: mine.reduce((a,m)=>a+Math.min(4,m.max-m.hp)/m.max*100,0)}; break;
          case 'enmu': sp={type:'special', v: foes.filter(f=>f.cd<=1).length*14}; break;
          case 'shinobu': { const t=foes.slice().sort((a,b)=>(b.demon-a.demon)||(b.hp-a.hp))[0]; sp={type:'special', t:t.uid, v: t.poison ? 0 : t.demon ? 45 : 25}; break; }
          case 'kyogai': { const t=foes.slice().sort((a,b)=>threat(b)-threat(a))[0]; sp={type:'special', t:t.uid, v:12+threat(t)}; break; }
        }
      }
      if(sp && sp.v+Math.random()*noise > plan.v+Math.random()*noise) plan=sp;
    }
    // badly hurt with nothing worth doing: guard
    if(u.hp<=u.max*.25 && plan.v<30 && Math.random()<.6) plan={type:'defend'};
    (plan.hits||[]).forEach(([t,d])=>{ planned[t.uid]=(planned[t.uid]||0)+d; });
    S.plans[p][u.uid]={type:plan.type, t:plan.t};
  });
}

/* ---------- resolving a round ---------- */
// Each log line keeps everyone's HP at that moment, so the round can be played back step by step
// What a line shows on the fight stage during playback: effect type, who did it (by) and who it landed on (on)
// move = 'attack' or 'special' while a fighter is acting (null for end-of-round effects), for the breathing-style effects and grouping
const fx = (type, by, on) => ({fx:type, by:by?by.uid:null, on:on?on.uid:null, move:S.curMove||null});
function L(t,c='',extra){ const hp={}; S.teams[0].concat(S.teams[1]).forEach(u=>{ hp[u.uid]=u.hp; }); S.log.push(Object.assign({t,c,hp},extra)); }
function target(u,tid){ let t=findU(tid); if(!t||!t.alive){ const a=alive(1-u.p); t=a.length?rnd(a):null; } return t; }
function fall(t,a){ if(t.hp>0) return; if(t.grit){ t.grit=false; t.hp=1; L(`${t.name} somehow survives on ${pct(t)}% health!`,'h',fx('heal',null,t)); return; } if(t.revive){ t.hp=Math.ceil(t.max*t.revive); t.revive=0; L(`${t.name} falls… and rises again! Seven Hearts ${gained(t,t.hp)}.`,'x',fx('revive',null,t)); return; }
  t.alive=false; L(`${t.name} falls!`,'k',{ko:t.uid, ...fx('ko',a,t)});
  // Shinobu's Wisteria Body: the demon who knocks her out devours her and is poisoned. Not Akaza: he never eats women.
  if(t.fam==='shinobu' && a && a.alive && a.demon && a.fam!=='akaza'){ a.devoured=5; L(`${a.name} devours Shinobu, but her body is full of wisteria poison. ${a.name} will lose ${lost(a,5)} every round.`,'h',fx('poison',null,a)); }
  if(t.splits) split(t); }
// Hantengu's forms: a fallen form is replaced by the forms it splits into. They join the team at full health and act from next round.
function split(t){
  const kids=t.splits.map(id=>mkUnit(id,t.p)); S.teams[t.p].push(...kids);
  L(`${t.name} splits! ${kids.map(k=>k.name).join(' and ')} ${kids.length>1?'appear':'appears'}.`,'x',{spawn:kids.map(k=>k.uid), ...fx('spawn',null,t)});
}
function hit(a,t,base,o={}){
  if(!t||!t.alive) return 0;
  if(S.shield[t.p]){ L(`${t.name} is untouched. Dead Calm blocks it.`,'x',fx('block',a,t)); return 0; }
  if(t.evade){ L(`${a.name} strikes at ${t.name}, but hits nothing.`,'x',fx('miss',a,t)); return 0; }
  let d = o.ignoreDef ? base : Math.max(1, base - t.def, Math.ceil(base/2));
  const guarded = t.defending && !o.pierce;
  if(guarded) d = Math.ceil(d/2);
  let note = guarded?' (guarded)':'';
  if(t.cap){ const room=t.cap-t.taken; if(room<=0){ L(`${t.name} sees it coming in the Transparent World. No damage.`,'x',fx('block',a,t)); return 0; } if(d>room){ d=room; note+=' (capped)'; } t.taken+=d; }
  d=Math.max(0,d); const before=t.hp; t.hp = Math.max(0, t.hp - d);
  L(`${a.name} hits ${t.name} ${lost(t,Math.min(d,before))}${note}.`,'',fx('hit',a,t));
  if(o.sun && t.demon && t.regen){ t.regen=0; t.sunburn=true; L(`${t.name} is burned by the sun. No more regeneration.`,'h',fx('burn',a,t)); }
  fall(t,a);
  if(o.counter!==false && S.sib[t.p] && a.alive && (t.fam==='tanjiro'||t.fam==='nezuko')){
    const partner = S.teams[t.p].find(u=>u.alive && u!==t && (u.fam==='tanjiro'||u.fam==='nezuko'));
    if(partner && !(a.cap && a.taken>=a.cap)){ let cd=3; if(a.cap){ cd=Math.min(cd,a.cap-a.taken); a.taken+=cd; } a.hp=Math.max(0,a.hp-cd); L(`${partner.name} counters ${a.name} ${lost(a,cd)} to protect ${t.fam==='tanjiro'?'her brother':'his sister'}.`,'h',fx('hit',partner,a)); fall(a,partner); }
  }
  return d;
}
function stunT(t){ if(t&&t.alive&&!S.shield[t.p]&&!t.evade){ t.stunNext=true; L(`${t.name} will lose next round.`,'k',fx('stun',null,t)); } }
function special(u,pl){
  const s=u.sig, en=()=>alive(1-u.p);
  L(`${u.name}: ${s.name}!`,'x',fx('special',u,null));
  switch(u.sk){
    case 'yoriichi': en().forEach(e=>hit(u,e,u.pow,{ignoreDef:true,sun:true,counter:false})); break;
    case 'yoriichi_old': hit(u,target(u,pl.t),u.pow+10,{ignoreDef:true}); break;
    case 'tanjiro': hit(u,target(u,pl.t),u.pow+5,{ignoreDef:true}); break;
    case 'nezuko': en().forEach(e=>hit(u,e,5,{ignoreDef:true,counter:false})); break;
    case 'zenitsu': hit(u,target(u,pl.t),u.pow*2); break;
    case 'inosuke': for(let i=0;i<2;i++){ const e=en(); if(e.length) hit(u,rnd(e),u.pow-1); } break;
    case 'kanao': hit(u,target(u,pl.t),u.pow+4); break;
    case 'genya': { const h=Math.min(8,u.max-u.hp); u.hp+=h; u.pow+=2; L(`Genya eats demon flesh ${gained(u,h)}, PWR now ${u.pow}.`,'h',fx('heal',null,u)); break; }
    case 'tamayo': { let t=findU(pl.t); if(!t||!t.alive||t.p!==u.p) t=alive(u.p).sort((a,b)=>a.hp/a.max-b.hp/b.max)[0]; const h=Math.min(10,t.max-t.hp); t.hp+=h; t.poison=null; L(`Tamayo heals ${t===u?'herself':t.name} ${gained(t,h)} and clears any poison.`,'h',fx('heal',u,t)); break; }
    case 'gyokko': { const t=target(u,pl.t); if(t&&t.alive){ hit(u,t,u.pow-2,{ignoreDef:true}); stunT(t); } break; }
    case 'sabito': { let t=findU(pl.t); if(!t||!t.alive||t.p!==u.p) t=u; t.pow+=2; L(`Sabito & Makomo train ${t===u?'themselves':t.name}: +2 PWR for the rest of the match.`,'h',fx('buff',u,t)); break; }
    case 'muzan_final': { let n=0; en().forEach(e=>{ if(hit(u,e,u.pow-6,{ignoreDef:true,counter:false})>0) n++; }); if(u.alive&&n){ const h=Math.min(3*n,u.max-u.hp); u.hp+=h; L(`Final Muzan heals ${gained(u,h)}.`,'k',fx('heal',null,u)); } break; }
    case 'tengen_retired': { let t=findU(pl.t); if(!t||!t.alive||t.p!==u.p) t=u; t.defending=true; L(`Retired Tengen stands guard over ${t===u?'himself':t.name}. Half damage this round.`,'h',fx('guard',u,t)); break; }
    case 'yushiro': { let t=findU(pl.t); if(!t||!t.alive||t.p!==u.p) t=u; t.evade=true; L(`${t===u?'Yushiro':t.name} vanishes behind the talisman.`,'h',fx('guard',u,t)); break; }
    case 'murata': hit(u,target(u,pl.t),u.pow+2); break;
    case 'giyu': S.shield[u.p]=true; L(`${S.names[u.p]}'s team can't be hurt this round.`,'h',fx('guard',u,null)); break;
    case 'gyomei': en().forEach(e=>hit(u,e,u.pow-3,{counter:false})); break;
    case 'sanemi': { const t=target(u,pl.t); hit(u,t,u.pow); const o=en().filter(e=>e!==t); if(o.length) hit(u,rnd(o),u.pow); break; }
    case 'muichiro': hit(u,target(u,pl.t),u.pow+2); break;
    case 'mitsuri': en().forEach(e=>hit(u,e,u.pow-3,{counter:false})); break;
    case 'obanai': hit(u,target(u,pl.t),u.pow+4,{pierce:true}); break;
    case 'rengoku': hit(u,target(u,pl.t),u.pow+8); break;
    case 'shinobu': { const t=target(u,pl.t); if(t&&t.alive){ if(S.shield[t.p]||t.evade){L(`The poison misses.`,'x',fx('miss',u,t));break;} t.poison={dmg:t.demon?6:3,turns:3}; L(`${t.name} is poisoned.`,'h',fx('poison',u,t)); } break; }
    case 'tengen': en().forEach(e=>hit(u,e,u.pow-2,{counter:false})); break;
    case 'rui': { const t=target(u,pl.t); hit(u,t,u.pow); stunT(t); break; }
    case 'kyogai': stunT(target(u,pl.t)); break;
    case 'hand': hit(u,target(u,pl.t),u.pow+3); break;
    case 'swamp': hit(u,target(u,pl.t),u.pow+1); break;
    case 'gyutaro': en().forEach(e=>{ hit(u,e,4,{ignoreDef:true,counter:false}); if(e.alive&&!S.shield[e.p]&&!e.evade&&(!e.poison||e.poison.dmg<2)) e.poison={dmg:2,turns:2}; }); break;
    case 'akaza': hit(u,target(u,pl.t),u.pow+6); break;
    case 'doma': en().forEach(e=>hit(u,e,u.pow-4,{ignoreDef:true,counter:false})); break;
    case 'kokushibo': en().forEach(e=>hit(u,e,u.pow-4,{ignoreDef:true,counter:false})); break;
    case 'sekido': en().forEach(e=>hit(u,e,4,{ignoreDef:true,counter:false})); break;
    case 'karaku': hit(u,target(u,pl.t),u.pow+3); break;
    case 'aizetsu': hit(u,target(u,pl.t),u.pow+4); break;
    case 'urogi': hit(u,target(u,pl.t),u.pow+2); break;
    case 'hantengu': { u.evade=true; const h=Math.min(6,u.max-u.hp); u.hp+=h; L(`Hantengu shrinks into hiding and heals ${gained(u,h)}.`,'h',fx('heal',null,u)); break; }
    case 'kaigaku': { const t=target(u,pl.t); hit(u,t,u.pow+3); const o=en().filter(e=>e!==t); if(o.length) hit(u,rnd(o),4,{ignoreDef:true}); break; }
    case 'enmu': en().forEach(e=>{ if(S.shield[e.p]||e.evade) return; e.cd+=2; }); L('The enemy team falls into a deep sleep. Their specials are 2 rounds further away.','k',fx('stun',u,null)); break;
    case 'urokodaki': hit(u,target(u,pl.t),u.pow+3); break;
    case 'kagaya': { const healed=alive(u.p).map(m=>{ const h=Math.min(4,m.max-m.hp); m.hp+=h; return h?`${m.name} ${gained(m,h)}`:''; }).filter(Boolean);
      L(`Kagaya steadies the Corps.${healed.length?' '+healed.join(', ')+'.':''}`,'h',fx('heal',u,null)); break; }
    case 'muzan': { let n=0; en().forEach(e=>{ if(hit(u,e,u.pow-7,{ignoreDef:true,counter:false})>0) n++; }); if(u.alive&&n){ const h=Math.min(2*n,u.max-u.hp); u.hp+=h; L(`Muzan heals ${gained(u,h)}.`,'k',fx('heal',null,u)); } break; }
  }
  u.cd = s.cd + 1;
}
// A back-pocket helper's effect, at the start of the round it's used. It then leaves the back pocket.
function useHelper(p, id){
  S.helpers[p]=S.helpers[p].filter(h=>h!==id);
  const team=alive(p), tag={fx:id==='chachamaru'?'heal':id==='mice'?'buff':'special', by:null, on:null, helper:id};
  if(id==='chachamaru'){   // the most hurt fighter (lowest health %) heals half of their current HP
    const u=team.slice().sort((a,b)=>a.hp/a.max-b.hp/b.max)[0];
    if(u){ const h=Math.min(Math.ceil(u.hp/2), u.max-u.hp); u.hp+=h; L(`Chachamaru delivers Tamayo's medicine to ${u.name} ${gained(u,h)}.`,'h',{...tag, on:u.uid}); }
  }
  if(id==='mice'){ team.forEach(u=>{ u.pow+=MICE_PWR; u.miceBoost=(u.miceBoost||0)+MICE_PWR; }); L(`The Muscle Mice flex! ${S.names[p]}'s team gets +${MICE_PWR} PWR this round.`,'h',tag); }
  if(id==='crow') L(`${S.names[p]}'s Kasugai Crow scouted the enemy's moves.`,'x',tag);
}
// Computer back-pocket choices for this round
function cpuHelpers(p){
  const team=alive(p), have=S.helpers[p]||[], use=[];
  if(team.length){
    const avg=team.reduce((a,u)=>a+u.hp/u.max,0)/team.length;
    if(have.includes('chachamaru') && team.some(u=>u.hp<=u.max*.5)) use.push('chachamaru');
    if(have.includes('mice') && S.round>=2 && team.length>=2) use.push('mice');
    if(have.includes('crow') && S.round>=2) use.push('crow');
  }
  S.helperPlan[p]=use;
}
// Computer with a crow: it has seen the other side's moves, so any fighter about to be knocked out defends instead
function cpuScout(p){
  const incoming={};
  alive(1-p).forEach(e=>{
    const q=S.plans[1-p][e.uid]; if(!q || e.stun) return;
    const x = q.type==='special' && SIG_EST[e.sk] ? SIG_EST[e.sk](e) : null;
    const base = q.type==='attack' ? e.pow*e.strikes : x ? x.base : 0; if(!base) return;
    const hits = x && x.all ? alive(p) : [findU(q.t)].filter(t=>t && t.p===p);
    hits.forEach(t=>{ incoming[t.uid]=(incoming[t.uid]||0)+estHit(t, base, x?x.o:{}); });
  });
  alive(p).forEach(u=>{ if(!u.stun && (incoming[u.uid]||0)>=u.hp) S.plans[p][u.uid]={type:'defend'}; });
}
// Both sides played by the computer (simulator and checks): moves, back-pocket helpers, then crow scouting
function cpuBothSides(l0='hard', l1='hard'){
  cpuPlan(0,l0); cpuPlan(1,l1); cpuHelpers(0); cpuHelpers(1);
  [0,1].forEach(p=>{ if(S.helperPlan[p].includes('crow')) cpuScout(p); });
}
// Playback steps for a round's log: [first line, last line] per beat. A special that hits several enemies plays as
// one beat: its hits (and any knockouts it causes) go together. Everything else is one line per beat.
const GROUP_FX = ['hit','miss','block'];
function playSteps(log){
  const steps=[[0,0]];   // the "Round N · Fight!" intro
  for(let i=1;i<log.length;){
    const l=log[i];
    if(GROUP_FX.includes(l.fx) && l.by && l.move==='special'){
      const seen=new Set([l.on]); let j=i+1;
      while(j<log.length){
        const m=log[j];
        if(GROUP_FX.includes(m.fx) && m.by===l.by && m.move==='special' && !seen.has(m.on)){ seen.add(m.on); j++; continue; }
        if((m.fx==='ko'||m.fx==='burn') && m.by===l.by){ j++; continue; }
        break;
      }
      if(seen.size>=2){ steps.push([i,j-1]); i=j; continue; }
    }
    steps.push([i,i]); i++;
  }
  return steps;
}
// Match stats for the win screen, counted from each log line's HP snapshot (no extra bookkeeping in the rules):
// damage dealt and biggest hit (hit lines), knockouts (ko lines with an attacker), healing given to others (heal lines with a healer)
function tallyRound(){
  const st=uid=>S.stats[uid]||(S.stats[uid]={dmg:0, kos:0, heal:0, best:0});
  for(let i=1;i<S.log.length;i++){
    const l=S.log[i], prev=S.log[i-1], diff=uid=>(l.hp[uid]??0)-(prev.hp[uid]??l.hp[uid]??0);
    if(l.fx==='hit' && l.by && l.on){ const d=-diff(l.on); if(d>0){ const s=st(l.by); s.dmg+=d; s.best=Math.max(s.best,d); } }
    if(l.fx==='ko' && l.by && l.by!==l.on) st(l.by).kos++;
    if(l.fx==='heal' && l.by){ const h=Object.keys(l.hp).reduce((a,uid)=>a+Math.max(0,diff(uid)),0); if(h>0) st(l.by).heal+=h; }
  }
}
// Who did best this match: damage + 12 per knockout + healing given
const mvpScore = s => s.dmg + s.kos*12 + s.heal;
function resolve(){
  S.log=[]; S.shield=[false,false];
  L(`Round ${S.round}`,'r');
  [0,1].forEach(p=>(S.helperPlan&&S.helperPlan[p]||[]).forEach(id=>useHelper(p,id)));   // back-pocket helpers act first
  const acts=[];
  [0,1].forEach(p=>alive(p).forEach(u=>{ u.taken=0; acts.push({u, pl: u.stun?{type:'stunned'}:(S.plans[p][u.uid]||{type:'defend'}), r:Math.random()}); }));
  acts.forEach(x=>{ if(x.pl.type==='defend') x.u.defending=true; });
  const prio = x => x.pl.type==='special' ? (x.u.sig.prio||0) : 0;
  acts.sort((a,b)=> prio(b)-prio(a) || b.u.spd-a.u.spd || a.r-b.r);
  for(const x of acts){
    const u=x.u; if(!u.alive) continue;
    S.curMove=x.pl.type;
    if(x.pl.type==='stunned'){ L(`${u.name} can't move.`,'',fx('stun',null,u)); continue; }
    if(x.pl.type==='defend'){ L(`${u.name} braces.`,'',fx('guard',null,u)); continue; }
    if(x.pl.type==='special' && (u.sk==='muichiro'||u.sk==='swamp')) u.evade=true;
    if(x.pl.type==='attack') for(let i=0;i<u.strikes;i++){ if(!alive(1-u.p).length) break; hit(u,target(u,x.pl.t),u.pow); }
    if(x.pl.type==='special') special(u,x.pl);
    if(!alive(0).length||!alive(1).length) break;
  }
  S.curMove=null;
  // end of round: poison, Shinobu's devour damage, regeneration, cooldowns
  [0,1].forEach(p=>S.teams[p].forEach(u=>{
    if(u.alive && u.poison){ u.hp=Math.max(0,u.hp-u.poison.dmg); L(`Poison hits ${u.name} ${lost(u,u.poison.dmg)}.`,'k',fx('poison',null,u)); fall(u); u.poison.turns--; if(u.poison.turns<=0) u.poison=null; }
    if(u.alive && u.devoured){ u.hp=Math.max(0,u.hp-u.devoured); L(`Shinobu's poison eats away at ${u.name} ${lost(u,u.devoured)}.`,'k',fx('poison',null,u)); fall(u); }
    if(u.alive && u.regen && u.hp<u.max){ const h=Math.min(u.regen,u.max-u.hp); u.hp+=h; L(`${u.name} regenerates ${gained(u,h)}.`,'',fx('heal',null,u)); }
    if(u.cd>0) u.cd--;
    u.stun=u.stunNext; u.stunNext=false; u.defending=false; u.evade=false;
    if(u.miceBoost){ u.pow-=u.miceBoost; u.miceBoost=0; }   // Muscle Mice last one round
  }));
  tallyRound();
  S.plans=[{},{}]; S.helperPlan=[[],[]];
  const a0=alive(0).length, a1=alive(1).length;
  if(!a0||!a1){ S.winner = !a0&&!a1 ? -1 : a0 ? 0 : 1; S.phase='over'; }
  else if(S.round>=40){ S.winner=-1; S.phase='over'; }
  else S.phase='result';
}
