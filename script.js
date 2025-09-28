// ===============================
// Gift Shop Situation — Reactive NPC + Strong Logic (No Overlap version)
// ===============================

// -------- Background tension audio (subtle) --------
const Tension = (() => {
  let ctx, osc, gain, target = 0.05;
  function ensure() {
    if (ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    ctx = new AC();
    osc = ctx.createOscillator();
    gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = 110; // low hum
    gain.gain.value = 0.0001;
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start();
    ramp(0.03);
  }
  function ramp(val) {
    ensure();
    target = Math.max(0.0, Math.min(0.12, val));
    gain.gain.cancelScheduledValues(ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, target), ctx.currentTime + 0.5);
  }
  return { ramp, up: () => ramp(target + 0.02), down: () => ramp(target - 0.02) };
})();

// -------- Scenario (gift shop) --------
const SCENARIO = {
  rounds: [
    {
      name: 'Round 1 — Angry refund request',
      npc_line:
`You are working at the gift shop. The next customer in line comes up to you, furious that his mug was chipped.
Him: “I can’t believe you’d sell something like this in a museum gift shop. What a rip-off!”
You: *pause* “Sorry to hear that. Let me check if we have another one.”
Him: “Oh come on! I already waste so much money at these gift shops after waiting so long to get to the front, and now I gotta wait even longer while you go and check?! Do you even care about your customers??”`,
      options: [
        { label: "“Hey calm down bruh. It’s just a very small chip, and not very noticeable either. Let me go check and get back to you.”",
          tag: "DISMISSIVE", effect: "ESCALATE",
          good: [], bad: ["calm down","small chip","not very","bruh","chill"] },
        { label: "“I’m really sorry about that! I completely understand how frustrating this is, I can get you a refund or replace the mug, whichever works best for you.”",
          tag: "EMPATHY_SOLVE", effect: "DEESCALATE",
          good: ["sorry","understand","refund","replace","whichever"], bad: [] },
        { label: "“Mm, stop whining like a child and please get out of here. Don't you see the board? It clearly says NO REFUNDS.”",
          tag: "INSULT_POLICY", effect: "ESCALATE",
          good: [], bad: ["whining","child","no refunds","get out"] }
      ],
      replies: {
        STRONG:   ["…Alright. I just want one that’s not broken.", "Fine, can you swap it then?", "Okay—just fix it."],
        NEUTRAL:  ["Huh? You’re wasting my time.", "What does that even mean?", "So are you going or not?"],
        ESCALATE: ["Manager. Now.", "Unbelievable—are you serious?", "You’re not listening at all."]
      }
    },
    {
      name: 'Round 2 — Offer clear paths',
      npc_line: "Customer: “So what are you actually going to do about it?”",
      options: [
        { label: "“Here are two options: a full refund right now, or I can replace it in under two minutes—your choice.”",
          tag: "CHOICE_CLEAR", effect: "DEESCALATE",
          good: ["refund right now","replace","two minutes","your choice"], bad: [] },
        { label: "“Policy says exchanges only—no exceptions.”",
          tag: "POLICY_ONLY", effect: "NEUTRAL",
          good: ["exchange"], bad: ["no exceptions","policy says"] },
        { label: "“Maybe look before you buy next time.”",
          tag: "BLAME", effect: "ESCALATE",
          good: [], bad: ["look before you buy","your fault"] }
      ],
      replies: {
        STRONG:   ["Okay, replace it then.", "Refund. I don’t want it anymore.", "Fine—just make it quick."],
        NEUTRAL:  ["Tch. Whatever.", "…Hurry up.", "Okay?"],
        ESCALATE: ["You’re blaming me?", "Wow. Call your manager.", "This is ridiculous."]
      }
    },
    {
      name: 'Round 3 — Close it safely',
      npc_line: "Customer: “Can we just finish this?”",
      options: [
        { label: "“Absolutely. I’ll process that now and throw in a protective wrap. Thanks for letting me fix it.”",
          tag: "CLOSE_WITH_THANKS", effect: "DEESCALATE",
          good: ["process now","protective wrap","thanks"], bad: [] },
        { label: "“Let’s step to the side counter so I can finish this without holding up the line.”",
          tag: "MOVE_ASIDE", effect: "DEESCALATE",
          good: ["step to the side","without holding up the line"], bad: [] },
        { label: "“Keep yelling and I’ll refuse service.”",
          tag: "THREAT_REFUSE", effect: "ESCALATE",
          good: [], bad: ["refuse service","keep yelling"] }
      ],
      replies: {
        STRONG:   ["…Alright.", "Thanks.", "Okay, fine."],
        NEUTRAL:  ["Just do it.", "Hurry up.", "Whatever."],
        ESCALATE: ["Oh really? Try me.", "Get your boss.", "I’ll leave a review you won’t like."]
      }
    },
    {
      name: 'Aftercare — Reset & self-check',
      npc_line: "(The situation is settled. Take a breath. Note one thing you did well and one improvement.)",
      options: [
        { label: "“Thanks for your patience—have a good rest of your visit.”", tag: "AFTERCARE", effect: "DEESCALATE", good: ["thanks","patience"], bad: [] },
        { label: "“If anything else comes up, I’m right here.”", tag: "AFTERCARE", effect: "DEESCALATE", good: ["right here"], bad: [] },
        { label: "“Next!” (ignore the customer while they finish)", tag: "AFTERCARE_BAD", effect: "ESCALATE", good: [], bad: ["next!"] }
      ],
      replies: {
        STRONG:   ["(Customer nods, leaves.)", "(Customer softens, walks off.)", "Thanks."],
        NEUTRAL:  ["(Customer shrugs.)", "Okay.", "Sure."],
        ESCALATE: ["(Customer glares.)"]
      }
    }
  ],
  GOOD_GLOBAL: [
    "sorry","understand","refund","replace","whichever","refund right now","two minutes","your choice",
    "process now","protective wrap","thanks","step to the side","without holding up the line","right here"
  ],
  BAD_GLOBAL: [
    "calm down","small chip","not very","bruh","whining","child","no refunds","get out",
    "no exceptions","look before you buy","your fault","refuse service","keep yelling","next!"
  ]
};

