/**
 * content/cats.ts: the CC3 cat content, carved out of
 * content/upgrades.ts with the declarations unchanged. Three exports,
 * each called from declareVanillaUpgrades at the exact Init position
 * the code used to occupy inline there:
 *
 *  - defineCatSynergies: the cats-synergy pool factory
 *    (Game.CatSynergies + Game.CatSynergy, a mirror of
 *    Game.GrandmaSynergy centered on Cats). Registers no upgrades
 *    itself; the 8 Game.CatSynergy(...) calls in
 *    declareCatStoreUpgrades do.
 *  - declareCatStoreUpgrades: the 24-upgrade Cat collection (14 base
 *    + 10 specialty), the 8 cat-synergy registrations, and the 6
 *    Cat Colony minigame rewards.
 *  - declareCatHeavenlyUpgrades: the 10-upgrade "Nine Lives"
 *    heavenly branch (Game.last.pool='prestige').
 *
 * Nothing was rewritten: the registration sequence (and therefore the
 * save-stable upgrade ids: ids are the registration index and saves
 * store purchases by id) is unchanged, and the order/pool/power
 * assignments flow through the window bridge into the engine's
 * module-scope vars exactly as they did inline.
 * tests/upgrades-fingerprint.spec.js pins the resulting
 * Game.UpgradesById (order + identity of every registration) against a
 * committed baseline.
 *
 * No runtime imports: Game, loc, LBeautify, cap and the order/pool/
 * power bridge vars resolve through src/globals.d.ts (same as
 * content/upgrades.ts).
 */
import type { Game as EngineGame } from '../types';

/** The cats-synergy pool factory (Game.CatSynergies + Game.CatSynergy).
 * Called from declareVanillaUpgrades right after the grandma
 * synergies. Registers no upgrades itself. */
export function defineCatSynergies(Game: EngineGame) {
		// CC3: the cats-synergy pool — a mirror of Game.GrandmaSynergy centered
		// on Cats. Owning a cat synergy makes Cats twice as efficient and gives
		// the tied building +1% CpS per (id-1) cats (see GetTieredCpsMult).
		Game.CatSynergies=[];
		Game.CatSynergy=function(name: any,desc: any,building: any)
		{
			var building: any=Game.Objects[building];
			// Math.max(1,...): 'Kitten grandmas' ties this to Grandma, whose
			// building id is 1, so the naive (id-1) divisor used by every other
			// cat/grandma synergy would be 0 here — this is the one tied
			// building where that self-reference actually happens.
			var catNumber=loc("%1 cat",LBeautify(Math.max(1,building.id-1)));
			desc=loc("%1 are <b>twice</b> as efficient.",cap(Game.Objects['Cats'].plural))+' '+loc("%1 gain <b>+%2%</b> CpS per %3.",[cap(building.plural),1,catNumber])+'<q>'+desc+'</q>';
			
			var upgrade=new Game.Upgrade(name,desc,building.basePrice*Game.Tiers[2].price,[10,9],function(){Game.Objects['Cats'].redraw();});
			building.cat=upgrade;
			upgrade.buildingTie=building;
			Game.CatSynergies.push(upgrade.name);
			return upgrade;
		}
}

/** The 24-upgrade Cat collection (14 base + 10 specialty), the 8
 * cat-synergy registrations, and the 6 Cat Colony minigame rewards.
 * Called from declareVanillaUpgrades after the new-cookie styles
 * block. */
