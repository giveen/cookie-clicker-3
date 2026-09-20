/**
 * content/buildings/factory.ts — the Factory building declaration.
 *
 * Split from content/buildings.ts (pure move — same new Game.Object call,
 * same order position, same closures; only the file changed).
 */
import type { Building, Game as EngineGame } from "../../types";
import { STACK_TARGET_H, stackDims, stackPosition } from "./stackDraw";

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

		// CC3: same staggered, overlapping vertical-stack treatment as Farms and Mines,
		// on the shared STACK layout. Back rows are shaded for atmospheric depth.
		var factoryObj=Game.Objects['Factory'];
		var factoryCellW=64;
		var factoryCellH=80;
		var factorySheetCols=3;
		var factorySheetRows=2;
		factoryObj.draw=function(this: Building)
		{
			if (this.amount<=0||!this.canvas||!this.ctx) return false;
			if (this.toResize || this.canvas.width === 0)
			{
				if (this.canvas.clientWidth > 0)
				{
					this.canvas.width=this.canvas.clientWidth;
					this.canvas.height=this.canvas.clientHeight;
					this.pics=[];//canvas re-sized: recompute centred positions next
					this.toResize=false;
				}
			}
			var ctx=this.ctx;
			ctx.globalAlpha=1;
			var bg=Pic(this.art.bg);
			if (bg && bg.complete && bg.naturalWidth>0)
			{
				ctx.imageSmoothingEnabled=true;
				var bgW=Math.max(1,Math.ceil(this.canvas.height*bg.naturalWidth/bg.naturalHeight));
				for (var bgX=0;bgX<this.canvas.width;bgX+=bgW)
				{
					ctx.drawImage(bg,0,0,bg.naturalWidth,bg.naturalHeight,bgX,0,bgW,this.canvas.height);
				}
			}
			else if (typeof(this.art.bg)=='string')
			{
				ctx.fillPattern(Pic(this.art.bg),0,0,this.canvas.width,this.canvas.height,128,128);
			}
			var sheet=Pic(this.art.pic);
			// Pic() returns the loader's 8x8 placeholder until the sheet loads.
			// Do not crop that placeholder with factory-sized source rectangles:
			// some browsers throw IndexSizeError and abort all later building draws.
			if (sheet===Game.Loader.blank) return true;
			// Rebuild pics if the sheet size changed since they were built
			if (sheet.width!==this._stackSheetW||sheet.height!==this._stackSheetH) {this.pics=[];this._stackSheetW=sheet.width;this._stackSheetH=sheet.height;}
			var cellSrcW=sheet.naturalWidth?Math.round(sheet.naturalWidth/factorySheetCols):factoryCellW;
			var cellSrcH=sheet.naturalHeight?Math.round(sheet.naturalHeight/factorySheetRows):factoryCellH;
			var scale=Math.min(1,STACK_TARGET_H/factoryCellH);
			var drawW=factoryCellW*scale;
			var drawH=factoryCellH*scale;
			var canvasW=this.canvas.width;
			var canvasH=this.canvas.height;
			var dims=stackDims(canvasW,canvasH,drawW,drawH);
			var iT=Math.min(this.amount,dims.perRow*dims.numRows);
			var i=this.pics.length;
			if (i!=iT)
			{
				while (i<iT)
				{
					Math.seedrandom(Game.seed+' '+this.id+' '+i);
					var pos=stackPosition(i,canvasW,canvasH,drawW,drawH);
					var sx=(i%factorySheetCols)*cellSrcW;
					var sy=(Math.floor(i/factorySheetCols)%factorySheetRows)*cellSrcH;
					this.pics.push({x:Math.floor(pos.x),y:Math.floor(pos.y),z:pos.z,pic:this.art.pic,id:i,frame:0,flip:Math.random()<0.5,sx:sx,sy:sy,srcW:cellSrcW,srcH:cellSrcH,drawW:drawW,drawH:drawH,born:Game.T});
					i++;
				}
				while (i>iT)
				{
					this.pics.sort(Game.sortSpritesById);
					this.pics.pop();
					i--;
				}
				this.pics.sort(Game.sortSprites);
			}
			ctx.imageSmoothingEnabled=true;
			for (var i=0;i<this.pics.length;i++)
			{
				var pic:any=this.pics[i];
				// Back rows sit in atmospheric shade; front row is fully lit
				ctx.globalAlpha=Math.floor(pic.id/dims.perRow)>0?0.88:1;
				if (pic.flip)
				{
					ctx.save();
					ctx.translate(pic.x+pic.drawW,pic.y);
					ctx.scale(-1,1);
					ctx.drawImage(sheet,pic.sx,pic.sy,pic.srcW||cellSrcW,pic.srcH||cellSrcH,0,0,pic.drawW,pic.drawH);
					ctx.restore();
				}
				else
				{
					ctx.drawImage(sheet,pic.sx,pic.sy,pic.srcW||cellSrcW,pic.srcH||cellSrcH,pic.x,pic.y,pic.drawW,pic.drawH);
				}
			}
			ctx.globalAlpha=1;
			return true;
		};
}
