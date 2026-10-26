/* ================= MOVE CLIPS =================
   Short anime clips (and optional sounds) for a character's moments in round playback: their special plays inside
   the cut-in; other moments (regen, heal, defend, knockouts…) get a clip box on the stage. Characters or moments
   without a clip keep the drawn effects. Clips are Tenor's mp4 versions (page links resolved by hand to the
   media.tenor.com address in the page's og:video tag). Personal use only, like the pictures.
   A family's clips cover its other versions (muzan → muzan_final) unless that version has its own.
   No DOM here: app.js picks the clip for each playback step (clipStep) and views.js draws S.play.clip. */
const CLIPS = {
  doma: {
    special: 'https://media.tenor.com/klOFR0UsOUYAAAPo/douma-douma-kimetsu-no-yaiba.mp4',   // Frozen Lotus (fan)
    regen:   'https://media.tenor.com/-sCN02pzMS8AAAPo/douma-demon-slayer.mp4',              // face healing
  },
  giyu: {
    special: 'https://media.tenor.com/xHYvGutUP_kAAAPo/giyuu-tamioka.mp4',                   // Dead Calm
  },
};
// Sounds for the same moments, same shape as CLIPS: files in sounds/ (e.g. 'sounds/doma-special.mp3').
// A clip's sound plays instead of the usual effect for that moment.
const CLIP_SOUNDS = {};
// What each moment is called (shown on the clip box)
const CLIP_ACTS = {special:'', attack:'Attack', regen:'Regenerates', heal:'Heals', defend:'Guards', ko:'Knockout', fall:'Falls', revive:'Rises again', split:'Splits'};
// Moments that repeat every round (attacks, guarding, regenerating) show their clip at most once every few rounds
// per fighter, so long matches don't drag. Specials and one-off moments always play.
const CLIP_REPEAT = ['attack','defend','regen'], CLIP_GAP = 3;

const clipSet = (src, u) => u && (src[u.id] || (BYID[u.id] && src[BYID[u.id].fam])) || null;
// The moment a log line shows and whose it is: {act, u}
function clipMoment(line){
  const by=line.by&&findU(line.by), on=line.on&&findU(line.on), has=(u,a)=>!!(clipSet(CLIPS,u)||{})[a];
  switch(line.fx){
    case 'special': return {act:'special', u:by};
    case 'heal': return line.act==='regen' ? {act:'regen', u:on} : by ? {act:'heal', u:by} : null;
    case 'guard': case 'block': return {act:'defend', u:on||by};
    case 'ko': return has(by,'ko') ? {act:'ko', u:by} : {act:'fall', u:on};
    case 'revive': return {act:'revive', u:on||by};
    case 'spawn': return {act:'split', u:on};
    case 'hit': return line.move==='attack' ? {act:'attack', u:by} : null;
  }
  return null;
}
// The clip for one playback step (first line of the step), or null. Records repeat moments in S.clipSeen.
function clipStep(line){
  if(S.clipsOn===false || !line) return null;
  const m=clipMoment(line); if(!m || !m.u) return null;
  const src=(clipSet(CLIPS,m.u)||{})[m.act]; if(!src) return null;
  const seen=S.clipSeen=S.clipSeen||{}, key=m.u.uid+':'+m.act;
  if(CLIP_REPEAT.includes(m.act)){ if(seen[key]!==undefined && S.round-seen[key]<CLIP_GAP) return null; seen[key]=S.round; }
  return {src, act:m.act, uid:m.u.uid, sound:(clipSet(CLIP_SOUNDS,m.u)||{})[m.act]||null, key:`${S.round}-${S.play?S.play.k:0}-${m.u.uid}`};
}
// Downloaded copies (app.js fills this), so a clip starts instantly and isn't fetched again
const CLIP_BLOB = {};
const clipSrc = url => CLIP_BLOB[url] || url;
// Every clip the fighters in this match could use: downloaded as soon as they're drafted (sounds load on first use)
const matchClips = () => [...new Set([...(S.teams?allUnits():[]), ...(S.picks||[]).flat().map(id=>BYID[id])]
  .flatMap(u=>Object.values(clipSet(CLIPS,u)||{})))];
