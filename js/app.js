/* ================= APP =================
   Rendering and taps. The only file that touches the DOM. */
const app = document.getElementById('app'), sheet = document.getElementById('sheet');
const VIEWS = {setup:vSetup, lobby:vLobby, story:vStory, scout:vScout, spin:vSpin, draft:vDraft, pass:vPass, plan:vPlan, ready:vReady, result:vResult, over:vOver};
const quickMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
let scored = false, spinShown = null;
// which screen to draw: online, each phone shows the win screen on its own; a crow re-plan reuses the move screen
const viewName = () => isOnline() && S.final && S.localOver ? 'over' : S.phase==='scout' && S.scouting ? 'plan' : S.phase;

function render(){
  if(isOnline()) S.planFor=S.me;
  const view=viewName();
  if(view==='over' && !scored){ scored=true; if(S.winner>=0){ const sc=loadScore(), n=S.names[S.winner]; sc[n]=(sc[n]||0)+1; saveScore(sc); } recordMatch();
    if(S.mode==='story' && S.winner===0) saveStoryClear(STAGES[S.stage].id);
    sfx(S.winner<0 || (soloView() && S.winner!==myP()) ? 'lose' : 'win'); }
  if(view!=='over') scored=false;
  // keep fold-out sections (How to play, records…) open across redraws
  const open=[...app.querySelectorAll('details[id]')].filter(d=>d.open).map(d=>d.id);
  app.innerHTML=VIEWS[view](); sheet.innerHTML=vSheet();
  open.forEach(id=>{ const d=document.getElementById(id); if(d) d.open=true; });
  if(S.phase==='draft' && S.mode==='cpu' && turn()===1){ clearTimeout(S._t); S._t=setTimeout(()=>{ cpuDraftStep(S.level); render(); },700); }
  if(S.phase==='spin' && S.spin && S.spin.state==='spinning' && spinShown!==S.spin.angle) animateSpin();
  // online host: send the new shared state to the other phone (only when it changed)
  if(iAmHost() && ONLINE.net){ const j=snapshotFor(); if(j!==ONLINE.last){ ONLINE.last=j; ONLINE.net.publish(j); } }
}
// Turn the freshly drawn wheel to its landing angle, then show who won
function animateSpin(){
  spinShown=S.spin.angle;   // online, the guest's phone animates the host's spin too (the host decides when it's done)
  const w=app.querySelector('.wheel');
  requestAnimationFrame(()=>requestAnimationFrame(()=>{ w.classList.add('go'); w.style.transform=`rotate(${S.spin.angle}deg)`; }));
  // ticks that slow down with the wheel, then a ding
  if(!quickMotion()) for(let t=0,gap=40; t<3900; t+=gap, gap*=1.09) setTimeout(()=>sfx('tick'), t);
  clearTimeout(S._t); S._t=setTimeout(()=>{ if(isOnline() && !iAmHost()){ sfx('ding'); return; } S.spin.state='done'; sfx('ding'); render(); }, quickMotion()?300:4300);
}
// How long a playback line stays up: enough to read it, longer for long lines and knockouts
// Playback speed (Settings): Slow / Normal / Fast multiply how long each action stays up
const SPEEDS = {slow:1.4, normal:1, fast:.55};
function loadSpeed(){ try{ const v=localStorage.getItem('squad-draft-speed'); return v in SPEEDS ? v : 'normal' }catch(e){ return 'normal' } }
const pace = () => SPEEDS[S.speed]||1;
const readTime = line => quickMotion() ? 300 : (2200 + line.t.length*30 + (line.ko||line.spawn ? 1100 : 0)) * pace();
// a grouped special (several targets in one beat): longer for more targets and any knockouts
const groupTime = lines => quickMotion() ? 400 : (2400 + 450*lines.filter(l=>GROUP_FX.includes(l.fx)).length + (lines.some(l=>l.ko) ? 1100 : 0)) * pace();
// Play the round back one log line at a time. Knockouts buzz the phone (Android; iPhones don't allow vibration).
function playRound(){
  S.play={k:0, done:false, steps:playSteps(S.log)};
  const step=()=>{
    if(S.info){ S._t=setTimeout(step,300); return; }   // paused while a fighter's info card is open
    if(S.play.k>=S.play.steps.length-1){ S.play.done=true; render(); return; }
    S.play.k++; const [a,b]=S.play.steps[S.play.k], lines=S.log.slice(a,b+1), line=lines[0];
    if(lines.some(l=>l.ko) && navigator.vibrate) navigator.vibrate([90,50,160]);
    if(b>a){ sfx('bighit'); if(lines.some(l=>l.ko)) setTimeout(()=>sfx('ko'),250); } else sfxForLine(line);
    render();
    S._t=setTimeout(step, b>a ? groupTime(lines) : readTime(line));
  };
  sfx('gong'); clearTimeout(S._t); S._t=setTimeout(step, quickMotion() ? 250 : 1500*pace());   // the "Round N · Fight!" intro
}
function startDraft(){
  const n0 = document.getElementById('n0').value.trim()||'Player 1';
  const n1 = S.mode==='cpu' ? 'Muzan AI' : (document.getElementById('n1').value.trim()||'Player 2');
  S.names=[n0,n1]; if(S.mode==='2p') saveNames(S.names);
  toSpin();
}
function toSpin(){ S.phase='spin'; S.spin=null; window.scrollTo(0,0); }
// After a fighter's move is complete, open the next one that still needs a move
function advanceFocus(p){ const n=alive(p).find(u=>!u.stun && !unitReady(u)); S.focus = n ? n.uid : 'none'; }
function newPlanTurn(){ S.focus=null; S.info=null; window.scrollTo(0,0); }
// After both sides lock in: give each crow owner their report (and a chance to re-plan), then fight
function nextScoutOrFight(){
  S.scouting=false;
  if(S.scoutQueue.length){
    S.scoutP=S.scoutQueue.shift(); S.planFor=S.scoutP;
    if(vsCpu()) S.phase='scout'; else { S.phase='pass'; S.passScout=true; }
    return newPlanTurn();
  }
  S.passScout=false;
  if(vsCpu()) fight(); else S.phase='ready';
  newPlanTurn();
}
// Run the round, then play it back (a finished match still plays back first, then "See who won")
function fight(){ S.info=null; resolve(); S.final = S.phase==='over'; S.phase='result'; playRound(); }

