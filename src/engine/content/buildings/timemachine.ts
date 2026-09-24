/**
 * content/buildings/timemachine.ts — the Time machine building declaration.
 *
 * Split from content/buildings.ts (pure move — same new Game.Object call,
 * same order position, same closures; only the file changed).
 * Includes the shrunk-store-name display tweak.
 */
import type { Building, Game as EngineGame } from "../../types";
import { STACK_TARGET_H, stackDims, stackPosition } from "./stackDraw";

/** Declare the Time machine building on Game. */
export function declareTimeMachine(Game: EngineGame) {

		new Game.Object('Time machine','time machine|time machines|recovered|[X] century secured|[X] centuries secured','Brings cookies from the past, before they were even eaten.',12,8,{base:'timemachine',xV:32,yV:32,w:64,rows:1,x:0,y:0},123456789,function (me: Building) {
			var mult=1;
			mult*=Game.GetTieredCpsMult(me);
			mult*=Game.magicCpS(me.name);
			return me.baseCps*mult;
		},function (this: Building) {
			Game.UnlockTiered(this);
			if (this.amount>=Game.SpecialGrandmaUnlock && Game.Objects['Grandma'].amount>0 && this.grandma) Game.Unlock(this.grandma!.name);
			if (this.amount>=Game.SpecialCatUnlock && Game.Objects['Cats'].amount>0 && this.cat) Game.Unlock(this.cat!.name);
		});
		Game.last.displayName='<span style="font-size:80%;letter-spacing:-1px;position:relative;bottom:3px;">Time machine</span>';//shrink

		// CC3: staggered, overlapping vertical-stack layout with aspect-ratio horizontal background tiling.
		var tmObj=Game.Objects['Time machine'];
		tmObj.draw=function(this: Building)
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
			if (sheet.width !== this._stackSheetW || sheet.height !== this._stackSheetH) {
				this.pics = [];
				this._stackSheetW = sheet.width;
				this._stackSheetH = sheet.height;
			}
			var nativeW=sheet.width;
			var nativeH=sheet.height;
			var scale=Math.min(1,STACK_TARGET_H/nativeH);
			var drawW=nativeW*scale;
			var drawH=nativeH*scale;
			var canvasW=this.canvas.width;
			var canvasH=this.canvas.height;
			var dims=stackDims(canvasW,canvasH,drawW,drawH);
			var iT=Math.min(this.amount,dims.perRow*dims.numRows);

			var i=this.pics.length;
			if (i!==iT)
			{
				while (i<iT)
				{
					Math.seedrandom(Game.seed+' '+this.id+' '+i);
					var pos=stackPosition(i,canvasW,canvasH,drawW,drawH);
					this.pics.push({
						x:Math.floor(pos.x),y:Math.floor(pos.y),z:pos.z,
						pic:this.art.pic,id:i,
						drawW,drawH,born:Game.T
					});
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

			for (var k=0;k<this.pics.length;k++)
			{
				var pic:any=this.pics[k];
				var p=Pic(pic.pic);
				ctx.globalAlpha=Math.floor(pic.id/dims.perRow)>0?0.88:1;
				ctx.drawImage(p,
					Math.floor(pic.x),Math.floor(pic.y),
					Math.floor(pic.drawW),Math.floor(pic.drawH));
			}
			ctx.globalAlpha=1;
			return true;
		};
}