// -------- State --------
const S = {
  round: 0,
  mood: -1,               // start a bit hostile
  lastTone: 'ASSERTIVE',
  lastText: '',
  path: [],
  mic: { stream:null, ctx:null, analyser:null, buf:null }
};

// -------- DOM / A-Frame refs --------
const $ = s => document.querySelector(s);
const subtitle = $('#subtitle');
const youSaid  = $('#youSaid');
const uiPanel  = $('#uiPanel');
const feedback = $('#feedbackCard');
const cardTitle = $('#cardTitle');
const cardBody  = $('#cardBody');

const micBtn = $('#micPermission');
const speakBtn = $('#speakNow');
const micStatus = $('#micStatus');

const npcCust = $('#npcCustomer');
const npcMgr = $('#npcManager');
const hoverDot = $('#hoverDot');

// ======== RobotExpressive morph targets (facial expressions) ========
let custMesh = null, custMorphDict = null, custMorph = null;
npcCust.addEventListener('model-loaded', () => {
  const mesh = npcCust.getObject3D('mesh');
  if (!mesh) return;
  mesh.traverse(node => {
    if (node.morphTargetInfluences && node.morphTargetDictionary) {
      custMesh = node;
      custMorphDict = node.morphTargetDictionary;
      custMorph = node.morphTargetInfluences;
    }
  });
  // initial tense look and subtle lean towards counter
  setCustomerExpression('angry', 0.85);
  npcLeanTowardCounter(true);
  Tension.ramp(0.06);
});

// Safely set facial expression, fallback to neutral if morph not found
function setCustomerExpression(kind='neutral', strength=0.7) {
  if (!custMesh || !custMorphDict || !custMorph) return;
  for (let i=0;i<custMorph.length;i++) custMorph[i]=0;  // zero all

  const find = (needles)=>{
    const names = Object.keys(custMorphDict);
    for (const n of names) {
      const low = n.toLowerCase();
      if (needles.some(k => low.includes(k))) return custMorphDict[n];
    }
    return null;
  };

  let key = null;
  if (kind==='angry')      key = find(['angry','frown','mad']);
  else if (kind==='happy') key = find(['happy','smile']);
  else if (kind==='sad')   key = find(['sad']);
  else if (kind==='surprised') key = find(['surpris','shock']);

  if (key!=null) custMorph[key] = strength;
}

function playCustomerClip(name, dur=900){
  // Fallback head gestures in case clip names differ
  npcCust.setAttribute('animation-mixer', `clip: ${name}; loop: once; clampWhenFinished: true`);
  if (name === 'No') {
    npcCust.setAttribute('animation__shake', 'property: rotation; to: 0 168 0; dir: alternate; dur: 120; loop: 3; easing: easeOutQuad');
    setTimeout(()=> npcCust.removeAttribute('animation__shake'), dur);
  } else if (name === 'Yes') {
    npcCust.setAttribute('animation__nod', 'property: rotation; to: -6 170 0; dir: alternate; dur: 140; loop: 3; easing: easeInOutQuad');
    setTimeout(()=> npcCust.removeAttribute('animation__nod'), dur);
  }
  setTimeout(()=> npcCust.setAttribute('animation-mixer', 'clip: Idle; loop: repeat'), dur+150);
}