const ACTIONS = {
  mode(v){ const n0=document.getElementById('n0'); if(n0) S.names[0]=n0.value; S.mode=v; if(v==='2p'){ const s=loadNames(); S.names[1]=(s&&s[1])||'Mia'; } },
  start: startDraft,
  home(){ clearTimeout(S._t); if(ONLINE.net){ ONLINE.net.leave(); ONLINE.net=null; ONLINE.last=''; } S={phase:'setup',mode:S.mode,level:S.level,budget:loadBudget(),poolType:S.poolType,soundOn:S.soundOn,speed:S.speed,names:vsCpu()?[S.names[0],(loadNames()||[])[1]||'Mia']:S.names}; },
  level(v){ S.level=v; saveLevel(v); },
  rematch(){ if(isOnline()) return onlineRematch(); toSpin(); },
  spin(){ if(isOnline() && !iAmHost()) return; if(!S.spin) S.spin=Object.assign(spinWheel(),{state:'spinning'}); },
  toDraft(){ if(isOnline() && !iAmHost()) return; newDraft(S.spin.r); },
  redeal(){ if(isOnline() && !iAmHost()) return; S.pool=buildPool(); S.sel=null; },
  ocreate(){ onlineCreate(); },
  ojoin(){ onlineJoin(); },
  ojoinopen(){ S.names[0]=myName(); S.joinOpen=!S.joinOpen; S.onlineMsg=''; setTimeout(()=>{ const el=document.getElementById('ocode'); if(el) el.focus(); }); },
  ostart(){ if(iAmHost() && S.lobby && S.lobby.peer) toSpin(); },
  // open a card's detail (from the grid or from a name in a pool note); any card in the pool can be viewed
  sel(v){ if(S.mode==='cpu' && turn()===1) return; if(S.pool.includes(v)) S.sel=v; },
  unsel(){ S.sel=null; S.info=null; S.settings=false; },
  settings(){ S.settings=true; },
  budget(v){ S.budget=+v; saveBudget(S.budget); },
  pooltype(v){ S.poolType=v; savePoolType(v); },
  info(v){ S.info=v; },
  fight(){ fight(); newPlanTurn(); },
  notes(){ S.notesOpen=!S.notesOpen; },
  confirmPick(){ if(isOnline()){ sfx('pick'); onlinePick(S.sel); S.sel=null; return; } if(!canPick(turn(),S.sel)) return; sfx('pick'); doPick(S.sel); if(S.phase!=='draft') newPlanTurn(); },
  undo(){ if(isOnline()) return onlineUndo(); undoPick(); },
  repeat(){ repeatPlans(S.planFor); advanceFocus(S.planFor); },
  speed(v){ S.speed=v; try{ localStorage.setItem('squad-draft-speed',v) }catch(e){} },
  sound(v){ S.soundOn=v==='on'; saveSoundOn(S.soundOn); if(S.soundOn) sfx('pick'); },
  storymap(){ const n0=document.getElementById('n0'); if(n0) S.names[0]=n0.value.trim()||S.names[0]; clearTimeout(S._t); S.budget=loadBudget(); S.phase='story'; window.scrollTo(0,0); },
  stage(v){ if(!stageUnlocked(+v)) return; startStage(+v); window.scrollTo(0,0); },
  lock(){ if(isOnline()) return onlineLockTeam(); doLock(turn()); if(S.phase!=='draft') newPlanTurn(); },
  reveal(){ S.phase=S.passScout?'scout':'plan'; newPlanTurn(); },
  helper(v){ const l=S.helperPlan[S.planFor]; S.helperPlan[S.planFor]=l.includes(v)?l.filter(x=>x!==v):l.concat(v); },
  rescout(){ if(isOnline()){ S.scouting=true; S.planFor=S.me; newPlanTurn(); const f=alive(S.me).find(u=>!u.stun); if(f) S.focus=f.uid; return; } S.scouting=true; S.planFor=S.scoutP; S.phase='plan'; S.passScout=false; newPlanTurn(); const f=alive(S.planFor).find(u=>!u.stun); if(f) S.focus=f.uid; },   // open the first fighter to change
  keepmoves(){ if(isOnline()) return onlineKeepMoves(); nextScoutOrFight(); },
  focus(v){ S.focus = focusOf(S.planFor)===v ? 'none' : v; },
  act(v,b){ const u=findU(b.dataset.u); setMove(u,v); if(unitReady(u)) advanceFocus(u.p); },
  tgt(v,b){ const u=findU(b.dataset.u); S.plans[u.p][u.uid].t=v; advanceFocus(u.p); },
  lockMoves(){
    if(isOnline()){ onlineLockMoves(); return newPlanTurn(); }
    S.lastPlans[S.planFor]=JSON.parse(JSON.stringify(S.plans[S.planFor]));   // for "Repeat last round"
    if(S.scouting) return nextScoutOrFight();          // re-planned after a crow report
    if(vsCpu()){
      cpuPlan(1, S.mode==='story'?stageLevel():S.level); cpuHelpers(1);
      if(S.helperPlan[1].includes('crow')) cpuScout(1);   // the computer's crow sees your moves
      S.scoutQueue=S.helperPlan[0].includes('crow')?[0]:[];
      return nextScoutOrFight();
    }
    if(S.planFor===0){ S.planFor=1; S.phase='pass'; return newPlanTurn(); }
    S.scoutQueue=[0,1].filter(p=>S.helperPlan[p].includes('crow'));   // two players: each crow owner gets a private report
    nextScoutOrFight();
  },
  skip(){ clearTimeout(S._t); S.play.done=true; },
  next(){ if(isOnline()){ onlineNext(); return window.scrollTo(0,0); } S.round++; S.planFor=0; S.play=null; S.phase=S.mode==='2p'?'pass':'plan'; newPlanTurn(); },
  finish(){ if(isOnline()){ S.localOver=true; return window.scrollTo(0,0); } S.play=null; S.phase='over'; window.scrollTo(0,0); },
};
document.addEventListener('click',e=>{
  unlockSound();   // phones only allow sound after a tap
  const b=e.target.closest('[data-a]'); if(!b||b.disabled) return;
  const fn=ACTIONS[b.dataset.a]; if(!fn) return;
  fn(b.dataset.v,b); render();
});
document.addEventListener('keydown',e=>{ if(e.key==='Escape' && (S.sel||S.info||S.settings)){ S.sel=null; S.info=null; S.settings=false; render(); } });

