/* ================= STORY MODE =================
   Stages against the computer, following the arcs. You see the enemy team first, then draft alone from every
   Corps member and ally within the stage's points, and fight. Clearing a stage unlocks the next.
   No DOM. Stage difficulty was checked with the simulator (see CLAUDE.md). */
const STAGES = [
  {id:'selection', title:'Final Selection', place:'Mount Fujikasane', foe:'Hand Demon', enemy:['hand','swamp'], budget:6, level:'easy',
    blurb:'Seven nights on a mountain full of demons. Survive them.'},
  {id:'tsuzumi', title:'Tsuzumi Mansion', place:'The drum house', foe:'Kyogai', enemy:['kyogai','swamp','hand'], budget:11, level:'easy',
    blurb:'Every drum beat turns the rooms upside down.'},
  {id:'natagumo', title:'Mount Natagumo', place:'The spider mountain', foe:'Rui', enemy:['rui','kyogai','hand'], budget:11, level:'normal',
    blurb:'A demon who wants a family, and threads that cut steel.'},
  {id:'mugen', title:'Mugen Train', place:'The night train', foe:'Enmu & Akaza', enemy:['enmu','akaza'], budget:14, level:'normal',
    blurb:'Wake from the dream, then face Upper Moon 3 at dawn.'},
  {id:'district', title:'Entertainment District', place:'Yoshiwara', foe:'Gyutaro & Daki', enemy:['gyutaro','daki','hand'], budget:17, level:'hard',
    blurb:'Two demons sharing one life, and a fallen thunder slayer.'},
  {id:'swordsmith', title:'Swordsmith Village', place:'The hidden village', foe:'Hantengu & Gyokko', enemy:['hantengu','gyokko'], budget:17, level:'hard',
    blurb:'Cut one down and two more appear. Watch the vases.'},
  {id:'castle', title:'Infinity Castle', place:'Muzan\'s fortress', foe:'Doma & Akaza', enemy:['doma','akaza'], budget:20, level:'hard',
    blurb:'The floors shift. Upper Moons wait on every one.'},
  {id:'kokushibo', title:'Upper Moon One', place:'Infinity Castle, deep', foe:'Kokushibo', enemy:['kokushibo','kaigaku'], budget:20, level:'hard',
    blurb:'The strongest demon after Muzan, once a slayer himself.'},
  {id:'dawn', title:'Until Dawn', place:'The city streets', foe:'Muzan (Final Form)', enemy:['muzan_final'], budget:22, level:'hard',
    blurb:'The last fight. Hold him until the sun comes up.'},
];
const STORY_KEY = 'squad-draft-story';
function loadStory(){ try{ return JSON.parse(localStorage.getItem(STORY_KEY))||{cleared:[]} }catch(e){ return {cleared:[]} } }
function saveStoryClear(id){ const s=loadStory(); if(!s.cleared.includes(id)) s.cleared.push(id); try{ localStorage.setItem(STORY_KEY,JSON.stringify(s)) }catch(e){} }
const stageCleared = i => loadStory().cleared.includes(STAGES[i].id);
const stageUnlocked = i => i===0 || stageCleared(i-1);
const stageLevel = () => STAGES[S.stage].level;
// Your side in story mode is the Demon Slayer Corps and its allies: slayers plus Nezuko, Tamayo and Yushiro.
// No demons, and no Yoriichi (he lived centuries before the story; he also made any stage he fit into trivial).
const STORY_ALLIES = ['nezuko','tamayo','yushiro'];
const storyCard = c => !c.spawn && !c.legend && (!c.demon || STORY_ALLIES.includes(c.fam));   // includes the back-pocket helpers
// Start a stage's draft: the enemy team is already locked in, you draft from the Corps within the stage's budget
function startStage(i){
  const st=STAGES[i];
  Object.assign(S,{stage:i, budget:st.budget, phase:'draft', first:0, lastPicker:null, history:[], k:0, sel:null,
    picks:[[],st.enemy.slice()], locked:[false,true]});
  S.names=[S.names[0], st.foe];
  S.pool=ROSTER.filter(c=>storyCard(c) && c.cost<=st.budget).map(c=>c.id)
    .sort((a,b)=>BYID[b].cost-BYID[a].cost || BYID[a].name.localeCompare(BYID[b].name));
}
