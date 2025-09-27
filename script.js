// ===============================
// Bystander Coach — Expressive NPC + Solid Logic
// ===============================

// ---------- Scenario with context-specific options ----------
const SCENARIO = {
  rounds: [
    {
      name: 'Round 1 — Set a boundary',
      npc_line: "Move. That’s my seat — now.",
      options: [
        { label: "Direct: “That’s not okay. Please stop.”", tag: "DIRECT",
          good: ["not okay","please stop","stop"], bad: ["idiot","shut up","stupid"] },
        { label: "Distract: “Hey—can you help me with the next stop?”", tag: "DISTRACT",
          good: ["help me","next stop","what stop"], bad: [] },
        { label: "Delegate: “Driver, can you assist—there’s a situation here.”", tag: "DELEGATE",
          good: ["driver","assist","help"], bad: [] }
      ],
      branches: {
        STRONG:   { react: "…Whatever. Just saying.", outcome: "cooling" },
        NEUTRAL:  { react: "Mind your business.",     outcome: "stall"   },
        ESCALATE: { react: "You wanna go?",           outcome: "escalate"}
      }
    },
    {
      name: 'Round 2 — Hold ground briefly',
      npc_line: "Why do you care?",
      options: [
        { label: "Direct (short): “Everyone deserves respect.”",  tag: "DIRECT",
          good: ["respect","deserves"], bad: ["loser","stupid"] },
        { label: "De-escalate: “We’re just riding. Let them be.”", tag: "DEESC",
          good: ["let them be","we're just riding"], bad: [] },
        { label: "Delegate: “Driver, we need help here.”",         tag: "DELEGATE",
          good: ["driver","help"], bad: [] }
      ],
      branches: {
        STRONG:   { react: "Fine.",       outcome: "cooling" },
        NEUTRAL:  { react: "Whatever.",   outcome: "stall"   },
        ESCALATE: { react: "Back off!",   outcome: "escalate"}
      }
    },
    {
      name: 'Round 3 — Exit/support',
      npc_line: "Tch.",
      options: [
        { label: "Support target: “We’re here—want to sit up front?”", tag: "SUPPORT",
          good: ["we're here","want to sit","need a seat"], bad: [] },
        { label: "Move group: “Let’s grab those seats over there.”", tag: "MOVE",
          good: ["over there","grab seats"], bad: [] },
        { label: "Reset: “Let’s give space.”", tag: "RESET",
          good: ["give space"], bad: [] }
      ],
      branches: {
        STRONG:   { react: "…Okay.", outcome: "cooling" },
        NEUTRAL:  { react: "Tss.",   outcome: "stall"   },
        ESCALATE: { react: "Huh.",   outcome: "stall"   }
      }
    },
    // Aftercare (Delay)
    {
      name: 'Aftercare — Check on the person',
      npc_line: "(Aggressor is quiet; check in with the person.)",
      options: [
        { label: "“Are you alright?”",                tag: "AFTERCARE", good: ["are you alright","are you okay"], bad: [] },
        { label: "“Want me to stay with you?”",      tag: "AFTERCARE", good: ["stay with you","stay"], bad: [] },
        { label: "“Prefer to move seats?”",          tag: "AFTERCARE", good: ["move seats"], bad: [] }
      ],
      branches: {
        STRONG:   { react: "Thank you.", outcome: "cooling" },
        NEUTRAL:  { react: "Okay.",      outcome: "cooling" },
        ESCALATE: { react: "—",          outcome: "cooling" }
      }
    }
  ],
  tips: [
    "One short sentence beats a speech.",
    "Address behavior, not identity.",
    "Keep volume steady; avoid insults.",
    "If unsafe, prefer Delegating/Moving."
  ]
};

// ---------- State ----------
const S = {
  round: 0,
  mood: 0,                // -3 hostile … +3 calm
  lastTone: 'ASSERTIVE',
  lastText: '',
  path: [],
  mic: { stream:null, ctx:null, analyser:null, buf:null }
};

// ---------- DOM / A-Frame refs ----------
const $ = (s)=>document.querySelector(s);
const subtitle = $('#subtitle');
const youSaid  = $('#youSaid');
const feedbackCard = $('#feedbackCard');
const cardTitle = $('#cardTitle');
const cardBody  = $('#cardBody');

const micPermissionBtn = $('#micPermission');
const micStatus = $('#micStatus');
const speakBtn2D = document.createElement('button'); // simple desktop helper if wanted