export function declareCatStoreUpgrades(Game: EngineGame) {
		// CC3 Cat upgrade collection: 24 custom Cat-specific upgrades.
		// These do NOT use Game.TieredUpgrade (which doubles building CpS
		// per tier and would make Cats overpowered at their cheap price).
		// Instead each upgrade adds a small additive bonus to Cat CpS,
		// keeping Cats balanced between Grandma and Farm throughout.
		var catUpgradeIcon=function(index: number): any
		{
			return [index%6,Math.floor(index/6),'img/cat-upgrades/protein_spritesheet.png',48];
		};

		// 14 base upgrades: flat additive Cat CpS bonuses.
		// Total effect of all 14: +3 CpS per Cat (4 base -> 7), keeping
		// the early Cat curve below Farm while still rewarding the full line.
		// Unlock thresholds mirror the standard tier amounts: 1/5/25/50/100/150/200/250/300/350/400/450/500/550.
		var catBaseUpgrades=[
			{name:'Cardboard box basics',price:1000,effect:0.2},
			{name:'Sunbeam training',price:2500,effect:0.2},
			{name:'Whisker refinement',price:5000,effect:0.2},
			{name:'Midnight zoomies',price:10000,effect:0.2},
			{name:'Tuna-grade nutrition',price:25000,effect:0.2},
			{name:'Claw-powered kneading',price:50000,effect:0.2},
			{name:'Purrfect production',price:100000,effect:0.2},
			{name:'Nine-lives efficiency',price:250000,effect:0.2},
			{name:'Feline assembly',price:500000,effect:0.2},
			{name:'Astral catnaps',price:1000000,effect:0.2},
			{name:'Infinite yarn loop',price:2500000,effect:0.3},
			{name:'Quantum litter boxes',price:5000000,effect:0.3},
			{name:'Cosmic whisker arrays',price:10000000,effect:0.3},
			{name:'Protein singularity',price:25000000,effect:0.1}
		];
		order=350;
		for (var catBaseIndex=0;catBaseIndex<catBaseUpgrades.length;catBaseIndex++)
		{
			var catBase=catBaseUpgrades[catBaseIndex];
			var catBaseUpgrade=new Game.Upgrade(catBase.name,'Cats gain <b>+'+catBase.effect+' CpS each</b>.'+'<q>Every cat business starts somewhere.</q>',catBase.price,catUpgradeIcon(catBaseIndex));
			catBaseUpgrade.catAdd=catBase.effect;
			// Register as a Cat building tier so it appears greyed out in the store.
			catBaseUpgrade.buildingTie=Game.Objects['Cats'];
			var catTier='cat'+(catBaseIndex+1);
			catBaseUpgrade.tier=catTier;
			Game.Objects['Cats'].tieredUpgrades[catTier]=catBaseUpgrade;
		}

		// 10 specialty upgrades: mild multiplicative and synergy effects.
		// Unlocked by Cat count; effects are intentionally small.
		var catSpecialUpgrades=[
			{name:'Grandma-approved recipes',desc:'Cats gain <b>+0.5% CpS per Grandma</b>, up to +25%.',price:25000,unlock:10},
			{name:'Purrfect timing',desc:'Clicking gains <b>+1% of your CpS</b>.',price:100000,unlock:25},
			{name:'Cat café loyalty',desc:'Cookie production multiplier <b>+1%</b>.',price:100000,unlock:50},
			{name:'Protein-rich kibble',desc:'Cats gain <b>+2% CpS</b>.',price:50000,unlock:75},
			{name:'Feather wand drills',desc:'Cats gain <b>+2% CpS</b>.',price:100000,unlock:100},
			{name:'Sunbeam perches',desc:'Cats gain <b>+2% CpS</b>.',price:250000,unlock:150},
			{name:'Catnip cultivation',desc:'Cats gain <b>+2% CpS</b>.',price:500000,unlock:200},
			{name:'Scratching-post ovens',desc:'Cats gain <b>+2% CpS</b>.',price:1000000,unlock:250},
			{name:'Climbing shelves',desc:'Cats gain <b>+2% CpS</b>.',price:2000000,unlock:350},
			{name:'Nine lives logistics',desc:'Cats gain <b>+2% CpS</b>.',price:5000000,unlock:450}
		];
		for (var catSpecialIndex=0;catSpecialIndex<catSpecialUpgrades.length;catSpecialIndex++)
		{
			var catSpecial=catSpecialUpgrades[catSpecialIndex];
			var catSpecialUpgrade=new Game.Upgrade(catSpecial.name,catSpecial.desc+'<q>More cats, more cookies, fewer explanations.</q>',catSpecial.price,catUpgradeIcon(14+catSpecialIndex));
			catSpecialUpgrade.catUnlock=catSpecial.unlock;
			// Register as a Cat building tier so it appears greyed out in the store.
			catSpecialUpgrade.buildingTie=Game.Objects['Cats'];
			var catSpecTier='catS'+(catSpecialIndex+1);
			catSpecialUpgrade.tier=catSpecTier;
			Game.Objects['Cats'].tieredUpgrades[catSpecTier]=catSpecialUpgrade;
		}

		// CC3: register the 8 cat-synergy upgrades. They are declared at the
		// very end of the upgrade list on purpose: upgrade ids are the
		// registration index and saves store purchased upgrades by id, so
		// inserting them mid-list would shift every later id and break
		// existing saves. (The Game.CatSynergy factory above only defines
		// them; the store display order (order=300, right after the
		// grandma synergies) is independent of registration order.)
		order=300;
		Game.CatSynergy('Kitten grandmas','A nice cat to help the grandmas. It\'s all in the family.','Grandma');
		Game.CatSynergy('Farm cats','A nice cat to keep the mice away from the cookie plants. Mice are a real pest.','Farm');
		Game.CatSynergy('Miner cats','Mine safety officer. The mice appreciate it, even if they can\'t say so.','Mine');
		Game.CatSynergy('Worker cats','Assembly-line cat. Nine lives, one job, zero complaints.','Factory');
		Game.CatSynergy('Space cats','Zero gravity is the perfect nap environment. They\'ve never been cozier.','Shipment');
		Game.CatSynergy('Golden cats','Transmuted from silver. They hiss a little more now, but they pay rent in gold.','Alchemy lab');
		Game.CatSynergy('Altered cats','It went through the portal. It came back a little different. Mostly naps.','Portal');
		Game.CatSynergy('Time cats','Always napping exactly one second into the past, so the cookies are warm when they wake.','Time machine');

		// CC3 Cat Colony minigame rewards: REPEATABLE upgrades bought with
		// Treats from inside the minigame panel (stacks in
		// minigameCatColony.ts M.upgradeStacks; the main-save bought flag is
		// only set on the first stack, via Game.Upgrades[name].earn(), for
		// save continuity), never through the cookie store — the cookie price
		// here is unused (these are never unlocked via
		// Game.Unlock/UnlockTiered, so the store never offers them) and kept
		// at 0 for clarity. Icons crop frame 0 of the existing cat sprite
		// strips (img/cats/*.png) via the standard [col,row,path,size] icon
		// form — no new art. treatsPrice is a minigame-only field the shop
		// panel reads; the flat price never changes, every stack costs the
		// same and adds the full per-stack effect, so the six rows are the
		// colony's endless treat sink.
		var catColonyUpgrades=[
			{name:'Cardboard fort training',desc:'Cats gain <b>+0.15 CpS each</b> (per stack).',treats:15,catAdd:0.15,icon:'idle'},
			{name:'Sunbeam napping technique',desc:'Cats gain <b>+0.15 CpS each</b> (per stack).',treats:35,catAdd:0.15,icon:'walk'},
			{name:'Treat-sniffing whiskers',desc:'Cats gain <b>+2% CpS</b> (per stack).',treats:70,icon:'run'},
			{name:'Nine-lives insurance',desc:'Per stack: Cats gain <b>+0.2 CpS each</b>,<br>and colony expeditions are 30% less likely to send a cat home hurt.',treats:150,catAdd:0.2,icon:'jump'},
			{name:'Golden collar bells',desc:'Cats gain <b>+2% CpS</b> (per stack).',treats:300,icon:'running-jump'},
			{name:'Legendary colony charter',desc:'Cats gain <b>+0.5 CpS each</b> (per stack).',treats:600,catAdd:0.5,icon:'attack-1'}
		];
		order=356;
		for (var catColonyIndex=0;catColonyIndex<catColonyUpgrades.length;catColonyIndex++)
		{
			var catColony=catColonyUpgrades[catColonyIndex];
			var catColonyUpgrade=new Game.Upgrade(catColony.name,catColony.desc+'<q>Bought with treats earned by the colony, not with cookies.</q>',0,[0,0,'img/cats/'+catColony.icon+'.png',64]);
			if (catColony.catAdd) catColonyUpgrade.catAdd=catColony.catAdd;
			catColonyUpgrade.treatsPrice=catColony.treats;
			catColonyUpgrade.buildingTie=Game.Objects['Cats'];
		}
}

