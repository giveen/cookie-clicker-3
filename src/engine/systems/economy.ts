/**
 * systems/economy.ts — the engine's economy-math system (Phase 4, slice 1).
 *
 * The 2.048 engine defined these six functions as function expressions
 * inside `Game.Init`; they are now typed exports and the engine keeps the
 * same `Game.X = X` slots at the exact original Init positions, so the
 * modding surface (`Game.HowMuchPrestige`, …) and every call site are
 * unchanged.
 *
 * Slice scope (all closure-free — they read only `Game` and window-shim
 * globals, no Init-scoped vars):
 *   - `HowMuchPrestige` / `HowManyCookiesReset` (engine ~3925–3933)
 *   - `EarnHeavenlyChips` (engine ~3935–3948)
 *   - `GetHeavenlyMultiplier` (engine ~3950–3971)
 *   - `ComputeCps` (engine ~7813–7817)
 *   - `GetTieredCpsMult` (engine ~8111–8136)
 *
 * Bodies are verbatim (original indentation kept) — only parameter
 * annotations were added. `silent?: any` on EarnHeavenlyChips is faithful:
 * call sites pass either nothing or `true`.
 *
 * No runtime imports: `Game`, `loc`, `LBeautify` resolve through
 * src/globals.d.ts to the engine's window shim.
 */
import type { Building } from '../types';

export function HowMuchPrestige(cookies: number)//how much prestige [cookies] should land you
		{
			return Math.pow(cookies/1000000000000,1/Game.HCfactor);
		}
export function HowManyCookiesReset(chips: number)//how many cookies [chips] are worth
		{
			//this must be the inverse of the above function (ie. if cookies=chips^2, chips=cookies^(1/2) )
			return Math.pow(chips,Game.HCfactor)*1000000000000;
		}
export function EarnHeavenlyChips(cookiesForfeited: number,silent?: any)
		{
			//recalculate prestige and chips owned
			var prestige=Math.floor(Game.HowMuchPrestige(Game.cookiesReset+cookiesForfeited));
			prestige=Math.max(0,prestige);
			if (prestige!=Game.prestige)//did we change prestige levels?
			{
				var prestigeDifference=prestige-Game.prestige;
				Game.gainedPrestige=prestigeDifference;
				Game.heavenlyChips+=prestigeDifference;
				Game.prestige=prestige;
				if (!silent && prestigeDifference>0) Game.Notify(loc("You forfeit your %1.",loc("%1 cookie",LBeautify(cookiesForfeited))),loc("You gain <b>%1</b>!",loc("%1 prestige level",LBeautify(prestigeDifference))),[19,7]);
			}
		}
export function GetHeavenlyMultiplier()
		{
			var heavenlyMult=0;
			if (Game.Has('Heavenly chip secret')) heavenlyMult+=0.05;
			if (Game.Has('Heavenly cookie stand')) heavenlyMult+=0.20;
			if (Game.Has('Heavenly bakery')) heavenlyMult+=0.25;
			if (Game.Has('Heavenly confectionery')) heavenlyMult+=0.25;
			if (Game.Has('Heavenly key')) heavenlyMult+=0.25;
			//if (Game.hasAura('Dragon God')) heavenlyMult*=1.05;
			heavenlyMult*=1+Game.auraMult('Dragon God')*0.05;
			if (Game.Has('Lucky digit')) heavenlyMult*=1.01;
			if (Game.Has('Lucky number')) heavenlyMult*=1.01;
			if (Game.Has('Lucky payout')) heavenlyMult*=1.01;
			if (Game.hasGod)
			{
				var godLvl=Game.hasGod('creation');
				if (godLvl==1) heavenlyMult*=0.7;
				else if (godLvl==2) heavenlyMult*=0.8;
				else if (godLvl==3) heavenlyMult*=0.9;
			}
			return heavenlyMult;
		}

export function ComputeCps(base: number,mult: number,bonus?: number)
		{
			if (!bonus) bonus=0;
			return ((base)*(Math.pow(2,mult))+bonus);
		}

export function GetTieredCpsMult(me: Building)
		{
			var mult=1;
			for (var i in me.tieredUpgrades)
			{
				if (!Game.Tiers[me.tieredUpgrades[i].tier!].special && Game.Has(me.tieredUpgrades[i].name))
				{
					var tierMult=2;
					//unshackled
					if (Game.ascensionMode!=1 && Game.Has(me.unshackleUpgrade!) && Game.Has(Game.Tiers[me.tieredUpgrades[i].tier!].unshackleUpgrade!)) tierMult+=me.id==1?0.5:(20-me.id)*0.1;
					mult*=tierMult;
				}
			}
			for (var i in me.synergies)
			{
				var syn=me.synergies[i];
				if (Game.Has(syn.name))
				{
					if (syn.buildingTie1!.name==me.name) mult*=(1+0.05*syn.buildingTie2!.amount);
					else if (syn.buildingTie2!.name==me.name) mult*=(1+0.001*syn.buildingTie1!.amount);
				}
			}
			if (me.fortune && Game.Has((me.fortune as any).name)) mult*=1.07;
			if (me.grandma && Game.Has(me.grandma.name)) mult*=(1+Game.Objects['Grandma'].amount*0.01*(1/(me.id-1)));
			// Math.max(1,...): unlike me.grandma (never tied to Grandma itself, so
			// me.id is always >=2 there), me.cat can be 'Kitten grandmas', which
			// ties Cats to Grandma (id 1) -- the plain (me.id-1) divisor above
			// would be 0 -> Infinity/NaN for that one building.
			if (me.cat && Game.Has(me.cat.name)) mult*=(1+Game.Objects['Cats'].amount*0.01*(1/Math.max(1,me.id-1)));
			if (me.cat && Game.Has(me.cat.name) && Game.Has('Territorial pact')) mult*=(1+Game.Objects['Cats'].amount*0.01*(1/Math.max(1,me.id-1)));
			return mult;
		}

