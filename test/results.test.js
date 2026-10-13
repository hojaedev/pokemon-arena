import test from 'node:test';
import assert from 'node:assert/strict';
import {Battle} from '../src/battle.js';
import {pickMvp,VictoryConfetti} from '../src/results.js';
import {encodeBattle,applyBattleState,checkpointBattle,restoreBattle,localEvent} from '../src/net-state.js';
const setup=()=>{const b=new Battle({playerTeam:['pikachu','charizard'],enemyTeam:['eevee','gengar'],mode:'pvp'});b.state='playing';b.drainEvents();return b;};
test('MVP counts HP damage, excluding shields and overkill, and attributes KO exactly once',()=>{
 const b=setup();b.enemy.hp=100;b.enemy.shield=50;b.damage(b.enemy,900,'player');b.damage(b.enemy,900,'player');assert.deepEqual(b.stats.byPokemon.pikachu,{damage:100,knockouts:1});assert.equal(pickMvp(b.playerTeam,b.stats).id,'pikachu');assert.equal(pickMvp(b.enemyTeam,b.rivalStats),null);
});
test('persistent damage remains credited to the caster after a switch',()=>{
 const b=setup();b.damage(b.enemy,30,'player',{burn:3});const caster=b.player.id;b.sendOut('player',1);b.damage(b.enemy,4,'player',{periodic:true,sourceId:b.enemy.burnSourceId});assert.equal(b.stats.byPokemon[caster].damage,34);assert.equal(b.stats.byPokemon.charizard,undefined);
});
test('MVP stats survive checkpoints and reverse correctly for the guest',()=>{
 const b=setup();b.damage(b.enemy,80,'player');b.damage(b.player,140,'enemy');const restored=restoreBattle(checkpointBattle(b));assert.deepEqual(restored.stats.byPokemon,b.stats.byPokemon);const guest=applyBattleState(new Battle(),encodeBattle(b),'enemy');assert.equal(pickMvp(guest.playerTeam,guest.stats).id,'eevee');b.finish(true);const end=b.drainEvents().find(e=>e.type==='end');assert.equal(pickMvp(guest.playerTeam,localEvent(end,'enemy').stats).id,'eevee');
});
test('MVP selection is stable, roster-scoped and resets between matches',()=>{
 const team=[{id:'pikachu'},{id:'charizard'}],stats={byPokemon:{pikachu:{damage:1000,knockouts:0},charizard:{damage:800,knockouts:1},gengar:{damage:5000,knockouts:6}}};assert.equal(pickMvp(team,stats).id,'charizard');stats.byPokemon.charizard={damage:1000,knockouts:0};assert.equal(pickMvp(team,stats).id,'pikachu');const b=setup();b.damage(b.enemy,100,'player');b.start();assert.equal(pickMvp(b.playerTeam,b.stats),null);
});
test('confetti respects defeat, reduced motion, and finite lifetime',()=>{
 const ctx=new Proxy({},{get:()=>()=>{}}),fx=new VictoryConfetti({getContext:()=>ctx,width:400,height:800});fx.start({won:false});assert.equal(fx.pieces.length,0);fx.start({won:true,reducedMotion:true});assert.equal(fx.pieces.length,0);fx.start({won:true});assert.equal(fx.pieces.length,72);for(let i=0;i<500;i++)fx.update(1/60);assert.equal(fx.pieces.length,0);
});
