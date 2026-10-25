/* ================= SOUND =================
   Battle sound effects, made on the fly with the Web Audio API (no audio files). On by default; switch off in
   Settings. Phones only allow sound after a tap, so the audio starts on the first tap (unlockSound in app.js). */
const SOUND_KEY = 'squad-draft-sound';
function loadSoundOn(){ try{ return localStorage.getItem(SOUND_KEY)!=='off' }catch(e){ return true } }
function saveSoundOn(on){ try{ localStorage.setItem(SOUND_KEY, on?'on':'off') }catch(e){} }
let AC = null, NOISE = null;
function unlockSound(){
  if(AC || typeof AudioContext==='undefined' && typeof webkitAudioContext==='undefined') return;
  AC = new (window.AudioContext || window.webkitAudioContext)();
  NOISE = AC.createBuffer(1, AC.sampleRate, AC.sampleRate);
  const d=NOISE.getChannelData(0); for(let i=0;i<d.length;i++) d[i]=Math.random()*2-1;
}
// one tone: type, start/end frequency (Hz), length (s), volume, delay (s)
function tone(type, f0, f1, len, vol=.25, at=0){
  const t=AC.currentTime+at, o=AC.createOscillator(), g=AC.createGain();
  o.type=type; o.frequency.setValueAtTime(f0,t); o.frequency.exponentialRampToValueAtTime(Math.max(1,f1),t+len);
  g.gain.setValueAtTime(vol,t); g.gain.exponentialRampToValueAtTime(.001,t+len);
  o.connect(g).connect(AC.destination); o.start(t); o.stop(t+len+.02);
}
// a burst of filtered noise: filter type, start/end frequency, length, volume, delay
function hiss(filter, f0, f1, len, vol=.3, at=0){
  const t=AC.currentTime+at, src=AC.createBufferSource(), bq=AC.createBiquadFilter(), g=AC.createGain();
  src.buffer=NOISE; bq.type=filter; bq.Q.value=1.2;
  bq.frequency.setValueAtTime(f0,t); bq.frequency.exponentialRampToValueAtTime(Math.max(20,f1),t+len);
  g.gain.setValueAtTime(vol,t); g.gain.exponentialRampToValueAtTime(.001,t+len);
  src.connect(bq).connect(g).connect(AC.destination); src.start(t); src.stop(t+len+.02);
}
const SFX = {
  slash(){ hiss('bandpass',5200,700,.2,.35,.22); tone('sine',150,55,.18,.35,.3); },          // timed with the lunge
  bighit(){ hiss('bandpass',4800,500,.25,.4,.22); tone('sine',110,35,.4,.5,.3); hiss('lowpass',900,80,.4,.35,.3); },
  ko(){ tone('sine',90,28,.8,.55,.3); hiss('lowpass',1200,60,.7,.4,.3); tone('triangle',220,110,.5,.15,.45); },
  miss(){ hiss('highpass',2500,6000,.25,.18,.2); },
  block(){ tone('triangle',900,700,.25,.2,.25); tone('triangle',1350,1100,.2,.12,.27); },
  heal(){ tone('sine',660,660,.35,.16,.1); tone('sine',990,990,.4,.14,.22); tone('sine',1320,1320,.45,.1,.34); },
  guard(){ tone('triangle',520,520,.3,.16,.1); tone('sine',780,780,.35,.1,.15); },
  poison(){ tone('sawtooth',180,120,.5,.06,.15); hiss('bandpass',600,300,.4,.12,.15); },
  stun(){ tone('sine',700,350,.35,.12,.1); tone('sine',600,300,.35,.1,.3); },
  special(){ tone('sawtooth',160,820,.45,.08,0); hiss('bandpass',800,4000,.45,.15,0); tone('sine',1200,1200,.3,.08,.4); },
  spawn(){ tone('square',300,600,.2,.06,.1); tone('square',450,900,.2,.06,.25); },
  gong(){ tone('sine',196,190,1.4,.35); tone('sine',392,380,1.1,.12); tone('triangle',588,570,.8,.06); },
  tick(){ tone('square',1800,1700,.03,.05); },
  ding(){ tone('sine',1046,1046,.6,.2); tone('sine',1568,1568,.5,.1,.05); },
  pick(){ tone('sine',520,780,.12,.12); },
  win(){ [523,659,784,1046].forEach((f,i)=>tone('triangle',f,f,.35,.18,i*.14)); tone('sine',1046,1046,.9,.14,.56); },
  lose(){ [392,330,262].forEach((f,i)=>tone('triangle',f,f*.98,.45,.16,i*.22)); },
};
function sfx(name){ if(!S.soundOn || !AC) return; try{ if(AC.state==='suspended') AC.resume(); SFX[name] && SFX[name](); }catch(e){} }
// The sound for one playback line
function sfxForLine(line){
  if(line.c==='r') return sfx('gong');
  const big=/\[-(\d+)%\]/.exec(line.t), hard=big && +big[1]>=30;
  sfx({hit:hard?'bighit':'slash', ko:'ko', miss:'miss', block:'block', heal:'heal', revive:'heal', buff:'heal', guard:'guard',
    poison:'poison', stun:'stun', special:'special', burn:'bighit', spawn:'spawn'}[line.fx]);
}