/*=====================================================================================
ECONOMY WRAPPERS (Phase 7, slice 2)
=======================================================================================*/
// The 2.048 engine defined these as function expressions inside `Game.Init`;
// they are now typed exports and the engine keeps the same Game.X = X slots
// at the exact original Init positions.

import { DISPLAYABLE_MAX } from '../utils/format';

// The cookie ledger must stay finite: float Infinity renders as "Infinity"
// on the top counter, makes every purchase a no-op (Infinity - price is
// still Infinity), and serializes the literal "Infinity" into save strings,
// which re-imports as Infinity — corrupting the save forever. The cap is
// the highest number the UI can display (format.ts); a balance at the cap
// plus any finite amount is still a finite float, so the clamp is stable.
export function clampCookies(v: number)
	{
		if (!Number.isFinite(v)) return (Number.isNaN(v) || v < 0) ? 0 : DISPLAYABLE_MAX;
		if (v > DISPLAYABLE_MAX) return DISPLAYABLE_MAX;
		return v;
	}
export function Earn(howmuch: number)
	{
		if (!Number.isFinite(howmuch)) return;// a non-finite reward must not poison the ledger
		Game.cookies=clampCookies(Game.cookies+howmuch);
		Game.cookiesEarned=clampCookies(Game.cookiesEarned+howmuch);
	}
export function Spend(howmuch: number)
	{
		if (!Number.isFinite(howmuch)) return;
		Game.cookies=clampCookies(Game.cookies-howmuch);
	}
export function Dissolve(howmuch: number)
	{
		if (!Number.isFinite(howmuch)) return;
		Game.cookies=clampCookies(Game.cookies-howmuch);
		Game.cookiesEarned=clampCookies(Game.cookiesEarned-howmuch);
		Game.cookies=Math.max(0,Game.cookies);
		Game.cookiesEarned=Math.max(0,Game.cookiesEarned);
	}
