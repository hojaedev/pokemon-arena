import test from 'node:test';
import assert from 'node:assert/strict';
import {BattleCamera,combatBounds} from '../src/battle-camera.js';
const fighters=(x=400,y=400)=>[{x,y,radius:24,vx:0,vy:0},{x:x+150,y:y+20,radius:32,vx:0,vy:0}];
function assertFramed(camera,actors,hazards=[]){const f=camera.frame(),b=combatBounds(actors,{anticipate:false,hazards}),a=f.area;for(const [point,offset,min,max] of [[b.left*f.scale,f.offsetX,a.x,a.x+a.width],[b.right*f.scale,f.offsetX,a.x,a.x+a.width],[b.top*f.scale,f.offsetY,a.y,a.y+a.height],[b.bottom*f.scale,f.offsetY,a.y,a.y+a.height]])assert.ok(point+offset>=min-.001&&point+offset<=max+.001,JSON.stringify({f,b,point:point+offset,min,max}));}
test('portrait camera enlarges close fighters and widens to keep distant fighters visible',()=>{
 const c=new BattleCamera();c.resize(400,585,{mobile:true,insets:{top:110,bottom:16}});let actors=fighters();c.update(0,actors);const close=c.frame().scale;actors[1].x=1100;c.update(1/60,actors);assert.ok(c.frame().scale<close);assertFramed(c,actors);actors[1].x=550;const wide=c.frame().scale;c.update(1/60,actors);assert.ok(c.frame().scale<close&&c.frame().scale>wide,'zoom-in is eased');for(let i=0;i<240;i++)c.update(1/60,actors);assert.ok(c.frame().scale>wide*1.6);assertFramed(c,actors);
});
test('camera never crops either fighter during fast dashes, edge movement, or landscape resize',()=>{
 const c=new BattleCamera(),actors=fighters();c.resize(400,560,{mobile:true,insets:{top:110}});const before=structuredClone(actors);
 c.update(0,actors);assert.deepEqual(actors,before,'rendering must not change game coordinates');
 for(let i=0;i<600;i++){actors[0].x=160+(Math.sin(i*.29)+1)*450;actors[0].y=245+(Math.cos(i*.18)+1)*140;actors[1].x=170+(Math.cos(i*.31)+1)*445;actors[1].y=240+(Math.sin(i*.4)+1)*145;c.update(1/60,actors);assertFramed(c,actors);if(i===300)c.resize(844,390,{mobile:true,insets:{left:172,right:198,top:95,bottom:15}});}
});
test('nearby pending area attacks fit; reduced-motion camera stays fixed; desktop preserves full arena',()=>{
 const c=new BattleCamera(),actors=fighters(),hazards=[{x:430,y:390,r:160,delay:.5}];c.resize(400,560,{mobile:true,insets:{top:100}});c.update(0,actors,{hazards});assertFramed(c,actors,hazards);c.update(0,actors,{reducedMotion:true});const fixed=c.frame();c.update(.05,fighters(800,470),{reducedMotion:true});assert.deepEqual(c.frame(),fixed);c.resize(1280,720);assert.equal(c.update(0,actors).scale,1);for(const [key,value] of Object.entries({left:0,right:1280,top:0,bottom:720}))assert.ok(Math.abs(c.frame().world[key]-value)<.00001);
});
