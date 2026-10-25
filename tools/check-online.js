// Online play check: two copies of the game (host phone and guest phone) joined by an in-memory connection that
// behaves like the Firebase room. Each side only uses its own phone's actions. Plays full matches and checks that
// both phones agree, picks happen only on your turn, and the guest never sees the host's moves while choosing
// (except when the guest's Kasugai Crow is scouting).   Usage: node tools/check-online.js
const { loadGame } = require('./load-game');
const FILES = ['roster.js', 'engine.js', 'story.js', 'online.js', 'notes.js', 'effects.js', 'views.js'];
const EXTRA = `function S_(){ return S; } function OL(){ return ONLINE; } function api(){ return {isHelper, fighterIds, alive}; }`;

function match(seed, opts = {}) {
  const host = loadGame(FILES, EXTRA), guest = loadGame(FILES, EXTRA);
  // seeded randomness so a failure can be replayed
  let s = seed * 7 + 1; Math.random = () => (s = (s * 16807) % 2147483647) / 2147483647;   // shared by both phones (same Math)
  const problems = [];
  let leaks = 0;
  // the connection: host publishes → guest applies; guest sends → host handles → host publishes
  const publish = () => { const j = host.snapshotFor(); guest.applySnapshot(j); };
  host.OL().net = { send() {} };
  guest.OL().net = { send(msg) { host.hostHandle(msg); publish(); } };
  // setup: host created the room, guest joined
  const H = host.S_(), G = guest.S_();
  Object.assign(H, { mode: 'online', me: 0, planFor: 0, names: ['CK', 'Mia'], budget: opts.budget || 20, poolType: 'random', lobby: { code: 'TEST', peer: true }, phase: 'lobby' });
  Object.assign(G, { mode: 'online', me: 1, planFor: 1, names: ['CK', 'Mia'], phase: 'lobby' });
  publish();
  // host spins and starts the draft
  H.phase = 'spin'; H.spin = Object.assign(host.spinWheel(), { state: 'done' }); host.newDraft(H.spin.r); publish();
  // draft: whoever's turn it is picks on their own phone (or locks); the other phone must not be able to
  for (let k = 0; k < 60 && H.phase === 'draft'; k++) {
    const p = host.turn(), ctx = p === 0 ? host : guest, other = p === 0 ? guest : host, S = ctx.S_();
    if (guest.S_().phase !== 'draft' || guest.turn() !== p) problems.push('phones disagree on whose turn it is');
    // the other phone trying to pick must do nothing
    const before = JSON.stringify(H.picks);
    const anyId = other.S_().pool.find(id => other.canPick(1 - p, id));
    if (anyId) { other.onlinePick(anyId); if (1 - p === 0) publish(); if (JSON.stringify(H.picks) !== before) problems.push('picked out of turn'); }
    // the player on turn: pick something affordable (prefer fighters), sometimes a helper, else lock
    const options = S.pool.filter(id => ctx.canPick(p, id));
    const helper = options.find(id => ctx.api().isHelper(id)), fighter = options.find(id => !ctx.api().isHelper(id));
    const choice = (k % 5 === 3 && helper) || fighter || helper;
    if (choice && (ctx.api().fighterIds(p).length < 3 || ctx.Math.random() < .7)) ctx.onlinePick(choice); else ctx.onlineLockTeam();
    if (p === 0) publish();
  }
  if (H.phase !== 'plan') problems.push('draft did not finish (phase ' + H.phase + ')');
  // battle
  for (let r = 0; r < 45 && !H.final; r++) {
    if (H.phase !== 'plan') { problems.push('expected plan, got ' + H.phase); break; }
    // each phone plans its own side (computer logic stands in for the player) and maybe uses its helper
    for (const [ctx, p] of [[host, 0], [guest, 1]]) {
      const S = ctx.S_(); ctx.cpuPlan(p); const h = (S.helpers[p] || [])[0];
      if (h && r >= 1 && (h === 'crow' || ctx.Math.random() < .5)) S.helperPlan[p] = [h];
    }
    host.onlineLockMoves(); publish();
    // privacy: the host has locked; the guest must not have the host's moves
    if (Object.keys(G.plans[0] || {}).length) leaks++;
    guest.onlineLockMoves();
    // crow reports: whoever scouts sees the other side's moves and keeps or changes theirs
    for (let s = 0; s < 3 && H.phase === 'scout'; s++) {
      const sp = H.scoutP, ctx = sp === 0 ? host : guest;
      if (sp === 1 && !Object.keys(G.plans[0] || {}).length && host.api().alive(0).some(u => !u.stun)) problems.push("guest's crow saw no host moves");
      if (s % 2 === 0) { ctx.S_().scouting = true; ctx.onlineLockMoves(); } else ctx.onlineKeepMoves();
      if (sp === 0) publish();
    }
    if (H.phase !== 'result') { problems.push('expected result, got ' + H.phase); break; }
    if (G.phase !== 'result' || G.roundId !== H.roundId) problems.push('guest did not get the round');
    if (JSON.stringify(G.teams) !== JSON.stringify(H.teams)) problems.push('phones disagree on the teams after round ' + H.round);
    if (H.final) break;
    host.onlineNext(); publish();
    if (H.phase !== 'result') problems.push('round advanced before the guest was ready');
    guest.onlineNext();
  }
  if (!H.final) problems.push('match did not finish');
  if (G.winner !== H.winner) problems.push('phones disagree on the winner');
  // rematch from the guest's phone
  guest.onlineRematch();
  if (H.phase !== 'spin' || G.phase !== 'spin') problems.push('rematch did not reach the wheel on both phones');
  return { problems, leaks, rounds: H.round, winner: H.winner };
}

let bad = 0, leaks = 0, rounds = 0;
const N = +process.argv[2] || 200;
for (let i = 1; i <= N; i++) {
  const r = match(i, { budget: [10, 20, 30][i % 3] });
  leaks += r.leaks; rounds += r.rounds;
  if (r.problems.length) { bad++; if (bad <= 3) console.log('match ' + i + ': ' + [...new Set(r.problems)].join('; ')); }
}
console.log(bad ? `${bad} of ${N} online matches had problems.` : `All ${N} online matches played correctly on both phones (${rounds} rounds).`);
console.log(leaks ? `PRIVACY: the guest saw the host's moves ${leaks} times.` : "Privacy: the guest never received the host's moves while choosing.");
