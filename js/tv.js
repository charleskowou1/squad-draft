/* ================= TV MODE =================
   A laptop (HDMI or AirPlay to the TV) runs the game on the big screen; a phone joins its 4-letter code as a
   controller. Story mode first (and anything else you play against the computer). Nothing here runs unless TV mode
   or controller mode is switched on, so the normal phone game is untouched.
   - TV (S.tv): body.tvmode (big layout); creates rooms/<CODE> (the online rooms path, already allowed by the
     database rules) with tv/state = what the controller needs, and reads tv/acts (the controller's locked moves).
     The laptop stays fully playable with the mouse; the phone is optional.
   - Controller (S.ctl): mirrors tv/state; shows the move screen while the TV waits for moves, otherwise
     "Watch the TV". Picks stay on the phone until Lock in moves sends them. No music on the phone. */
const TV = { offs:[], last:null };
const isTV = () => !!S.tv;
const isCtl = () => !!S.ctl;
VIEWS.ctlwatch = () => vCtlWatch();   // the phone's "Watch the TV" screen
// What the controller needs from the TV's game (its own picks stay on the phone, so plans/helperPlan aren't sent)
const TV_FIELDS = SHARED.filter(k=>k!=='plans' && k!=='helperPlan').concat(['mode','stage','storyDraft','twist','phases','boosts','place','beats','said','maxTeam','level','helpers']);

