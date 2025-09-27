// ===============================
// Bystander Coach — Reactive NPC + Strong Logic
// ===============================

// -------- Scenario (round-specific, clearly good/neutral/bad) --------
const SCENARIO = {
  rounds: [
    {
      name: 'Round 1 — Set a boundary',
      npc_line: "Hey, move. That’s my seat — now.",
      options: [
        { label: "Direct boundary: “That’s not okay. Please stop.”", tag: "DIRECT",   effect: "DEESCALATE",
          good: ["that's not okay","please stop","not okay","stop"], bad: [] },
        { label: "Distract politely: “Hey—does this bus stop at North Ave?”", tag: "DISTRACT", effect: "NEUTRAL",
          good: ["north ave","next stop","what stop"], bad: [] },
        { label: "Insult back (don’t do this): “Shut up and sit somewhere else.”", tag: "INSULT",   effect: "ESCALATE",
          good: [], bad: ["shut up","idiot","stupid","moron","freak"] }
      ],
      replies: {
        STRONG:   ["…Whatever. I’m just saying.", "Fine. Chill.", "Okay, okay."],
        NEUTRAL:  ["Mind your business.", "Huh?", "What?"],
        ESCALATE: ["You wanna go?", "Oh yeah? Try me.", "Say that again."]
      }
    },
    {
      name: 'Round 2 — Hold ground / route to help',
      npc_line: "Why do you care? They can speak for themselves.",
      options: [
        { label: "Delegate to authority: “Driver, could you help here?”", tag: "DELEGATE", effect: "DEESCALATE",
          good: ["driver","can you help","assist"], bad: [] },
        { label: "Support + de-escalate: “We’re just riding; let them be.”", tag: "DEESC", effect: "DEESCALATE",
          good: ["let them be","we're just riding"], bad: [] },
        { label: "Lecture / label them (don’t): “People like you are the problem.”", tag: "LECTURE", effect: "ESCALATE",
          good: [], bad: ["people like you","you are the problem","learn to","shut"] }
      ],
      replies: {
        STRONG:   ["Fine.", "Whatever…", "Alright."],
        NEUTRAL:  ["Tch.", "Hmph.", "Okay?"],
        ESCALATE: ["Back off!", "You think you’re better?", "Keep talking."]
      }
    },
    {
      name: 'Round 3 — Exit or support target',
      npc_line: "Tss.",
      options: [
        { label: "Move group: “Let’s grab those seats over there.”", tag: "MOVE", effect: "DEESCALATE",
          good: ["over there","grab seats","sit over there"], bad: [] },
        { label: "Check on target & relocate: “Are you okay if we move seats?”", tag: "SUPPORT", effect: "DEESCALATE",
          good: ["are you okay","move seats","we're here"], bad: [] },
        { label: "Keep arguing (don’t): “Say that again and see what happens.”", tag: "THREAT", effect: "ESCALATE",
          good: [], bad: ["see what happens","or else","fight","hit","punch"] }
      ],
      replies: {
        STRONG:   ["…Okay.", "Whatever.", "Fine."],
        NEUTRAL:  ["Tch.", "Huh.", "…"],
        ESCALATE: ["You asking for it?", "Try me.", "Step closer then."]
      }
    },
    {
      name: 'Delay — Aftercare (check on the person)',
      npc_line: "(Aggressor is quiet; check on the person.)",
      options: [
        { label: "“Are you alright?”",             tag: "AFTERCARE", effect: "DEESCALATE", good: ["are you alright","are you okay"], bad: [] },
        { label: "“Want me to stay with you?””",   tag: "AFTERCARE", effect: "DEESCALATE", good: ["stay with you","stay"], bad: [] },
        { label: "“Prefer to move seats?”",        tag: "AFTERCARE", effect: "DEESCALATE", good: ["move seats"], bad: [] }
      ],
      replies: {
        STRONG:   ["Thank you.", "I appreciate it.", "Thanks."],
        NEUTRAL:  ["Okay.", "Yeah.", "Mm."],
        ESCALATE: ["—"]
      }
    }
  ],
  // Backup lexicons for voice classification
  GOOD_GLOBAL: [
    "that's not okay","please stop","not okay","stop","driver","help","assist",
    "let them be","we're just riding","over there","move seats","are you okay","are you alright","we're here"
  ],
  BAD_GLOBAL: [
    "shut up","idiot","stupid","moron","freak","people like you","fight","hit","punch","see what happens","or else","loser"
  ]
};

