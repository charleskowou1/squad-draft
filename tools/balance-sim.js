// Balance simulator for Slayer Squad.
// Runs the real game logic (js/roster.js + js/engine.js) with two computer players and prints win rates.
// Usage:  node tools/balance-sim.js            (random 10-card drafts, win rate per character)
//         node tools/balance-sim.js yoriichi,murata vs tanjiro,zenitsu,inosuke,nezuko,genya
//         BUDGET=30 node tools/balance-sim.js   (draft with 10 or 30 points instead of 20)
//         node tools/balance-sim.js --ai     (computer difficulty levels against each other)
const { loadGame } = require('./load-game');
const ctx = loadGame(['roster.js', 'engine.js'], `
function battle(a,b){ S.mode='cpu'; S.names=['A','B']; S.picks=[a,b]; startBattle();
  while(S.phase!=='over'){ cpuBothSides(); resolve(); if(S.phase==='result') S.round++; } return S.winner; }
function vs(a,b,n){ const w=[0,0,0]; for(let i=0;i<n;i++){ const r=battle(a,b); w[r<0?2:r]++; }
  return 'A '+(w[0]/n*100).toFixed(0)+'%  B '+(w[1]/n*100).toFixed(0)+'%  draw '+(w[2]/n*100).toFixed(0)+'%'; }
function draftSim(n){ const st={}; S.budget=${+process.env.BUDGET||20};
  for(let i=0;i<n;i++){ S.mode='cpu'; newDraft(); let g=0; while(S.phase==='draft'&&g++<50) cpuDraftStep();
    const t=[S.picks[0].slice(),S.picks[1].slice()], w=battle(t[0],t[1]);
    t.forEach((team,p)=>team.forEach(id=>{ st[id]=st[id]||[0,0]; st[id][0]++; if(w===p) st[id][1]++; })); }
  return Object.entries(st).sort((a,b)=>b[1][1]/b[1][0]-a[1][1]/a[1][0])
    .map(([k,v])=>k.padEnd(16)+(v[1]/v[0]*100).toFixed(0).padStart(4)+'%   (in '+v[0]+' teams)').join('\\n'); }
// Same random team on both sides, computer level A vs level B
function aiCheck(n, A, B){ const w=[0,0,0];
  for(let i=0;i<n;i++){ S.mode='cpu'; newDraft(); let g=0; while(S.phase==='draft'&&g++<50) cpuDraftStep();
    const team=S.picks[i%2].slice(); S.names=['A','B']; S.picks=[team,team.slice()]; startBattle();
    while(S.phase!=='over'){ cpuPlan(0,A); cpuPlan(1,B); resolve(); if(S.phase==='result') S.round++; }
    w[S.winner<0?2:S.winner]++; }
  return (A+' vs '+B).padEnd(16)+A+' wins '+(w[0]/n*100).toFixed(0)+'%, '+B+' wins '+(w[1]/n*100).toFixed(0)+'%, draws '+(w[2]/n*100).toFixed(0)+'%'; }
`);
const args = process.argv.slice(2).join(' ');
if (args === '--ai') {
  console.log('Computer levels, mirror matches (same team both sides):');
  [['hard','normal'],['normal','easy'],['hard','easy']].forEach(([a,b])=>console.log(ctx.aiCheck(3000,a,b)));
} else if (args.includes(' vs ')) {
  const [a, b] = args.split(' vs ').map(s => s.split(',').map(x => x.trim()));
  console.log(a.join('+'), 'vs', b.join('+'), '=>', ctx.vs(a, b, 3000));
} else {
  console.log('Win rate by character over '+(process.env.N||3000)+' random drafts (computer vs computer):\n' + ctx.draftSim(+process.env.N||3000));
}