export function mouseCps()
	{
		var add=0;
		if (Game.Has('Thousand fingers')) add+=		0.1;
		if (Game.Has('Million fingers')) add*=		5;
		if (Game.Has('Billion fingers')) add*=		10;
		if (Game.Has('Trillion fingers')) add*=		20;
		if (Game.Has('Quadrillion fingers')) add*=	20;
		if (Game.Has('Quintillion fingers')) add*=	20;
		if (Game.Has('Sextillion fingers')) add*=	20;
		if (Game.Has('Septillion fingers')) add*=	20;
		if (Game.Has('Octillion fingers')) add*=	20;
		if (Game.Has('Nonillion fingers')) add*=	20;
		if (Game.Has('Decillion fingers')) add*=	20;
		if (Game.Has('Unshackled cursors')) add*=	25;
		
		var num=0;
		for (var i in Game.Objects) {num+=Game.Objects[i].amount;}
		num-=Game.Objects['Cursor'].amount;
		add=add*num;
		if (Game.Has('Plastic mouse')) add+=Game.cookiesPs*0.01;
		if (Game.Has('Iron mouse')) add+=Game.cookiesPs*0.01;
		if (Game.Has('Titanium mouse')) add+=Game.cookiesPs*0.01;
		if (Game.Has('Adamantium mouse')) add+=Game.cookiesPs*0.01;
		if (Game.Has('Unobtainium mouse')) add+=Game.cookiesPs*0.01;
		if (Game.Has('Eludium mouse')) add+=Game.cookiesPs*0.01;
		if (Game.Has('Wishalloy mouse')) add+=Game.cookiesPs*0.01;
		if (Game.Has('Fantasteel mouse')) add+=Game.cookiesPs*0.01;
		if (Game.Has('Nevercrack mouse')) add+=Game.cookiesPs*0.01;
		if (Game.Has('Armythril mouse')) add+=Game.cookiesPs*0.01;
		if (Game.Has('Technobsidian mouse')) add+=Game.cookiesPs*0.01;
		if (Game.Has('Plasmarble mouse')) add+=Game.cookiesPs*0.01;
		if (Game.Has('Miraculite mouse')) add+=Game.cookiesPs*0.01;
		if (Game.Has('Aetherice mouse')) add+=Game.cookiesPs*0.01;
		
		if (Game.Has('Fortune #104')) add+=Game.cookiesPs*0.01;
		if (Game.cookieUpgrades)
		{
			for (var iCookie in Game.cookieUpgrades)
			{
				var cookieUpgrade=Game.cookieUpgrades[iCookie];
				if (cookieUpgrade.clickPower && Game.Has(cookieUpgrade.name)) add+=Game.cookiesPs*cookieUpgrade.clickPower*0.01;
			}
		}
		if (Game.Has('Purrfect timing')) add+=Game.cookiesPs*0.01;
		var mult=1;
		
		
		if (Game.Has('Santa\'s helpers')) mult*=1.1;
		if (Game.Has('Cookie egg')) mult*=1.1;
		if (Game.Has('Halo gloves')) mult*=1.1;
		if (Game.Has('Dragon claw')) mult*=1.03;
		if (Game.Has('Firm handshake')) mult*=1.05;
		if (Game.Has('Demonic hustle')) mult*=1.05;
		
		if (Game.Has('Aura gloves'))
		{
			mult*=1+0.05*Math.min(Game.Objects['Cursor'].level,Game.Has('Luminous gloves')?20:10);
		}
		
		mult*=Game.eff('click');
		//CC3: Trigger finger completion reward — +2% cookie click power
		if (Game.Has('Scrolling adept')) mult*=1.02;
		
		if (Game.hasGod)
		{
			var godLvl=Game.hasGod('labor');
			if (godLvl==1) mult*=1.15;
			else if (godLvl==2) mult*=1.1;
			else if (godLvl==3) mult*=1.05;
		}
		
		for (var i in Game.buffs)
		{
			if (typeof Game.buffs[i].multClick != 'undefined') mult*=Game.buffs[i].multClick;
		}
		
		//if (Game.hasAura('Dragon Cursor')) mult*=1.05;
		mult*=1+Game.auraMult('Dragon Cursor')*0.05;
		
		var out=mult*Game.ComputeCps(1,Game.Has('Reinforced index finger')+Game.Has('Carpal tunnel prevention cream')+Game.Has('Ambidextrous'),add);
		
		out=Game.runModHookOnValue('cookiesPerClick',out);
		
		if (Game.hasBuff('Cursed finger')) out=Game.buffs['Cursed finger'].power;
		return out;
	}
export function playCookieClickSound()
	{
		if (Game.prefs.cookiesound) PlaySound('snd/clickb'+(Game.cookieClickSound)+'.mp3',0.5);
		else PlaySound('snd/click'+(Game.cookieClickSound)+'.mp3',0.5);
		Game.cookieClickSound+=Math.floor(Math.random()*4)+1;
		if (Game.cookieClickSound>7) Game.cookieClickSound-=7;
	}
export function ClickCookie(e?: Event | null,amount?: number)
	{
		var now=Date.now();
		if (e) e.preventDefault();
		if (Game.OnAscend || Game.AscendTimer>0 || Game.T<3 || now-Game.lastClick<1000/((e?(e as UIEvent).detail:1)===0?3:50)) {}
		else
		{
			if (now-Game.lastClick<(1000/15) && Game.ascensionMode!=2)//CC3: Trigger finger — scroll clicks don't count as autoclicker clicking achievements
			{
				Game.autoclickerDetected+=Game.fps;
				if (Game.autoclickerDetected>=Game.fps*5) Game.Win('Uncanny clicker');
			}
			Game.loseShimmeringVeil('click');
			var amt:number=amount?amount:Game.computedMouseCps;
			Game.Earn(amt);
			Game.handmadeCookies+=amt;
			if (Game.prefs.particles)
			{
				Game.particleAdd();
				Game.particleAdd(Game.mouseX,Game.mouseY,Math.random()*4-2,Math.random()*-2-2,Math.random()*0.5+0.75,1,2);
			}
			if (Game.prefs.numbers) Game.particleAdd(Game.mouseX+Math.random()*8-4,Game.mouseY-8-4,0,-2,1,4,2,'','+'+Beautify(amt,1));
			
			Game.runModHook('click');
			
			Game.playCookieClickSound();
			Game.cookieClicks++;
			
			if (Game.clicksThisSession==0) PlayCue('preplay');
			Game.clicksThisSession++;
			Game.lastClick=now;
		}
		Game.Click=0;
	}
export function GetMouseCoords(e?: MouseEvent | null)
	{
		var posx=0;
		var posy=0;
		//CC3: the legacy `window.event` fallback is a MouseEvent in the
		//mousemove handlers that call this; the cast keeps the verbatim
		//lazy-evaluation semantics of the original `if (!e) var e=window.event;`.
		if (e==null) e=window.event as unknown as MouseEvent;
		if (e==null) {posx=Game.mouseX;posy=Game.mouseY;} else {posx=e.clientX;posy=e.clientY;}
		Game.mouseX=posx;
		Game.mouseY=posy;
		Game.mouseX2=posx-Game.l!.getBoundingClientRect().left;
		Game.mouseY2=posy-Game.l!.getBoundingClientRect().top;
	}
