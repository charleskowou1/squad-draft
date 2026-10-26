/* ================= ROSTER =================
   Every character card. Stats here are the source of truth (the stats spreadsheet is generated from them). */
const ROSTER = [];
function add(c){ c.fam = c.fam || c.id; c.sk = c.sk || c.fam; ROSTER.push(c); return c; }
// Mark-awakened version of a character: its own card in the same family (only one version per draft pool)
function markOf(base, o){
  return add(Object.assign({}, base, {
    id: base.id+'_mark', name: base.name+' (Mark)', short: base.short+' ✦', mark:true, fam: base.fam, sk: base.sk,
    hp: base.hp+8, pow: base.pow+4, spd: base.spd+2, def: base.def+1,
    sig: Object.assign({}, base.sig, {cd: Math.max(1, base.sig.cd-1)})
  }, o));
}

// Legends
add({id:'yoriichi',name:'Yoriichi Tsugikuni',short:'Yoriichi',g:'陽',type:'Sun Breathing · Legend',legend:true,cost:18,hp:50,pow:15,spd:12,def:7,
  strikes:2,cap:18,
  passive:'Transparent World: strikes twice every Attack and never takes more than 18 damage in a round.',
  sig:{name:'Sun Breathing: Thirteenth Form',desc:'Every enemy takes PWR, ignores DEF. Demons it hits lose their regeneration for good.',cd:3,kind:'all'}});
add({id:'yoriichi_old',fam:'yoriichi',sk:'yoriichi_old',name:'Yoriichi (Age 85)',short:'Old Yoriichi',g:'老',type:'Sun Breathing · Legend',legend:true,cost:17,hp:50,pow:14,spd:11,def:5,
  strikes:2,cap:12,
  passive:'Still the Strongest: strikes twice every Attack and never takes more than 12 damage in a round.',
  sig:{name:'The Last Strike',desc:'Strike for PWR+10, ignores DEF.',cd:3,kind:'single'}});

// Demons
add({id:'muzan',name:'Muzan Kibutsuji',short:'Muzan',g:'鬼',type:'Demon King',demon:true,cost:16,hp:54,pow:17,spd:11,def:8,regen:4,
  sig:{name:'Blood Whips',desc:'Every enemy takes PWR−7, ignores DEF, and Muzan heals 2 for each enemy hit.',cd:3,kind:'all'}});
// Final-Form Muzan: the other version of Muzan (one or the other is dealt)
add({id:'muzan_final',fam:'muzan',sk:'muzan_final',name:'Muzan Kibutsuji (Final Form)',short:'Final Muzan',g:'終',type:'Demon King · Final Form',demon:true,cost:18,hp:52,pow:17,spd:11,def:8,regen:5,
  revive:.2,
  passive:'Seven Hearts: the first time he falls, he gets back up with 20% health.',
  sig:{name:'Thorned Flesh Whips',desc:'Every enemy takes PWR−6, ignores DEF, and he heals 3 for each enemy hit.',cd:3,kind:'all'}});
add({id:'kokushibo',name:'Kokushibo',short:'Kokushibo',g:'月',type:'Upper Moon 1',demon:true,upper:true,cost:15,hp:50,pow:17,spd:11,def:8,regen:3,
  sig:{name:'Moon Breathing',desc:'Every enemy takes PWR−4, ignores DEF.',cd:3,kind:'all'}});
add({id:'doma',name:'Doma',short:'Doma',g:'氷',type:'Upper Moon 2',demon:true,upper:true,cost:11,hp:44,pow:14,spd:11,def:6,regen:3,
  sig:{name:'Frozen Lotus',desc:'Every enemy takes PWR−4, ignores DEF.',cd:3,kind:'all'}});
add({id:'akaza',name:'Akaza',short:'Akaza',g:'拳',type:'Upper Moon 3',demon:true,upper:true,cost:9,hp:44,pow:13,spd:10,def:5,regen:2,
  sig:{name:'Destructive Death',desc:'Strike for PWR+6.',cd:3,kind:'single'}});
// Gyutaro and Daki: two cards. Together they're "Two as One" (see synergies() and fall() in engine.js).
add({id:'gyutaro',name:'Gyutaro',short:'Gyutaro',g:'鎌',type:'Upper Moon 6',demon:true,upper:true,cost:8,hp:40,pow:12,spd:9,def:5,regen:2,
  passive:'Two as One: with Daki on his team he gets +2 PWR. If one of them falls while the other is still standing, they get back up at the end of the round with 30% health (once each). Knock both out in the same round to stop it.',
  sig:{name:'Flying Blood Sickles',desc:'Every enemy takes 4 and is poisoned 2/round for 2 rounds.',cd:3,kind:'all'}});