/** The "Nine Lives" heavenly cat branch (10 upgrades,
 * Game.last.pool='prestige'). Called from declareVanillaUpgrades after
 * the Astral Reliquary branch. */
export function declareCatHeavenlyUpgrades(Game: EngineGame) {
		// Nine Lives: a themed heavenly sub-branch off 'Five-finger discount',
		// focused entirely on the Cats building (content/buildings/cats.ts),
		// the cat-synergy bonus (systems/economy.ts's GetTieredCpsMult), and the
		// Cat Colony minigame (minigameCatColony.ts). Declared here at the very
		// end of upgrades.ts, same reasoning as the Astral Reliquary branch
		// above: inserting earlier would shift every subsequent vanilla
		// upgrade's id and corrupt existing save files. Positions are derived
		// automatically from the parents DAG, so no manual coordinates are set.
		// Icons reuse frame [0,0] of existing Cats sprite sheets (img/cats/*.png at
		// 64px cells) rather than any icons.webp cell, the same technique the
		// Cat Colony minigame's own reward upgrades already use — no new art.
		new Game.Upgrade('Communion of whiskers',"Cats gain <b>+10% CpS</b>."+'<q>Somewhere, a cat is purring in exactly your rhythm.</q>',700000,[0,0,'img/cats/idle.png',64]);Game.last.pool='prestige';Game.last.parents=['Five-finger discount'];
		new Game.Upgrade('Nine lives, one purpose',"Cats gain <b>+10% CpS</b>."+'<q>All nine, pointed the same way: toward the food bowl.</q>',2000000,[0,0,'img/cats/walk.png',64]);Game.last.pool='prestige';Game.last.parents=['Communion of whiskers'];
		new Game.Upgrade('Feline apex',"Cats gain <b>+15% CpS</b>."+'<q>The apex predator of your living room, and possibly your economy.</q>',6000000,[0,0,'img/cats/run.png',64]);Game.last.pool='prestige';Game.last.parents=['Nine lives, one purpose'];

		new Game.Upgrade('Territorial pact',"Cat synergies grant their tied building an additional <b>+1% CpS per cat</b>, on top of the usual bonus."+'<q>Cats don\'t share territory. They annex it, generously, on your behalf.</q>',1800000,[0,0,'img/cats/jump.png',64]);Game.last.pool='prestige';Game.last.parents=['Communion of whiskers'];
		new Game.Upgrade('Alpha instincts',"Cats gain <b>+5% CpS</b> for every cat synergy upgrade owned."+'<q>Every colony needs a cat who\'s just a little more in charge.</q>',5000000,[0,0,'img/cats/running-jump.png',64]);Game.last.pool='prestige';Game.last.parents=['Territorial pact'];

		new Game.Upgrade('Nap discipline',"Cat Colony expeditions are <b>20% less likely</b> to send a cat home hurt."+'<q>A well-rested cat is a cat that comes home in one piece.</q>',1500000,[0,0,'img/cats/sleep.png',64]);Game.last.pool='prestige';Game.last.parents=['Communion of whiskers'];
		new Game.Upgrade('Generous strangers',"Cat Colony expeditions yield <b>20% more treats</b>."+'<q>Turns out most of the neighborhood was willing to be robbed, gently.</q>',4000000,[0,0,'img/cats/attack-1.png',64]);Game.last.pool='prestige';Game.last.parents=['Nap discipline'];
		new Game.Upgrade('Bottomless treat jar',"The Cat Colony slowly generates <b>1 treat per minute</b>, even with no expeditions underway."+'<q>Some jars refill themselves. Nobody asks questions.</q>',6000000,[0,0,'img/cats/hurt.png',64]);Game.last.pool='prestige';Game.last.parents=['Generous strangers'];
		new Game.Upgrade('Efficient patrols',"Cat Colony expeditions take <b>15% less time</b>."+'<q>They\'ve stopped stopping to sniff every third leaf.</q>',9000000,[0,0,'img/cats/idle.png',64]);Game.last.pool='prestige';Game.last.parents=['Bottomless treat jar'];

		new Game.Upgrade('The Nine Lives Convergence',"Cats gain <b>+20% CpS</b>."+'<q>Nine lives, one destiny: your cookie jar.</q>',25000000,[0,0,'img/cats/attack-1.png',64]);Game.last.pool='prestige';Game.last.parents=['Feline apex','Alpha instincts','Efficient patrols'];
}
