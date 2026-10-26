/* ================= ENGINE =================
   Game state, draft rules and battle rules. No DOM in this file: tools/balance-sim.js runs it in Node. */
const MAXTEAM = 6;
// Fighters allowed per team in this match: 1–6, chosen per mode on the main menu (story is always 6)
const teamCap = () => S.maxTeam || MAXTEAM;
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
const poolSize = () => deal().size + (nPlayers()-2)*(deal().strong?5:4);   // more players, more characters dealt
// Free-for-all (3–4 players) deals nothing over 12 points: single big cards (Yoriichi, Muzan, Kokushibo…) shrug off
// small hits while the other teams wear each other down, so the first picker won 55–65%. With the cap: 40/33/26%.
const FFA_MAX_COST = 12;
const maxCardCost = () => nPlayers()>2 ? Math.min(deal().maxCost, FFA_MAX_COST) : deal().maxCost;
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
  players().forEach(p=>S.teams[p].filter(u=>!u.spawn).forEach(u=>{ const r=rec[u.id]||(rec[u.id]=[0,0]); r[0]++; if(S.winner>=0 && sameSide(S.winner,p)) r[1]++; }));
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
// Each mode keeps its own match settings on this phone: players (2–4), points, pool and (Quickplay) computer level.
// Online: the room creator's settings are used. Story sets its own. The ⚙ Settings menu only has general options.
const MODES = ['local','online','cpu','practice','story'];
const MODE_DEFAULTS = {local:{players:2}, online:{players:2}, cpu:{players:2}, practice:{players:2, poolType:'all'}, story:{players:2}};   // + maxTeam 6, bans off
function loadModeCfg(mode){
  let c=null; try{ c=JSON.parse(localStorage.getItem('squad-draft-mode-'+mode)) }catch(e){}
  return Object.assign({players:2, budget:loadBudget(), poolType:loadPoolType(), level:loadLevel(), maxTeam:MAXTEAM, bans:false}, MODE_DEFAULTS[mode], c||{});
}
function saveModeCfg(mode, c){ try{ localStorage.setItem('squad-draft-mode-'+mode, JSON.stringify(c)) }catch(e){} }
// Copy a mode's settings into the game state (points, pool, players, level)
function useModeCfg(mode=S.mode){ const c=loadModeCfg(mode); if(mode==='cpu'||mode==='practice') c.players=2;   // Quickplay and Practice: you vs one computer
  S.cfg=c; S.duo = mode!=='story' && c.players===4 && !!c.duo; S.budget=c.budget; S.poolType=c.poolType; S.level=c.level; S.maxTeam=mode==='story'?MAXTEAM:c.maxTeam; S.bansOn=mode!=='story'&&!!c.bans; if(mode!=='online') S.n=c.players; return c; }
const CPU_NAMES = ['Muzan AI','Kokushibo AI','Doma AI'];

// Saved data reset: when DATA_VERSION changes, every 'squad-draft…' key on this phone is cleared once (story, stats,
// daily streak, names, settings), then saving carries on as normal. Bumped to 3 on Oct 26, 2026 at CK's request
// ("clear all my data and save from this point on"), and to 4 on Oct 26, 2026 (CK: wipe all existing data for
// everyone again). Don't bump it again unless CK asks for another wipe.
const DATA_VERSION = '4';
try{ if(localStorage.getItem('squad-draft-data')!==DATA_VERSION){
  Object.keys(localStorage).filter(k=>k.startsWith('squad-draft')).forEach(k=>localStorage.removeItem(k));
  localStorage.setItem('squad-draft-data', DATA_VERSION); } }catch(e){}
let S = {phase:'setup', mode:'story', n:2,   // Story is selected when the game opens (CK)
  level: loadLevel(), budget: loadBudget(), poolType: loadPoolType(), names: loadNames() || ['CK','Mia']};
// Players in the match: 2, 3 (triple threat) or 4 (1 v 1 v 1 v 1). Every team fights every other team; last one standing wins.
const MAX_PLAYERS = 4;
const nPlayers = () => S.n || 2;
const players = () => Array.from({length:nPlayers()}, (_,i)=>i);
const others = p => players().filter(q=>q!==p);
// 2v2 (4 players, teams on): players 1 & 3 are one team, 2 & 4 the other (side = seat % 2). Otherwise everyone is alone.
const sideOf = p => S.duo ? p%2 : p;
const sameSide = (p,q) => sideOf(p)===sideOf(q);
const enemiesOf = p => players().filter(q=>!sameSide(p,q));
const partnersOf = p => players().filter(q=>q!==p && sameSide(p,q));
const allPicks = () => (S.picks||[]).flat();
const allUnits = () => (S.teams||[]).flat();
const rnd = a => a[Math.floor(Math.random()*a.length)];
// Playing against the computer (normal vs-computer games and story mode); the screen belongs to player 1
const vsCpu = () => S.mode==='cpu' || S.mode==='story' || S.mode==='practice' || S.mode==='daily';
// Practice: you draft for every team (the computers' picks too), then fight the computers. Doesn't count toward records.
const isPractice = () => S.mode==='practice';
// One person per screen (vs computer, story, online): label sides "You" / "Opponent" from that person's view
const soloView = () => S.mode!=='local';
// Health is shown as a percent of each fighter's own max HP (display only; the engine keeps raw HP)
const pct = (u,n=u.hp) => Math.round(n/u.max*100);
const LOW = 25;
// Log tags for health changes: the screens show [-17%] as red −17% and [+5%] as green +5%
const lost = (u,n) => `[-${pct(u,n)}%]`, gained = (u,n) => `[+${pct(u,n)}%]`;