/* ---------- the TV (laptop) side ---------- */
async function tvStart(){
  S.tvMsg='Connecting…'; render();
  try{
    const db=await firebaseReady(); let code=null;
    for(let i=0;i<8 && !code;i++){ const c=newRoomCode(), r=await db.ref('rooms/'+c).transaction(v=>v?undefined:{created:Date.now(), host:{name:'TV', on:true}, hostSeat:0, tv:{on:true}}); if(r.committed) code=c; }
    if(!code) throw new Error('Could not make a code. Try again.');
    const room=db.ref('rooms/'+code); room.child('host/on').onDisconnect().set(false);
    S.tv={code, phone:false}; S.tvMsg=''; TV.last=null; document.body.classList.add('tvmode');
    const f=s=>{ const m=s.val(); s.ref.remove(); tvAct(m); }; room.child('tv/acts').on('child_added',f); TV.offs.push(()=>room.child('tv/acts').off('child_added',f));
    TV.room=room; ACTIONS.storymap(); render();
  }catch(e){ S.tvMsg=netError(e); render(); }
}
function tvStop(){
  TV.offs.forEach(f=>f()); TV.offs=[]; if(TV.room) TV.room.child('host/on').set(false); TV.room=null; TV.last=null;
  S.tv=null; document.body.classList.remove('tvmode');
}
// A message from the phone: it's here, or its moves for this round
function tvAct(m){
  if(!m || !isTV()) return;
  if(m.a==='hello'){ S.tv.phone=true; render(); return; }
  if(m.a==='next'){ tvContinue(); render(); return; }
  if(m.a==='choose'){ tvChoose(m.key); render(); return; }
  if(m.a==='stage'){ const i=m.i|0; if(m.draft ? stageCleared(i) : stageUnlocked(i)){ ACTIONS[m.draft?'stagedraft':'stage'](i); } render(); return; }
  if(m.a==='pick' && S.phase==='draft' && turn()===0 && (S.mode==='cpu'||S.mode==='story')){ S.sel=m.id; ACTIONS.confirmPick(); render(); return; }
  if(m.a==='lockteam' && S.phase==='draft' && turn()===0){ ACTIONS.lock(); render(); return; }
  if(m.a==='undo' && S.phase==='draft'){ ACTIONS.undo(); render(); return; }
  if(m.a==='redeal' && S.phase==='draft'){ ACTIONS.redeal(); render(); return; }
  if(m.a==='moves' && S.phase==='plan' && m.round===S.round && vsCpu()){
    S.plans[0]=m.plans||{}; S.helperPlan[0]=(m.helperPlan||[]).filter(h=>(S.helpers[0]||[]).includes(h));
    ACTIONS.lockMoves(); render();
  }
}
// The phone's Continue button: press whatever the TV's main button is right now
function tvNextLabel(){
  if(S.phase==='scene') return S.sceneVs ? 'Fight' : 'Next';
  if(S.phase==='result') return !S.play || !S.play.done ? 'Skip' : S.final ? 'See who won' : 'Next round';
  if(S.phase==='scout') return 'Keep my moves';
  if(S.phase==='spin') return !S.spin ? 'Spin the wheel' : S.spin.state==='done' ? 'Start the draft' : null;
  return null;
}
function tvContinue(){
  const l=tvNextLabel(); if(!l) return;
  if(S.phase==='scene') return S.sceneVs ? ACTIONS.sceneskip() : ACTIONS.scenenext();
  if(S.phase==='scout') return ACTIONS.keepmoves();
  if(S.phase==='spin') return !S.spin ? ACTIONS.spin() : ACTIONS.toDraft();
  if(l==='Skip') return ACTIONS.skip();
  return S.final ? ACTIONS.finish() : ACTIONS.next();
}
// Choices for the phone on screens with no single main button (home, end of a battle, credits)
function tvChoices(view){
  if(view==='setup' || view==='modeset' || view==='codex') return [['story','Story mode'],['quickplay','Quickplay vs the computer']];
  if(view==='credits') return [['map','Story map'],['home','Home']];
  if(view==='over'){
    if(S.mode==='story'){ const won=S.winner===0, last=S.stage===STAGES.length-1;
      return won ? [last?['finale','Finish the story']:['nextstage','Next battle'], ['map','Story map']] : [['retry','Try again'], ['map','Story map']]; }
    return [['rematch','Rematch'],['home','Main menu']];
  }
  return null;
}
function tvChoose(key){
  if(key==='story' || key==='map') return ACTIONS.storymap();
  if(key==='quickplay'){ ACTIONS.mode('cpu'); S.names[0]=playerName()||S.names[0]||'Player 1'; return startDraft(); }
  if(key==='finale' && S.mode==='story') return ACTIONS.finale();
  if(key==='nextstage' && S.mode==='story') return ACTIONS.stage(S.stage+1);
  if(key==='retry' && S.mode==='story') return ACTIONS[S.storyDraft?'stagedraft':'stage'](S.stage);
  if(key==='rematch') return ACTIONS.rematch();
  if(key==='home') return ACTIONS.home();
}
// The story map for the phone: every battle with whether it's open, won, and its stars
const tvStoryList = () => STAGES.map((st,i)=>({i, title:st.title, arc:ARCS[st.arc].title, open:stageUnlocked(i), won:stageCleared(i), stars:stageStars(st.id)}));
// After every redraw on the TV: send the controller the current game (only when it changed)
function tvPublish(view){
  if(!isTV() || !TV.room) return;
  const mine = view==='draft' && (S.mode==='cpu'||S.mode==='story') && turn()===0;   // the player's own draft pick
  const o={view: view==='plan' && vsCpu() ? 'plan' : mine ? 'draft' : 'watch', next:tvNextLabel(), choices:tvChoices(view), story: view==='story' ? tvStoryList() : null, tvView:view};
  TV_FIELDS.forEach(k=>{ if(S[k]!==undefined) o[k]=S[k]; });
  const j=JSON.stringify(o); if(j===TV.last) return; TV.last=j; TV.room.child('tv/state').set(j);
}
// The corner badge on the TV: the code for the phone, and whether it's connected
function tvBadge(){
  let b=document.getElementById('tvbadge');
  if(!isTV()){ if(b) b.remove(); return; }
  if(!b){ b=document.createElement('div'); b.id='tvbadge'; document.body.appendChild(b); }
  b.innerHTML=`<span class="tvk">📺</span><span>Phone controller code <b>${esc(S.tv.code)}</b>${S.tv.phone?' · <i>connected ✓</i>':''}</span><button class="btn ghost small" data-a="tvexit">Exit TV mode</button>`;
}

