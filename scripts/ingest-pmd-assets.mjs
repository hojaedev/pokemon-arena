#!/usr/bin/env node
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {existsSync} from 'node:fs';
import {cp, mkdir, mkdtemp, readFile, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';

const REVISION='cd566fffbcd8e1001cee8ec511f42c07e8d65457';
const REPOSITORY='https://github.com/PMDCollab/SpriteCollab';
const ROOT=path.resolve(import.meta.dirname,'..');
const OUTPUT=path.join(ROOT,'public/assets/pokemon');
const CREDIT_OUTPUT=path.join(ROOT,'public/assets/sprite-credits.json');
const DIRECTIONS=['down','downRight','right','upRight','up','upLeft','left','downLeft'];
const POKEMON=[
 ['pikachu',25,'Pikachu'],['charizard',6,'Charizard'],['eevee',133,'Eevee'],['mewtwo',150,'Mewtwo'],['gengar',94,'Gengar'],
 ['snorlax',143,'Snorlax'],['dragonite',149,'Dragonite'],['blastoise',9,'Blastoise'],['venusaur',3,'Venusaur'],['gyarados',130,'Gyarados'],
 ['mew',151,'Mew'],['bulbasaur',1,'Bulbasaur'],['charmander',4,'Charmander'],['squirtle',7,'Squirtle'],['lugia',249,'Lugia'],
 ['ho-oh',250,'Ho-Oh'],['umbreon',197,'Umbreon'],['espeon',196,'Espeon'],['vaporeon',134,'Vaporeon'],['jolteon',135,'Jolteon'],
 ['flareon',136,'Flareon'],['articuno',144,'Articuno'],['zapdos',145,'Zapdos'],['moltres',146,'Moltres'],['arcanine',59,'Arcanine'],
 ['lapras',131,'Lapras'],['alakazam',65,'Alakazam'],['machamp',68,'Machamp'],['raichu',26,'Raichu'],['psyduck',54,'Psyduck'],
 ['togepi',175,'Togepi'],['scizor',212,'Scizor'],['tyranitar',248,'Tyranitar'],['suicune',245,'Suicune'],['entei',244,'Entei'],
 ['raikou',243,'Raikou'],['celebi',251,'Celebi'],['heracross',214,'Heracross'],['steelix',208,'Steelix'],['houndoom',229,'Houndoom'],
 ['kingdra',230,'Kingdra'],['crobat',169,'Crobat'],['feraligatr',160,'Feraligatr'],['typhlosion',157,'Typhlosion'],['ampharos',181,'Ampharos'],
 ['meganium',154,'Meganium'],['ninetales',38,'Ninetales'],['nidoking',34,'Nidoking'],['scyther',123,'Scyther'],['aerodactyl',142,'Aerodactyl'],
].map(([slug,dex,name])=>({slug,dex:String(dex).padStart(4,'0'),name}));
const USEFUL=new Set(['Attack','Shoot','Charge','Swing','Strike','QuickStrike','Shock','Double','Hop','Emit','Special0','MultiScratch','SpAttack','Ricochet','Withdraw','Shake','Punch','Kick','Hover','Stomp','RearUp','Rumble','Slice','Appeal','Dance','Jab','Slam','TailWhip','Twirl','Pain','Faint']);
const CORE={idle:'Idle',walk:'Walk',attack:'Attack',hurt:'Hurt'};

const textTag=(xml,tag)=>xml.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`,'i'))?.[1]?.trim();
const numberTag=(xml,tag)=>{const value=textTag(xml,tag);return value==null?undefined:Number(value);};
const slugKey=name=>name.toLowerCase().replace(/[^a-z0-9]+/g,'');
const sha256=buffer=>createHash('sha256').update(buffer).digest('hex');
function pngSize(buffer){
 if(buffer.length<24||buffer.toString('ascii',1,4)!=='PNG')throw new Error('Not a PNG');
 return {width:buffer.readUInt32BE(16),height:buffer.readUInt32BE(20)};
}
function parseAnimations(xml){
 const map=new Map();
 for(const match of xml.matchAll(/<Anim>([\s\S]*?)<\/Anim>/g)){
  const block=match[1],name=textTag(block,'Name'); if(!name)continue;
  map.set(name,{name,index:numberTag(block,'Index'),copyOf:textTag(block,'CopyOf'),frameWidth:numberTag(block,'FrameWidth'),frameHeight:numberTag(block,'FrameHeight'),rushFrame:numberTag(block,'RushFrame'),hitFrame:numberTag(block,'HitFrame'),returnFrame:numberTag(block,'ReturnFrame'),durations:[...block.matchAll(/<Duration>(\d+)<\/Duration>/g)].map(m=>Number(m[1]))});
 }
 return map;
}
function resolveAnimation(map,name,trail=[]){
 const entry=map.get(name); if(!entry)throw new Error(`Missing animation ${name}`);
 if(!entry.copyOf)return {...entry,sourceName:name,copyChain:trail};
 if(trail.includes(name))throw new Error(`CopyOf cycle: ${[...trail,name].join(' -> ')}`);
 const resolved=resolveAnimation(map,entry.copyOf,[...trail,name]);
 return {...resolved,name,index:entry.index??resolved.index,copyOf:entry.copyOf,sourceName:resolved.sourceName,copyChain:[...trail,name]};
}
function parseCreditNames(raw){
 const map=new Map();
 for(const line of raw.split(/\r?\n/).slice(1)){
  const [name,discord,contact]=line.split('\t');
  if(name)map.set(name,{name,contact:contact||undefined});
  if(discord)map.set(discord,{name:name||discord,contact:contact||undefined});
 }
 return map;
}
function parseCredits(raw,asset,selected,aliases){
 const rows=[];
 for(const line of raw.trim().split(/\r?\n/)){
  const [recordedAt,recordedAs,status,recordedLicense,scope='']=line.split('\t');
  if(!recordedAs||status!=='CUR')continue;
  const scopes=scope.split(',').map(s=>s.trim()).filter(Boolean);
  const relevant=scopes.some(s=>selected.has(s)||aliases.has(s));
  if(!relevant)continue;
  rows.push({asset,recordedAt,recordedAs,status,recordedLicense,scope:scopes.filter(s=>selected.has(s)||aliases.has(s)).join(', ')||scope});
 }
 return rows;
}
function uniqueRecords(records,names){
 const seen=new Set(),out=[];
 for(const record of records){
  const mapped=names.get(record.recordedAs)||{name:record.recordedAs};
  const normalized={creator:mapped.name,contact:mapped.contact,asset:record.asset,scope:record.scope,recordedLicense:record.recordedLicense,recordedAt:record.recordedAt};
  if(mapped.name!==record.recordedAs)normalized.recordedAs=record.recordedAs;
  if(!normalized.contact)delete normalized.contact;
  const key=JSON.stringify(normalized);if(seen.has(key))continue;seen.add(key);out.push(normalized);
 }
 return out;
}
async function ensureSource(requested){
 if(requested){
  const resolved=path.resolve(requested); if(!existsSync(path.join(resolved,'sprite')))throw new Error(`Invalid SpriteCollab source: ${resolved}`);return {dir:resolved,cleanup:false};
 }
 const base=await mkdtemp(path.join(tmpdir(),'spritecollab-')),dir=path.join(base,'repo');
 execFileSync('git',['clone','--filter=blob:none','--no-checkout',`${REPOSITORY}.git`,dir],{stdio:'inherit'});
 execFileSync('git',['-C',dir,'sparse-checkout','init','--cone'],{stdio:'inherit'});
 execFileSync('git',['-C',dir,'sparse-checkout','set','sprite','portrait'],{stdio:'inherit'});
 execFileSync('git',['-C',dir,'checkout',REVISION],{stdio:'inherit'});
 return {dir,cleanup:true,base};
}
async function ingest(source){
 const creditNames=parseCreditNames(await readFile(path.join(source,'credit_names.txt'),'utf8'));
 const credits={source:{name:'PMD SpriteCollab',repository:REPOSITORY,revision:REVISION,website:'https://sprites.pmdcollab.org/',retrieved:'2026-10-11'},repositoryPolicy:{summary:'SpriteCollab submissions may be copied, redistributed, remixed, and transformed for non-commercial use with appropriate credit under CC BY-NC 4.0.',licenseName:'Creative Commons Attribution-NonCommercial 4.0 International',licenseUrl:'https://creativecommons.org/licenses/by-nc/4.0/',importantPerFileCaveat:"The repository's per-file credit records mark official CHUNSOFT assets as 'Unspecified'. Do not relabel those official files as CC BY-NC. Preserve the raw credits and credit CHUNSOFT/Spike Chunsoft plus PMD SpriteCollab. Custom files marked PMDCollab_1 retain that historical permission statement and artist credit. PMDCollab_2 and CC_BY-NC_4 records must likewise be followed as recorded in the bundled raw files.",historicalPMDCollab1:'Permission is provided for others to use, copy, redistribute, or modify files for their own projects and contributions, so long as credit to the original artist is retained.'},assets:{}};
 for(const pokemon of POKEMON){
  const sourceSprite=path.join(source,'sprite',pokemon.dex),sourcePortrait=path.join(source,'portrait',pokemon.dex),dest=path.join(OUTPUT,pokemon.slug),destSprite=path.join(dest,'sprite'),destPortrait=path.join(dest,'portrait');
  await rm(dest,{recursive:true,force:true});await mkdir(destSprite,{recursive:true});await mkdir(destPortrait,{recursive:true});
  const xmlRaw=await readFile(path.join(sourceSprite,'AnimData.xml'),'utf8'),animationMap=parseAnimations(xmlRaw),shadowSize=numberTag(xmlRaw,'ShadowSize')??1;
  const selected=new Map(Object.entries(CORE).map(([key,name])=>[key,{requested:name,resolved:resolveAnimation(animationMap,name)}]));
  const shootName=animationMap.has('Shoot')?'Shoot':'Attack';selected.set('shoot',{requested:'Shoot',resolved:resolveAnimation(animationMap,shootName),fallback:shootName!=='Shoot'});
  const faintName=['Faint','Pain','Hurt'].find(name=>animationMap.has(name));selected.set('faint',{requested:'Faint',resolved:resolveAnimation(animationMap,faintName),fallback:faintName!=='Faint'});
  for(const name of animationMap.keys())if(USEFUL.has(name)){const key=slugKey(name);if(!selected.has(key))selected.set(key,{requested:name,resolved:resolveAnimation(animationMap,name)});}
  const physical=new Set();for(const {resolved} of selected.values())physical.add(resolved.sourceName);
  for(const name of physical)for(const suffix of ['Anim','Offsets','Shadow'])await cp(path.join(sourceSprite,`${name}-${suffix}.png`),path.join(destSprite,`${name}-${suffix}.png`));
  await cp(path.join(sourceSprite,'AnimData.xml'),path.join(destSprite,'AnimData.xml'));await cp(path.join(sourceSprite,'credits.txt'),path.join(destSprite,'credits.txt'));
  await cp(path.join(sourcePortrait,'Normal.png'),path.join(destPortrait,'Normal.png'));await cp(path.join(sourcePortrait,'credits.txt'),path.join(destPortrait,'credits.txt'));
  const manifest={schemaVersion:1,pokemon:{dex:pokemon.dex,name:pokemon.name,slug:pokemon.slug},source:{name:'PMD SpriteCollab',repository:REPOSITORY,revision:REVISION,sourceDirectory:`sprite/${pokemon.dex}`,metadata:`/assets/pokemon/${pokemon.slug}/sprite/AnimData.xml`,rawCredits:`/assets/pokemon/${pokemon.slug}/sprite/credits.txt`},timing:{unit:'frames',framesPerSecond:60,note:'Each duration value is 1/60 second.'},layout:{frameOrder:'left-to-right',directionOrder:'top-to-bottom',directions:DIRECTIONS,transparentBackground:true},rendering:{nativeScale:1,preferredScale:2,preferredCanvasSize:{width:1280,height:720},interpolation:'nearest-neighbor',cssImageRendering:'pixelated',note:'Keep integer scaling.'},shadow:{repositoryShadowSize:shadowSize,note:'Shadow PNG uses white anchor pixels; RGB channels may also encode shadow areas.'},offsets:{note:'Offsets PNG markers: green body center, red left hand, blue right hand, black head; colors combine when markers overlap.'},portrait:{normal:{url:`/assets/pokemon/${pokemon.slug}/portrait/Normal.png`,...pngSize(await readFile(path.join(sourcePortrait,'Normal.png'))),preferredHudScale:2,sha256:sha256(await readFile(path.join(sourcePortrait,'Normal.png')))},rawCredits:`/assets/pokemon/${pokemon.slug}/portrait/credits.txt`},animations:{}};
  for(const [key,item] of selected){
   const a=item.resolved,imageName=a.sourceName,image=await readFile(path.join(sourceSprite,`${imageName}-Anim.png`)),offsets=await readFile(path.join(sourceSprite,`${imageName}-Offsets.png`)),shadow=await readFile(path.join(sourceSprite,`${imageName}-Shadow.png`)),size=pngSize(image),directionCount=size.height/a.frameHeight,frameCount=size.width/a.frameWidth;
   if(!Number.isInteger(directionCount)||!Number.isInteger(frameCount))throw new Error(`${pokemon.slug}/${a.name} has non-integral sheet layout`);
   const durations=a.durations;if(durations.length!==frameCount)throw new Error(`${pokemon.slug}/${a.name}: ${durations.length} timings for ${frameCount} frames`);
   const entry={name:item.requested,index:a.index,frameWidth:a.frameWidth,frameHeight:a.frameHeight,frameCount,directionCount,directions:directionCount===8?DIRECTIONS:Array.from({length:directionCount},(_,i)=>`direction${i}`),sheetWidth:size.width,sheetHeight:size.height,durationsFrames:durations,durationsMs:durations.map(value=>Math.round(value/60*1000)),loop:key==='idle'||key==='walk',image:`/assets/pokemon/${pokemon.slug}/sprite/${imageName}-Anim.png`,offsetsImage:`/assets/pokemon/${pokemon.slug}/sprite/${imageName}-Offsets.png`,shadowImage:`/assets/pokemon/${pokemon.slug}/sprite/${imageName}-Shadow.png`,sha256:{image:sha256(image),offsets:sha256(offsets),shadow:sha256(shadow)}};
   if(a.copyOf)entry.copyOf=a.copyOf;if(a.sourceName!==item.requested)entry.sourceAnimation=a.sourceName;if(item.fallback)entry.fallbackFor=item.requested;
   for(const marker of ['rushFrame','hitFrame','returnFrame'])if(Number.isFinite(a[marker]))entry[marker]=a[marker];
   manifest.animations[key]=entry;
  }
  await writeFile(path.join(dest,'animations.json'),`${JSON.stringify(manifest,null,2)}\n`);
  const spriteRaw=await readFile(path.join(sourceSprite,'credits.txt'),'utf8'),portraitRaw=await readFile(path.join(sourcePortrait,'credits.txt'),'utf8'),selectedNames=new Set([...selected.values()].flatMap(({requested,resolved})=>[requested,resolved.sourceName])),aliasNames=new Set([...animationMap.values()].filter(a=>a.copyOf&&selectedNames.has(a.name)).flatMap(a=>[a.name,a.copyOf]));
  const records=uniqueRecords([...parseCredits(spriteRaw,'sprite',selectedNames,aliasNames),...parseCredits(portraitRaw,'portrait',new Set(['Normal']),new Set())],creditNames);
  credits.assets[pokemon.slug]={dex:pokemon.dex,manifest:`/assets/pokemon/${pokemon.slug}/animations.json`,spriteCreditRecords:`/assets/pokemon/${pokemon.slug}/sprite/credits.txt`,portraitCreditRecords:`/assets/pokemon/${pokemon.slug}/portrait/credits.txt`,credits:records,suggestedDisplayCredit:`${pokemon.name} sprites/portrait: ${[...new Set(records.map(r=>r.creator))].join(', ')}, via PMD SpriteCollab. See bundled per-file credit records and recorded licenses.`};
  console.log(`${pokemon.slug}: ${Object.keys(manifest.animations).length} manifest animations, ${physical.size} source sheets`);
 }
 await writeFile(CREDIT_OUTPUT,`${JSON.stringify(credits,null,2)}\n`);
}

const sourceArg=process.argv.includes('--source')?process.argv[process.argv.indexOf('--source')+1]:process.env.PMD_SPRITECOLLAB_SOURCE;
const checkout=await ensureSource(sourceArg);
try{await ingest(checkout.dir);}finally{if(checkout.cleanup)await rm(checkout.base,{recursive:true,force:true});}
