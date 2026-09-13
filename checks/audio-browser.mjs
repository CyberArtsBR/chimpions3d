import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {chromium} from '@playwright/test';
const browser=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:900,height:720}});
await page.addInitScript(()=>{
 const NativeAudio=window.Audio;
 window.Audio=function(...args){const audio=new NativeAudio(...args);window.musicUnderTest=audio;return audio;};
});
try{
 await page.goto(process.env.CHECK_URL||'http://127.0.0.1:4173/?test=1');
 await page.waitForFunction(()=>window.chimpJump?.().ready&&Number.isFinite(window.musicUnderTest?.duration));
 await page.evaluate(()=>window.chimpJumpTest.suspendRendering());
 const source=await page.evaluate(()=>window.musicUnderTest.src);
 const response=await page.request.get(source);assert(response.ok(),'Music asset must be served');
 const bytes=await response.body();
 assert.equal(bytes.length,4260793,'The complete supplied MP3 must be deployed, never a truncated upload');
 assert.equal(createHash('sha256').update(bytes).digest('hex'),'18e24cefec0f28e787872a0bfae2ac4dc4ba1843703a1defa1a116e742d7f88c');
 assert.equal(await page.evaluate(()=>window.chimpJump().musicVolume),.19);
 await page.getByRole('button',{name:'LET’S JUMP',exact:true}).click();
 await page.waitForFunction(()=>window.chimpJump().musicTime>.3&&!window.chimpJump().musicPaused);
 const before=await page.evaluate(()=>window.chimpJump().musicTime);
 // A repeated start event must not reset an already active climb or its track.
 await page.evaluate(()=>document.querySelector('#play').click());
 assert(await page.evaluate(()=>window.chimpJump().musicTime)>=before);
 await page.getByRole('button',{name:'Pause game',exact:true}).click();
 assert(await page.evaluate(()=>window.chimpJump().musicPaused));
 const pausedAt=await page.evaluate(()=>window.chimpJump().musicTime);
 await page.waitForTimeout(150);
 assert(Math.abs(await page.evaluate(()=>window.chimpJump().musicTime)-pausedAt)<.03);
 await page.getByRole('button',{name:'KEEP CLIMBING',exact:true}).click();
 await page.waitForFunction(t=>window.chimpJump().musicTime>t+.15,pausedAt);
 await page.getByRole('button',{name:'Mute sound',exact:true}).click();
 assert(await page.evaluate(()=>window.chimpJump().musicMuted));
 await page.getByRole('button',{name:'Enable sound',exact:true}).click();
 assert.equal(await page.evaluate(()=>window.chimpJump().musicMuted),false);
 const duration=await page.evaluate(()=>window.musicUnderTest.duration);
 assert(duration>120,'Full music should last minutes, not a few seconds');
 // Decode the actual end of the track, then verify looping happens at its end.
 await page.evaluate(()=>{window.musicUnderTest.currentTime=window.musicUnderTest.duration-1;window.musicUnderTest.playbackRate=4;});
 await page.waitForFunction(()=>window.musicUnderTest.currentTime<3&&!window.musicUnderTest.paused);
 await page.evaluate(()=>{window.musicUnderTest.playbackRate=1;window.chimpJumpTest.game().y=-100;window.chimpJumpTest.step(1);});
 assert.equal(await page.evaluate(()=>window.chimpJump().mode),'over');
 assert(await page.evaluate(()=>window.chimpJump().musicPaused));
 await page.getByRole('button',{name:'JUMP AGAIN',exact:true}).click();
 assert(await page.evaluate(()=>window.chimpJump().musicTime)<.5,'A new climb restarts the music');
 console.log(`PASS music: full ${bytes.length} byte MP3 (${duration.toFixed(2)} s), 50% volume, play/pause/resume, mute, duplicate start, game over, restart, complete-track loop`);
}finally{await browser.close();}