/* ---------- the phone (controller) side ---------- */
async function ctlJoin(code){
  S.onlineMsg='Connecting to the TV…'; render();
  try{
    const db=await firebaseReady(), room=db.ref('rooms/'+code);
    const keep={vol:S.vol, speed:S.speed, vibeOn:S.vibeOn, clipsOn:S.clipsOn, install:S.install};
    S=Object.assign({phase:'setup', mode:'story', names:[playerName()||'Player 1','Computer']}, keep, {ctl:{code}, onlineMsg:'', ctlView:'watch', ctlLocked:0, me:0, planFor:0, plans:[{},{}], helperPlan:[[],[]], lastPlans:[null,null]});
    const f=s=>{ const v=s.val(); if(v) ctlState(v); }; room.child('tv/state').on('value',f); TV.offs.push(()=>room.child('tv/state').off('value',f));
    TV.room=room; room.child('tv/acts').push({a:'hello'}); music(null); render();
  }catch(e){ S.onlineMsg=netError(e); render(); }
}
function ctlStop(){ TV.offs.forEach(f=>f()); TV.offs=[]; TV.room=null; S.ctl=null; }
// The TV's game arrived: mirror it; a new round starts with a clean set of picks on the phone
function ctlState(json){
  const o=JSON.parse(json), newRound=o.round!==S.round || o.stage!==S.stage;
  Object.assign(S,o); S.me=0; S.planFor=0; S.ctlView=o.view;
  if(newRound || !S.plans){ S.plans=players().map(()=>({})); S.helperPlan=players().map(()=>[]); S.focus=null; }
  render();
}
// The Continue button: tell the TV to press its main button
function ctlNext(){ if(TV.room) TV.room.child('tv/acts').push({a:'next'}); }
// Lock in on the phone: send the picks to the TV, then watch
function ctlLock(){
  if(!TV.room) return;
  S.lastPlans=S.lastPlans||[null,null]; S.lastPlans[0]=JSON.parse(JSON.stringify(S.plans[0]||{}));
  TV.room.child('tv/acts').push(JSON.parse(JSON.stringify({a:'moves', round:S.round, plans:S.plans[0]||{}, helperPlan:S.helperPlan[0]||[]})));
  S.ctlLocked=S.round; window.scrollTo(0,0);
}
// What the phone shows: the move screen while the TV waits for this round's moves, otherwise "Watch the TV"
const ctlViewName = () => S.ctlView==='plan' && S.ctlLocked!==S.round && S.teams ? 'plan' : S.ctlView==='draft' && S.pool ? 'draft' : 'ctlwatch';
// Send something to the TV
function ctlSend(m){ if(TV.room) TV.room.child('tv/acts').push(JSON.parse(JSON.stringify(m))); }
// The story map on the phone: pick a battle (or a draft replay of one you've won); the TV opens it
function ctlStoryList(list){
  return `<div class="ctlstory"><div class="tlabel">Pick a battle</div>${list.map(b=>`<div class="ctlrow${b.open?'':' locked'}${b.won?' won':''}">
    <span class="ctln">${b.i+1}</span><span class="ctlt"><b>${esc(b.title)}</b><small>${esc(b.arc)}${b.won?' · '+'★'.repeat(b.stars||1):''}</small></span>
    ${b.open?`<button class="btn small" data-a="ctlstage" data-v="${b.i}">${b.won?'Play again':'Play'}</button>`:'<span class="muted">🔒</span>'}
    ${b.won?`<button class="btn ghost small" data-a="ctlstage" data-v="${b.i}" data-d="1">Draft</button>`:''}</div>`).join('')}</div>`;
}
function vCtlWatch(){
  const live=!!S.teams && !['setup','story','modeset','credits'].includes(S.phase) && !S.story;
  return `<div class="ctlwatch"><span class="ctlk" aria-hidden="true">📺</span>
    <h1>${S.story?'Story mode':'Watch the TV'}</h1>
    <p class="muted">${S.story?'Pick a battle here, or on the TV.':!live?'Connected. Your moves will show up here when a battle starts.':['plan','result','scout'].includes(S.phase)?(S.ctlLocked===S.round&&S.ctlView==='plan'?`Round ${S.round}: moves locked in.`:`Round ${S.round||1}`):'Look at the TV.'}</p>
    ${S.next?`<button class="btn big" data-a="ctlnext">${esc(S.next)}</button>`:''}
    ${(S.choices||[]).length?`<div class="ctlchoices">${S.choices.map(([k,l],i)=>`<button class="btn${i?' ghost':''}" data-a="ctlpick" data-v="${esc(k)}">${esc(l)}</button>`).join('')}</div>`:''}
    ${S.story?ctlStoryList(S.story):''}
    <p class="hint">Code ${esc(S.ctl.code)}</p>
    <button class="btn ghost" data-a="ctlexit">Leave controller mode</button></div>`;
}
// Is this 4-letter code a TV (rather than a live online room)?
async function tvRoom(code){ try{ const db=await firebaseReady(); return !!(await db.ref('rooms/'+code+'/tv/on').get()).val(); }catch(e){ return false; } }