const npcAgg = $('#npcAggressor');
const npcDrv = $('#npcDriver');
const hoverDot = $('#hoverDot');

const opt1 = $('#opt1'), opt2 = $('#opt2'), opt3 = $('#opt3');
const opt1text = $('#opt1text'), opt2text = $('#opt2text'), opt3text = $('#opt3text');

// ========= NPC expression helpers (RobotExpressive) =========
let aggMesh = null, aggMorphDict = null, aggMorph = null; // morph target control

npcAgg.addEventListener('model-loaded', () => {
  const mesh = npcAgg.getObject3D('mesh');
  if (!mesh) return;
  // Walk the tree to find a skinned mesh with morphTargets
  mesh.traverse(node => {
    if (node.morphTargetInfluences && node.morphTargetDictionary) {
      aggMesh = node;
      aggMorphDict = node.morphTargetDictionary;
      aggMorph = node.morphTargetInfluences;
    }
  });
  setAggExpression('angry', 0.9); // start tense
});

// map emotions -> try to find a matching morph target by (case-insensitive) name
function setAggExpression(kind='neutral', strength=0.7) {
  if (!aggMesh || !aggMorphDict || !aggMorph) return;

  // zero all first
  for (let i=0;i<aggMorph.length;i++) aggMorph[i]=0;

  const find = (needleArr)=>{
    const names = Object.keys(aggMorphDict);
    for (const n of names) {
      const low = n.toLowerCase();
      for (const k of needleArr) if (low.includes(k)) return aggMorphDict[n];
    }
    return null;
  };

  let key = null;
  if (kind==='angry')    key = find(['angry','frown','mad']);
  else if (kind==='happy')   key = find(['happy','smile']);
  else if (kind==='sad')     key = find(['sad']);
  else if (kind==='surprised') key = find(['surpris','shock']);
  else if (kind==='neutral')   key = null;

  if (key!=null) aggMorph[key] = strength;
}

// quick gesture via rotation animation-mixer fallback
function playAggClip(name, dur=1000){
  // RobotExpressive has clips like Idle/Walk/Run/Jump/Yes/No/Wave/Dance (varies by version)
  npcAgg.setAttribute('animation-mixer', `clip: ${name}; loop: once; clampWhenFinished: true`);
  setTimeout(()=> npcAgg.setAttribute('animation-mixer', 'clip: Idle; loop: repeat'), dur+200);
}

// move NPC a bit (closer/farther)
function moveAggTo(z = -1.6, dur=600){
  npcAgg.setAttribute('animation__move', `property: position; to: 0 0 ${z}; dur: ${dur}; easing: easeOutQuad`);
}

// Driver brief “speak” gesture
function driverConcern(){
  npcDrv.setAttribute('animation__nod', 'property: rotation; to: -6 150 0; dir: alternate; dur: 160; loop: 4; easing: easeInOutQuad');
  setTimeout(()=> npcDrv.removeAttribute('animation__nod'), 900);
}

// ---------- Mic & tone ----------
async function enableMic(){
  if (S.mic.stream) return true;
  try{
    const stream = await navigator.mediaDevices.getUserMedia({audio:true});
    const ctx = new (window.AudioContext||window.webkitAudioContext)();
    const src = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser(); analyser.fftSize = 2048;
    src.connect(analyser);
    S.mic = { stream, ctx, analyser, buf: new Float32Array(analyser.fftSize) };
    micStatus.textContent = 'Microphone: Enabled';
    return true;
  }catch(e){
    micStatus.textContent = 'Microphone: Access Denied';
    return false;
  }
}

function measureTone(ms=1000){
  return new Promise(res=>{
    if (!S.mic.analyser){ res({bucket:'ASSERTIVE'}); return; }
    const {analyser, buf} = S.mic;
    const t0 = performance.now();
    let frames=0, sumAbs=0, pace=0, prev=0;
    (function loop(){
      analyser.getFloatTimeDomainData(buf);
      let abs=0;
      for (let i=0;i<buf.length;i++){ const v=buf[i]; abs+=Math.abs(v); pace+=Math.abs(v-prev); prev=v; }
      sumAbs += abs/buf.length; frames++;
      if (performance.now()-t0 < ms) requestAnimationFrame(loop);
      else {
        const rms = (sumAbs/frames)||0, paceNorm = pace/(frames*buf.length);
        let bucket='CALM'; if (rms>0.6 || paceNorm>0.008) bucket='AGGRESSIVE'; else if (rms>=0.25) bucket='ASSERTIVE';
        res({bucket});
      }
    })();
  });
}