function moveCustomerTo(x=-1.15, z=-2.55, dur=360){
  npcCust.setAttribute('animation__move', `property: position; to: ${x} 0 ${z}; dur:${dur}; easing:easeOutQuad`);
}

function npcLeanTowardCounter(on=true){
  if (on){
    npcCust.setAttribute('animation__lean', 'property: rotation; to: -6 170 0; dir: alternate; dur: 700; loop: true; easing: easeInOutSine');
  } else {
    npcCust.removeAttribute('animation__lean');
    npcCust.setAttribute('rotation', '0 170 0');
  }
}

function managerGlance(){
  npcMgr.setAttribute('animation__glance', 'property: rotation; to: -6 150 0; dir: alternate; dur: 140; loop: 4; easing: easeInOutQuad');
  setTimeout(()=> npcMgr.removeAttribute('animation__glance'), 900);
}

// -------- Mic / tone --------
async function enableMic(){
  if (S.mic.stream) return true;
  try{
    const stream = await navigator.mediaDevices.getUserMedia({audio:true});
    const ctx = new (window.AudioContext||window.webkitAudioContext)();
    const src = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser(); analyser.fftSize = 2048;
    src.connect(analyser);
    S.mic = { stream, ctx, analyser, buf:new Float32Array(analyser.fftSize) };
    micStatus.textContent = 'Microphone: Enabled';
    speakBtn.disabled = false;
    return true;
  }catch(e){
    micStatus.textContent = 'Microphone: Access Denied';
    speakBtn.disabled = true;
    return false;
  }
}

function measureTone(ms=1000){
  return new Promise(res=>{
    if (!S.mic.analyser) return res({bucket:'ASSERTIVE'});
    const {analyser, buf} = S.mic;
    let frames=0, sumAbs=0, pace=0, prev=0;
    const t0 = performance.now();
    (function loop(){
      analyser.getFloatTimeDomainData(buf);
      let abs=0;
      for (let i=0;i<buf.length;i++){ const v=buf[i]; abs+=Math.abs(v); pace+=Math.abs(v-prev); prev=v; }
      sumAbs += abs/buf.length; frames++;
      if (performance.now()-t0 < ms) requestAnimationFrame(loop);
      else {
        const rms=(sumAbs/frames)||0, paceNorm=pace/(frames*buf.length);
        let bucket='CALM'; if (rms>0.6 || paceNorm>0.008) bucket='AGGRESSIVE'; else if (rms>=0.25) bucket='ASSERTIVE';
        res({bucket});
      }
    })();
  });
}

function runSTT(timeoutMs=1400){
  return new Promise(resolve=>{
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return resolve('');
    const r = new SR(); r.lang='en-US'; r.interimResults=false; r.maxAlternatives=1;
    let done=false; const t=setTimeout(()=>{ if(!done){done=true; r.stop(); resolve('');} }, timeoutMs+400);
    r.onresult = e=>{ if(done) return; done=true; clearTimeout(t); resolve(e.results[0][0].transcript||''); };
    r.onerror  = ()=>{ if(!done){done=true; clearTimeout(t); resolve('');} };
    r.onend    = ()=>{ if(!done){done=true; clearTimeout(t); resolve('');} };
    r.start(); setTimeout(()=> r.stop(), timeoutMs);
  });
}

// -------- Scoring + mood + reaction lines --------
const SCEN = SCENARIO;
function classifyVoice(text){
  const T = (text||'').toLowerCase();
  const good = SCEN.GOOD_GLOBAL.some(k => T.includes(k));
  const bad  = SCEN.BAD_GLOBAL.some(k => T.includes(k));
  if (good && !bad) return 'DEESCALATE';
  if (bad && !good) return 'ESCALATE';
  return 'NEUTRAL';
}

function score(turn, text, tone, chosenEffect=null){
  let effect = chosenEffect || classifyVoice(text);
  if (tone === 'AGGRESSIVE') effect = 'ESCALATE';
  else if (tone === 'CALM' && effect === 'NEUTRAL') effect = 'DEESCALATE';
  if (effect === 'DEESCALATE') return 'STRONG';
  if (effect === 'ESCALATE')   return 'ESCALATE';
  return 'NEUTRAL';
}

