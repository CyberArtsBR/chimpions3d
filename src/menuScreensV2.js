import './menuScreensV2.css';
import './menuScreensFinal.css';

const launcher=()=>{location.href='/'};
function backButton(parent,className=''){
  let button=parent.querySelector(':scope > .games-back');
  if(button)return button;
  button=document.createElement('button');
  button.type='button';
  button.className=('games-back '+className).trim();
  button.textContent='BACK';
  button.setAttribute('aria-label','Back to game selection');
  button.onclick=launcher;
  parent.append(button);
  return button;
}

export function setupJumpMenu(){
  const card=document.querySelector('#overlay .card');if(!card)return;
  const button=backButton(card,'jump-back');button.textContent='Back to the game selection';
  document.body.classList.add('jump-start-screen');
}

function dashApi(){return window.chimpionsDashPresentationApi||null}

export function setupDashMenu(){
  const menu=document.querySelector('#dash-menu');if(!menu)return;
  document.body.classList.add('dash-start-screen');

  // The approved start artwork already contains both menu buttons.
  // Reuse the real legacy Start control as an invisible hotspot so its
  // established runtime handler remains authoritative.
  const start=document.querySelector('#dash-start');
  if(start){
    start.classList.remove('primary','original-dash-start');
    start.classList.add('screen-primary');
    start.textContent='START GAME';
    start.setAttribute('aria-label','Start Game');
    menu.append(start);
  }

  // The lower painted plaque is also a real invisible button hotspot.
  const back=backButton(menu,'dash-back');
  back.textContent='Back to the game selection';
  back.onclick=()=>{dashApi()?.playUi?.('back');launcher()};

  // Remove stale controls from a hot-reloaded prior build; the artwork remains
  // the only visible entry UI.
  menu.querySelector('.dash-entry-actions')?.remove();
  document.querySelector('#dash-character-picker')?.remove();

  let previousA=false,previousB=false,previousLeft=false,previousRight=false;
  function pollMenuPad(){
    if(document.body.dataset.labState==='menu'){
      const pad=[...(navigator.getGamepads?.()||[])].find(item=>item?.connected);
      if(pad){
        const a=!!pad.buttons?.[0]?.pressed;
        const b=!!pad.buttons?.[1]?.pressed;
        const axisX=pad.axes?.[0]||0;
        const left=!!pad.buttons?.[14]?.pressed||axisX<-.55;
        const right=!!pad.buttons?.[15]?.pressed||axisX>.55;
        if((left&&!previousLeft)||(right&&!previousRight)){
          dashApi()?.setInputDevice?.('gamepad');
          (right?back:start)?.focus?.();
        }
        if(a&&!previousA){
          dashApi()?.setInputDevice?.('gamepad');
          const active=document.activeElement===back?back:start;
          if(active&&!active.disabled)active.click();
        }
        if(b&&!previousB){dashApi()?.setInputDevice?.('gamepad');back.click();}
        previousA=a;previousB=b;previousLeft=left;previousRight=right;
      }
    }
    requestAnimationFrame(pollMenuPad);
  }
  requestAnimationFrame(pollMenuPad);
}

export function setupArenaGate(){
  document.body.className='arena-gate-screen';document.title='Chimpions Card Arena';
  document.body.innerHTML=`<main class="arena-gate"><div class="arena-art"><div class="arena-actions"><button id="enter-arena" aria-label="Enter the Arena">Enter the Arena</button><button id="arena-back" aria-label="Back to the game selection">Back to the game selection</button></div></div></main>`;
  document.querySelector('#enter-arena').onclick=()=>{location.href='https://chimpions-attribute-arena.onrender.com/'};
  document.querySelector('#arena-back').onclick=launcher;
}