// optional desktop STT (Quest often lacks it)
function runSTT(timeoutMs=1400){
  return new Promise(resolve=>{
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR){ resolve(''); return; }
    const r = new SR(); r.lang='en-US'; r.interimResults=false; r.maxAlternatives=1;
    let done=false; const t = setTimeout(()=>{ if(!done){done=true; r.stop(); resolve(''); } }, timeoutMs+400);
    r.onresult = e=>{ if(done) return; done=true; clearTimeout(t); resolve(e.results[0][0].transcript||''); };
    r.onerror = ()=>{ if(!done){done=true; clearTimeout(t); resolve(''); } };
    r.onend   = ()=>{ if(!done){done=true; clearTimeout(t); resolve(''); } };
    r.start(); setTimeout(()=> r.stop(), timeoutMs);
  });
}

// ---------- Scoring, mood, and reactions ----------
function score(turn, text, tone){
  const t = (text||'').toLowerCase();
  const hasGood = turn.options.some(o => (o.good||[]).some(k => t.includes(k)));
  const hasBad  = turn.options.some(o => (o.bad ||[]).some(k => t.includes(k)));
  if (hasGood && tone!=='AGGRESSIVE') return 'STRONG';
  if (hasBad  || tone==='AGGRESSIVE') return 'ESCALATE';
  return 'NEUTRAL';
}
function adjustMood(branch){
  if (branch==='STRONG') S.mood = Math.min(3, S.mood+1);
  if (branch==='ESCALATE') S.mood = Math.max(-3, S.mood-1);
  // visuals:
  if (S.mood<=-1){ setAggExpression('angry', 0.9); moveAggTo(-1.25, 300); }
  else if (S.mood>=2){ setAggExpression('happy', 0.6); moveAggTo(-1.9, 400); }
  else { setAggExpression('neutral', 0.0); moveAggTo(-1.6, 300); }
}

function setSubtitle(v){ subtitle.setAttribute('text','value', v); }
function setYou(v){ youSaid.setAttribute('text','value', v? `You: ${v}` : ''); }

function labelOptions(round){
  const [o1,o2,o3] = round.options;
  opt1text.setAttribute('text','value', o1.label);
  opt2text.setAttribute('text','value', o2.label);
  opt3text.setAttribute('text','value', o3.label);
}

// ---------- Flow ----------
function showRound(){
  const round = SCENARIO.rounds[S.round];
  setSubtitle(`${round.name}\n${round.npc_line}`);
  setYou('');
  labelOptions(round);

  // Actor behavior cue
  if (S.round===0){
    setAggExpression('angry', 0.9); playAggClip('No', 900); moveAggTo(-1.25, 400); driverConcern();
  } else if (S.round===1){
    playAggClip('Idle', 600);
  } else if (S.round===2){
    playAggClip('Yes', 600);
  } else {
    // aftercare: calm
    setAggExpression('happy', 0.5); playAggClip('Wave', 1000); moveAggTo(-1.9, 600);
  }
}

// apply response (either from button or voice)
function applyResponse(text, chosenTag){
  const round = SCENARIO.rounds[S.round];
  const tone = S.mic.stream ? S.lastTone : 'ASSERTIVE';
  const branch = score(round, text || chosenTag || '', tone);
  const react = round.branches[branch];
  setYou(text ? `${text}  (${tone})` : `${chosenTag}  (${tone})`);

  // Aggressor reaction
  if (branch==='ESCALATE'){ playAggClip('No', 900); setAggExpression('angry', 1.0); moveAggTo(-1.1, 300); }
  if (branch==='STRONG'){   playAggClip('Yes', 900); setAggExpression('neutral', 0.0); moveAggTo(-1.8, 400); }
  if (branch==='NEUTRAL'){  setAggExpression('neutral', 0.1); }

  setSubtitle(react.react);
  S.path.push({ round:S.round, branch, outcome:react.outcome, tone, text:text||chosenTag||'' });
  adjustMood(branch);

  const wait = 900 + (S.mood<0 ? 500 : 200);
  setTimeout(()=>{
    if (S.round >= SCENARIO.rounds.length - 1) endGame();
    else { S.round++; showRound(); }
  }, wait);
}

