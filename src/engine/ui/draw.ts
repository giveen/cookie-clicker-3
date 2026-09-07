/**
 * ui/draw.ts — the engine's per-frame draw function (Phase 7, slice 1).
 *
 * The 2.048 engine defined `Game.Draw` as a function expression inside
 * `Game.Init`; it is now a typed export and the engine keeps the same
 * `Game.Draw = Draw` slot at the exact original Init position, so the
 * modding surface (`Game.Draw`) and every call site are unchanged.
 *
 * Slice scope (closure-free — reads only `Game` and window-shim globals):
 *   - `Draw` (engine ~4153–4309): the ~160-line per-frame function that
 *     renders the cookie counter, minigames, store products, upgrades,
 *     buildings, notes, and mod hooks.
 *
 * Bodies are verbatim (original indentation kept) — only parameter and
 * return annotations were added.
 *
 * No runtime imports: `Game`, `loc`, `l`, `Beautify`, `Timer` resolve
 * through src/globals.d.ts.
 */
export function Draw()
	{
		Game.DrawBackground();Timer.track('end of background');
		
		if (!Game.OnAscend)
		{
			
			//CC3 perf: the counter used to be one big innerHTML string rebuilt
			//30x a second (build + parse + layout every frame). The markup is
			//built once (below), the number lives in #cookieAmount, the
			//per-second line in #cookiesPerSecond, and each frame only writes
			//textContent into the two (already parsed) nodes — only when the
			//value actually changed. The smooth-cookie-counter polish pass in
			//src/main.ts takes over the same nodes at refresh rate (both passes
			//cache their node refs in #cookies.__cc3Spans).
			var str=Beautify(Math.round(Game.cookiesd));
			if (Game.cookiesd>=1000000)//dirty padding
			{
				var spacePos=str.indexOf(' ');
				var dotPos=str.indexOf('.');
				var add='';
				if (spacePos!=-1)
				{
					if (dotPos==-1) add+='.000';
					else
					{
						if (spacePos-dotPos==2) add+='00';
						if (spacePos-dotPos==3) add+='0';
					}
				}
				str=[str.slice(0,spacePos),add,str.slice(spacePos)].join('');
			}
			
			str=loc("%1 cookie",{n:Math.round(Game.cookiesd),b:str}) as string;
			if (str.length>14) str=str.replace(' ','<br>');
			
			if (Game.prefs.monospace) str='<span class="monospace">'+str+'</span>';
			
			//CC3 perf (cont.): the amount keeps the loc/monospace markup (it may
			//carry a <br>), wrapped in #cookieAmount so both children are always
			//elements; the per-second line keeps its id for CSS/tests but is now
			//a <span> updated in place.
			var cookiesL=l('cookies') as HTMLElement;
			if (!cookiesL.__cc3Spans)
			{
				cookiesL.innerHTML='<span id="cookieAmount">'+str+'</span><span id="cookiesPerSecond"'+(Game.cpsSucked>0?' class="wrinkled"':'')+'></span>';
				cookiesL.__cc3Spans={amount:cookiesL.firstChild as HTMLElement,cps:cookiesL.lastChild as HTMLElement,lastAmount:str,lastCps:loc("per second:")+' '+Beautify(Game.cookiesPs*(1-Game.cpsSucked),1)};
				cookiesL.__cc3Spans.cps.textContent=cookiesL.__cc3Spans.lastCps;
			}
			else
			{
				var spans=cookiesL.__cc3Spans;
				if (spans.lastAmount!==str)
				{
					spans.amount.innerHTML=str;
					spans.lastAmount=str;
				}
				var cpsStr=loc("per second:")+' '+Beautify(Game.cookiesPs*(1-Game.cpsSucked),1);
				if (spans.lastCps!==cpsStr)
				{
					spans.cps.textContent=cpsStr;
					spans.lastCps=cpsStr;
				}
				//the wrinkled class only matters when a wrinkler latches on
				var wrinkled=(Game.cpsSucked>0)?'wrinkled':'';
				if (spans.cps.className!==wrinkled) spans.cps.className=wrinkled;
			}
			Timer.track('cookie amount');
			
			for (var i in Game.Objects)
			{
 				var me:any=Game.Objects[i];
				if (me.onMinigame && me.minigame.draw && !me.muted && !Game.onMenu) me.minigame.draw();
			}
			Timer.track('draw minigames');
			
			if (Game.drawT%5==0)
			{
				//if (Game.prefs.monospace) {l('cookies').className='title monospace';} else {l('cookies').className='title';}
				var lastLocked=0;
				// CC3: iterate in storeOrder so custom buildings (e.g. Cats)
				// appear between the buildings they belong visually, even if
				// their auto-assigned id places them later in Game.Objects.
				var sortedObjects=Object.keys(Game.Objects).map(function(k){return Game.Objects[k];}).sort(function(a:any,b:any){
					var aOrder=typeof a.storeOrder==='number'?a.storeOrder:a.id;
					var bOrder=typeof b.storeOrder==='number'?b.storeOrder:b.id;
					return aOrder-bOrder;
				});
				for (var si=0;si<sortedObjects.length;si++)
				{
 					var me:any=sortedObjects[si];
					
					//make products full-opacity if we can buy them
					var classes='product';
					var price=me.bulkPrice;
					if (Game.cookiesEarned>=me.basePrice || me.bought>0) {classes+=' unlocked';lastLocked=0;me.locked=0;} else {classes+=' locked';lastLocked++;me.locked=1;}
					if ((Game.buyMode==1 && Game.cookies>=price) || (Game.buyMode==-1 && me.amount>0)) classes+=' enabled'; else classes+=' disabled';
					//CC3: Monoculture challenge — buildings other than the locked type are disabled
					if (Game.ascensionMode==4 && Game.monoBuilding!==null && Game.monoBuilding!==me.id) classes=classes.replace(' enabled',' disabled');
					if (lastLocked>2) classes+=' toggledOff';
					me.l.className=classes;
					//if (me.id>0) {l('productName'+me.id).innerHTML=Beautify(me.storedTotalCps/Game.ObjectsById[me.id-1].storedTotalCps,2);}
				}
				
				//make upgrades full-opacity if we can buy them
				var lastPrice=0;
				for (var i in Game.UpgradesInStore)
				{
 					var me:any=Game.UpgradesInStore[i];
					if (!me.bought)
					{
						var price=me.getPrice();
						var canBuy=me.canBuy();//(Game.cookies>=price);
						var enabled=(l('upgrade'+i).className.indexOf('enabled')>-1);
						if ((canBuy && !enabled) || (!canBuy && enabled)) Game.upgradesToRebuild=1;
						if (price<lastPrice) Game.storeToRefresh=1;//is this upgrade less expensive than the previous one? trigger a refresh to sort it again
						lastPrice=price;
					}
					if (me.timerDisplay)
					{
						var T=me.timerDisplay();
						if (T!=-1)
						{
							if (!l('upgradePieTimer'+i)) l('upgrade'+i).innerHTML=l('upgrade'+i).innerHTML+'<div class="pieTimer" id="upgradePieTimer'+i+'"></div>';
							T=(T*144)%144;
							l('upgradePieTimer'+i).style.backgroundPosition=(-Math.floor(T%18))*48+'px '+(-Math.floor(T/18))*48+'px';
						}
					}
					
					//if (me.canBuy()) l('upgrade'+i).className='crate upgrade enabled'; else l('upgrade'+i).className='crate upgrade disabled';
				}
			}
			Timer.track('store');
			
			if (Game.PARTY)//i was bored and felt like messing with CSS
			{
				var pulse=Math.pow((Game.T%10)/10,0.5);
 				Game.l!.style.filter='hue-rotate('+((Game.T*5)%360)+'deg) brightness('+(150-50*pulse)+'%)';
 				Game.l!.style.webkitFilter='hue-rotate('+((Game.T*5)%360)+'deg) brightness('+(150-50*pulse)+'%)';
 				Game.l!.style.transform='scale('+(1.02-0.02*pulse)+','+(1.02-0.02*pulse)+') rotate('+(Math.sin(Game.T*0.5)*0.5)+'deg)';
 				Game.wrapper!.style.overflowX='hidden';
 				Game.wrapper!.style.overflowY='hidden';
			}
			
			Timer.clean();
			if (Game.prefs.animate && ((Game.prefs.fancy && Game.drawT%1==0) || (!Game.prefs.fancy && Game.drawT%10==0)) && Game.AscendTimer==0 && Game.onMenu=='') Game.DrawBuildings();Timer.track('buildings');
			
			Game.textParticlesUpdate();Timer.track('text particles');
		}
		
		Game.NotesDraw();Timer.track('notes');
		
		Game.runModHook('draw');
		
		Game.drawT++;
		//if (Game.prefs.altDraw) requestAnimationFrame(Game.Draw);
	}