function pickReply(round, branchKey){
  const list = SCEN.rounds[round].replies[branchKey] || ["…"];
  return list[Math.floor(Math.random()*list.length)];
}

function adjustMood(branchKey){
  if (branchKey==='STRONG'){ S.mood = Math.min(3, S.mood+1); Tension.down(); }
  if (branchKey==='ESCALATE'){ S.mood = Math.max(-3, S.mood-1); Tension.up(); }

  // Distances + expressions keyed to mood (further left/back than before)
  if (S.mood<=-1){ setCustomerExpression('angry', 0.95); moveCustomerTo(-1.0, -2.2, 260); npcLeanTowardCounter(true); }
  else if (S.mood>=2){ setCustomerExpression('happy', 0.6); moveCustomerTo(-1.25, -2.8, 300); npcLeanTowardCounter(false); }
  else { setCustomerExpression('neutral', 0.15); moveCustomerTo(-1.15, -2.55, 280); npcLeanTowardCounter(true); }
}

function reactBranch(branchKey){
  if (branchKey==='ESCALATE'){ playCustomerClip('No', 900); managerGlance(); }
  if (branchKey==='STRONG'){   playCustomerClip('Yes', 900); }
  if (branchKey==='NEUTRAL'){  npcCust.setAttribute('animation__shrug','property: rotation; to: 0 172 0; dir: alternate; dur: 220; loop: 2; easing: easeInOutQuad'); setTimeout(()=> npcCust.removeAttribute('animation__shrug'), 600); }
}

// -------- UI helpers --------
function setSubtitle(v){ subtitle.setAttribute('text','value', v); }
function setYou(v){ youSaid.setAttribute('text','value', v? `You: ${v}` : ''); }

function labelOptions(round){
  const [o1,o2,o3] = SCEN.rounds[round].options;
  $('#opt1text').setAttribute('text','value', o1.label);
  $('#opt2text').setAttribute('text','value', o2.label);
  $('#opt3text').setAttribute('text','value', o3.label);
}

// -------- Flow --------
function showRound(){
  const r = SCEN.rounds[S.round];
  setSubtitle(`${r.name}\n${r.npc_line}`);
  setYou('');
  labelOptions(S.round);

  // Round-specific staging (values match the "further left/back" layout)
  if (S.round===0){ setCustomerExpression('angry', 0.85); moveCustomerTo(-1.05,-2.35,320); managerGlance(); }
  if (S.round===1){ moveCustomerTo(-1.15,-2.55,300); }
  if (S.round===2){ moveCustomerTo(-1.2,-2.65,300); }
  if (S.round===3){ setCustomerExpression('happy', 0.5); moveCustomerTo(-1.25,-2.8,300); }
}

function applyResponse({text='', chosenTag='', chosenEffect=null}){
  const roundData = SCEN.rounds[S.round];
  const tone = S.mic.stream ? S.lastTone : 'ASSERTIVE';

  const branchKey = score(roundData, text || chosenTag, tone, chosenEffect);
  const npcLine = pickReply(S.round, branchKey);

  setYou(text ? `${text}  (${tone})` : `${chosenTag}  (${tone})`);
  setSubtitle(npcLine);

  S.path.push({ round:S.round, branch:branchKey, tone, text:text||chosenTag });
  adjustMood(branchKey);
  reactBranch(branchKey);

  const wait = 950 + (S.mood<0 ? 400 : 150);
  setTimeout(()=>{
    if (S.round >= SCEN.rounds.length - 1) endGame();
    else { S.round++; showRound(); }
  }, wait);
}

function endGame(){
  const win = S.path.some(p=>p.branch==='STRONG');
  const last = S.path[S.path.length-1] || {};
  const title = win ? '✅ You resolved it professionally.' : '⚠️ Try an empathic, concrete fix next time.';
  const good  = win ? 'What worked:\n• Empathy + clear choices (refund/replace).\n• No minimizing, no insults.\n• Kept voice steady.' :
                      'Try this:\n• Start with empathy (“I’m sorry… I understand”).\n• Offer concrete options you can deliver.\n• Avoid “calm down”, labels, threats.';
  const better = '“I’m really sorry this happened—refund or replace, your choice.”\n“Let’s step to the side so I can fix this quickly.”';

  // Keep the HUD visible; show the card as an overlay (also HUD)
  feedback.setAttribute('visible', true);
  feedback.setAttribute('animation__in','property: scale; from: 0 0 0; to: 1 1 1; dur: 600; easing: easeOutBack');

  cardTitle.setAttribute('text','value', title);
  cardBody.setAttribute('text','value',
    `Last response: “${last.text||'—'}”\nTone: ${last.tone||S.lastTone}\n\n${good}\n\nBetter lines:\n${better}`);
}