add({id:'daki',name:'Daki',short:'Daki',g:'帯',type:'Upper Moon 6',demon:true,upper:true,cost:6,hp:30,pow:10,spd:9,def:4,regen:2,
  passive:'Two as One: with Gyutaro on her team, if one of them falls while the other is still standing, they get back up at the end of the round with 30% health (once each).',
  sig:{name:'Obi Sashes',desc:'Every enemy takes PWR−3.',cd:3,kind:'all'}});
// Nakime never attacks: her basic move (in place of Attack) is Biwa Strum. See resolve() in engine.js.
add({id:'nakime',name:'Nakime',short:'Nakime',g:'琵',type:'Upper Moon 4 · Infinity Castle',demon:true,upper:true,cost:4,hp:32,pow:0,spd:9,def:4,regen:2,
  basic:{name:'Biwa Strum',tag:'enemy acts last',desc:'Instead of attacking: pick an enemy. They act last this round. Always goes first.'},
  passive:"Biwa, not blade: she never attacks. Her basic move, Biwa Strum, makes an enemy act last this round. If she's the last one standing on her team, she flees and counts as knocked out.",
  sig:{name:'Castle Shift',desc:"Moves first. Sends an enemy to another room: they can't act and can't be hit this round.",cd:3,kind:'single',prio:3}});
add({id:'gyokko',name:'Gyokko',short:'Gyokko',g:'壺',type:'Upper Moon 5',demon:true,upper:true,cost:6,hp:32,pow:10,spd:8,def:4,regen:2,
  sig:{name:'Water Prison Pot',desc:'Traps one enemy: it takes PWR−2 (ignores DEF) and can\'t act next round.',cd:3,kind:'single'}});
// Hantengu splits when knocked out: Hantengu → all four emotions (Sekido, Karaku, Aizetsu, Urogi). When the last
// emotion falls they merge into Zohakuten (merge: the form that appears once every form with that merge is down).
// The split-off forms (spawn:true) are never dealt in the draft; they only appear in battle.
add({id:'hantengu',name:'Hantengu',short:'Hantengu',g:'怯',type:'Upper Moon 4',demon:true,upper:true,cost:9,hp:20,pow:8,spd:9,def:4,regen:1,
  splits:['sekido','karaku','aizetsu','urogi'],
  passive:'Splitting Emotions: when Hantengu falls he splits into his four emotions: Sekido, Karaku, Aizetsu and Urogi. When the last of them falls, they merge into Zohakuten. Beat him too to win.',
  sig:{name:'Cowering Hide',desc:'Moves first. Hides: attacks miss him this round, and he heals 6.',cd:3,kind:'self',prio:3}});
// Zohakuten: Hantengu's last form. The four emotions merge into him when the last one falls (never dealt).
add({id:'zohakuten',spawn:true,name:'Zohakuten (Hatred)',short:'Zohakuten',g:'憎',type:'Hantengu merged · Hatred',demon:true,cost:0,hp:24,pow:10,spd:9,def:4,regen:2,
  passive:"Hantengu's Hatred: the four emotions merged into one body.",
  sig:{name:'Wood Dragons',desc:'Every enemy takes PWR−4, even through Defend.',cd:3,kind:'all'}});
add({id:'sekido',spawn:true,name:'Sekido (Anger)',short:'Sekido',g:'怒',type:'Hantengu split · Anger',demon:true,cost:0,hp:8,pow:7,spd:8,def:3,regen:1,
  merge:'zohakuten',
  sig:{name:'Lightning Staff',desc:'Every enemy takes 4, ignores DEF.',cd:3,kind:'all'}});
add({id:'karaku',spawn:true,name:'Karaku (Joy)',short:'Karaku',g:'楽',type:'Hantengu split · Joy',demon:true,cost:0,hp:8,pow:7,spd:10,def:3,regen:1,
  merge:'zohakuten',
  sig:{name:'Gale Fan',desc:'Strike for PWR+3.',cd:2,kind:'single'}});
