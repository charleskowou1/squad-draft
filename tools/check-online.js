// Online play check: a host phone and 1–3 guest phones joined by an in-memory connection that behaves like the
// Firebase room (the host sends each guest its own copy of the state). Each phone only uses its own actions. Plays
// full matches with 2, 3 and 4 players and checks that every phone agrees, picks happen only on your turn, and no
// guest receives anyone else's moves while choosing (except when that guest's Kasugai Crow is scouting).
// Usage: node tools/check-online.js [matches]
const { loadGame } = require('./load-game');
const FILES = ['roster.js', 'engine.js', 'story.js', 'online.js', 'notes.js', 'effects.js', 'views.js'];
const EXTRA = `function S_(){ return S; } function OL(){ return ONLINE; } function api(){ return {isHelper, fighterIds, alive, players}; }`;

function match(seed, opts = {}) {
  const n = opts.n || 2, names = ['CK', 'Mia', 'Tom', 'Ana'].slice(0, n);
  const phones = Array.from({length: n}, () => loadGame(FILES, EXTRA)), host = phones[0];
  let s = seed * 7 + 1; Math.random = () => (s = (s * 16807) % 2147483647) / 2147483647;   // seeded, shared by every phone
  const problems = [];
  let leaks = 0;
  // the connection: the host publishes a copy for each guest; a guest's action goes to the host, then the host publishes
  const publish = () => phones.forEach((ph, q) => { if (q) ph.applySnapshot(host.snapshotFor(q)); });
  host.OL().net = { send() {} };
  phones.forEach((ph, q) => { if (q) ph.OL().net = { send(msg) { host.hostHandle(msg); publish(); } }; });
  const H = host.S_();
  Object.assign(H, { mode: 'online', me: 0, planFor: 0, n: 2, names: [names[0]], budget: opts.budget || 20, poolType: 'random',
    lobby: { code: 'TEST', seats: [1, 2, 3].map(i => i < n ? { name: names[i], on: true } : null) }, phase: 'lobby' });
  phones.forEach((ph, q) => { if (q) Object.assign(ph.S_(), { mode: 'online', me: q, planFor: q, names: [names[0], names[q]], phase: 'lobby' }); });
  if (!host.hostStartMatch()) problems.push('host could not start with ' + n + ' players');
  publish();
  // host spins and starts the draft
  H.phase = 'spin'; H.spin = Object.assign(host.spinWheel(), { state: 'done' }); host.newDraft(H.spin.r); publish();
  for (let k = 0; k < 120 && H.phase === 'draft'; k++) {
    const p = host.turn(), ctx = phones[p], S = ctx.S_();
    phones.forEach((ph, q) => { if (q && (ph.S_().phase !== 'draft' || ph.turn() !== p)) problems.push('phones disagree on whose turn it is'); });
    // another phone trying to pick must do nothing
    const o = (p + 1) % n, before = JSON.stringify(H.picks), anyId = phones[o].S_().pool.find(id => phones[o].canPick(o, id));
    if (anyId) { phones[o].onlinePick(anyId); if (o === 0) publish(); if (JSON.stringify(H.picks) !== before) problems.push('picked out of turn'); }
    const options = S.pool.filter(id => ctx.canPick(p, id));
    const helper = options.find(id => ctx.api().isHelper(id)), fighter = options.find(id => !ctx.api().isHelper(id));
    const choice = (k % 5 === 3 && helper) || fighter || helper;
    if (choice && (ctx.api().fighterIds(p).length < 3 || ctx.Math.random() < .7)) ctx.onlinePick(choice); else ctx.onlineLockTeam();
    if (p === 0) publish();
  }
  if (H.phase !== 'plan') problems.push('draft did not finish (phase ' + H.phase + ')');
  if (H.teams && H.teams.length !== n) problems.push('wrong number of teams');
  for (let r = 0; r < 45 && !H.final; r++) {
    if (H.phase !== 'plan') { problems.push('expected plan, got ' + H.phase); break; }
    // each phone still in the fight plans its own side and maybe uses its helper; then locks, one at a time
    const live = host.api().players().filter(p => host.api().alive(p).length);
    live.forEach(p => { const ctx = phones[p], S = ctx.S_(); ctx.cpuPlan(p); const h = (S.helpers[p] || [])[0];
      if (h && r >= 1 && (h === 'crow' || ctx.Math.random() < .5)) S.helperPlan[p] = [h]; });
    live.forEach((p, i) => {
      phones[p].onlineLockMoves(); if (p === 0) publish();
      // privacy: while others are still choosing, no guest may hold anyone else's moves
      if (H.phase === 'plan') phones.forEach((ph, q) => { if (q && ph.S_().plans.some((pl, x) => x !== q && Object.keys(pl || {}).length)) leaks++; });
    });
    for (let k = 0; k < 6 && H.phase === 'scout'; k++) {
      const sp = H.scoutP, ctx = phones[sp];
      const canSee = host.api().players().some(x => x !== sp && host.api().alive(x).some(u => !u.stun));   // someone else has a move to see
      if (sp > 0 && canSee && !ctx.S_().plans.some((pl, x) => x !== sp && Object.keys(pl || {}).length)) problems.push("a guest's crow saw no moves");
      if (k % 2 === 0) { ctx.S_().scouting = true; ctx.onlineLockMoves(); } else ctx.onlineKeepMoves();
      if (sp === 0) publish();
    }
    if (H.phase !== 'result') { problems.push('expected result, got ' + H.phase); break; }
    phones.forEach((ph, q) => { if (!q) return; const G = ph.S_();
      if (G.phase !== 'result' || G.roundId !== H.roundId) problems.push('a guest did not get the round');
      if (JSON.stringify(G.teams) !== JSON.stringify(H.teams)) problems.push('phones disagree on the teams after round ' + H.round); });
    if (H.final) break;
    // "Next round" waits for every phone, including knocked-out players who are watching
    phones.forEach((ph, q) => { if (q === n - 1) return; ph.onlineNext(); if (!q) publish(); if (H.phase !== 'result') problems.push('round advanced before every phone was ready'); });
    phones[n - 1].onlineNext(); if (n - 1 === 0) publish();
  }
  if (!H.final) problems.push('match did not finish');
  phones.forEach((ph, q) => { if (q && ph.S_().winner !== H.winner) problems.push('phones disagree on the winner'); });
  phones[n - 1].onlineRematch(); if (n === 1) publish();
  phones.forEach(ph => { if (ph.S_().phase !== 'spin') problems.push('rematch did not reach the wheel on every phone'); });
  return { problems, leaks, rounds: H.round, winner: H.winner };
}

let bad = 0, leaks = 0, rounds = 0;
const N = +process.argv[2] || 200;
for (let i = 1; i <= N; i++) {
  const r = match(i, { budget: [10, 20, 30][i % 3], n: [2, 3, 4][i % 3 === 0 ? 0 : i % 4 % 3] });
  leaks += r.leaks; rounds += r.rounds;
  if (r.problems.length) { bad++; if (bad <= 3) console.log('match ' + i + ': ' + [...new Set(r.problems)].join('; ')); }
}
console.log(bad ? `${bad} of ${N} online matches had problems.` : `All ${N} online matches (2, 3 and 4 phones) played correctly on every phone (${rounds} rounds).`);
console.log(leaks ? `PRIVACY: a guest held someone else's moves ${leaks} times.` : "Privacy: no guest ever received anyone else's moves while choosing.");
