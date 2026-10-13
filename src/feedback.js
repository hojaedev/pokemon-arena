const clamp=(value,min,max)=>Math.max(min,Math.min(max,Number(value)||0));

export const ELEMENT_AUDIO=Object.freeze({
  normal:{base:420,accent:760,noise:520},fire:{base:170,accent:620,noise:180},water:{base:310,accent:740,noise:360},
  electric:{base:820,accent:1580,noise:1200},grass:{base:430,accent:980,noise:760},ice:{base:720,accent:1480,noise:1100},
  fighting:{base:145,accent:430,noise:240},poison:{base:235,accent:590,noise:420},ground:{base:75,accent:230,noise:90},
  flying:{base:680,accent:1360,noise:980},psychic:{base:510,accent:1190,noise:900},bug:{base:360,accent:1040,noise:820},
  rock:{base:88,accent:300,noise:120},ghost:{base:190,accent:880,noise:700},dragon:{base:125,accent:920,noise:450},
  dark:{base:82,accent:520,noise:210},steel:{base:330,accent:1320,noise:1000},fairy:{base:660,accent:1420,noise:1200}
});

const tone=(from,to,duration,volume,type='triangle',delay=0,extra={})=>({source:'tone',from,to,duration,volume,type,delay,...extra});
const noise=(duration,volume,highpass=80,delay=0,extra={})=>({source:'noise',duration,volume,highpass,delay,...extra});
const profile=element=>ELEMENT_AUDIO[element]||ELEMENT_AUDIO.normal;

const TRAINER_PLANS=Object.freeze({
  haste:[tone(430,1120,.16,.085,'sine'),tone(760,1760,.22,.07,'triangle',.035),noise(.16,.026,900)],
  exhaust:[tone(360,82,.3,.11,'sawtooth'),tone(210,105,.34,.075,'sine',.025),noise(.2,.035,120)],
  barrier:[tone(290,740,.2,.075,'sine'),tone(580,1160,.28,.065,'triangle',.045),tone(1160,820,.18,.04,'sine',.12)],
  heal:[tone(390,585,.16,.07,'sine'),tone(585,880,.2,.07,'sine',.09),tone(880,1320,.24,.055,'triangle',.19)],
  cleanse:[noise(.18,.026,1250),tone(280,1320,.28,.08,'triangle'),tone(1660,830,.14,.04,'sine',.12)],
  ignite:[noise(.28,.055,160),tone(155,72,.32,.12,'sawtooth'),tone(690,240,.18,.065,'square',.035)]
});

