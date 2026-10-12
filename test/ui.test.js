import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const app=readFileSync(new URL('../src/app.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../src/style.css',import.meta.url),'utf8');
test('the game is branded 포켓몬 아레나 while legacy saved-setting keys remain compatible',()=>{
  assert.match(html,/<title>포켓몬 아레나<\/title>/);
  assert.match(html,/class="brand"[^>]*aria-label="포켓몬 아레나 홈"/);
  assert.doesNotMatch(html,/은빛산|MT\.? SILVER|Mt\.? Silver/);
  assert.match(app,/const STORAGE_KEY='mt-silver-party-v4'/);
  assert.match(app,/localStorage\.getItem\('mt-silver-party-v3'\)/);
  assert.equal(JSON.parse(readFileSync(new URL('../package.json',import.meta.url))).name,'pokemon-arena');
});
test('battle and help show accessible physical arrow-key diagrams in the real key arrangement',()=>{
  for(const id of ['movement-keys','help-movement-keys']){
    const block=html.match(new RegExp('<div id="'+id+'"[^>]*>([\\s\\S]*?)<\\/div>'))?.[1];assert.ok(block,id);
    for(const [key,label,symbol] of [['ArrowUp','위로 이동','↑'],['ArrowLeft','왼쪽으로 이동','←'],['ArrowDown','아래로 이동','↓'],['ArrowRight','오른쪽으로 이동','→']]){assert.match(block,new RegExp('data-movement-key="'+key+'"'));assert.ok(block.includes('aria-label="'+label+'"'));assert.ok(block.includes('>'+symbol+'</kbd>'));}
    assert.equal((block.match(/role="img"/g)||[]).length,4);
  }
  for(const area of ['1/2','2/1','2/2','2/3'])assert.ok(css.includes('grid-area:'+area));
  assert.ok(app.includes('syncPressedKeys'));assert.ok(app.includes('heldTouchKeys'));assert.ok(app.includes('data-pressed')||app.includes('dataset.pressed'));
});
test('advanced controls and long explanations use closed-by-default disclosures',()=>{
  for(const id of ['type-filter-disclosure','opponent-settings','credits-disclosure']){const tag=html.match(new RegExp('<details[^>]*id="'+id+'"[^>]*>'))?.[0];assert.ok(tag,id);assert.doesNotMatch(tag,/\sopen(?:[\s=>])/);}
  assert.match(app,/<details class="guide-description">/);
  assert.match(app,/move-guide'\)\.dataset\.pokemonId=id/);
  assert.match(html,/id="help-pokemon-portrait"/);
});
test('every literal application element reference still resolves after removing UI clutter',()=>{
  const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);assert.equal(new Set(ids).size,ids.length,'duplicate HTML IDs');const refs=[...new Set([...app.matchAll(/\$\('([^']+)'\)/g)].map(m=>m[1]))];for(const id of refs)assert.ok(ids.includes(id),'missing #'+id);
});

test('the sound icon retains an accessible name when its mobile text is hidden',()=>{assert.match(html,/<button id="music-toggle" aria-label="모든 소리 끄기">/);assert.match(app,/setAttribute\('aria-label',muted\?'모든 소리 켜기':'모든 소리 끄기'\)/);});