add({id:'aizetsu',spawn:true,name:'Aizetsu (Sorrow)',short:'Aizetsu',g:'哀',type:'Hantengu split · Sorrow',demon:true,cost:0,hp:6,pow:7,spd:9,def:3,regen:1,
  merge:'zohakuten',
  sig:{name:'Cross Spear',desc:'Strike for PWR+4.',cd:3,kind:'single'}});
add({id:'urogi',spawn:true,name:'Urogi (Pleasure)',short:'Urogi',g:'喜',type:'Hantengu split · Pleasure',demon:true,cost:0,hp:6,pow:6,spd:11,def:2,regen:1,
  merge:'zohakuten',
  sig:{name:'Sky Dive',desc:'Moves early. Swoops down for PWR+2.',cd:2,kind:'single',prio:1}});
add({id:'kaigaku',name:'Kaigaku',short:'Kaigaku',g:'獪',type:'Upper Moon 6 · fallen Thunder',demon:true,upper:true,cost:5,hp:26,pow:9,spd:10,def:3,regen:1,
  passive:'Rival: an enemy Zenitsu gets +2 PWR against him.',
  sig:{name:'Black Thunder',desc:'Strike for PWR+3, and a second random enemy takes 4.',cd:3,kind:'single'}});
add({id:'enmu',name:'Enmu',short:'Enmu',g:'夢',type:'Lower Moon 1',demon:true,cost:4,hp:28,pow:8,spd:8,def:3,regen:1,
  sig:{name:'Forced Sleep',desc:'Every enemy has to wait 2 more rounds for their special.',cd:3,kind:'all'}});
add({id:'rui',name:'Rui',short:'Rui',g:'糸',type:'Lower Moon 5',demon:true,cost:4,hp:24,pow:7,spd:7,def:4,regen:1,
  sig:{name:'Cutting Thread Cage',desc:'Strike for PWR and stun the target next round.',cd:3,kind:'single'}});
add({id:'kyogai',name:'Kyogai',short:'Kyogai',g:'鼓',type:'Former Lower Moon',demon:true,cost:3,hp:22,pow:6,spd:6,def:3,regen:1,
  sig:{name:'Drum Room Spin',desc:'Flip the room. The target is stunned next round.',cd:4,kind:'single'}});
add({id:'susamaru',name:'Susamaru',short:'Susamaru',g:'鞠',type:'Temari demon',demon:true,cost:3,hp:22,pow:7,spd:8,def:3,regen:1,
  passive:"Temari & Arrows: with Yahaba on her team, her hits slip past Defend.",
  sig:{name:'Temari Barrage',desc:'Strike your target and one other enemy for PWR−1.',cd:3,kind:'single'}});
add({id:'yahaba',name:'Yahaba',short:'Yahaba',g:'矢',type:'Arrow demon',demon:true,cost:4,hp:20,pow:6,spd:9,def:3,regen:1,
  passive:"Temari & Arrows: with Susamaru on his team, his arrows guide her hits past Defend.",
  sig:{name:'Vector Arrows',desc:"Moves first. Bends an enemy's aim: every hit they throw this round misses.",cd:3,kind:'single',prio:3}});
add({id:'hand',name:'Hand Demon',short:'Hand Demon',g:'手',type:'Final Selection',demon:true,cost:2,hp:14,pow:4,spd:4,def:3,regen:1,
  sig:{name:'Grasping Arms',desc:'Strike for PWR+3.',cd:2,kind:'single'}});
add({id:'swamp',name:'Swamp Demon',short:'Swamp Demon',g:'沼',type:'Lesser demon',demon:true,cost:3,hp:16,pow:5,spd:8,def:2,regen:1,
  sig:{name:'Swamp Dive',desc:'Moves early. Sinks out of reach this round and strikes for PWR+1.',cd:2,kind:'single',prio:1}});

// Hashira (+ Marks)
const giyu = add({id:'giyu',name:'Giyu Tomioka',short:'Giyu',g:'水',type:'Water Hashira',hashira:true,cost:8,hp:32,pow:10,spd:8,def:5,
  sig:{name:'Dead Calm',desc:'Moves first. Your whole team takes no damage this round.',cd:4,kind:'self',prio:3}});
markOf(giyu,{cost:10});
const gyomei = add({id:'gyomei',name:'Gyomei Himejima',short:'Gyomei',g:'岩',type:'Stone Hashira',hashira:true,cost:8,hp:42,pow:13,spd:8,def:7,
  sig:{name:'Volcanic Rock',desc:'Every enemy takes 9, ignoring DEF.',cd:3,kind:'all',dmg:9}});
