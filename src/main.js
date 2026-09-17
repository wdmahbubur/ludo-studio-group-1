import { PLAYERS, FINISH, createGame, copyGame, legalMoves, rollGame, moveGame, isValidGame } from './rules.js';
import { LudoScene } from './scene.js';
import { THEMES } from './textures.js';
const $=selector=>document.querySelector(selector);
const SAVE_KEY='cse444-ludo-studio-game-v1', PREFS_KEY='cse444-ludo-studio-preferences-v1';
function readJSON(key){try{return JSON.parse(localStorage.getItem(key)||'null');}catch{return null;}}
function storeJSON(key,value){try{localStorage.setItem(key,JSON.stringify(value));return true;}catch{return false;}}
const saved=readJSON(SAVE_KEY);let state=isValidGame(saved)?saved:createGame();
const rawPreferences=readJSON(PREFS_KEY);
const preferences={theme:Number.isInteger(rawPreferences?.theme)&&rawPreferences.theme>=0&&rawPreferences.theme<3?rawPreferences.theme:0,light:Number.isFinite(rawPreferences?.light)?Math.max(25,Math.min(180,rawPreferences.light)):100};
let view=null,busy=false,demo=false,normalBeforeDemo=null,animationMessage='',toastTimer;
function toast(message){clearTimeout(toastTimer);$('#toast').textContent=message;$('#toast').hidden=false;toastTimer=setTimeout(()=>$('#toast').hidden=true,3300);}
function fatal(message){const overlay=$('#scene-loading');overlay.hidden=false;overlay.classList.add('error');overlay.querySelector('h2').textContent='The 3D scene could not start.';$('#loading-message').textContent=message;$('#roll-button').disabled=true;}
function save(){if(!demo&&!storeJSON(SAVE_KEY,state))toast('Browser storage is unavailable. This game will not survive a reload.');}
function render(updateScene=true){
  const p=PLAYERS[state.turn],won=state.winner!==null;
  document.documentElement.style.setProperty('--active',p.hex);
  $('#turn-title').textContent=won?`${p.name} wins!`:`${p.name}'s turn`;
  $('#turn-avatar').textContent=p.name[0];$('#turn-caption').textContent=won?'ALL FOUR HOME':'ON THE MOVE';
  $('#mode-badge').textContent=demo?'PRESENTATION DEMO':`${state.playerCount} PLAYERS · LOCAL`;
  $('#game-message').textContent=busy?animationMessage:state.message;
  $('#die-readout').textContent=busy?'…':state.dice?String.fromCodePoint(0x2680+state.dice-1):'—';
  $('#die-readout').setAttribute('aria-label',busy?'Animation in progress':state.dice?`Last die result: ${state.dice}`:'No die result yet');
  $('#roll-button').disabled=busy||state.phase!=='roll';
  $('#roll-label').textContent=busy?'In motion…':won?'Game complete':state.phase==='select'?'Choose a token':'Roll the dice';
  $('#new-game-button').disabled=busy||demo;$('#demo-toggle').disabled=busy;
  $('#demo-toggle').checked=demo;$('#demo-banner').hidden=!demo;$('#demo-roll-control').hidden=!demo;
  const choices=legalMoves(state),choicesHost=$('#token-choices');choicesHost.replaceChildren();choicesHost.hidden=!choices.length||busy;
  for(let i=0;i<4;i++){
    const button=document.createElement('button');button.textContent=`Token ${i+1}`;button.disabled=!choices.includes(i);button.dataset.token=String(i);button.addEventListener('click',()=>moveToken(i));choicesHost.append(button);
  }
  const playersHost=$('#players-list');playersHost.replaceChildren();
  PLAYERS.forEach((player,index)=>{
    const row=document.createElement('div');const count=state.tokens[index].filter(p=>p===FINISH).length;
    row.className=`player-row${index===state.turn?' active':''}${state.active.includes(index)?'':' inactive'}`;row.style.setProperty('--player',player.hex);
    row.innerHTML=`<span class="player-dot"></span><span class="player-label">${player.name}</span><span class="player-turn">${index===state.turn?(won?'WINNER':'YOUR TURN'):''}</span><span class="home-dots" aria-hidden="true">${[0,1,2,3].map(i=>`<i class="${i<count?'finished':''}"></i>`).join('')}</span><span class="home-count">${count}/4</span>`;
    row.setAttribute('aria-label',`${player.name}, ${count} of 4 home${state.active.includes(index)?'':', not playing'}`);playersHost.append(row);
  });
  $('#roll-count').textContent=`${state.rollCount} roll${state.rollCount===1?'':'s'}`;
  const history=$('#activity-list');history.replaceChildren();for(const text of state.history){const li=document.createElement('li');li.textContent=text;history.append(li);}
  if(updateScene)view?.setState(state);
}
function randomDie(){
  if(!globalThis.crypto?.getRandomValues)return 1+Math.floor(Math.random()*6);
  const data=new Uint32Array(1);do{crypto.getRandomValues(data);}while(data[0]>=4294967292);return 1+data[0]%6;
}
async function roll(){
  if(!view||busy||state.phase!=='roll')return;
  const demoValue=Number($('#demo-dice').value),value=demo&&demoValue?demoValue:randomDie();
  busy=true;animationMessage=`${PLAYERS[state.turn].name} is rolling…`;render(false);
  try{await view.animateDie(value);state=rollGame(state,value);busy=false;render();save();}
  catch(error){busy=false;render();toast(error.message);}
}
async function moveToken(token){
  if(!view||busy||!legalMoves(state).includes(token))return;
  const result=moveGame(state,token);busy=true;animationMessage=`Moving ${PLAYERS[state.turn].name.toLowerCase()} token ${token+1}…`;render(false);
  try{await view.animateMove(result.move);state=result.state;busy=false;render();save();if(result.move.captured.length)toast('Captured! The opposing token returns to its yard.');if(state.winner!==null)toast(`${PLAYERS[state.winner].name} wins — all four tokens are home!`);}
  catch(error){busy=false;render();toast(error.message);}
}
function selectTheme(index,announce=true){if(!view)return;view.setTheme(index);preferences.theme=index;storeJSON(PREFS_KEY,preferences);document.querySelectorAll('[data-theme]').forEach(button=>{const active=Number(button.dataset.theme)===index;button.classList.toggle('selected',active);button.setAttribute('aria-pressed',String(active));});$('#finish-note').textContent=THEMES[index].note;if(announce)toast(`${THEMES[index].name} board texture`);}
function syncOrbitButton(){$('#orbit-button').setAttribute('aria-pressed',String(view?.rig.autoOrbit||false));}
function setDemo(enabled){
  if(busy)return;
  if(enabled&&!demo){normalBeforeDemo=copyGame(state);state=createGame();state.tokens=[[7,16,-1,53],[9,31,-1,-1],[3,20,-1,-1],[16,-1,-1,-1]];state.message='Demo: roll 6 and move Red token 2 to capture Green token 1.';state.history=['Separate demonstration scene. The normal game is preserved.'];demo=true;view.previewSpin=true;view.rig.reset();syncOrbitButton();}
  else if(!enabled&&demo){state=normalBeforeDemo;normalBeforeDemo=null;demo=false;view.previewSpin=state.rollCount===0;}
  render();toast(demo?'Demo scene — no changes will be saved to your normal game.':'Your normal game has been restored.');
}
try{
  view=new LudoScene($('#viewport'),{
    onPick:data=>{
      if(data.action==='board'){selectTheme((preferences.theme+1)%THEMES.length);return;}
      if(data.action==='dice'){roll();return;}
      if(data.action==='token'){
        if(!busy&&data.player===state.turn&&legalMoves(state).includes(data.token))moveToken(data.token);
        else if(!busy)toast(state.phase==='roll'?'Roll the dice first.':'Choose a highlighted token of the current player.');
      }
    },
    onStats:({fps})=>$('#fps').textContent=String(fps),onFatal:fatal
  });
  selectTheme(preferences.theme,false);view.setLight(preferences.light/100);$('#light-intensity').value=String(preferences.light);$('#light-value').value=`${preferences.light}%`;render();
  $('#scene-loading').hidden=true;globalThis.__ludoReady=true;
  if(isValidGame(saved))toast('Your saved game has been restored.');
  globalThis.ludoDiagnostics=()=>({state:copyGame(state),busy,demo,...view.diagnostics()});
}catch(error){console.error(error);fatal(`${error.message} Try a browser with WebGL and hardware acceleration enabled.`);}
$('#roll-button').addEventListener('click',roll);
document.querySelectorAll('[data-theme]').forEach(button=>button.addEventListener('click',()=>selectTheme(Number(button.dataset.theme))));
$('#perspective-button').addEventListener('click',()=>{view?.rig.reset();syncOrbitButton();});
$('#top-button').addEventListener('click',()=>{view?.rig.topView();syncOrbitButton();});
$('#orbit-button').addEventListener('click',()=>{if(view)view.rig.autoOrbit=!view.rig.autoOrbit;syncOrbitButton();});
$('#light-intensity').addEventListener('input',e=>{preferences.light=Number(e.target.value);$('#light-value').value=`${preferences.light}%`;view?.setLight(preferences.light/100);storeJSON(PREFS_KEY,preferences);});
$('#orbit-light').addEventListener('change',e=>{if(view)view.orbitLight=e.target.checked;});
$('#demo-toggle').addEventListener('change',e=>setDemo(e.target.checked));
$('#help-button').addEventListener('click',()=>$('#help-dialog').showModal());
$('#new-game-button').addEventListener('click',()=>{if(!busy&&!demo){document.querySelector(`[name="player-count"][value="${state.playerCount}"]`).checked=true;$('#new-game-dialog').showModal();}});
document.querySelectorAll('.close-dialog').forEach(button=>button.addEventListener('click',()=>button.closest('dialog').close()));
$('#confirm-new-game').addEventListener('click',()=>{if(busy||demo)return;state=createGame(Number(document.querySelector('[name="player-count"]:checked').value));view.previewSpin=true;render();save();$('#new-game-dialog').close();toast('A new game is ready. Red starts.');});
$('#activity-toggle').addEventListener('click',()=>{const hidden=!$('#activity-list').hidden;$('#activity-list').hidden=hidden;$('#activity-toggle').setAttribute('aria-expanded',String(!hidden));});
window.addEventListener('keydown',e=>{
  if(e.repeat||e.ctrlKey||e.metaKey||e.altKey||document.querySelector('dialog[open]')||e.target.closest('input,select,textarea,button'))return;
  switch(e.code){
    case 'Space':e.preventDefault();roll();break;
    case 'KeyT':selectTheme((preferences.theme+1)%THEMES.length);break;
    case 'KeyR':view?.rig.reset();syncOrbitButton();break;
    case 'KeyV':view?.rig.topView();syncOrbitButton();break;
    case 'KeyL':$('#orbit-light').checked=!$('#orbit-light').checked;if(view)view.orbitLight=$('#orbit-light').checked;break;
    case 'KeyH':$('#help-dialog').showModal();break;
    default:if(/^Digit[1-4]$/.test(e.code))moveToken(Number(e.code.slice(-1))-1);
  }
});