// -------- Buttons, hover, mic, PNG --------
function bindClickable(el, handler){
  el.classList.add('clickable');
  el.addEventListener('click', handler);
  ['#rightHand','#leftHand'].forEach(sel=>{
    const rc = document.querySelector(sel);
    rc.addEventListener('raycaster-intersection', e=>{
      const hit = e.detail.intersections?.find(i => i.object.el === el);
      if (!hit) return;
      const p = hit.point; hoverDot.object3D.position.set(p.x,p.y,p.z);
      hoverDot.setAttribute('visible','true');
    });
    rc.addEventListener('raycaster-intersection-cleared', ()=> hoverDot.setAttribute('visible','false'));
  });
}

bindClickable($('#opt1'), ()=> {
  const opt = SCEN.rounds[S.round].options[0];
  applyResponse({ text: stripQuotes(opt.label), chosenTag: opt.tag, chosenEffect: opt.effect });
});
bindClickable($('#opt2'), ()=> {
  const opt = SCEN.rounds[S.round].options[1];
  applyResponse({ text: stripQuotes(opt.label), chosenTag: opt.tag, chosenEffect: opt.effect });
});
bindClickable($('#opt3'), ()=> {
  const opt = SCEN.rounds[S.round].options[2];
  applyResponse({ text: stripQuotes(opt.label), chosenTag: opt.tag, chosenEffect: opt.effect });
});

bindClickable($('#btnReplay'), resetAll);
bindClickable($('#btnSave'), exportCardPNG);

micBtn.addEventListener('click', async ()=>{
  const ok = await enableMic();
  if (ok){ micBtn.textContent='Mic Enabled'; micBtn.style.background='#0e7a3f'; }
});
speakBtn.addEventListener('click', async ()=>{
  const ok = await enableMic(); if (!ok) return;
  speakBtn.textContent = 'Listening…'; speakBtn.disabled = true;
  const {bucket} = await measureTone(1000);
  S.lastTone = bucket;
  let text = await runSTT(1400);
  speakBtn.textContent = 'Speak Now (1s)'; speakBtn.disabled = false;

  if (!text){
    setYou(`(Voice tone: ${S.lastTone}). Pick an option or say one short line.`);
    return;
  }
  applyResponse({ text, chosenTag:'VOICE', chosenEffect: null });
});

function exportCardPNG(){
  const cnv = $('#exportCanvas'), ctx = cnv.getContext('2d');
  const pad=20, w=cnv.width, h=cnv.height;
  ctx.fillStyle='#00152b'; ctx.fillRect(0,0,w,h);
  const title = $('#cardTitle').getAttribute('text').value;
  const body  = $('#cardBody').getAttribute('text').value;
  ctx.fillStyle='#a7f3d0'; ctx.font='bold 24px system-ui, Segoe UI, Roboto'; ctx.fillText(title, pad, pad+26);
  ctx.fillStyle='#e7edf7'; ctx.font='16px system-ui, Segoe UI, Roboto';
  wrap(ctx, body, w-pad*2).forEach((line,i)=> ctx.fillText(line, pad, pad+70 + i*22));
  const a=document.createElement('a'); a.href=cnv.toDataURL('image/png'); a.download='bystander_coach_card.png'; a.click();
}
function wrap(ctx, text, width){
  const words=text.split(/\s+/), lines=[]; let line='';
  for (const w of words){ const t=line? line+' '+w : w; if (ctx.measureText(t).width>width){ if(line) lines.push(line); line=w; } else line=t; }
  if (line) lines.push(line); return lines;
}
function stripQuotes(s){ return (s||'').replace(/^“|”$/g,'').replace(/^.*?:\s*/,''); }

// -------- Reset & Init --------
function resetAll(){
  S.round=0; S.mood=-1; S.lastTone='ASSERTIVE'; S.lastText=''; S.path=[];
  feedback.setAttribute('visible', false);
  feedback.removeAttribute('animation__in');
  showRound();
}

document.addEventListener('DOMContentLoaded', ()=>{
  setTimeout(()=> { $('#loadingScreen').style.display='none'; showRound(); }, 700);
});

// ===============================
