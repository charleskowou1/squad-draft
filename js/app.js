/* ================= APP =================
   Rendering and taps. The only file that touches the DOM. */
const app = document.getElementById('app'), sheet = document.getElementById('sheet');
const VIEWS = {setup:vSetup, story:vStory, spin:vSpin, draft:vDraft, pass:vPass, plan:vPlan, ready:vReady, result:vResult, over:vOver};
const quickMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
let scored = false;

function render(){
  if(S.phase==='over' && !scored){ scored=true; if(S.winner>=0){ const sc=loadScore(), n=S.names[S.winner]; sc[n]=(sc[n]||0)+1; saveScore(sc); } recordMatch();
    if(S.mode==='story' && S.winner===0) saveStoryClear(STAGES[S.stage].id);
    sfx(S.winner<0 || (vsCpu() && S.winner===1) ? 'lose' : 'win'); }
  if(S.phase!=='over') scored=false;
  // keep fold-out sections (How to play, records…) open across redraws
  const open=[...app.querySelectorAll('details[id]')].filter(d=>d.open).map(d=>d.id);
  app.innerHTML=VIEWS[S.phase](); sheet.innerHTML=vSheet();
  open.forEach(id=>{ const d=document.getElementById(id); if(d) d.open=true; });
  if(S.phase==='draft' && S.mode==='cpu' && turn()===1){ clearTimeout(S._t); S._t=setTimeout(()=>{ cpuDraftStep(S.level); render(); },700); }
  if(S.phase==='spin' && S.spin && S.spin.state==='spinning' && !S.spin.started) animateSpin();
}
// Turn the freshly drawn wheel to its landing angle, then show who won
function animateSpin(){
  S.spin.started=true;
  const w=app.querySelector('.wheel');
  requestAnimationFrame(()=>requestAnimationFrame(()=>{ w.classList.add('go'); w.style.transform=`rotate(${S.spin.angle}deg)`; }));
  // ticks that slow down with the wheel, then a ding
  if(!quickMotion()) for(let t=0,gap=40; t<3900; t+=gap, gap*=1.09) setTimeout(()=>sfx('tick'), t);
  clearTimeout(S._t); S._t=setTimeout(()=>{ S.spin.state='done'; sfx('ding'); render(); }, quickMotion()?300:4300);
}
// How long a playback line stays up: enough to read it, longer for long lines and knockouts
const readTime = line => quickMotion() ? 300 : 2200 + line.t.length*30 + (line.ko||line.spawn ? 1100 : 0);
// Play the round back one log line at a time. Knockouts buzz the phone (Android; iPhones don't allow vibration).
function playRound(){
  S.play={k:0, done:false};
  const step=()=>{
    if(S.info){ S._t=setTimeout(step,300); return; }   // paused while a fighter's info card is open
    if(S.play.k>=S.log.length-1){ S.play.done=true; render(); return; }
    S.play.k++; const line=S.log[S.play.k];
    if(line.ko && navigator.vibrate) navigator.vibrate([90,50,160]);
    sfxForLine(line);
    render();
    S._t=setTimeout(step, readTime(line));
  };
  sfx('gong'); clearTimeout(S._t); S._t=setTimeout(step, quickMotion() ? 250 : 1500);   // the "Round N · Fight!" intro
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
// Run the round, then play it back (a finished match still plays back first, then "See who won")
function fight(){ S.info=null; resolve(); S.final = S.phase==='over'; S.phase='result'; playRound(); }

const ACTIONS = {
  mode(v){ const n0=document.getElementById('n0'); if(n0) S.names[0]=n0.value; S.mode=v; if(v==='2p'){ const s=loadNames(); S.names[1]=(s&&s[1])||'Mia'; } },
  start: startDraft,
  home(){ clearTimeout(S._t); S={phase:'setup',mode:S.mode,level:S.level,budget:loadBudget(),poolType:S.poolType,soundOn:S.soundOn,names:vsCpu()?[S.names[0],(loadNames()||[])[1]||'Mia']:S.names}; },
  level(v){ S.level=v; saveLevel(v); },
  rematch: toSpin,
  spin(){ if(!S.spin) S.spin=Object.assign(spinWheel(),{state:'spinning'}); },
  toDraft(){ newDraft(S.spin.r); },
  redeal(){ S.pool=buildPool(); S.sel=null; },
  // open a card's detail (from the grid or from a name in a pool note); any card in the pool can be viewed
  sel(v){ if(S.mode==='cpu' && turn()===1) return; if(S.pool.includes(v)) S.sel=v; },
  unsel(){ S.sel=null; S.info=null; S.settings=false; },
  settings(){ S.settings=true; },
  budget(v){ S.budget=+v; saveBudget(S.budget); },
  pooltype(v){ S.poolType=v; savePoolType(v); },
  info(v){ S.info=v; },
  fight(){ fight(); newPlanTurn(); },
  notes(){ S.notesOpen=!S.notesOpen; },
  confirmPick(){ if(!canPick(turn(),S.sel)) return; sfx('pick'); doPick(S.sel); if(S.phase!=='draft') newPlanTurn(); },
  undo(){ undoPick(); },
  repeat(){ repeatPlans(S.planFor); advanceFocus(S.planFor); },
  sound(v){ S.soundOn=v==='on'; saveSoundOn(S.soundOn); if(S.soundOn) sfx('pick'); },
  storymap(){ const n0=document.getElementById('n0'); if(n0) S.names[0]=n0.value.trim()||S.names[0]; clearTimeout(S._t); S.budget=loadBudget(); S.phase='story'; window.scrollTo(0,0); },
  stage(v){ if(!stageUnlocked(+v)) return; startStage(+v); window.scrollTo(0,0); },
  lock(){ doLock(turn()); if(S.phase!=='draft') newPlanTurn(); },
  reveal(){ S.phase='plan'; newPlanTurn(); },
  focus(v){ S.focus = focusOf(S.planFor)===v ? 'none' : v; },
  act(v,b){ const u=findU(b.dataset.u); setMove(u,v); if(unitReady(u)) advanceFocus(u.p); },
  tgt(v,b){ const u=findU(b.dataset.u); S.plans[u.p][u.uid].t=v; advanceFocus(u.p); },
  lockMoves(){
    S.lastPlans[S.planFor]=JSON.parse(JSON.stringify(S.plans[S.planFor]));   // for "Repeat last round"
    if(vsCpu()){ cpuPlan(1, S.mode==='story'?stageLevel():S.level); fight(); }
    else if(S.planFor===0){ S.planFor=1; S.phase='pass'; }
    else S.phase='ready';   // two players: wait for "Start the battle"
    newPlanTurn();
  },
  skip(){ clearTimeout(S._t); S.play.done=true; },
  next(){ S.round++; S.planFor=0; S.play=null; S.phase=S.mode==='2p'?'pass':'plan'; newPlanTurn(); },
  finish(){ S.play=null; S.phase='over'; window.scrollTo(0,0); },
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
S.soundOn=loadSoundOn();
render();
findArt();
// Offline support and home-screen install (only works when served over http/https, not from a local file)
if('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(()=>{});
