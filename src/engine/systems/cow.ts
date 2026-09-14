/**
 * systems/cow.ts — the engine's cookie cow system (CC3 feature).
 *
 * A second companion pet mirroring the cookie dragon (systems/dragon.ts):
 * one cow that grows in size across 11 growth stages in exchange for
 * cookies (1M → 10 quadrillion, ×10 per stage). Unlike the dragon's
 * swappable auras, the cow has a single focused effect: it grows the milk
 * bonus — `CalculateGains` multiplies `milkMult` by `1+CowMilkBonus()`
 * (the `milkMult` block, systems/calculateGains.ts).
 *
 * The bonus table is flat +1% per growth stage for stages 1-10; the
 * terminal stage 11 (10 quadrillion) spikes to +3% that stage, for a
 * maximum of +13% (10 × 1% + 3%).
 *
 * The growth stages win one achievement each (declared in
 * content/achievements.ts, appended after the vanilla block so imported
 * saves keep their achievement ids); the terminal stage wins
 * 'Here be a moo', mirroring the dragon's 'Here be dragon'.
 *
 * No runtime imports: `Game`, `loc`, `LBeautify`, `PlaySound`, `l`,
 * `TopBarOffset` resolve through src/globals.d.ts (the same convention as
 * systems/dragon.ts — these are runtime globals, assigned on `Game` by the
 * engine at Init).
 */

/* Milk bonus at each cow level (level 0 = the cow, un-grown): flat +1%
 * per stage, terminal stage 11 does +3% instead of +1% (13% max). */
export const cowMilkBonus: number[]=[0, 0.01, 0.02, 0.03, 0.04, 0.05, 0.06, 0.07, 0.08, 0.09, 0.1, 0.13];

/* The 11 growth stages plus the terminal fully-grown state. Each stage's
 * buy() spends its cost and wins that stage's achievement (the terminal
 * stage's buy() wins 'Here be a moo'); UpgradeCow() advances the level
 * after a successful buy, exactly as UpgradeDragon does. */
export const cowLevels = [
	{name:'A certain cow',action:'Grow it',
		cost:function(){return Game.cookies>=1e6;},
		buy:function(){Game.Spend(1e6);Game.Win('First growth');},
		costStr:function(){return loc("%1 cookie",LBeautify(1e6));}},
	{name:'A growing cow',action:'Grow it',
		cost:function(){return Game.cookies>=1e7;},
		buy:function(){Game.Spend(1e7);Game.Win('Growing pains');},
		costStr:function(){return loc("%1 cookie",LBeautify(1e7));}},
	{name:'An adult cookie cow',action:'Grow it',
		cost:function(){return Game.cookies>=1e8;},
		buy:function(){Game.Spend(1e8);Game.Win('Big cow');},
		costStr:function(){return loc("%1 cookie",LBeautify(1e8));}},
	{name:'A milking cow',action:'Grow it',
		cost:function(){return Game.cookies>=1e9;},
		buy:function(){Game.Spend(1e9);Game.Win('Milk machine');},
		costStr:function(){return loc("%1 cookie",LBeautify(1e9));}},
	{name:'A large cookie cow',action:'Grow it',
		cost:function(){return Game.cookies>=1e10;},
		buy:function(){Game.Spend(1e10);Game.Win('Big leagues');},
		costStr:function(){return loc("%1 cookie",LBeautify(1e10));}},
	{name:'A huge cookie cow',action:'Grow it',
		cost:function(){return Game.cookies>=1e11;},
		buy:function(){Game.Spend(1e11);Game.Win('Bovine behemoth');},
		costStr:function(){return loc("%1 cookie",LBeautify(1e11));}},
	{name:'A giant cookie cow',action:'Grow it',
		cost:function(){return Game.cookies>=1e12;},
		buy:function(){Game.Spend(1e12);Game.Win('Dairy giant');},
		costStr:function(){return loc("%1 cookie",LBeautify(1e12));}},
	{name:'A colossal cookie cow',action:'Grow it',
		cost:function(){return Game.cookies>=1e13;},
		buy:function(){Game.Spend(1e13);Game.Win('Cow of a different scale');},
		costStr:function(){return loc("%1 cookie",LBeautify(1e13));}},
	{name:'A titanic cookie cow',action:'Grow it',
		cost:function(){return Game.cookies>=1e14;},
		buy:function(){Game.Spend(1e14);Game.Win('Bigger than the milk glass');},
		costStr:function(){return loc("%1 cookie",LBeautify(1e14));}},
	{name:'A mythic cookie cow',action:'Grow it',
		cost:function(){return Game.cookies>=1e15;},
		buy:function(){Game.Spend(1e15);Game.Win('Bovine apotheosis');},
		costStr:function(){return loc("%1 cookie",LBeautify(1e15));}},
	{name:'A fully grown cookie cow',action:'Grow it<br><small>The final growth</small>',
		cost:function(){return Game.cookies>=1e16;},
		buy:function(){Game.Spend(1e16);Game.Win('Here be a moo');},
		costStr:function(){return loc("%1 cookie",LBeautify(1e16));}},
	{name:'The grand cookie cow',action:'The cow is fully grown.'}
];

/** The cow's share of the milk bonus, as a multiplier (0 = nothing … 0.13 = fully grown).
 * Pure over Game.cowLevel and clamped, so a hand-edited or out-of-range
 * save level can never produce a bogus bonus. */
export function CowMilkBonus()
{
	var lvl=Math.floor(Game.cowLevel);
	if (isNaN(lvl) || lvl<0) lvl=0;
	if (lvl>cowMilkBonus.length-1) lvl=cowMilkBonus.length-1;
	return cowMilkBonus[lvl];
}

export function UpgradeCow()
{
	if (Game.cowLevel<Game.cowLevels.length-1 && Game.cowLevels[Game.cowLevel].cost())
	{
		PlaySound('snd/shimmerClick.mp3');
		Game.cowLevels[Game.cowLevel].buy();
		Game.cowLevel=(Game.cowLevel+1)%Game.cowLevels.length;
		
		Game.ToggleSpecialMenu(1);
		if (l('specialPic')){var rect=l('specialPic').getBounds();Game.SparkleAt((rect.left+rect.right)/2,(rect.top+rect.bottom)/2)+32-TopBarOffset;}
		Game.recalculateGains=1;
		Game.upgradesToRebuild=1;
	}
}
