/**
 * systems/calculateGains.ts — CpS recalculation engine (Phase 7, slice 2).
 *
 * The 2.048 engine defined `Game.CalculateGains` as a function expression inside
 * `Game.Init`; it is now a typed export and the engine keeps the same
 * `Game.CalculateGains = CalculateGains` slot at the exact original Init
 * position, so the modding surface (`Game.CalculateGains`) and every call site
 * are unchanged.
 *
 * Slice scope (closure-free — reads only `Game` and window-shim globals):
 *   - `CalculateGains` (engine ~1856–2115): the ~260-line per-recalculation
 *     function that sums building CpS, applies kitten/egg/god/prestige
 *     multipliers, wrinkler drain, golden-switch/veil effects, buffs, and
 *     writes `Game.cookiesPs`, `Game.globalCpsMult`, `Game.unbuffedCps`,
 *     `Game.computedMouseCps`, etc.
 *
 * Bodies are verbatim (original indentation kept) — only parameter and
 * return annotations were added.
 *
 * No runtime imports: `Game`, `Game.runModHookOnValue`, `Game.mouseCps`,
 * `Game.computeLumpTimes` resolve through src/globals.d.ts.
 */
export function CalculateGains()
	{
		Game.cookiesPs=0;
		var mult=1;
		//add up effect bonuses from building minigames
		var effs: Record<string, number>={};
		for (var iKey in Game.Objects)
		{
			if (Game.Objects[iKey].minigameLoaded && Game.Objects[iKey].minigame.effs)
			{
				var myEffs=Game.Objects[iKey].minigame.effs;
				for (var ii in myEffs)
				{
					if (effs[ii]) effs[ii]*=myEffs[ii];
					else effs[ii]=myEffs[ii];
				}
			}
		}
		Game.effs=effs;
		
		if (Game.ascensionMode!=1) mult+=parseFloat(Game.prestige)*0.01*Game.heavenlyPower*Game.GetHeavenlyMultiplier();
		
		mult*=Game.eff('cps');
		
		if (Game.Has('Heralds') && Game.ascensionMode!=1) mult*=(1+0.01*Game.heralds);
		if (Game.Has('Cat café loyalty')) mult*=1.01;
		
		for (var iKey in Game.cookieUpgrades)
		{
  			var me:any=Game.cookieUpgrades[iKey];//CC3: same-scope var me reused with different container types (save.ts pattern)
			if (Game.Has(me.name))
			{
				mult*=(1+(typeof(me.power)==='function'?me.power(me):me.power)*0.01);
			}
		}
		
		if (Game.Has('Specialized chocolate chips')) mult*=1.01;
		if (Game.Has('Designer cocoa beans')) mult*=1.02;
		if (Game.Has('Underworld ovens')) mult*=1.03;
		if (Game.Has('Exotic nuts')) mult*=1.04;
		if (Game.Has('Arcane sugar')) mult*=1.05;
		
		if (Game.Has('Increased merriness')) mult*=1.15;
		if (Game.Has('Improved jolliness')) mult*=1.15;
		if (Game.Has('A lump of coal')) mult*=1.01;
		if (Game.Has('An itchy sweater')) mult*=1.01;
		if (Game.Has('Santa\'s dominion')) mult*=1.2;
		
		if (Game.Has('Fortune #100')) mult*=1.01;
		if (Game.Has('Fortune #101')) mult*=1.07;
		
		if (Game.Has('Dragon scale')) mult*=1.03;
		
		var buildMult=1;
		if (Game.hasGod)
		{
			var godLvl=Game.hasGod('asceticism');
			if (godLvl==1) mult*=1.15;
			else if (godLvl==2) mult*=1.1;
			else if (godLvl==3) mult*=1.05;
			
			var godLvl=Game.hasGod('ages');
			if (godLvl==1) mult*=1+0.15*Math.sin((Date.now()/1000/(60*60*3))*Math.PI*2);
			else if (godLvl==2) mult*=1+0.15*Math.sin((Date.now()/1000/(60*60*12))*Math.PI*2);
			else if (godLvl==3) mult*=1+0.15*Math.sin((Date.now()/1000/(60*60*24))*Math.PI*2);
			
			var godLvl=Game.hasGod('decadence');
			if (godLvl==1) buildMult*=0.93;
			else if (godLvl==2) buildMult*=0.95;
			else if (godLvl==3) buildMult*=0.98;
			
			var godLvl=Game.hasGod('industry');
			if (godLvl==1) buildMult*=1.1;
			else if (godLvl==2) buildMult*=1.06;
			else if (godLvl==3) buildMult*=1.03;
			
			var godLvl=Game.hasGod('labor');
			if (godLvl==1) buildMult*=0.97;
			else if (godLvl==2) buildMult*=0.98;
			else if (godLvl==3) buildMult*=0.99;
		}
		
		if (Game.Has('Santa\'s legacy')) mult*=1+(Game.santaLevel+1)*0.03;
		
		
		Game.milkProgress=Game.AchievementsOwned/25;
		var milkMult=1;
		if (Game.Has('Santa\'s milk and cookies')) milkMult*=1.05;
		//if (Game.hasAura('Breath of Milk')) milkMult*=1.05;
		milkMult*=1+Game.auraMult('Breath of Milk')*0.05;
		if (Game.hasGod)
		{
			var godLvl=Game.hasGod('mother');
			if (godLvl==1) milkMult*=1.1;
			else if (godLvl==2) milkMult*=1.05;
			else if (godLvl==3) milkMult*=1.03;
		}
		milkMult*=Game.eff('milk');
		
		var catMult=1;
		
		if (Game.Has('Kitten helpers')) catMult*=(1+Game.milkProgress*0.1*milkMult);
		if (Game.Has('Kitten workers')) catMult*=(1+Game.milkProgress*0.125*milkMult);
		if (Game.Has('Kitten engineers')) catMult*=(1+Game.milkProgress*0.15*milkMult);
		if (Game.Has('Kitten overseers')) catMult*=(1+Game.milkProgress*0.175*milkMult);
		if (Game.Has('Kitten managers')) catMult*=(1+Game.milkProgress*0.2*milkMult);
		if (Game.Has('Kitten accountants')) catMult*=(1+Game.milkProgress*0.2*milkMult);
		if (Game.Has('Kitten specialists')) catMult*=(1+Game.milkProgress*0.2*milkMult);
		if (Game.Has('Kitten experts')) catMult*=(1+Game.milkProgress*0.2*milkMult);
		if (Game.Has('Kitten consultants')) catMult*=(1+Game.milkProgress*0.2*milkMult);
		if (Game.Has('Kitten assistants to the regional manager')) catMult*=(1+Game.milkProgress*0.175*milkMult);
		if (Game.Has('Kitten marketeers')) catMult*=(1+Game.milkProgress*0.15*milkMult);
		if (Game.Has('Kitten analysts')) catMult*=(1+Game.milkProgress*0.125*milkMult);
		if (Game.Has('Kitten executives')) catMult*=(1+Game.milkProgress*0.115*milkMult);
		if (Game.Has('Kitten admins')) catMult*=(1+Game.milkProgress*0.11*milkMult);
		if (Game.Has('Kitten angels')) catMult*=(1+Game.milkProgress*0.1*milkMult);
		if (Game.Has('Fortune #103')) catMult*=(1+Game.milkProgress*0.05*milkMult);
		
		Game.cookiesMultByType['kittens']=catMult;
		
		for (var iKey in Game.Objects)
		{
  			var me:any=Game.Objects[iKey];
			me.storedCps=me.cps(me);
			if (Game.ascensionMode!=1) me.storedCps*=(1+me.level*0.01)*buildMult;
			if (me.id==1 && Game.Has('Milkhelp&reg; lactose intolerance relief tablets')) me.storedCps*=1+0.05*Game.milkProgress*milkMult;//this used to be "me.storedCps*=1+0.1*Math.pow(catMult-1,0.5)" which was. hmm
			me.storedTotalCps=me.amount*me.storedCps;
			Game.cookiesPs+=me.storedTotalCps;
			Game.cookiesPsByType[me.name]=me.storedTotalCps;
		}
		//cps from buildings only
		Game.buildingCps=Game.cookiesPs;
		
		if (Game.Has('"egg"')) {Game.cookiesPs+=9;Game.cookiesPsByType['"egg"']=9;}//"egg"
		
		mult*=catMult;
		
		var eggMult=1;
		if (Game.Has('Chicken egg')) eggMult*=1.01;
		if (Game.Has('Duck egg')) eggMult*=1.01;
		if (Game.Has('Turkey egg')) eggMult*=1.01;
		if (Game.Has('Quail egg')) eggMult*=1.01;
		if (Game.Has('Robin egg')) eggMult*=1.01;
		if (Game.Has('Ostrich egg')) eggMult*=1.01;
		if (Game.Has('Cassowary egg')) eggMult*=1.01;
		if (Game.Has('Salmon roe')) eggMult*=1.01;
		if (Game.Has('Frogspawn')) eggMult*=1.01;
		if (Game.Has('Shark egg')) eggMult*=1.01;
		if (Game.Has('Turtle egg')) eggMult*=1.01;
		if (Game.Has('Ant larva')) eggMult*=1.01;
		if (Game.Has('Century egg'))
		{
			//the boost increases a little every day, with diminishing returns up to +10% on the 100th day
			var day=Math.floor((Date.now()-Game.startDate)/1000/10)*10/60/60/24;
			day=Math.min(day,100);
			eggMult*=1+(1-Math.pow(1-day/100,3))*0.1;
		}
		
		Game.cookiesMultByType['eggs']=eggMult;
		mult*=eggMult;
		
		if (Game.Has('Sugar baking')) mult*=(1+Math.min(100,Game.lumps)*0.01);
		
		//CC3: challenge rewards — Monoculture (Unity: +1% CpS per 100 of your
		//most-owned building) and Spender (Minimalist: +2% CpS per 100
		//upgrades owned).
		if (Game.Has('Unity'))
		{
			var mostOwned=0;
			for (var iUnity in Game.Objects)
			{
				if (Game.Objects[iUnity].amount>mostOwned) mostOwned=Game.Objects[iUnity].amount;
			}
			mult*=(1+0.01*Math.floor(mostOwned/100));
		}
		if (Game.Has('Minimalist'))
		{
			var prestigeOwned=0;
			for (var iPrestige in Game.PrestigeUpgrades)
			{
				if (Game.PrestigeUpgrades[iPrestige].bought) prestigeOwned++;
			}
			mult*=(1+0.02*Math.floor(prestigeOwned/100));
		}
		
		//if (Game.hasAura('Radiant Appetite')) mult*=2;
		mult*=1+Game.auraMult('Radiant Appetite');
		
		var rawCookiesPs=Game.cookiesPs*mult;
		for (var iKey in Game.CpsAchievements)
		{
			if (rawCookiesPs>=Game.CpsAchievements[iKey].threshold) Game.Win(Game.CpsAchievements[iKey].name);
		}
		Game.cookiesPsRaw=rawCookiesPs;
		Game.cookiesPsRawHighest=Math.max(Game.cookiesPsRawHighest,rawCookiesPs);
		
		var n=Game.shimmerTypes['golden'].n;
		var auraMult=Game.auraMult('Dragon\'s Fortune');
		for (var i=0;i<n;i++){mult*=1+auraMult*1.23;}
		
		var name=Game.bakeryName.toLowerCase();
		if (name=='orteil') mult*=0.99;
		else if (name=='ortiel') mult*=0.98;//or so help me
		
		var sucking=0;
		for (var iKey in Game.wrinklers)
		{
			if (Game.wrinklers[iKey].phase==2)
			{
				sucking++;
			}
		}
		var suckRate=1/20;//each wrinkler eats a twentieth of your CpS
		suckRate*=Game.eff('wrinklerEat');
		
		Game.cpsSucked=sucking*suckRate;
		
		
		if (Game.Has('Elder Covenant')) mult*=0.95;
		
		if (Game.Has('Golden switch [off]'))
		{
			var goldenSwitchMult=1.5;
			if (Game.Has('Residual luck'))
			{
				var upgrades=Game.goldenCookieUpgrades;
				for (var iKey in upgrades) {if (Game.Has(upgrades[iKey])) goldenSwitchMult+=0.1;}
			}
			mult*=goldenSwitchMult;
		}
		if (Game.Has('Shimmering veil [off]'))
		{
			mult*=1+Game.getVeilBoost();
		}
		if (Game.Has('Magic shenanigans')) mult*=1000;
		if (Game.Has('Occult obstruction')) mult*=0;
		
		
		Game.cookiesPs=Game.runModHookOnValue('cps',Game.cookiesPs);
		
		
		//cps without golden cookie effects
		Game.unbuffedCps=Game.cookiesPs*mult;
		
		for (var iKey in Game.buffs)
		{
			if (typeof Game.buffs[iKey].multCpS!=='undefined') mult*=Game.buffs[iKey].multCpS;
		}
		
		Game.globalCpsMult=mult;
		Game.cookiesPs*=Game.globalCpsMult;
		
		//if (Game.hasBuff('Cursed finger')) Game.cookiesPs=0;
		
		Game.computedMouseCps=Game.mouseCps();
		
		Game.computeLumpTimes();
		
		Game.recalculateGains=0;
	}