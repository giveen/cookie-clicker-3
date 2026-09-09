/**
 * content/buildings/factory.ts — the Factory building declaration.
 *
 * Split from content/buildings.ts (pure move — same new Game.Object call,
 * same order position, same closures; only the file changed).
 */
import type { Building, Game as EngineGame } from "../../types";

/** Declare the Factory building on Game. */
export function declareFactory(Game: EngineGame) {

		new Game.Object('Factory','factory|factories|mass-produced|[X] additional patent|[X] additional patents','Produces large quantities of cookies.',5,4,{base:'factory',xV:8,yV:0,w:64,rows:1,x:0,y:-22},3000,function (me: Building) {
			var mult=1;
			mult*=Game.GetTieredCpsMult(me);
			mult*=Game.magicCpS(me.name);
			// Dungeon minigame rewards (REPEATABLE stacks bought with Relics, stored
			// in minigameDungeon.ts M.upgradeStacks). Additive upgrades add per-factory
			// CpS per stack (dungeonAdd); multiplicative upgrades apply their per-stack
			// multiplier (dungeonMult). effectiveStacks covers the
			// minigame-not-loaded-yet boot window (it falls back to the main-save
			// bought flag, which the first stack always sets), so the fallback below
			// only matters if the script never loaded.
			var dungeonMG=Game.Objects['Factory']&&Game.Objects['Factory'].minigame;
			var relicStacks=function (name: any){
				if (dungeonMG&&dungeonMG.effectiveStacks) return dungeonMG.effectiveStacks(name);
				return Game.Has(name)?1:0;
			};
			var dungeonAdd=0;
			var dungeonAddUpgrades=['Reinforced plating','Conveyor optimization','Quality assurance','Dungeon core reactor'];
			for (var da=0;da<dungeonAddUpgrades.length;da++)
			{
				var du=Game.Upgrades[dungeonAddUpgrades[da]];
				if (du && du.dungeonAdd)
				{
					var daCount=relicStacks(dungeonAddUpgrades[da]);
					if (daCount>0) dungeonAdd+=du.dungeonAdd*daCount;
				}
			}
			var dungeonMult=1;
			var dungeonMultUpgrades=['Assembly-line doctrine','Overtime shifts'];
			for (var dm=0;dm<dungeonMultUpgrades.length;dm++)
			{
				dungeonMult*=Math.pow(1.02,relicStacks(dungeonMultUpgrades[dm]));
			}
			// The Deep Delve heavenly branch (content/upgrades.ts): flat, stronger-than
			// cookie-tier CpS bonuses, kept as dedicated checks rather than folded
			// into dungeonMultUpgrades above since their heavenly-chip price buys a
			// much bigger jump (+5-20%) than that array's uniform +2% per entry.
			if (Game.Has('The deep delve')) mult*=1.05;
			if (Game.Has('Subterranean forge')) mult*=1.10;
			if (Game.Has('Eternal labyrinth')) mult*=1.15;
			if (Game.Has('Master of the maze')) mult*=1.20;
			return (me.baseCps+dungeonAdd)*mult*dungeonMult;
		},function (this: Building) {
			Game.UnlockTiered(this);
			if (this.amount>=Game.SpecialGrandmaUnlock && Game.Objects['Grandma'].amount>0 && this.grandma) Game.Unlock(this.grandma!.name);
			if (this.amount>=Game.SpecialCatUnlock && Game.Objects['Cats'].amount>0 && this.cat) Game.Unlock(this.cat!.name);
		});
		Game.last.minigameUrl='minigameDungeon.js';
		Game.last.minigameName=loc("Dungeon");
		
}
