/**
 * systems/loop.ts — the engine's main loop (Phase 7, slice 1).
 *
 * The 2.048 engine defined `Game.Loop` as a function expression inside
 * `Game.Init`; it is now a typed export and the engine keeps the same
 * `Game.Loop = Loop` slot at the exact original Init position, so the
 * modding surface (`Game.Loop`) and every call site are unchanged.
 *
 * Slice scope (closure-free — reads only `Game` and window-shim globals):
 *   - `Loop` (engine ~4314–4412): the ~100-line setTimeout-driven loop
 *     that calls Logic, handles latency compensation, schedules Draw
 *     via requestAnimationFrame, renders the FPS debug graph, and
 *     reschedules itself.
 *
 * Bodies are verbatim (original indentation kept) — only parameter and
 * return annotations were added.
 *
 * No runtime imports: `Game`, `l`, `Timer` resolve through
 * src/globals.d.ts.
 */
export function Loop(): boolean | undefined
	{
		if (Game.timedout) return false;
		Timer.say('START');
		Timer.track('browser stuff');
		Timer.say('LOGIC');
		//update game logic !
		Game.catchupLogic=0;
		Game.Logic();
		Game.catchupLogic=1;
		
		var time=Date.now();
		
		
		//latency compensator
		Game.accumulatedDelay+=((time-Game.time)-1000/Game.fps);
		if (Game.prefs.timeout && time-Game.lastActivity>=1000*60*5)
		{
			if (Game.accumulatedDelay>1000*60*30) Game.delayTimeouts+=3;//more than 30 minutes delay? computer probably asleep and not making cookies anyway
			else if (Game.accumulatedDelay>1000*5) Game.delayTimeouts++;//add to timeout counter when we skip 10 seconds worth of frames (and the player has been inactive for at least 5 minutes)
			if (Game.delayTimeouts>=3) Game.Timeout();//trigger timeout when the timeout counter is 3+
		}
		
		Game.accumulatedDelay=Math.min(Game.accumulatedDelay,1000*5);//don't compensate over 5 seconds; if you do, something's probably very wrong
		Game.time=time;
		
		//if (Game.accumulatedDelay>=Game.fps) console.log('delay:',Math.round(Game.accumulatedDelay/Game.fps));
		//CC3 perf: the catch-up loop could replay up to 150 Logic() ticks back-to-back
		//(accumulatedDelay caps at 5s) after the tab was throttled — a jank spike of
		//several hundred ms on tab return. While the page is VISIBLE, catch-up now
		//runs at most 5 ticks per frame (the debt clears over the next second or so;
		//meanwhile real time has passed, so gameplay is unaffected — background play
		//is still fully simulated by the catch-up when the tab is hidden, where
		//jank is invisible).
		var catchupTicks=0;
		while (Game.accumulatedDelay>0)
		{
			Game.Logic();
			Game.accumulatedDelay-=1000/Game.fps;//as long as we're detecting latency (slower than target fps), execute logic (this makes drawing slower but makes the logic behave closer to correct target fps)
			if (Game.visible && ++catchupTicks>=5) {Game.accumulatedDelay=0;break;}
		}
		Game.catchupLogic=0;
		Timer.track('logic');
		Timer.say('END LOGIC');
		/*
		if (!Game.prefs.altDraw)
		{
			var hasFocus=document.hasFocus();
			Timer.say('DRAW');
			if (hasFocus || Game.prefs.focus || Game.loopT%10==0) requestAnimationFrame(Game.Draw);
			//if (document.hasFocus() || Game.loopT%5==0) Game.Draw();
			Timer.say('END DRAW');
		}
		else requestAnimationFrame(Game.Draw);*/
		//CC3 perf: present the frame on the next vsync instead of painting
		//synchronously inside the logic tick. The paint no longer adds to the
		//loop's setTimeout period (logic holds closer to Game.fps) and the
		//canvas present is aligned to the display refresh (no tearing). One
		//draw is kept in flight; drawT (and every drawT%N cadence the draw
		//subsystems are tuned to) still advances once per logic tick. Falls
		//back to a synchronous paint where requestAnimationFrame is missing.
		if (Game.visible && !Game.__drawPending)
		{
			Game.__drawPending=1;
			if (typeof requestAnimationFrame==='function') requestAnimationFrame(function(){Game.__drawPending=0;Game.Draw();});
			else {Game.__drawPending=0;Game.Draw();}
		}
		
		//if (!hasFocus) Game.tooltip.hide();
		
		if (Game.sesame)
		{
			//fps counter and graph
			Game.previousFps=Game.currentFps;
			Game.currentFps=Game.getFps();
				var ctx=Game.fpsGraphCtx;
				ctx.drawImage(Game.fpsGraph,-1,0);
				ctx.fillStyle='rgb('+Math.round((1-Game.currentFps/Game.fps)*128)+',0,0)';
				ctx.fillRect(128-1,0,1,64);
				ctx.strokeStyle='#fff';
				ctx.beginPath();
				ctx.moveTo(128-1,(1-Game.previousFps/Game.fps)*64);
				ctx.lineTo(128,(1-Game.currentFps/Game.fps)*64);
				ctx.stroke();
			
			l('fpsCounter').textContent=Game.currentFps+' fps';
			var str='';
			for (var i in Timer.labels) {str+=Timer.labels[i];}
			if (Game.debugTimersOn) l('debugLog').style.display='block';
			else l('debugLog').style.display='none';
			l('debugLog').innerHTML=str;
			
		}
		Timer.reset();
		
		Game.loopT++;
		setTimeout(Game.Loop,1000/Game.fps);
		return;
	}