function endGame(){
  const win = S.path.some(p=>p.outcome==='cooling');
  const title = win ? '✅ You cooled it down.' : '⚠️ Let’s improve that boundary.';
  const last = S.path[S.path.length-1] || {};
  const good  = win ? 'What worked:\n• Short, clear boundary.\n• No labels/insults.\n• Steady tone.'
                    : 'Try this:\n• One sentence boundary.\n• Behavior, not identity.\n• Lower volume; slow pace.';
  const better = '“That’s not okay. Please stop.”\n“We’re just riding; let them be.”';

  $('#uiPanel').setAttribute('visible','false');
  feedbackCard.setAttribute('visible', true);
  feedbackCard.setAttribute('animation__in','property: scale; from: 0 0 0; to: 1 1 1; dur: 600; easing: easeOutBack');

  cardTitle.setAttribute('text','value', title);
  cardBody.setAttribute('text','value',
    `Last response: “${last.text||'—'}”\nTone: ${last.tone||S.lastTone}\n\n${good}\n\nBetter lines:\n${better}`);
}

function resetAll(){
  S.round = 0; S.mood = 0; S.lastTone='ASSERTIVE'; S.lastText=''; S.path=[];
  $('#uiPanel').setAttribute('visible','true');
  feedbackCard.setAttribute('visible', false);
  feedbackCard.removeAttribute('animation__in');
  showRound();
}

// ---------- Click binding ----------
function bindClickable(el, handler){
  el.classList.add('clickable');
  el.addEventListener('click', handler);
  // show hover dot when ray hits this el
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
bindClickable(opt1, ()=> {
  const lbl = opt1text.getAttribute('text').value;
  const tag = SCENARIO.rounds[S.round].options[0].tag;
  applyResponse(lbl, tag);
});
bindClickable(opt2, ()=> {
  const lbl = opt2text.getAttribute('text').value;
  const tag = SCENARIO.rounds[S.round].options[1].tag;
  applyResponse(lbl, tag);
});
bindClickable(opt3, ()=> {
  const lbl = opt3text.getAttribute('text').value;
  const tag = SCENARIO.rounds[S.round].options[2].tag;
  applyResponse(lbl, tag);
});
bindClickable($('#btnReplay'), resetAll);
bindClickable($('#btnSave'), exportCardPNG);

// ---------- Mic UI ----------
micPermissionBtn.addEventListener('click', async ()=>{
  const ok = await enableMic();
  if (ok){
    micPermissionBtn.textContent = 'Mic Enabled';
    micPermissionBtn.style.background = 'rgba(0, 200, 100, .95)';
  }
});

// Optional: bind “Speak Now” on desktop by pressing “S”
window.addEventListener('keydown', async (e)=>{
  if (e.key.toLowerCase()==='s'){
    await doSpeakFlow();
  }
});

async function doSpeakFlow(){
  const ok = await enableMic(); if (!ok) return;
  const {bucket} = await measureTone(1000);
  S.lastTone = bucket;
  // try STT (desktop). On Quest, STT likely unavailable—user can just pick a button.
  const text = await runSTT(1400);
  if (!text){ setYou(`(Voice tone: ${S.lastTone}). Pick an option or say a short line.`); return; }
  applyResponse(text, 'VOICE');
}

// ---------- Feedback PNG export ----------
function exportCardPNG(){
  const cnv = $('#exportCanvas'), ctx = cnv.getContext('2d');
  const pad=20, w=cnv.width, h=cnv.height;
  // bg
  ctx.fillStyle='#00152b'; ctx.fillRect(0,0,w,h);
  // title
  const title = cardTitle.getAttribute('text').value;
  const body  = cardBody.getAttribute('text').value;
  ctx.fillStyle='#a7f3d0'; ctx.font='bold 24px system-ui, Segoe UI, Roboto'; ctx.fillText(title, pad, pad+26);
  // body (wrap)
  ctx.fillStyle='#e7edf7'; ctx.font='16px system-ui, Segoe UI, Roboto';
  wrap(ctx, body, w - pad*2).forEach((line,i)=> ctx.fillText(line, pad, pad+70 + i*22));
  // dl
  const a=document.createElement('a'); a.href=cnv.toDataURL('image/png'); a.download='bystander_coach_card.png'; a.click();
}
function wrap(ctx, text, width){
  const words=text.split(/\s+/), lines=[]; let line='';
  for (const w of words){ const t=line? line+' '+w : w; if (ctx.measureText(t).width>width){ if(line) lines.push(line); line=w; } else line=t; }
  if (line) lines.push(line); return lines;
}

// ---------- Init ----------
document.addEventListener('DOMContentLoaded', ()=>{
  setTimeout(()=> { $('#loadingScreen').style.display='none'; showRound(); }, 900);
});

// ============== END ==============