// -------- State --------
const S = {
  round: 0,
  mood: 0,                 // -3 hostile … +3 calm
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

const npcAgg = $('#npcAggressor');
const npcDrv = $('#npcDriver');
const hoverDot = $('#hoverDot');

const opt1 = $('#opt1'), opt2 = $('#opt2'), opt3 = $('#opt3');
const opt1text = $('#opt1text'), opt2text = $('#opt2text'), opt3text = $('#opt3text');

// ======== RobotExpressive morph targets (facial expressions) ========
let aggMesh = null, aggMorphDict = null, aggMorph = null;
npcAgg.addEventListener('model-loaded', () => {
  const mesh = npcAgg.getObject3D('mesh');
  if (!mesh) return;
  mesh.traverse(node => {
    if (node.morphTargetInfluences && node.morphTargetDictionary) {
      aggMesh = node;
      aggMorphDict = node.morphTargetDictionary;
      aggMorph = node.morphTargetInfluences;
    }
  });
  // start slightly tense
  setAggExpression('angry', 0.8);
});

// Safely set facial expression, fallback to neutral if morph not found
function setAggExpression(kind='neutral', strength=0.7) {
  if (!aggMesh || !aggMorphDict || !aggMorph) return; // safe no-op
  for (let i=0;i<aggMorph.length;i++) aggMorph[i]=0;  // zero all

  const find = (needles)=>{
    const names = Object.keys(aggMorphDict);
    for (const n of names) {
      const low = n.toLowerCase();
      if (needles.some(k => low.includes(k))) return aggMorphDict[n];
    }
    return null;
  };

  let key = null;
  if (kind==='angry')      key = find(['angry','frown','mad']);
  else if (kind==='happy') key = find(['happy','smile']);
  else if (kind==='sad')   key = find(['sad']);
  else if (kind==='surprised') key = find(['surpris','shock']);
  else key = null;

  if (key!=null) aggMorph[key] = strength;
}

function playAggClip(name, dur=900){
  // if the clip doesn't exist, fallback to manual head/arm anims
  npcAgg.setAttribute('animation-mixer', `clip: ${name}; loop: once; clampWhenFinished: true`);
  // lightweight manual fallback gesture:
  if (name === 'No') {
    npcAgg.setAttribute('animation__shake', 'property: rotation; to: 0 175 0; dir: alternate; dur: 120; loop: 3; easing: easeOutQuad');
    setTimeout(()=> npcAgg.removeAttribute('animation__shake'), dur);
  } else if (name === 'Yes') {
    npcAgg.setAttribute('animation__nod', 'property: rotation; to: -6 165 0; dir: alternate; dur: 140; loop: 3; easing: easeInOutQuad');
    setTimeout(()=> npcAgg.removeAttribute('animation__nod'), dur);
  }
  setTimeout(()=> npcAgg.setAttribute('animation-mixer', 'clip: Idle; loop: repeat'), dur+150);
}

function moveAggTo(x=-0.8, z=-2.2, dur=400){
  npcAgg.setAttribute('animation__move', `property: position; to: ${x} 0 ${z}; dur:${dur}; easing:easeOutQuad`);
}

function driverGlance(){
  npcDrv.setAttribute('animation__glance', 'property: rotation; to: -6 150 0; dir: alternate; dur: 140; loop: 4; easing: easeInOutQuad');
  setTimeout(()=> npcDrv.removeAttribute('animation__glance'), 900);
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

// Optional STT (desktop). On Quest, STT is often unavailable—buttons still demo well.
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
function classifyVoice(text){
  const T = (text||'').toLowerCase();
  const good = SCENARIO.GOOD_GLOBAL.some(k => T.includes(k));
  const bad  = SCENARIO.BAD_GLOBAL.some(k => T.includes(k));
  if (good && !bad) return 'DEESCALATE';
  if (bad && !good) return 'ESCALATE';
  return 'NEUTRAL';
}

function score(turn, text, tone, chosenEffect=null){
  // If user clicked an option, that carries an intended effect; tone can upgrade/downgrade.
  let effect = chosenEffect || classifyVoice(text);

  // Tone influences:
  if (tone === 'AGGRESSIVE') effect = 'ESCALATE';
  else if (tone === 'CALM' && effect === 'NEUTRAL') effect = 'DEESCALATE';

  // Map effect -> branch
  if (effect === 'DEESCALATE') return 'STRONG';
  if (effect === 'ESCALATE')   return 'ESCALATE';
  return 'NEUTRAL';
}

function pickReply(round, branchKey){
  const list = SCENARIO.rounds[round].replies[branchKey] || ["…"];
  return list[Math.floor(Math.random()*list.length)];
}

function adjustMood(branchKey){
  if (branchKey==='STRONG') S.mood = Math.min(3, S.mood+1);
  if (branchKey==='ESCALATE') S.mood = Math.max(-3, S.mood-1);

  if (S.mood<=-1){ setAggExpression('angry', 1.0); moveAggTo(-0.6, -1.6, 260); }
  else if (S.mood>=2){ setAggExpression('happy', 0.6); moveAggTo(-0.9, -2.6, 300); }
  else { setAggExpression('neutral', 0.0); moveAggTo(-0.8, -2.2, 280); }
}

function reactBranch(branchKey){
  if (branchKey==='ESCALATE'){ playAggClip('No', 900); driverGlance(); }
  if (branchKey==='STRONG'){   playAggClip('Yes', 900); }
  if (branchKey==='NEUTRAL'){  /* tiny shrug via rotation */ npcAgg.setAttribute('animation__shrug','property: rotation; to: 0 170 0; dir: alternate; dur: 220; loop: 2; easing: easeInOutQuad'); setTimeout(()=> npcAgg.removeAttribute('animation__shrug'), 600); }
}

// -------- UI helpers --------
function setSubtitle(v){ subtitle.setAttribute('text','value', v); }
function setYou(v){ youSaid.setAttribute('text','value', v? `You: ${v}` : ''); }

function labelOptions(round){
  const [o1,o2,o3] = SCENARIO.rounds[round].options;
  opt1text.setAttribute('text','value', o1.label);
  opt2text.setAttribute('text','value', o2.label);
  opt3text.setAttribute('text','value', o3.label);
}

// -------- Flow --------
function showRound(){
  const r = SCENARIO.rounds[S.round];
  setSubtitle(`${r.name}\n${r.npc_line}`);
  setYou('');
  labelOptions(S.round);

  // opening behaviors
  if (S.round===0){ setAggExpression('angry', 0.8); moveAggTo(-0.6,-1.8,300); driverGlance(); }
  if (S.round===1){ moveAggTo(-0.7,-2.0,300); }
  if (S.round===2){ moveAggTo(-0.8,-2.2,300); }
  if (S.round===3){ setAggExpression('happy', 0.5); moveAggTo(-0.95,-2.6,300); }
}

function applyResponse({text='', chosenTag='', chosenEffect=null}){
  const roundData = SCENARIO.rounds[S.round];
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
    if (S.round >= SCENARIO.rounds.length - 1) endGame();
    else { S.round++; showRound(); }
  }, wait);
}