/* ---------- draft ---------- */
// How likely a character is to be dealt, relative to 1 for everyone else. Yoriichi is rare (about 1 draft in 8),
// and when he is dealt, the old version is twice as likely as the prime one.
const FAMILY_ODDS = {yoriichi:.4};
const VERSION_ODDS = {yoriichi:.5, muzan_final:.5, tanjiro_demon:.3};   // the stronger version of these comes up less often
// 30-point games deal more and stronger cards, so the hard pulls get their own odds to stay hard pulls
const STRONG_FAMILY_ODDS = {yoriichi:.4};
const STRONG_VERSION_ODDS = {yoriichi:.5, muzan_final:.2, tanjiro_demon:.2};
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
  // story unlocks (story.js): only characters this phone has unlocked are dealt (the host's phone, online)
  const open = c => S.unlockAll || typeof isUnlocked!=='function' || isUnlocked(c.id);
  const cards=ROSTER.filter(c=>!c.spawn && !c.helper && c.cost<=maxCardCost() && open(c)), fams=[...new Set(cards.map(c=>c.fam))];
  // "All" pool: every character and every version (still one version per character per draft, via famTaken)
  if(S.poolType==='all') return cards.map(c=>c.id).sort((a,b)=>BYID[b].cost-BYID[a].cost || BYID[a].name.localeCompare(BYID[b].name)).concat(HELPERS);
  for(let tries=0;tries<200;tries++){
    const left=fams.slice(), f=[];
    while(f.length<poolSize()) f.push(takeWeighted(left, x=>familyOdds(x,cards)));
    const ids=f.map(fam=>takeWeighted(cards.filter(c=>c.fam===fam), versionOdds).id);
    if(ids.filter(id=>BYID[id].cost<=4).length>=3+(nPlayers()-2)*2) return ids.sort((a,b)=>BYID[b].cost-BYID[a].cost).concat(HELPERS);
  }
  return cards.slice(0,poolSize()).map(c=>c.id).concat(HELPERS);
}
// first = the player who won the spin and picks first (0 or 1)
function newDraft(first=0){
  Object.assign(S,{phase:'draft', first, lastPicker:null, history:[], picks:players().map(()=>[]), locked:players().map(()=>false), k:0, sel:null, pool:buildPool(),
    banning:!!S.bansOn, bans:[]});
}
// Who picks first: a fair coin flip, shown as a wheel. Returns the winner and how far to turn the wheel.
const WHEEL_SEGS = 8;
const wheelSegs = () => nPlayers()===3 ? 9 : WHEEL_SEGS;   // slices take turns between the players
function spinWheel(){
  const n=nPlayers(), segs=wheelSegs(), r = Math.floor(Math.random()*n), seg = 360/segs;
  const i = r + n*Math.floor(Math.random()*segs/n);   // slice i belongs to player i % n
  const at = i*seg + seg*(.15 + Math.random()*.7);           // land inside the slice, never on a line
  return {r, angle: 360*6 + (360-at)};
}
const spent = p => S.picks[p].reduce((a,id)=>a+BYID[id].cost,0);
const famTaken = fam => allPicks().some(id=>BYID[id].fam===fam);
const banned = fam => (S.bans||[]).some(b=>BYID[b.id].fam===fam);
const taken = id => famTaken(BYID[id].fam) || banned(BYID[id].fam);
// Optional bans (per-mode setting, off by default): before the first pick each player, in order from the first
// picker, bans one character (every version of it). The draft then starts as usual.
const banTurn = () => ((S.first||0) + S.bans.length) % nPlayers();
const canBan = (p,id) => S.banning && banTurn()===p && S.pool.includes(id) && !BYID[id].helper && !banned(BYID[id].fam);
function doBan(id){ const p=banTurn(); S.bans.push({p,id}); S.sel=null; if(S.bans.length>=nPlayers()) S.banning=false; }
// The computer bans the priciest card still in the pool
function cpuBan(){ const ok=S.pool.filter(id=>canBan(banTurn(),id)).sort((a,b)=>BYID[b].cost-BYID[a].cost || Math.random()-.5); doBan(ok[0]); }
// helpers don't take one of the 6 fighter slots, but each player may have only one helper
function canPick(p,id){ const c=BYID[id]; return !S.banning && !taken(id) && !S.locked[p] && (c.helper ? !S.picks[p].some(isHelper) : fighterIds(p).length<teamCap()) && c.cost <= budget()-spent(p); }
const canAny = p => S.pool.some(id=>canPick(p,id));
// Whose pick it is: snake order, skipping a player who has locked
function turn(){ return S.banning ? banTurn() : turnAt(S.k); }
// Snake order from the first picker: 2 players A B B A A B…, 3 players A B C C B A A B C…, and so on
function rawTurn(k){ const n=nPlayers(), r=Math.floor(k/n), i=k%n, j=r%2 ? n-1-i : i; return ((S.first||0)+j)%n; }
function turnAt(k){ for(let j=k;j<k+4*nPlayers();j++){ const p=rawTurn(j); if(!S.locked[p]) return p; } return rawTurn(k); }
// The next n picks in order (shown on the draft screen so players can see a double pick coming)
const pickOrder = n => Array.from({length:n},(_,i)=>turnAt(S.k+i));
function checkLocks(){ players().forEach(p=>{ if(!S.locked[p] && !canAny(p)) S.locked[p]=true; }); }
function afterTurn(){
  checkLocks();
  if(S.locked.every(Boolean)) startBattle();
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
  ['tanjiro','zenitsu'],['tanjiro','inosuke'],['zenitsu','inosuke'],
  ['gyutaro','daki'],['susamaru','yahaba'],['kanae','shinobu'],['kanae','kanao'],['muichiro','typezero']];
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
  sunproof:!!c.sunproof,noDefend:!!c.noDefend,basic:c.basic||null,
  sig:c.sig,cd:0,alive:true,spawn:!!c.spawn,splits:c.splits||null,merge:c.merge||null,poison:null,stun:false,stunNext:false,defending:false,evade:false,sunburn:false}; }
