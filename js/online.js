/* ================= ONLINE PLAY (two phones) =================
   One phone hosts (player 0) and runs the game; the other joins with a 4-letter room code (player 1).
   The host publishes the shared game state after every change; the guest draws it and sends its actions back
   (picks, locks, moves, "next round"…). The guest never receives the host's moves while both are choosing, unless
   the guest's Kasugai Crow is scouting.
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
const SHARED = ['phase','names','budget','poolType','first','lastPicker','history','picks','locked','k','pool','spin',
  'teams','sib','syn','round','plans','helpers','helperPlan','log','stats','winner','final','movesLocked','readyNext',
  'scoutQueue','scoutP','roundId','lobby'];
// What the host sends. While both sides are choosing, the host's own moves and helper are left out.
function snapshotFor(){
  const o={}; SHARED.forEach(k=>{ if(S[k]!==undefined) o[k]=S[k]; });
  const choosing = S.phase==='plan' || S.phase==='scout';
  const guestScouting = S.phase==='scout' && S.scoutP===1;
  if(choosing && !guestScouting){
    if(o.plans) o.plans=[{}, S.plans[1]||{}];
    if(o.helperPlan) o.helperPlan=[[], S.helperPlan[1]||[]];
  }
  return JSON.stringify(o);
}
// Guest: take the host's state, but keep the moves this phone is still choosing
function applySnapshot(json){
  const o=JSON.parse(json), prevRound=S.roundId;
  const stillChoosing = (o.phase==='plan' && !(o.movesLocked&&o.movesLocked[1])) || S.scouting;
  const mine = stillChoosing && S.plans ? {plans:S.plans[1], helpers:S.helperPlan&&S.helperPlan[1]} : null;
  Object.assign(S, o);
  S.planFor=S.me; S.lastPlans=S.lastPlans||[null,null];
  if(mine){ S.plans[1]=mine.plans||{}; S.helperPlan[1]=mine.helpers||[]; }
  if(S.phase!=='result') S.localOver=false;
  if(S.phase==='result' && S.roundId!==prevRound) ONLINE.hooks.roundPlayed();   // a new round to play back
}

/* ---------- host: game flow ---------- */
// Both sides have locked their moves: crow reports first (each in turn), then the round
function hostAfterLocks(){
  if(!(S.movesLocked[0] && S.movesLocked[1])) return;
  S.scoutQueue=[0,1].filter(p=>(S.helperPlan[p]||[]).includes('crow'));
  hostNextScout();
}
function hostNextScout(){
  if(S.scoutQueue.length){ S.scoutP=S.scoutQueue.shift(); S.phase='scout'; return; }
  S.scoutP=null; hostFight();
}
function hostFight(){
  S.info=null; resolve(); S.final = S.phase==='over'; S.phase='result';
  S.roundId=(S.roundId||0)+1; S.readyNext=[false,false];
  ONLINE.hooks.roundPlayed();
}
// Both phones tapped "Next round"
function hostMaybeNextRound(){
  if(!(S.readyNext[0] && S.readyNext[1]) || S.final) return;
  S.round++; S.phase='plan'; S.movesLocked=[false,false]; S.readyNext=[false,false];
}
function hostRematch(){ S.final=false; S.localOver=false; S.winner=undefined; S.phase='spin'; S.spin=null; }
// An action from the guest (player 1). Anything out of turn is ignored.
function hostHandle(msg){
  const p=1;
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

/* ---------- actions from this phone (host applies them, guest sends them) ---------- */
const send = msg => ONLINE.net && ONLINE.net.send(msg);
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
  S.lastPlans=S.lastPlans||[null,null]; S.lastPlans[me]=JSON.parse(JSON.stringify(S.plans[me]));
  if(S.scouting){                                   // re-planned after a crow report
    S.scouting=false;
    if(iAmHost()) hostNextScout(); else send({a:'moves', scout:true, plans:S.plans[1]});
    return;
  }
  S.movesLocked[me]=true;
  if(iAmHost()) hostAfterLocks(); else send({a:'moves', plans:S.plans[1], helperPlan:S.helperPlan[1]||[]});
}
function onlineKeepMoves(){ if(iAmHost()) hostNextScout(); else send({a:'keep'}); }
function onlineNext(){
  S.readyNext[S.me]=true;
  if(iAmHost()) hostMaybeNextRound(); else send({a:'next'});
}
function onlineRematch(){ if(iAmHost()) hostRematch(); else send({a:'rematch'}); }
