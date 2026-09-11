/**
 * systems/logic.ts — the engine's main tick function (Phase 7, slice 1).
 *
 * The 2.048 engine defined `Game.Logic` as a function expression inside
 * `Game.Init`; it is now a typed export and the engine keeps the same
 * `Game.Logic = Logic` slot at the exact original Init position, so the
 * modding surface (`Game.Logic`) and every call site are unchanged.
 *
 * Slice scope (closure-free — reads only `Game` and window-shim globals):
 *   - `Logic` (engine ~3628–4152): the 520-line per-tick function that
 *     drives buildings, milk, research, seasons, achievements, cookies,
 *     wrinklers, shimmers, buffs, the ticker, notes, and tooltips.
 *
 * Bodies are verbatim (original indentation kept) — only parameter and
 * return annotations were added.
 *
 * No runtime imports: `Game`, `loc`, `l`, `EN`, `Beautify`, `LBeautify`,
 * `SimpleBeautify`, `Timer` resolve through src/globals.d.ts.
 */
export function Logic()
	{
 		Game.bounds=Game.l!.getBounds();
 		
		if (!Game.OnAscend && Game.AscendTimer==0)
		{
			for (var iKey in Game.Objects)
			{
 				var eachFrame=Game.Objects[iKey].eachFrame; if (eachFrame) eachFrame();
			}
			Game.UpdateSpecial();
			Game.UpdateGrandmapocalypse();
			
			//CC3: Trigger finger challenge — scrolling over the cookie counts as clicking it
			if (Game.ascensionMode==2 && Game.BigCookieState==2 && !Game.promptOn && Game.Scroll!=0)
			{
				Game.ClickCookie();
				Game.Scroll=0;
			}
			//if (Game.BigCookieState==1 && !Game.promptOn) Game.ClickCookie();
			
			//handle graphic stuff
			if (Game.prefs.wobbly)
			{
				if (Game.BigCookieState==1) Game.BigCookieSizeT=0.98;
				else if (Game.BigCookieState==2) Game.BigCookieSizeT=1.05;
				else Game.BigCookieSizeT=1;
				Game.BigCookieSizeD+=(Game.BigCookieSizeT-Game.BigCookieSize)*0.75;
				Game.BigCookieSizeD*=0.75;
				Game.BigCookieSize+=Game.BigCookieSizeD;
				Game.BigCookieSize=Math.max(0.1,Game.BigCookieSize);
			}
			else
			{
				if (Game.BigCookieState==1) Game.BigCookieSize+=(0.98-Game.BigCookieSize)*0.5;
				else if (Game.BigCookieState==2) Game.BigCookieSize+=(1.05-Game.BigCookieSize)*0.5;
				else Game.BigCookieSize+=(1-Game.BigCookieSize)*0.5;
			}
			Game.particlesUpdate();
			
			if (Game.mousePointer) l('sectionLeft').style.cursor='pointer';
			else l('sectionLeft').style.cursor='auto';
			Game.mousePointer=0;
			
			//handle milk and milk accessories
			Game.milkProgress=Game.AchievementsOwned/25;
			if (Game.milkProgress>=0.5) Game.Unlock('Kitten helpers');
			if (Game.milkProgress>=1) Game.Unlock('Kitten workers');
			if (Game.milkProgress>=2) Game.Unlock('Kitten engineers');
			if (Game.milkProgress>=3) Game.Unlock('Kitten overseers');
			if (Game.milkProgress>=4) Game.Unlock('Kitten managers');
			if (Game.milkProgress>=5) Game.Unlock('Kitten accountants');
			if (Game.milkProgress>=6) Game.Unlock('Kitten specialists');
			if (Game.milkProgress>=7) Game.Unlock('Kitten experts');
			if (Game.milkProgress>=8) Game.Unlock('Kitten consultants');
			if (Game.milkProgress>=9) Game.Unlock('Kitten assistants to the regional manager');
			if (Game.milkProgress>=10) Game.Unlock('Kitten marketeers');
			if (Game.milkProgress>=11) Game.Unlock('Kitten analysts');
			if (Game.milkProgress>=12) Game.Unlock('Kitten executives');
			if (Game.milkProgress>=13) Game.Unlock('Kitten admins');
			Game.milkH=Math.min(1,Game.milkProgress)*0.35;
			Game.milkHd+=(Game.milkH-Game.milkHd)*0.02;
			
			Game.Milk=Game.Milks[Math.min(Math.floor(Game.milkProgress),Game.Milks.length-1)];
			
			if (Game.autoclickerDetected>0) Game.autoclickerDetected--;
			
			//handle research
			if (Game.researchT>0)
			{
				Game.researchT--;
			}
			if (Game.researchT==0 && Game.nextResearch)
			{
				if (!Game.Has(Game.UpgradesById[Game.nextResearch].name))
				{
					Game.Unlock(Game.UpgradesById[Game.nextResearch].name);
 					Game.Notify(loc("Research complete") as string,loc("You have discovered: <b>%1</b>.",Game.UpgradesById[Game.nextResearch].dname) as string,Game.UpgradesById[Game.nextResearch].icon);
				}
				Game.nextResearch=0;
				Game.researchT=-1;
				Game.recalculateGains=1;
			}
			//handle seasons
			if (Game.seasonT>0)
			{
				Game.seasonT--;
			}
			if (Game.seasonT<=0 && Game.season!='' && Game.season!=Game.baseSeason && !Game.Has('Eternal seasons'))
			{
				Game.Notify(Game.seasons[Game.season].over,'',Game.seasons[Game.season].triggerUpgrade.icon);
				if (Game.Has('Season switcher')) {Game.Unlock(Game.seasons[Game.season].trigger);Game.seasons[Game.season].triggerUpgrade.bought=0;}
				Game.season=Game.baseSeason;
				Game.seasonT=-1;
			}
			
			//press ctrl to bulk-buy 10, shift to bulk-buy 100
			if (!Game.promptOn)
			{
				if ((Game.keys[16] || Game.keys[17]) && !Game.buyBulkShortcut)
				{
					Game.buyBulkOld=Game.buyBulk;
					if (Game.keys[16]) Game.buyBulk=100;
					if (Game.keys[17]) Game.buyBulk=10;
					Game.buyBulkShortcut=1;
					Game.storeBulkButton(-1);
				}
			}
			if ((!Game.keys[16] && !Game.keys[17]) && Game.buyBulkShortcut)//release
			{
				Game.buyBulk=Game.buyBulkOld;
				Game.buyBulkShortcut=0;
				Game.storeBulkButton(-1);
			}
			
			//handle cookies
			if (Game.recalculateGains) Game.CalculateGains();
			Game.Earn(Game.cookiesPs/Game.fps);//add cookies per second
			
			//grow lumps
			Game.doLumps();
			
			//minigames
			//CC3: poll the lazy minigame loader every tick (the CC2 2.048 Update loop
			//did) so a minigame that just met its unlock condition — the Factory
			//Dungeon hitting 50 owned Factories mid-session — loads and shows up
			//without a page reload, level-up or save import. Cheap: already-loaded
			//and not-unlocked buildings short-circuit on flag checks.
			Game.LoadMinigames();
			for (var iKey in Game.Objects)
			{
				var me=Game.Objects[iKey];
				if (Game.isMinigameReady(me) && me.minigame.logic && Game.ascensionMode!=1) me.minigame.logic();
			}
			
			if (Game.specialTab!='' && Game.T%(Game.fps*3)==0) Game.ToggleSpecialMenu(1);
			
			//wrinklers
			if (Game.cpsSucked>0)
			{
				Game.Dissolve((Game.cookiesPs/Game.fps)*Game.cpsSucked);
				Game.cookiesSucked+=((Game.cookiesPs/Game.fps)*Game.cpsSucked);
				//should be using one of the following, but I'm not sure what I'm using this stat for anymore
				//Game.cookiesSucked=Game.wrinklers.reduce(function(s,w){return s+w.sucked;},0);
				//for (var i in Game.wrinklers) {Game.cookiesSucked+=Game.wrinklers[i].sucked;}
			}
			
			//var cps=Game.cookiesPs+Game.cookies*0.01;//exponential cookies
			//Game.Earn(cps/Game.fps);//add cookies per second
			
			for (var iKey in Game.Objects)
			{
				var me=Game.Objects[iKey];
				me.totalCookies+=(me.storedTotalCps*Game.globalCpsMult)/Game.fps;
			}
			if (Game.prefs.particles && Game.cookies && Game.T%Math.ceil(Game.fps/Math.min(10,Game.cookiesPs))==0) Game.particleAdd();//cookie shower
			
			if (Game.T%(Game.fps*10)==0) Game.recalculateGains=1;//recalculate CpS every 10 seconds (for dynamic boosts such as Century egg)
			
			/*=====================================================================================
			UNLOCKING STUFF
			=======================================================================================*/
			if (Game.T%(Game.fps)==0 && Math.random()<1/1000000) Game.Win('Just plain lucky');//1 chance in 1,000,000 every second achievement
			if (Game.T%(Game.fps*5)==0 && Game.ObjectsById.length>0)//check some achievements and upgrades
			{
				if (isNaN(Game.cookies)) {Game.cookies=0;Game.cookiesEarned=0;Game.recalculateGains=1;}
				
				var timePlayed: number=Date.now()-Game.startDate;//was a Date container (setTime + valueOf in the '<=' checks); the ms number is runtime-identical
				
				if (!Game.fullDate || (Date.now()-Game.fullDate)>=365*24*60*60*1000) Game.Win('So much to do so much to see');
				
				if (Game.cookiesEarned>=1000000 && (Game.ascensionMode==1 || Game.resets==0))//challenge run or hasn't ascended yet
				{
					if (timePlayed<=1000*60*35) Game.Win('Speed baking I');
					if (timePlayed<=1000*60*25) Game.Win('Speed baking II');
					if (timePlayed<=1000*60*15) Game.Win('Speed baking III');
					
					if (Game.cookieClicks<=15) Game.Win('Neverclick');
					if (Game.cookieClicks<=0) Game.Win('True Neverclick');
					if (Game.cookiesEarned>=1000000000 && Game.UpgradesOwned==0) Game.Win('Hardcore');
				}
				
				//CC3: challenge-mode completion rewards — reach a cookie milestone
				//during the run to permanently unlock the themed heavenly upgrade
				//(the shadow achievement is the persistent flag; the upgrades check
				//Game.HasAchiev so they only appear in the tree once earned).
				if (Game.ascensionMode==2 && Game.cookiesEarned>=1000000000000000) Game.Win('Scrolling adept');
				if (Game.ascensionMode==3 && Game.cookiesEarned>=1000000000000) Game.Win('Golden heart');
				if (Game.ascensionMode==4 && Game.cookiesEarned>=1000000000) Game.Win('Unity');
				if (Game.ascensionMode==5 && Game.cookiesEarned>=1000000000000000) Game.Win('Minimalist');
				
				for (var iKey in Game.UnlockAt)
				{
					var unlock=Game.UnlockAt[iKey];
					if (Game.cookiesEarned>=unlock.cookies)
					{
						var pass=1;
						if (unlock.require && !Game.Has(unlock.require) && !Game.HasAchiev(unlock.require)) pass=0;
						if (unlock.season && Game.season!=unlock.season) pass=0;
						if (pass) {Game.Unlock(unlock.name);Game.Win(unlock.name);}
					}
				}
				
				if (Game.Has('Golden switch')) Game.Unlock('Golden switch [off]');
				if (Game.Has('Shimmering veil') && !Game.Has('Shimmering veil [off]') && !Game.Has('Shimmering veil [on]')) {Game.Unlock('Shimmering veil [on]');Game.Upgrades['Shimmering veil [off]'].earn();}
				if (Game.Has('Sugar craving')) Game.Unlock('Sugar frenzy');
				if (Game.Has('Classic dairy selection')) Game.Unlock('Milk selector');
				if (Game.Has('Basic wallpaper assortment')) Game.Unlock('Background selector');
				if (Game.Has('Golden cookie alert sound')) Game.Unlock('Golden cookie sound selector');
				if (Game.Has('Sound test')) Game.Unlock('Jukebox');
				
				if (Game.Has('Prism heart biscuits')) Game.Win('Lovely cookies');
				if (Game.season=='easter')
				{
					var eggs=0;
					for (var iKey in Game.easterEggs)
					{
						if (Game.HasUnlocked(Game.easterEggs[iKey])) eggs++;
					}
					if (eggs>=1) Game.Win('The hunt is on');
					if (eggs>=7) Game.Win('Egging on');
					if (eggs>=14) Game.Win('Mass Easteria');
					if (eggs>=Game.easterEggs.length) Game.Win('Hide & seek champion');
				}
				
				if (Game.Has('Fortune cookies'))
				{
 					var list=Game.Tiers['fortune'].upgrades!;
					var fortunes=0;
					for (var iKey in list)
					{
 						if (Game.Has(list[+iKey].name)) fortunes++;
					}
					if (fortunes>=list.length) Game.Win('O Fortuna');
				}
				
				if (Game.Has('Legacy') && Game.ascensionMode!=1)
				{
					Game.Unlock('Heavenly chip secret');
					if (Game.Has('Heavenly chip secret')) Game.Unlock('Heavenly cookie stand');
					if (Game.Has('Heavenly cookie stand')) Game.Unlock('Heavenly bakery');
					if (Game.Has('Heavenly bakery')) Game.Unlock('Heavenly confectionery');
					if (Game.Has('Heavenly confectionery')) Game.Unlock('Heavenly key');
					
					if (Game.Has('Heavenly key')) Game.Win('Wholesome');
				}
			
				for (var iKey in Game.BankAchievements)
				{
					if (Game.cookiesEarned>=Game.BankAchievements[iKey].threshold) Game.Win(Game.BankAchievements[iKey].name);
				}
				
				var buildingsOwned=0;
				var mathematician=1;
				var base10=1;
				var minAmount=100000;
				for (var iKey in Game.Objects)
				{
					buildingsOwned+=Game.Objects[iKey].amount;
					minAmount=Math.min(Game.Objects[iKey].amount,minAmount);
					if (!Game.HasAchiev('Mathematician')) {if (Game.Objects[iKey].amount<Math.min(128,Math.pow(2,(Game.ObjectsById.length-Game.Objects[iKey].id)-1))) mathematician=0;}
					if (!Game.HasAchiev('Base 10')) {if (Game.Objects[iKey].amount<(Game.ObjectsById.length-Game.Objects[iKey].id)*10) base10=0;}
				}
				if (minAmount>=1) Game.Win('One with everything');
				if (mathematician==1) Game.Win('Mathematician');
				if (base10==1) Game.Win('Base 10');
				if (minAmount>=100) {Game.Win('Centennial');Game.Unlock('Milk chocolate butter biscuit');}
				if (minAmount>=150) {Game.Win('Centennial and a half');Game.Unlock('Dark chocolate butter biscuit');}
				if (minAmount>=200) {Game.Win('Bicentennial');Game.Unlock('White chocolate butter biscuit');}
				if (minAmount>=250) {Game.Win('Bicentennial and a half');Game.Unlock('Ruby chocolate butter biscuit');}
				if (minAmount>=300) {Game.Win('Tricentennial');Game.Unlock('Lavender chocolate butter biscuit');}
				if (minAmount>=350) {Game.Win('Tricentennial and a half');Game.Unlock('Synthetic chocolate green honey butter biscuit');}
				if (minAmount>=400) {Game.Win('Quadricentennial');Game.Unlock('Royal raspberry chocolate butter biscuit');}
				if (minAmount>=450) {Game.Win('Quadricentennial and a half');Game.Unlock('Ultra-concentrated high-energy chocolate butter biscuit');}
				if (minAmount>=500) {Game.Win('Quincentennial');Game.Unlock('Pure pitch-black chocolate butter biscuit');}
				if (minAmount>=550) {Game.Win('Quincentennial and a half');Game.Unlock('Cosmic chocolate butter biscuit');}
				if (minAmount>=600) {Game.Win('Sexcentennial');Game.Unlock('Butter biscuit (with butter)');}
				if (minAmount>=650) {Game.Win('Sexcentennial and a half');Game.Unlock('Everybutter biscuit');}
				
				if (Game.ascensionMode!=2)//Trigger finger: no clicking achievements
			{
				if (Game.handmadeCookies>=1000) {Game.Win('Clicktastic');Game.Unlock('Plastic mouse');}
				if (Game.handmadeCookies>=100000) {Game.Win('Clickathlon');Game.Unlock('Iron mouse');}
				if (Game.handmadeCookies>=10000000) {Game.Win('Clickolympics');Game.Unlock('Titanium mouse');}
				if (Game.handmadeCookies>=1000000000) {Game.Win('Clickorama');Game.Unlock('Adamantium mouse');}
				if (Game.handmadeCookies>=100000000000) {Game.Win('Clickasmic');Game.Unlock('Unobtainium mouse');}
				if (Game.handmadeCookies>=10000000000000) {Game.Win('Clickageddon');Game.Unlock('Eludium mouse');}
				if (Game.handmadeCookies>=1000000000000000) {Game.Win('Clicknarok');Game.Unlock('Wishalloy mouse');}
				if (Game.handmadeCookies>=100000000000000000) {Game.Win('Clickastrophe');Game.Unlock('Fantasteel mouse');}
				if (Game.handmadeCookies>=10000000000000000000) {Game.Win('Clickataclysm');Game.Unlock('Nevercrack mouse');}
				if (Game.handmadeCookies>=1000000000000000000000) {Game.Win('The ultimate clickdown');Game.Unlock('Armythril mouse');}
				if (Game.handmadeCookies>=100000000000000000000000) {Game.Win('All the other kids with the pumped up clicks');Game.Unlock('Technobsidian mouse');}
				if (Game.handmadeCookies>=10000000000000000000000000) {Game.Win('One...more...click...');Game.Unlock('Plasmarble mouse');}
				if (Game.handmadeCookies>=1000000000000000000000000000) {Game.Win('Clickety split');Game.Unlock('Miraculite mouse');}
				if (Game.handmadeCookies>=100000000000000000000000000000) {Game.Win('Ain\'t that a click in the head');Game.Unlock('Aetherice mouse');}
			}
				
				if (Game.cookiesEarned<Game.cookies) Game.Win('Cheated cookies taste awful');
				
				if (Game.Has('Skull cookies') && Game.Has('Ghost cookies') && Game.Has('Bat cookies') && Game.Has('Slime cookies') && Game.Has('Pumpkin cookies') && Game.Has('Eyeball cookies') && Game.Has('Spider cookies')) Game.Win('Spooky cookies');
				if (Game.wrinklersPopped>=1) Game.Win('Itchscratcher');
				if (Game.wrinklersPopped>=50) Game.Win('Wrinklesquisher');
				if (Game.wrinklersPopped>=200) Game.Win('Moistburster');
				
				if (Game.cookiesEarned>=1000000 && Game.Has('How to bake your dragon')) Game.Unlock('A crumbly egg');
				
				if (Game.cookiesEarned>=25 && Game.season=='christmas') Game.Unlock('A festive hat');
				if (Game.Has('Christmas tree biscuits') && Game.Has('Snowflake biscuits') && Game.Has('Snowman biscuits') && Game.Has('Holly biscuits') && Game.Has('Candy cane biscuits') && Game.Has('Bell biscuits') && Game.Has('Present biscuits')) Game.Win('Let it snow');
				
				if (Game.reindeerClicked>=1) Game.Win('Oh deer');
				if (Game.reindeerClicked>=50) Game.Win('Sleigh of hand');
				if (Game.reindeerClicked>=200) Game.Win('Reindeer sleigher');
				
				if (buildingsOwned>=100) Game.Win('Builder');
				if (buildingsOwned>=500) Game.Win('Architect');
				if (buildingsOwned>=1000) Game.Win('Engineer');
				if (buildingsOwned>=2500) Game.Win('Lord of Constructs');
				if (buildingsOwned>=5000) Game.Win('Grand design');
				if (buildingsOwned>=7500) Game.Win('Ecumenopolis');
				if (buildingsOwned>=10000) Game.Win('Myriad');
				if (Game.UpgradesOwned>=20) Game.Win('Enhancer');
				if (Game.UpgradesOwned>=50) Game.Win('Augmenter');
				if (Game.UpgradesOwned>=100) Game.Win('Upgrader');
				if (Game.UpgradesOwned>=200) Game.Win('Lord of Progress');
				if (Game.UpgradesOwned>=300) Game.Win('The full picture');
				if (Game.UpgradesOwned>=400) Game.Win('When there\'s nothing left to add');
				if (Game.UpgradesOwned>=500) Game.Win('Kaizen');
				if (Game.UpgradesOwned>=600) Game.Win('Beyond quality');
				if (buildingsOwned>=4000 && Game.UpgradesOwned>=300) Game.Win('Polymath');
				if (buildingsOwned>=8000 && Game.UpgradesOwned>=400) Game.Win('Renaissance baker');
				
				if (!Game.HasAchiev('Jellicles'))
				{
					var kittens=0;
					for (var i=0;i<Game.UpgradesByPool['kitten'].length;i++)
					{
						if (Game.Has(Game.UpgradesByPool['kitten'][i].name)) kittens++;
					}
					if (kittens>=10) Game.Win('Jellicles');
				}
				
				if (Game.cookiesEarned>=10000000000000 && !Game.HasAchiev('You win a cookie')) {Game.Win('You win a cookie');Game.Earn(1);}
				
				if (Game.shimmerTypes['golden'].n>=4) Game.Win('Four-leaf cookie');
				
				var grandmas=0;
				for (var iKey in Game.GrandmaSynergies)
				{
					if (Game.Has(Game.GrandmaSynergies[iKey])) grandmas++;
				}
				if (!Game.HasAchiev('Elder') && grandmas>=7) Game.Win('Elder');
				if (!Game.HasAchiev('Veteran') && grandmas>=14) Game.Win('Veteran');
				
				var catSynergiesOwned=0;
				for (var iKey in Game.CatSynergies)
				{
					if (Game.Has(Game.CatSynergies[iKey])) catSynergiesOwned++;
				}
				if (!Game.HasAchiev('The purr-fect match') && catSynergiesOwned>=Game.CatSynergies.length) Game.Win('The purr-fect match');
				if (Game.Objects['Grandma'].amount>=6 && !Game.Has('Bingo center/Research facility') && Game.HasAchiev('Elder')) Game.Unlock('Bingo center/Research facility');
				if (Game.pledges>0) Game.Win('Elder nap');
				if (Game.pledges>=5) Game.Win('Elder slumber');
				if (Game.pledges>=10) Game.Unlock('Sacrificial rolling pins');
				if (Game.Objects['Cursor'].amount+Game.Objects['Grandma'].amount>=777) Game.Win('The elder scrolls');
				
				for (var iKey in Game.Objects)
				{
					var it=Game.Objects[iKey];
					for (var ii in it.productionAchievs)
					{
						if (it.totalCookies>=it.productionAchievs[ii].pow) Game.Win(it.productionAchievs[ii].achiev.name);
					}
				}
				
				if (!Game.HasAchiev('Cookie-dunker') && Game.LeftBackground && Game.milkProgress>0.1 && (Game.LeftBackground.canvas.height*0.4+256/2-16)>((1-Game.milkHd)*Game.LeftBackground.canvas.height)) Game.Win('Cookie-dunker');
				//&& l('bigCookie').getBounds().bottom>l('milk').getBounds().top+16 && Game.milkProgress>0.1) Game.Win('Cookie-dunker');
				
				Game.runModHook('check');
			}
			
			Game.cookiesd+=(Game.cookies-Game.cookiesd)*0.3;
			
			if (Game.storeToRefresh) Game.RefreshStore();
			if (Game.upgradesToRebuild) Game.RebuildUpgrades();
			
			Game.updateShimmers();
			Game.updateBuffs();
			
			Game.UpdateTicker();
		}
		
		if (Game.T%(Game.fps*2)==0)
		{
			var title='Cookie Clicker';
			if (Game.season=='fools') title='Cookie Baker';
			document.title=(Game.OnAscend?(EN?'Ascending! ':(loc("Ascending")+' | ')):'')+loc("%1 cookie",LBeautify(Game.cookies))+' - '+title;
		}
		if (Game.T%15==0)
		{
			//written through the magic of "hope for the best" maths
			var chipsOwned=Game.HowMuchPrestige(Game.cookiesReset);
			var ascendNowToOwn=Math.floor(Game.HowMuchPrestige(Game.cookiesReset+Game.cookiesEarned));
			var ascendNowToGet=ascendNowToOwn-Math.floor(chipsOwned);
			var nextChipAt=Game.HowManyCookiesReset(Math.floor(chipsOwned+ascendNowToGet+1))-Game.HowManyCookiesReset(Math.floor(chipsOwned+ascendNowToGet));
			var cookiesToNext=Game.HowManyCookiesReset(ascendNowToOwn+1)-(Game.cookiesEarned+Game.cookiesReset);
			var percent=1-(cookiesToNext/nextChipAt);
			
			//fill the tooltip under the Legacy tab
			var date=new Date();
			date.setTime(Date.now()-Game.startDate);
			var timeInSeconds=date.getTime()/1000;
			var startDate=Game.sayTime(timeInSeconds*Game.fps,-1);
			
			var str='';
			if (EN) str+='You\'ve been on this run for <b>'+(startDate==''?'not very long':(startDate))+'</b>.<br>';
			else str+=loc("You've been on this run for <b>%1</b>.",startDate)+'<br>';
			str+='<div class="line"></div>';
			if (Game.prestige>0)
			{
				str+=loc("Your prestige level is currently <b>%1</b>.<br>(CpS +%2%)",[Beautify(Game.prestige),Beautify(Game.prestige)]);
				str+='<div class="line"></div>';
			}
			if (ascendNowToGet<1) str+=loc("Ascending now would grant you no prestige.");
			else if (ascendNowToGet<2) str+=loc("Ascending now would grant you<br><b>1 prestige level</b> (+1% CpS)<br>and <b>1 heavenly chip</b> to spend.");
			else str+=loc("Ascending now would grant you<br><b>%1 prestige levels</b> (+%2% CpS)<br>and <b>%3 heavenly chips</b> to spend.",[Beautify(ascendNowToGet),Beautify(ascendNowToGet),Beautify(ascendNowToGet)]);
			if (cookiesToNext>=0)
			{
				//note: cookiesToNext can be negative at higher HC amounts due to precision loss. we simply hide it in such cases, as this usually only occurs when the gap is small and rapidly overcome anyway
				str+='<div class="line"></div>';
				str+=loc("You need <b>%1 more cookies</b> for the next level.",Beautify(cookiesToNext))+'<br>';
			}
			l('ascendTooltip').innerHTML=str;
			
			if (ascendNowToGet>0)//show number saying how many chips you'd get resetting now
			{
				Game.ascendNumber.textContent='+'+SimpleBeautify(ascendNowToGet);
				Game.ascendNumber.style.display='block';
			}
			else
			{
				Game.ascendNumber.style.display='none';
			}
			
			if (ascendNowToGet>Game.ascendMeterLevel || Game.ascendMeterPercentT<Game.ascendMeterPercent)
			{
				//reset the gauge and play a sound if we gained a potential level
				Game.ascendMeterPercent=0;
				//PlaySound('snd/levelPrestige.mp3');//a bit too annoying
			}
			Game.ascendMeterLevel=ascendNowToGet;
			Game.ascendMeterPercentT=percent;//gauge that fills up as you near your next chip
			//if (Game.ascendMeterPercentT<Game.ascendMeterPercent) {Game.ascendMeterPercent=0;PlaySound('snd/levelPrestige.mp3',0.5);}
			//if (percent>=1) {Game.ascendMeter.className='';} else Game.ascendMeter.className='filling';
		}
		//Game.ascendMeter.style.right=Math.floor(Math.max(0,1-Game.ascendMeterPercent)*100)+'px';
		Game.ascendMeter.style.backgroundPosition=(-Game.T*0.5-Game.ascendMeterPercent*100)+'px';
		Game.ascendMeter.style.transform='translate('+Math.floor(-Math.max(0,1-Game.ascendMeterPercent)*100)+'%,0px)';
		Game.ascendMeterPercent+=(Game.ascendMeterPercentT-Game.ascendMeterPercent)*0.1;
		
		Game.NotesLogic();
		if (Game.mouseMoved || Game.Scroll || Game.tooltip.dynamic) Game.tooltip.update();
		
		if (Game.T%(Game.fps*5)==0 && !Game.mouseDown && (Game.onMenu=='stats' || Game.onMenu=='prefs')) Game.UpdateMenu();
		if (Game.T%(Game.fps*1)==0) Game.UpdatePrompt();
		if (Game.AscendTimer>0) Game.UpdateAscendIntro();
		if (Game.ReincarnateTimer>0) Game.UpdateReincarnateIntro();
		if (Game.OnAscend) Game.UpdateAscend();
		
		Game.runModHook('logic');
		
		if (Game.sparklesT>0)
		{
			Game.sparkles.style.backgroundPosition=-Math.floor((Game.sparklesFrames-Game.sparklesT+1)*128)+'px 0px';
			Game.sparklesT--;
			if (Game.sparklesT==1) Game.sparkles.style.display='none';
		}
		
		Game.Click=0;
		Game.Scroll=0;
		Game.mouseMoved=0;
		Game.CanClick=1;
		
		//CC3 perf: the autosave's serialize+base64+localStorage write used to run
		//on the main thread inside a frame, spiking it every 60s. The tick now
		//only flags it; the actual write goes through requestIdleCallback (with a
		//synchronous fallback). Manual saves (Game.toSave) still write
		//synchronously in the same tick, exactly as before. The minigame-loading
		//guard applies to both paths.
		if (Game.toSave && !Game.OnAscend)
		{
			Game.__cc3IdleSave=false;//a manual save supersedes any pending autosave
			Game.WriteSave();
		}
		else if (Game.T%(Game.fps*60)==0 && Game.T>Game.fps*10 && Game.prefs.autosave && !Game.OnAscend) Game.__cc3IdleSave=true;
		if (Game.__cc3IdleSave && !Game.OnAscend)
		{
			//check if we can save : no minigames are loading
			var canSave=true;
			for (var iKey in Game.Objects)
			{
				var me=Game.Objects[iKey];
				if (me.minigameLoading){canSave=false;break;}
			}
			if (canSave)
			{
				Game.__cc3IdleSave=false;
				if (typeof requestIdleCallback==='function')
				{
					requestIdleCallback(function(){if (!Game.toSave) Game.WriteSave();});
				}
				else Game.WriteSave();
			}//else: minigames still loading — retry next tick
		}
		if (!Game.toSave && !Game.isSaving)
		{
			if (Game.toReload) {Game.toReload=false;if (!App){location.reload();}else{App.reload();}}
			if (Game.toQuit) {Game.toQuit=false;if (!App){window.close();}else{App.quit();}}
		}
		
		if (App && App.logic) App.logic(Game.T);
		
		//every hour: get server data (ie. update notification, patreon, steam etc)
		if (Game.T%(Game.fps*60*60)==0 && Game.T>Game.fps*10/* && Game.prefs.autoupdate*/) {Game.CheckUpdates();Game.GrabData();}
		
		Game.T++;
	}