// Character pictures: for each card look for img/<id>.jpg (or .png / .webp). A Mark card without its own picture
// borrows its base character's (giyu_mark → giyu); other versions borrow too (tengen_retired → tengen). No picture: kanji.
function findArt(){
  const found={}, ids=ROSTER.map(c=>c.id);
  let waiting=ids.length;
  const finish=()=>{ if(--waiting>0) return;
    ROSTER.forEach(c=>{ const src=found[c.id]||found[c.id.replace(/_mark$/,'')]||found[c.fam]; if(src) ART[c.id]=src; });
    if(Object.keys(ART).length) render(); };
  ids.forEach(id=>{
    const exts=['jpg','png','webp'];
    const tryNext=()=>{ const ext=exts.shift(); if(!ext) return finish();
      const im=new Image(); im.onload=()=>{ found[id]=im.src; finish(); }; im.onerror=tryNext; im.src=`img/${id}.${ext}`; };
    tryNext();
  });
}
/* ---------- online play: Firebase connection and create / join ---------- */
ONLINE.hooks.roundPlayed = () => playRound();
const FB_VERSION = '10.12.2';
const loadScript = src => new Promise((ok,fail)=>{ const el=document.createElement('script'); el.src=src; el.onload=ok; el.onerror=()=>fail(new Error('Could not load '+src)); document.head.appendChild(el); });
// The transport ONLINE uses: rooms/<CODE> holds host + guest names, the shared state (host writes) and actions (guest writes)
async function firebaseNet(role){
  if(!FIREBASE_CONFIG) throw new Error("Online play isn't set up yet (the Firebase config is missing).");
  if(!navigator.onLine) throw new Error("You're offline. Online play needs an internet connection.");
  if(!window.firebase) for(const m of ['app','auth','database']) await loadScript(`https://www.gstatic.com/firebasejs/${FB_VERSION}/firebase-${m}-compat.js`);
  if(!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
  await firebase.auth().signInAnonymously();
  const db=firebase.database(), offs=[]; let room=null;
  const listen=(ref,ev,f)=>{ ref.on(ev,f); offs.push(()=>ref.off(ev,f)); };
  return {
    async create(code, name){ room=db.ref('rooms/'+code); if((await room.get()).exists()) return false;
      await room.set({created:Date.now(), host:{name, on:true}}); room.child('host/on').onDisconnect().set(false); return true; },
    async join(code, name){ room=db.ref('rooms/'+code); const snap=await room.get(); if(!snap.exists()) throw new Error('No game with that code.');
      const v=snap.val(); if(v.guest && v.guest.on) throw new Error('That game already has two players.');
      await room.child('guest').set({name, on:true}); room.child('guest/on').onDisconnect().set(false); return v; },
    publish(json){ room.child('state').set(json); },
    send(msg){ room.child('acts').push(JSON.parse(JSON.stringify(msg))); },   // Firebase rejects undefined (e.g. a Defend move's empty target)
    onState(cb){ listen(room.child('state'),'value',s=>{ if(s.exists()) cb(s.val()); }); },
    onAction(cb){ listen(room.child('acts'),'child_added',s=>{ cb(s.val()); s.ref.remove(); }); },
    onPeer(cb){ listen(room.child(role==='host'?'guest':'host'),'value',s=>cb(s.val())); },
    leave(){ offs.forEach(f=>f()); offs.length=0; if(room) room.child(role+'/on').set(false); },
  };
}
const myName = () => { const n0=document.getElementById('n0'); return (n0&&n0.value.trim()) || S.names[0] || 'Player'; };
async function onlineCreate(){
  const name=myName(); S.names[0]=name; S.onlineMsg='Connecting…'; render();
  try{
    const net=await firebaseNet('host'); let code=null;
    for(let i=0;i<8 && !code;i++){ const c=newRoomCode(); if(await net.create(c,name)) code=c; }
    if(!code) throw new Error('Could not make a room code. Try again.');
    ONLINE.net=net; ONLINE.last='';
    Object.assign(S,{me:0, planFor:0, names:[name,'…'], lobby:{code, peer:false}, phase:'lobby', onlineMsg:''});
    net.onAction(msg=>{ hostHandle(msg); render(); });
    net.onPeer(v=>{ if(!v) return; S.names[1]=v.name; S.lobby.peer=!!v.on; if(!v.on && S.phase!=='lobby') S.onlineMsg=`${v.name} disconnected.`; render(); });
    render();
  }catch(e){ S.onlineMsg=e.message||'Could not connect.'; render(); }
}
async function onlineJoin(){
  const el=document.getElementById('ocode'), code=((el&&el.value)||'').trim().toUpperCase(); S.joinCode=code;
  if(!/^[A-Z]{4}$/.test(code)){ S.onlineMsg='Type the 4-letter code from the other phone.'; return render(); }
  const name=myName(); S.names[0]=name; S.onlineMsg='Joining…'; render();
  try{
    const net=await firebaseNet('guest'), room=await net.join(code,name);
    ONLINE.net=net;
    Object.assign(S,{me:1, planFor:1, names:[(room.host&&room.host.name)||'Host', name], lobby:{code}, phase:'lobby', onlineMsg:''});
    net.onState(json=>{ applySnapshot(json); render(); });
    render();
  }catch(e){ S.onlineMsg=e.message||'Could not join.'; render(); }
}
S.soundOn=loadSoundOn(); S.speed=loadSpeed();
render();
findArt();
// Offline support and home-screen install (only works when served over http/https, not from a local file)
if('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(()=>{});