/** Returns a deterministic procedural voice plan. No browser APIs are used here. */
export function buildCuePlan(cue,details={}){
  const p=profile(details.element),kind=details.kind||'bolt',power=clamp(details.power??1,.35,1.5);
  if(cue.startsWith('trainer:'))return (TRAINER_PLANS[cue.slice(8)]||TRAINER_PLANS.haste).map(voice=>({...voice}));
  if(cue==='ui:hover')return [tone(720,790,.035,.025,'sine')];
  if(cue==='ui:pick')return [tone(430,720,.075,.055,'triangle'),tone(860,1080,.055,.035,'sine',.035)];
  if(cue==='ui:remove')return [tone(620,250,.1,.065,'triangle'),noise(.06,.018,700,.02)];
  if(cue==='ui:confirm')return [tone(390,780,.1,.07,'triangle'),tone(780,1170,.13,.065,'sine',.075)];
  if(cue==='ui:error')return [tone(190,118,.16,.09,'square'),tone(145,92,.17,.065,'sawtooth',.075)];
  if(cue==='ui:cancel')return [tone(510,280,.09,.052,'triangle')];
  if(cue==='fight')return [noise(.24,.055,160),tone(150,610,.34,.12,'sawtooth'),tone(440,990,.3,.075,'triangle',.08)];
  if(cue==='cast:ultimate')return [tone(58,116,.62,.15,'sawtooth'),tone(p.base*.55,p.accent,.58,.11,'triangle',.04),noise(.46,.052,70,.05),tone(p.accent*.7,p.accent*1.35,.18,.055,'square',.43)];
  if(cue==='ultimate:release')return [noise(.42,.095,55),tone(92,34,.48,.18,'sawtooth'),tone(p.accent*1.45,p.base*.7,.3,.115,'square',.018),tone(p.base,p.accent,.2,.075,'triangle',.02)];
  if(cue==='cast'){
    const shape={beam:[.45,1.55,.26],storm:[.65,1.8,.3],nova:[.55,1.35,.28],dash:[1.1,1.8,.12],slash:[1.35,.7,.11],field:[.65,1.2,.25],guard:[.8,1.5,.2],boost:[.9,1.7,.2],pulse:[.7,1.35,.2],fan:[1,1.55,.15],volley:[1.05,1.7,.14],bolt:[1.1,1.75,.13]}[kind]||[.9,1.5,.17];
    return [tone(p.base*shape[0],p.accent*shape[1],shape[2],.078*power,kind==='beam'?'sawtooth':'triangle'),tone(p.accent*.78,p.accent*1.08,Math.max(.07,shape[2]*.65),.042*power,'sine',.025),noise(Math.max(.06,shape[2]*.7),.021*power,p.noise,.015)];
  }
  if(cue==='release'){
    if(kind==='beam')return [tone(p.base*.45,p.accent*1.35,.34,.115,'sawtooth'),tone(p.accent,p.base*.6,.42,.095,'triangle',.08),noise(.34,.045,p.noise,.035)];
    if(kind==='slash'||kind==='dash')return [noise(.13,.055,850),tone(p.accent*1.45,p.base*.55,.16,.105,'sawtooth'),tone(170,72,.12,.065,'triangle',.045)];
    if(kind==='pulse')return [tone(p.base*.62,48,.3,.13,'sine'),tone(p.accent,p.base,.22,.075,'triangle',.018),noise(.18,.03,260)];
    if(kind==='field')return [tone(p.base*.65,p.base*.28,.28,.09,'sawtooth'),noise(.3,.045,p.noise)];
    return [tone(p.accent*1.05,p.base*.75,.12,.09,'triangle'),tone(p.base,p.accent*.9,.105,.055,'square',.018),noise(.1,.027,p.noise)];
  }
  if(cue==='basic')return details.melee?[noise(.075,.035,680),tone(470,105,.085,.075,'triangle')]:[tone(p.accent,p.base,.09,.065,'square'),tone(p.base,p.accent*.9,.065,.038,'triangle',.012)];
  if(cue==='impact')return [tone(details.critical?105:145,36,.115,details.critical?.135:.09,'triangle'),noise(details.critical?.13:.085,details.critical?.07:.043,details.critical?90:180),tone(p.accent*.8,p.base*.55,.075,.035,'square',.012)];
  if(cue==='hit'){
    const heavy=details.critical||(Number(details.amount)||0)>=75;
    return [tone(heavy?98:145,heavy?30:58,heavy?.15:.09,heavy?.14:.085,'triangle'),noise(heavy?.13:.075,heavy?.065:.035,heavy?75:160),...(heavy?[tone(720,180,.09,.045,'square',.02)]:[])];
  }
  if(cue==='dodge')return [noise(.15,.052,900),tone(1380,190,.16,.095,'triangle'),tone(190,520,.095,.06,'square',.045)];
  if(cue==='evade')return [tone(1540,620,.09,.08,'triangle'),noise(.09,.035,1350),tone(520,1180,.08,.045,'sine',.04)];
  if(cue==='detonate')return [tone(92,28,.4,.155,'sawtooth'),noise(.36,.09,48),tone(p.accent,p.base*.45,.24,.075,'square',.018)];
  if(cue==='shield')return [tone(260,780,.19,.075,'sine'),tone(920,610,.22,.052,'triangle',.07)];
  if(cue==='heal')return [tone(420,630,.13,.065,'sine'),tone(630,960,.16,.06,'sine',.085)];
  if(cue==='switch')return [noise(.12,.025,1000),tone(360,980,.2,.07,'triangle')];
  if(cue==='faint')return [tone(310,65,.38,.105,'triangle'),tone(150,42,.32,.065,'sawtooth',.08)];
  if(cue==='enrage')return [tone(115,58,.34,.13,'sawtooth'),noise(.28,.06,100)];
  if(cue==='trackingBreak')return [tone(1260,560,.1,.065,'triangle'),noise(.08,.028,1200)];
  if(cue==='interrupted')return [tone(690,120,.12,.075,'square'),noise(.08,.03,480)];
  return [tone(500,210,.12,.06,'triangle')];
}

/** Clamps vibration requests to a short, safe pattern. */
export function normalizeVibrationPattern(pattern,{maxPulse=120,maxTotal=420,maxEntries=7}={}){
  const source=Array.isArray(pattern)?pattern:[pattern];
  const result=[];let total=0;
  for(const raw of source.slice(0,maxEntries)){
    const duration=Math.round(clamp(raw,0,maxPulse));
    if(!duration&&result.length===0)continue;
    if(total+duration>maxTotal){const remaining=maxTotal-total;if(remaining>0)result.push(remaining);break;}
    result.push(duration);total+=duration;
  }
  return result.length?result:[0];
}

export function hapticForCue(cue,details={}){
  if(cue==='cast')return {pattern:[details.kind==='dash'||details.kind==='slash'?22:14],strong:.22,weak:.38,throttle:65};
  if(cue==='release')return {pattern:[details.kind==='beam'?38:20],strong:.3,weak:.42,throttle:55};
  if(cue==='cast:ultimate')return {pattern:[55,35,75],strong:.75,weak:.45,throttle:120};
  if(cue==='ultimate:release'||cue==='detonate')return {pattern:[95,25,120],strong:1,weak:.7,throttle:90};
  if(cue==='dodge')return {pattern:[24,18,38],strong:.45,weak:.7,throttle:55};
  if(cue==='evade')return {pattern:[18,12,26],strong:.3,weak:.75,throttle:55};
  if(cue==='hit'){
    // Auto attacks and damage-over-time should not mask deliberate skill contact.
    if(details.periodic||details.basic)return null;
    const dealt=details.team==='player';
    return {pattern:details.critical?[24,18,72]:dealt?[16,14,38]:[28],strong:details.critical?.85:.5,weak:.65,throttle:85,priority:dealt?3:2};
  }
  if(cue.startsWith('trainer:'))return {pattern:[32,22,48],strong:.5,weak:.45,throttle:75};
  if(cue==='ui:confirm')return {pattern:[22],strong:.25,weak:.35,throttle:80};
  if(cue==='ui:error')return {pattern:[45,35,45],strong:.5,weak:.35,throttle:120};
  return null;
}