// Applies team bonuses to the units and returns their labels ('!' prefix = a penalty)
function synergies(p){
  const t=S.teams[p], e=enemiesOf(p).flatMap(q=>S.teams[q]), has=f=>t.some(u=>u.fam===f), out=[];
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
  if(has('gyutaro')&&has('daki')){ S.twins[p]=true; t.filter(u=>u.fam==='gyutaro').forEach(u=>u.pow+=2); out.push('Two as One: Gyutaro +2 PWR'); }
  if(has('susamaru')&&has('yahaba')){ t.filter(u=>u.fam==='susamaru').forEach(u=>u.pierceAll=true); out.push('Temari & Arrows: past Defend'); }
  if(has('kanae')&&has('shinobu')){ t.filter(u=>u.fam==='shinobu').forEach(u=>u.poisonTurns=4); out.push('Kocho Sisters: longer poison'); }
  if(has('kanae')&&has('kanao')){ t.filter(u=>u.fam==='kanao').forEach(u=>u.pow+=1); out.push("Kanae's student: Kanao +1 PWR"); }
  if(has('typezero')&&has('muichiro')){ t.filter(u=>u.fam==='muichiro').forEach(u=>u.pow+=1); out.push('Training partner: Muichiro +1 PWR'); }
  if(has('zenitsu') && e.some(u=>u.fam==='kaigaku')){ t.filter(u=>u.fam==='zenitsu').forEach(u=>u.pow+=2); out.push('Rival: Zenitsu +2 PWR'); }
  return out;
}
function startBattle(){
  S.n=S.picks.length;
  S.teams=players().map(p=>fighterIds(p).map(id=>mkUnit(id,p)));
  S.helpers=players().map(p=>S.picks[p].filter(isHelper)); S.helperPlan=players().map(()=>[]); S.scoutQueue=[]; S.scouting=false;
  if(S.mode!=='story'){ S.twist=null; S.startState=null; S.boosts=null; S.phases=null; S.beats=null; }   // story twists never leak into other games
  S.said={}; S.failed=false;
  S.survived=false;
  S.sib=players().map(()=>false); S.twins=players().map(()=>false); S.syn=players().map(p=>synergies(p)); S.outOrder=[];
  S.round=1; S.plans=players().map(()=>({})); S.lastPlans=players().map(()=>null); S.log=[]; S.planFor=S.me||0; S.focus=null; S.stats={};
  S.movesLocked=players().map(()=>false); S.readyNext=players().map(()=>false); S.roundId=0;   // online play
  // story: stat boosts shown on the stage card ({side, hp: ×, pow/def/spd: +, label}), e.g. a boss with more HP
  (S.boosts||[]).forEach(b=>S.teams[b.side].forEach(u=>{ if(b.only && !b.only.includes(u.id)) return;
    if(b.hp){ u.max=u.hp=Math.round(u.max*b.hp); } u.pow+=b.pow||0; u.def+=b.def||0; u.spd+=b.spd||0; }));
  // story: an enemy that starts the fight already hurt (part 2 of a two-part fight)
  Object.entries(S.startState||{}).forEach(([id,st])=>S.teams[1].filter(u=>u.id===id).forEach(u=>{
    if(st.hp) u.hp=Math.ceil(u.max*st.hp); if(st.devoured) u.devoured=st.devoured; if(st.poison) u.poison={...st.poison}; }));
  S.phase = S.mode==='local' ? 'pass' : 'plan';
}
const alive = p => S.teams[p].filter(u=>u.alive);
const findU = uid => allUnits().find(u=>u.uid===uid);
// Every enemy fighter still standing, from all the other teams
const foes = p => enemiesOf(p).flatMap(q=>alive(q));
// Your fighters and (2v2) your partner's: who ally moves (heals, hides, shields, training) can target
const friends = p => players().filter(q=>sameSide(p,q)).flatMap(q=>alive(q));

