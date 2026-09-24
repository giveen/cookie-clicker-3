/**
 * content/buildings/fractalengine.ts — the Fractal engine building declaration.
 *
 * Split from content/buildings.ts (pure move — same new Game.Object call,
 * same order position, same closures; only the file changed).
 * Includes the shrunk-store-name display tweak.
 */
import type { Building, Game as EngineGame } from "../../types";
import { STACK_TARGET_H, stackDims, stackPosition } from "./stackDraw";

/** Declare the Fractal engine building on Game. */
export function declareFractalEngine(Game: EngineGame) {

		new Game.Object('Fractal engine','fractal engine|fractal engines|made from cookies|[X] iteration deep|[X] iterations deep','Turns cookies into even more cookies.',16,20,{base:'fractalEngine',xV:8,yV:64,w:64,rows:1,x:0,y:0},12345678987654321,function (me: Building) {
			var mult=1;
			mult*=Game.GetTieredCpsMult(me);
			mult*=Game.magicCpS(me.name);
			return me.baseCps*mult;
		},function (this: Building) {
			Game.UnlockTiered(this);
			if (this.amount>=Game.SpecialGrandmaUnlock && Game.Objects['Grandma'].amount>0 && this.grandma) Game.Unlock(this.grandma!.name);
		});
		Game.last.displayName='<span style="font-size:80%;letter-spacing:-1px;position:relative;bottom:4px;">Fractal engine</span>';//shrink

		// CC3: same staggered, overlapping vertical-stack treatment as other remastered buildings,
		// on the shared STACK layout. Back rows are shaded for atmospheric depth.
		var feObj=Game.Objects['Fractal engine'];
		var feCellW=64;
		var feCellH=80;
		var feSheetCols=3;
		var feSheetRows=2;
		feObj.draw=function(this: Building)
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
			// Rebuild pics if the sheet size changed since they were built
			if (sheet.width!==this._stackSheetW||sheet.height!==this._stackSheetH) {this.pics=[];this._stackSheetW=sheet.width;this._stackSheetH=sheet.height;}
			var cellSrcW=sheet.naturalWidth?Math.round(sheet.naturalWidth/feSheetCols):feCellW;
			var cellSrcH=sheet.naturalHeight?Math.round(sheet.naturalHeight/feSheetRows):feCellH;
			var scale=Math.min(1,STACK_TARGET_H/feCellH);
			var drawW=feCellW*scale;
			var drawH=feCellH*scale;
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
					var sx=(i%feSheetCols)*cellSrcW;
					var sy=(Math.floor(i/feSheetCols)%feSheetRows)*cellSrcH;
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
