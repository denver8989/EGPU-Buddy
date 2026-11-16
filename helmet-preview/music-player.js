(()=>{
const key=CONFIG.name==='EGPU Buddy'?'egpu':'nv';
const options=[{"key": "scifi", "label": "SciFi — Bensound"}, {"key": "retro", "label": "Retro Chiptune Adventure — Nick Panek"}, {"key": "swing", "label": "Night Walk — Electro Swing"}, {"key": "gorila", "label": "Gorila — Alex MakeMusic"}, {"key": "ultraviolet", "label": "Ultraviolet — S Deion"}, {"key": "upbeat", "label": "Fun Upbeat — Jonas Blakewood"}];
let selected='scifi';try{selected=localStorage.getItem('egpu-helmet-music')||selected}catch{}
if(!options.some(o=>o.key===selected))selected='scifi';
const label=document.createElement('label');label.textContent='Background music ';const select=document.createElement('select');select.id='music-choice';select.setAttribute('aria-label','Background music');for(const o of options){const opt=document.createElement('option');opt.value=o.key;opt.textContent=o.label;select.append(opt)}label.append(select);document.querySelector('.controls').append(label);

const voiceLabel=document.createElement('label');voiceLabel.textContent='Narration voice ';const voiceSelect=document.createElement('select');voiceSelect.id='voice-choice';voiceSelect.setAttribute('aria-label','Narration voice');for(const [value,text] of [['natural','App Author voice'],['helmet','Helmet voice daft presentation']]){const o=document.createElement('option');o.value=value;o.textContent=text;voiceSelect.append(o)}voiceLabel.append(voiceSelect);document.querySelector('.controls').prepend(voiceLabel);
let voiceMode=null;
function applyVoice(value){
 const mode=window.VOICE_MODES?.[value];if(!mode||voiceMode===value)return;
 const current=SCENES.find(s=>t>=s.start&&t<s.end)||SCENES.at(-1),fraction=clamp((t-current.start)/(current.end-current.start));
 const active=playing;voice.pause();voiceId=null;voicePending=false;
 // Keep the intro at its original speed; retime narration, captions and scenes together.
 const rate=value==='natural'?1:0.9025,base=key==='egpu'?20:0;
 window.narrationPlaybackRate=rate;voice.playbackRate=rate;voice.preservesPitch=true;
 const scenes=mode.scenes.map(scene=>{
  if(scene.kind==='footage')return {...scene};
  const copy={...scene};for(const field of ['start','end','speechStart','speechEnd'])if(Number.isFinite(copy[field]))copy[field]=base+(copy[field]-base)/rate;
  copy.duration=scene.duration/rate;return copy;
 });
 SCENES.splice(0,SCENES.length,...scenes);CONFIG.duration=base+(mode.duration-base)/rate;D=CONFIG.duration;
 for(const k of Object.keys(AUDIO_TRACKS))delete AUDIO_TRACKS[k];AUDIO_TRACKS._full=mode.audio;AUDIO_TRACKS[String(SCENES.find(s=>s.kind!=='footage').id).padStart(2,'0')]=mode.audio;
 voiceMode=value;voiceSelect.value=value;window.currentNarrationVoice=value;
 const next=SCENES.find(s=>s.id===current.id)||SCENES.find(s=>s.kind!=='footage');t=window.introActive?SCENES.find(s=>s.kind!=='footage').start:next.start+fraction*(next.end-next.start);
 $('seek').max=D;const chapters=$('chapters');chapters.replaceChildren();for(const scene of SCENES){const o=document.createElement('option');o.value=scene.id;o.textContent=scene.kind==='footage'?'Opening video • real setup demonstration':tm(scene.start)+'  '+scene.title;chapters.append(o)}
 document.querySelector('header h1').textContent=CONFIG.name+' • '+mode.label;
 document.querySelector('header p').textContent=(key==='egpu'?tm(CONFIG.intro_duration)+' opening demo • '+tm(D-20):tm(D))+' • '+mode.label;
 const scriptLink=document.querySelector('footer a[href*="script"]');if(scriptLink){scriptLink.href=mode.script;scriptLink.textContent='Narration script'}
 playing=active;last=performance.now();render(t);window.updateIntroUi?.();
}
voiceSelect.onchange=()=>{applyVoice(voiceSelect.value);if(parent!==window)parent.postMessage({type:'presentation-voice',value:voiceSelect.value},'*')};

let lastIntent=0;function now(){return performance.timeOrigin+performance.now()}
function tell(){if(!lastIntent)lastIntent=now();if(parent!==window)parent.postMessage({type:'helmet-play',key,time:lastIntent},'*')}
function claim(){lastIntent=now();tell()}
for(const id of ['play','skip-intro','intro-video'])$(id)?.addEventListener('pointerdown',claim,true);
$('play')?.addEventListener('click',claim,true);$('skip-intro')?.addEventListener('click',claim,true);
for(const a of [voice,$('intro-video')])a?.addEventListener('play',tell);
const introSpeech=key==='egpu'?new Audio('intro-speech.mp3'):null;if(introSpeech){introSpeech.preload='metadata';$('intro-video').muted=true}
let introPending=false;
function offset(){return key==='egpu'?(window.introActive?$('intro-video').currentTime:Math.max(0,t-20)+CONFIG.intro_duration):t}
function isActive(){return key==='egpu'&&window.introActive?!$('intro-video').paused:playing&&t<D}
function applyMusic(value){if(!options.some(o=>o.key===value))return;selected=value;select.value=value;try{localStorage.setItem('egpu-helmet-music',value)}catch{}bed.pause();bed.src='../music/'+value+'.mp3?v=natural-02';bed.load();syncMusic()}
select.onchange=()=>{applyMusic(select.value);if(parent!==window)parent.postMessage({type:'helmet-music',value:selected},'*')};
syncMusic=()=>{
 const active=isActive();const inIntro=key==='egpu'&&window.introActive;
 if(introSpeech){
  if(!inIntro||!active)introSpeech.pause();else{
   if(introSpeech.readyState>0&&Math.abs(introSpeech.currentTime-$('intro-video').currentTime)>.18)introSpeech.currentTime=$('intro-video').currentTime;
   if(introSpeech.paused&&!introPending){introPending=true;introSpeech.play().catch(()=>{}).finally(()=>introPending=false)}
  }
 }
 if(!active||quick){bed.pause();return}
 const at=offset();if(bed.readyState>0&&Math.abs(bed.currentTime-at)>.25)bed.currentTime=Math.min(at,bed.duration);
 const remaining=inIntro?10:D-t;bed.volume=Math.pow(10,-12/20)*clamp(remaining/3);
 if(bed.paused&&!bedPending){bedPending=true;bed.play().catch(()=>{}).finally(()=>bedPending=false)}
};
bed.addEventListener('loadedmetadata',()=>{bed.currentTime=Math.min(offset(),bed.duration);syncMusic()});
if(introSpeech)introSpeech.addEventListener('loadedmetadata',()=>{if(window.introActive)introSpeech.currentTime=$('intro-video').currentTime});
window.addEventListener('message',e=>{if(e.source!==parent)return;if(e.data?.type==='presentation-voice'){applyVoice(e.data.value);return}if(e.data?.type==='helmet-music'){applyMusic(e.data.value);return}if(e.data?.type!=='helmet-pause'||e.data.time<lastIntent)return;playing=false;voice.pause();bed.pause();introSpeech?.pause();$('intro-video')?.pause();$('play').textContent=window.introActive?'Play intro':'Play'});
function height(){if(parent!==window)parent.postMessage({type:'helmet-height',key,height:Math.ceil(document.body.scrollHeight)+10},'*')}new ResizeObserver(height).observe(document.body);window.addEventListener('load',height);
applyMusic(selected);applyVoice('natural');
})();