/* ================= STORY MODE =================
   21 battles following the arcs, plus two Yoriichi flashbacks. Each stage gives you a preset squad (the canon one)
   and opens with a short scene. Once cleared, a stage can be replayed drafting your own squad from the Corps and its
   allies, with the same points as the preset squad.
   Twists (one line on the stage card, nothing hidden):
     survive: N        win by still standing at the end of round N (or by beating the enemy first)
     reinforce: [{id, round}]   each fighter joins your team at the start of that round
     start: {id: {hp, poison, devoured}}   an enemy starts the fight already hurt (part 2 of a two-part fight)
   Boosts tune a stage's difficulty and are shown on its card: [{side:0 you / 1 enemy, only:[ids], hp:×, pow:+, def:+, spd:+, label}]
   No DOM. Stage difficulty was checked with the simulator (see CLAUDE.md). */
const ARCS = {
  prologue:{title:'Prologue', g:'始'}, asakusa:{title:'Asakusa', g:'浅'}, flashback:{title:'Flashback', g:'昔'},
  tsuzumi:{title:'Tsuzumi Mansion', g:'鼓'}, natagumo:{title:'Mount Natagumo', g:'蜘'}, mugen:{title:'Mugen Train', g:'列'},
  district:{title:'Entertainment District', g:'遊'}, swordsmith:{title:'Swordsmith Village', g:'刀'},
  castle:{title:'Infinity Castle', g:'城'}, dawn:{title:'Until Dawn', g:'暁'},
};
// scene lines: [speaker card id, or '' for the narrator, text]
const STAGES = [
  {id:'training', arc:'prologue', title:'The Boulder', place:'Mount Sagiri', foe:'Sabito & Makomo', mine:['tanjiro'], enemy:['sabito'], level:'easy',
    boosts:[{side:1, hp:1.75, pow:1, label:'Spirits: +75% HP, +1 PWR'}],
    blurb:'Two spirits in fox masks test Tanjiro before he can cut the boulder.',
    scene:[['','Mount Sagiri. Half a year of training, and the boulder still stands.'],
      ['sabito',"You're slow. Your body has learned everything, but you haven't."],
      ['tanjiro',"Then I'll fight you until I understand!"],
      ['sabito','Good. Show me.']]},
  {id:'selection', arc:'prologue', title:'Final Selection', place:'Mount Fujikasane', foe:'Hand Demon', mine:['tanjiro'], enemy:['hand','swamp'], level:'easy',
    boosts:[{side:1, pow:1, label:'Demons: +1 PWR'}],
    blurb:'Seven nights on a mountain full of demons. Survive them.',
    scene:[['','Wisteria blooms all year around the mountain. Inside, the demons wait.'],
      ['hand',"Another one of Urokodaki's brats. I remember every one I ate."],
      ['tanjiro',"Then you'll remember me too. As the last one!"]]},
  {id:'asakusa', arc:'asakusa', title:'Temari and Arrows', place:'Asakusa, Tokyo', foe:'Susamaru & Yahaba', mine:['tanjiro','nezuko','tamayo','yushiro'], enemy:['susamaru','yahaba'], level:'normal',
    boosts:[{side:1, hp:2.5, pow:4, label:'Demons: +150% HP, +4 PWR'}],
    blurb:'Muzan sends two demons after the doctor hiding from him.',
    scene:[['tamayo',"Muzan's hunters have found us. Forgive me for dragging you into this."],
      ['susamaru',"Let's play temari! Whoever drops the ball dies!"],
      ['yahaba',"The arrows show me everything. Your aim belongs to me."],
      ['yushiro',"Lady Tamayo, stay behind me. You, slayer, try to be useful."]]},
  {id:'flash_muzan', arc:'flashback', title:'The Sun Itself', place:'Four hundred years ago', foe:'Muzan & Tamayo', mine:['yoriichi'], enemy:['muzan','tamayo'], level:'normal',
    boosts:[{side:1, hp:1.25, label:'Muzan & Tamayo: +25% HP'}],
    blurb:'The only swordsman Muzan ever truly feared.',
    scene:[['','Four hundred years ago, on a quiet night road.'],
      ['muzan','A swordsman? Step aside before I lose my patience.'],
      ['yoriichi','What do you think the life of a person is?'],
      ['tamayo',"That man… Muzan is afraid. I've never seen him afraid."]]},
  {id:'tsuzumi', arc:'tsuzumi', title:'Tsuzumi Mansion', place:'The drum house', foe:'Kyogai', mine:['tanjiro','zenitsu','inosuke'], enemy:['kyogai','swamp','hand'], level:'easy',
    boosts:[{side:1, hp:2, pow:2, label:'Demons: +100% HP, +2 PWR'}],
    blurb:'Every drum beat turns the rooms upside down.',
    scene:[['zenitsu',"I can hear it! Something awful is in there! Let's go home!"],
      ['inosuke','Ha! Finally, something worth fighting!'],
      ['kyogai','My writing was not trash… This is MY house!'],
      ['tanjiro','Zenitsu, Inosuke, together!']]},
  {id:'natagumo', arc:'natagumo', title:'Spider Family', place:'Mount Natagumo', foe:'Rui', mine:['tanjiro','nezuko'], enemy:['rui','kyogai'], level:'normal',
    boosts:[{side:1, hp:2, pow:3, label:'Demons: +100% HP, +3 PWR'}],
    twist:{reinforce:[{id:'giyu', round:3}]},
    blurb:'A demon who wants a family, and threads that cut steel.',
    scene:[['rui',"You two have a real bond. I'll take it. Give me your sister."],
      ['tanjiro',"Nezuko is not a thing you can take!"],
      ['','Deep in the forest, another slayer is already running toward the threads.']]},
  {id:'mugen', arc:'mugen', title:'The Dream Train', place:'The Mugen Train', foe:'Enmu', mine:['tanjiro','zenitsu','inosuke','nezuko'], enemy:['enmu','swamp','hand'], level:'normal',
    boosts:[{side:1, hp:2.5, pow:3, label:'Demons: +150% HP, +3 PWR'}],
    blurb:'Wake up. Cut the dream, then cut the demon.',
    scene:[['enmu','Sleep. Have a lovely dream. Your family is waiting for you there.'],
      ['tanjiro',"This isn't real. My family is gone. I have to wake up!"],
      ['inosuke','The whole train is the demon! I knew it!'],
      ['','Two hundred passengers sleep on. Only the slayers can save them.']]},
  {id:'mugen_akaza', arc:'mugen', title:'Set Your Heart Ablaze', place:'Beside the derailed train', foe:'Akaza', mine:['rengoku','tanjiro','inosuke'], enemy:['akaza'], level:'hard',
    boosts:[{side:1, hp:2, pow:2, label:'Akaza: +100% HP, +2 PWR'}],
    twist:{survive:10},
    blurb:'Upper Moon Three arrives before dawn. Hold him until the sun rises.',
    scene:[['akaza','What a fighting spirit. Become a demon, Kyojuro, and fight me forever!'],
      ['rengoku','I will never become a demon. Tanjiro, Inosuke, stay back!'],
      ['','The sky to the east is still dark. Dawn is ten rounds away.']]},
  {id:'district', arc:'district', title:'Two as One', place:'Yoshiwara', foe:'Gyutaro & Daki', mine:['tengen','tanjiro','zenitsu','inosuke','nezuko'], enemy:['gyutaro','daki','hand'], level:'hard',
    boosts:[{side:1, pow:2, label:'Gyutaro & Daki: +2 PWR'}],
    blurb:'Two demons sharing one life. Cut both heads at the same time.',
    scene:[['daki',"How dare you look at me! Brother, they're bullying me!"],
      ['gyutaro',"Who made my sister cry? I'll take everything you have."],
      ['tengen','Listen up! Their heads have to fall at the same time. Let\'s make it flashy!']]},
  {id:'typezero', arc:'swordsmith', title:'Type Zero', place:'The hidden village', foe:'Yoriichi Type Zero', mine:['tanjiro','hotaru'], enemy:['typezero'], level:'normal',
    boosts:[{side:1, pow:1, label:'Yoriichi Type Zero: +1 PWR'}],
    blurb:'A six-armed training doll, built to copy the greatest swordsman.',
    scene:[['','Deep in the woods, a puppet with six arms waits for a challenger.'],
      ['tanjiro',"It moves like a real swordsman… Hotaru, my sword's still chipped!"],
      ['hotaru',"You CHIPPED it?! Fine. I'll reforge it. Then I'll kill you."]]},
  {id:'gyokko', arc:'swordsmith', title:'Pots and Mist', place:'The hidden village', foe:'Gyokko', mine:['muichiro_mark'], enemy:['gyokko','hand'], level:'normal',
    boosts:[{side:1, hp:1.25, pow:2, label:'Demons: +25% HP, +2 PWR'}],
    blurb:'Upper Moon Five and his pots against the Mist Hashira.',
    scene:[['gyokko','Admire my art! Every pot is a masterpiece!'],
      ['muichiro',"I don't care about pots. I'll forget you soon anyway."],
      ['gyokko','Forget ME?! I will drown you in my water prison!']]},
  {id:'swordsmith', arc:'swordsmith', title:'Splitting Emotions', place:'The hidden village', foe:'Hantengu', mine:['tanjiro_mark','genya','nezuko','mitsuri_mark'], enemy:['hantengu','gyokko'], level:'hard',
    boosts:[{side:1, hp:2.5, pow:1, label:'Upper Moons: +150% HP, +1 PWR'}],
    blurb:'Two Upper Moons at once. Cut Hantengu down and four more appear. Then they merge.',
    scene:[['hantengu',"Don't hurt me! I'm so weak! So very weak!"],
      ['genya',"Cut his head off and he splits? Then I'll eat them all!"],
      ['mitsuri',"I won't let anyone else get hurt. Leave the big one to me!"],
      ['','Two Upper Moons attack the village at once. Tanjiro and Mitsuri feel a strange heat: the Marks awaken.']]},
  {id:'flash_kokushibo', arc:'flashback', title:'Brothers', place:'Sixty years later', foe:'Kokushibo', mine:['yoriichi_old'], enemy:['kokushibo'], level:'hard',
    boosts:[{side:0, hp:1.3, label:'Still the strongest: Yoriichi +30% HP'}],
    blurb:'An old man, a demon, and the brother he never stopped chasing.',
    scene:[['','Decades pass. One night, a demon with six eyes meets an old man on the road.'],
      ['kokushibo','Yoriichi… You are old. You will die soon.'],
      ['yoriichi_old',"Brother. How sad. I'm here to cut you down."]]},
  {id:'nakime', arc:'castle', title:'The Shifting Floors', place:'Infinity Castle', foe:'Nakime', mine:['tanjiro','giyu','murata'], enemy:['nakime','hand','swamp','kyogai'], level:'normal',
    boosts:[{side:1, pow:4, label:'Castle demons: +4 PWR'}],
    blurb:'One strum of the biwa and the whole castle moves.',
    scene:[['','The floor drops away. The slayers fall into a castle with no end.'],
      ['nakime','*strum* The castle answers to me.'],
      ['murata',"Why am I always here?!"],
      ['giyu','Stay close. The demons here are hers to command.']]},
  {id:'doma1', arc:'castle', title:'Wisteria', place:'Infinity Castle, the lotus pond', foe:'Doma', mine:['shinobu'], enemy:['doma'], level:'hard',
    boosts:[{side:0, hp:1.4, label:"Shinobu's resolve: +40% HP"}],
    twist:{survive:3},
    blurb:'Part 1. Shinobu alone against the demon who killed her sister.',
    scene:[['doma',"A Kocho! You smell like the girl I ate. Your sister, wasn't she?"],
      ['shinobu',"Shall we be friends? No? Then hold still while I poison you."],
      ['','She only has to last. Every round Doma fights her, her poison goes deeper.']]},
  {id:'doma2', arc:'castle', title:'Petals of Futility', place:'Infinity Castle, the lotus pond', foe:'Doma', mine:['kanao','inosuke'], enemy:['doma'], level:'hard',
    boosts:[{side:1, hp:1.5, label:'Doma: +50% HP'}],
    start:{doma:{hp:.6, devoured:5}},
    blurb:"Part 2. Doma already ate Shinobu, and her body was full of poison.",
    scene:[['doma','Hm? My body… what did she do to me?'],
      ['kanao',"She made herself the poison. Now I decide for myself."],
      ['inosuke',"Let's finish him, Kanao! Beast Breathing!"],
      ['','Doma starts at 60% health and loses 5 HP every round.']]},
  {id:'kaigaku', arc:'castle', title:'Senior Brother', place:'Infinity Castle', foe:'Kaigaku', mine:['zenitsu'], enemy:['kaigaku'], level:'normal',
    boosts:[{side:0, pow:4, label:'Seventh Form: Zenitsu +4 PWR'}, {side:1, pow:1, label:'Kaigaku: +1 PWR'}],
    blurb:'Zenitsu faces the student who betrayed their master.',
    scene:[['kaigaku',"Still only one form, Zenitsu? Grandpa wasted his time on you."],
      ['zenitsu',"Grandpa cut his own belly because of you. I made a form of my own. For him."]]},
  {id:'akaza', arc:'castle', title:'Destructive Death', place:'Infinity Castle', foe:'Akaza', mine:['tanjiro','giyu'], enemy:['akaza'], level:'hard',
    blurb:"Tanjiro and Giyu against the demon who killed Rengoku.",
    scene:[['akaza','You again. The weakling from the train.'],
      ['tanjiro',"Rengoku didn't lose to you. He protected everyone. Now it's my turn."],
      ['giyu',"Together, Tanjiro."]]},
  {id:'kokushibo', arc:'castle', title:'Upper Moon One', place:'Infinity Castle, deep', foe:'Kokushibo', mine:['muichiro','genya'], enemy:['kokushibo'], level:'hard',
    boosts:[{side:1, hp:1.25, pow:4, label:'Kokushibo: +25% HP, +4 PWR'}],
    twist:{reinforce:[{id:'sanemi', round:3},{id:'gyomei', round:4}]},
    blurb:'The strongest demon after Muzan, once a slayer himself.',
    scene:[['kokushibo',"Mist… You are my descendant. Become a demon, like I did."],
      ['muichiro','Never.'],
      ['genya',"Hold on, Muichiro! My brother's coming, and Gyomei's right behind him!"]]},
  {id:'dawn', arc:'dawn', title:'Until Dawn', place:'The city streets', foe:'Muzan (Final Form)', mine:['tanjiro_mark','giyu_mark','obanai_mark','kanao'], enemy:['muzan_final'], level:'hard',
    boosts:[{side:1, hp:2.5, pow:4, label:'Muzan (Final Form): +150% HP, +4 PWR'}],
    twist:{survive:9},
    blurb:'The last fight. Hold him until the sun comes up.',
    scene:[['muzan_final','I am the closest thing to perfection. Why won\'t you just die?'],
      ['tanjiro','Everyone fought to get us here. Hold him! Just until the sun rises!'],
      ['','Dawn is nine rounds away.']]},
  {id:'epilogue', arc:'dawn', title:'Demon King', place:'The rising sun', foe:'Demon King Tanjiro', mine:['kanao','inosuke','zenitsu','giyu'], enemy:['tanjiro_demon'], level:'hard',
    boosts:[{side:1, hp:1.25, pow:1, label:'Demon King Tanjiro: +25% HP, +1 PWR'}],
    blurb:"Muzan's last trick: he poured himself into Tanjiro. Bring him back.",
    scene:[['tanjiro_demon',"Get away… I can't… stop…"],
      ['kanao',"Tanjiro! Shinobu left one more medicine. I just need to reach you!"],
      ['inosuke',"Wake up, Monjiro! Who's gonna be my rival?!"],
      ['zenitsu',"Nezuko's waiting for you! Come home!"]]},
];
const STORY_KEY = 'squad-draft-story';
function loadStory(){ try{ return JSON.parse(localStorage.getItem(STORY_KEY))||{cleared:[]} }catch(e){ return {cleared:[]} } }
function saveStoryClear(id){ const s=loadStory(); if(!s.cleared.includes(id)) s.cleared.push(id); try{ localStorage.setItem(STORY_KEY,JSON.stringify(s)) }catch(e){} }
const stageCleared = i => loadStory().cleared.includes(STAGES[i].id);
const stageUnlocked = i => i===0 || stageCleared(i-1) || stageCleared(i);
const stageLevel = () => STAGES[S.stage].level;
// Points for the draft replay: what the preset squad costs
const stageBudget = st => st.mine.reduce((a,id)=>a+BYID[id].cost,0);
// One line describing a stage's twist (shown on the stage card and the battle screen)
function twistText(st){
  const t=st.twist||{};
  if(t.survive) return `Survive ${t.survive} rounds`;
  if(t.reinforce) return t.reinforce.map(r=>`${BYID[r.id].short} arrives in round ${r.round}`).join(' · ');
  if(st.start) return 'Part 2: '+Object.keys(st.start).map(id=>`${BYID[id].short} starts hurt`).join(', ');
  return '';
}
// Draft replay pool: the Corps and its allies (no demons, no Legends), plus whoever is in this stage's preset squad
const STORY_ALLIES = ['nezuko','tamayo','yushiro'];
const storyCard = c => !c.spawn && !c.legend && (!c.demon || STORY_ALLIES.includes(c.fam));   // includes the back-pocket helpers
// Start a stage: the scene first, then the battle with the preset squad (or the draft, when replaying with draft)
function startStage(i, draft=false){
  const st=STAGES[i];
  Object.assign(S,{stage:i, storyDraft:draft, phase:'scene', sceneAt:0, budget:stageBudget(st), twist:st.twist||null, startState:st.start||null, boosts:st.boosts||null,
    first:0, lastPicker:null, history:[], k:0, sel:null});
  S.names=[S.names[0], st.foe];
}
// After the scene: fight with the preset squad, or draft your own
function beginStage(){
  const st=STAGES[S.stage];
  if(!S.storyDraft){
    S.picks=[st.mine.slice(), st.enemy.slice()]; S.locked=[true,true]; S.pool=[];
    return startBattle();
  }
  S.phase='draft'; S.picks=[[],st.enemy.slice()]; S.locked=[false,true];
  const fams=new Set(st.mine.map(id=>BYID[id].fam));
  S.pool=ROSTER.filter(c=>(storyCard(c) || fams.has(c.fam)) && !c.spawn && c.cost<=S.budget).map(c=>c.id)
    .sort((a,b)=>BYID[b].cost-BYID[a].cost || BYID[a].name.localeCompare(BYID[b].name));
}