markOf(gyomei,{cost:12, sig:Object.assign({}, gyomei.sig, {cd:2, dmg:11, desc:'Every enemy takes 11, ignoring DEF.'})});
const sanemi = add({id:'sanemi',name:'Sanemi Shinazugawa',short:'Sanemi',g:'風',type:'Wind Hashira',hashira:true,cost:6,hp:34,pow:11,spd:9,def:5,
  sig:{name:'Black Wind Mountain Mist',desc:'Strike your target and one other enemy for PWR.',cd:3,kind:'single'}});
markOf(sanemi,{cost:10});
const muichiro = add({id:'muichiro',name:'Muichiro Tokito',short:'Muichiro',g:'霞',type:'Mist Hashira',hashira:true,cost:6,hp:26,pow:10,spd:11,def:4,
  sig:{name:'Obscuring Clouds',desc:'Moves early. Vanishes into mist (attacks miss him this round) and strikes for PWR+2.',cd:3,kind:'single',prio:1}});
markOf(muichiro,{cost:10});
const mitsuri = add({id:'mitsuri',name:'Mitsuri Kanroji',short:'Mitsuri',g:'恋',type:'Love Hashira',hashira:true,cost:5,hp:28,pow:9,spd:9,def:4,
  sig:{name:'Catlove Shower',desc:'Every enemy takes PWR−3.',cd:3,kind:'all'}});
markOf(mitsuri,{cost:8});
const obanai = add({id:'obanai',name:'Obanai Iguro',short:'Obanai',g:'蛇',type:'Serpent Hashira',hashira:true,cost:5,hp:26,pow:9,spd:10,def:4,
  sig:{name:'Twin-Headed Reptile',desc:'Strike for PWR+4. Slips past guards (Defend does nothing).',cd:3,kind:'single'}});
markOf(obanai,{cost:8});
add({id:'rengoku',name:'Kyojuro Rengoku',short:'Rengoku',g:'炎',type:'Flame Hashira',hashira:true,cost:7,hp:38,pow:11,spd:9,def:5,
  sig:{name:'Ninth Form: Rengoku',desc:'Strike for PWR+8.',cd:3,kind:'single'}});
add({id:'tengen',name:'Tengen Uzui',short:'Tengen',g:'音',type:'Sound Hashira',hashira:true,cost:6,hp:34,pow:10,spd:10,def:5,
  sig:{name:'Constant Resounding Slashes',desc:'Every enemy takes PWR−2.',cd:3,kind:'all'}});
// Retired Tengen: the other version of Tengen (one or the other is dealt). Lost a hand and an eye, no longer a Hashira.
add({id:'tengen_retired',fam:'tengen',sk:'tengen_retired',name:'Tengen Uzui (Retired)',short:'Retired Tengen',g:'譜',type:'Former Sound Hashira',cost:4,hp:28,pow:8,spd:7,def:4,
  passive:'Retired: lost a hand and an eye, so he no longer counts as a Hashira.',
  sig:{name:'Bodyguard',desc:'Moves first. Shields an ally (or himself): they count as Defending this round and take half damage.',cd:2,kind:'ally',prio:3}});
add({id:'shinobu',name:'Shinobu Kocho',short:'Shinobu',g:'蟲',type:'Insect Hashira',hashira:true,cost:5,hp:24,pow:6,spd:10,def:3,
  passive:'Wisteria Body: if a demon lands the blow that knocks her out, it devours her and loses 5 HP every round for the rest of the match. (Not Akaza: he never eats women.)',
  sig:{name:'Wisteria Poison',desc:'Poison a target for 3 rounds: 6/round to demons, 3/round to humans.',cd:3,kind:'single'}});

// Main cast (+ Marks)
add({id:'kanae',name:'Kanae Kocho',short:'Kanae',g:'蝶',type:'Former Flower Hashira',cost:5,hp:28,pow:9,spd:9,def:4,
  passive:"Retired: she no longer counts as a Hashira. Kocho Sisters: with Shinobu on her team, Shinobu's poison lasts a round longer. Her student Kanao gets +1 PWR on her team.",
  sig:{name:'Crimson Hanagoromo',desc:'Strike for PWR+3, and your most hurt fighter heals 4.',cd:3,kind:'single'}});

