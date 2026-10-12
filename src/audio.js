export class AudioManager {
  constructor(){
    this.music=new Audio('/assets/audio/pokemon-hgss-battle-champion.mp3');this.music.loop=true;this.music.preload='auto';this.music.volume=.32;
    this.muted=false;this.started=false;this.ctx=null;this.volume=.32;this.music.addEventListener('error',()=>{this.failed=true;});
  }
  async start(){this.started=true;try{this.ctx||=new (window.AudioContext||window.webkitAudioContext)();await this.ctx.resume();if(!this.muted)await this.music.play();}catch{this.blocked=true;}}
  toggle(){this.muted=!this.muted;this.music.muted=this.muted;if(this.started&&!this.muted)this.music.play().catch(()=>{this.blocked=true;});return this.muted;}
  setVolume(v){this.volume=Math.max(0,Math.min(1,v));this.music.volume=this.volume;}
  pause(){this.music.pause();}
  resume(){if(this.started&&!this.muted)this.music.play().catch(()=>{this.blocked=true;});}
  tone({from=500,to=200,duration=.12,type='triangle',volume=.035,delay=0}){
    const ac=this.ctx,now=ac.currentTime+delay,gain=ac.createGain(),osc=ac.createOscillator(),peak=Math.max(.0001,volume*(.45+this.volume));
    gain.connect(ac.destination);osc.connect(gain);osc.type=type;osc.frequency.setValueAtTime(Math.max(20,from),now);osc.frequency.exponentialRampToValueAtTime(Math.max(20,to),now+duration);
    gain.gain.setValueAtTime(.0001,now);gain.gain.exponentialRampToValueAtTime(peak,now+Math.min(.012,duration*.2));gain.gain.exponentialRampToValueAtTime(.0001,now+duration);
    osc.start(now);osc.stop(now+duration+.02);osc.onended=()=>{osc.disconnect();gain.disconnect();};
  }
  noise({duration=.18,volume=.018,highpass=80,delay=0}){
    const ac=this.ctx,now=ac.currentTime+delay,length=Math.max(1,Math.ceil(ac.sampleRate*duration)),buffer=ac.createBuffer(1,length,ac.sampleRate),data=buffer.getChannelData(0);
    for(let i=0;i<length;i++)data[i]=(Math.random()*2-1)*(1-i/length);
    const source=ac.createBufferSource(),filter=ac.createBiquadFilter(),gain=ac.createGain();source.buffer=buffer;filter.type='highpass';filter.frequency.value=highpass;gain.gain.setValueAtTime(Math.max(.0001,volume*(.45+this.volume)),now);gain.gain.exponentialRampToValueAtTime(.0001,now+duration);
    source.connect(filter);filter.connect(gain);gain.connect(ac.destination);source.start(now);source.stop(now+duration+.01);source.onended=()=>{source.disconnect();filter.disconnect();gain.disconnect();};
  }
  sfx(kind){
    if(!this.ctx||this.muted)return;
    if(kind==='basic'){this.tone({from:620,to:280,duration:.075,type:'square',volume:.016});this.tone({from:980,to:520,duration:.06,type:'triangle',volume:.012,delay:.012});return;}
    if(kind==='beam'){this.tone({from:150,to:920,duration:.18,type:'sawtooth',volume:.025});this.tone({from:780,to:210,duration:.34,type:'triangle',volume:.027,delay:.12});this.noise({duration:.28,volume:.009,highpass:500,delay:.08});return;}
    if(kind==='pulse'){this.tone({from:220,to:70,duration:.24,type:'sine',volume:.04});this.tone({from:520,to:260,duration:.18,type:'triangle',volume:.018,delay:.025});return;}
    if(kind==='detonate'){this.tone({from:105,to:28,duration:.42,type:'sawtooth',volume:.055});this.noise({duration:.34,volume:.032,highpass:45});return;}
    if(kind==='q'){this.tone({from:1100,to:220,duration:.14,type:'sawtooth',volume:.022});return;}
    if(kind==='w'||kind==='s'){this.tone({from:250,to:1400,duration:.18,type:'triangle',volume:.035});return;}
    if(kind==='e'){this.tone({from:750,to:90,duration:.1,type:'square',volume:.022});return;}
    if(kind==='r'||kind==='lightning'){this.tone({from:100,to:30,duration:.38,type:'sawtooth',volume:.06});this.noise({duration:.22,volume:.014,highpass:180});return;}
    if(kind==='hit'){this.tone({from:130,to:35,duration:.1,type:'triangle',volume:.035});this.noise({duration:.065,volume:.01,highpass:120});return;}
    if(kind==='d'||kind==='dodge'){this.noise({duration:.105,volume:.012,highpass:680});this.tone({from:980,to:230,duration:.11,type:'triangle',volume:.024});this.tone({from:1450,to:620,duration:.045,type:'square',volume:.01,delay:.045});return;}
    if(kind==='evade'){this.tone({from:1680,to:840,duration:.075,type:'triangle',volume:.018});this.tone({from:1120,to:1560,duration:.055,type:'sine',volume:.012,delay:.025});this.noise({duration:.055,volume:.005,highpass:1300,delay:.018});return;}
    if(kind==='flame'||kind==='eruption'){this.tone({from:80,to:32,duration:.2,type:'sawtooth',volume:.024});this.noise({duration:.2,volume:.012,highpass:90});return;}
    if(kind==='fight'){this.tone({from:440,to:880,duration:.4,type:'triangle',volume:.04});return;}
    this.tone({from:500,to:200,duration:.12,type:'triangle',volume:.035});
  }
}
