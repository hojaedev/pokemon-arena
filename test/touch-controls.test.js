import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Thumbstick,stickVector,mergeMovement,bindBattleTouch,canTrackStick} from '../src/touch-controls.js';
import {Battle} from '../src/battle.js';

class Target {
  constructor(){this.listeners=new Map();}
  addEventListener(type,fn){if(!this.listeners.has(type))this.listeners.set(type,new Set());this.listeners.get(type).add(fn);}
  removeEventListener(type,fn){this.listeners.get(type)?.delete(fn);}
  fire(type,props={}){const event={type,target:this,pointerId:1,pointerType:'touch',button:0,clientX:100,clientY:100,detail:1,prevented:false,preventDefault(){this.prevented=true;},...props};for(const fn of this.listeners.get(type)||[])fn(event);return event;}
}
class Element extends Target {
  constructor(doc,parent,action){super();this.ownerDocument=doc;this.parent=parent;this.dataset=action?{action}:{};this.disabled=false;this.captured=new Set();this.classes=new Set();this.props=new Map();this.classList={toggle:(x,on)=>on?this.classes.add(x):this.classes.delete(x),add:x=>this.classes.add(x),remove:x=>this.classes.delete(x)};this.style={setProperty:(key,value)=>this.props.set(key,value)};}
  closest(){let n=this;while(n){if(n.dataset.action)return n;n=n.parent;}return null;}
  contains(target){while(target){if(target===this)return true;target=target.parent;}return false;}
  getBoundingClientRect(){return {left:20,top:20,width:160,height:160};}
  setPointerCapture(id){this.captured.add(id);}
  hasPointerCapture(id){return this.captured.has(id);}
  releasePointerCapture(id){if(this.captured.delete(id)){this.fire('lostpointercapture',{pointerId:id});this.parent?.fire('lostpointercapture',{pointerId:id,target:this});}}
}
function fixture(){const win=new Target(),doc=new Target();doc.defaultView=win;doc.hidden=false;const root=new Element(doc),stick=new Element(doc,root),q=new Element(doc,root,'q'),d=new Element(doc,root,'d'),s=new Element(doc,root,'s');let time=1000,playing=true;const casts=[],changes=[];const control=bindBattleTouch({stick,root,canMove:()=>playing,onAction:(key,event)=>casts.push({key,event}),onPressChange:(...args)=>changes.push(args),now:()=>time});return {win,doc,root,stick,q,d,s,control,casts,changes,setTime:n=>time=n,setPlaying:x=>playing=x};}