const tanjiro = add({id:'tanjiro',name:'Tanjiro Kamado',short:'Tanjiro',g:'日',type:'Sun & Water',cost:5,hp:28,pow:8,spd:7,def:4,
  sig:{name:'Hinokami Kagura',desc:'Strike for PWR+5, ignores DEF.',cd:3,kind:'single'}});
markOf(tanjiro,{cost:8});
// Demon King Tanjiro: the third version of Tanjiro (base, Mark or this one is dealt). Rare, like Final Muzan.
add({id:'tanjiro_demon',fam:'tanjiro',sk:'tanjiro_demon',name:'Tanjiro Kamado (Demon King)',short:'Demon Tanjiro',g:'王',type:'Demon King · Sun-proof',demon:true,cost:17,hp:54,pow:18,spd:11,def:8,regen:4,
  sunproof:true,
  passive:"Sun-proof: Yoriichi's sun can't stop his regeneration. Still Tanjiro: Siblings, Kamaboko Squad and Mentor bonuses all apply.",
  sig:{name:"Demon King's Rampage",desc:'Every enemy takes PWR−4, ignores DEF.',cd:3,kind:'all'}});
add({id:'nezuko',name:'Nezuko Kamado',short:'Nezuko',g:'血',type:'Demon ally',demon:true,cost:4,hp:24,pow:7,spd:7,def:3,regen:1,
  sig:{name:'Exploding Blood',desc:'Every enemy takes 5, ignores DEF.',cd:3,kind:'all'}});
// Awakened Nezuko: the other version of Nezuko (one or the other is dealt)
add({id:'nezuko_awakened',fam:'nezuko',sk:'nezuko_awakened',name:'Nezuko Kamado (Awakened)',short:'Awakened Nezuko',g:'覚',type:'Demon ally · Awakened',demon:true,cost:9,hp:44,pow:12,spd:10,def:5,regen:3,
  noDefend:true,
  passive:"Berserk: she can't Defend.",
  sig:{name:'Exploding Blood',desc:'Every enemy takes 10, ignores DEF, and poison burns off your whole team.',cd:3,kind:'all'}});
add({id:'zenitsu',name:'Zenitsu Agatsuma',short:'Zenitsu',g:'雷',type:'Thunder',cost:4,hp:22,pow:7,spd:10,def:2,
  sig:{name:'Thunderclap and Flash',desc:'Always moves first. Strike for PWR×2.',cd:3,kind:'single',prio:2}});
add({id:'inosuke',name:'Inosuke Hashibira',short:'Inosuke',g:'獣',type:'Beast',cost:4,hp:28,pow:8,spd:8,def:3,
  sig:{name:'Fang Frenzy',desc:'Two wild strikes of PWR−1 at random enemies.',cd:2,kind:'auto'}});
add({id:'kanao',name:'Kanao Tsuyuri',short:'Kanao',g:'花',type:'Flower',cost:4,hp:24,pow:7,spd:10,def:3,
  sig:{name:'Equinoctial Vermilion Eye',desc:'Moves early. Strike for PWR+4.',cd:3,kind:'single',prio:1}});
add({id:'genya',name:'Genya Shinazugawa',short:'Genya',g:'銃',type:'Demon eater',cost:4,hp:30,pow:7,spd:7,def:3,
  sig:{name:'Demon Consumption',desc:'Heal 8 and gain +2 PWR for the rest of the match.',cd:3,kind:'self'}});
add({id:'tamayo',name:'Tamayo',short:'Tamayo',g:'薬',type:'Physician · Demon ally',demon:true,cost:3,hp:22,pow:5,spd:7,def:3,regen:2,
  passive:"Anti-Muzan Medicine: an enemy Muzan's regeneration drops by 2.",
  sig:{name:'Healing Blood Art',desc:'Heal an ally (or herself) for 10 and cure poison.',cd:2,kind:'ally'}});
add({id:'yushiro',name:'Yushiro',short:'Yushiro',g:'紙',type:'Tamayo\'s guardian · Demon ally',demon:true,cost:3,hp:20,pow:6,spd:9,def:3,regen:1,
  sig:{name:'Concealment Talisman',desc:'Moves first. Hide an ally (or himself): attacks against them miss this round.',cd:3,kind:'ally',prio:3}});