/* ---------- move planning ---------- */
const isAllyMove = (u,pl) => pl.type==='special' && u.sig.kind==='ally';
// Free-for-all (3–4 players): a special that hits "every enemy" hits every fighter on the team you aim at, so you pick a target
const aimsTeam = u => u.sig.kind==='all' && nPlayers()>2;
const needsTarget = (u,pl) => pl.type==='attack' || (pl.type==='special' && (u.sig.kind==='single'||u.sig.kind==='ally'||aimsTeam(u)));
const targetOptions = (u,pl) => !needsTarget(u,pl) ? [] : isAllyMove(u,pl) ? friends(u.p) : foes(u.p);
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
  gyomei: u=>({all:true, base:u.sig.dmg, o:{ignoreDef:true}}),
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
  daki: u=>({all:true, base:u.pow-3}),
  zohakuten: u=>({all:true, base:u.pow-4, o:{pierce:true}}),
  susamaru: u=>({base:u.pow-1, bonus:1.6}),          // also hits a second enemy
  kanae: u=>({base:u.pow+3, bonus:1.15}),             // plus a small heal
  tanjiro_demon: u=>({all:true, base:u.pow-4, o:{ignoreDef:true}}),
  nezuko_awakened: ()=>({all:true, base:10, o:{ignoreDef:true}}),
};
// Easy: the original simple computer. Specials at random when ready, always hits whoever has the least HP.
function cpuPlanEasy(p){
  const enemy=foes(p);
  alive(p).forEach(u=>{
    if(u.stun) return;
    const low=enemy.slice().sort((a,b)=>a.hp-b.hp)[0];
    let type='attack';
    if(u.cd===0 && Math.random()<.7) type='special';
    else if(u.hp<u.max*.3 && Math.random()<.35 && !u.noDefend) type='defend';
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
// How strongly the computer focuses the leading team in a free-for-all
const FFA_FOCUS = 150;
function cpuPlan(p, level='hard'){
  if(level==='easy') return cpuPlanEasy(p);
  const noise=LEVELS[level].noise;
  const foesNow=foes(p), mine=alive(p), planned={};
  const left = t => t.hp - (planned[t.uid]||0);
  const threat = t => t.pow*t.strikes + (t.cd===0?4:0);
  // free-for-all: gang up on the team that's ahead (most health × power left), like real players would
  const power = q => alive(q).reduce((a,x)=>a+x.hp*x.pow,0), top=Math.max(1,...enemiesOf(p).map(power));
  const lead = t => nPlayers()>2 ? FFA_FOCUS*power(t.p)/top : 0;
  const score = (t,d) => { const l=left(t); if(l<=0) return 0; d=Math.min(d,l); return d/t.max*100 + (d>=l ? 40+threat(t) : 0) + (d>0?lead(t):0); };
  const best = (base,o) => foesNow.reduce((b,t)=>{ const s=score(t,estHit(t,base,o))+threat(t)*.5+Math.random()*noise; return s>b.s?{t,s}:b; },{t:foesNow[0],s:-1}).t;
  const pctHurt = m => m.hp/m.max;
  mine.forEach(u=>{
    if(u.stun) return;
    const at=best(u.pow), atD=estHit(at,u.pow)*u.strikes;
    let plan={type:'attack', t:at.uid, v:score(at,atD), hits:[[at,atD]]};
    // Nakime's Biwa Strum: slow down the most dangerous enemy
    if(u.basic){ const t=foesNow.slice().sort((a,b)=>threat(b)-threat(a))[0]; plan={type:'attack', t:t.uid, v:8, hits:[]}; }
    if(u.cd===0){
      const e=SIG_EST[u.sk]; let sp=null;
      if(e){ const x=e(u);
        if(x.all){ const teams=aimsTeam(u) ? enemiesOf(p).map(q=>alive(q)).filter(a=>a.length) : [foesNow];
          teams.forEach(team=>{ const c={type:'special', t:team[0].uid, v:0, hits:[]}; team.forEach(t=>{ const d=estHit(t,x.base,x.o); c.v+=score(t,d); c.hits.push([t,d]); }); if(!sp||c.v>sp.v) sp=c; }); }
        else if(x.random){ sp={type:'special', v:x.random*foesNow.reduce((a,t)=>a+score(t,estHit(t,x.base)),0)/foesNow.length, hits:[]}; }
        else { const t=best(x.base,x.o), d=estHit(t,x.base,x.o); sp={type:'special', t:t.uid, v:score(t,d)*(x.bonus||1)+(x.stun?10+threat(t):0), hits:[[t,d]]}; }
      } else {
        const hurt=mine.slice().sort((a,b)=>pctHurt(a)-pctHurt(b))[0];
        switch(u.sk){
          case 'giyu': { const danger=foesNow.filter(f=>f.cd===0).reduce((a,f)=>a+f.pow,0); sp={type:'special', v: danger>=12 || pctHurt(hurt)<.4 ? 30+danger : 0}; break; }
          case 'genya': sp={type:'special', v: S.round<=3 ? 40 : u.hp<u.max*.6 ? 30 : 12}; break;
          case 'tamayo': { const sick=mine.find(m=>m.poison), t=sick||hurt; sp={type:'special', t:t.uid, v:Math.min(10,t.max-t.hp)/t.max*100+(sick?20:0)}; break; }
          case 'yushiro': sp={type:'special', t:hurt.uid, v: pctHurt(hurt)<.4 ? 45 : 0}; break;
          case 'sabito': { const t=mine.slice().sort((a,b)=>b.pow*b.strikes-a.pow*a.strikes)[0]; sp={type:'special', t:t.uid, v: S.round<=4 ? 35 : 15}; break; }
          case 'tengen_retired': sp={type:'special', t:hurt.uid, v: pctHurt(hurt)<.5 ? 30 : 0}; break;
          case 'hantengu': sp={type:'special', v: u.hp<u.max*.7 ? 35 : 10}; break;
          case 'kagaya': sp={type:'special', v: mine.reduce((a,m)=>a+Math.min(4,m.max-m.hp)/m.max*100,0)}; break;
          case 'enmu': sp={type:'special', v: foesNow.filter(f=>f.cd<=1).length*14}; break;
          case 'shinobu': { const t=foesNow.slice().sort((a,b)=>(b.demon-a.demon)||(b.hp-a.hp))[0]; sp={type:'special', t:t.uid, v: t.poison ? 0 : t.demon ? 45 : 25}; break; }
          case 'nakime': { const t=foesNow.slice().sort((a,b)=>threat(b)-threat(a))[0]; sp={type:'special', t:t.uid, v:15+threat(t)}; break; }
          case 'yahaba': { const t=foesNow.slice().sort((a,b)=>threat(b)-threat(a))[0]; sp={type:'special', t:t.uid, v:10+threat(t)*1.2}; break; }
          case 'typezero': { const t=mine.slice().sort((a,b)=>b.pow*b.strikes-a.pow*a.strikes)[0]; sp={type:'special', t:t.uid, v: S.round<=3 ? 25 : 10}; break; }
          case 'kyogai': { const t=foesNow.slice().sort((a,b)=>threat(b)-threat(a))[0]; sp={type:'special', t:t.uid, v:12+threat(t)}; break; }
        }
      }
      if(sp && sp.v+Math.random()*noise > plan.v+Math.random()*noise) plan=sp;
    }
    // badly hurt with nothing worth doing: guard
    if(u.hp<=u.max*.25 && plan.v<30 && Math.random()<.6 && !u.noDefend) plan={type:'defend'};
    (plan.hits||[]).forEach(([t,d])=>{ planned[t.uid]=(planned[t.uid]||0)+d; });
    S.plans[p][u.uid]={type:plan.type, t:plan.t};
  });
}

/* ---------- resolving a round ---------- */
// Each log line keeps everyone's HP at that moment, so the round can be played back step by step
// What a line shows on the fight stage during playback: effect type, who did it (by) and who it landed on (on)
// move = 'attack' or 'special' while a fighter is acting (null for end-of-round effects), for the breathing-style effects and grouping
const fx = (type, by, on) => ({fx:type, by:by?by.uid:null, on:on?on.uid:null, move:S.curMove||null});
function L(t,c='',extra){ const hp={}; allUnits().forEach(u=>{ hp[u.uid]=u.hp; }); S.log.push(Object.assign({t,c,hp},extra)); }
function target(u,tid){ let t=findU(tid); if(!t||!t.alive||sameSide(t.p,u.p)){ const a=foes(u.p); t=a.length?rnd(a):null; } return t; }
function fall(t,a){ if(t.hp>0) return; if(t.grit){ t.grit=false; t.hp=1; L(`${t.name} somehow survives on ${pct(t)}% health!`,'h',fx('heal',null,t)); return; } if(t.revive){ t.hp=Math.ceil(t.max*t.revive); t.revive=0; L(`${t.name} falls… and rises again! Seven Hearts ${gained(t,t.hp)}.`,'x',fx('revive',null,t)); return; }
  t.alive=false; L(`${t.name} falls!`,'k',{ko:t.uid, ...fx('ko',a,t)});
  // Gyutaro and Daki (Two as One): a fallen sibling gets back up (once each) at the end of the round if the other is still standing
  if(S.twins && S.twins[t.p] && (t.fam==='gyutaro'||t.fam==='daki') && !t.rose){ t.rise=true; t.rose=true; }
  // Shinobu's Wisteria Body: the demon who knocks her out devours her and is poisoned. Not Akaza: he never eats women.
  if(t.fam==='shinobu' && a && a.alive && a.demon && a.fam!=='akaza'){ a.devoured=5; L(`${a.name} devours Shinobu, but her body is full of wisteria poison. ${a.name} will lose ${lost(a,5)} every round.`,'h',fx('poison',null,a)); }
  if(t.splits) split(t);
  if(t.merge) merge(t); }
// Hantengu's forms: a fallen form is replaced by the forms it splits into. They join the team at full health and act from next round.
// Hantengu's emotions: when the last form with this merge falls, they merge into that form (Zohakuten). Acts from next round.
function merge(t){
  if(S.teams[t.p].some(u=>u.alive && u.merge===t.merge)) return;
  const m=mkUnit(t.merge,t.p); S.teams[t.p].push(m);
  L(`The emotions merge into one body. ${m.name} appears!`,'x',{spawn:[m.uid], ...fx('spawn',null,t)});
}
function split(t){
  const kids=t.splits.map(id=>mkUnit(id,t.p)); S.teams[t.p].push(...kids);
  const names=kids.map(k=>k.name), list=names.length>1 ? names.slice(0,-1).join(', ')+' and '+names[names.length-1] : names[0];
  L(`${t.name} splits! ${list} ${kids.length>1?'appear':'appears'}.`,'x',{spawn:kids.map(k=>k.uid), ...fx('spawn',null,t)});
}
function hit(a,t,base,o={}){
  if(!t||!t.alive) return 0;
  if(S.shield[t.p]){ L(`${t.name} is untouched. Dead Calm blocks it.`,'x',fx('block',a,t)); return 0; }
  if(t.evade){ L(`${a.name} strikes at ${t.name}, but hits nothing.`,'x',fx('miss',a,t)); return 0; }
  if(t.away){ L(`${a.name} can't find ${t.name}. They're in another room of the castle.`,'x',fx('miss',a,t)); return 0; }
  if(a.astray){ L(`Yahaba's arrows bend ${a.name}'s blow away from ${t.name}.`,'x',fx('miss',a,t)); return 0; }
  let d = o.ignoreDef ? base : Math.max(1, base - t.def, Math.ceil(base/2));
  const guarded = t.defending && !o.pierce && !a.pierceAll;
  if(guarded) d = Math.ceil(d/2);
  let note = guarded?' (guarded)':'';
  if(t.cap){ const room=t.cap-t.taken; if(room<=0){ L(`${t.name} sees it coming in the Transparent World. No damage.`,'x',fx('block',a,t)); return 0; } if(d>room){ d=room; note+=' (capped)'; } t.taken+=d; }
  d=Math.max(0,d); const before=t.hp; t.hp = Math.max(0, t.hp - d);
  L(`${a.name} hits ${t.name} ${lost(t,Math.min(d,before))}${note}.`,'',fx('hit',a,t));
  if(o.sun && t.demon && t.regen && !t.sunproof){ t.regen=0; t.sunburn=true; L(`${t.name} is burned by the sun. No more regeneration.`,'h',fx('burn',a,t)); }
  fall(t,a);
  if(o.counter!==false && S.sib[t.p] && a.alive && (t.fam==='tanjiro'||t.fam==='nezuko')){
    const partner = S.teams[t.p].find(u=>u.alive && u!==t && (u.fam==='tanjiro'||u.fam==='nezuko'));
    if(partner && !(a.cap && a.taken>=a.cap)){ let cd=3; if(a.cap){ cd=Math.min(cd,a.cap-a.taken); a.taken+=cd; } a.hp=Math.max(0,a.hp-cd); L(`${partner.name} counters ${a.name} ${lost(a,cd)} to protect ${t.fam==='tanjiro'?'her brother':'his sister'}.`,'h',fx('hit',partner,a)); fall(a,partner); }
  }
  return d;
}
function stunT(t){ if(t&&t.alive&&!S.shield[t.p]&&!t.evade){ t.stunNext=true; L(`${t.name} will lose next round.`,'k',fx('stun',null,t)); } }
function special(u,pl){
  const s=u.sig, en=()=>aimsTeam(u) ? aimedTeam(u,pl) : foes(u.p);
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
    case 'tamayo': { let t=findU(pl.t); if(!t||!t.alive||!sameSide(t.p,u.p)) t=alive(u.p).sort((a,b)=>a.hp/a.max-b.hp/b.max)[0]; const h=Math.min(10,t.max-t.hp); t.hp+=h; t.poison=null; L(`Tamayo heals ${t===u?'herself':t.name} ${gained(t,h)} and clears any poison.`,'h',fx('heal',u,t)); break; }
    case 'gyokko': { const t=target(u,pl.t); if(t&&t.alive){ hit(u,t,u.pow-2,{ignoreDef:true}); stunT(t); } break; }
    case 'sabito': { let t=findU(pl.t); if(!t||!t.alive||!sameSide(t.p,u.p)) t=u; t.pow+=2; L(`Sabito trains ${t===u?'himself':t.name}: +2 PWR for the rest of the match.`,'h',fx('buff',u,t)); break; }
    case 'muzan_final': { let n=0; en().forEach(e=>{ if(hit(u,e,u.pow-6,{ignoreDef:true,counter:false})>0) n++; }); if(u.alive&&n){ const h=Math.min(3*n,u.max-u.hp); u.hp+=h; L(`Final Muzan heals ${gained(u,h)}.`,'k',fx('heal',null,u)); } break; }
    case 'tengen_retired': { let t=findU(pl.t); if(!t||!t.alive||!sameSide(t.p,u.p)) t=u; t.defending=true; L(`Retired Tengen stands guard over ${t===u?'himself':t.name}. Half damage this round.`,'h',fx('guard',u,t)); break; }
    case 'yushiro': { let t=findU(pl.t); if(!t||!t.alive||!sameSide(t.p,u.p)) t=u; t.evade=true; L(`${t===u?'Yushiro':t.name} vanishes behind the talisman.`,'h',fx('guard',u,t)); break; }
    case 'murata': hit(u,target(u,pl.t),u.pow+2); break;
    case 'giyu': players().filter(q=>sameSide(q,u.p)).forEach(q=>{ S.shield[q]=true; }); L(`${S.names[u.p]}'s team can't be hurt this round.`,'h',fx('guard',u,null)); break;
    case 'gyomei': en().forEach(e=>hit(u,e,s.dmg,{ignoreDef:true,counter:false})); break;
    case 'sanemi': { const t=target(u,pl.t); hit(u,t,u.pow); const o=en().filter(e=>e!==t); if(o.length) hit(u,rnd(o),u.pow); break; }
    case 'muichiro': hit(u,target(u,pl.t),u.pow+2); break;
    case 'mitsuri': en().forEach(e=>hit(u,e,u.pow-3,{counter:false})); break;
    case 'obanai': hit(u,target(u,pl.t),u.pow+4,{pierce:true}); break;
    case 'rengoku': hit(u,target(u,pl.t),u.pow+8); break;
    case 'shinobu': { const t=target(u,pl.t); if(t&&t.alive){ if(S.shield[t.p]||t.evade){L(`The poison misses.`,'x',fx('miss',u,t));break;} t.poison={dmg:t.demon?6:3,turns:u.poisonTurns||3}; L(`${t.name} is poisoned.`,'h',fx('poison',u,t)); } break; }
    case 'tengen': en().forEach(e=>hit(u,e,u.pow-2,{counter:false})); break;
    case 'rui': { const t=target(u,pl.t); hit(u,t,u.pow); stunT(t); break; }
    case 'kyogai': stunT(target(u,pl.t)); break;
    case 'hand': hit(u,target(u,pl.t),u.pow+3); break;
    case 'swamp': hit(u,target(u,pl.t),u.pow+1); break;
    case 'gyutaro': en().forEach(e=>{ hit(u,e,4,{ignoreDef:true,counter:false}); if(e.alive&&!S.shield[e.p]&&!e.evade&&(!e.poison||e.poison.dmg<2)) e.poison={dmg:2,turns:2}; }); break;
    case 'akaza': hit(u,target(u,pl.t),u.pow+6); break;
    case 'daki': en().forEach(e=>hit(u,e,u.pow-3,{counter:false})); break;
    case 'nakime': { const t=target(u,pl.t); if(t&&t.alive){ t.away=true; L(`Nakime strums. ${t.name} is sent to another room of the castle this round.`,'k',fx('stun',u,t)); } break; }
    case 'zohakuten': en().forEach(e=>hit(u,e,u.pow-4,{pierce:true,counter:false})); break;
    case 'susamaru': { const t=target(u,pl.t); hit(u,t,u.pow-1); const o=en().filter(e=>e!==t); if(o.length) hit(u,rnd(o),u.pow-1); break; }
    case 'yahaba': { const t=target(u,pl.t); if(t&&t.alive){ t.astray=true; L(`Yahaba's arrows lock onto ${t.name}. Every hit they throw this round will miss.`,'k',fx('stun',u,t)); } break; }
    case 'kanae': { hit(u,target(u,pl.t),u.pow+3); const m=alive(u.p).sort((a,b)=>a.hp/a.max-b.hp/b.max)[0]; if(m){ const h=Math.min(4,m.max-m.hp); if(h){ m.hp+=h; L(`Kanae's petals heal ${m===u?'her':m.name} ${gained(m,h)}.`,'h',fx('heal',u,m)); } } break; }
    case 'tanjiro_demon': en().forEach(e=>hit(u,e,u.pow-4,{ignoreDef:true,counter:false})); break;
    case 'nezuko_awakened': { en().forEach(e=>hit(u,e,10,{ignoreDef:true,counter:false})); const sick=alive(u.p).filter(m=>m.poison); sick.forEach(m=>{ m.poison=null; }); if(sick.length) L(`Nezuko's blood burns the poison off ${sick.map(m=>m.name).join(', ')}.`,'h',fx('heal',u,null)); break; }
    case 'typezero': { let t=findU(pl.t); if(!t||!t.alive||!sameSide(t.p,u.p)) t=u; t.spd+=2; L(`Type Zero drills ${t===u?'itself':t.name}: +2 SPD for the rest of the match.`,'h',fx('buff',u,t)); break; }
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
// Gyutaro and Daki (Two as One): one who fell this round gets back up with 30% if the other is still standing.
// If both fell in the same round, both stay down. Each can only get back up once (unlimited won 94% of matches).
function twinsRise(){
  players().forEach(p=>{ if(!S.twins[p]) return;
    const pair=S.teams[p].filter(u=>u.fam==='gyutaro'||u.fam==='daki');
    pair.filter(u=>u.rise).forEach(u=>{ u.rise=false; const o=pair.find(x=>x!==u);
      if(o && o.alive){ u.alive=true; u.hp=Math.ceil(u.max*.3); u.poison=null; L(`${u.name} rises again while ${o.name} still stands ${gained(u,u.hp)}. Two as One!`,'x',fx('revive',null,u)); } }); });
}
// Nakime never fights: if she's the last one standing on her team, she flees (counts as knocked out)
function aloneCheck(){
  players().forEach(p=>{ const a=alive(p); if(!a.length || !a.every(u=>u.basic)) return;
    a.forEach(u=>{ u.alive=false; u.hp=0; L(`${u.name} is alone. She flees into the castle.`,'k',{ko:u.uid, ...fx('ko',null,u)}); }); });
}
// Free-for-all: the team an "every enemy" special lands on (the aimed fighter's team; if it's gone, a random team still standing)
function aimedTeam(u,pl){ const t=findU(pl.t), q=t && !sameSide(t.p,u.p) && alive(t.p).length ? t.p : rnd(enemiesOf(u.p).filter(q=>alive(q).length)); return q===undefined ? [] : alive(q); }
// A back-pocket helper's effect, at the start of the round it's used. It then leaves the back pocket.
function useHelper(p, id){
  S.helpers[p]=S.helpers[p].filter(h=>h!==id);
  const team=alive(p), tag={fx:id==='chachamaru'?'heal':id==='mice'?'buff':'special', by:null, on:null, helper:id};
  if(id==='chachamaru'){   // the most hurt fighter (lowest health %) heals half of their current HP
    const u=team.slice().sort((a,b)=>a.hp/a.max-b.hp/b.max)[0];
    if(u){ const h=Math.min(Math.ceil(u.hp/2), u.max-u.hp); u.hp+=h; L(`Chachamaru delivers Tamayo's medicine to ${u.name} ${gained(u,h)}.`,'h',{...tag, on:u.uid}); }
  }
  if(id==='mice'){ team.forEach(u=>{ u.pow+=MICE_PWR; u.miceBoost=(u.miceBoost||0)+MICE_PWR; }); L(`The Muscle Mice flex! ${S.names[p]}'s team gets +${MICE_PWR} PWR this round.`,'h',tag); }
  if(id==='hotaru'){   // the fighter with the longest wait for their special gets it ready for next round
    const u=team.slice().sort((a,b)=>b.cd-a.cd)[0];
    if(u && u.cd>0){ u.cd=0; L(`Hotaru reforges ${u.name}'s blade. Their special is ready next round.`,'h',{...tag, fx:'buff', on:u.uid}); }
    else L(`Hotaru has nothing to sharpen and storms off.`,'x',tag);
  }
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
    if(have.includes('hotaru') && team.some(u=>u.cd>=2)) use.push('hotaru');
  }
  S.helperPlan[p]=use;
}
// Computer with a crow: it has seen the other side's moves, so any fighter about to be knocked out defends instead
function cpuScout(p){
  const incoming={};
  foes(p).forEach(e=>{
    const q=S.plans[e.p][e.uid]; if(!q || e.stun) return;
    const x = q.type==='special' && SIG_EST[e.sk] ? SIG_EST[e.sk](e) : null;
    const base = q.type==='attack' ? e.pow*e.strikes : x ? x.base : 0; if(!base) return;
    const hits = x && x.all && (!aimsTeam(e) || (findU(q.t)||{}).p===p) ? alive(p) : [findU(q.t)].filter(t=>t && t.p===p);
    hits.forEach(t=>{ incoming[t.uid]=(incoming[t.uid]||0)+estHit(t, base, x?x.o:{}); });
  });
  alive(p).forEach(u=>{ if(!u.stun && !u.noDefend && (incoming[u.uid]||0)>=u.hp) S.plans[p][u.uid]={type:'defend'}; });
}
// Every side played by the computer (simulator and checks): moves, back-pocket helpers, then crow scouting
function cpuBothSides(l0='hard', l1='hard'){
  players().forEach(p=>cpuPlan(p, p===0?l0:l1)); players().forEach(p=>cpuHelpers(p));
  players().forEach(p=>{ if(S.helperPlan[p].includes('crow')) cpuScout(p); });
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
  S.log=[]; S.shield=players().map(()=>false);
  L(`Round ${S.round}`,'r');
  players().forEach(p=>(S.helperPlan&&S.helperPlan[p]||[]).forEach(id=>useHelper(p,id)));   // back-pocket helpers act first
  const acts=[];
  players().forEach(p=>alive(p).forEach(u=>{ u.taken=0; acts.push({u, pl: u.stun?{type:'stunned'}:(S.plans[p][u.uid]||{type:u.noDefend?'attack':'defend'}), r:Math.random()}); }));
  acts.forEach(x=>{ if(x.pl.type==='defend') x.u.defending=true; });
  // Nakime's Biwa Strum always goes first: the enemy she picks acts last this round
  acts.forEach(x=>{ if(x.pl.type!=='attack' || !x.u.basic) return; const t=findU(x.pl.t); if(!t || !t.alive || t.p===x.u.p) return;
    t.late=true; S.curMove='attack'; L(`${x.u.name} strums her biwa. ${t.name} will act last this round.`,'x',fx('stun',x.u,t)); S.curMove=null; });
  const prio = x => x.pl.type==='special' ? (x.u.sig.prio||0) : 0;
  acts.sort((a,b)=> (a.u.late?1:0)-(b.u.late?1:0) || prio(b)-prio(a) || b.u.spd-a.u.spd || a.r-b.r);
  aloneCheck(); storyBeats('round');
  for(const x of acts){
    const u=x.u; if(!u.alive) continue;
    S.curMove=x.pl.type;
    if(x.pl.type==='stunned'){ L(`${u.name} can't move.`,'',fx('stun',null,u)); continue; }
    if(u.away){ L(`${u.name} is lost in the Infinity Castle and can't act.`,'',fx('stun',null,u)); continue; }
    if(x.pl.type==='attack' && u.basic) continue;   // Nakime's strum already happened
    if(x.pl.type==='defend'){ L(`${u.name} braces.`,'',fx('guard',null,u)); continue; }
    if(x.pl.type==='special' && (u.sk==='muichiro'||u.sk==='swamp')) u.evade=true;
    if(x.pl.type==='attack') for(let i=0;i<u.strikes;i++){ if(!foes(u.p).length) break; hit(u,target(u,x.pl.t),u.pow); }
    if(x.pl.type==='special') special(u,x.pl);
    aloneCheck(); storyBeats();
    if(sidesUp().length<=1 || S.failed) break;
  }
  S.curMove=null;
  // end of round: poison, Shinobu's devour damage, sunrise, regeneration, cooldowns
  const sun=sunUp();
  if(sun && S.round===SUNRISE_ROUND) L('The sun rises! From now on demons burn every round and stop regenerating.','h',fx('burn',null,null));
  players().forEach(p=>S.teams[p].forEach(u=>{
    if(u.alive && u.poison){ u.hp=Math.max(0,u.hp-u.poison.dmg); L(`Poison hits ${u.name} ${lost(u,u.poison.dmg)}.`,'k',fx('poison',null,u)); fall(u); u.poison.turns--; if(u.poison.turns<=0) u.poison=null; }
    if(u.alive && u.devoured){ u.hp=Math.max(0,u.hp-u.devoured); L(`Shinobu's poison eats away at ${u.name} ${lost(u,u.devoured)}.`,'k',fx('poison',null,u)); fall(u); }
    if(sun && u.alive && u.demon && !u.sunproof){ const d=Math.ceil(u.max*SUN_BURN); u.hp=Math.max(0,u.hp-d); L(`The sun burns ${u.name} ${lost(u,d)}.`,'k',fx('burn',null,u)); fall(u); }
    if(u.alive && u.regen && u.hp<u.max && !(sun && u.demon && !u.sunproof)){ const h=Math.min(u.regen,u.max-u.hp); u.hp+=h; L(`${u.name} regenerates ${gained(u,h)}.`,'',fx('heal',null,u)); }
    if(u.cd>0) u.cd--;
    u.stun=u.stunNext; u.stunNext=false; u.defending=false; u.evade=false; u.away=false; u.astray=false; u.late=false;
    if(u.miceBoost){ u.pow-=u.miceBoost; u.miceBoost=0; }   // Muscle Mice last one round
  }));
  twinsRise(); aloneCheck(); storyBeats();
  tallyRound();
  S.plans=players().map(()=>({})); S.helperPlan=players().map(()=>[]);
  // teams knocked out this round, in order (free-for-all places: last out = 2nd…). Several at once share a place.
  const out=players().filter(p=>!alive(p).length && !S.outOrder.some(o=>o.includes(p))); if(out.length) S.outOrder.push(out);
  const up=standing(), tw=S.twist||{};
  if(S.failed){ S.winner=1; S.phase='over'; }   // story: the ally you had to protect fell
  else if(sidesUp().length<=1){ S.winner = up.length ? up[0] : -1; S.phase='over'; }   // 2v2: any player of the winning side
  else if(tw.survive && S.round>=tw.survive){ S.winner=0; S.survived=true; S.phase='over'; L(`The sun rises. ${S.names[0]}'s team held out!`,'h',fx('burn',null,null)); }
  else if(S.round>=40){ S.winner=-1; S.phase='over'; }   // nobody wins after 40 rounds
  else { S.phase='result'; reinforcements(); }
}
// Sunrise: long games end. From round SUNRISE_ROUND demons (except the sun-proof) burn SUN_BURN of their max HP every
// round and stop regenerating. Not in story mode (its own fights are about holding out until dawn).
const SUNRISE_ROUND = 12, SUN_BURN = .1;
const sunUp = () => S.mode!=='story' && S.round>=SUNRISE_ROUND;
/* ---------- story beats: protect, boss phases and mid-battle lines (all set by the stage; nothing hidden) ----------
   twist.protect: id      you lose if that fighter on your team falls
   S.phases: [{id, at, pow, spd, def, ready, label, line}]   an enemy powers up once when its health drops to `at`
   S.beats:  [{when:'low'|'ko'|'round', id, at, round, who, text}]   a character speaks (once each) */
const say = (u, text) => L(text, 'say', {fx:'say', by:u.uid, on:null, move:null});
function storyBeats(when){
  if(S.mode!=='story') return;
  const tw=S.twist||{}, all=allUnits(), find=id=>all.find(u=>u.id===id);
  (S.beats||[]).forEach((b,i)=>{ if(S.said[i]) return; const u=find(b.id), who=find(b.who||b.id)||u; if(!who) return;
    const hit = b.when==='round' ? when==='round' && S.round===b.round
      : b.when==='low' ? u && u.alive && u.hp<=u.max*(b.at||.3)
      : b.when==='ko' ? u && !u.alive : false;
    if(hit){ S.said[i]=true; say(who, b.text); } });
  (S.phases||[]).forEach(ph=>{ const u=S.teams[1].find(x=>x.id===ph.id); if(!u || !u.alive || u.phased || u.hp>u.max*ph.at) return;
    u.phased=true; if(ph.line) say(u, ph.line);
    u.pow+=ph.pow||0; u.spd+=ph.spd||0; u.def+=ph.def||0; if(ph.ready) u.cd=0;
    L(`${u.name} changes: ${ph.label}.`,'k',fx('buff',null,u)); });
  if(tw.protect && !S.failed){ const u=S.teams[0].find(x=>x.id===tw.protect); if(u && !u.alive){ S.failed=true; L(`${u.name} has fallen. You had to protect ${u.name}.`,'k',fx('ko',null,u)); } }
}
// Teams with anyone still standing
const standing = () => players().filter(p=>alive(p).length);
// Sides with anyone standing (in 2v2 a side is two players)
const sidesUp = () => [...new Set(standing().map(sideOf))];
// Final places for the win screen: [[winner], [2nd…], …], best first; teams that fell together share a place
function placings(){ const out=(S.outOrder||[]).slice().reverse(); return S.winner>=0 ? [[S.winner], ...out] : out; }
// story: allies who join your team at the start of a given round (they arrive at the end of the round before)
function reinforcements(){
  ((S.twist||{}).reinforce||[]).forEach(r=>{ if(r.round!==S.round+1) return;
    const u=mkUnit(r.id,0); S.teams[0].push(u);
    L(`${u.name} arrives to fight alongside ${S.names[0]}!`,'h',{spawn:[u.uid], ...fx('spawn',null,u)}); });
}
