/* ================= ONLINE PLAY (2–4 phones) =================
   One phone hosts (player 0) and runs the game; up to three others join with a 4-letter room code (players 1–3,
   in the order they took a seat). The host sends each phone its own copy of the shared game state after every change;
   the guests draw it and send their actions back (picks, locks, moves, "next round"…), tagged with their seat.
   Privacy: while everyone is choosing, each phone's copy leaves out the other players' moves and helpers, unless that
   phone's Kasugai Crow is scouting.
   No DOM here: the transport is plugged in as ONLINE.net (Firebase in the browser, an in-memory bus in
   tools/check-online.js), and app.js supplies ONLINE.hooks.roundPlayed (start the playback animation). */
const ONLINE = { net:null, hooks:{ roundPlayed(){} } };
const isOnline = () => S.mode==='online';
const iAmHost = () => isOnline() && S.me===0;
// which side this phone plays: 0 except for an online guest
const myP = () => isOnline() ? S.me : 0;
const ROOM_LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const newRoomCode = () => Array.from({length:4}, ()=>ROOM_LETTERS[Math.floor(Math.random()*ROOM_LETTERS.length)]).join('');

// Game fields shared through the room. Everything else (menus, playback, selections, settings) stays on each phone.
const SHARED = ['phase','n','names','budget','poolType','first','lastPicker','history','picks','locked','k','pool','spin',
  'teams','sib','twins','syn','round','plans','helpers','helperPlan','log','stats','winner','final','movesLocked','readyNext',
  'scoutQueue','scoutP','roundId','lobby','outOrder'];
// What the host sends to player q. While everyone is choosing, the other players' moves and helpers are left out
// (unless q's crow is scouting: then q sees everyone's moves).
function snapshotFor(q=1){
  const o={}; SHARED.forEach(k=>{ if(S[k]!==undefined) o[k]=S[k]; });
  const choosing = S.phase==='plan' || S.phase==='scout';
  const scouting = S.phase==='scout' && S.scoutP===q;
  if(choosing && !scouting){
    if(o.plans) o.plans=o.plans.map((pl,p)=>p===q ? pl : {});
    if(o.helperPlan) o.helperPlan=o.helperPlan.map((h,p)=>p===q ? h : []);
  }
  return JSON.stringify(o);
}
// Guest: take the host's state, but keep the moves this phone is still choosing
function applySnapshot(json){
  const o=JSON.parse(json), prevRound=S.roundId, me=S.me;
  const stillChoosing = (o.phase==='plan' && !(o.movesLocked&&o.movesLocked[me])) || S.scouting;
  const mine = stillChoosing && S.plans ? {plans:S.plans[me], helpers:S.helperPlan&&S.helperPlan[me]} : null;
  Object.assign(S, o);
  S.planFor=me; S.lastPlans=S.lastPlans||players().map(()=>null);
  if(mine){ S.plans[me]=mine.plans||{}; S.helperPlan[me]=mine.helpers||[]; }
  if(S.phase!=='result') S.localOver=false;
  if(S.phase==='result' && S.roundId!==prevRound) ONLINE.hooks.roundPlayed();   // a new round to play back
}