add({id:'sabito',name:'Sabito',short:'Sabito',g:'錆',type:'Spirit · Urokodaki\'s student',cost:4,hp:24,pow:7,spd:10,def:3,
  passive:"Urokodaki's student: he gets the Mentor bonus too.",
  sig:{name:'Spirit Training',desc:'Train an ally (or himself): +2 PWR for the rest of the match.',cd:3,kind:'ally'}});
add({id:'typezero',name:'Yoriichi Type Zero',short:'Type Zero',g:'傀',type:'Training puppet',cost:4,hp:28,pow:4,spd:8,def:4,strikes:3,
  passive:"Six Arms: strikes three times every Attack. Only a puppet: it doesn't count as Yoriichi, so Muzan isn't scared of it. Training partner: Muichiro gets +1 PWR on its team.",
  sig:{name:'Training Drill',desc:'Drill an ally (or itself): +2 SPD for the rest of the match.',cd:3,kind:'ally'}});
add({id:'urokodaki',name:'Sakonji Urokodaki',short:'Urokodaki',g:'師',type:'Former Water Hashira',cost:4,hp:26,pow:7,spd:7,def:4,
  passive:'Mentor: Tanjiro, Giyu and Sabito on his team get +1 DEF.',
  sig:{name:'Water Wheel',desc:'Strike for PWR+3.',cd:2,kind:'single'}});
add({id:'kagaya',name:'Kagaya Ubuyashiki',short:'Kagaya',g:'産',type:'Corps Master',cost:2,hp:14,pow:2,spd:5,def:1,
  passive:'Master of the Corps: every Hashira on his team gets +1 DEF.',
  sig:{name:'Words of Resolve',desc:'Every ally, himself included, heals 4.',cd:3,kind:'self'}});
add({id:'murata',name:'Murata',short:'Murata',g:'村',type:'Water · rank and file',cost:2,hp:10,pow:4,spd:6,def:2,
  passive:'Somehow Survives: the first hit that would knock him out leaves him at 1 HP instead.',
  sig:{name:'Water Surface Slash',desc:'Strike for PWR+2.',cd:2,kind:'single'}});

// Back-pocket helpers: 1 pt each, not fighters. They sit in your "back pocket" (no fighter slot, can't attack or be
// attacked); you choose a round to use each one, it acts first that round, then it leaves. Effects live in useHelper().
const MICE_PWR = 2;
add({id:'chachamaru',name:'Chachamaru',short:'Chachamaru',g:'猫',type:"Tamayo's cat · back-pocket helper",helper:true,cost:1,hp:1,pow:0,spd:0,def:0,
  sig:{name:'Medicine Delivery',desc:'Your most hurt fighter heals half of their current health (50% becomes 75%).',kind:'helper'}});
add({id:'crow',name:'Kasugai Crow',short:'Kasugai Crow',g:'烏',type:'Messenger crow · back-pocket helper',helper:true,cost:1,hp:1,pow:0,spd:0,def:0,
  sig:{name:'Scouting Report',desc:"After both sides lock in, the crow shows you the enemy's moves, and you can change yours before the round plays.",kind:'helper'}});
add({id:'mice',name:'Muscle Mice',short:'Muscle Mice',g:'鼠',type:"Tengen's mice · back-pocket helper",helper:true,cost:1,hp:1,pow:0,spd:0,def:0,
  sig:{name:'Flex!',desc:`Every fighter on your team gets +${MICE_PWR} PWR for this round.`,kind:'helper'}});
add({id:'hotaru',name:'Hotaru Haganezuka',short:'Hotaru',g:'鋼',type:'Swordsmith · back-pocket helper',helper:true,cost:1,hp:1,pow:0,spd:0,def:0,
  sig:{name:'Reforged Blade',desc:'Your fighter with the longest wait for their special gets it ready for next round.',kind:'helper'}});