function endGame(){
  const win = S.path.some(p=>p.branch==='STRONG'); // any cooling move counts
  const last = S.path[S.path.length-1] || {};
  const title = win ? '✅ You cooled it down.' : '⚠️ Try a calmer, shorter boundary.';
  const good  = win ? 'What worked:\n• Clear boundary or useful delegation.\n• No labels/insults.\n• Steady tone.' :
                      'Try this:\n• 1 short sentence about behavior.\n• Avoid labels/insults.\n• Lower volume; slow pace.';
  const better = '“That’s not okay. Please stop.”\n“We’re just riding; let them be.”\n“Driver, could you help here?”';

  uiPanel.setAttribute('visible','false');
  feedback.setAttribute('visible', true);
  feedback.setAttribute('animation__in','property: scale; from: 0 0 0; to: 1 1 1; dur: 600; easing: easeOutBack');

  cardTitle.setAttribute('text','value', title);
  cardBody.setAttribute('text','value',
    `Last response: “${last.text||'—'}”\nTone: ${last.tone||S.lastTone}\n\n${good}\n\nBetter lines:\n${better}`);
}

function resetAll(){
  S.round=0; S.mood=0; S.lastTone='ASSERTIVE'; S.lastText=''; S.path=[];
  uiPanel.setAttribute('visible','true');
  feedback.setAttribute('visible', false);
  feedback.removeAttribute('animation__in');
  showRound();
}

// -------- Bind clicks + hover feedback --------
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

// Button handlers (context-aware)
bindClickable(opt1, ()=> {
  const opt = SCENARIO.rounds[S.round].options[0];
  applyResponse({ text: opt.label.replace(/^.*?:\s*/,'').replace(/^“|”$/g,''), chosenTag: opt.tag, chosenEffect: opt.effect });
});
bindClickable(opt2, ()=> {
  const opt = SCENARIO.rounds[S.round].options[1];
  applyResponse({ text: opt.label.replace(/^.*?:\s*/,'').replace(/^“|”$/g,''), chosenTag: opt.tag, chosenEffect: opt.effect });
});
bindClickable(opt3, ()=> {
  const opt = SCENARIO.rounds[S.round].options[2];
  applyResponse({ text: opt.label.replace(/^.*?:\s*/,'').replace(/^“|”$/g,''), chosenTag: opt.tag, chosenEffect: opt.effect });
});

// Card buttons
bindClickable($('#btnReplay'), resetAll);
bindClickable($('#btnSave'), exportCardPNG);

// -------- Mic UI --------
micBtn.addEventListener('click', async ()=>{
  const ok = await enableMic();
  if (ok){ micBtn.textContent='Mic Enabled'; micBtn.style.background='#0e7a3f'; }
});
speakBtn.addEventListener('click', async ()=>{
  const ok = await enableMic(); if (!ok) return;
  speakBtn.textContent = 'Listening…'; speakBtn.disabled = true;
  const {bucket} = await measureTone(1000);
  S.lastTone = bucket;
  // Try STT (desktop). On Quest, STT often unavailable — still use tone.
  let text = await runSTT(1400);
  speakBtn.textContent = 'Speak Now (1s)'; speakBtn.disabled = false;

  if (!text){
    setYou(`(Voice tone: ${S.lastTone}). Pick an option or say one short line.`);
    return;
  }
  applyResponse({ text, chosenTag:'VOICE', chosenEffect: null });
});

// -------- Save feedback as PNG --------
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

// -------- Init --------
document.addEventListener('DOMContentLoaded', ()=>{
  setTimeout(()=> { $('#loadingScreen').style.display='none'; showRound(); }, 700);
});

// ===============================
