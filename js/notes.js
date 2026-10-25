/* ================= POOL NOTES =================
   Plain-language notes on the synergies and matchups that are possible with the characters dealt this draft.
   Keep the wording in step with synergies(), the passives and the specials in engine.js. No DOM. */
function poolNotes(){
  // fam → a card of that character in the pool (inPool) and every version of it in the pool (versions; several in the All pool)
  const inPool = {}, versions = {}; S.pool.forEach(id=>{ const f=BYID[id].fam; inPool[f]=inPool[f]||id; (versions[f]=versions[f]||[]).push(id); });
  const has = f => f in inPool;
  const who = f => S.picks[0].some(id=>BYID[id].fam===f) ? 0 : S.picks[1].some(id=>BYID[id].fam===f) ? 1 : -1;
  const famsWhere = test => Object.keys(inPool).filter(f=>test(BYID[inPool[f]]));
  const free = fs => fs.filter(f=>who(f)<0);

  // Points: a note only counts as possible if a team can still afford the characters it needs.
  const cost = f => Math.min(...versions[f].map(id=>BYID[id].cost));          // cheapest version of that character in the pool
  const sum = fs => fs.reduce((a,f)=>a+cost(f),0);
  const cheapest = (fs,n) => fs.slice().sort((a,b)=>cost(a)-cost(b)).slice(0,n);
  const fighters = p => S.picks[p].filter(id=>!BYID[id].helper).length;
  // can team p still add these (not yet picked) characters: enough points left and fighter slots, and not locked
  const canAdd = (p,fs) => !S.locked[p] && spent(p)+sum(fs) <= budget() && fighters(p)+fs.length <= MAXTEAM;
  const fits = fs => sum(fs) <= budget() && fs.length <= MAXTEAM;   // affordable at all on a fresh team

  // state of a note: 'on' (a team has it, p = that team), 'open' (still possible), 'off' (can't happen any more),
  // or 'never' (no team could ever afford it in this match: the note isn't shown)
  // all of these fighters on one team
  function together(fs){
    if(!fits(fs)) return {state:'never'};
    const o=fs.map(who), owners=[...new Set(o.filter(x=>x>=0))];
    if(owners.length>1) return {state:'off'};
    if(owners.length===1){ const p=owners[0]; if(o.every(x=>x===p)) return {state:'on',p}; return {state: canAdd(p,free(fs))?'open':'off'}; }
    return {state: [0,1].some(p=>canAdd(p,fs))?'open':'off'};
  }
  // two or more of these fighters on one team
  function twoOf(fs){
    if(!fits(cheapest(fs,2))) return {state:'never'};
    for(const p of [0,1]) if(fs.filter(f=>who(f)===p).length>=2) return {state:'on',p};
    const can=[0,1].some(p=>{ const need=2-fs.filter(f=>who(f)===p).length, pick=cheapest(free(fs),need); return pick.length===need && canAdd(p,pick); });
    return {state: can?'open':'off'};
  }
  // `anchor` plus at least one of `others` on one team
  function withAnchor(anchor, others){
    if(!fits([anchor, ...cheapest(others,1)])) return {state:'never'};
    const m=who(anchor);
    if(m>=0 && others.some(f=>who(f)===m)) return {state:'on',p:m};
    const can=[0,1].some(p=>{
      if(m>=0 && m!==p) return false;
      const need=m===p?[]:[anchor];
      if(others.some(f=>who(f)===p)) return canAdd(p,need);
      const o=cheapest(free(others),1); return o.length && canAdd(p,[...need,...o]);
    });
    return {state: can?'open':'off'};
  }
  // a fighter from A on the opposite team to a fighter from B
  function facing(A, B){
    for(const a of A) for(const b of B){ const x=who(a), y=who(b); if(x>=0 && y>=0 && x!==y) return {state:'on'}; }
    const can=(f,p)=>who(f)===p || (who(f)<0 && canAdd(p,[f]));
    return {state: A.some(a=>B.some(b=>a!==b && [0,1].some(p=>can(a,p)&&can(b,1-p)))) ? 'open' : 'off'};
  }

  const N=[];
  const add=(kind, fams, title, text, st) => { if(st.state!=='never') N.push(Object.assign({kind, ids:fams.flatMap(f=>versions[f]), title, text}, st)); };

  // same team
  const kama=['tanjiro','zenitsu','inosuke'];
  if(kama.every(has)) add('team', kama, 'Kamaboko Squad', 'All three on one team: the whole team gets +2 SPD.', together(kama));
  if(has('tanjiro')&&has('nezuko')) add('team', ['tanjiro','nezuko'], 'Siblings', 'On one team: when either is hit, the other strikes back at the attacker for 3 damage.', together(['tanjiro','nezuko']));
  if(has('yoriichi')&&has('tanjiro')) add('team', ['yoriichi','tanjiro'], 'Sun Lineage', 'Yoriichi and Tanjiro on one team: Tanjiro gets +2 PWR.', together(['yoriichi','tanjiro']));
  if(has('tamayo')&&has('yushiro')) add('team', ['tamayo','yushiro'], 'Devoted', 'Tamayo and Yushiro on one team: Yushiro gets +2 PWR.', together(['tamayo','yushiro']));
  const hashira=famsWhere(c=>c.hashira);
  if(hashira.length>=2) add('team', hashira, 'Hashira', 'Two or more Hashira on one team: each Hashira gets +1 PWR.', twoOf(hashira));
  const upper=famsWhere(c=>c.upper);
  if(upper.length>=2) add('team', upper, 'Upper Moons', 'Two or more Upper Moons on one team: each regenerates 1 more HP a round.', twoOf(upper));
  const marks=famsWhere(c=>c.mark);
  if(marks.length>=2) add('team', marks, 'Marks spread', 'Two or more Mark ✦ fighters on one team: each gets +1 SPD.', twoOf(marks));
  const kin=famsWhere(c=>c.demon && c.fam!=='muzan' && c.fam!=='nezuko');
  if(has('muzan')&&kin.length) add('team', ['muzan',...kin], "Muzan's Blood", 'Muzan plus another demon (not Nezuko) on one team: Muzan and those demons get +1 PWR.', withAnchor('muzan',kin));

  const pupils=['tanjiro','giyu','sabito'].filter(has);
  if(has('urokodaki')&&pupils.length) add('team', ['urokodaki',...pupils], 'Mentor', 'Urokodaki plus Tanjiro, Giyu or Sabito & Makomo on one team: his pupils get +1 DEF.', withAnchor('urokodaki',pupils));
  if(has('kagaya')&&hashira.length) add('team', ['kagaya',...hashira], 'Corps Master', 'Kagaya plus any Hashira on one team: every Hashira on that team gets +1 DEF.', withAnchor('kagaya',hashira));

  // opposing teams
  if(has('kaigaku')&&has('zenitsu')) add('vs', ['zenitsu','kaigaku'], 'Rivals', 'Facing Kaigaku, Zenitsu gets +2 PWR.', facing(['zenitsu'],['kaigaku']));
  if(has('muzan')&&has('yoriichi')) add('vs', ['muzan','yoriichi'], 'Muzan fears the Sun', 'Facing Yoriichi, Muzan gets −3 PWR and −2 SPD.', facing(['muzan'],['yoriichi']));
  if(has('kokushibo')&&has('yoriichi')) add('vs', ['kokushibo','yoriichi'], 'Kokushibo shaken', 'Facing Yoriichi, Kokushibo gets −1 DEF.', facing(['kokushibo'],['yoriichi']));
  if(has('tamayo')&&has('muzan')) add('vs', ['tamayo','muzan'], "Tamayo's medicine", 'Facing Tamayo, Muzan regenerates 2 less HP a round.', facing(['tamayo'],['muzan']));
  const demons=famsWhere(c=>c.demon);
  const eaters=demons.filter(f=>f!=='akaza');   // demons who would devour Shinobu (Akaza never eats women)
  if(has('shinobu')&&eaters.length) add('vs', ['shinobu',...eaters], 'Wisteria Body', 'If a demon lands the blow that knocks Shinobu out, it devours her and loses 5 HP every round for the rest of the match. Akaza is the exception: he never eats women.', facing(['shinobu'],eaters));
  const regen=demons.filter(f=>BYID[inPool[f]].regen);
  if(S.pool.includes('yoriichi') && regen.length) add('vs', ['yoriichi',...regen], 'Sun Breathing', "Yoriichi's special hits every enemy, and demons it hits stop regenerating for the rest of the match.", facing(['yoriichi'],regen));
  const poison=['shinobu','gyutaro'].filter(has);
  if(has('tamayo')&&poison.length) add('vs', ['tamayo',...poison], 'Antidote', "Tamayo's heal also cures poison, so she can undo Shinobu's and Gyutaro's poison on her team.", facing(['tamayo'],poison));

  const rank={on:0, open:1, off:2};
  return N.sort((a,b)=>rank[a.state]-rank[b.state]);
}
