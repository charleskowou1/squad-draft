/* ================= APP =================
   Rendering and taps. The only file that touches the DOM. */
const app = document.getElementById('app'), sheet = document.getElementById('sheet');
const VIEWS = {setup:vSetup, modeset:vModeSet, codex:vCodex, lobby:vLobby, story:vStory, scene:vScene, scout:vScout, spin:vSpin, draft:vDraft, pass:vPass, plan:vPlan, ready:vReady, result:vResult, over:vOver};
const quickMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
let scored = false, spinShown = null;
// which screen to draw: online, each phone shows the win screen on its own; a crow re-plan reuses the move screen
const viewName = () => isOnline() && S.final && S.localOver ? 'over' : S.phase==='scout' && S.scouting ? 'plan' : S.phase;

function render(){
  if(isOnline()) S.planFor=S.me;
  const view=viewName();
  if(view==='over' && !scored && S.mode==='daily'){ scored=true; S.dailyMet=dailyMet(S.daily); if(S.dailyMet) markDaily(S.daily.day); sfx(S.dailyMet?'win':'lose'); }   // no stats
  if(view==='over' && !scored && (isPractice() || S.mode==='story')){ scored=true;   // story and practice don't count toward stats
    if(S.winner!==0) sfx('lose'); }   // story wins are saved (and celebrated) before the ending scene
  if(view==='over' && !scored){ scored=true; if(S.winner>=0){ const sc=loadScore(); players().filter(q=>sameSide(q,S.winner)).forEach(q=>{ const n=S.names[q]; sc[n]=(sc[n]||0)+1; }); saveScore(sc); } recordMatch();
    sfx(S.winner<0 || (soloView() && !sameSide(S.winner,myP())) ? 'lose' : 'win'); }
  if(view!=='over') scored=false;
  // keep fold-out sections (How to play, records…) open across redraws
  const open=[...app.querySelectorAll('details[id]')].filter(d=>d.open).map(d=>d.id);
  document.body.classList.toggle('localmode', S.mode==='local');
  music(musicFor(view));   // each kind of screen has its own theme (cross-fades; nothing happens if it's already playing)   // wide landscape layout (tablets) for Local games
  app.innerHTML=VIEWS[view](); sheet.innerHTML=vSheet();
  open.forEach(id=>{ const d=document.getElementById(id); if(d) d.open=true; });
  if(view==='story' && S.storyScroll){ S.storyScroll=false; const el=app.querySelector('.srow.sel'); if(el) el.scrollIntoView({block:'center'}); else window.scrollTo(0,0); }
  if(S.phase==='draft' && S.mode==='cpu' && turn()!==0){ clearTimeout(S._t); S._t=setTimeout(()=>{ if(S.banning) cpuBan(); else cpuDraftStep(S.level); render(); },700); }
  if(S.phase==='spin' && S.spin && S.spin.state==='spinning' && spinShown!==S.spin.angle) animateSpin();
  // online host: send each guest phone its own copy of the shared state (only when it changed)
  if(iAmHost() && ONLINE.net){ ONLINE.last=ONLINE.last||{};
    const seats = S.phase==='lobby' ? (S.lobby.seats||[]).map((x,i)=>x&&x.on?i+1:0).filter(Boolean) : others(0);
    seats.forEach(q=>{ const j=snapshotFor(q); if(j!==ONLINE.last[q]){ ONLINE.last[q]=j; ONLINE.net.publish(j,q); } }); }
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
const readTime = line => quickMotion() ? 300 : (2200 + line.t.length*30 + (line.ko||line.spawn ? 1100 : 0) + (line.fx==='special' ? 500 : 0)) * pace();   // cut-ins stay up a bit longer
// a grouped special (several targets in one beat): longer for more targets and any knockouts
const groupTime = lines => quickMotion() ? 400 : (2400 + 450*lines.filter(l=>GROUP_FX.includes(l.fx)).length + (lines.some(l=>l.ko) ? 1100 : 0)) * pace();
// Play the round back one log line at a time. Knockouts buzz the phone (Android; iPhones don't allow vibration).
function playRound(){
  S.play={k:0, done:false, steps:playSteps(S.log)};
  const step=()=>{
    if(S.info || S.settings){ S._t=setTimeout(step,300); return; }   // paused while an info card or Settings is open
    if(S.play.k>=S.play.steps.length-1){ S.play.done=true; if(storyEnd()) return; render(); return; }
    S.play.k++; const [a,b]=S.play.steps[S.play.k], lines=S.log.slice(a,b+1), line=lines[0];
    if(lines.some(l=>l.ko) && navigator.vibrate && S.vibeOn!==false) navigator.vibrate([90,50,160]);
    if(b>a){ sfx('bighit'); if(lines.some(l=>l.ko)) setTimeout(()=>sfx('ko'),250); } else sfxForLine(line);
    render();
    S._t=setTimeout(step, b>a ? groupTime(lines) : readTime(line));
  };
  sfx('gong'); clearTimeout(S._t); S._t=setTimeout(step, quickMotion() ? 250 : 1500*pace());   // the "Round N · Fight!" intro
}
// Start a Local or Quickplay match with the mode's settings: names from the boxes (computers get demon names)
// Story: when the last round has played out, go straight on (the ending scene after a win, the defeat screen after
// a loss) instead of stopping on a "See who won" button. Returns true if it moved on.
function storyEnd(){
  if(S.mode!=='story' || !S.final) return false;
  clearTimeout(S._t); S._t=setTimeout(()=>{ ACTIONS.finish(); render(); }, quickMotion()?0:700);
  return true;
}
function startDraft(){
  const c=useModeCfg(), field=i=>{ const el=document.getElementById('n'+i); return el&&el.value.trim(); };
  if(S.mode==='local'){ S.names=Array.from({length:c.players},(_,i)=>field(i)||`Player ${i+1}`); saveNames(S.names.concat(localNames().slice(S.names.length))); }
  else { S.names=[field(0)||S.names[0]||'Player 1', ...CPU_NAMES.slice(0,c.players-1)]; if(S.duo) S.names[2]='Rengoku AI'; }   // 2v2: your ally is a slayer
  S.n=c.players;
  if(isPractice()) return newDraft(0);   // Practice: you pick for everyone, so there's no wheel
  toSpin();
}
// The next player (after p) who still has fighters, or -1
const nextChooser = p => { for(let q=p+1;q<nPlayers();q++) if(alive(q).length) return q; return -1; };
function toSpin(){ S.phase='spin'; S.spin=null; window.scrollTo(0,0); }
// After a fighter's move is complete, open the next one that still needs a move
function advanceFocus(p){ const n=alive(p).find(u=>!u.stun && !unitReady(u)); S.focus = n ? n.uid : 'none'; }
function newPlanTurn(){ S.focus=null; S.info=null; window.scrollTo(0,0); }
// A story win: save it, remember what it unlocks (first win only), then play the ending scene before the results
function storyWon_(){
  const st=STAGES[S.stage], id=st.id; S.newUnlocks = loadStory().cleared.includes(id) ? [] : STAGE_UNLOCKS[id]; saveStoryClear(id);
  S.starsGot=starsEarned(st); S.starsBest=stageStars(id); saveStars(id,S.starsGot);
  Object.assign(S,{phase:'scene', sceneOutro:true, sceneUnlock:false, sceneVs:false, sceneAt:0, sceneInstant:false, sceneShownAt:Date.now()}); sfx('win');
}
// After the ending scene: the stars earned (and any unlocks), then the results screen
function afterOutro(){ if(!S.sceneUnlock){ S.sceneUnlock=true; sfx('unlock'); return; } S.sceneOutro=false; S.sceneUnlock=false; S.phase='over'; window.scrollTo(0,0); }
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

// Change one of the selected mode's match settings (saved per mode)
function setCfg(k,v){ const c=loadModeCfg(S.mode); c[k]=v; saveModeCfg(S.mode,c); useModeCfg(); }
const keepNames = () => { const n0=document.getElementById('n0'); if(n0 && n0.value.trim()) S.names[0]=n0.value.trim();
  if(S.mode==='local'){ const ns=localNames(); for(let i=0;i<4;i++){ const el=document.getElementById('n'+i); if(el) ns[i]=el.value.trim()||ns[i]; } saveNames(ns); } };
const ACTIONS = {
  mode(v){ keepNames(); S.mode=v; S.joinOpen=false; S.onlineMsg=''; useModeCfg(v); if(v==='local') S.names=localNames(); },
  // a mode card on the home screen: Story goes straight to the map, the others open their settings page
  openmode(v){ ACTIONS.mode(v); if(v==='story') return ACTIONS.storymap(); S.phase='modeset'; window.scrollTo(0,0); },
  cfgplayers(v){ keepNames(); setCfg('players',+v); },
  cfgbudget(v){ keepNames(); setCfg('budget',+v); },
  cfgpool(v){ keepNames(); setCfg('poolType',v); },
  cfglevel(v){ keepNames(); setCfg('level',v); },
  cfgmax(v){ keepNames(); setCfg('maxTeam',+v); },
  cfgbans(v){ keepNames(); setCfg('bans',v==='on'); },
  cfgduo(v){ keepNames(); setCfg('duo',v==='on'); },
  start: startDraft,
  home(){ clearTimeout(S._t); if(ONLINE.net){ ONLINE.net.leave(); ONLINE.net=null; ONLINE.last=null; }
    const mode=S.mode==='daily'?'cpu':S.mode; S={phase:'setup',mode,vol:S.vol,speed:S.speed,vibeOn:S.vibeOn,names:mode==='local'?localNames():[S.names[S.me||0]||S.names[0]]}; useModeCfg(mode); },
  vibe(v){ S.vibeOn=v==='on'; try{ localStorage.setItem('squad-draft-vibe',v) }catch(e){} },
  rematch(){ if(isOnline()) return onlineRematch(); if(isPractice()) return newDraft(0); toSpin(); },
  spin(){ if(isOnline() && !iAmHost()) return; if(!S.spin) S.spin=Object.assign(spinWheel(),{state:'spinning'}); },
  toDraft(){ if(isOnline() && !iAmHost()) return; newDraft(S.spin.r); },
  redeal(){ if(isOnline() && !iAmHost()) return; S.pool=buildPool(); S.sel=null; },
  ocreate(){ onlineCreate(); },
  ojoin(){ onlineJoin(); },
  ojoinopen(){ S.names[0]=myName(); S.joinOpen=!S.joinOpen; S.onlineMsg=''; setTimeout(()=>{ const el=document.getElementById('ocode'); if(el) el.focus(); }); },
  ostart(){ if(iAmHost() && hostStartMatch()) toSpin(); },
  // open a card's detail (from the grid or from a name in a pool note); any card in the pool can be viewed
  sel(v){ if(S.mode==='cpu' && turn()!==0) return;
    if(S.pool.includes(v) || ((S.mode==='daily'||S.mode==='story') && S.picks[1].includes(v))) S.sel=v; },   // the set enemy team can be studied
  unsel(){ S.sel=null; S.info=null; S.settings=false; S.codexSel=null; },
  settings(){ S.settings=true; },
  settab(v){ S.setTab=v; },
  theirs(){ S.showTheirs=!S.showTheirs; },
  codex(){ keepNames(); S.phase='codex'; S.codexSel=null; window.scrollTo(0,0); },
  codexf(v){ S.codexF=v; },
  codexsel(v){ S.codexSel=v; },
  daily(){ keepNames(); clearTimeout(S._t); S.play=null; S.final=false; startDaily(); window.scrollTo(0,0); },
  info(v){ S.info=v; },
  fight(){ fight(); newPlanTurn(); },
  notes(){ S.notesOpen=!S.notesOpen; },
  confirmPick(){ if(S.banning){ if(isOnline()) return onlineBan(S.sel); if(canBan(turn(),S.sel)){ sfx('pick'); doBan(S.sel); } return; }
    if(isOnline()){ sfx('pick'); onlinePick(S.sel); S.sel=null; return; } if(!canPick(turn(),S.sel)) return; sfx('pick'); doPick(S.sel); if(S.phase!=='draft') newPlanTurn(); },
  undo(){ if(isOnline()) return onlineUndo(); undoPick(); },
  repeat(){ repeatPlans(S.planFor); advanceFocus(S.planFor); },
  speed(v){ S.speed=v; try{ localStorage.setItem('squad-draft-speed',v) }catch(e){} },
  volmusic(v){ S.vol={...S.vol, music:+v}; saveVolumes(S.vol); applyVolumes(); },
  volsfx(v){ S.vol={...S.vol, sfx:+v}; saveVolumes(S.vol); applyVolumes(); sfx('pick'); },
  storymap(){ keepNames(); clearTimeout(S._t); S.mode='story'; S.phase='story'; S.storySel=nextStage(); S.storyScroll=true; },
  storysel(v){ S.storySel = S.storySel===+v ? -1 : +v; },
  stage(v){ if(!stageUnlocked(+v)) return; startStage(+v); S.sceneShownAt=Date.now(); S.sceneInstant=false; window.scrollTo(0,0); },
  stagedraft(v){ if(!stageCleared(+v)) return; startStage(+v,true); S.sceneShownAt=Date.now(); S.sceneInstant=false; window.scrollTo(0,0); },
  scenenext(){ if(S.sceneVs) return;
    if(S.sceneUnlock) return afterOutro();
    if(S.sceneAt+1<sceneLines().length){ S.sceneAt++; S.sceneInstant=false; S.sceneShownAt=Date.now(); sfx('page'); return; }
   
    if(S.sceneOutro) return afterOutro();
    S.sceneVs=true; sfx('vs'); },
  sceneskip(){ if(S.sceneOutro) return afterOutro();
    if(!S.sceneVs){ S.sceneVs=true; return; } beginStage(); if(S.phase==='plan') newPlanTurn(); window.scrollTo(0,0); },
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
      others(0).filter(q=>alive(q).length).forEach(q=>{ cpuPlan(q, S.mode==='story'?stageLevel():S.level); cpuHelpers(q); });
      others(0).forEach(q=>{ if(S.helperPlan[q].includes('crow')) cpuScout(q); });   // a computer's crow sees everyone's moves
      S.scoutQueue=S.helperPlan[0].includes('crow')?[0]:[];
      return nextScoutOrFight();
    }
    const nx=nextChooser(S.planFor);   // local: hand the phone to the next player still in the fight
    if(nx>=0){ S.planFor=nx; S.phase='pass'; return newPlanTurn(); }
    S.scoutQueue=players().filter(p=>alive(p).length && S.helperPlan[p].includes('crow'));   // each crow owner gets a private report
    nextScoutOrFight();
  },
  skip(){ clearTimeout(S._t); S.play.done=true; storyEnd(); },
  next(){ if(isOnline()){ onlineNext(); return window.scrollTo(0,0); } S.round++; S.planFor=S.mode==='local'?nextChooser(-1):0; S.play=null; S.phase=S.mode==='local'?'pass':'plan'; newPlanTurn(); },
  finish(){ if(isOnline()){ S.localOver=true; return window.scrollTo(0,0); } S.play=null;
    if(S.mode==='story' && S.winner===0) return storyWon_();   // ending scene and unlocks first
    S.phase='over'; window.scrollTo(0,0); },
};
// Wake audio on any touch or key, not only button taps (phones only allow it inside a tap; see unlockSound)
['pointerdown','touchend','keydown'].forEach(ev=>document.addEventListener(ev, unlockSound, {passive:true}));
// coming back to the game after switching apps or locking the phone: try to wake audio straight away too
document.addEventListener('visibilitychange', ()=>{ if(!document.hidden && AC && AC.state!=='running') try{ AC.resume(); }catch(e){} });
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
// The transport ONLINE uses: rooms/<CODE> holds the host, guest seats 1–3 (name, on), one state copy per seat
// (state/<seat>, host writes) and the guests' actions (acts, guests write)
async function firebaseNet(role){
  if(!FIREBASE_CONFIG) throw new Error("Online play isn't set up yet (the Firebase config is missing).");
  if(!navigator.onLine) throw new Error("You're offline. Online play needs an internet connection.");
  if(!window.firebase) for(const m of ['app','auth','database']) await loadScript(`https://www.gstatic.com/firebasejs/${FB_VERSION}/firebase-${m}-compat.js`);
  if(!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
  await firebase.auth().signInAnonymously();
  const db=firebase.database(), offs=[]; let room=null, seat=0;
  const listen=(ref,ev,f)=>{ ref.on(ev,f); offs.push(()=>ref.off(ev,f)); };
  return {
    async create(code, name){ room=db.ref('rooms/'+code); if((await room.get()).exists()) return false;
      await room.set({created:Date.now(), host:{name, on:true}}); room.child('host/on').onDisconnect().set(false); return true; },
    // a guest takes the first free seat (1–3); returns the room and the seat number
    async join(code, name){ room=db.ref('rooms/'+code); const snap=await room.get(); if(!snap.exists()) throw new Error('No game with that code.');
      const v=snap.val(); if(v.state && v.state.started) throw new Error('That game has already started.');
      const res=await room.child('seats').transaction(seats=>{ seats=seats||{}; for(let i=1;i<=3;i++){ if(!seats[i]||!seats[i].on){ seats[i]={name,on:true}; seat=i; return seats; } } return; });
      if(!res.committed || !seat) throw new Error('That game is full (4 players).');
      room.child('seats/'+seat+'/on').onDisconnect().set(false); return {room:v, seat}; },
    publish(json, q){ room.child('state/'+q).set(json); },
    send(msg){ room.child('acts').push(JSON.parse(JSON.stringify(msg))); },   // Firebase rejects undefined (e.g. a Defend move's empty target)
    onState(cb){ listen(room.child('state/'+seat),'value',s=>{ if(s.exists()) cb(s.val()); }); },
    onAction(cb){ listen(room.child('acts'),'child_added',s=>{ cb(s.val()); s.ref.remove(); }); },
    onSeats(cb){ listen(room.child('seats'),'value',s=>{ const v=s.val()||{}; cb([1,2,3].map(i=>v[i]||null)); }); },
    onHost(cb){ listen(room.child('host'),'value',s=>cb(s.val())); },
    leave(){ offs.forEach(f=>f()); offs.length=0; if(room) room.child(role==='host'?'host/on':'seats/'+seat+'/on').set(false); },
  };
}
const myName = () => { const n0=document.getElementById('n0'); return (n0&&n0.value.trim()) || S.names[0] || 'Player'; };
async function onlineCreate(){
  const name=myName(); S.names[0]=name; S.onlineMsg='Connecting…'; render();
  try{
    const net=await firebaseNet('host'); let code=null;
    for(let i=0;i<8 && !code;i++){ const c=newRoomCode(); if(await net.create(c,name)) code=c; }
    if(!code) throw new Error('Could not make a room code. Try again.');
    ONLINE.net=net; ONLINE.last=null; useModeCfg('online');
    Object.assign(S,{me:0, planFor:0, n:2, names:[name], lobbyHost:name, lobby:{code, seats:[]}, phase:'lobby', onlineMsg:''});
    net.onAction(msg=>{ hostHandle(msg); render(); });
    net.onSeats(seats=>{ if(S.phase==='lobby') S.lobby.seats=seats;
      else seats.forEach((x,i)=>{ if(x && !x.on && i+1<nPlayers()) S.onlineMsg=`${x.name} disconnected.`; });
      render(); });
    render();
  }catch(e){ S.onlineMsg=e.message||'Could not connect.'; render(); }
}
async function onlineJoin(){
  const el=document.getElementById('ocode'), code=((el&&el.value)||'').trim().toUpperCase(); S.joinCode=code;
  if(!/^[A-Z]{4}$/.test(code)){ S.onlineMsg='Type the 4-letter code from the other phone.'; return render(); }
  const name=myName(); S.names[0]=name; S.onlineMsg='Joining…'; render();
  try{
    const net=await firebaseNet('guest'), {room, seat}=await net.join(code,name);
    ONLINE.net=net;
    Object.assign(S,{me:seat, planFor:seat, names:[(room.host&&room.host.name)||'Host', name], lobbyHost:(room.host&&room.host.name)||'Host', lobby:{code, seats:[]}, phase:'lobby', onlineMsg:''});
    net.onState(json=>{ applySnapshot(json); render(); });
    render();
  }catch(e){ S.onlineMsg=e.message||'Could not join.'; render(); }
}
S.vol=loadVolumes(); S.speed=loadSpeed(); try{ S.vibeOn=localStorage.getItem('squad-draft-vibe')!=='off' }catch(e){}
useModeCfg(S.mode); S.names=localNames();
// today's challenge takes a moment to build (it runs test battles), so it fills in just after the menu appears
setTimeout(()=>{ dailyChallenge(); if(S.phase==='setup') render(); }, 60);
render();
findArt();
// Offline support and home-screen install (only works when served over http/https, not from a local file)
if('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(()=>{});
