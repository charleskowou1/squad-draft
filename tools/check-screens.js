// Smoke test: plays 300 computer-vs-computer games (all difficulty levels and point budgets) and draws every screen along the way.
// Catches crashes in js/views.js without opening a browser.
// Usage:  node tools/check-screens.js
const { loadGame } = require('./load-game');
const ctx = loadGame(['roster.js', 'engine.js', 'notes.js', 'views.js'], `
function check(games){
  let errors=0, first='';
  for(let g=0;g<games;g++){
    try{
      const level=['easy','normal','hard'][g%3]; S={phase:'setup',mode:'cpu',level,budget:[10,20,30][Math.floor(g/3)%3],names:['A','B']}; vSetup(); S.settings=true; vSheet(); S.settings=false;
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
  return errors ? errors+' of '+games+' games crashed. First error:\\n'+first : 'All '+games+' games drew every screen without errors.';
}
`);
console.log(ctx.check(300));
