/* ================= DAILY CHALLENGE =================
   One preset match a day, the same on every phone: it's built from the date with a seeded random generator, and
   even the test battles used to check its difficulty run on that generator. Your squad only uses starting characters
   (no story unlocks needed); the enemy can be anyone. A goal makes it more than "just win".
   Daily games don't count toward Stats. Progress and the streak are kept in localStorage (DAILY_KEY). No DOM. */
const DAILY_KEY = 'squad-draft-daily';
const DAILY_GOALS = {
  win:      () => 'Win the battle',
  rounds:   g => `Win within ${g.n} rounds`,
  keep:     g => `Win with ${BYID[g.id].short} still standing`,
  flawless: () => 'Win without losing a fighter',
};
const todayKey = (d=new Date()) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
// Small seeded random generator (mulberry32) from a string
function seededRng(str){ let h=1779033703^str.length; for(let i=0;i<str.length;i++){ h=Math.imul(h^str.charCodeAt(i),3432918353); h=h<<13|h>>>19; }
  return ()=>{ h|=0; h=h+0x6D2B79F5|0; let t=Math.imul(h^h>>>15,1|h); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
// A random squad within the points: up to 4 fighters, at least 2, one version per character
function dailySquad(rng, cards, pts){
  const pool=cards.slice().sort(()=>rng()-.5), team=[], fams=new Set(); let left=pts;
  for(const c of pool){ if(team.length>=4) break; if(c.cost<=left && !fams.has(c.fam) && (team.length<1 || left-c.cost>=0)){ team.push(c.id); fams.add(c.fam); left-=c.cost; } }
  return team.length>=2 ? team : null;
}
// Did the battle just finished meet the goal?
function dailyMet(ch){
  if(S.winner!==0) return false;
  const mine=S.teams[0].filter(u=>!u.spawn), g=ch.goal;
  if(g.type==='rounds') return S.round<=g.n;
  if(g.type==='keep') return mine.some(u=>u.id===g.id && u.alive);
  if(g.type==='flawless') return mine.every(u=>u.alive);
  return true;
}
// Play the challenge's battle with the computer on both sides (for the difficulty check)
function dailyTrial(ch){
  const keep=S; S={mode:'daily', n:2, names:['You','Foe'], picks:[ch.mine.slice(), ch.enemy.slice()], budget:40};
  startBattle(); while(S.phase!=='over'){ cpuPlan(0,'hard'); cpuPlan(1,ch.level); resolve(); if(S.phase==='result') S.round++; }
  const out={won:S.winner===0, rounds:S.round, met:dailyMet(ch)}; S=keep; return out;
}
// Today's challenge: tries seeded candidates until one is beatable but not trivial for a strong player
// (the goal met in 35–75% of 30 test battles), else keeps the closest. Cached per day.
let DAILY_CACHE=null;
function dailyChallenge(day=todayKey()){
  if(DAILY_CACHE && DAILY_CACHE.day===day) return DAILY_CACHE;
  const rng=seededRng('squad-draft '+day), real=Math.random; Math.random=rng;   // the test battles use the seed too
  try{
    const starters=ROSTER.filter(c=>!c.spawn && !c.helper && (typeof lockable!=='function' || !lockable(c)) && c.cost<=12);
    const anyone=ROSTER.filter(c=>!c.spawn && !c.helper && c.cost<=14);
    let best=null;
    for(let tries=0;tries<40;tries++){
      const mine=dailySquad(rng,starters,20), enemy=dailySquad(rng,anyone,20); if(!mine||!enemy) continue;
      const type=['win','rounds','keep','flawless'][Math.floor(rng()*4)], level=rng()<.5?'normal':'hard';
      const ch={day, mine, enemy, level, goal:{type}};
      if(type==='keep') ch.goal.id=mine[Math.floor(rng()*mine.length)];
      if(type==='rounds'){ const w=[]; for(let i=0;i<12;i++){ const t=dailyTrial(ch); if(t.won) w.push(t.rounds); } if(w.length<4) continue;
        w.sort((a,b)=>a-b); ch.goal.n=w[Math.floor(w.length*.55)]; }
      let met=0; for(let i=0;i<30;i++) if(dailyTrial(ch).met) met++;
      ch.rate=met/30; const miss=Math.abs(ch.rate-.55);
      if(!best || miss<best.miss) best={ch, miss};
      if(ch.rate>=.35 && ch.rate<=.75) break;
    }
    DAILY_CACHE=best.ch; return best.ch;
  } finally { Math.random=real; }
}
function loadDaily(){ try{ return JSON.parse(localStorage.getItem(DAILY_KEY))||{} }catch(e){ return {} } }
function saveDaily(d){ try{ localStorage.setItem(DAILY_KEY,JSON.stringify(d)) }catch(e){} }
const dailyDone = (day=todayKey()) => (loadDaily().done||[]).includes(day);
// Streak: days in a row with the challenge completed, ending today (or yesterday, if today isn't done yet)
function dailyStreak(){
  const done=new Set(loadDaily().done||[]), d=new Date(); if(!done.has(todayKey(d))) d.setDate(d.getDate()-1);
  let n=0; while(done.has(todayKey(d))){ n++; d.setDate(d.getDate()-1); } return n;
}
function markDaily(day){ const d=loadDaily(); d.done=[...new Set([...(d.done||[]), day])].slice(-400); saveDaily(d); }
// Start today's challenge: no draft, straight into the battle
function startDaily(){
  const ch=dailyChallenge();
  Object.assign(S,{mode:'daily', n:2, duo:false, maxTeam:MAXTEAM, bansOn:false, daily:ch, picks:[ch.mine.slice(), ch.enemy.slice()], budget:40, level:ch.level});
  S.names=[S.names[0]||'You', 'Daily challenger'];
  startBattle();
}
