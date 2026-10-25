// Smoke test: plays 300 computer-vs-computer games (all difficulty levels and point budgets) and draws every screen along the way.
// Catches crashes in js/views.js without opening a browser.
// Usage:  node tools/check-screens.js
const { loadGame } = require('./load-game');
const ctx = loadGame(['roster.js', 'engine.js', 'story.js', 'notes.js', 'views.js'], `
function check(games){
  let errors=0, first='';
  for(let g=0;g<games;g++){
    try{
      const level=['easy','normal','hard'][g%3]; S={phase:'setup',mode:'cpu',level,budget:[10,20,30][Math.floor(g/3)%3],poolType:g%10===0?'all':'random',names:['A','B']}; vSetup(); S.settings=true; vSheet(); S.settings=false;
      S.spin=null; vSpin(); S.spin=Object.assign(spinWheel(),{state:'spinning'}); vSpin(); S.spin.state='done'; vSpin();
      newDraft(S.spin.r);
      if(turn()!==S.spin.r) throw new Error('spin winner did not pick first');
      let k=0; while(S.phase==='draft'&&k++<50){ vDraft(); S.pool.forEach(id=>{ S.sel=id; vSheet(); }); S.sel=null; cpuDraftStep(level); }
      vPass();
      while(S.phase!=='over'){
        S.planFor=0; S.focus=null; vPlan();
        alive(0).forEach(u=>{ if(u.stun) return; setMove(u,u.cd?'attack':'special'); const o=targetOptions(u,S.plans[0][u.uid]); if(o.length) S.plans[0][u.uid].t=o[0].uid; vPlan(); });
        if(!planReady(0)) throw new Error('plan not ready after choosing every move');
        cpuPlan(1,level); S.phase='ready'; vReady(); S.teams[0].concat(S.teams[1]).forEach(u=>{ S.info=u.uid; vSheet(); }); S.info=null;
        resolve(); const ph=S.phase; S.phase='result';
        for(let i=0;i<S.log.length;i++){ S.play={k:i,done:false}; vResult(); }
        S.play=null; vResult(); S.phase=ph; if(S.phase==='result') S.round++;
      }
      vOver(); recordMatch(); vSetup();
    }catch(e){ errors++; if(!first) first=e.stack; }
  }
  // story mode: every stage's map, draft (with undo), battle (with repeat) and result
  let storyErrors=0;
  for(let i=0;i<STAGES.length;i++){
    try{
      S={phase:'story',mode:'story',level:'hard',names:['A','B']}; vStory(); vSetup();
      startStage(i); vDraft(); const cheap=S.pool.filter(id=>canPick(0,id)).sort((x,y)=>BYID[x].cost-BYID[y].cost)[0]; doPick(cheap); vDraft(); if(!undoable()) throw new Error('no undo after a pick'); undoPick();
      if(S.picks[0].length) throw new Error('undo did not remove the pick');
      let k=0; while(S.phase==='draft'&&k++<20){ cpuDraftStep('hard'); vDraft(); }
      S.planFor=0; cpuPlan(0); S.lastPlans[0]=JSON.parse(JSON.stringify(S.plans[0])); cpuPlan(1,stageLevel()); resolve();
      if(S.phase==='result'){ S.round++; S.phase='plan'; repeatPlans(0); vPlan(); }
      while(S.phase!=='over'){ cpuPlan(0); cpuPlan(1,stageLevel()); resolve(); if(S.phase==='result') S.round++; }
      vOver(); mvpPanel();
    }catch(e){ storyErrors++; if(!first) first='story stage '+i+': '+e.stack; errors++; }
  }
  return errors ? errors+' runs crashed. First error:\\n'+first : 'All '+games+' games and all '+STAGES.length+' story stages drew every screen without errors.';
}
`);
console.log(ctx.check(300));