// A few words shown under each fighter's Special button, like "hit one enemy" under Attack
const SPECIAL_TAGS = {
  yoriichi:'hit all, stops regen', yoriichi_old:'huge hit, ignores DEF',
  muzan:'hit all, heal self', muzan_final:'hit all, heal self', kokushibo:'hit all enemies', doma:'hit all enemies',
  akaza:'big hit', gyutaro:'hit all + poison', daki:'hit all enemies', nakime:'send an enemy away', zohakuten:'hit all, through Defend',
  susamaru:'hit two enemies', yahaba:"enemy's hits miss", kanae:'hit + heal ally', tanjiro_demon:'hit all enemies', nezuko_awakened:'hit all + cure poison',
  typezero:'ally +2 SPD', hotaru:'special ready next round', hantengu:'hide + heal self', gyokko:'hit + stun', kaigaku:'hit two enemies',
  sekido:'hit all enemies', karaku:'strong hit', aizetsu:'strong hit', urogi:'fast hit',
  enmu:'delay enemy specials', rui:'hit + stun', kyogai:'stun one enemy', hand:'strong hit', swamp:'dodge + hit',
  giyu:'team takes no damage', gyomei:'hit all enemies', sanemi:'hit two enemies', muichiro:'dodge + hit',
  mitsuri:'hit all enemies', obanai:'hit through Defend', rengoku:'huge hit', tengen:'hit all enemies',
  tengen_retired:'shield an ally', shinobu:'poison one enemy',
  tanjiro:'big hit, ignores DEF', nezuko:'hit all enemies', zenitsu:'first, double hit', inosuke:'2 random hits',
  kanao:'early strong hit', genya:'heal + PWR up', tamayo:'heal an ally', yushiro:'hide an ally',
  sabito:'ally +2 PWR', urokodaki:'strong hit', kagaya:'heal whole team', murata:'strong hit',
  chachamaru:'most hurt heals ½', crow:'see enemy moves', mice:`team +${MICE_PWR} PWR, 1 round`,
};
ROSTER.forEach(c=>{ c.sig.tag = SPECIAL_TAGS[c.sk]; });
// One short line each fighter says when their special fires (shown on the fight stage)
const SPECIAL_QUOTES = {
  yoriichi:'Sun Breathing has thirteen forms. This is the last.', yoriichi_old:'Even now, my sword has not dulled.',
  muzan:'I decide who lives.', muzan_final:'I will not die. Not to the sun, not to you.', kokushibo:'Moonlight, cut them down.',
  doma:'Let me save you all.', daki:'How dare you look at me like that!', nakime:'The castle answers to me.',
  zohakuten:'Why do you torment the weak?!', susamaru:"Let's play temari!", yahaba:'Your aim belongs to me now.',
  kanae:"I'd rather we didn't fight. But if we must…", tanjiro_demon:"I can't hear anyone anymore…", nezuko_awakened:'Grrrr!',
  typezero:'*clack clack clack*', hotaru:"You chipped my blade?! I'll end you!", akaza:'Become a demon and fight me forever!', gyutaro:'Take it all from them!',
  hantengu:'Don\'t hurt me! I\'m so weak!', gyokko:'Admire my art!', kaigaku:'I was the one meant to rise.',
  sekido:'Anger burns the field!', karaku:'Ha! Blow them away!', aizetsu:'How sad. How very sad.', urogi:'Such joy, from up here!',
  enmu:'Sleep. Have a lovely dream.', rui:'You\'re not my family.', kyogai:'My writing was not trash!', hand:'I remember every student.',
  swamp:'Into the swamp with you.', giyu:'Water Breathing, Eleventh Form.', gyomei:'Namu Amida Butsu.', sanemi:'Come on, then. Try me.',
  muichiro:'The mist hides everything.', mitsuri:'I won\'t let anyone else get hurt!', obanai:'No one touches Kanroji.',
  rengoku:'Set your heart ablaze!', tengen:'Let\'s make this flashy!', tengen_retired:'Retired or not, stay behind me.',
  shinobu:'Shall we be friends? No? Then poison.', tanjiro:'Dance of the Fire God!', nezuko:'Mmph!', zenitsu:'Thunder Breathing, First Form.',
  inosuke:'Beast Breathing! Charge!', kanao:'I decide for myself now.', genya:'Give me your strength, demon.', tamayo:'Hold still. This will help.',
  yushiro:'Lady Tamayo, look at me!', sabito:'Again. Swing again.', urokodaki:'Your judgment is too slow.', kagaya:'My children, thank you.',
  murata:'Why am I always here?!', chachamaru:'Mrrow.', crow:'Caw! Caw! Report!', mice:'*flexes*',
};
ROSTER.forEach(c=>{ c.sig.quote = SPECIAL_QUOTES[c.sk]; });

const BYID = Object.fromEntries(ROSTER.map(c=>[c.id,c]));
const MARK_PASSIVE = 'Mark awakened: boosted stats and the special recharges 1 round faster.';