/* ---------- host: game flow ---------- */
// Everyone still standing has locked their moves: crow reports first (each in turn), then the round
const choosers = () => players().filter(p=>alive(p).length);
function hostAfterLocks(){
  if(!choosers().every(p=>S.movesLocked[p])) return;
  S.scoutQueue=choosers().filter(p=>(S.helperPlan[p]||[]).includes('crow'));
  hostNextScout();
}
function hostNextScout(){
  if(S.scoutQueue.length){ S.scoutP=S.scoutQueue.shift(); S.phase='scout'; return; }
  S.scoutP=null; hostFight();
}
function hostFight(){
  S.info=null; resolve(); S.final = S.phase==='over'; S.phase='result';
  S.roundId=(S.roundId||0)+1; S.readyNext=players().map(()=>false);
  ONLINE.hooks.roundPlayed();
}
// Every phone tapped "Next round" (knocked-out players keep watching, so they tap too)
function hostMaybeNextRound(){
  if(!S.readyNext.every(Boolean) || S.final) return;
  S.round++; S.phase='plan'; S.movesLocked=players().map(p=>!alive(p).length); S.readyNext=players().map(()=>false);
}
function hostRematch(){ S.final=false; S.localOver=false; S.winner=undefined; S.phase='spin'; S.spin=null; }
// An action from a guest phone (msg.p = its seat). Anything out of turn is ignored.
function hostHandle(msg){
  const p=msg.p;
  if(!(p>0 && p<nPlayers()) && msg.a!=='rematch') return;
  switch(msg.a){
    case 'pick': if(S.phase==='draft' && turn()===p && canPick(p,msg.id)) doPick(msg.id); break;
    case 'lock': if(S.phase==='draft' && turn()===p && fighterIds(p).length) doLock(p); break;
    case 'undo': { const u=undoable(); if(u && u.p===p) undoPick(); break; }
    case 'moves':
      if(msg.scout){ if(S.phase==='scout' && S.scoutP===p){ S.plans[p]=msg.plans||{}; hostNextScout(); } break; }
      if(S.phase==='plan' && !S.movesLocked[p]){
        S.plans[p]=msg.plans||{};
        S.helperPlan[p]=(msg.helperPlan||[]).filter(h=>(S.helpers[p]||[]).includes(h));
        S.movesLocked[p]=true; hostAfterLocks();
      }
      break;
    case 'keep': if(S.phase==='scout' && S.scoutP===p) hostNextScout(); break;
    case 'next': if(S.phase==='result'){ S.readyNext[p]=true; hostMaybeNextRound(); } break;
    case 'rematch': if(S.phase==='result' && S.final) hostRematch(); break;
  }
}
// Host lobby: start with the players seated now (seats 0..n-1; an empty seat in the middle has to be filled first)
function hostStartMatch(){
  const seats=S.lobby.seats||[], n=1+seats.filter(x=>x&&x.on).length;
  if(n<2 || seats.slice(0,n-1).some(x=>!x||!x.on)) return false;
  S.n=n; S.names=[S.names[0], ...seats.slice(0,n-1).map(x=>x.name)];
  return true;
}

/* ---------- actions from this phone (host applies them, guests send them) ---------- */
const send = msg => ONLINE.net && ONLINE.net.send(Object.assign({p:S.me}, msg));
function onlinePick(id){
  if(S.phase!=='draft' || turn()!==S.me || !canPick(S.me,id)) return;
  if(iAmHost()) doPick(id); else send({a:'pick', id});
}
function onlineLockTeam(){
  if(S.phase!=='draft' || turn()!==S.me || !fighterIds(S.me).length) return;
  if(iAmHost()) doLock(0); else send({a:'lock'});
}
function onlineUndo(){
  const u=undoable(); if(!u || u.p!==S.me) return;
  if(iAmHost()) undoPick(); else send({a:'undo'});
}
function onlineLockMoves(){
  const me=S.me;
  S.lastPlans=S.lastPlans||players().map(()=>null); S.lastPlans[me]=JSON.parse(JSON.stringify(S.plans[me]));
  if(S.scouting){                                   // re-planned after a crow report
    S.scouting=false;
    if(iAmHost()) hostNextScout(); else send({a:'moves', scout:true, plans:S.plans[me]});
    return;
  }
  S.movesLocked[me]=true;
  if(iAmHost()) hostAfterLocks(); else send({a:'moves', plans:S.plans[me], helperPlan:S.helperPlan[me]||[]});
}
function onlineKeepMoves(){ if(iAmHost()) hostNextScout(); else send({a:'keep'}); }
function onlineNext(){
  S.readyNext[S.me]=true;
  if(iAmHost()) hostMaybeNextRound(); else send({a:'next'});
}
function onlineRematch(){ if(iAmHost()) hostRematch(); else send({a:'rematch'}); }
