import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {existsSync, readFileSync, statSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
test('static production build contains the game, real sprites, music, credits and no private project files',()=>{
  const build=spawnSync(process.execPath,['scripts/build.mjs'],{cwd:root,encoding:'utf8'});
  assert.equal(build.status,0,build.stderr);
  for(const file of ['index.html','src/app.js','src/roster.js','src/style.css','assets/pokemon/pikachu/portrait/Normal.png','assets/pokemon/pikachu/animations.json','assets/audio/pokemon-hgss-battle-champion.mp3','assets/audio/music-credits.json','assets/sprite-credits.json','robots.txt']){
    assert.ok(statSync(resolve(root,'dist',file)).size>0,`missing ${file}`);
  }
  for(const file of ['.git','.env','.vercel','server.mjs','test','scripts','README.md'])assert.equal(existsSync(resolve(root,'dist',file)),false,`private build leak: ${file}`);
  assert.equal(readFileSync(resolve(root,'dist/src/roster.js'),'utf8'),readFileSync(resolve(root,'src/roster.js'),'utf8'));
});
test('Vercel uses the isolated static build and marks the fan game noindex',()=>{
  const config=JSON.parse(readFileSync(resolve(root,'vercel.json'),'utf8'));
  assert.equal(config.buildCommand,'npm run build');
  assert.equal(config.outputDirectory,'dist');
  assert.equal(config.framework,null);
  assert.ok(config.headers.some(rule=>rule.headers.some(header=>header.key==='X-Robots-Tag'&&header.value.includes('noindex'))));
});
