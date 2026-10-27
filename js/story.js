/* ================= STORY MODE =================
   21 battles following the arcs, plus two Yoriichi flashbacks. Each stage gives you a preset squad (the canon one)
   and opens with a short scene. Once cleared, a stage can be replayed drafting your own squad from the Corps and its
   allies, with the same points as the preset squad.
   After a win, a short ending scene (outro) plays, then any characters the battle unlocks are revealed.
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
// scene lines: [speaker card id, or '' for the narrator, text, options]; options: {img:'name'} shows the picture
//   img/scenes/<name>.jpg (or .png/.webp) for that line if the file exists; {awaken:true} plays the Mark awakening flash.
// awaken: [{id, at, round, lines}] — that fighter of yours becomes their Mark card at the end of a round once hurt to
//   `at` of their health or after round `round`, and `lines` play as a short cutscene before the next round.
const STAGES = [
  {id:'training', arc:'prologue', title:'The Boulder', place:'Mount Sagiri', foe:'Sabito', mine:['tanjiro'], enemy:['sabito'], level:'easy',
    stars:{standing:1, hp2:45, rounds:5},
    beats:[{when:'low', id:'tanjiro', at:.4, text:'Breathe. Feel the gap in his guard.'}, {when:'low', id:'sabito', at:.35, text:'That’s it. Again!'}],
    outro:[['sabito','You cut it. You really cut the boulder.',{img:'sabito-smile'}],['tanjiro','Sabito? …He’s gone.'],['','Tanjiro is ready for Final Selection.']],
    boosts:[{side:1, hp:1.4, label:'Sabito: +40% HP'}],
    blurb:'A boy in a fox mask tests Tanjiro before he can cut the boulder.',
    scene:[['','Mount Sagiri. Half a year of training, and the boulder still stands.'],
      ['sabito',"You're slow. Your body has learned everything, but you haven't."],
      ['tanjiro',"Then I'll fight you until I understand!"],
      ['sabito','Good. Show me.']]},
  {id:'selection', arc:'prologue', title:'Final Selection', place:'Mount Fujikasane', foe:'Hand Demon', mine:['tanjiro'], enemy:['hand','swamp'], level:'easy',
    stars:{standing:1, hp2:45, rounds:5},
    beats:[{when:'round', round:1, id:'tanjiro', text:'That one hides in the swamp when it dives. I’ll cut it when it comes back up.'}, {when:'low', id:'tanjiro', at:.35, text:'I can’t die here. Nezuko is waiting for me!'}],
    outro:[['hand','Those eyes… like Urokodaki’s…'],['tanjiro','Rest now. May you be reborn somewhere kinder.'],['','Tanjiro survives seven nights and joins the Demon Slayer Corps.']],
    boosts:[{side:0, hp:1.3, label:'Urokodaki’s training: Tanjiro +30% HP'}],
    blurb:'Seven nights on a mountain full of demons. Survive them.',
    scene:[['','Wisteria blooms all year around the mountain. Inside, the demons wait.'],
      ['hand',"Another one of Urokodaki's brats. I remember every one I ate."],
      ['tanjiro',"Then you'll remember me too. As the last one!"]]},
  {id:'asakusa', arc:'asakusa', title:'Temari and Arrows', place:'Asakusa, Tokyo', foe:'Susamaru & Yahaba', mine:['tanjiro','nezuko','tamayo','yushiro'], enemy:['susamaru','yahaba'], level:'normal',
    stars:{standing:3, rounds:4},
    boosts:[{side:1, hp:1.5, pow:4, label:'Demons: +50% HP, +4 PWR'}],
    beats:[{when:'low', id:'tamayo', at:.5, text:'I’m fine. Don’t let them reach me.'}, {when:'ko', id:'susamaru', who:'yahaba', text:'Susamaru?! Impossible…'}],
    twist:{protect:'tamayo'},
    outro:[['tamayo','Thank you. Take my blood research, and come back alive.'],['yushiro','Don’t get the wrong idea. I only helped because she told me to.']],
    blurb:'Muzan sends two demons after the doctor hiding from him.',
    scene:[['tamayo',"Muzan's hunters have found us. Forgive me for dragging you into this."],
      ['susamaru',"Let's play temari! Whoever drops the ball dies!"],
      ['yahaba',"The arrows show me everything. Your aim belongs to me."],
      ['yushiro',"Lady Tamayo, stay behind me. You, slayer, try to be useful."]]},
  {id:'tsuzumi', arc:'tsuzumi', title:'Tsuzumi Mansion', place:'The drum house', foe:'Kyogai', mine:['tanjiro','zenitsu','inosuke'], enemy:['kyogai','swamp','hand'], level:'easy',
    stars:{standing:2, rounds:9},
    beats:[{when:'low', id:'zenitsu', at:.4, text:'Zzz… Thunder Breathing… First Form…'}, {when:'round', round:2, id:'kyogai', text:'Every beat of my drum is a new room!'}],
    outro:[['kyogai','You stepped around my pages… you didn’t trample them.'],['tanjiro','Your writing was not trash.'],['zenitsu','Did I faint again? Who killed it?!']],
    boosts:[{side:1, hp:1.5, pow:1, label:'Demons: +50% HP, +1 PWR'}],
    blurb:'Every drum beat turns the rooms upside down.',
    scene:[['zenitsu',"I can hear it! Something awful is in there! Let's go home!"],
      ['inosuke','Ha! Finally, something worth fighting!'],
      ['kyogai','My writing was not trash… This is MY house!'],
      ['tanjiro','Zenitsu, Inosuke, together!']]},
  {id:'natagumo', arc:'natagumo', title:'Spider Family', place:'Mount Natagumo', foe:'Rui', mine:['tanjiro','nezuko'], enemy:['rui','kyogai'], level:'normal',
    stars:{standing:3, rounds:4},
    boosts:[{side:1, hp:1.25, pow:2, label:'Demons: +25% HP, +2 PWR'}],
    beats:[{when:'low', id:'nezuko', at:.5, text:'Mmph!'}, {when:'low', id:'tanjiro', at:.35, text:'Father… the Fire God dance…'}, {when:'round', round:3, id:'rui', text:'Who are you? You don’t belong to my family.'}],
    outro:[['giyu','Stand back.'],['rui','My… family…'],['','The Water Hashira arrives, and the spider family falls apart.']],
    twist:{reinforce:[{id:'giyu', round:3}], protect:'nezuko'},
    blurb:'A demon who wants a family, and threads that cut steel.',
    scene:[['rui',"You two have a real bond. I'll take it. Give me your sister."],
      ['tanjiro',"Nezuko is not a thing you can take!"],
      ['','Deep in the forest, another slayer is already running toward the threads.']]},
  {id:'mugen', arc:'mugen', title:'The Dream Train', place:'The Mugen Train', foe:'Enmu', mine:['tanjiro','zenitsu','inosuke','nezuko'], enemy:['enmu','swamp','hand'], level:'normal',
    stars:{standing:2, rounds:9},
    beats:[{when:'round', round:2, id:'enmu', text:'Isn’t the dream nicer? Go back to sleep.'}, {when:'low', id:'inosuke', at:.4, text:'You can’t eat me! I’m the king of the mountain!'}],
    outro:[['enmu','How can a dream be cut…?'],['inosuke','Ha! The train’s dead! Who’s the boss now?!'],['','Then the morning air turns cold. Something far stronger is coming.']],
    boosts:[{side:1, hp:2.5, pow:3, label:'Demons: +150% HP, +3 PWR'}],
    blurb:'Wake up. Cut the dream, then cut the demon.',
    scene:[['enmu','Sleep. Have a lovely dream. Your family is waiting for you there.'],
      ['tanjiro',"This isn't real. My family is gone. I have to wake up!"],
      ['inosuke','The whole train is the demon! I knew it!'],
      ['','Two hundred passengers sleep on. Only the slayers can save them.']]},
  {id:'mugen_akaza', arc:'mugen', title:'Set Your Heart Ablaze', place:'Beside the derailed train', foe:'Akaza', mine:['rengoku','tanjiro','inosuke'], enemy:['akaza'], level:'hard',
    stars:{standing:2, rounds:4},
    boosts:[{side:1, hp:1.5, pow:3, label:'Akaza: +50% HP, +3 PWR'}],
    beats:[{when:'low', id:'rengoku', at:.3, text:'Set your heart ablaze! I will not fall here!'}, {when:'ko', id:'rengoku', who:'tanjiro', text:'Rengoku!'}, {when:'round', round:6, id:'akaza', text:'The sky is getting lighter… I don’t have long.'}],
    phases:[{id:'akaza', at:.5, pow:2, ready:true, label:'+2 PWR, special ready', line:'Destructive Death: Annihilation Type!'}],
    outro:[['akaza','The sun! I have to go—',{img:'akaza-sunrise'}],
      ['tanjiro','Don’t run! Come back and fight, coward! He fought you all night and never once ran!',{img:'tanjiro-yelling'}],
      ['rengoku','Enough, Tanjiro. Don’t shout. Your wounds will open. Come here… there’s something I have to tell you.'],
      ['rengoku','I believe in your sister. She fought to protect the passengers too. She is one of the Corps.'],
      ['rengoku','Tanjiro… set your heart ablaze. Go on, with your head held high.',{img:'rengoku-heart'}],
      ['rengoku','Inosuke, Zenitsu, Tanjiro… you will grow strong. The next generation is yours to protect.']],
    twist:{survive:10},
    blurb:'Upper Moon Three arrives before dawn. Hold him until the sun rises.',
    scene:[['akaza','What a fighting spirit. Become a demon, Kyojuro, and fight me forever!'],
      ['rengoku','I will never become a demon. Tanjiro, Inosuke, stay back!'],
      ['','The sky to the east is still dark. Dawn is ten rounds away.']]},
  {id:'district', arc:'district', title:'Two as One', place:'Yoshiwara', foe:'Gyutaro & Daki', mine:['tengen','tanjiro','zenitsu','inosuke','nezuko'], enemy:['gyutaro','daki','hand'], level:'hard',
    stars:{standing:3, rounds:4},
    boosts:[{side:1, hp:1.7, pow:2, label:'Gyutaro & Daki: +70% HP, +2 PWR'}],   // tougher once Nezuko awakens (Oct 26, 2026)
    beats:[{when:'ko', id:'daki', who:'gyutaro', text:'Sister! Get back up!'}, {when:'low', id:'tengen', at:.35, text:'Flashy to the very end!'}],
    phases:[{id:'gyutaro', at:.4, pow:2, spd:1, label:'+2 PWR, +1 SPD', line:'You hurt my sister. Now I’ll rip you apart.'}],
    awaken:[{id:'tanjiro', at:.5, round:3, lines:[['','Gyutaro’s blood sickles close in. Tanjiro’s heart pounds like a war drum.'],
      ['tanjiro','I can’t lose here. Not with everyone counting on me!'],
      ['tanjiro_mark','My forehead is burning… and my body feels light. Hinokami Kagura!',{awaken:true}]]},
      {id:'nezuko', to:'nezuko_awakened', at:.6, round:2, lines:[['daki','Is that all? A demon who won’t even eat humans is nothing.'],
      ['tanjiro','Nezuko? Nezuko, what’s happening to you?!'],
      ['nezuko_awakened','Grrrrr…!',{awaken:'鬼'}]]}],
    outro:[['daki','Brother! It’s not fair!'],['gyutaro','Wherever you’re going, I’m going with you.'],['tengen','Flashy. Now let me sit down for a second.']],
    blurb:'Two demons sharing one life. Cut both heads at the same time.',
    scene:[['daki',"How dare you look at me! Brother, they're bullying me!"],
      ['gyutaro',"Who made my sister cry? I'll take everything you have."],
      ['tengen','Listen up! Their heads have to fall at the same time. Let\'s make it flashy!']]},
  {id:'typezero', arc:'swordsmith', title:'Type Zero', place:'The hidden village', foe:'Yoriichi Type Zero', mine:['tanjiro','hotaru'], enemy:['typezero'], level:'normal',
    stars:{standing:1, hp2:55, rounds:2},
    beats:[{when:'low', id:'tanjiro', at:.4, text:'It sees every opening… then I’ll make a new one!'}],
    outro:[['','The puppet cracks open. Inside: a sword centuries old.'],['hotaru','This blade… I’ll polish it. Now hand me yours.'],['tanjiro','Yes, Hotaru! …Please put the knife down.']],
    blurb:'A six-armed training doll, built to copy the greatest swordsman.',
    scene:[['','Deep in the woods, a puppet with six arms waits for a challenger.'],
      ['tanjiro',"It moves like a real swordsman… Hotaru, my sword's still chipped!"],
      ['hotaru',"You CHIPPED it?! Fine. I'll reforge it. Then I'll kill you."]]},
  {id:'gyokko', arc:'swordsmith', title:'Pots and Mist', place:'The hidden village', foe:'Gyokko', mine:['muichiro'], enemy:['gyokko'], level:'normal',
    awaken:[{id:'muichiro', round:1, lines:[['','Trapped in the water prison, Muichiro is running out of air.'],
      ['muichiro','Father… Brother… I remember now. I was never useless.'],
      ['muichiro_mark','Cloud-shaped marks spread across his face. The water prison bursts apart.',{awaken:true}]]}],
    stars:{standing:1, hp2:45, rounds:7},
    beats:[{when:'low', id:'gyokko', at:.5, text:'My true form! Behold my perfect body!'}],
    outro:[['gyokko','Impossible! My masterpiece!'],['muichiro','I remember now. My brother. Why I fight.']],
    boosts:[{side:1, hp:1.5, label:'Gyokko: +50% HP'}],
    blurb:'Upper Moon Five and his pots against the Mist Hashira.',
    scene:[['gyokko','Admire my art! Every pot is a masterpiece!'],
      ['muichiro',"I don't care about pots. I'll forget you soon anyway."],
      ['gyokko','Forget ME?! I will drown you in my water prison!']]},
  {id:'swordsmith', arc:'swordsmith', title:'Splitting Emotions', place:'The hidden village', foe:'Hantengu', mine:['tanjiro_mark','genya','nezuko','mitsuri'], enemy:['hantengu','gyokko'], level:'hard',
    awaken:[{id:'mitsuri', at:.75, round:1, lines:[['','The demons tear through the village. Mitsuri plants herself in front of everyone.'],
      ['mitsuri','Everyone believed in me… I won’t let them down!'],
      ['mitsuri_mark','A heart-shaped mark blooms on her neck. Love Breathing, full power!',{awaken:true}]]}],
    stars:{standing:2, rounds:12},
    beats:[{when:'ko', id:'hantengu', who:'tanjiro', text:'He split again?!'}, {when:'low', id:'nezuko', at:.4, text:'Mmph!!'}],
    outro:[['','Zohakuten falls, and the real Hantengu runs for the trees.'],['nezuko','Mmph!'],['tanjiro','Nezuko… you’re standing in the sun!']],
    boosts:[{side:1, hp:2.3, pow:1, label:'Upper Moons: +130% HP, +1 PWR'}],
    blurb:'Two Upper Moons at once. Cut Hantengu down and four more appear. Then they merge.',
    scene:[['hantengu',"Don't hurt me! I'm so weak! So very weak!"],
      ['genya',"Cut his head off and he splits? Then I'll eat them all!"],
      ['mitsuri',"I won't let anyone else get hurt. Leave the big one to me!"],
      ['','Two Upper Moons attack the village at once. The Mark on Tanjiro’s forehead is already burning.']]},
  {id:'nakime', arc:'castle', title:'The Shifting Floors', place:'Infinity Castle', foe:'Nakime', mine:['tanjiro','giyu','murata'], enemy:['nakime','hand','swamp','kyogai'], level:'normal',
    stars:{standing:2, rounds:5},
    beats:[{when:'round', round:2, id:'nakime', text:'*strum*'}, {when:'low', id:'murata', at:.5, text:'Why is it always me?!'}],
    outro:[['nakime','*the strings snap*'],['murata','We’re alive! I’m alive! Somehow!'],['giyu','Keep moving. The upper floors are worse.']],
    boosts:[{side:1, pow:4, label:'Castle demons: +4 PWR'}],
    blurb:'One strum of the biwa and the whole castle moves.',
    scene:[['','The floor drops away. The slayers fall into a castle with no end.'],
      ['nakime','*strum* The castle answers to me.'],
      ['murata',"Why am I always here?!"],
      ['giyu','Stay close. The demons here are hers to command.']]},
  {id:'doma1', arc:'castle', title:'Wisteria', place:'Infinity Castle, the lotus pond', foe:'Doma', mine:['shinobu'], enemy:['doma'], level:'hard',
    stars:{standing:1, hp2:10, health:20},
    beats:[{when:'low', id:'shinobu', at:.5, text:'Just a little longer. The poison is working.'}],
    outro:[['shinobu','Kanao… finish it. I’m counting on you.'],['','Doma swallows Shinobu whole. The wisteria inside her starts to work.']],
    boosts:[{side:0, hp:1.4, label:"Shinobu's resolve: +40% HP"}],
    twist:{survive:3},
    blurb:'Part 1. Shinobu alone against the demon who killed her sister.',
    scene:[['doma',"A Kocho! You smell like the girl I ate. Your sister, wasn't she?"],
      ['shinobu',"Shall we be friends? No? Then hold still while I poison you."],
      ['','She only has to last. Every round Doma fights her, her poison goes deeper.']]},
  {id:'doma2', arc:'castle', title:'Petals of Futility', place:'Infinity Castle, the lotus pond', foe:'Doma', mine:['kanao','inosuke'], enemy:['doma'], level:'hard',
    stars:{standing:2, rounds:3},
    beats:[{when:'low', id:'doma', at:.5, text:'My body is… melting? How interesting!'}],
    outro:[['doma','So this is what it feels like… to be in love?'],['kanao','Sister… Kanae… it’s over.'],['inosuke','…Mom.']],
    boosts:[{side:1, hp:1.5, label:'Doma: +50% HP'}],
    start:{doma:{hp:.6, devoured:5}},
    blurb:"Part 2. Doma already ate Shinobu, and her body was full of poison.",
    scene:[['doma','Hm? My body… what did she do to me?'],
      ['kanao',"She made herself the poison. Now I decide for myself."],
      ['inosuke',"Let's finish him, Kanao! Beast Breathing!"],
      ['','Doma starts at 60% health and loses 5 HP every round.']]},
  {id:'kaigaku', arc:'castle', title:'Senior Brother', place:'Infinity Castle', foe:'Kaigaku', mine:['zenitsu'], enemy:['kaigaku'], level:'normal',
    stars:{standing:1, hp2:50, rounds:2},
    beats:[{when:'low', id:'zenitsu', at:.5, text:'Grandpa… watch this. Seventh Form.'}],
    outro:[['kaigaku','Thunder… a form I never learned…'],['zenitsu','I wanted to fight beside you, you know.']],
    boosts:[{side:0, pow:4, label:'Seventh Form: Zenitsu +4 PWR'}, {side:1, pow:1, label:'Kaigaku: +1 PWR'}],
    blurb:'Zenitsu faces the student who betrayed their master.',
    scene:[['kaigaku',"Still only one form, Zenitsu? Grandpa wasted his time on you."],
      ['zenitsu',"Grandpa cut his own belly because of you. I made a form of my own. For him."]]},
  {id:'akaza', arc:'castle', title:'Destructive Death', place:'Infinity Castle', foe:'Akaza', mine:['tanjiro','giyu'], enemy:['akaza'], level:'hard',
    stars:{standing:1, hp2:15, rounds:10},
    boosts:[{side:1, hp:1.2, pow:1, label:'Akaza: +20% HP, +1 PWR'}],
    beats:[{when:'low', id:'akaza', at:.5, text:'Your spirit… it’s just like Kyojuro’s.'}, {when:'low', id:'giyu', at:.4, text:'Tanjiro, keep going. I’ll hold.'}],
    awaken:[{id:'giyu', at:.5, round:4, lines:[['','Akaza’s fists shatter the floor. Giyu takes a blow meant for Tanjiro.'],
      ['giyu','I was never worthy of being a Hashira… but I won’t let him die.'],
      ['giyu_mark','A wave-shaped mark rises on his cheek. Water Breathing, Eleventh Form: Dead Calm.',{awaken:true}]]}],
    outro:[['akaza','Koyuki… I remember now.'],['','Akaza ends himself, choosing his memories over strength.'],['tanjiro','Rengoku… we did it.']],
    blurb:"Tanjiro and Giyu against the demon who killed Rengoku.",
    scene:[['akaza','You again. The weakling from the train.'],
      ['tanjiro',"Rengoku didn't lose to you. He protected everyone. Now it's my turn."],
      ['giyu',"Together, Tanjiro."]]},
  {id:'flash_kokushibo', arc:'flashback', title:'Brothers', place:'Sixty years later', foe:'Kokushibo', mine:['yoriichi_old'], enemy:['kokushibo'], level:'hard',
    stars:{standing:1, hp2:25, rounds:3},
    beats:[{when:'low', id:'kokushibo', at:.5, text:'Even now… you are so far ahead of me.'}],
    outro:[['','Yoriichi dies standing, mid-swing. His last strike was enough.'],['kokushibo','Even at the very end… I could not surpass you.']],
    boosts:[{side:1, pow:4, label:'Kokushibo: +4 PWR'}],
    blurb:'An old man, a demon, and the brother he never stopped chasing.',
    scene:[['','Decades pass. One night, a demon with six eyes meets an old man on the road.'],
      ['kokushibo','Yoriichi… You are old. You will die soon.'],
      ['yoriichi_old',"Brother. How sad. I'm here to cut you down."]]},
  {id:'kokushibo', arc:'castle', title:'Upper Moon One', place:'Infinity Castle, deep', foe:'Kokushibo', mine:['muichiro','genya'], enemy:['kokushibo'], level:'hard',
    stars:{standing:2, rounds:7},
    boosts:[{side:1, hp:1.65, pow:5, label:'Kokushibo: +65% HP, +5 PWR'}],
    beats:[{when:'round', round:3, id:'sanemi', text:'Hands off my brother!'}, {when:'round', round:4, id:'gyomei', text:'Namu Amida Butsu. It ends here.'}],
    phases:[{id:'kokushibo', at:.5, pow:2, spd:1, ready:true, label:'+2 PWR, +1 SPD, special ready', line:'My blade grows. Moon Breathing, Sixteenth Form.'}],
    outro:[['kokushibo','What is this… monster I’ve become?'],['','Kokushibo crumbles. The Hashira who fought him gave everything.'],['sanemi','Genya… hang on.']],
    twist:{reinforce:[{id:'sanemi', round:3},{id:'gyomei', round:4}]},
    awaken:[{id:'muichiro', round:1, lines:[['muichiro_mark','My Mark is back. You won’t lay a finger on Genya.',{awaken:true}]]},
      {id:'sanemi', round:5, lines:[['','Kokushibo’s moon blades fill the hall. The Hashira are pushed to the edge.'],
        ['sanemi_mark','So this is the Mark. Good. Now I can keep up with you, monster!',{awaken:true}]]},
      {id:'gyomei', round:5, lines:[['gyomei_mark','Namu Amida Butsu. The Mark has come. I will carry it to the end.',{awaken:true}]]}],
    blurb:'The strongest demon after Muzan, once a slayer himself.',
    scene:[['kokushibo',"Mist… You are my descendant. Become a demon, like I did."],
      ['muichiro','Never.'],
      ['genya',"Hold on, Muichiro! My brother's coming, and Gyomei's right behind him!"]]},
  {id:'flash_muzan', arc:'flashback', title:'The Sun Itself', place:'Four hundred years ago', foe:'Muzan & Tamayo', mine:['yoriichi'], enemy:['muzan','tamayo'], level:'normal',
    stars:{standing:1, hp2:10, rounds:5},
    beats:[{when:'low', id:'muzan', at:.5, text:'Impossible… what IS this man?!'}],
    outro:[['muzan','That man… he will haunt me for centuries.'],['','Muzan shatters into pieces and flees. Yoriichi lets Tamayo go.'],['tamayo','I will spend my life finishing what he started.']],
    boosts:[{side:1, hp:1.25, label:'Muzan & Tamayo: +25% HP'}],
    blurb:'The only swordsman Muzan ever truly feared.',
    scene:[['','Four hundred years ago, on a quiet night road.'],
      ['muzan','A swordsman? Step aside before I lose my patience.'],
      ['yoriichi','What do you think the life of a person is?'],
      ['tamayo',"That man… Muzan is afraid. I've never seen him afraid."]]},
  {id:'dawn', arc:'dawn', title:'Until Dawn', place:'The city streets', foe:'Muzan (Final Form)', mine:['tanjiro_mark','giyu_mark','obanai_mark','kanao'], enemy:['muzan_final'], level:'hard',
    stars:{standing:2, health:30},
    boosts:[{side:1, hp:3.5, pow:4, label:'Muzan (Final Form): +250% HP, +4 PWR'}],
    beats:[{when:'round', round:5, id:'tanjiro', text:'Hold on! The sky is getting lighter!'}, {when:'low', id:'giyu_mark', at:.35, text:'Don’t stop. Not now.'}],
    phases:[{id:'muzan_final', at:.5, pow:3, ready:true, label:'+3 PWR, special ready', line:'Enough! I will destroy all of you before the sun!'}],
    outro:[['muzan_final','The sun… no… NO—'],['','The sun rises. Muzan Kibutsuji is gone.'],['tanjiro','It’s over… everyone…']],
    twist:{survive:9}, sunrise:true,   // the battle screen's sun rises round by round (app.js)
    blurb:'The last fight. Hold him until the sun comes up.',
    scene:[['muzan_final','I am the closest thing to perfection. Why won\'t you just die?'],
      ['tanjiro','Everyone fought to get us here. Hold him! Just until the sun rises!'],
      ['','Dawn is nine rounds away.']]},
  {id:'epilogue', arc:'dawn', title:'Demon King', place:'The rising sun', foe:'Demon King Tanjiro', mine:['kanao','inosuke','zenitsu','giyu'], enemy:['tanjiro_demon'], level:'hard',
    stars:{standing:2, rounds:4},
    beats:[{when:'low', id:'kanao', at:.5, text:'Tanjiro, it’s me! Come back!'}, {when:'round', round:3, id:'inosuke', text:'Monjiro! Snap out of it!'}],
    phases:[{id:'tanjiro_demon', at:.3, pow:1, label:'+1 PWR', line:'Get… away… from me…'}],
    outro:[['kanao','Tanjiro, come back!'],['tanjiro','…Kanao? Nezuko? I’m… home.'],['','The sun rises on the Demon Slayer Corps. Their war is over.']],
    blurb:"Muzan's last trick: he poured himself into Tanjiro. Bring him back.",
    scene:[['muzan_final','You think you’ve won, boy? The sun can take my body. It will never take my will.'],
      ['tanjiro','Muzan…? Get out… What are you doing to me?!'],
      ['muzan_final','I give you everything. My blood. My power. My dream. Tanjiro… become the King of Demons.'],
      ['tanjiro','No… I won’t… I won’t become you…'],
      ['tanjiro_demon','GRAAAAH!',{awaken:'王'}],
      ['tanjiro_demon',"Get away… I can't… stop…"],
      ['kanao',"Tanjiro! Shinobu left one more medicine. I just need to reach you!"],
      ['inosuke',"Wake up, Monjiro! Who's gonna be my rival?!"],
      ['zenitsu',"Nezuko's waiting for you! Come home!"]]},
];
// Story progress. CK reset everyone to 0 on Oct 26, 2026 (new key; the old 'squad-draft-story' is deleted on load).
// From here on progress is kept: don't change this key again unless CK asks for another reset.
const STORY_KEY = 'squad-draft-story-v2';   // {cleared:[ids], stars:{id: best stars 1–3}}
try{ localStorage.removeItem('squad-draft-story') }catch(e){}
function loadStory(){ try{ return JSON.parse(localStorage.getItem(STORY_KEY))||{cleared:[]} }catch(e){ return {cleared:[]} } }
// Stars: ★ win, ★★ win with at least `standing` fighters still up (or team health above `hp2`%), ★★★ win within `rounds` rounds (or, on some survive
// stages, with your team above `health`% at the end). Targets come from simulated strong-player wins (CLAUDE.md).
// ★★ is "fighters standing" where that means something; on solo battles (and wherever 1 fighter standing is all a win
// needs) it's "team above hp2% health" instead, so it's never the same as just winning (CK spotted that).
function starGoals(st){ const g=st.stars||{standing:1};
  return ['Win', g.hp2?`Win with your team above ${g.hp2}% health`:`Win with ${g.standing}+ fighters standing`,
    g.rounds?`Win within ${g.rounds} rounds`:`Finish with your team above ${g.health}% health`]; }
// The three star goals are separate (one star each): which ones the battle just finished met
function goalsMet(st){
  if(S.winner!==0) return [false,false,false]; const g=st.stars||{standing:1}, mine=S.teams[0].filter(u=>!u.spawn);
  const up=mine.filter(u=>u.alive).length, hp=mine.reduce((a,u)=>a+Math.max(0,u.hp),0)/mine.reduce((a,u)=>a+u.max,0)*100;
  return [true, g.hp2 ? hp>=g.hp2 : up>=g.standing, g.rounds ? S.round<=g.rounds && !S.survived : hp>=g.health];
}
const starsEarned = st => goalsMet(st).filter(Boolean).length;
// Goals met in any win of this battle (they add up across replays). Saves from before Oct 26, 2026 only kept a count:
// those count as the first goals.
function goalsGot(id){ const s=loadStory(), g=(s.goals||{})[id], n=(s.stars||{})[id]||0; return [0,1,2].map(k=>!!(g&&g[k]) || (!g && k<n)); }
const stageStars = id => goalsGot(id).filter(Boolean).length;
const totalStars = () => STAGES.reduce((a,st)=>a+stageStars(st.id),0);
function saveStars(id,met){ const had=goalsGot(id), s=loadStory(); s.goals=s.goals||{}; s.stars=s.stars||{};
  s.goals[id]=had.map((x,k)=>x||!!met[k]); s.stars[id]=s.goals[id].filter(Boolean).length; try{ localStorage.setItem(STORY_KEY,JSON.stringify(s)) }catch(e){} }
const storyWon = () => loadStory().cleared.filter(id=>STAGES.some(s=>s.id===id)).length;
function saveStoryClear(id){ const s=loadStory(); if(!s.cleared.includes(id)) s.cleared.push(id); try{ localStorage.setItem(STORY_KEY,JSON.stringify(s)) }catch(e){} }
const stageCleared = i => loadStory().cleared.includes(STAGES[i].id);
const stageUnlocked = i => i===0 || stageCleared(i-1) || stageCleared(i);
// The battle to play next: the first unlocked one not won yet (or the last one)
const nextStage = () => { const i=STAGES.findIndex((st,k)=>stageUnlocked(k) && !stageCleared(k)); return i<0 ? STAGES.length-1 : i; };
const stageLevel = () => STAGES[S.stage].level;
// Points for the draft replay: what the preset squad costs
const stageBudget = st => st.mine.reduce((a,id)=>a+BYID[id].cost,0);
// One line describing a stage's twist (shown on the stage card and the battle screen)
function twistText(st){
  const t=st.twist||{}, out=[];
  if(t.survive) out.push(`Survive ${t.survive} rounds`);
  if(t.protect) out.push(`Protect ${BYID[t.protect].short}: lose if they fall`);
  if(t.reinforce) out.push(...t.reinforce.map(r=>`${BYID[r.id].short} arrives in round ${r.round}`));
  if(st.start) out.push('Part 2: '+Object.keys(st.start).map(id=>`${BYID[id].short} starts hurt`).join(', '));
  (st.phases||[]).forEach(ph=>out.push(`Boss: ${BYID[ph.id].short} powers up at ${Math.round(ph.at*100)}%`));
  return out.join(' · ');
}
// Draft replay pool: the Corps and its allies (no demons, no Legends), plus whoever is in this stage's preset squad
// Start a stage: the scene first, then the battle with the preset squad (or the draft, when replaying with draft)
function startStage(i, draft=false){
  const st=STAGES[i];
  Object.assign(S,{stage:i, storyDraft:draft, phase:'scene', sceneAt:0, sceneVs:false, sceneMid:false, sceneOutro:false, showTheirs:false, awaken:st.awaken||null, n:2, maxTeam:MAXTEAM, budget:stageBudget(st), twist:st.twist||null, startState:st.start||null, boosts:st.boosts||null, phases:st.phases||null, beats:st.beats||null,
    first:0, lastPicker:null, history:[], k:0, sel:null});
  S.names=[S.names[0], st.foe];
}
// The lines of the scene being shown: the opening, or the ending after a win
// The story's finale (after beating Demon King Tanjiro, "Finish the story" on the win screen), then the end credits
const FINALE = [
  ['kanao','Tanjiro… you’re back. You’re really back.'],
  ['tanjiro','Kanao… everyone… I’m sorry. I’m so sorry I hurt you.'],
  ['inosuke','Hmph! Took you long enough, Monjiro! I almost won our rivalry by default!'],
  ['zenitsu','Don’t ever scare us like that again! I cried so much I’m all dried out!'],
  ['nezuko','Big brother… welcome home.'],
  ['giyu','Tanjiro. You did well. All of you did.'],
  ['sanemi','Tch. Don’t get used to hearing it from me… but you earned your rest.'],
  ['kiriya','Everyone. On behalf of the Ubuyashiki family… thank you.'],
  ['kiriya','Muzan Kibutsuji is gone. With no demons left to hunt, the Demon Slayer Corps is disbanded as of today.'],
  ['kiriya','Giyu. Sanemi. You are the last of the Hashira. Your duty is done. Please… go and live.'],
  ['sanemi','Live, huh… Genya would’ve wanted that. Fine. I’ll live.'],
  ['giyu','Then I’ll live for the ones who couldn’t. For Sabito. For all of them.'],
  ['urokodaki','Giyu. Tanjiro. My boys came home.'],
  ['tengen_retired','Ha! Now THAT was a flashy ending! You kids really did it!'],
  ['tanjiro','Nezuko, Zenitsu, Inosuke… let’s go home. Back to the mountain.'],
  ['nezuko','Let’s light the stove again. Just like before.'],
  ['zenitsu','Nezuko, I’ll chop all the firewood! Every day! Forever!'],
  ['inosuke','And I’ll eat all the food! Every day! Forever!'],
  ['kanao','Tanjiro… may I come and visit?'],
  ['tanjiro','Any day you want, Kanao. The door’s always open.'],
  ['tanjiro','Mother. Father. Everyone. We did it. The sun is shining… and we’re home.'],
];
const FINALE_SURVIVORS = ['tanjiro','nezuko','zenitsu','inosuke','kanao','giyu','sanemi','kiriya','urokodaki','tengen_retired','murata','yushiro'];
const FINALE_FALLEN = ['Kagaya Ubuyashiki','Kyojuro Rengoku','Shinobu Kocho','Mitsuri Kanroji','Obanai Iguro','Muichiro Tokito','Gyomei Himejima','Genya Shinazugawa','Kanae Kocho','Sabito','Tamayo'];
const sceneLines = () => S.sceneFinale ? FINALE : S.sceneMid ? S.midScene||[] : S.sceneOutro ? STAGES[S.stage].outro : STAGES[S.stage].scene;
// Every scene picture any stage asks for (app.js looks for the files at startup)
const scenePics = () => [...new Set(STAGES.flatMap(st=>[...(st.scene||[]), ...(st.outro||[]), ...(st.awaken||[]).flatMap(a=>a.lines||[])])
  .map(l=>l[2]&&l[2].img).filter(Boolean))];
// Which side of the scene a speaker stands on: your squad on the left, the enemy on the right
const sceneSide = (st, id) => st.enemy.some(e=>BYID[e].fam===BYID[id].fam) && !st.mine.includes(id) ? 'r' : 'l';
// After the scene: fight with the preset squad, or draft your own
function beginStage(){
  const st=STAGES[S.stage];
  if(!S.storyDraft){
    S.picks=[st.mine.slice(), st.enemy.slice()]; S.locked=[true,true]; S.pool=[];
    return startBattle();
  }
  S.phase='draft'; S.picks=[[],st.enemy.slice()]; S.locked=[false,true];
  // Draft replay: every character within the points except the ones you're fighting (any version of them), from your
  // unlocked characters plus the battle's own squad (CK, Oct 26, 2026; it used to be Corps and allies only)
  const fams=new Set(st.mine.map(id=>BYID[id].fam)), foes=new Set(st.enemy.map(id=>BYID[id].fam));
  S.pool=ROSTER.filter(c=>!c.spawn && !c.helper && c.cost<=S.budget && !foes.has(c.fam) && (isUnlocked(c.id) || fams.has(c.fam))).map(c=>c.id)
    .sort((a,b)=>BYID[b].cost-BYID[a].cost || BYID[a].name.localeCompare(BYID[b].name)).concat(dealHelpers());
}

/* ---------- unlocks ----------
   Winning a story battle unlocks the characters it introduces for every other mode (Local, Online, Quickplay,
   Practice, the daily challenge). Starting roster: the Corps' base slayers and allies (Nezuko, Tamayo, Yushiro),
   the small demons (Hand Demon, Swamp Demon) and the back-pocket helpers. Locked until the story reaches them:
   every other demon, every Mark ✦ version, the Legends and the alternate versions. */
