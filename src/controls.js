// Use physical keys so Korean IME / keyboard layout never swallows QWER, S, D or P.
const physical={KeyQ:'q',KeyW:'w',KeyE:'e',KeyR:'r',KeyS:'s',KeyD:'d',KeyP:'p',KeyM:'m',KeyH:'h',ArrowUp:'ArrowUp',ArrowDown:'ArrowDown',ArrowLeft:'ArrowLeft',ArrowRight:'ArrowRight',Escape:'Escape',Enter:'Enter'};
export function controlKey(event){return physical[event.code]||(event.key?.length===1?event.key.toLowerCase():event.key)||'';}
export function inputFromKeys(keys){return {x:Number(keys.has('ArrowRight'))-Number(keys.has('ArrowLeft')),y:Number(keys.has('ArrowDown'))-Number(keys.has('ArrowUp'))};}