test('stick has a forgiving deadzone and a bounded thumb without losing continuous angles',()=>{
  assert.deepEqual(stickVector(2,-2,45),{x:0,y:0,thumbX:2,thumbY:-2});
  const v=stickVector(300,-400,50);assert.equal(v.thumbX,30);assert.equal(v.thumbY,-40);assert.equal(v.x,.6);assert.equal(v.y,-.8);
  assert.deepEqual(stickVector(NaN,0,40),{x:0,y:0,thumbX:0,thumbY:0});
  assert.equal(stickVector(15,10,45).x/stickVector(15,10,45).y,1.5);
});
test('only the owning left finger can move or release the joystick',()=>{
  const stick=new Thumbstick(),rect={left:20,top:20,width:160,height:160};
  assert.ok(stick.start(11,{x:145,y:100},rect));assert.equal(stick.value.x,1);
  assert.equal(stick.start(12,{x:50,y:100},rect),false);assert.equal(stick.move(12,{x:50,y:100}),false);assert.equal(stick.end(12),false);assert.equal(stick.value.x,1);
  assert.ok(stick.move(11,{x:100,y:145}));assert.equal(stick.value.y,1);assert.ok(stick.end(11));assert.equal(stick.pointerId,null);assert.equal(stick.value.x,0);
});
test('a held thumb survives countdown and the next opponent, but never menus or player replacement',()=>{for(const state of ['countdown','playing','transition'])assert.equal(canTrackStick(state),true);for(const state of ['ready','paused','switching','won','lost'])assert.equal(canTrackStick(state),false);});
test('releasing keyboard and touch inputs never releases the other source',()=>{
  assert.deepEqual(mergeMovement({x:0,y:0},{x:.6,y:.8}),{x:.6,y:.8});
  assert.deepEqual(mergeMovement({x:-1,y:0},{x:.6,y:.8}),{x:-1,y:0});
  assert.deepEqual(mergeMovement({x:1,y:0}),{x:1,y:0});
});
test('second-finger skills fire on touch-down while the left thumb keeps moving',()=>{
  const f=fixture();f.stick.fire('pointerdown',{pointerId:11,clientX:145});f.root.fire('pointerdown',{pointerId:12,target:f.q,isPrimary:false});
  assert.equal(f.casts.length,1);assert.equal(f.casts[0].key,'q');assert.equal(f.control.input.x,1);assert.deepEqual(f.control.getState().actions,['q']);assert.ok(f.q.classes.has('touch-held'));
  f.win.fire('pointerup',{pointerId:12});assert.equal(f.control.input.x,1);assert.equal(f.q.classes.has('touch-held'),false);
  f.win.fire('pointerup',{pointerId:11});assert.equal(f.control.input.x,0);assert.equal(f.control.getState().active,false);
});
test('right-thumb dodge and another action have independent ownership',()=>{
  const f=fixture();f.stick.fire('pointerdown',{pointerId:11,clientY:55});f.root.fire('pointerdown',{pointerId:12,target:f.d});f.root.fire('pointerdown',{pointerId:13,target:f.s});
  assert.deepEqual(f.casts.map(c=>c.key),['d','s']);f.win.fire('pointercancel',{pointerId:12});assert.deepEqual(f.control.getState().actions,['s']);assert.equal(f.control.input.y,-1);f.win.fire('pointerup',{pointerId:13});assert.equal(f.control.input.y,-1);
});
test('compatibility clicks never double-cast, even after a long held touch',()=>{
  const f=fixture();f.root.fire('pointerdown',{target:f.q,pointerId:7});f.setTime(8000);f.win.fire('pointerup',{pointerId:7});f.root.fire('click',{target:f.q,pointerType:undefined});f.root.fire('click',{target:f.q,pointerType:'touch'});assert.equal(f.casts.length,1);
  f.root.fire('click',{target:f.q,pointerType:undefined,detail:0});assert.equal(f.casts.length,2,'keyboard/assistive activation remains available');
  f.setTime(10000);f.root.fire('click',{target:f.q,pointerType:'mouse'});assert.equal(f.casts.length,3);
});
test('mouse clicks activate once and disabled abilities do not activate',()=>{
  const f=fixture();f.root.fire('pointerdown',{target:f.q,pointerType:'mouse'});assert.equal(f.casts.length,0);f.root.fire('click',{target:f.q,pointerType:'mouse'});assert.equal(f.casts.length,1);f.q.disabled=true;f.root.fire('pointerdown',{target:f.q,pointerId:3});f.root.fire('click',{target:f.q,pointerType:'mouse'});assert.equal(f.casts.length,1);
});
test('lost capture, cancellation, pause/reset, blur and hidden tabs cannot leave drift',()=>{
  for(const interrupt of ['pointercancel','lostpointercapture','reset','blur','hidden']){const f=fixture();f.stick.fire('pointerdown',{pointerId:1,clientX:145});f.root.fire('pointerdown',{pointerId:2,target:f.q});
    if(interrupt==='pointercancel')f.win.fire('pointercancel',{pointerId:1});else if(interrupt==='lostpointercapture')f.stick.fire(interrupt,{pointerId:1});else if(interrupt==='reset')f.control.reset();else if(interrupt==='blur')f.win.fire('blur');else{f.doc.hidden=true;f.doc.fire('visibilitychange');}
    assert.deepEqual(f.control.input,{x:0,y:0},interrupt);f.control.reset();assert.equal(f.control.getState().actions.length,0);assert.equal(f.q.classes.has('touch-held'),false);assert.equal(f.stick.props.get('--stick-x'),'0.00px');
  }
});
test('a paused game does not accept a new stick or retain a moved stick',()=>{
  const f=fixture();f.setPlaying(false);f.stick.fire('pointerdown',{clientX:145});assert.equal(f.control.getState().active,false);f.setPlaying(true);f.stick.fire('pointerdown',{clientX:145});f.setPlaying(false);f.win.fire('pointermove',{clientX:150});assert.deepEqual(f.control.input,{x:0,y:0});
});
test('delegated actions still work after replacing a Pokémon’s buttons without new listeners',()=>{
  const f=fixture();f.root.fire('pointerdown',{target:f.q,pointerId:9});f.control.resetActions();const replacement=new Element(f.doc,f.root,'e');f.root.fire('pointerdown',{target:replacement,pointerId:10});assert.deepEqual(f.casts.map(c=>c.key),['q','e']);assert.equal(f.root.listeners.get('pointerdown').size,1);f.control.destroy();assert.equal(f.win.listeners.get('pointermove').size,0);assert.equal(f.root.listeners.get('click').size,0);
});
test('joystick direction feeds the real dodge without changing its protection or cooldown',()=>{
  const battle=new Battle();battle.configure({playerTeam:['pikachu'],enemyTeam:['charizard'],difficulty:'beginner'});battle.start();for(let i=0;i<200;i++)battle.update(.02,{x:0,y:0});
  const start={x:battle.player.x,y:battle.player.y};battle.input=mergeMovement({x:0,y:0},stickVector(30,-40,50));assert.equal(battle.cast('d'),true);assert.equal(battle.snapshot().player.dodgeProtected,true);
  battle.update(.05,battle.input);assert.ok(battle.player.x>start.x);assert.ok(battle.player.y<start.y);assert.ok(battle.cooldowns.d>1.9);assert.equal(battle.player.hp,battle.player.maxHp);
});
test('mobile markup offers one stick, shared actions, safe areas and pause help/settings',()=>{
  const html=readFileSync(new URL('../index.html',import.meta.url),'utf8'),app=readFileSync(new URL('../src/app.js',import.meta.url),'utf8');
  assert.equal((html.match(/id="touch-stick"/g)||[]).length,1);assert.doesNotMatch(html,/id="mobile-dpad"/);assert.match(html,/viewport-fit=cover/);assert.match(html,/id="pause-help-button"/);assert.match(html,/id="pause-settings-button"/);assert.match(html,/id="help-touch-movement"/);assert.match(app,/document\.body\.classList\.add\('in-battle'\)/);assert.match(app,/document\.body\.classList\.remove\('in-battle'\)/);assert.match(app,/mobileControls\.matches\)button\.removeAttribute\('title'\)/);
});