const STARTER_DEMONS = ['nezuko','tamayo','yushiro','hand','swamp'];
const lockable = c => !c.helper && !c.spawn && ((c.demon && !STARTER_DEMONS.includes(c.id)) || c.mark || c.legend || c.id!==c.fam || c.id==='typezero');
// Extra unlocks that never fight in a story battle themselves, tied to the battle where they belong in canon
const UNLOCK_EXTRAS = {district:['tengen_retired'], kokushibo:['sanemi_mark','gyomei_mark']};
// Cards that unlock at a later battle than their first appearance (Doma: when Kanao and Inosuke finish him, not when he beats Shinobu)
const UNLOCK_AT = {doma:'doma2'};
// stage id → the card ids winning it unlocks (each card is unlocked by the first battle it appears in)
const STAGE_UNLOCKS = (()=>{ const seen=new Set(), out={};
  STAGES.forEach(st=>{ const ids=[...st.mine, ...st.enemy, ...((st.twist||{}).reinforce||[]).map(r=>r.id), ...(st.awaken||[]).map(a=>a.to||a.id+'_mark'), ...(UNLOCK_EXTRAS[st.id]||[])];
    out[st.id]=[...new Set(ids)].filter(id=>BYID[id] && lockable(BYID[id]) && !seen.has(id) && (!UNLOCK_AT[id] || UNLOCK_AT[id]===st.id)); out[st.id].forEach(id=>seen.add(id)); });
  return out; })();
// Lockable cards that no battle unlocks start unlocked
const UNLOCKED_FROM_STORY = new Set(Object.values(STAGE_UNLOCKS).flat());
function isUnlocked(id){
  const c=BYID[id]; if(!c || !UNLOCKED_FROM_STORY.has(id)) return true;
  const won=loadStory().cleared; return STAGES.some(st=>won.includes(st.id) && STAGE_UNLOCKS[st.id].includes(id));
}
// Which story battle unlocks a card (for the Codex and locked cards), or null
const unlockStage = id => STAGES.findIndex(st=>STAGE_UNLOCKS[st.id].includes(id));
