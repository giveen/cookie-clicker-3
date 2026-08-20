// @ts-nocheck — legacy 2.048 port, kept verbatim for the 1:1 TS conversion; type-checking intentionally disabled here.
/* CC3 rewrite: typed content layer, extracted from this file incrementally. */
import { TIERS } from './content/tiers';
import { declareVanillaBuildings } from './content/buildings';
import { declareVanillaUpgrades } from './content/upgrades';
import { declareVanillaAchievements } from './content/achievements';
import { declareVanillaFoolObjects } from "./content/foolObjects";
/* CC3 rewrite (phase 3): the Game singleton is now a real class instance from the typed core layer. */
import { Game } from "./core/game";
import { Building } from "./core/building";
/* CC3: the original relied on implicit globals; declare them for module strict mode. */
var Audio, localStorageGet, localStorageSet, Music, PlayCue, TopBarOffset, LASTHEAVENLYSELECTED, ON, OFF;
/* CC3 rewrite (slice 3): the vanilla-content order/pool/power bookkeeping.
 * Originally Init-scoped closure vars read by the Game.Upgrade /
 * Game.Achievement ctors and mutated by the upgrade declarations; the
 * declarations now run in content/upgrades.ts, so this state lives at
 * module scope and is bridged to the content module through window
 * accessors (bottom of this file, next to the window shim). */
var order, pool, power;

/*
All this code is copyright Orteil, 2013-2022.
	-with some help, advice and fixes by Nicholas Laux, Debugbro, Opti, the folks at Playsaurus, and lots of people on reddit, Discord, and the DashNet forums
	-also includes a bunch of snippets found on stackoverflow.com and others
	-want to mod the game? scroll down to the "MODDING API" section
Hello, and welcome to the joyous mess that is main.js. Code contained herein is not guaranteed to be good, consistent, or sane. Most of this is years old at this point and harkens back to simpler, cruder times. In particular I've tried to maintain compatibility with fairly old versions of javascript, which means luxuries such as 'let', arrow functions and string literals are unavailable.
As Cookie Clicker is rife with puns and tricky wordplay, localization was never intended to be possible - but ended up happening anyway as part of the Steam port. As a result, usage of strings is somewhat unorthodox in some places.
Have a nice trip, and stay safe.
Spoilers ahead.
http://orteil.dashnet.org
*/

/*=====================================================================================
MISC HELPER FUNCTIONS
=======================================================================================*/
function l(what) {return document.getElementById(what);}
function choose(arr) {return arr[Math.floor(Math.random()*arr.length)];}

function escapeRegExp(str){return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");}
function replaceAll(find,replace,str){return str.replace(new RegExp(escapeRegExp(find),'g'),replace);}

function cap(str){return str.charAt(0).toUpperCase()+str.slice(1);}

function romanize(num){
    if (isNaN(num))
        return NaN;
    var digits = String(+num).split(""),
        key = ["","C","CC","CCC","CD","D","DC","DCC","DCCC","CM",
               "","X","XX","XXX","XL","L","LX","LXX","LXXX","XC",
               "","I","II","III","IV","V","VI","VII","VIII","IX"],
        roman = "",
        i = 3;
    while (i--)
        roman = (key[+digits.pop() + (i * 10)] || "") + roman;
    return Array(+digits.join("") + 1).join("M") + roman;
}

//disable sounds coming from soundjay.com (sorry)
var realAudio=typeof Audio!=='undefined'?Audio:function(){return {}};//backup real audio
Audio=function(src){
	if (src && src.indexOf('soundjay')>-1) {Game.Popup('Sorry, no sounds hotlinked from soundjay.com.');this.play=function(){};}
	else return new realAudio(src);
};

if(!Array.prototype.indexOf) {
    Array.prototype.indexOf = function(needle) {
        for(var i = 0; i < this.length; i++) {
            if(this[i] === needle) {return i;}
        }
        return -1;
    };
}

function randomFloor(x) {if ((x%1)<Math.random()) return Math.floor(x); else return Math.ceil(x);}

function shuffle(array)
{
	var counter = array.length, temp, index;
	// While there are elements in the array
	while (counter--)
	{
		// Pick a random index
		index = (Math.random() * counter) | 0;

		// And swap the last element with it
		temp = array[counter];
		array[counter] = array[index];
		array[index] = temp;
	}
	return array;
}

Element.prototype.getBounds=function(){
	// CC3: getBoundingClientRect() returns an immutable DOMRect in
	// modern browsers; compute scaled values in a fresh plain object.
	var r=this.getBoundingClientRect();
	var s=Game.scale;
	return {x:r.x/s,y:r.y/s,width:r.width/s,height:r.height/s,top:r.top/s,bottom:r.bottom/s,left:r.left/s,right:r.right/s};
};

var LoadScript=function(url,callback,error)
{
	var js=document.createElement('script');
	js.setAttribute('type','text/javascript');
	if (js.readyState){
		js.onreadystatechange=function()
		{
			if (js.readyState==="loaded" || js.readyState==="complete")
			{
				js.onreadystatechange=null;
				if (callback) callback();
			}
		};
	}
	else if (callback)
	{
		js.onload=callback;
	}
	if (error) js.onerror=error;
	
	js.setAttribute('src',url);
	document.head.appendChild(js);
}


localStorageGet=function(key)
{
	var local=0;
	try {local=window.localStorage.getItem(key);} catch (exception) {}
	return local;
}
localStorageSet=function(key,str)
{
	var local=0;
	try {local=window.localStorage.setItem(key,str);} catch (exception) {}
	return local;
}


var ajax=function(url,callback)
{
	var httpRequest=new XMLHttpRequest();
	if (!httpRequest){return false;}
	httpRequest.onreadystatechange=function()
	{
		try{
			if (httpRequest.readyState===XMLHttpRequest.DONE && httpRequest.status===200)
			{
				callback(httpRequest.responseText);
			}
		}catch(e){}
	}
	//httpRequest.onerror=function(e){console.log('ERROR',e);}
	if (url.indexOf('?')==-1) url+='?'; else url+='&';
	url+='nocache='+Date.now();
	httpRequest.open('GET',url);
	httpRequest.setRequestHeader('Content-Type','text/plain');
	httpRequest.overrideMimeType('text/plain');
	httpRequest.send();
	return true;
}

function toFixed(x)
{
	if (Math.abs(x) < 1.0) {
		var e = parseInt(x.toString().split('e-')[1]);
		if (e) {
			x *= Math.pow(10,e-1);
			x = '0.' + (new Array(e)).join('0') + x.toString().substring(2);
		}
	} else {
		var e = parseInt(x.toString().split('+')[1]);
		if (e > 20) {
			e -= 20;
			x /= Math.pow(10,e);
			x += (new Array(e+1)).join('0');
		}
	}
	return x;
}

//Beautify and number-formatting adapted from the Frozen Cookies add-on (http://cookieclicker.wikia.com/wiki/Frozen_Cookies_%28JavaScript_Add-on%29)
function formatEveryThirdPower(notations)
{
	return function (val)
	{
		var base=0,notationValue='';
		if (!isFinite(val)) return 'Infinity';
		if (val>=1000000)
		{
			val/=1000;
			while(Math.round(val)>=1000)
			{
				val/=1000;
				base++;
			}
			if (base>=notations.length) {return 'Infinity';} else {notationValue=notations[base];}
		}
		return (Math.round(val*1000)/1000)+notationValue;
	};
}

function rawFormatter(val){return Math.round(val*1000)/1000;}

var formatLong=[' thousand',' million',' billion',' trillion',' quadrillion',' quintillion',' sextillion',' septillion',' octillion',' nonillion'];
var prefixes=['','un','duo','tre','quattuor','quin','sex','septen','octo','novem'];
var suffixes=['decillion','vigintillion','trigintillion','quadragintillion','quinquagintillion','sexagintillion','septuagintillion','octogintillion','nonagintillion'];
for (var i in suffixes)
{
	for (var ii in prefixes)
	{
		formatLong.push(' '+prefixes[ii]+suffixes[i]);
	}
}

var formatShort=['k','M','B','T','Qa','Qi','Sx','Sp','Oc','No'];
var prefixes=['','Un','Do','Tr','Qa','Qi','Sx','Sp','Oc','No'];
var suffixes=['D','V','T','Qa','Qi','Sx','Sp','O','N'];
for (var i in suffixes)
{
	for (var ii in prefixes)
	{
		formatShort.push(' '+prefixes[ii]+suffixes[i]);
	}
}
formatShort[10]='Dc';


var numberFormatters=
[
	formatEveryThirdPower(formatShort),
	formatEveryThirdPower(formatLong),
	rawFormatter
];
var Beautify=function(val,floats)
{
	var negative=(val<0);
	var decimal='';
	var fixed=val.toFixed(floats);
	if (floats>0 && Math.abs(val)<1000 && Math.floor(fixed)!=fixed) decimal='.'+(fixed.toString()).split('.')[1];
	val=Math.floor(Math.abs(val));
	if (floats>0 && fixed==val+1) val++;
	//var format=!EN?2:Game.prefs.format?2:1;
	var format=Game.prefs.format?2:1;
	var formatter=numberFormatters[format];
	var output=(val.toString().indexOf('e+')!=-1 && format==2)?val.toPrecision(3).toString():formatter(val).toString().replace(/\B(?=(\d{3})+(?!\d))/g,',');
	//var output=formatter(val).toString().replace(/\B(?=(\d{3})+(?!\d))/g,',');
	if (output=='0') negative=false;
	return negative?'-'+output:output+decimal;
}
var shortenNumber=function(val)
{
	//if no scientific notation, return as is, else :
	//keep only the 5 first digits (plus dot), round the rest
	//may or may not work properly
	if (val>=1000000 && isFinite(val))
	{
		var num=val.toString();
		var ind=num.indexOf('e+');
		if (ind==-1) return val;
		var str='';
		for (var i=0;i<ind;i++) {str+=(i<6?num[i]:'0');}
		str+='e+';
		str+=num.split('e+')[1];
		return parseFloat(str);
	}
	return val;
}

var SimpleBeautify=function(val)
{
	var str=val.toString();
	var str2='';
	for (var i in str)//add commas
	{
		if ((str.length-i)%3==0 && i>0) str2+=',';
		str2+=str[i];
	}
	return str2;
}

var beautifyInTextFilter=/(([\d]+[,]*)+)/g;//new regex
function BeautifyInTextFunction(str){return Beautify(parseInt(str.replace(/,/g,''),10));};
function BeautifyInText(str) {return str.replace(beautifyInTextFilter,BeautifyInTextFunction);}//reformat every number inside a string
function BeautifyAll()//run through upgrades and achievements to reformat the numbers
{
	var func=function(what){what.ddesc=BeautifyInText(what.ddesc);}
	for (var i in Game.UpgradesById){Game.UpgradesById[i].ddesc=BeautifyInText(Game.UpgradesById[i].ddesc);}
	for (var i in Game.AchievementsById){Game.AchievementsById[i].ddesc=BeautifyInText(Game.AchievementsById[i].ddesc);}
}


//=== LOCALIZATION ===

var locStrings={};
var locStringsFallback={};
var locId='NONE';
var EN=true;
var locName='none';
var locPatches=[];
var locPlur='nplurals=2;plural=(n!=1);';//see http://docs.translatehouse.org/projects/localization-guide/en/latest/l10n/pluralforms.html
var locPlurFallback=locPlur;
//note : plural index will be downgraded to the last matching, ie. in this case, if we get "0" but don't have a 3rd option, use the 2nd option (or 1st, lacking that too)
var locStringsByPart={};
var FindLocStringByPart=function(match)
{
	return locStringsByPart[match]||undefined;
	/*
	//note: slow, only do this on init
	for (var i in locStrings){
		var bit=i.split(']');
		if (bit[0].substring(1)==match) return i;
	}
	return undefined;
	*/
}

var Langs={
	'EN':{file:'EN',nameEN:'English',name:'English',changeLanguage:'Language',icon:0,w:1,isEN:true},
	'FR':{file:'FR',nameEN:'French',name:'Fran&ccedil;ais',changeLanguage:'Langue',icon:0,w:1},
	'DE':{file:'DE',nameEN:'German',name:'Deutsch',changeLanguage:'Sprache',icon:0,w:1},
	'NL':{file:'NL',nameEN:'Dutch',name:'Nederlands',changeLanguage:'Taal',icon:0,w:1},
	'CS':{file:'CS',nameEN:'Czech',name:'&#x10C;e&#x161;tina',changeLanguage:'Jazyk',icon:0,w:1},
	'PL':{file:'PL',nameEN:'Polish',name:'Polski',changeLanguage:'J&#281;zyk',icon:0,w:1},
	'IT':{file:'IT',nameEN:'Italian',name:'Italiano',changeLanguage:'Lingua',icon:0,w:1},
	'ES':{file:'ES',nameEN:'Spanish',name:'Espa&#xF1;ol',changeLanguage:'Idioma',icon:0,w:1},
	'PT-BR':{file:'PT-BR',nameEN:'Portuguese',name:'Portugu&#xEA;s',changeLanguage:'Idioma',icon:0,w:1},
	'JA':{file:'JA',nameEN:'Japanese',name:'&#x65E5;&#x672C;&#x8A9E;',changeLanguage:'&#35328;&#35486;',icon:0,w:1.5},
	'ZH-CN':{file:'ZH-CN',nameEN:'Chinese',name:'&#x4E2D;&#x6587;',changeLanguage:'&#35821;&#35328;',icon:0,w:1.5},
	'KO':{file:'KO',nameEN:'Korean',name:'&#xD55C;&#xAE00;',changeLanguage:'&#xC5B8;&#xC5B4;',icon:0,w:1.5},
	'RU':{file:'RU',nameEN:'Russian',name:'&#x420;&#x443;&#x441;&#x441;&#x43A;&#x438;&#x439;',changeLanguage:'&#1071;&#1079;&#1099;&#1082;',icon:0,w:1.2},
};

//note : baseline should be the original english text
//in several instances, the english text will be quite different from the other languages, as this game was initially never meant to be translated and the translation process doesn't always play well with complex sentence structures
/*use:
	loc('Plain text')
	loc('Text where %1 is a parameter','something')
	loc('Text where %1 and %2 are parameters',['a thing','another thing'])
	loc('There is %1 apple',5)
		 ...if the localized string is an array, this is parsed as a pluralized string; for instance, the localized string could be
		"There is %1 apple":[
			"There is %1 apple",
			"There are %1 apples"
		]
	loc('There is %1 apple and also, %2!',[5,'hello'])
	loc('This string is localized.',0,'This is the string displayed in the english version.')
	loc('You have %1.','<b>'+loc('%1 apple',LBeautify(amount))+'</b>')
		...you may nest localized strings, and use LBeautify() to pack Beautified values
*/
var locBlink=false;
var localizationNotFound=[];
var loc=function(id,params,baseline)
{
	var fallback=false;
	var found=locStrings[id];
	if (!found) {found=locStringsFallback[id];fallback=true;}
	if (found)
	{
		var str='';
		str=parseLoc(found,params);
		//return str;
		if (str.constructor===Array) return str;
		if (locBlink && !fallback) return '<span class="blinking">'+str+'</span>';//will make every localized text blink on screen, making omissions obvious; will not work for elements filled with textContent
	}
	
	//if ((fallback || !found) && localizationNotFound.length<20 && localizationNotFound.indexOf(id)==-1){localizationNotFound.push(id);console.trace('localization string not found: ',id);}
	if (found) return str;
	return baseline||id;
}

var parseLoc=function(str,params)
{
	/*
		parses localization strings
		-there can only be 1 plural per string and it MUST be at index %1
		-a pluralized string is detected if we have at least 1 param and the matching localized string is an array
	*/
	if (typeof params==='undefined') params=[];
	else if (params.constructor!==Array) params=[params];
	if (!str) return '';
	//if (str.constructor===Array) return str;
	//if (typeof str==='function') return str(params);
	//str=str.replace(/[\t\n\r]/gm,'');
	
	if (params.length==0) return str;
	
	if (str.constructor===Array)
	{
		if (typeof params[0]==='object')//an object containing a beautified number
		{
			var plurIndex=locPlur(params[0].n);
			plurIndex=Math.min(str.length-1,plurIndex);
			str=str[plurIndex];
			str=replaceAll('%1',params[0].b,str);
		}
		else
		{
			var plurIndex=locPlur(params[0]);
			plurIndex=Math.min(str.length-1,plurIndex);
			str=str[plurIndex];
			str=replaceAll('%1',params[0],str);
		}
	}
	
	var out='';
	var len=str.length;
	var inPercent=false;
	for (var i=0;i<len;i++)
	{
		var it=str[i];
		if (inPercent)
		{
			inPercent=false;
			if (!isNaN(it) && params.length>=parseInt(it)-1) out+=params[parseInt(it)-1];
			else out+='%'+it;
		}
		else if (it=='%') inPercent=true;
		else out+=it;
	}
	return out;
}

var LBeautify=function(val,floats)
{
	//returns an object in the form {n:original value floored,b:beautified value as string} for localization purposes
	return {n:Math.floor(Math.abs(val)),b:Beautify(val,floats)};
}

var ModLanguage=function(id,json){
	if (id=='*') id=locId;
	if (id!=locId || !Langs[id]) return false;
	if (json['REPLACE ALL'])
	{
		var rep=function(str,from,to)
		{
			var regex=new RegExp(from,'ig');
			return str.replace(regex,function(match){
				return (match[0]==match[0].toLowerCase())?to:cap(to);
			});
		}
		for (var i in json['REPLACE ALL'])
		{
			var to=json['REPLACE ALL'][i];
			for (var ii in locStrings)
			{
				if (Array.isArray(locStrings[ii]))
				{
					for (var iii in locStrings[ii])
					{
						locStrings[ii][iii]=rep(locStrings[ii][iii],i,to);
					}
				}
				else locStrings[ii]=rep(locStrings[ii],i,to);
			}
		}
	}
	delete json['REPLACE ALL'];
	AddLanguage(id,Langs[id].name,json,true);
}

var AddLanguage=function(id,name,json,mod)
{
	//used in loc files
	//if mod is true, this file is augmenting the current language
	if (id==locId && !mod) return false;//don't load twice
	if (!Langs[id]) return false;
	locId=id;
	if (Langs[locId].isEN) EN=true; else EN=false;
	locName=Langs[id].nameEN;//name
	
	if (mod)
	{
		for (var i in json)
		{
			locStrings[i]=json[i];
		}
		for (var i in locStrings)
		{
			var bit=i.split(']');
			if (bit[1] && bit[0].indexOf('[COMMENT:')!=0 && !locStringsByPart[bit[0].substring(1)]) locStringsByPart[bit[0].substring(1)]=i;
		}
		console.log('Augmented language "'+locName+'".');
	}
	else
	{
		locStrings=json;
		locPlur=json['']['plural-forms']||locPlurFallback;
		delete locStrings[''];
		for (var i in locStrings)
		{
			if (locStrings[i]=='/') locStrings[i]=i;
		}
		
		locPlur=(function(plural_form){
			//lifted and modified from gettext.js
			var pf_re=new RegExp('^\\s*nplurals\\s*=\\s*[0-9]+\\s*;\\s*plural\\s*=\\s*(?:\\s|[-\\?\\|&=!<>+*/%:;n0-9_\(\)])+');
			if (!pf_re.test(plural_form))
			throw new Error('The plural form "'+plural_form+'" is not valid');
			return new Function('n','var plural, nplurals; '+ plural_form +' return plural;');
			//return new Function('n','var plural, nplurals; '+ plural_form +' return { nplurals: nplurals, plural: (plural === true ? 1 : (plural ? plural : 0)) };');
		})(locPlur);
		
		locPatches=[];
		for (var i in locStrings){
			if (i.split('|')[0]=='Update notes')
			{
				var patch=i.split('|');
				var patchTranslated=locStrings[i].split('|');
				locPatches.push({id:parseInt(patch[1]),type:1,title:patchTranslated[2],points:patchTranslated.slice(3)})
			}
		}
		var sortMap=function(a,b)
		{
			if (a.id<b.id) return 1;
			else return -1;
		}
		locPatches.sort(sortMap);
		
		for (var i in locStrings)
		{
			var bit=i.split(']');
			if (bit[1] && bit[0].indexOf('[COMMENT:')!=0 && !locStringsByPart[bit[0].substring(1)]) locStringsByPart[bit[0].substring(1)]=i;
		}
		
		console.log('Loaded language "'+locName+'".');
	}
}

var LoadLang=LoadScript;

var LocalizeUpgradesAndAchievs=function()
{
	if (!Game.UpgradesById) return false;
	
	var allThings=[];
	for (var i in Game.UpgradesById){allThings.push(Game.UpgradesById[i]);}
	for (var i in Game.AchievementsById){allThings.push(Game.AchievementsById[i]);}
	for (var i=0;i<allThings.length;i++)
	{
		var it=allThings[i];
		var type=it.getType();
		var found=0;
		found=FindLocStringByPart(type+' name '+it.id);
		if (found) it.dname=loc(found);
		
		if (!EN) it.baseDesc=it.baseDesc.replace(/<q>.*/,'');//strip quote section
		it.ddesc=BeautifyInText(it.baseDesc);
		
		found=FindLocStringByPart(type+' desc '+it.id);
		if (found) it.ddesc=loc(found);
		found=FindLocStringByPart(type+' quote '+it.id);
		if (found) it.ddesc+='<q>'+loc(found)+'</q>';
	}
	BeautifyAll();
}
var getUpgradeName=function(name)
{
	var it=Game.Upgrades[name];
	var found=FindLocStringByPart('Upgrade name '+it.id);
	if (found) return loc(found); else return name;
}
var getAchievementName=function(name)
{
	var it=Game.Achievements[name];
	var found=FindLocStringByPart('Achievement name '+it.id);
	if (found) return loc(found); else return name;
}



//these are faulty, investigate later
//function utf8_to_b64(str){return btoa(str);}
//function b64_to_utf8(str){return atob(str);}

/*function utf8_to_b64( str ) {
	try{return Base64.encode(unescape(encodeURIComponent( str )));}
	catch(err)
	{return '';}
}

function b64_to_utf8( str ) {
	try{return decodeURIComponent(escape(Base64.decode( str )));}
	catch(err)
	{return '';}
}*/

//phewie! https://stackoverflow.com/questions/30106476/using-javascripts-atob-to-decode-base64-doesnt-properly-decode-utf-8-strings
function utf8_to_b64(str) {
	try{return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, function(match, p1) {
		return String.fromCharCode(parseInt(p1, 16))
	}));}
	catch(err)
	{return '';}
}

function b64_to_utf8(str) {
	try{return decodeURIComponent(Array.prototype.map.call(atob(str), function(c) {
		return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
	}).join(''));}
	catch(err)
	{return '';}
}

function CompressBin(arr)//compress a sequence like [0,1,1,0,1,0]... into a number like 54.
{
	var str='';
	var arr2=arr.slice(0);
	arr2.unshift(1);
	arr2.push(1);
	arr2.reverse();
	for (var i in arr2)
	{
		str+=arr2[i];
	}
	str=parseInt(str,2);
	return str;
}

function UncompressBin(num)//uncompress a number like 54 to a sequence like [0,1,1,0,1,0].
{
	var arr=num.toString(2);
	arr=arr.split('');
	arr.reverse();
	arr.shift();
	arr.pop();
	return arr;
}

function CompressLargeBin(arr)//we have to compress in smaller chunks to avoid getting into scientific notation
{
	var arr2=arr.slice(0);
	var thisBit=[];
	var bits=[];
	for (var i in arr2)
	{
		thisBit.push(arr2[i]);
		if (thisBit.length>=50)
		{
			bits.push(CompressBin(thisBit));
			thisBit=[];
		}
	}
	if (thisBit.length>0) bits.push(CompressBin(thisBit));
	arr2=bits.join(';');
	return arr2;
}

function UncompressLargeBin(arr)
{
	var arr2=arr.split(';');
	var bits=[];
	for (var i in arr2)
	{
		bits.push(UncompressBin(parseInt(arr2[i])));
	}
	arr2=[];
	for (var i in bits)
	{
		for (var ii in bits[i]) arr2.push(bits[i][ii]);
	}
	return arr2;
}


function pack(bytes) {
    var chars = [];
	var len=bytes.length;
    for(var i = 0, n = len; i < n;) {
        chars.push(((bytes[i++] & 0xff) << 8) | (bytes[i++] & 0xff));
    }
    return String.fromCharCode.apply(null, chars);
}

function unpack(str) {
    var bytes = [];
	var len=str.length;
    for(var i = 0, n = len; i < n; i++) {
        var char = str.charCodeAt(i);
        bytes.push(char >>> 8, char & 0xFF);
    }
    return bytes;
}

//modified from http://www.smashingmagazine.com/2011/10/19/optimizing-long-lists-of-yesno-values-with-javascript/
function pack2(/* string */ values) {
    var chunks = values.match(/.{1,14}/g), packed = '';
    for (var i=0; i < chunks.length; i++) {
        packed += String.fromCharCode(parseInt('1'+chunks[i], 2));
    }
    return packed;
}

function unpack2(/* string */ packed) {
    var values = '';
    for (var i=0; i < packed.length; i++) {
        values += packed.charCodeAt(i).toString(2).substring(1);
    }
    return values;
}

function pack3(values){
	//too many save corruptions, darn it to heck
	return values;
}


//file save function from https://github.com/eligrey/FileSaver.js
var saveAs=saveAs||function(view){"use strict";if(typeof navigator!=="undefined"&&/MSIE [1-9]\./.test(navigator.userAgent)){return}var doc=view.document,get_URL=function(){return view.URL||view.webkitURL||view},save_link=doc.createElementNS("http://www.w3.org/1999/xhtml","a"),can_use_save_link="download"in save_link,click=function(node){var event=new MouseEvent("click");node.dispatchEvent(event)},is_safari=/Version\/[\d\.]+.*Safari/.test(navigator.userAgent),webkit_req_fs=view.webkitRequestFileSystem,req_fs=view.requestFileSystem||webkit_req_fs||view.mozRequestFileSystem,throw_outside=function(ex){(view.setImmediate||view.setTimeout)(function(){throw ex},0)},force_saveable_type="application/octet-stream",fs_min_size=0,arbitrary_revoke_timeout=500,revoke=function(file){var revoker=function(){if(typeof file==="string"){get_URL().revokeObjectURL(file)}else{file.remove()}};if(view.chrome){revoker()}else{setTimeout(revoker,arbitrary_revoke_timeout)}},dispatch=function(filesaver,event_types,event){event_types=[].concat(event_types);var i=event_types.length;while(i--){var listener=filesaver["on"+event_types[i]];if(typeof listener==="function"){try{listener.call(filesaver,event||filesaver)}catch(ex){throw_outside(ex)}}}},auto_bom=function(blob){if(/^\s*(?:text\/\S*|application\/xml|\S*\/\S*\+xml)\s*;.*charset\s*=\s*utf-8/i.test(blob.type)){return new Blob(["\ufeff",blob],{type:blob.type})}return blob},FileSaver=function(blob,name,no_auto_bom){if(!no_auto_bom){blob=auto_bom(blob)}var filesaver=this,type=blob.type,blob_changed=false,object_url,target_view,dispatch_all=function(){dispatch(filesaver,"writestart progress write writeend".split(" "))},fs_error=function(){if(target_view&&is_safari&&typeof FileReader!=="undefined"){var reader=new FileReader;reader.onloadend=function(){var base64Data=reader.result;target_view.location.href="data:attachment/file"+base64Data.slice(base64Data.search(/[,;]/));filesaver.readyState=filesaver.DONE;dispatch_all()};reader.readAsDataURL(blob);filesaver.readyState=filesaver.INIT;return}if(blob_changed||!object_url){object_url=get_URL().createObjectURL(blob)}if(target_view){target_view.location.href=object_url}else{var new_tab=view.open(object_url,"_blank");if(new_tab==undefined&&is_safari){view.location.href=object_url}}filesaver.readyState=filesaver.DONE;dispatch_all();revoke(object_url)},abortable=function(func){return function(){if(filesaver.readyState!==filesaver.DONE){return func.apply(this,arguments)}}},create_if_not_found={create:true,exclusive:false},slice;filesaver.readyState=filesaver.INIT;if(!name){name="download"}if(can_use_save_link){object_url=get_URL().createObjectURL(blob);setTimeout(function(){save_link.href=object_url;save_link.download=name;click(save_link);dispatch_all();revoke(object_url);filesaver.readyState=filesaver.DONE});return}if(view.chrome&&type&&type!==force_saveable_type){slice=blob.slice||blob.webkitSlice;blob=slice.call(blob,0,blob.size,force_saveable_type);blob_changed=true}if(webkit_req_fs&&name!=="download"){name+=".download"}if(type===force_saveable_type||webkit_req_fs){target_view=view}if(!req_fs){fs_error();return}fs_min_size+=blob.size;req_fs(view.TEMPORARY,fs_min_size,abortable(function(fs){fs.root.getDirectory("saved",create_if_not_found,abortable(function(dir){var save=function(){dir.getFile(name,create_if_not_found,abortable(function(file){file.createWriter(abortable(function(writer){writer.onwriteend=function(event){target_view.location.href=file.toURL();filesaver.readyState=filesaver.DONE;dispatch(filesaver,"writeend",event);revoke(file)};writer.onerror=function(){var error=writer.error;if(error.code!==error.ABORT_ERR){fs_error()}};"writestart progress write abort".split(" ").forEach(function(event){writer["on"+event]=filesaver["on"+event]});writer.write(blob);filesaver.abort=function(){writer.abort();filesaver.readyState=filesaver.DONE};filesaver.readyState=filesaver.WRITING}),fs_error)}),fs_error)};dir.getFile(name,{create:false},abortable(function(file){file.remove();save()}),abortable(function(ex){if(ex.code===ex.NOT_FOUND_ERR){save()}else{fs_error()}}))}),fs_error)}),fs_error)},FS_proto=FileSaver.prototype,saveAs=function(blob,name,no_auto_bom){return new FileSaver(blob,name,no_auto_bom)};if(typeof navigator!=="undefined"&&navigator.msSaveOrOpenBlob){return function(blob,name,no_auto_bom){if(!no_auto_bom){blob=auto_bom(blob)}return navigator.msSaveOrOpenBlob(blob,name||"download")}}FS_proto.abort=function(){var filesaver=this;filesaver.readyState=filesaver.DONE;dispatch(filesaver,"abort")};FS_proto.readyState=FS_proto.INIT=0;FS_proto.WRITING=1;FS_proto.DONE=2;FS_proto.error=FS_proto.onwritestart=FS_proto.onprogress=FS_proto.onwrite=FS_proto.onabort=FS_proto.onerror=FS_proto.onwriteend=null;return saveAs}(typeof self!=="undefined"&&self||typeof window!=="undefined"&&window||this.content);if(typeof module!=="undefined"&&module.exports){module.exports.saveAs=saveAs}else if(typeof define!=="undefined"&&define!==null&&define.amd!=null){define([],function(){return saveAs})}


//seeded random function, courtesy of http://davidbau.com/archives/2010/01/30/random_seeds_coded_hints_and_quintillions.html
(function(a,b,c,d,e,f){function k(a){var b,c=a.length,e=this,f=0,g=e.i=e.j=0,h=e.S=[];for(c||(a=[c++]);d>f;)h[f]=f++;for(f=0;d>f;f++)h[f]=h[g=j&g+a[f%c]+(b=h[f])],h[g]=b;(e.g=function(a){for(var b,c=0,f=e.i,g=e.j,h=e.S;a--;)b=h[f=j&f+1],c=c*d+h[j&(h[f]=h[g=j&g+b])+(h[g]=b)];return e.i=f,e.j=g,c})(d)}function l(a,b){var e,c=[],d=(typeof a)[0];if(b&&"o"==d)for(e in a)try{c.push(l(a[e],b-1))}catch(f){}return c.length?c:"s"==d?a:a+"\0"}function m(a,b){for(var d,c=a+"",e=0;c.length>e;)b[j&e]=j&(d^=19*b[j&e])+c.charCodeAt(e++);return o(b)}function n(c){try{return a.crypto.getRandomValues(c=new Uint8Array(d)),o(c)}catch(e){return[+new Date,a,a.navigator.plugins,a.screen,o(b)]}}function o(a){return String.fromCharCode.apply(0,a)}var g=c.pow(d,e),h=c.pow(2,f),i=2*h,j=d-1;c.seedrandom=function(a,f){var j=[],p=m(l(f?[a,o(b)]:0 in arguments?a:n(),3),j),q=new k(j);return m(o(q.S),b),c.random=function(){for(var a=q.g(e),b=g,c=0;h>a;)a=(a+c)*d,b*=d,c=q.g(1);for(;a>=i;)a/=2,b/=2,c>>>=1;return(a+c)/b},p},m(c.random(),b)})(window,[],Math,256,6,52);

function bind(scope,fn)
{
	//use : bind(this,function(){this.x++;}) - returns a function where "this" refers to the scoped this
	return function() {fn.apply(scope,arguments);};
}

var grabProps=function(arr,prop)
{
	if (!arr) return [];
	var arr2=[];
	for (var i=0;i<arr.length;i++)
	{
		arr2.push(arr[i][prop]);
	}
	return arr2;
}

CanvasRenderingContext2D.prototype.fillPattern=function(img,X,Y,W,H,iW,iH,offX,offY)
{
	//for when built-in patterns aren't enough
	if (img.alt!='blank')
	{
		var offX=offX||0;
		var offY=offY||0;
		if (offX<0) {offX=offX-Math.floor(offX/iW)*iW;} if (offX>0) {offX=(offX%iW)-iW;}
		if (offY<0) {offY=offY-Math.floor(offY/iH)*iH;} if (offY>0) {offY=(offY%iH)-iH;}
		for (var y=offY;y<H;y+=iH){for (var x=offX;x<W;x+=iW){this.drawImage(img,X+x,Y+y,iW,iH);}}
	}
}

var OldCanvasDrawImage=CanvasRenderingContext2D.prototype.drawImage;
CanvasRenderingContext2D.prototype.drawImage=function()
{
	//only draw the image if it's loaded
	if (arguments[0].alt!='blank') OldCanvasDrawImage.apply(this,arguments);
}


if (!document.hasFocus) document.hasFocus=function(){return document.hidden;};//for Opera

function AddEvent(el,ev,func)
{
	//ie. myListener=AddEvent(l('element'),'click',function(){console.log('hi!');});
	if (el.addEventListener) {el.addEventListener(ev,func,false);return [el,ev,func];}
	else if (el.attachEvent) {var func2=function(){func.call(el);};el.attachEvent('on'+ev,func2);return [el,ev,func2];}
	return false;
}
function RemoveEvent(evObj)
{
	//ie. RemoveEvent(myListener);
	if (!evObj) return false;
	if (evObj[0].removeEventListener) evObj[0].removeEventListener(evObj[1],evObj[2],false);
	else if (evObj[0].detachEvent) evObj[0].detachEvent('on'+evObj[1],evObj[2]);
	return true;
}

function FireEvent(el,ev)
{
	if (el.fireEvent)
	{el.fireEvent('on'+ev);}
	else
	{
		var evObj=document.createEvent('Events');
		evObj.initEvent(ev,true,false);
		el.dispatchEvent(evObj);
	}
}


function writeIcon(icon)
{
	//returns CSS for an icon's background image
	//for use in CSS strings
	return (icon[2]?'background-image:url(\''+icon[2].replace(/'/g,"\\'")+'\');':'')+'background-position:'+(-icon[0]*48)+'px '+(-icon[1]*48)+'px;';
}
function tinyIcon(icon,css)
{
	//returns HTML displaying an icon, with optional extra CSS
	return '<div class="icon tinyIcon" style="vertical-align:middle;display:inline-block;'+writeIcon(icon)+'transform:scale(0.5);margin:-16px;'+(css?css:'')+'"></div>';
}

var Loader=function()//asset-loading system
{
	this.loadingN=0;
	this.assetsN=0;
	this.assets=[];
	this.assetsLoading=[];
	this.assetsLoaded=[];
	this.domain='';
	this.loaded=0;//callback
	this.doneLoading=0;
	
	this.blank=document.createElement('canvas');
	this.blank.width=8;
	this.blank.height=8;
	this.blank.alt='blank';
	
	this.Load=function(assets)
	{
		for (var i in assets)
		{
			this.loadingN++;
			this.assetsN++;
			if (!this.assetsLoading[assets[i]] && !this.assetsLoaded[assets[i]])
			{
				var img=new Image();
				if (assets[i].indexOf('/')!=-1) img.src=assets[i];
				else img.src=this.domain+assets[i];
				img.alt=assets[i];
				img.onload=bind(this,this.onLoad);
				this.assets[assets[i]]=img;
				this.assetsLoading.push(assets[i]);
			}
		}
	}
	this.Replace=function(old,newer)
	{
		if (!this.assets[old]) this.Load([old]);
		var img=new Image();
		if (newer.indexOf('/')!=-1)/*newer.indexOf('http')!=-1 || newer.indexOf('https')!=-1)*/ img.src=newer;
		else img.src=this.domain+newer;
		img.alt=newer;
		img.onload=bind(this,this.onLoad);
		this.assets[old]=img;
	}
	this.onLoadReplace=function()
	{
	}
	this.onLoad=function(e)
	{
		this.assetsLoaded.push(e.target.alt);
		this.assetsLoading.splice(this.assetsLoading.indexOf(e.target.alt),1);
		this.loadingN--;
		if (this.doneLoading==0 && this.loadingN<=0 && this.loaded!=0)
		{
			this.doneLoading=1;
			this.loaded();
		}
	}
	this.getProgress=function()
	{
		return (1-this.loadingN/this.assetsN);
	}
}

var Pic=function(what)
{
	if (Game.Loader.assetsLoaded.indexOf(what)!=-1) return Game.Loader.assets[what];
	else if (Game.Loader.assetsLoading.indexOf(what)==-1) Game.Loader.Load([what]);
	return Game.Loader.blank;
}

var Sounds=[];
var OldPlaySound=function(url,vol)
{
	var volume=1;
	if (vol!==undefined) volume=vol;
	if (!Game.volume || volume==0) return 0;
	if (!Sounds[url]) {Sounds[url]=new Audio(url);Sounds[url].onloadeddata=function(e){e.target.volume=Math.pow(volume*Game.volume/100,2);}}
	else if (Sounds[url].readyState>=2) {Sounds[url].currentTime=0;Sounds[url].volume=Math.pow(volume*Game.volume/100,2);}
	Sounds[url].play();
}
var SoundInsts=[];
var SoundI=0;
for (var i=0;i<12;i++){SoundInsts[i]=new Audio();}
var pitchSupport=false;
//note : Chrome turns out to not support webkitPreservesPitch despite the specifications claiming otherwise, and Firefox clips some short sounds when changing playbackRate, so i'm turning the feature off completely until browsers get it together
//if (SoundInsts[0].preservesPitch || SoundInsts[0].mozPreservesPitch || SoundInsts[0].webkitPreservesPitch) pitchSupport=true;

var PlaySound=function(url,vol,pitchVar)
{
	//url : the url of the sound to play (will be cached so it only loads once)
	//vol : volume between 0 and 1 (multiplied by game volume setting); defaults to 1 (full volume)
	//(DISABLED) pitchVar : pitch variance in browsers that support it (Firefox only at the moment); defaults to 0.05 (which means pitch can be up to -5% or +5% anytime the sound plays)
	var volume=1;
	var volumeSetting=Game.volume;
	if (typeof vol!=='undefined') volume=vol;
	if (volume<-5) {volume+=10;volumeSetting=Game.volumeMusic;}
	if (!volumeSetting || volume==0) return 0;
	if (typeof Sounds[url]==='undefined')
	{
		//sound isn't loaded, cache it
		Sounds[url]=new Audio(url);
		Sounds[url].onloadeddata=function(e){PlaySound(url,vol,pitchVar);}
		//Sounds[url].load();
	}
	else if (Sounds[url].readyState>=2 && SoundInsts[SoundI].paused)
	{
		var sound=SoundInsts[SoundI];
		SoundI++;
		if (SoundI>=12) SoundI=0;
		sound.src=Sounds[url].src;
		//sound.currentTime=0;
		sound.volume=Math.pow(volume*volumeSetting/100,2);
		if (pitchSupport)
		{
			var pitchVar=(typeof pitchVar==='undefined')?0.05:pitchVar;
			var rate=1+(Math.random()*2-1)*pitchVar;
			sound.preservesPitch=false;
			sound.mozPreservesPitch=false;
			sound.webkitPreservesPitch=false;
			sound.playbackRate=rate;
		}
		try{sound.play();}catch(e){}
		/*
		var sound=Sounds[url].cloneNode();
		sound.volume=Math.pow(volume*volumeSetting/100,2);
		sound.onended=function(e){if (e.target){delete e.target;}};
		sound.play();*/
	}
}
var PlayMusicSound=function(url,vol,pitchVar)
{
	//like PlaySound but, if music is enabled, play with music volume
	PlaySound(url,(vol||1)-(Music?10:0),pitchVar);
}

Music=false;
PlayCue=function(cue,arg)
{
	if (Music && Game.jukebox.trackAuto) Music.cue(cue,arg);
}

if (!Date.now){Date.now=function now() {return new Date().getTime();};}

var triggerAnim=function(element,anim)
{
	if (!element) return;
	element.classList.remove(anim);
	void element.offsetWidth;
	element.classList.add(anim);
};

var debugStr='';
var Debug=function(what)
{
	if (!debugStr) debugStr=what;
	else debugStr+='; '+what;
}

var Timer={};
Timer.t=Date.now();
Timer.labels=[];
Timer.smoothed=[];
Timer.reset=function()
{
	Timer.labels=[];
	Timer.t=Date.now();
}
Timer.track=function(label)
{
	if (!Game.sesame) return;
	var now=Date.now();
	if (!Timer.smoothed[label]) Timer.smoothed[label]=0;
	Timer.smoothed[label]+=((now-Timer.t)-Timer.smoothed[label])*0.1;
	Timer.labels[label]='<div style="padding-left:8px;">'+label+' : '+Math.round(Timer.smoothed[label])+'ms</div>';
	Timer.t=now;
}
Timer.clean=function()
{
	if (!Game.sesame) return;
	var now=Date.now();
	Timer.t=now;
}
Timer.say=function(label)
{
	if (!Game.sesame) return;
	Timer.labels[label]='<div style="border-top:1px solid #ccc;">'+label+'</div>';
}; // CC3 rewrite (phase 3, slice 1): explicit semicolon. The original code had no semicolon here and relied on ASI: the next line was 'var Game={}' (now an import from core/game.ts), a statement starter that forced the break. Without it, the MODDING IIFE below parses as a chained call on this function expression and crashes the engine at boot.


/*=====================================================================================
GAME INITIALIZATION
=======================================================================================*/
/* CC3 rewrite (phase 3, slice 1): the original `var Game={}` now lives in the typed core layer (core/game.ts) as a real class instance; the engine imports and mutates that one object, exactly as before. */

(function(){
	/*=====================================================================================
	MODDING API
	=======================================================================================*/
	/*
		to use:
		-(NOTE: this functions a little differently in the standalone/Steam version; have a look in the game's /mods folder for example mods - though most of the information below still applies)
		-have your mod call Game.registerMod("unique id",mod object)
		-the "unique id" value is a string the mod will use to index and retrieve its save data; special characters are ignored
		-the "mod object" value is an object structured like so:
			{
				init:function(){
					//this function is called as soon as the mod is registered
					//declare hooks here
				},
				save:function(){
					//use this to store persistent data associated with your mod
					return 'a string to be saved';
				},
				load:function(str){
					//do stuff with the string data you saved previously
				},
			}
		-the mod object may also contain any other data or functions you want, for instance to make them accessible to other mods
		-your mod and its data can be accessed with Game.mods['mod id']
		-hooks are functions the game calls automatically in certain circumstances, like when calculating cookies per click or when redrawing the screen
		-to add a hook: Game.registerHook('hook id',yourFunctionHere) - note: you can also declare whole arrays of hooks, ie. Game.registerHook('hook id',[function1,function2,...])
		-to remove a hook: Game.removeHook('hook id',theSameFunctionHere)
		-some hooks are fed a parameter you can use in the function
		-list of valid hook ids:
			'logic' - called every logic tick
			'draw' - called every draw tick
			'reset' - called whenever the player resets; parameter is true if this is a hard reset, false if it's an ascension
			'reincarnate' - called when the player has reincarnated after an ascension
			'ticker' - called when determining news ticker text; should return an array of possible choices to add
			'cps' - called when determining the CpS; parameter is the current CpS; should return the modified CpS
			'cookiesPerClick' - called when determining the cookies per click; parameter is the current value; should return the modified value
			'click' - called when the big cookie is clicked
			'create' - called after the game declares all buildings, buffs, upgrades and achievs; use this to declare your own - note that while the game distinguishes between vanilla and non-vanilla content, saving/loading functionality for custom content (including stuff like active buffs or permanent upgrade slotting) is not explicitly implemented and may be unpredictable and broken
			'check' - called every few seconds when we check for upgrade/achiev unlock conditions; you can also use this for other checks that you don't need happening every logic frame
		-function hooks are provided for convenience and more advanced mod functionality will probably involve manual code injection
		-please be mindful of the length of the data you save, as it does inflate the export-save-to-string feature
		
		NOTE: modding API is susceptible to change and may not always function super-well
	*/
	Game.mods={};
	Game.sortedMods=[];
	Game.brokenMods=[];
	Game.modSaveData={};
	Game.modHooks={};
	Game.modHooksNames=['logic','draw','reset','reincarnate','ticker','cps','cookiesPerClick','click','create','check'];
	for (var i=0;i<Game.modHooksNames.length;i++){Game.modHooks[Game.modHooksNames[i]]=[];}
	Game.registerMod=function(id,mod)
	{
		id=id.replace(/\W+/g,' ');
		if (id=='META') return false;
		if (Game.mods[id]) {console.log('ERROR: mod already registered with the id "'+id+'".');return false;}
		Game.mods[id]=mod;
		Game.sortedMods.push(mod);
		mod.id=id;
		mod.name=mod.name||id;
		if (App) App.registerMod(mod);
		console.log('Mod "'+id+'" added.');
		if (Game.ready && mod.init)
		{
			if (!App && Game.Win) Game.Win('Third-party');
			mod.init();
			if (mod.load && Game.modSaveData[id]) mod.load(Game.modSaveData[id]);
			mod.init=0;
		}
	}
	Game.launchMods=function()
	{
		if (Game.brokenMods.length>0)
		{
			Game.Notify('<span class="warning">'+loc("Some mods couldn't be loaded:")+'</span>','['+Game.brokenMods.join(', ')+']',[32,17]);
		}
		for (var i=0;i<Game.sortedMods.length;i++)
		{
			var mod=Game.sortedMods[i];
			if (mod.init)
			{
				console.log('===initializing mod',mod.id);
				mod.init();
				mod.init=0;
				//if (mod.load && Game.modSaveData[mod.id]) mod.load(Game.modSaveData[mod.id]);
			}
		}
		if (!App && Game.sortedMods.length>0) Game.Win('Third-party');
	}
	Game.registerHook=function(hook,func)
	{
		if (func.constructor===Array)
		{
			for (var i=0;i<func.length;i++){Game.registerHook(hook,func[i]);}
			return;
		}
		if (typeof func!=='function') return;
		if (typeof Game.modHooks[hook]!=='undefined') Game.modHooks[hook].push(func);
		else console.log('Error: a mod tried to register a non-existent hook named "'+hook+'".');
	}
	Game.removeHook=function(hook,func)
	{
		if (func.constructor===Array)
		{
			for (var i=0;i<func.length;i++){Game.removeHook(hook,func[i]);}
			return;
		}
		if (typeof func!=='function') return;
		if (typeof Game.modHooks[hook]!=='undefined' && Game.modHooks[hook].indexOf(func)!=-1) Game.modHooks[hook].splice(Game.modHooks[hook].indexOf(func),1);
		else console.log('Error: a mod tried to remove a non-existent hook named "'+hook+'".');
	}
	Game.runModHook=function(hook,param)
	{
		for (var i=0;i<Game.modHooks[hook].length;i++)
		{
			Game.modHooks[hook][i](param);
		}
	}
	Game.runModHookOnValue=function(hook,val)
	{
		for (var i=0;i<Game.modHooks[hook].length;i++)
		{
			val=Game.modHooks[hook][i](val);
		}
		return val;
	}
	Game.safeSaveString=function(str)
	{
		//look as long as it works
		str=replaceAll('|','[P]',str);
		str=replaceAll(';','[S]',str);
		return str;
	}
	Game.safeLoadString=function(str)
	{
		str=replaceAll('[P]','|',str);
		str=replaceAll('[S]',';',str);
		return str;
	}
	Game.saveModData=function()
	{
		var str='';
		for (var i=0;i<Game.sortedMods.length;i++)
		{
			if (Game.sortedMods[i]['save'])
			{
				var data=Game.sortedMods[i]['save']();
				if (typeof data!=='undefined') Game.modSaveData[Game.sortedMods[i].id]=data;
			}
		}
		for (var i in Game.modSaveData)
		{
			str+=i+':'+Game.safeSaveString(Game.modSaveData[i])+';';
		}
		if (App && App.saveMods) str+=App.saveMods();
		return str;
	}
	Game.loadModData=function()
	{
		for (var i in Game.modSaveData)
		{
			if (Game.mods[i] && Game.mods[i]['load']) Game.mods[i]['load'](Game.modSaveData[i]);
		}
	}
	Game.deleteModData=function(id)
	{
		if (Game.modSaveData[id]) delete Game.modSaveData[id];
	}
	Game.deleteAllModData=function()
	{
		Game.modSaveData={};
	}
	Game.CheckModData=function()
	{
		var modsN=0;
		var str='';
		for (var i in Game.modSaveData)
		{
			str+='<div style="border-bottom:1px dashed rgba(255,255,255,0.2);clear:both;overflow:hidden;padding:4px 0px;">';
				str+='<div style="float:left;width:49%;text-align:left;overflow:hidden;"><b>'+i+'</b>';
					if (Game.mods[i]) str+=' '+loc("(loaded)");
				str+='</div>';
				str+='<div style="float:right;width:49%;text-align:right;overflow:hidden;">'+loc("%1 char",Game.modSaveData[i].length)+' <a class="option warning" style="padding:0px 2px;font-size:10px;margin:0px;vertical-align:top;" '+Game.clickStr+'="Game.deleteModData(\''+i+'\');PlaySound(\'snd/tick.mp3\');Game.ClosePrompt();Game.CheckModData();">X</a>';
				str+='</div>';
			str+='</div>';
			modsN++;
		}
		if (modsN==0) str+=loc("No mod data present.");
		else str+='<div><a class="option warning" style="font-size:11px;margin-top:4px;" '+Game.clickStr+'="Game.deleteAllModData();PlaySound(\'snd/tick.mp3\');Game.ClosePrompt();Game.CheckModData();">'+loc("Delete all")+'</a></div>';
		Game.Prompt('<id ModData><h3>'+loc("Mod data")+'</h3><div class="block">'+tinyIcon([16,5])+'<div></div>'+loc("These are the mods present in your save data. You may delete some of this data to make your save file smaller.")+'</div><div class="block" style="font-size:11px;">'+str+'</div>',[loc("Back")]);
	}
	
	Game.LoadMod=LoadScript;//loads the mod at the given URL
	
	if (false)
	{
		//EXAMPLE MOD
		Game.registerMod('test mod',{
			/*
				what this example mod does:
				-double your CpS
				-display a little popup for half a second whenever you click the big cookie
				-add a little intro text above your bakery name, and generate that intro text at random if you don't already have one
				-save and load your intro text
			*/
			init:function(){
				Game.registerHook('reincarnate',function(){Game.mods['test mod'].addIntro();});
				Game.registerHook('check',function(){if (!Game.playerIntro){Game.mods['test mod'].addIntro();}});
				Game.registerHook('click',function(){Game.Notify(choose(['A good click.','A solid click.','A mediocre click.','An excellent click!']),'',0,0.5);});
				Game.registerHook('cps',function(cps){return cps*2;});
			},
			save:function(){
				//note: we use stringified JSON for ease and clarity but you could store any type of string
				return JSON.stringify({text:Game.playerIntro})
			},
			load:function(str){
				var data=JSON.parse(str);
				if (data.text) Game.mods['test mod'].addIntro(data.text);
			},
			addIntro:function(text){
				//note: this is not a mod hook, just a function that's part of the mod
				Game.playerIntro=text||choose(['oh snap, it\'s','watch out, it\'s','oh no! here comes','hide your cookies, for here comes','behold! it\'s']);
				if (!l('bakerySubtitle')) l('bakeryName').insertAdjacentHTML('afterend','<div id="bakerySubtitle" class="title" style="text-align:center;position:absolute;left:0px;right:0px;bottom:32px;font-size:12px;pointer-events:none;text-shadow:0px 1px 1px #000,0px 0px 4px #f00;opacity:0.8;"></div>');
				l('bakerySubtitle').textContent='~'+Game.playerIntro+'~';
			},
		});
	}
	
	//replacing an existing canvas picture with a new one at runtime : Game.Loader.Replace('perfectCookie.webp','imperfectCookie.webp');
	//upgrades and achievements can use other pictures than icons.png; declare their icon with [posX,posY,'http://example.com/myIcons.png']
	//check out the "UNLOCKING STUFF" section to see how unlocking achievs and upgrades is done
})();

Game.version=VERSION;
Game.loadedFromVersion=VERSION;
Game.beta=BETA;
if (!App && window.location.href.indexOf('/beta')>-1) Game.beta=1;
else if (App && new URL(window.location.href).searchParams.get('beta')) Game.beta=1;
Game.https=!App?((location.protocol!='https:')?false:true):true;
Game.SaveTo='CookieClickerGame';
if (Game.beta) Game.SaveTo='CookieClickerGameBeta';
if (App && new URL(window.location.href).searchParams.get('modless')) Game.modless=1;

Game.Launch=function()
{
	Game.mobile=0;
	Game.touchEvents=0;
	//if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) Game.mobile=1;
	//if (Game.mobile) Game.touchEvents=1;
	//if ('ontouchstart' in document.documentElement) Game.touchEvents=1;
	
	
	var css=document.createElement('style');
	css.type='text/css';
	css.innerHTML='body .icon,body .crate,body .usesIcon{background-image:url(img/icons.webp?v='+Game.version+');}';
	document.head.appendChild(css);
	
	//this is so shimmers can still appear even if you lose connection after the game is loaded
	var preloadImages=['img/goldCookie.webp','img/wrathCookie.webp','img/spookyCookie.webp','img/hearts.webp','img/contract.webp','img/wrathContract.webp','img/bunnies.webp','img/frostedReindeer.webp'];
	var preloadImagesL=l('preloadImages');
	for (var i=0;i<preloadImages.length;i++)
	{
		var img=document.createElement('img');
		img.src=preloadImages[i];
		preloadImagesL.appendChild(img);
	}
	
	Game.visible=true;
	AddEvent(document,'visibilitychange',function(e){if (document.visibilityState==='hidden') Game.visible=false; else Game.visible=true;});
	
	
	if (!EN)
	{
		//code-patching the CSS for localization feels like it should be against the law, and yet
		var css=document.createElement('style');
		css.type='text/css';
		css.innerHTML=
			'#upgrades:before{content:\''+loc("Upgrades")+'\';}'+
			'#toggleUpgrades:before{content:\''+loc("Switches")+'\';}'+
			'#techUpgrades:before{content:\''+loc("Research")+'\';}'+
			'#vaultUpgrades:before{content:\''+loc("Vault")+'\';}'+
			'#products:before{content:\''+loc("Buildings")+'\';}'+
		'';
		document.head.appendChild(css);
	}
	
	Game.baseSeason='';//halloween, christmas, valentines, fools, easter
	//automatic season detection (might not be 100% accurate)
	var year=new Date().getFullYear();
	var leap=(((year%4==0)&&(year%100!=0))||(year%400==0))?1:0;
	var day=Math.floor((new Date()-new Date(year,0,0))/(1000*60*60*24));
	if (day>=41 && day<=46) Game.baseSeason='valentines';
	else if (day+leap>=90 && day<=92+leap) Game.baseSeason='fools';
	else if (day>=304-7+leap && day<=304+leap) Game.baseSeason='halloween';
	else if (day>=349+leap && day<=365+leap) Game.baseSeason='christmas';
	else
	{
		//easter is a pain goddamn
		var easterDay=function(Y){var C = Math.floor(Y/100);var N = Y - 19*Math.floor(Y/19);var K = Math.floor((C - 17)/25);var I = C - Math.floor(C/4) - Math.floor((C - K)/3) + 19*N + 15;I = I - 30*Math.floor((I/30));I = I - Math.floor(I/28)*(1 - Math.floor(I/28)*Math.floor(29/(I + 1))*Math.floor((21 - N)/11));var J = Y + Math.floor(Y/4) + I + 2 - C + Math.floor(C/4);J = J - 7*Math.floor(J/7);var L = I - J;var M = 3 + Math.floor((L + 40)/44);var D = L + 28 - 31*Math.floor(M/4);return new Date(Y,M-1,D);}(year);
		easterDay=Math.floor((easterDay-new Date(easterDay.getFullYear(),0,0))/(1000*60*60*24));
		if (day>=easterDay-7 && day<=easterDay) Game.baseSeason='easter';
	}
	
	Game.updateLog=
	'<div class="selectable">'+
	'<div class="section">'+loc("Info")+'</div>'+
	'<div class="subsection">'+
	'<div class="title">'+loc("About")+'</div>'+
	(App?'<div class="listing" style="font-weight:bold;font-style:italic;opacity:0.5;">'+loc("Note: links will open in your web browser.")+'</div>':'')+
	'<div class="listing">'+loc("Cookie Clicker is a javascript game by %1 and %2.",['<a href="//orteil.dashnet.org" target="_blank">Orteil</a>','<a href="//dashnet.org" target="_blank">Opti</a>'])+'</div>'+
	(App?'<div class="listing">'+loc("Music by %1.",'<a href="https://twitter.com/C418" target="_blank">C418</a>')+'</div>':'')+
	//'<div class="listing">We have an <a href="https://discordapp.com/invite/cookie" target="_blank">official Discord</a>, as well as a <a href="http://forum.dashnet.org" target="_blank">forum</a>; '+
	'<div class="listing">'+(EN?
		'We have an <a href="https://discordapp.com/invite/cookie" target="_blank">official Discord</a>; if you\'re looking for help, you may also want to visit the <a href="https://www.reddit.com/r/CookieClicker" target="_blank">subreddit</a> or the <a href="https://cookieclicker.wikia.com/wiki/Cookie_Clicker_Wiki" target="_blank">wiki</a>.<br>News and teasers are usually posted on Orteil\'s <a href="https://orteil42.tumblr.com/" target="_blank">tumblr</a> and <a href="https://twitter.com/orteil42" target="_blank">twitter</a>.'
		:
		loc("Useful links: %1, %2, %3, %4.",[
		'<a href="https://discordapp.com/invite/cookie" target="_blank" class="highlightHover smallBlackButton">Discord</a>',
		'<a href="https://cookieclicker.wikia.com/wiki/Cookie_Clicker_Wiki" target="_blank" class="highlightHover smallBlackButton">wiki</a>',
		'<a href="https://orteil42.tumblr.com/" target="_blank" class="highlightHover smallBlackButton">tumblr</a>',
		'<a href="https://twitter.com/orteil42" target="_blank" class="highlightHover smallBlackButton">twitter</a>',
		]))
	+'</div>'+
	(!App?'<div class="listing block" style="margin:8px 32px;font-size:11px;line-height:110%;color:rgba(200,200,255,1);background:rgba(128,128,255,0.15);" id="supportSection">'+loc(
		"This version of Cookie Clicker is 100% free, forever. Want to support us so we can keep developing games? Here's some ways you can help:%1",
		[(!App?'<br><br>&bull; '+(EN?'get ':'')+'<a href="https://store.steampowered.com/app/1454400/Cookie_Clicker/" target="_blank" class="highlightHover smallWhiteButton">Cookie Clicker on Steam</a>':'')+''+(EN?' (it\'s about 5 bucks)':'')+'<br><br>&bull; '+(EN?'support us on ':'')+'<a href="https://www.patreon.com/dashnet" target="_blank" class="highlightHover smallOrangeButton">Patreon</a>'+(EN?' (there\'s perks!)':'')+'<br><br>&bull; '+(EN?'check out our ':'')+'<a href="http://www.redbubble.com/people/dashnet" target="_blank" class="highlightHover smallWhiteButton">Shop</a>'+(EN?' with rad cookie shirts, hoodies and stickers':'')+((!App && EN)?'<br><br>&bull; disable your adblocker (if you want!)':'')]
	)+
	'</div></div>':'')+
	'<div class="listing warning">'+loc("Note: if you find a new bug after an update and you're using a 3rd-party add-on, make sure it's not just your add-on causing it!")+'</div>'+
	(!App?('<div class="listing warning">'+loc("Warning: clearing your browser cache or cookies <small>(what else?)</small> will result in your save being wiped. Export your save and back it up first!")+'</div>'):'')+
	
	'</div><div class="subsection">'+
	'<div class="title">'+loc("Version history")+'</div>';
	
	for (var i=0;i<locPatches.length;i++)
	{
		var patch=locPatches[i];
		var patchText=
		'</div><div class="subsection update'+(patch.type==2?' small':'')+'">'+
		'<div class="title">'+patch.title+'</div>';
		for (var ii=0;ii<patch.points.length;ii++)
		{
			patchText+='<div class="listing">&bull; '+patch.points[ii]+'</div>';
		}
		Game.updateLog+=patchText;
	}
	
	if (!EN) Game.updateLog+='<div class="listing" style="font-weight:bold;font-style:italic;opacity:0.5;">'+loc("Note: older update notes are in English.")+'</div>';
	
	Game.updateLog+=
	
	'</div><div class="subsection update">'+
	'<div class="title">31/05/2022 - a mind of its own</div>'+
	'<div class="listing">&bull; added a new building</div>'+
	'<div class="listing">&bull; added a new tier of upgrades and achievements</div>'+
	'<div class="listing">&bull; multi-language support added to web version</div>'+
	'<div class="listing">&bull; added a few new heavenly upgrades</div>'+
	'<div class="listing">&bull; added the jukebox</div>'+
	'<div class="listing">&bull; the 3 secret heavenly upgrades now rely on how many times the relevant digit is present in total, rather than at the end</div>'+
	'<div class="listing">&bull; backgrounds overhauled; extra options for the background selector</div>'+
	'<div class="listing">&bull; extra options for the golden cookie sound selector</div>'+
	'<div class="listing">&bull; the bank minigame now tells you the value you previously bought a stock at</div>'+
	'<div class="listing">&bull; the bank minigame flow is a little more exciting</div>'+
	(App?'<div class="listing">&bull; new option to disable your game activity showing up in Discord</div>':'')+
	(App?'<div class="listing">&bull; launch errors now provide the option to restart without mods</div>':'')+
	
	(App?('</div><div class="subsection update small">'+
	'<div class="title">18/12/2021 - work it</div>'+
	'<div class="listing">&bull; added Steam Workshop support (lets you install mods and upload your own)</div>'+
	'<div class="listing">&bull; added Korean language support</div>'+
	'<div class="listing">&bull; added back "short numbers" option for non-english languages (uses english terms for the time being)</div>'+
	'<div class="listing">&bull; added tooltips on achievement notifications</div>'+
	'<div class="listing">&bull; added Discord rich presence support</div>'):'')+
	
	'</div><div class="subsection update">'+
	'<div class="title">01/09/2021 - give me Steam</div>'+
	'<div class="listing">&bull; Cookie Clicker has been <a href="https://store.steampowered.com/app/1454400/Cookie_Clicker/" target="_blank">released on Steam</a> with music by C418!</div>'+
	'<div class="listing">&bull; web version and Steam version will receive the same updates from now on</div>'+
	'<div class="listing">&bull; you can now play in 13 different languages</div>'+
	'<div class="listing">&bull; new option to disable scary stuff</div>'+
	'<div class="listing">&bull; basic screen-reader support</div>'+
	'<div class="listing">&bull; various other improvements</div>'+
	
	'</div><div class="subsection update">'+
	'<div class="title">01/11/2020 - alternate reality</div>'+
	'<div class="listing">&bull; new building</div>'+
	'<div class="listing">&bull; new upgrade tier</div>'+
	'<div class="listing">&bull; new achievement tier</div>'+
	'<div class="listing">&bull; new heavenly upgrades</div>'+
	'<div class="listing">&bull; new modding API</div>'+
	'<div class="listing">&bull; new rebalancing (ascension slot prices, finger upgrades...)</div>'+
	'<div class="listing">&bull; new fixes (leap years, ghost swaps, carryover seeds...)</div>'+
	'<div class="listing">&bull; new stuff</div>'+
	
	'</div><div class="subsection update small">'+
	'<div class="title">23/08/2020 - money me, money now</div>'+
	'<div class="listing">&bull; finalized stock market minigame beta and added it to live version</div>'+
	'<div class="listing">&bull; dark mode added to stock market minigame</div>'+
	'<div class="listing">&bull; can no longer select a milk before unlocking it; milk selector layout has been improved</div>'+
	'<div class="listing">&bull; stock market goods have higher value caps and a larger spread; can also shift-click the hide buttons to hide/show all other stocks</div>'+
	
	'</div><div class="subsection update small">'+
	'<div class="title">08/08/2020 - checking account (beta)</div>'+
	'<div class="listing">&bull; stock market layout has been revised</div>'+
	'<div class="listing">&bull; selling stocks no longer increases cookies baked all time</div>'+
	'<div class="listing">&bull; stock prices are now defined by your highest raw CpS this ascension (which is now displayed in the stats screen)</div>'+
	'<div class="listing">&bull; can no longer buy and sell a stock in the same tick</div>'+
	'<div class="listing">&bull; warehouse space now gains +10 per associated building level (up from +5)</div>'+
	'<div class="listing">&bull; bank level now improves average (and maximum) stock values</div>'+
	'<div class="listing">&bull; later stocks are worth more</div>'+
	'<div class="listing">&bull; Cookie Clicker turns 7!</div>'+
	
	'</div><div class="subsection update">'+
	'<div class="title">18/06/2020 - making bank (beta)</div>'+
	'<div class="listing">&bull; added the stock market minigame, accessible with level 1 banks or above; buy low, sell high!</div>'+
	'<div class="listing">&bull; (minigame subject to heavy rebalancing over the coming patches)</div>'+
	'<div class="listing">&bull; added a couple heavenly upgrades, including one that lets you pet your dragon</div>'+
	'<div class="listing">&bull; added a new tier of building upgrades and achievements</div>'+
	'<div class="listing">&bull; reindeer clicks now properly count for shimmering veil</div>'+
	'<div class="listing">&bull; numbers in scientific notation should display better with Short numbers off</div>'+
	'<div class="listing">&bull; replaced ツ in the javascript console building display with more accurate ッ</div>'+
	
	'</div><div class="subsection update">'+
	'<div class="title">28/09/2019 - going off-script</div>'+
	'<div class="listing">&bull; added a new building</div>'+
	'<div class="listing">&bull; added fortune cookies (a new heavenly upgrade)</div>'+
	'<div class="listing">&bull; more upgrades, achievements etc</div>'+
	'<div class="listing">&bull; updated the Russian bread cookies icon to better reflect their cyrillic origins</div>'+
	'<div class="listing">&bull; <i style="font-style:italic;">stealth update :</i> the sugar lump refill timeout (not sugar lump growth) now no longer ticks down while the game is closed (this fixes an exploit)</div>'+
	'<div class="listing">&bull; also released the official Android version of Cookie Clicker, playable <a href="https://play.google.com/store/apps/details?id=org.dashnet.cookieclicker" target="_blank">here</a> (iOS version will come later)</div>'+
	
	'</div><div class="subsection update small">'+
	'<div class="title">01/04/2019 - 2.019 (the "this year" update)</div>'+
	'<div class="listing">&bull; game has been renamed to "Cookie Clicker" to avoid confusion</div>'+
	'<div class="listing">&bull; can now click the big cookie to generate cookies for free</div>'+
	'<div class="listing">&bull; removed fall damage</div>'+
	//'<div class="listing">&bull; fixed various typos : player\'s name is now correctly spelled as "[bakeryName]"</div>'+
	'<div class="listing">&bull; removed all references to computer-animated movie <i style="font-style:italic;">Hoodwinked!</i> (2005)</div>'+
	'<div class="listing">&bull; went back in time and invented cookies and computer mice, ensuring Cookie Clicker would one day come to exist</div>'+
	'<div class="listing">&bull; game now fully compliant with Geneva Conventions</div>'+
	'<div class="listing">&bull; dropped support for TI-84 version</div>'+
	'<div class="listing">&bull; released a low-res retro version of the game, playable here : <a href="//orteil.dashnet.org/experiments/cookie/" target="_blank">orteil.dashnet.org/experiments/cookie</a></div>'+
	'<div class="listing">&bull; updated version number</div>'+
	
	'</div><div class="subsection update small">'+
	'<div class="title">05/03/2019 - cookies for days</div>'+
	'<div class="listing">&bull; added over 20 new cookies, all previously suggested by our supporters on <a href="https://www.patreon.com/dashnet" target="_blank">Patreon</a></div>'+
	'<div class="listing">&bull; added 2 heavenly upgrades</div>'+
	'<div class="listing">&bull; the Golden goose egg now counts as a golden cookie upgrade for Residual luck purposes</div>'+
	'<div class="listing">&bull; golden sugar lumps now either double your cookies, or give you 24 hours of your CpS, whichever is lowest (previously was doubling cookies with no cap)</div>'+
	'<div class="listing">&bull; the amount of heralds is now saved with your game, and is used to compute offline CpS the next time the game is loaded; previously, on page load, the offline calculation assumed heralds to be 0</div>'+
	'<div class="listing">&bull; added a system to counteract the game freezing up (and not baking cookies) after being inactive for a long while on slower computers; instead, this will now trigger sleep mode, during which you still produce cookies as if the game was closed; to enable this feature, use the "Sleep mode timeout" option in the settings</div>'+
	'<div class="listing">&bull; vaulting upgrades is now done with shift-click, as ctrl-click was posing issues for Mac browsers</div>'+
	'<div class="listing">&bull; made tooltips for building CpS boosts from synergies hopefully clearer</div>'+
	'<div class="listing">&bull; fixed an exploit with gambler\'s fever dream working across exports and ascensions</div>'+
	'<div class="listing">&bull; can now hide tooltips in the garden by keeping the shift key pressed to make it easier to see where you\'re planting</div>'+
	'<div class="listing">&bull; fixed a bug with golden cookies/reindeer not disappearing properly in some circumstances</div>'+
	'<div class="listing">&bull; the Dragon\'s Curve aura should now properly make sugar lumps twice as weird</div>'+
	'<div class="listing">&bull; the ctrl key should less often register incorrectly as pressed</div>'+
	'<div class="listing">&bull; added a new ad slot in the top-right, as while our playerbase is strong and supportive as ever, our ad revenue sometimes fluctuates badly; we may remove the ad again should our income stabilize</div>'+
	'<div class="listing">&bull; made a few adjustments to make the game somewhat playable in mobile browsers; it\'s not perfect and can get buggy, but it\'s functional! (you may need to zoom out or scroll around to view the game properly)</div>'+
	'<div class="listing">&bull; speaking of which, we also got some good progress on the mobile app version (built from scratch for mobile), so stay tuned!</div>'+
	
	'</div><div class="subsection update">'+
	'<div class="title">25/10/2018 - feedback loop</div>'+
	'<div class="listing">&bull; added a new building</div>'+
	'<div class="listing">&bull; launched our <a href="https://www.patreon.com/dashnet" class="orangeLink" target="_blank">Patreon</a> <span style="font-size:80%;">(the link is orange so you\'ll notice it!)</span></div>'+
	'<div class="listing">&bull; added a bunch of new heavenly upgrades, one of which ties into our Patreon but benefits everyone (this is still experimental!)</div>'+
	'<div class="listing">&bull; when hovering over grandmas, you can now see their names and ages</div>'+
	'<div class="listing">&bull; "make X cookies just from Y" requirements are now higher</div>'+
	'<div class="listing">&bull; tweaked the prices of some heavenly upgrades to better fit the current cookie economy (it turns out billions of heavenly chips is now very achievable)</div>'+
	'<div class="listing">&bull; building tooltips now display what % of CpS they contribute through synergy upgrades</div>'+
	'<div class="listing">&bull; queenbeets now give up to 4% of bank, down from 6%</div>'+
	'<div class="listing">&bull; among other things, season switches now display how many seasonal upgrades you\'re missing, and permanent upgrade slots now display the name of the slotted upgrade</div>'+
	'<div class="listing">&bull; season switches have reworked prices</div>'+
	'<div class="listing">&bull; season switches can now be cancelled by clicking them again</div>'+
	'<div class="listing">&bull; can no longer accidentally click wrinklers through other elements</div>'+
	'<div class="listing">&bull; sugar frenzy now triples your CpS for an hour instead of doubling it</div>'+
	'<div class="listing">&bull; this text is now selectable</div>'+
	'<div class="listing">&bull; progress on dungeons minigame is still very much ongoing</div>'+
	
	'</div><div class="subsection update small">'+
	'<div class="title">08/08/2018 - hey now</div>'+
	'<div class="listing">&bull; Cookie Clicker somehow turns 5, going against doctors\' most optimistic estimates</div>'+
	'<div class="listing">&bull; added a new tier of building achievements, all named after Smash Mouth\'s classic 1999 hit "All Star"</div>'+
	'<div class="listing">&bull; added a new tier of building upgrades, all named after nothing in particular</div>'+
	'<div class="listing">&bull; <b>to our players :</b> thank you so much for sticking with us all those years and allowing us to keep making the dumbest game known to mankind</div>'+
	'<div class="listing">&bull; resumed work on the dungeons minigame</div>'+
	
	'</div><div class="subsection update small">'+
	'<div class="title">01/08/2018 - buy buy buy</div>'+
	'<div class="listing">&bull; added a heavenly upgrade that lets you buy all your upgrades instantly</div>'+
	'<div class="listing">&bull; added a heavenly upgrade that lets you see upgrade tiers (feature was previously removed due to being confusing)</div>'+
	'<div class="listing">&bull; added a new wrinkler-related heavenly upgrade</div>'+
	'<div class="listing">&bull; added a new upgrade tier</div>'+
	'<div class="listing">&bull; added a couple new cookies and achievements</div>'+
	'<div class="listing">&bull; new "extra buttons" setting; turning it on adds buttons that let you minimize buildings</div>'+
	'<div class="listing">&bull; new "lump confirmation" setting; turning it on will show a confirmation prompt when you spend sugar lumps</div>'+
	'<div class="listing">&bull; buildings now sell back for 25% of their current price (down from 50%); Earth Shatterer modified accordingly, now gives back 50% (down from 85%)</div>'+
	'<div class="listing">&bull; farm soils now unlock correctly based on current amount of farms</div>'+
	'<div class="listing">&bull; cheapcaps have a new exciting nerf</div>'+
	'<div class="listing">&bull; wrinklegill spawns a bunch more</div>'+
	'<div class="listing">&bull; can now ctrl-shift-click on "Harvest all" to only harvest mature, non-immortal plants</div>'+
	'<div class="listing">&bull; added a new rare type of sugar lump</div>'+
	
	'</div><div class="subsection update small">'+
	'<div class="title">20/04/2018 - weeding out some bugs</div>'+
	'<div class="listing">&bull; golden clovers and wrinklegills should spawn a bit more often</div>'+
	'<div class="listing">&bull; cronerice matures a lot sooner</div>'+
	'<div class="listing">&bull; mature elderworts stay mature after reloading</div>'+
	'<div class="listing">&bull; garden interface occupies space more intelligently</div>'+
	'<div class="listing">&bull; seed price displays should be better behaved with short numbers disabled</div>'+
	'<div class="listing">&bull; minigame animations are now turned off if using the "Fancy graphics" option is disabled</div>'+
	'<div class="listing">&bull; CpS achievement requirements were dialed down a wee tad</div>'+
	
	'</div><div class="subsection update small">'+
	'<div class="title">19/04/2018 - garden patch</div>'+
	'<div class="listing">&bull; upgrades dropped by garden plants now stay unlocked forever (but drop much more rarely)</div>'+
	'<div class="listing">&bull; garden sugar lump refill now also makes plants spread and mutate 3 times more during the bonus tick</div>'+
	'<div class="listing">&bull; a few new upgrades</div>'+
	'<div class="listing">&bull; a couple bug fixes and rephrasings</div>'+
	
	'</div><div class="subsection update">'+
	'<div class="title">18/04/2018 - your garden-variety update</div>'+
	'<div class="listing">&bull; added the garden, a minigame unlocked by having at least level 1 farms</div>'+
	'<div class="listing">&bull; added a little arrow and a blinky label to signal the game has updated since you last played it (hi!)</div>'+
	'<div class="listing">&bull; new cookies, milk flavors and achievements</div>'+
	'<div class="listing">&bull; sugar lumps are now unlocked whenever you\'ve baked at least a billion cookies, instead of on your first ascension</div>'+
	'<div class="listing">&bull; sugar lump type now saves correctly</div>'+
	'<div class="listing">&bull; minigame sugar lump refills can now only be done every 15 minutes (timer shared across all minigames)</div>'+
	'<div class="listing">&bull; CpS achievements now have steeper requirements</div>'+
	'<div class="listing">&bull; golden cookies now last 5% shorter for every other golden cookie on the screen</div>'+
	'<div class="listing">&bull; the game now remembers which minigames are closed or open</div>'+
	'<div class="listing">&bull; added a popup that shows when a season starts (so people won\'t be so confused about "the game looking weird today")</div>'+
	'<div class="listing">&bull; permanent upgrade slots now show a tooltip for the selected upgrade</div>'+
	'<div class="listing">&bull; finally fixed the save corruption bug, hopefully</div>'+
	
	'</div><div class="subsection update small">'+
	'<div class="title">24/02/2018 - sugar coating</div>'+
	'<div class="listing">&bull; added link to <a href="https://discordapp.com/invite/cookie" target="_blank">official Discord server</a></div>'+
	'<div class="listing">&bull; felt weird about pushing an update without content so :</div>'+
	'<div class="listing">&bull; added a handful of new cookies</div>'+
	'<div class="listing">&bull; added 3 new heavenly upgrades</div>'+
	'<div class="listing">&bull; short numbers should now be displayed up to novemnonagintillions</div>'+
	'<div class="listing">&bull; cookie chains no longer spawn from the Force the Hand of Fate spell</div>'+
	'<div class="listing">&bull; bigger, better Cookie Clicker content coming later this year</div>'+
	
	'</div><div class="subsection update">'+
	'<div class="title">08/08/2017 - 4 more years</div>'+
	'<div class="listing">&bull; new building : Chancemakers</div>'+
	'<div class="listing">&bull; new milk, new kittens, new dragon aura, new cookie, new upgrade tier</div>'+
	'<div class="listing">&bull; buffs no longer affect offline CpS</div>'+
	'<div class="listing">&bull; Godzamok\'s hunger was made less potent (this is a nerf, very sorry)</div>'+
	'<div class="listing">&bull; grimoire spell costs and maximum magic work differently</div>'+
	'<div class="listing">&bull; Spontaneous Edifice has been reworked</div>'+
	'<div class="listing">&bull; changed unlock levels and prices for some cursor upgrades</div>'+
	'<div class="listing">&bull; fixed buggy pantheon slots, hopefully</div>'+
	'<div class="listing">&bull; fixed "Legacy started a long while ago" showing as "a few seconds ago"</div>'+
	'<div class="listing">&bull; Cookie Clicker just turned 4. Thank you for sticking with us this long!</div>'+
	
	'</div><div class="subsection update">'+
	'<div class="title">15/07/2017 - the spiritual update</div>'+
	'<div class="listing">&bull; implemented sugar lumps, which start coalescing if you\'ve ascended at least once and can be used as currency for special things</div>'+
	'<div class="listing">&bull; buildings can now level up by using sugar lumps in the main buildings display, permanently boosting their CpS</div>'+
	'<div class="listing">&bull; added two new features unlocked by levelling up their associated buildings, Temples and Wizard towers; more building-related minigames will be implemented in the future</div>'+
	'<div class="listing">&bull; active buffs are now saved</div>'+
	'<div class="listing">&bull; the background selector upgrade is now functional</div>'+
	'<div class="listing">&bull; the top menu no longer scrolls with the rest</div>'+
	'<div class="listing">&bull; timespans are written nicer</div>'+
	'<div class="listing">&bull; Dragonflights now tend to supercede Click frenzies, you will rarely have both at the same time</div>'+
	'<div class="listing">&bull; some old bugs were phased out and replaced by new ones</div>'+
	
	'</div><div class="subsection update small">'+
	'<div class="title">24/07/2016 - golden cookies overhaul</div>'+
	'<div class="listing">&bull; golden cookies and reindeer now follow a new system involving explicitly defined buffs</div>'+
	'<div class="listing">&bull; a bunch of new golden cookie effects have been added</div>'+
	'<div class="listing">&bull; CpS gains from eggs are now multiplicative</div>'+
	'<div class="listing">&bull; shiny wrinklers are now saved</div>'+
	'<div class="listing">&bull; reindeer have been rebalanced ever so slightly</div>'+
	'<div class="listing">&bull; added a new cookie upgrade near the root of the heavenly upgrade tree; this is intended to boost early ascensions and speed up the game as a whole</div>'+
	'<div class="listing">&bull; due to EU legislation, implemented a warning message regarding browser cookies; do understand that the irony is not lost on us</div>'+
	
	'</div><div class="subsection update">'+
	'<div class="title">08/02/2016 - legacy</div>'+
	'<div class="listing"><b>Everything that was implemented during the almost 2-year-long beta has been added to the live game. To recap :</b></div>'+
	'<div class="listing">&bull; 3 new buildings : banks, temples, and wizard towers; these have been added in-between existing buildings and as such, may disrupt some building-related achievements</div>'+
	'<div class="listing">&bull; the ascension system has been redone from scratch, with a new heavenly upgrade tree</div>'+
	'<div class="listing">&bull; mysterious new features such as angel-powered offline progression, challenge runs, and a cookie dragon</div>'+
	'<div class="listing">&bull; sounds have been added (can be disabled in the options)</div>'+
	'<div class="listing">&bull; heaps of rebalancing and bug fixes</div>'+
	'<div class="listing">&bull; a couple more upgrades and achievements, probably</div>'+
	'<div class="listing">&bull; fresh new options to further customize your cookie-clicking experience</div>'+
	'<div class="listing">&bull; quality-of-life improvements : better bulk-buy, better switches etc</div>'+
	'<div class="listing">&bull; added some <a href="http://en.wikipedia.org/wiki/'+choose(['Krzysztof_Arciszewski','Eustachy_Sanguszko','Maurycy_Hauke','Karol_Turno','Tadeusz_Kutrzeba','Kazimierz_Fabrycy','Florian_Siwicki'])+'" target="_blank">general polish</a></div>'+/* i liked this dumb pun too much to let it go unnoticed */
	'<div class="listing">&bull; tons of other little things we can\'t even remember right now</div>'+
	'<div class="listing">Miss the old version? Your old save was automatically exported <a href="//orteil.dashnet.org/cookieclicker/v10466/" target="_blank">here</a>!</div>'+
	
	'</div><div class="subsection update small">'+
	'<div class="title">05/02/2016 - legacy beta, more fixes</div>'+
	'<div class="listing">&bull; added challenge modes, which can be selected when ascending (only 1 for now : "Born again")</div>'+
	'<div class="listing">&bull; changed the way bulk-buying and bulk-selling works</div>'+
	'<div class="listing">&bull; more bugs ironed out</div>'+
	
	'</div><div class="subsection update">'+
	'<div class="title">03/02/2016 - legacy beta, part III</div>'+
	'<div class="listing warning">&bull; Not all bugs have been fixed, but everything should be much less broken.</div>'+
	'<div class="listing">&bull; Additions'+
		'<div style="opacity:0.8;margin-left:12px;">'+
		'-a few more achievements<br>'+
		'-new option for neat, but slow CSS effects (disabled by default)<br>'+
		'-new option for a less grating cookie sound (enabled by default)<br>'+
		'-new option to bring back the boxes around icons in the stats screen<br>'+
		'-new buttons for saving and loading your game to a text file<br>'+
		'</div>'+
	'</div>'+
	'<div class="listing">&bull; Changes'+
		'<div style="opacity:0.8;margin-left:12px;">'+
		'-early game should be a bit faster and very late game was kindly asked to tone it down a tad<br>'+
		'-dragonflight should be somewhat less ridiculously overpowered<br>'+
		'-please let me know if the rebalancing was too heavy or not heavy enough<br>'+
		'-santa and easter upgrades now depend on Santa level and amount of eggs owned, respectively, instead of costing several minutes worth of CpS<br>'+
		'-cookie upgrades now stack multiplicatively rather than additively<br>'+
		'-golden switch now gives +50% CpS, and residual luck is +10% CpS per golden cookie upgrade (up from +25% and +1%, respectively)<br>'+
		'-lucky cookies and cookie chain payouts have been modified a bit, possibly for the better, who knows!<br>'+
		'-wrinklers had previously been reduced to a maximum of 8 (10 with a heavenly upgrade), but are now back to 10 (12 with the upgrade)<br>'+
		/*'-all animations are now handled by requestAnimationFrame(), which should hopefully help make the game less resource-intensive<br>'+*/
		'-an ascension now only counts for achievement purposes if you earned at least 1 prestige level from it<br>'+
		'-the emblematic Cookie Clicker font (Kavoon) was bugged in Firefox, and has been replaced with a new font (Merriweather)<br>'+
		'-the mysterious wrinkly creature is now even rarer, but has a shadow achievement tied to it<br>'+
		'</div>'+
	'</div>'+
	'<div class="listing">&bull; Fixes'+
		'<div style="opacity:0.8;margin-left:12px;">'+
		'-prestige now grants +1% CpS per level as intended, instead of +100%<br>'+
		'-heavenly chips should no longer add up like crazy when you ascend<br>'+
		'-upgrades in the store should no longer randomly go unsorted<br>'+
		'-window can be resized to any size again<br>'+
		'-the "Stats" and "Options" buttons have been swapped again<br>'+
		'-the golden cookie sound should be somewhat clearer<br>'+
		'-the ascend screen should be less CPU-hungry<br>'+
		'</div>'+
	'</div>'+
	
	'</div><div class="subsection update">'+
	'<div class="title">20/12/2015 - legacy beta, part II</div>'+
	'<div class="listing warning">&bull; existing beta saves have been wiped due to format inconsistencies and just plain broken balance; you\'ll have to start over from scratch - which will allow you to fully experience the update and find all the awful little bugs that no doubt plague it</div>'+
	'<div class="listing warning">&bull; importing your save from the live version is also fine</div>'+
	'<div class="listing">&bull; we took so long to make this update, Cookie Clicker turned 2 years old in the meantime! Hurray!</div>'+
	'<div class="listing">&bull; heaps of new upgrades and achievements</div>'+
	'<div class="listing">&bull; fixed a whole bunch of bugs</div>'+
	'<div class="listing">&bull; did a lot of rebalancing</div>'+
	'<div class="listing">&bull; reworked heavenly chips and heavenly cookies (still experimenting, will probably rebalance things further)</div>'+
	'<div class="listing">&bull; you may now unlock a dragon friend</div>'+
	'<div class="listing">&bull; switches and season triggers now have their own store section</div>'+
	'<div class="listing">&bull; ctrl-s and ctrl-o now save the game and open the import menu, respectively</div>'+
	'<div class="listing">&bull; added some quick sounds, just as a test</div>'+
	'<div class="listing">&bull; a couple more options</div>'+
	'<div class="listing">&bull; even more miscellaneous changes and additions</div>'+
	
	'</div><div class="subsection update">'+
	'<div class="title">25/08/2014 - legacy beta, part I</div>'+
	'<div class="listing">&bull; 3 new buildings</div>'+
	'<div class="listing">&bull; price and CpS curves revamped</div>'+
	'<div class="listing">&bull; CpS calculations revamped; cookie upgrades now stack multiplicatively</div>'+
	'<div class="listing">&bull; prestige system redone from scratch, with a whole new upgrade tree</div>'+
	'<div class="listing">&bull; added some <a href="http://en.wikipedia.org/wiki/'+choose(['Krzysztof_Arciszewski','Eustachy_Sanguszko','Maurycy_Hauke','Karol_Turno','Tadeusz_Kutrzeba','Kazimierz_Fabrycy','Florian_Siwicki'])+'" target="_blank">general polish</a></div>'+
	'<div class="listing">&bull; tons of other miscellaneous fixes and additions</div>'+
	'<div class="listing">&bull; Cookie Clicker is now 1 year old! (Thank you guys for all the support!)</div>'+
	'<div class="listing warning">&bull; Note : this is a beta; you are likely to encounter bugs and oversights. Feel free to send me feedback if you find something fishy!</div>'+
	
	'</div><div class="subsection update small">'+
	'<div class="title">18/05/2014 - better late than easter</div>'+
	'<div class="listing">&bull; bunnies and eggs, somehow</div>'+
	'<div class="listing">&bull; prompts now have keyboard shortcuts like system prompts would</div>'+
	'<div class="listing">&bull; naming your bakery? you betcha</div>'+
	'<div class="listing">&bull; "Fast notes" option to make all notifications close faster; new button to close all notifications</div>'+
	'<div class="listing">&bull; the dungeons beta is now available on <a href="//orteil.dashnet.org/cookieclicker/betadungeons" target="_blank">/betadungeons</a></div>'+
	
	'</div><div class="subsection update small">'+
	'<div class="title">09/04/2014 - nightmare in heaven</div>'+
	'<div class="listing">&bull; broke a thing; heavenly chips were corrupted for some people</div>'+
	'<div class="listing">&bull; will probably update to /beta first in the future</div>'+
	'<div class="listing">&bull; sorry again</div>'+
	
	'</div><div class="subsection update small">'+
	'<div class="title">09/04/2014 - quality of life</div>'+
	'<div class="listing">&bull; new upgrade and achievement tier</div>'+
	'<div class="listing">&bull; popups and prompts are much nicer</div>'+
	'<div class="listing">&bull; tooltips on buildings are more informative</div>'+
	'<div class="listing">&bull; implemented a simplified version of the <a href="https://github.com/Icehawk78/FrozenCookies" target="_blank">Frozen Cookies</a> add-on\'s short number formatting</div>'+
	'<div class="listing">&bull; you can now buy 10 and sell all of a building at a time</div>'+
	'<div class="listing">&bull; tons of optimizations and subtler changes</div>'+
	'<div class="listing">&bull; you can now <a href="//orteil.dashnet.org/cookies2cash/" target="_blank">convert your cookies to cash</a>!</div>'+
	
	'</div><div class="subsection update small">'+
	'<div class="title">05/04/2014 - pity the fool</div>'+
	'<div class="listing">&bull; wrinklers should now be saved so you don\'t have to pop them every time you refresh the game</div>'+
	'<div class="listing">&bull; you now properly win 1 cookie upon reaching 10 billion cookies and making it on the local news</div>'+
	'<div class="listing">&bull; miscellaneous fixes and tiny additions</div>'+
	'<div class="listing">&bull; added a few very rudimentary mod hooks</div>'+
	'<div class="listing">&bull; the game should work again in Opera</div>'+
	'<div class="listing">&bull; don\'t forget to check out <a href="//orteil.dashnet.org/randomgen/" target="_blank">RandomGen</a>, our all-purpose random generator maker!</div>'+
	
	'</div><div class="subsection update small">'+
	'<div class="title">01/04/2014 - fooling around</div>'+
	'<div class="listing">&bull; it\'s about time : Cookie Clicker has turned into the much more realistic Cookie Baker</div>'+
	'<div class="listing">&bull; season triggers are cheaper and properly unlock again when they run out</div>'+
	'<div class="listing">&bull; buildings should properly unlock (reminder : building unlocking is completely cosmetic and does not change the gameplay)</div>'+
	
	'</div><div class="subsection update small">'+
	'<div class="title">14/02/2014 - lovely rainbowcalypse</div>'+
	'<div class="listing">&bull; new building (it\'s been a while). More to come!</div>'+
	'<div class="listing">&bull; you can now trigger seasonal events to your heart\'s content (upgrade unlocks at 5000 heavenly chips)</div>'+
	'<div class="listing">&bull; new ultra-expensive batch of seasonal cookie upgrades you\'ll love to hate</div>'+
	'<div class="listing">&bull; new timer bars for golden cookie buffs</div>'+
	'<div class="listing">&bull; buildings are now hidden when you start out and appear as they become available</div>'+
	'<div class="listing">&bull; technical stuff : the game is now saved through localstorage instead of browser cookies, therefore ruining a perfectly good pun</div>'+
	
	'</div><div class="subsection update small">'+
	'<div class="title">22/12/2013 - merry fixmas</div>'+
	'<div class="listing">&bull; some issues with the christmas upgrades have been fixed</div>'+
	'<div class="listing">&bull; reindeer cookie drops are now more common</div>'+
	'<div class="listing">&bull; reindeers are now reindeer</div>'+
	
	'</div><div class="subsection update">'+
	'<div class="title">20/12/2013 - Christmas is here</div>'+
	'<div class="listing">&bull; there is now a festive new evolving upgrade in store</div>'+
	'<div class="listing">&bull; reindeer are running amok (catch them if you can!)</div>'+
	'<div class="listing">&bull; added a new option to warn you when you close the window, so you don\'t lose your un-popped wrinklers</div>'+
	'<div class="listing">&bull; also added a separate option for displaying cursors</div>'+
	'<div class="listing">&bull; all the Halloween features are still there (and having the Spooky cookies achievements makes the Halloween cookies drop much more often)</div>'+
	'<div class="listing">&bull; oh yeah, we now have <a href="http://www.redbubble.com/people/dashnet" target="_blank">Cookie Clicker shirts, stickers and hoodies</a>! (they\'re really rad)</div>'+
	
	'</div><div class="subsection update small">'+
	'<div class="title">29/10/2013 - spooky update</div>'+
	'<div class="listing">&bull; the Grandmapocalypse now spawns wrinklers, hideous elderly creatures that damage your CpS when they reach your big cookie. Thankfully, you can click on them to make them explode (you\'ll even gain back the cookies they\'ve swallowed - with interest!).</div>'+
	'<div class="listing">&bull; wrath cookie now 27% spookier</div>'+
	'<div class="listing">&bull; some other stuff</div>'+
	'<div class="listing">&bull; you should totally go check out <a href="http://candybox2.net/" target="_blank">Candy Box 2</a>, the sequel to the game that inspired Cookie Clicker</div>'+
	
	'</div><div class="subsection update small">'+
	'<div class="title">15/10/2013 - it\'s a secret</div>'+
	'<div class="listing">&bull; added a new heavenly upgrade that gives you 5% of your heavenly chips power for 11 cookies (if you purchased the Heavenly key, you might need to buy it again, sorry)</div>'+
	'<div class="listing">&bull; golden cookie chains should now work properly</div>'+
	
	'</div><div class="subsection update small">'+
	'<div class="title">15/10/2013 - player-friendly</div>'+
	'<div class="listing">&bull; heavenly upgrades are now way, way cheaper</div>'+
	'<div class="listing">&bull; tier 5 building upgrades are 5 times cheaper</div>'+
	'<div class="listing">&bull; cursors now just plain disappear with Fancy Graphics off, I might add a proper option to toggle only the cursors later</div>'+
	'<div class="listing">&bull; warning : the Cookie Monster add-on seems to be buggy with this update, you might want to wait until its programmer updates it</div>'+
	
	'</div><div class="subsection update small">'+
	'<div class="title">15/10/2013 - a couple fixes</div>'+
	'<div class="listing">&bull; golden cookies should no longer spawn embarrassingly often</div>'+
	'<div class="listing">&bull; cursors now stop moving if Fancy Graphics is turned off</div>'+
	
	'</div><div class="subsection update small">'+
	'<div class="title">14/10/2013 - going for the gold</div>'+
	'<div class="listing">&bull; golden cookie chains work a bit differently</div>'+
	'<div class="listing">&bull; golden cookie spawns are more random</div>'+
	'<div class="listing">&bull; CpS achievements are no longer affected by golden cookie frenzies</div>'+
	'<div class="listing">&bull; revised cookie-baking achievement requirements</div>'+
	'<div class="listing">&bull; heavenly chips now require upgrades to function at full capacity</div>'+
	'<div class="listing">&bull; added 4 more cookie upgrades, unlocked after reaching certain amounts of Heavenly Chips</div>'+
	'<div class="listing">&bull; speed baking achievements now require you to have no heavenly upgrades; as such, they have been reset for everyone (along with the Hardcore achievement) to better match their initially intended difficulty</div>'+
	'<div class="listing">&bull; made good progress on the mobile port</div>'+
	
	'</div><div class="subsection update small">'+
	'<div class="title">01/10/2013 - smoothing it out</div>'+
	'<div class="listing">&bull; some visual effects have been completely rewritten and should now run more smoothly (and be less CPU-intensive)</div>'+
	'<div class="listing">&bull; new upgrade tier</div>'+
	'<div class="listing">&bull; new milk tier</div>'+
	'<div class="listing">&bull; cookie chains have different capping mechanics</div>'+
	'<div class="listing">&bull; antimatter condensers are back to their previous price</div>'+
	'<div class="listing">&bull; heavenly chips now give +2% CpS again (they will be extensively reworked in the future)</div>'+
	'<div class="listing">&bull; farms have been buffed a bit (to popular demand)</div>'+
	'<div class="listing">&bull; dungeons still need a bit more work and will be released soon - we want them to be just right! (you can test an unfinished version in <a href="//orteil.dashnet.org/cookieclicker/betadungeons/" target="_blank">the beta</a>)</div>'+
	
	'</div><div class="subsection update">'+
	'<div class="title">28/09/2013 - dungeon beta</div>'+
	'<div class="listing">&bull; from now on, big updates will come through a beta stage first (you can <a href="//orteil.dashnet.org/cookieclicker/betadungeons/" target="_blank">try it here</a>)</div>'+
	'<div class="listing">&bull; first dungeons! (you need 50 factories to unlock them!)</div>'+
	'<div class="listing">&bull; cookie chains can be longer</div>'+
	'<div class="listing">&bull; antimatter condensers are a bit more expensive</div>'+
	'<div class="listing">&bull; heavenly chips now only give +1% cps each (to account for all the cookies made from condensers)</div>'+
	'<div class="listing">&bull; added flavor text on all upgrades</div>'+
	
	'</div><div class="subsection update small">'+
	'<div class="title">15/09/2013 - anticookies</div>'+
	'<div class="listing">&bull; ran out of regular matter to make your cookies? Try our new antimatter condensers!</div>'+
	'<div class="listing">&bull; renamed Hard-reset to "Wipe save" to avoid confusion</div>'+
	'<div class="listing">&bull; reset achievements are now regular achievements and require cookies baked all time, not cookies in bank</div>'+
	'<div class="listing">&bull; heavenly chips have been nerfed a bit (and are now awarded following a geometric progression : 1 trillion for the first, 2 for the second, etc); the prestige system will be extensively reworked in a future update (after dungeons)</div>'+
	'<div class="listing">&bull; golden cookie clicks are no longer reset by soft-resets</div>'+
	'<div class="listing">&bull; you can now see how long you\'ve been playing in the stats</div>'+
	
	'</div><div class="subsection update small">'+
	'<div class="title">08/09/2013 - everlasting cookies</div>'+
	'<div class="listing">&bull; added a prestige system - resetting gives you permanent CpS boosts (the more cookies made before resetting, the bigger the boost!)</div>'+
	'<div class="listing">&bull; save format has been slightly modified to take less space</div>'+
	'<div class="listing">&bull; Leprechaun has been bumped to 777 golden cookies clicked and is now shadow; Fortune is the new 77 golden cookies achievement</div>'+
	'<div class="listing">&bull; clicking frenzy is now x777</div>'+
	
	'</div><div class="subsection update small">'+
	'<div class="title">04/09/2013 - smarter cookie</div>'+
	'<div class="listing">&bull; golden cookies only have 20% chance of giving the same outcome twice in a row now</div>'+
	'<div class="listing">&bull; added a golden cookie upgrade</div>'+
	'<div class="listing">&bull; added an upgrade that makes pledges last twice as long (requires having pledged 10 times)</div>'+
	'<div class="listing">&bull; Quintillion fingers is now twice as efficient</div>'+
	'<div class="listing">&bull; Uncanny clicker was really too unpredictable; it is now a regular achievement and no longer requires a world record, just *pretty fast* clicking</div>'+
	
	'</div><div class="subsection update small">'+
	'<div class="title">02/09/2013 - a better way out</div>'+
	'<div class="listing">&bull; Elder Covenant is even cheaper, and revoking it is cheaper still (also added a new achievement for getting it)</div>'+
	'<div class="listing">&bull; each grandma upgrade now requires 15 of the matching building</div>'+
	'<div class="listing">&bull; the dreaded bottom cursor has been fixed with a new cursor display style</div>'+
	'<div class="listing">&bull; added an option for faster, cheaper graphics</div>'+
	'<div class="listing">&bull; base64 encoding has been redone; this might make saving possible again on some older browsers</div>'+
	'<div class="listing">&bull; shadow achievements now have their own section</div>'+
	'<div class="listing">&bull; raspberry juice is now named raspberry milk, despite raspberry juice being delicious and going unquestionably well with cookies</div>'+
	'<div class="listing">&bull; HOTFIX : cursors now click; fancy graphics button renamed; cookies amount now more visible against cursors</div>'+
	
	'</div><div class="subsection update small">'+
	'<div class="title">01/09/2013 - sorting things out</div>'+
	'<div class="listing">&bull; upgrades and achievements are properly sorted in the stats screen</div>'+
	'<div class="listing">&bull; made Elder Covenant much cheaper and less harmful</div>'+
	'<div class="listing">&bull; importing from the first version has been disabled, as promised</div>'+
	'<div class="listing">&bull; "One mind" now actually asks you to confirm the upgrade</div>'+
	
	'</div><div class="subsection update small">'+
	'<div class="title">31/08/2013 - hotfixes</div>'+
	'<div class="listing">&bull; added a way to permanently stop the grandmapocalypse</div>'+
	'<div class="listing">&bull; Elder Pledge price is now capped</div>'+
	'<div class="listing">&bull; One Mind and other grandma research upgrades are now a little more powerful, if not 100% accurate</div>'+
	'<div class="listing">&bull; "golden" cookie now appears again during grandmapocalypse; Elder Pledge-related achievements are now unlockable</div>'+
	
	'</div><div class="subsection update">'+
	'<div class="title">31/08/2013 - too many grandmas</div>'+
	'<div class="listing">&bull; the grandmapocalypse is back, along with more grandma types</div>'+
	'<div class="listing">&bull; added some upgrades that boost your clicking power and make it scale with your cps</div>'+
	'<div class="listing">&bull; clicking achievements made harder; Neverclick is now a shadow achievement; Uncanny clicker should now truly be a world record</div>'+
	
	'</div><div class="subsection update small">'+
	'<div class="title">28/08/2013 - over-achiever</div>'+
	'<div class="listing">&bull; added a few more achievements</div>'+
	'<div class="listing">&bull; reworked the "Bake X cookies" achievements so they take longer to achieve</div>'+
	
	'</div><div class="subsection update small">'+
	'<div class="title">27/08/2013 - a bad idea</div>'+
	'<div class="listing">&bull; due to popular demand, retired 5 achievements (the "reset your game" and "cheat" ones); they can still be unlocked, but do not count toward your total anymore. Don\'t worry, there will be many more achievements soon!</div>'+
	'<div class="listing">&bull; made some achievements hidden for added mystery</div>'+
	
	'</div><div class="subsection update">'+
	'<div class="title">27/08/2013 - a sense of achievement</div>'+
	'<div class="listing">&bull; added achievements (and milk)</div>'+
	'<div class="listing"><i>(this is a big update, please don\'t get too mad if you lose some data!)</i></div>'+
	
	'</div><div class="subsection update small">'+
	'<div class="title">26/08/2013 - new upgrade tier</div>'+
	'<div class="listing">&bull; added some more upgrades (including a couple golden cookie-related ones)</div>'+
	'<div class="listing">&bull; added clicking stats</div>'+
	
	'</div><div class="subsection update small">'+
	'<div class="title">26/08/2013 - more tweaks</div>'+
	'<div class="listing">&bull; tweaked a couple cursor upgrades</div>'+
	'<div class="listing">&bull; made time machines less powerful</div>'+
	'<div class="listing">&bull; added offline mode option</div>'+
	
	'</div><div class="subsection update small">'+
	'<div class="title">25/08/2013 - tweaks</div>'+
	'<div class="listing">&bull; rebalanced progression curve (mid- and end-game objects cost more and give more)</div>'+
	'<div class="listing">&bull; added some more cookie upgrades</div>'+
	'<div class="listing">&bull; added CpS for cursors</div>'+
	'<div class="listing">&bull; added sell button</div>'+
	'<div class="listing">&bull; made golden cookie more useful</div>'+
	
	'</div><div class="subsection update small">'+
	'<div class="title">24/08/2013 - hotfixes</div>'+
	'<div class="listing">&bull; added import/export feature, which also allows you to retrieve a save game from the old version (will be disabled in a week to prevent too much cheating)</div>'+
	'<div class="listing">&bull; upgrade store now has unlimited slots (just hover over it), due to popular demand</div>'+
	'<div class="listing">&bull; added update log</div>'+
	
	'</div><div class="subsection update">'+
	'<div class="title">24/08/2013 - big update!</div>'+
	'<div class="listing">&bull; revamped the whole game (new graphics, new game mechanics)</div>'+
	'<div class="listing">&bull; added upgrades</div>'+
	'<div class="listing">&bull; much safer saving</div>'+
	
	'</div><div class="subsection update">'+
	'<div class="title">08/08/2013 - game launch</div>'+
	'<div class="listing">&bull; made <a href="https://orteil.dashnet.org/experiments/cookie/" target="_blank">the game</a> in a couple hours, for laughs</div>'+
	'<div class="listing">&bull; kinda starting to regret it</div>'+
	'<div class="listing">&bull; ah well</div>'+
	'</div>'+
	'</div>'
	;
	
	Game.ready=0;
	
	Game.Load=function()
	{
		//l('offGameMessage').innerHTML='<div style="padding:64px 128px;"><div class="title">Loading...</div></div>';
		Game.Loader=new Loader();
		Game.Loader.domain='img/';
		if (typeof PRELOAD!=='undefined') Game.Loader.loaded=PRELOAD(Game.Init);
		else Game.Loader.loaded=Game.Init;
		Game.Loader.Load(['filler.webp']);
	}
	Game.ErrorFrame=function()
	{
		l('offGameMessage').innerHTML=
		'<div class="title">Oops. Wrong address!</div>'+
		'<div>It looks like you\'re accessing Cookie Clicker from another URL than the official one.<br>'+
		'You can <a href="//orteil.dashnet.org/cookieclicker/" target="_blank">play Cookie Clicker over here</a>!<br>'+
		'<small>(If for any reason, you are unable to access the game on the official URL, we are currently working on a second domain.)</small></div>';
	}
	Game.timedout=false;
	Game.Timeout=function()
	{
		Game.WriteSave();
		Game.killShimmers();
		l('offGameMessage').innerHTML='<div class="title">'+(Game.Has('Twin Gates of Transcendence')?loc("Cookie Clicker is in sleep mode and generating offline cookies."):loc("Cookie Clicker is in sleep mode."))+'</div>'+loc("%1 to resume from your save file.",'<a '+Game.clickStr+'="Game.Resume();">'+loc("Click here")+'</a>')+'<br><div style="font-style:italic;font-size:65%;line-height:110%;opacity:0.75;">'+loc("(this happens when too many frames are skipped at once,<br>usually when the game has been running in the background for a while)<br>(you can turn this feature off in the settings menu)")+'</div>';
		l('offGameMessageWrap').style.display='table';
		Game.timedout=true;
		console.log('[=== Game timed out and has been put in sleep mode. Data was saved. ===]');
	}
	Game.Resume=function()
	{
		l('offGameMessage').innerHTML='';
		l('offGameMessageWrap').style.display='none';
		Game.timedout=false;
		Game.time=Date.now();
		Game.accumulatedDelay=0;
		Game.delayTimeouts=0;
		Game.lastActivity=Date.now();
		Game.Loop();
		Game.LoadSave();
		console.log('[=== Game resumed! Data was loaded. ===]');
	}
	
	
	Game.Init=function()
	{
		Game.ready=1;

		/*=====================================================================================
		VARIABLES AND PRESETS
		=======================================================================================*/
		Game.T=0;
		Game.drawT=0;
		Game.loopT=0;
		Game.fps=30;
		
		Game.season=Game.baseSeason;
		
		Game.l=l('game');
		Game.wrapper=l('wrapper');
		Game.bounds=0;//rectangle defining screen limits (right,left,bottom,top) updated every logic frame
		
		TopBarOffset=32;
		if (!App) Game.wrapper.classList.add('onWeb');
		else {Game.wrapper.classList.add('offWeb');TopBarOffset=0;}
		
		if (Game.mobile==1)
		{
			Game.wrapper.className='mobile';
		}
		Game.clickStr=Game.touchEvents?'ontouchend':'onclick';
		
		l('versionNumber').innerHTML='v. '+Game.version.toFixed(3)+(!App?('<div id="httpsSwitch" style="cursor:pointer;display:inline-block;background:url(img/'+(Game.https?'lockOn':'lockOff')+'.webp);width:16px;height:16px;position:relative;top:4px;left:0px;margin:0px -2px;"></div>'):'')+(Game.beta?' <span style="color:#ff0;">beta</span>':'');
		
		if (!App)
		{
			if (Game.beta) {var me=l('linkVersionBeta');me.parentNode.removeChild(me);}
			else if (Game.version==1.0466) {var me=l('linkVersionOld');me.parentNode.removeChild(me);}
			else {var me=l('linkVersionLive');me.parentNode.removeChild(me);}
		}
		
		Game.lastActivity=Date.now();//reset on mouse move, key press or click
		
		//latency compensator stuff
		Game.time=Date.now();
		Game.accumulatedDelay=0;
		Game.delayTimeouts=0;//how many times we've gone over the timeout delay
		Game.catchupLogic=0;
		Game.fpsStartTime=0;
		Game.frameNumber=0;
		Game.currentFps=Game.fps;
		Game.previousFps=Game.currentFps;
		Game.getFps=function()
		{
			Game.frameNumber++;
			var currentTime=(Date.now()-Game.fpsStartTime )/1000;
			var result=Math.floor((Game.frameNumber/currentTime));
			if (currentTime>1)
			{
				Game.fpsStartTime=Date.now();
				Game.frameNumber=0;
			}
			return result;
		}
		
		Game.cookiesEarned=0;//all cookies earned during gameplay
		Game.cookies=0;//cookies
		Game.cookiesd=0;//cookies display
		Game.cookiesPs=1;//cookies per second (to recalculate with every new purchase)
		Game.cookiesPsRaw=0;//raw cookies per second
		Game.cookiesPsRawHighest=0;//highest raw cookies per second this ascension
		Game.cookiesReset=0;//cookies lost to resetting (used to determine prestige and heavenly chips)
		Game.cookieClicks=0;//+1 for each click on the cookie
		Game.goldenClicks=0;//+1 for each golden cookie clicked (all time)
		Game.goldenClicksLocal=0;//+1 for each golden cookie clicked (this game only)
		Game.missedGoldenClicks=0;//+1 for each golden cookie missed
		Game.handmadeCookies=0;//all the cookies made from clicking the cookie
		Game.milkProgress=0;//you gain a little bit for each achievement. Each increment of 1 is a different milk displayed.
		Game.milkH=Game.milkProgress/2;//milk height, between 0 and 1 (although should never go above 0.5)
		Game.milkHd=0;//milk height display
		Game.milkType=0;//custom milk
		Game.bgType=0;//custom background
		Game.chimeType=0;//golden cookie chime
		Game.prestige=0;//prestige level (recalculated depending on Game.cookiesReset)
		Game.heavenlyChips=0;//heavenly chips the player currently has
		Game.heavenlyChipsDisplayed=0;//ticks up or down to match Game.heavenlyChips
		Game.heavenlyChipsSpent=0;//heavenly chips spent on cookies, upgrades and such
		Game.heavenlyCookies=0;//how many cookies have we baked from chips (unused)
		Game.permanentUpgrades=[-1,-1,-1,-1,-1];
		Game.ascensionMode=0;//type of challenge run if any
		Game.resets=0;//reset counter
		Game.lumps=-1;//sugar lumps
		Game.lumpsTotal=-1;//sugar lumps earned across all playthroughs (-1 means they haven't even started yet)
		Game.lumpT=Date.now();//time when the current lump started forming
		Game.lumpRefill=0;//time left before a sugar lump can be used again (on minigame refills etc) in logic frames
		
		Game.makeSeed=function()
		{
			var chars='abcdefghijklmnopqrstuvwxyz'.split('');
			var str='';
			for (var i=0;i<5;i++){str+=choose(chars);}
			return str;
		}
		Game.seed=Game.makeSeed();//each run has its own seed, used for deterministic random stuff
		
		Game.volume=75;//sound volume
		Game.volumeMusic=50;//music volume
		
		Game.elderWrath=0;
		Game.elderWrathOld=0;
		Game.elderWrathD=0;
		Game.pledges=0;
		Game.pledgeT=0;
		Game.researchT=0;
		Game.nextResearch=0;
		Game.cookiesSucked=0;//cookies sucked by wrinklers
		Game.cpsSucked=0;//percent of CpS being sucked by wrinklers
		Game.wrinklersPopped=0;
		Game.santaLevel=0;
		Game.reindeerClicked=0;
		Game.seasonT=0;
		Game.seasonUses=0;
		Game.dragonLevel=0;
		Game.dragonAura=0;
		Game.dragonAura2=0;
		
		Game.fortuneGC=0;
		Game.fortuneCPS=0;
		
		Game.blendModesOn=(document.createElement('detect').style.mixBlendMode==='');
		
		Game.bg='';//background (grandmas and such)
		Game.bgFade='';//fading to background
		Game.bgR=0;//ratio (0 - not faded, 1 - fully faded)
		Game.bgRd=0;//ratio displayed
		
		Game.windowW=window.innerWidth;
		Game.windowH=window.innerHeight;
		Game.scale=1;
		
		window.addEventListener('resize',function(e)
		{
			Game.resize();
			if (App && App.onResize) App.onResize();
		});
		
		Game.resize=function()
		{
			var w=window.innerWidth;
			var h=window.innerHeight;
			
			var prevW=Game.windowW;
			var prevH=Game.windowH;
			
			var scale=Math.min(
				w/Math.max(Game.minLayoutW||800,w),
				h/Math.max(200,h)
			);
			Game.windowW=Math.floor(w/scale);
			Game.windowH=Math.floor(h/scale);
			if (scale!=1)
			{
				Game.wrapper.style.transform='scale('+(scale)+')';
				Game.wrapper.style.width=Game.windowW+'px';
				Game.wrapper.style.height=Game.windowH+'px';
			}
			else
			{
				Game.wrapper.style.removeProperty('transform');
				Game.wrapper.style.width='100%';
				Game.wrapper.style.height='100%';
			}
			Game.scale=scale;
			
			for (var i in Game.Objects)
			{
				var me=Game.Objects[i];
				me.toResize=true;
				if (me.minigame && me.minigame.onResize) me.minigame.onResize();
			}
			
			if (Game.getNewTicker)
			{
				if (prevW>=Game.tickerTooNarrow && Game.windowW<Game.tickerTooNarrow) Game.getNewTicker(true);
				else if (prevW<Game.tickerTooNarrow && Game.windowW>=Game.tickerTooNarrow) Game.getNewTicker(true);
			}
		}
		Game.resize();
		
		Game.startDate=parseInt(Date.now());//when we started playing
		Game.fullDate=parseInt(Date.now());//when we started playing (carries over with resets)
		Game.lastDate=parseInt(Date.now());//when we last saved the game (used to compute "cookies made since we closed the game" etc)
		
		Game.prefs=[];
		Game.DefaultPrefs=function()
		{
			Game.prefs.particles=1;//particle effects : falling cookies etc
			Game.prefs.numbers=1;//numbers that pop up when clicking the cookie
			Game.prefs.autosave=1;//save the game every minute or so
			Game.prefs.autoupdate=1;//send an AJAX request to the server every 30 minutes (note : ignored)
			Game.prefs.milk=1;//display milk
			Game.prefs.fancy=1;//CSS shadow effects (might be heavy on some browsers)
			Game.prefs.warn=0;//warn before closing the window
			Game.prefs.cursors=1;//display cursors
			Game.prefs.focus=1;//make the game refresh less frequently when off-focus
			Game.prefs.popups=0;//use old-style popups (no longer used)
			Game.prefs.format=0;//shorten numbers
			Game.prefs.notifs=0;//notifications fade faster
			Game.prefs.animate=1;//animate buildings
			Game.prefs.wobbly=1;//wobbly cookie
			Game.prefs.monospace=0;//alt monospace font for cookies
			Game.prefs.filters=1;//CSS filter effects (might be heavy on some browsers)
			Game.prefs.cookiesound=1;//use new cookie click sound
			Game.prefs.crates=0;//show crates around icons in stats
			Game.prefs.altDraw=0;//use requestAnimationFrame to update drawing instead of fixed 30 fps setTimeout
			Game.prefs.showBackupWarning=1;//if true, show a "Have you backed up your save?" message on save load; set to false when save is exported
			Game.prefs.extraButtons=1;//if true, show Mute buttons and the building master bar
			Game.prefs.askLumps=0;//if true, show a prompt before spending lumps
			Game.prefs.customGrandmas=1;//if true, show patreon names for grandmas
			Game.prefs.timeout=0;//if true, game may show pause screen when timed out
			Game.prefs.cloudSave=1;//if true and on Steam, save and load to cloud
			Game.prefs.bgMusic=1;//if true and on Steam, play music even when game isn't focused
			Game.prefs.notScary=0;//if true, make some of the scary stuff less scary ("eyebrow mode")
			Game.prefs.fullscreen=0;//if true, Steam game will be fullscreen
			Game.prefs.screenreader=0;//if true, add some DOM stuff to facilitate screenreader interaction (requires reload)
			Game.prefs.discordPresence=1;//if true and applicable, show game activity in Discord status
		}
		Game.DefaultPrefs();
		
		window.onbeforeunload=function(event)
		{
			if (Game.prefs && Game.prefs.warn)
			{
				if (typeof event=='undefined') event=window.event;
				if (event) event.returnValue=loc("Are you sure you want to close Cookie Clicker?");
			}
		}
		
		Game.Mobile=function()
		{
			if (!Game.mobile)
			{
				Game.wrapper.className='mobile';
				Game.mobile=1;
			}
			else
			{
				Game.wrapper.className='';
				Game.mobile=0;
			}
		}
		
		Game.showBackupWarning=function()
		{
			Game.Notify(loc("Back up your save!"),loc("Hello again! Just a reminder that you may want to back up your Cookie Clicker save every once in a while, just in case.<br>To do so, go to Options and hit \"Export save\" or \"Save to file\"!")+'<div class="line"></div><a style="float:right;" onclick="Game.prefs.showBackupWarning=0;==CLOSETHIS()==">'+loc("Don't show this again")+'</a>',[25,7]);
		}
		
		
		
		
		/*=====================================================================================
		BAKERY NAME
		=======================================================================================*/
		Game.RandomBakeryName=function()
		{
			var str='';
			if (EN)
			{
				return (Math.random()>0.05?(choose(['Magic','Fantastic','Fancy','Sassy','Snazzy','Pretty','Cute','Pirate','Ninja','Zombie','Robot','Radical','Urban','Cool','Hella','Sweet','Awful','Double','Triple','Turbo','Techno','Disco','Electro','Dancing','Wonder','Mutant','Space','Science','Medieval','Future','Captain','Bearded','Lovely','Tiny','Big','Fire','Water','Frozen','Metal','Plastic','Solid','Liquid','Moldy','Shiny','Happy','Happy Little','Slimy','Tasty','Delicious','Hungry','Greedy','Lethal','Professor','Doctor','Power','Chocolate','Crumbly','Choklit','Righteous','Glorious','Mnemonic','Psychic','Frenetic','Hectic','Crazy','Royal','El','Von'])+' '):'Mc')+choose(['Cookie','Biscuit','Muffin','Scone','Cupcake','Pancake','Chip','Sprocket','Gizmo','Puppet','Mitten','Sock','Teapot','Mystery','Baker','Cook','Grandma','Click','Clicker','Spaceship','Factory','Portal','Machine','Experiment','Monster','Panic','Burglar','Bandit','Booty','Potato','Pizza','Burger','Sausage','Meatball','Spaghetti','Macaroni','Kitten','Puppy','Giraffe','Zebra','Parrot','Dolphin','Duckling','Sloth','Turtle','Goblin','Pixie','Gnome','Computer','Pirate','Ninja','Zombie','Robot']);
			}
			else
			{
				if (locStrings["bakery random name, 1st half"] && locStrings["bakery random name, 2nd half"]) str+=choose(loc("bakery random name, 1st half"))+' '+choose(loc("bakery random name, 2nd half"));
				else str+=choose(loc("bakery random name"));
			}
			return str;
		}
		Game.GetBakeryName=function() {return Game.RandomBakeryName();}
		Game.bakeryNameL=l('bakeryName');
		Game.bakeryNameSet=function(what)
		{
			try
			{
				var exp=new RegExp('[^\'\\-_0-9 \\p{L}]','gu');
				Game.bakeryName=what.replace(exp,' ');
				//Game.bakeryName=what.replace(/[^'\-_0-9 \p{L}]/gu,' ');
				Game.bakeryName=Game.bakeryName.trim().substring(0,28);
			}
			catch(e)
			{
				var exp=new RegExp('\W+','g');
				Game.bakeryName=what.replace(exp,' ');
				//Game.bakeryName=what.replace(/\W+/g,' ');
				Game.bakeryName=Game.bakeryName.substring(0,28);
			}
			Game.bakeryNameRefresh();
			if (Game.bakeryName=='RESTORE BACKUP' && App && App.restoreBackup) App.restoreBackup();
		}
		Game.bakeryNameRefresh=function()
		{
			var name=Game.bakeryName;
			if (EN) {if (name.slice(-1).toLowerCase()=='s') name+='\' bakery'; else name+='\'s bakery';}
			else name=loc("%1's bakery",name);
			Game.bakeryNameL.textContent=name;
			name=Game.bakeryName.toLowerCase();
			if (name=='orteil') Game.Win('God complex');
			if (!App && name.indexOf('saysopensesame',name.length-('saysopensesame').length)>0 && !Game.sesame) Game.OpenSesame();
			Game.recalculateGains=1;
		}
		Game.bakeryNamePrompt=function()
		{
			PlaySound('snd/tick.mp3');
			Game.Prompt('<id NameBakery><h3>'+loc("Name your bakery")+'</h3><div class="block" style="text-align:center;">'+loc("What should your bakery's name be?")+'</div><div class="block"><input type="text" style="text-align:center;width:100%;" id="bakeryNameInput" value="'+Game.bakeryName+'"/></div>',[[loc("Confirm"),'if (l(\'bakeryNameInput\').value.length>0) {Game.bakeryNameSet(l(\'bakeryNameInput\').value);Game.Win(\'What\\\'s in a name\');Game.ClosePrompt();}'],[loc("Random"),'Game.bakeryNamePromptRandom();'],loc("Cancel")]);
			l('bakeryNameInput').focus();
			l('bakeryNameInput').select();
		}
		Game.bakeryNamePromptRandom=function()
		{
			l('bakeryNameInput').value=Game.RandomBakeryName();
		}
		AddEvent(Game.bakeryNameL,'click',Game.bakeryNamePrompt);
		
		Game.bakeryNameSet(Game.GetBakeryName());
		
		/*=====================================================================================
		TOOLTIP
		=======================================================================================*/
		Game.tooltip={text:'',x:0,y:0,origin:'',on:0,tt:l('tooltip'),tta:l('tooltipAnchor'),shouldHide:1,dynamic:0,from:0};
		Game.tooltip.draw=function(from,text,origin)
		{
			this.shouldHide=0;
			this.text=text;
			this.from=from;
			//this.x=x;
			//this.y=y;
			this.origin=origin;
			var tt=this.tt;
			var tta=this.tta;
			tt.style.left='auto';
			tt.style.top='auto';
			tt.style.right='auto';
			tt.style.bottom='auto';
			if (typeof this.text==='function')
			{
				var text=this.text();
				if (text=='') tta.style.opacity='0';
				else
				{
					tt.innerHTML=unescape(text);
					tta.style.opacity='1';
				}
			}
			else tt.innerHTML=unescape(this.text);
			//tt.innerHTML=(typeof this.text==='function')?unescape(this.text()):unescape(this.text);
			tta.style.display='block';
			tta.style.visibility='hidden';
			Game.tooltip.update();
			tta.style.visibility='visible';
			this.on=1;
		}
		Game.tooltip.update=function()
		{
			var X=0;
			var Y=0;
			var width=this.tt.offsetWidth;
			var height=this.tt.offsetHeight;
			if (this.origin=='store')
			{
				X=Game.windowW-332-width;
				Y=Game.mouseY-32;
				if (Game.onCrate) Y=Game.onCrate.getBounds().top-42;
				Y=Math.max(0,Math.min(Game.windowH-height-44,Y));
				/*this.tta.style.right='308px';//'468px';
				this.tta.style.left='auto';
				if (Game.onCrate) Y=Game.onCrate.getBounds().top-2;
				this.tta.style.top=Math.max(0,Math.min(Game.windowH-this.tt.clientHeight-64,Y-48))+'px';*/
			}
			else
			{
				if (Game.onCrate)
				{
					var rect=Game.onCrate.getBounds();
					if (rect.left==0 && rect.top==0)//if we get that bug where we get stuck in the top-left, move to the mouse (REVISION : just do nothing)
					{return false;/*rect.left=Game.mouseX-24;rect.right=Game.mouseX+24;rect.top=Game.mouseY-24;rect.bottom=Game.mouseY+24;*/}
					if (this.origin=='left')
					{
						X=rect.left-width-16;
						Y=rect.top+(rect.bottom-rect.top)/2-height/2-38;
						Y=Math.max(0,Math.min(Game.windowH-height-19,Y));
						if (X<0) X=rect.right;
					}
					else
					{
						X=rect.left+(rect.right-rect.left)/2-width/2-8;
						Y=rect.top-height-TopBarOffset-16;
						X=Math.max(0,Math.min(Game.windowW-width-16,X));
						if (Y<0) Y=rect.bottom-TopBarOffset;
					}
				}
				else if (this.origin=='bottom-right')
				{
					X=Game.mouseX+8;
					Y=Game.mouseY-32;
					X=Math.max(0,Math.min(Game.windowW-width-16,X));
					Y=Math.max(0,Math.min(Game.windowH-height-64,Y));
				}
				else if (this.origin=='bottom')
				{
					X=Game.mouseX-width/2-8;
					Y=Game.mouseY+24;
					X=Math.max(0,Math.min(Game.windowW-width-16,X));
					Y=Math.max(0,Math.min(Game.windowH-height-64,Y));
				}
				else if (this.origin=='left')
				{
					X=Game.mouseX-width-24;
					Y=Game.mouseY-height/2-8;
					X=Math.max(0,Math.min(Game.windowW-width-16,X));
					Y=Math.max(0,Math.min(Game.windowH-height-64,Y));
				}
				else if (this.origin=='this' && this.from)
				{
					var rect=this.from.getBounds();
					X=(rect.left+rect.right)/2-width/2-8;
					Y=(rect.top)-this.tt.clientHeight-48;
					X=Math.max(0,Math.min(Game.windowW-width-16,X));
					//Y=Math.max(0,Math.min(Game.windowH-this.tt.clientHeight-64,Y));
					if (Y<0) Y=(rect.bottom-24);
					if (Y+height+40>Game.windowH)
					{
						X=rect.right+8;
						Y=rect.top+(rect.bottom-rect.top)/2-height/2-38;
						Y=Math.max(0,Math.min(Game.windowH-height-19,Y));
					}
				}
				else
				{
					X=Game.mouseX-width/2-8;
					Y=Game.mouseY-height-32;
					X=Math.max(0,Math.min(Game.windowW-width-16,X));
					Y=Math.max(0,Math.min(Game.windowH-height-64,Y));
				}
			}
			this.tta.style.left=X+'px';
			this.tta.style.right='auto';
			this.tta.style.top=Y+'px';
			this.tta.style.bottom='auto';
			if (this.shouldHide) {this.hide();this.shouldHide=0;}
			else if (Game.drawT%10==0 && typeof(this.text)==='function')
			{
				var text=this.text();
				if (text=='') this.tta.style.opacity='0';
				else
				{
					this.tt.innerHTML=unescape(text);
					this.tta.style.opacity='1';
				}
			}
		}
		Game.tooltip.hide=function()
		{
			if (this.tta) this.tta.style.display='none';
			this.dynamic=0;
			this.on=0;
		}
		Game.getTooltip=function(text,origin,isCrate)
		{
			origin=(origin?origin:'middle');
			if (isCrate) return 'onMouseOut="Game.setOnCrate(0);Game.tooltip.shouldHide=1;" onMouseOver="if (!Game.mouseDown) {Game.setOnCrate(this);Game.tooltip.dynamic=0;Game.tooltip.draw(this,\''+escape(text)+'\',\''+origin+'\');Game.tooltip.wobble();}"';
			else return 'onMouseOut="Game.tooltip.shouldHide=1;" onMouseOver="Game.tooltip.dynamic=0;Game.tooltip.draw(this,\''+escape(text)+'\',\''+origin+'\');Game.tooltip.wobble();"';
		}
		Game.getDynamicTooltip=function(func,origin,isCrate)
		{
			origin=(origin?origin:'middle');
			if (isCrate) return 'onMouseOut="Game.setOnCrate(0);Game.tooltip.shouldHide=1;" onMouseOver="if (!Game.mouseDown) {Game.setOnCrate(this);Game.tooltip.dynamic=1;Game.tooltip.draw(this,'+'function(){return '+func+'();}'+',\''+origin+'\');Game.tooltip.wobble();}"';
			return 'onMouseOut="Game.tooltip.shouldHide=1;" onMouseOver="Game.tooltip.dynamic=1;Game.tooltip.draw(this,'+'function(){return '+func+'();}'+',\''+origin+'\');Game.tooltip.wobble();"';
		}
		Game.attachTooltip=function(el,func,origin)
		{
			if (typeof func==='string')
			{
				var str=func;
				func=function(str){return function(){return str;};}(str);
			}
			origin=(origin?origin:'middle');
			AddEvent(el,'mouseover',function(func,el,origin){return function(){Game.tooltip.dynamic=1;Game.tooltip.draw(el,func,origin);};}(func,el,origin));
			AddEvent(el,'mouseout',function(){return function(){Game.tooltip.shouldHide=1;};}());
		}
		Game.tooltip.wobble=function()
		{
			//disabled because this effect doesn't look good with the slight slowdown it might or might not be causing.
			if (false)
			{
				this.tt.className='framed';
				void this.tt.offsetWidth;
				this.tt.className='framed wobbling';
			}
		}
		
		
		/*=====================================================================================
		UPDATE CHECKER
		=======================================================================================*/
		Game.CheckUpdates=function()
		{
			if (!App) ajax('server.php?q=checkupdate',Game.CheckUpdatesResponse);
		}
		Game.CheckUpdatesResponse=function(response)
		{
			var r=response.split('|');
			var str='';
			if (r[0]=='alert')
			{
				if (r[1]) str=r[1];
			}
			else if (parseFloat(r[0])>Game.version)
			{
				str='<b>'+loc("New version available: v. %1!",r[0])+'</b>';
				if (r[1]) str+='<br><small>'+loc("Update note: \"%1\"",r[1])+'</small>';
				str+='<br><b>'+loc("Refresh to get it!")+'</b>';
			}
			if (str!='')
			{
				l('alert').innerHTML=str;
				l('alert').style.display='block';
			}
		}
		
		/*=====================================================================================
		DATA GRABBER
		=======================================================================================*/
		
		Game.externalDataLoaded=false;
		
		Game.grandmaNames=['Granny','Gusher','Ethel','Edna','Doris','Maud','Hilda','Gladys','Michelle','Michele','Phyllis','Millicent','Muriel','Myrtle','Mildred','Mavis','Helen','Gloria','Sheila','Betty','Gertrude','Agatha','Beryl','Agnes','Pearl','Precious','Ruby','Vera','Bonnie','Ada','Bunny','Cookie','Darling','Gaga','GamGam','Memaw','Mimsy','Peanut','Nana','Nan','Tootsie','Warty','Stinky','Heinous'];
		Game.customGrandmaNames=[];
		Game.heralds=0;
		
		Game.GrabData=function()
		{
			if (!App) ajax('grab.txt',Game.GrabDataResponse);
			else App.grabData(function(res){
				Game.heralds=res?(res.playersN||1):1;
				Game.heralds=Math.max(0,Math.min(100,Math.ceil(Game.heralds/100*100)/100));
				l('heraldsAmount').textContent=Math.floor(Game.heralds);
			});
		}
		Game.GrabDataResponse=function(response)
		{
			/*
				response should be formatted as
				{"herald":3,"grandma":"a|b|c|...}
			*/
			var r={};
			try{
				r=JSON.parse(response);
				if (typeof r['herald']!=='undefined')
				{
					Game.heralds=parseInt(r['herald']);
					Game.heralds=Math.max(0,Math.min(100,Game.heralds));
				}
				if (typeof r['grandma']!=='undefined' && r['grandma']!='')
				{
					Game.customGrandmaNames=r['grandma'].split('|');
					Game.customGrandmaNames=Game.customGrandmaNames.filter(function(el){return el!='';});
				}
				
				l('heraldsAmount').textContent=Math.floor(Game.heralds);
				Game.externalDataLoaded=true;
			}catch(e){}
		}
		
		
		if (!App)
		{
			Game.attachTooltip(l('httpsSwitch'),'<div style="padding:8px;width:350px;text-align:center;font-size:11px;">'+loc("You are currently playing Cookie Clicker on the <b>%1</b> protocol.<br>The <b>%2</b> version uses a different save slot than this one.<br>Click this lock to reload the page and switch to the <b>%2</b> version!",[(Game.https?'HTTPS':'HTTP'),(Game.https?'HTTP':'HTTPS')])+'</div>','this');
			AddEvent(l('httpsSwitch'),'click',function(){
				PlaySound('snd/pop'+Math.floor(Math.random()*3+1)+'.mp3',0.75);
				if (location.protocol=='https:') location.href='http:'+window.location.href.substring(window.location.protocol.length);
				else if (location.protocol=='http:') location.href='https:'+window.location.href.substring(window.location.protocol.length);
			});
			
			AddEvent(l('changeLanguage'),'click',function()
			{
				Game.showLangSelection();
			});
			
			Game.attachTooltip(l('topbarOrteil'),'<div style="padding:8px;width:250px;text-align:center;">Back to Orteil\'s subdomain!<br>Lots of other games in there!</div>'+tinyIcon([17,5],'display:block;margin:-12px auto;'),'this');
			Game.attachTooltip(l('topbarDashnet'),'<div style="padding:8px;width:250px;text-align:center;">Back to our homepage!</div>','this');
			Game.attachTooltip(l('topbarTwitter'),'<div style="padding:8px;width:250px;text-align:center;">Orteil\'s twitter, which frequently features game updates.</div>','this');
			Game.attachTooltip(l('topbarTumblr'),'<div style="padding:8px;width:250px;text-align:center;">Orteil\'s tumblr, which frequently features game updates.</div>','this');
			Game.attachTooltip(l('topbarDiscord'),'<div style="padding:8px;width:250px;text-align:center;">Our official discord server.<br>You can share tips and questions about Cookie Clicker and all our other games!</div>','this');
			Game.attachTooltip(l('topbarPatreon'),'<div style="padding:8px;width:250px;text-align:center;">Support us on Patreon and help us keep updating Cookie Clicker!<br>There\'s neat rewards for patrons too!</div>','this');
			Game.attachTooltip(l('topbarMerch'),'<div style="padding:8px;width:250px;text-align:center;">Cookie Clicker shirts, hoodies and stickers!</div>','this');
			Game.attachTooltip(l('topbarMobileCC'),'<div style="padding:8px;width:250px;text-align:center;">Play Cookie Clicker on your phone!<br>(Android only; iOS version will be released later)</div>','this');
			Game.attachTooltip(l('topbarSteamCC'),'<div style="padding:8px;width:250px;text-align:center;">Get Cookie Clicker on Steam!<br>Featuring music by C418.</div>','this');
			Game.attachTooltip(l('topbarRandomgen'),'<div style="padding:8px;width:250px;text-align:center;">Check for updates!<br>{Current Version: 1.1.0}</div>','this');
			Game.attachTooltip(l('topbarIGM'),'<div style="padding:8px;width:250px;text-align:center;">Go and check out the creator of this downloadable version!<br>(Subscribe while your at it. :)</div>','this');
			l('changeLanguage').innerHTML=loc("Change language");
			l('links').childNodes[0].nodeValue=loc("Other versions");
			//l('linkVersionBeta').innerHTML=loc("Beta");
		}
		
		Game.attachTooltip(l('heralds'),function(){
			var str='';
			
			if (!App && !Game.externalDataLoaded) str+=loc("Heralds couldn't be loaded. There may be an issue with our servers, or you are playing the game locally.");
			else
			{
				if (!App && Game.heralds==0) str+=loc("There are no heralds at the moment. Please consider <b style=\"color:#bc3aff;\">donating to our Patreon</b>!");
				else
				{
					str+='<b style="color:#bc3aff;text-shadow:0px 1px 0px #6d0096;">'+loc("%1 herald",Game.heralds)+'</b> '+loc("selflessly inspiring a boost in production for everyone, resulting in %1.",'<br><b style="color:#cdaa89;text-shadow:0px 1px 0px #7c4532,0px 0px 6px #7c4532;"><div style="width:16px;height:16px;display:inline-block;vertical-align:middle;background:url(img/money.webp);"></div>'+loc("+%1% cookies per second",Game.heralds)+'</b>');
					str+='<div class="line"></div>';
					if (Game.ascensionMode==1) str+=loc("You are in a <b>Born again</b> run, and are not currently benefiting from heralds.");
					else if (Game.Has('Heralds')) str+=loc("You own the <b>Heralds</b> upgrade, and therefore benefit from the production boost.");
					else str+=loc("To benefit from the herald bonus, you need a special upgrade you do not yet own. You will permanently unlock it later in the game.");
				}
			}
			str+='<div class="line"></div><span style="font-size:90%;opacity:0.6;">'+(!App?loc("<b>Heralds</b> are people who have donated to our highest Patreon tier, and are limited to 100.<br>Each herald gives everyone +1% CpS.<br>Heralds benefit everyone playing the game, regardless of whether you donated."):loc("Every %1 current players on Steam generates <b>1 herald</b>, up to %2 heralds.<br>Each herald gives everyone +1% CpS.",[100,100]))+'</span><div class="line"></div>'+tinyIcon([21,29]);
			
			str+='<div style="width:31px;height:39px;background:url(img/heraldFlag.webp);position:absolute;top:0px;left:8px;"></div><div style="width:31px;height:39px;background:url(img/heraldFlag.webp);position:absolute;top:0px;right:8px;"></div>';
			
			return '<div style="padding:8px;width:300px;text-align:center;" class="prompt" id="tooltipHeralds"><h3>'+loc("Heralds")+'</h3><div class="block">'+str+'</div></div>';
		},'this');
		l('heraldsAmount').textContent='?';
		l('heralds').style.display='inline-block';
		if (App)
		{
			l('heralds').style.paddingTop='4px';
			l('heralds').style.position='absolute';
			l('heralds').style.top='0px';
			l('heralds').style.right='0px';
			l('heralds').style.width='28px';
			l('heralds').style.textAlign='center';
			l('leftBeam').appendChild(l('heralds'));
			
			l('buffs').style.top='16px';
		}
		
		Game.GrabData();
		
		
		Game.useLocalStorage=1;
		//window.localStorage.clear();//won't switch back to cookie-based if there is localStorage info
		
		/*=====================================================================================
		SAVE
		=======================================================================================*/
		Game.ExportSave=function()
		{
			//if (App) return false;
			Game.prefs.showBackupWarning=0;
			Game.Prompt('<id ExportSave><h3>'+loc("Export save")+'</h3><div class="block">'+loc("This is your save code.<br>Copy it and keep it somewhere safe!")+'</div><div class="block"><textarea id="textareaPrompt" style="width:100%;height:128px;" readonly>'+Game.WriteSave(1)+'</textarea></div>',[loc("All done!")]);//prompt('Copy this text and keep it somewhere safe!',Game.WriteSave(1));
			l('textareaPrompt').focus();l('textareaPrompt').select();
		}
		Game.ImportSave=function(def)
		{
			//if (App) return false;
		Game.Prompt('<id ImportSave><h3>'+loc("Import save")+'</h3><div class="block">'+loc("Please paste in the code that was given to you on save export.")+'<div id="importError" class="warning" style="font-weight:bold;font-size:11px;"></div></div><div class="block"><textarea id="textareaPrompt" style="width:100%;height:128px;">'+(def||'')+'</textarea></div>',[[loc("Load"),'if (l(\'textareaPrompt\').value.length==0){return false;}if (Game.ImportSaveCode(l(\'textareaPrompt\').value)){Game.ClosePrompt();}else{l(\'importError\').innerHTML=\'(\'+loc("Error importing save")+\')\';}'],loc("Nevermind")]);//prompt('Please paste in the text that was given to you on save export.','');
			l('textareaPrompt').focus();
		}
		Game.ImportSaveCode=function(save)
		{
			var out=false;
			if (save && save!='') out=Game.LoadSave(save);
			if (out && App && App.onImportSave) App.onImportSave(out,save);
			return out;
		}
		
		Game.FileSave=function()
		{
			if (App) return false;
			Game.prefs.showBackupWarning=0;
			var filename=Game.bakeryName.replace(/[^a-zA-Z0-9]+/g,'')+'Bakery';
			var text=Game.WriteSave(1);
			var blob=new Blob([text],{type:'text/plain;charset=utf-8'});
			saveAs(blob,filename+'.txt');
		}
		Game.FileLoad=function(e)
		{
			if (App) return false;
			if (e.target.files.length==0) return false;
			var file=e.target.files[0];
			var reader=new FileReader();
			reader.onload=function(e)
			{
				Game.ImportSaveCode(e.target.result);
			}
			reader.readAsText(file);
		}
		
		
		Game.toReload=false;
		Game.toSave=false;
		Game.toQuit=false;
		Game.isSaving=false;//true while we're saving, to block some behavior; when in App mode saving may be asynchronous
		Game.lastSaveData='';
		Game.WriteSave=function(type)
		{
			Game.toSave=false;
			//type: none is default, 1=return string only, 2=return uncompressed string, 3=return uncompressed, commented string
			Game.lastDate=parseInt(Game.time);
			var str='';
			if (type==3) str+='\nGame version\n';
			str+=Game.version+'|';
			str+='|';//just in case we need some more stuff here
			if (type==3) str+='\n\nRun details';
			str+=//save stats
			(type==3?'\n	run start date : ':'')+parseInt(Game.startDate)+';'+
			(type==3?'\n	legacy start date : ':'')+parseInt(Game.fullDate)+';'+
			(type==3?'\n	date when we last opened the game : ':'')+parseInt(Game.lastDate)+';'+
			(type==3?'\n	bakery name : ':'')+(Game.bakeryName)+';'+
			(type==3?'\n	seed : ':'')+(Game.seed)+
			'|';
			if (type==3) str+='\n\nPacked preferences bitfield\n	';
			var str2=//prefs
			(Game.prefs.particles?'1':'0')+
			(Game.prefs.numbers?'1':'0')+
			(Game.prefs.autosave?'1':'0')+
			(Game.prefs.autoupdate?'1':'0')+
			(Game.prefs.milk?'1':'0')+
			(Game.prefs.fancy?'1':'0')+
			(Game.prefs.warn?'1':'0')+
			(Game.prefs.cursors?'1':'0')+
			(Game.prefs.focus?'1':'0')+
			(Game.prefs.format?'1':'0')+
			(Game.prefs.notifs?'1':'0')+
			(Game.prefs.wobbly?'1':'0')+
			(Game.prefs.monospace?'1':'0')+
			(Game.prefs.filters?'1':'0')+
			(Game.prefs.cookiesound?'1':'0')+
			(Game.prefs.crates?'1':'0')+
			(Game.prefs.showBackupWarning?'1':'0')+
			(Game.prefs.extraButtons?'1':'0')+
			(Game.prefs.askLumps?'1':'0')+
			(Game.prefs.customGrandmas?'1':'0')+
			(Game.prefs.timeout?'1':'0')+
			(Game.prefs.cloudSave?'1':'0')+
			(Game.prefs.bgMusic?'1':'0')+
			(Game.prefs.notScary?'1':'0')+
			(Game.prefs.fullscreen?'1':'0')+
			(Game.prefs.screenreader?'1':'0')+
			(Game.prefs.discordPresence?'1':'0')+
			'';
			str2=pack3(str2);
			str+=str2+'|';
			if (type==3) str+='\n\nMisc game data';
			str+=
			(type==3?'\n	cookies : ':'')+parseFloat(Game.cookies).toString()+';'+
			(type==3?'\n	total cookies earned : ':'')+parseFloat(Game.cookiesEarned).toString()+';'+
			(type==3?'\n	cookie clicks : ':'')+parseInt(Math.floor(Game.cookieClicks))+';'+
			(type==3?'\n	golden cookie clicks : ':'')+parseInt(Math.floor(Game.goldenClicks))+';'+
			(type==3?'\n	cookies made by clicking : ':'')+parseFloat(Game.handmadeCookies).toString()+';'+
			(type==3?'\n	golden cookies missed : ':'')+parseInt(Math.floor(Game.missedGoldenClicks))+';'+
			(type==3?'\n	background type : ':'')+parseInt(Math.floor(Game.bgType))+';'+
			(type==3?'\n	milk type : ':'')+parseInt(Math.floor(Game.milkType))+';'+
			(type==3?'\n	cookies from past runs : ':'')+parseFloat(Game.cookiesReset).toString()+';'+
			(type==3?'\n	elder wrath : ':'')+parseInt(Math.floor(Game.elderWrath))+';'+
			(type==3?'\n	pledges : ':'')+parseInt(Math.floor(Game.pledges))+';'+
			(type==3?'\n	pledge time left : ':'')+parseInt(Math.floor(Game.pledgeT))+';'+
			(type==3?'\n	currently researching : ':'')+parseInt(Math.floor(Game.nextResearch))+';'+
			(type==3?'\n	research time left : ':'')+parseInt(Math.floor(Game.researchT))+';'+
			(type==3?'\n	ascensions : ':'')+parseInt(Math.floor(Game.resets))+';'+
			(type==3?'\n	golden cookie clicks (this run) : ':'')+parseInt(Math.floor(Game.goldenClicksLocal))+';'+
			(type==3?'\n	cookies sucked by wrinklers : ':'')+parseFloat(Game.cookiesSucked).toString()+';'+
			(type==3?'\n	wrinkles popped : ':'')+parseInt(Math.floor(Game.wrinklersPopped))+';'+
			(type==3?'\n	santa level : ':'')+parseInt(Math.floor(Game.santaLevel))+';'+
			(type==3?'\n	reindeer clicked : ':'')+parseInt(Math.floor(Game.reindeerClicked))+';'+
			(type==3?'\n	season time left : ':'')+parseInt(Math.floor(Game.seasonT))+';'+
			(type==3?'\n	season switcher uses : ':'')+parseInt(Math.floor(Game.seasonUses))+';'+
			(type==3?'\n	current season : ':'')+(Game.season?Game.season:'')+';';
			var wrinklers=Game.SaveWrinklers();
			str+=
			(type==3?'\n	amount of cookies contained in wrinklers : ':'')+parseFloat(Math.floor(wrinklers.amount))+';'+
			(type==3?'\n	number of wrinklers : ':'')+parseInt(Math.floor(wrinklers.number))+';'+
			(type==3?'\n	prestige level : ':'')+parseFloat(Game.prestige).toString()+';'+
			(type==3?'\n	heavenly chips : ':'')+parseFloat(Game.heavenlyChips).toString()+';'+
			(type==3?'\n	heavenly chips spent : ':'')+parseFloat(Game.heavenlyChipsSpent).toString()+';'+
			(type==3?'\n	heavenly cookies : ':'')+parseFloat(Game.heavenlyCookies).toString()+';'+
			(type==3?'\n	ascension mode : ':'')+parseInt(Math.floor(Game.ascensionMode))+';'+
			(type==3?'\n	permanent upgrades : ':'')+parseInt(Math.floor(Game.permanentUpgrades[0]))+';'+parseInt(Math.floor(Game.permanentUpgrades[1]))+';'+parseInt(Math.floor(Game.permanentUpgrades[2]))+';'+parseInt(Math.floor(Game.permanentUpgrades[3]))+';'+parseInt(Math.floor(Game.permanentUpgrades[4]))+';'+
			(type==3?'\n	dragon level : ':'')+parseInt(Math.floor(Game.dragonLevel))+';'+
			(type==3?'\n	dragon aura : ':'')+parseInt(Math.floor(Game.dragonAura))+';'+
			(type==3?'\n	dragon aura 2 : ':'')+parseInt(Math.floor(Game.dragonAura2))+';'+
			(type==3?'\n	chime type : ':'')+parseInt(Math.floor(Game.chimeType))+';'+
			(type==3?'\n	volume : ':'')+parseInt(Math.floor(Game.volume))+';'+
			(type==3?'\n	number of shiny wrinklers : ':'')+parseInt(Math.floor(wrinklers.shinies))+';'+
			(type==3?'\n	amount of cookies contained in shiny wrinklers : ':'')+parseFloat(Math.floor(wrinklers.amountShinies))+';'+
			(type==3?'\n	current amount of sugar lumps : ':'')+parseFloat(Math.floor(Game.lumps))+';'+
			(type==3?'\n	total amount of sugar lumps made : ':'')+parseFloat(Math.floor(Game.lumpsTotal))+';'+
			(type==3?'\n	time when current sugar lump started : ':'')+parseFloat(Math.floor(Game.lumpT))+';'+
			(type==3?'\n	time when last refilled a minigame with a sugar lump : ':'')+parseFloat(Math.floor(Game.lumpRefill))+';'+
			(type==3?'\n	sugar lump type : ':'')+parseInt(Math.floor(Game.lumpCurrentType))+';'+
			(type==3?'\n	vault : ':'')+Game.vault.join(',')+';'+
			(type==3?'\n	heralds : ':'')+parseInt(Game.heralds)+';'+
			(type==3?'\n	golden cookie fortune : ':'')+parseInt(Game.fortuneGC)+';'+
			(type==3?'\n	CpS fortune : ':'')+parseInt(Game.fortuneCPS)+';'+
			(type==3?'\n	highest raw CpS : ':'')+parseFloat(Game.cookiesPsRawHighest)+';'+
			(type==3?'\n	music volume : ':'')+parseInt(Math.floor(Game.volumeMusic))+';'+
			
			'|';//cookies and lots of other stuff
			
			if (type==3) str+='\n\nBuildings : amount, bought, cookies produced, level, minigame data';
			for (var i in Game.Objects)//buildings
			{
				var me=Game.Objects[i];
				if (type==3) str+='\n	'+me.name+' : ';
				if (me.vanilla)
				{
					str+=me.amount+','+me.bought+','+parseFloat(Math.floor(me.totalCookies))+','+parseInt(me.level);
					if (Game.isMinigameReady(me)) str+=','+me.minigame.save(); else str+=','+(me.minigameSave||'');
					str+=','+(me.muted?'1':'0');
					str+=','+me.highest;
					str+=';';
				}
			}
			str+='|';
			if (type==3) str+='\n\nPacked upgrades bitfield (unlocked and bought)\n	';
			var toCompress=[];
			for (var i in Game.UpgradesById)//upgrades
			{
				var me=Game.UpgradesById[i];
				if (me.vanilla) toCompress.push(Math.min(me.unlocked,1),Math.min(me.bought,1));
			};
			
			toCompress=pack3(toCompress.join(''));//toCompress=pack(toCompress);//CompressLargeBin(toCompress);
			
			str+=toCompress;
			str+='|';
			if (type==3) str+='\n\nPacked achievements bitfield (won)\n	';
			var toCompress=[];
			for (var i in Game.AchievementsById)//achievements
			{
				var me=Game.AchievementsById[i];
				if (me.vanilla) toCompress.push(Math.min(me.won));
			}
			toCompress=pack3(toCompress.join(''));//toCompress=pack(toCompress);//CompressLargeBin(toCompress);
			str+=toCompress;
			
			str+='|';
			if (type==3) str+='\n\nBuffs : type, maxTime, time, arg1, arg2, arg3';
			for (var i in Game.buffs)
			{
				var me=Game.buffs[i];
				if (me.type)
				{
					if (type==3) str+='\n	'+me.type.name+' : ';
					if (me.type.vanilla)
					{
						str+=me.type.id+','+me.maxTime+','+me.time;
						if (typeof me.arg1!=='undefined') str+=','+parseFloat(me.arg1);
						if (typeof me.arg2!=='undefined') str+=','+parseFloat(me.arg2);
						if (typeof me.arg3!=='undefined') str+=','+parseFloat(me.arg3);
						str+=';';
					}
				}
			}
			
			
			if (type==3) str+='\n\nCustom :\n';
			
			str+='|';
			str+=Game.saveModData();
			
			Game.lastSaveData=str;
			
			if (type==2 || type==3)
			{
				return str;
			}
			else if (type==1)
			{
				str=escape(utf8_to_b64(str)+'!END!');
				return str;
			}
			else
			{
				if (Game.useLocalStorage)
				{
					//so we used to save the game using browser cookies, which was just really neat considering the game's name
					//we're using localstorage now, which is more efficient but not as cool
					//a moment of silence for our fallen puns
					str=utf8_to_b64(str)+'!END!';
					if (str.length<10)
					{
						Game.Notify('Saving failed!','Purchasing an upgrade and saving again might fix this.<br>This really shouldn\'t happen; please notify Orteil on his tumblr.');
					}
					else
					{
						str=escape(str);
						localStorageSet(Game.SaveTo,str);//aaand save
						if (App) App.save(str);
						if (!localStorageGet(Game.SaveTo))
						{
							Game.Notify(loc("Error while saving"),loc("Export your save instead!"));
						}
						else if (document.hasFocus())
						{
							Game.Notify(loc("Game saved"),'','',1,1);
						}
					}
				}
				else//legacy system
				{
					//that's right
					//we're using cookies
					//yeah I went there
					var now=new Date();//we storin dis for 5 years, people
					now.setFullYear(now.getFullYear()+5);//mmh stale cookies
					str=utf8_to_b64(str)+'!END!';
					Game.saveData=escape(str);
					str=Game.SaveTo+'='+escape(str)+'; expires='+now.toUTCString()+';';
					document.cookie=str;//aaand save
					if (App) App.save(str);
					if (document.cookie.indexOf(Game.SaveTo)<0)
					{
						Game.Notify(loc("Error while saving"),loc("Export your save instead!"),'',0,1);
					}
					else if (document.hasFocus())
					{
						Game.Notify(loc("Game saved"),'','',1,1);
					}
				}
			}
		}
		
		/*=====================================================================================
		LOAD
		=======================================================================================*/
		Game.salvageSave=function()
		{
			//for when Cookie Clicker won't load and you need your save
			console.log('===================================================');
			console.log('This is your save data. Copypaste it (without quotation marks) into another version using the "Import save" feature.');
			console.log(localStorageGet(Game.SaveTo));
		}
		Game.LoadSave=function(data,ignoreVersionIssues)
		{
			var str='';
			if (typeof data!=='undefined') str=unescape(data);
			else
			{
				if (App)
				{
					App.getMostRecentSave(function(data){Game.LoadSave(data,true);});
					return false;
				}
				if (Game.useLocalStorage)
				{
					var local=localStorageGet(Game.SaveTo);
					if (!local)//no localstorage save found? let's get the cookie one last time
					{
						if (document.cookie.indexOf(Game.SaveTo)>=0)
						{
							str=unescape(document.cookie.split(Game.SaveTo+'=')[1]);
							document.cookie=Game.SaveTo+'=;expires=Thu, 01 Jan 1970 00:00:01 GMT;';
						}
						else return false;
					}
					else
					{
						str=unescape(local);
					}
				}
				else//legacy system
				{
					if (document.cookie.indexOf(Game.SaveTo)>=0) str=unescape(document.cookie.split(Game.SaveTo+'=')[1]);//get cookie here
					else return false;
				}
			}
			if (str!='')
			{
				var version=0;
				var oldstr=str.split('|');
				if (oldstr[0].length<1) return false;
				else
				{
					str=str.split('!END!')[0];
					str=b64_to_utf8(str);
				}
				if (str=='') return false;
				else
				{
					var spl='';
					str=str.split('|');
					version=parseFloat(str[0]);
					Game.loadedFromVersion=version;
					
					if (isNaN(version) || str.length<5)
					{
						Game.Notify(loc("Error importing save"),loc("Oops, looks like the import string is all wrong!"),'',6,1);
						return false;
					}
					if (version>=1 && version>Game.version)
					{
						if (ignoreVersionIssues) Game.Notify('Retrieving save from a future version.','That\'s...odd.','',0,1);
						else
						{
							Game.Notify(loc("Error importing save"),loc("You are attempting to load a save from a future version (v. %1; you are using v. %2).",[version,Game.version]),'',6,1);
							return false;
						}
					}
					if (version>=1)
					{
						Game.T=0;
						
						spl=str[2].split(';');//save stats
						Game.startDate=parseInt(spl[0]);
						Game.fullDate=parseInt(spl[1]);
						Game.lastDate=parseInt(spl[2]);
						var bakeryName=(spl[3]?spl[3]:Game.GetBakeryName());
						Game.seed=spl[4]?spl[4]:Game.makeSeed();
						//prefs
						if (version<1.0503) spl=str[3].split('');
						else if (version<2.0046) spl=unpack2(str[3]).split('');
						else spl=(str[3]).split('');
						Game.prefs.particles=parseInt(spl[0]);
						Game.prefs.numbers=parseInt(spl[1]);
						Game.prefs.autosave=parseInt(spl[2]);
						Game.prefs.autoupdate=spl[3]?parseInt(spl[3]):1;
						Game.prefs.milk=spl[4]?parseInt(spl[4]):1;
						Game.prefs.fancy=parseInt(spl[5]);if (Game.prefs.fancy) Game.removeClass('noFancy'); else if (!Game.prefs.fancy) Game.addClass('noFancy');
						Game.prefs.warn=spl[6]?parseInt(spl[6]):0;
						Game.prefs.cursors=spl[7]?parseInt(spl[7]):0;
						Game.prefs.focus=spl[8]?parseInt(spl[8]):0;
						Game.prefs.format=spl[9]?parseInt(spl[9]):0;
						Game.prefs.notifs=spl[10]?parseInt(spl[10]):0;
						Game.prefs.wobbly=spl[11]?parseInt(spl[11]):0;
						Game.prefs.monospace=spl[12]?parseInt(spl[12]):0;
						Game.prefs.filters=spl[13]?parseInt(spl[13]):1;if (Game.prefs.filters) Game.removeClass('noFilters'); else if (!Game.prefs.filters) Game.addClass('noFilters');
						Game.prefs.cookiesound=spl[14]?parseInt(spl[14]):1;
						Game.prefs.crates=spl[15]?parseInt(spl[15]):0;
						Game.prefs.showBackupWarning=spl[16]?parseInt(spl[16]):1;
						Game.prefs.extraButtons=spl[17]?parseInt(spl[17]):1;if (!Game.prefs.extraButtons) Game.removeClass('extraButtons'); else if (Game.prefs.extraButtons) Game.addClass('extraButtons');
						Game.prefs.askLumps=spl[18]?parseInt(spl[18]):0;
						Game.prefs.customGrandmas=spl[19]?parseInt(spl[19]):1;
						Game.prefs.timeout=spl[20]?parseInt(spl[20]):0;
						Game.prefs.cloudSave=spl[21]?parseInt(spl[21]):1;
						Game.prefs.bgMusic=spl[22]?parseInt(spl[22]):1;
						Game.prefs.notScary=spl[23]?parseInt(spl[23]):0;
						Game.prefs.fullscreen=spl[24]?parseInt(spl[24]):0;if (App) App.setFullscreen(Game.prefs.fullscreen);
						Game.prefs.screenreader=spl[25]?parseInt(spl[25]):0;
						Game.prefs.discordPresence=spl[26]?parseInt(spl[26]):1;
						BeautifyAll();
						spl=str[4].split(';');//cookies and lots of other stuff
						Game.cookies=parseFloat(spl[0]);
						Game.cookiesEarned=parseFloat(spl[1]);
						Game.cookieClicks=spl[2]?parseInt(spl[2]):0;
						Game.goldenClicks=spl[3]?parseInt(spl[3]):0;
						Game.handmadeCookies=spl[4]?parseFloat(spl[4]):0;
						Game.missedGoldenClicks=spl[5]?parseInt(spl[5]):0;
						Game.bgType=spl[6]?parseInt(spl[6]):0;
						Game.milkType=spl[7]?parseInt(spl[7]):0;
						Game.cookiesReset=spl[8]?parseFloat(spl[8]):0;
						Game.elderWrath=spl[9]?parseInt(spl[9]):0;
						Game.pledges=spl[10]?parseInt(spl[10]):0;
						Game.pledgeT=spl[11]?parseInt(spl[11]):0;
						Game.nextResearch=spl[12]?parseInt(spl[12]):0;
						Game.researchT=spl[13]?parseInt(spl[13]):0;
						Game.resets=spl[14]?parseInt(spl[14]):0;
						Game.goldenClicksLocal=spl[15]?parseInt(spl[15]):0;
						Game.cookiesSucked=spl[16]?parseFloat(spl[16]):0;
						Game.wrinklersPopped=spl[17]?parseInt(spl[17]):0;
						Game.santaLevel=spl[18]?parseInt(spl[18]):0;
						Game.reindeerClicked=spl[19]?parseInt(spl[19]):0;
						Game.seasonT=spl[20]?parseInt(spl[20]):0;
						Game.seasonUses=spl[21]?parseInt(spl[21]):0;
						Game.season=spl[22]?spl[22]:Game.baseSeason;
						var wrinklers={amount:spl[23]?parseFloat(spl[23]):0,number:spl[24]?parseInt(spl[24]):0};
						Game.prestige=spl[25]?parseFloat(spl[25]):0;
						Game.heavenlyChips=spl[26]?parseFloat(spl[26]):0;
						Game.heavenlyChipsSpent=spl[27]?parseFloat(spl[27]):0;
						Game.heavenlyCookies=spl[28]?parseFloat(spl[28]):0;
						Game.ascensionMode=spl[29]?parseInt(spl[29]):0;
						Game.permanentUpgrades[0]=spl[30]?parseInt(spl[30]):-1;Game.permanentUpgrades[1]=spl[31]?parseInt(spl[31]):-1;Game.permanentUpgrades[2]=spl[32]?parseInt(spl[32]):-1;Game.permanentUpgrades[3]=spl[33]?parseInt(spl[33]):-1;Game.permanentUpgrades[4]=spl[34]?parseInt(spl[34]):-1;
						//if (version<1.05) {Game.heavenlyChipsEarned=Game.HowMuchPrestige(Game.cookiesReset);Game.heavenlyChips=Game.heavenlyChipsEarned;}
						Game.dragonLevel=spl[35]?parseInt(spl[35]):0;
						if (version<2.0041 && Game.dragonLevel==Game.dragonLevels.length-2) {Game.dragonLevel=Game.dragonLevels.length-1;}
						Game.dragonAura=spl[36]?parseInt(spl[36]):0;
						Game.dragonAura2=spl[37]?parseInt(spl[37]):0;
						Game.chimeType=spl[38]?parseInt(spl[38]):0;
						Game.volume=spl[39]?parseInt(spl[39]):75;
						wrinklers.shinies=spl[40]?parseInt(spl[40]):0;
						wrinklers.amountShinies=spl[41]?parseFloat(spl[41]):0;
						Game.lumps=spl[42]?parseFloat(spl[42]):-1;
						Game.lumpsTotal=spl[43]?parseFloat(spl[43]):-1;
						Game.lumpT=spl[44]?parseInt(spl[44]):Date.now();
						Game.lumpRefill=spl[45]?parseInt(spl[45]):0;
						if (version<2.022) Game.lumpRefill=Game.fps*60;
						Game.lumpCurrentType=spl[46]?parseInt(spl[46]):0;
						Game.vault=spl[47]?spl[47].split(','):[];
							for (var i in Game.vault){Game.vault[i]=parseInt(Game.vault[i]);}
						var actualHeralds=Game.heralds;//we store the actual amount of heralds to restore it later; here we used the amount present in the save to compute offline CpS
						Game.heralds=spl[48]?parseFloat(spl[48]):Game.heralds;
						Game.fortuneGC=spl[49]?parseInt(spl[49]):0;
						Game.fortuneCPS=spl[50]?parseInt(spl[50]):0;
						Game.cookiesPsRawHighest=spl[51]?parseFloat(spl[51]):0;
						Game.volumeMusic=spl[52]?parseInt(spl[52]):50;
						
						spl=str[5].split(';');//buildings
						Game.BuildingsOwned=0;
						for (var i in Game.ObjectsById)
						{
							var me=Game.ObjectsById[i];
							me.switchMinigame(false);
							me.pics=[];
							if (spl[i])
							{
								var mestr=spl[i].toString().split(',');
								me.amount=parseInt(mestr[0]);me.bought=parseInt(mestr[1]);me.totalCookies=parseFloat(mestr[2]);me.level=parseInt(mestr[3]||0);me.highest=(version>=2.024?parseInt(mestr[6]):me.amount);
								if (me.minigame && me.minigameLoaded && me.minigame.reset) {me.minigame.reset(true);me.minigame.load(mestr[4]||'');} else me.minigameSave=(mestr[4]||0);
								me.muted=parseInt(mestr[5])||0;
								Game.BuildingsOwned+=me.amount;
								if (version<2.003) me.level=0;
							}
							else
							{
								me.amount=0;me.unlocked=0;me.bought=0;me.highest=0;me.totalCookies=0;me.level=0;
							}
						}
						
						Game.setVolumeMusic(Game.volumeMusic);
						
						Game.LoadMinigames();
						
						if (version<1.035)//old non-binary algorithm
						{
							spl=str[6].split(';');//upgrades
							Game.UpgradesOwned=0;
							for (var i in Game.UpgradesById)
							{
								var me=Game.UpgradesById[i];
								if (spl[i])
								{
									var mestr=spl[i].split(',');
									me.unlocked=parseInt(mestr[0]);me.bought=parseInt(mestr[1]);
									if (me.bought && Game.CountsAsUpgradeOwned(me.pool)) Game.UpgradesOwned++;
								}
								else
								{
									me.unlocked=0;me.bought=0;
								}
							}
							if (str[7]) spl=str[7].split(';'); else spl=[];//achievements
							Game.AchievementsOwned=0;
							for (var i in Game.AchievementsById)
							{
								var me=Game.AchievementsById[i];
								if (spl[i])
								{
									var mestr=spl[i].split(',');
									me.won=parseInt(mestr[0]);
								}
								else
								{
									me.won=0;
								}
								if (me.won && Game.CountsAsAchievementOwned(me.pool)) Game.AchievementsOwned++;
							}
						}
						else if (version<1.0502)//old awful packing system
						{
							if (str[6]) spl=str[6]; else spl=[];//upgrades
							if (version<1.05) spl=UncompressLargeBin(spl);
							else spl=unpack(spl);
							Game.UpgradesOwned=0;
							for (var i in Game.UpgradesById)
							{
								var me=Game.UpgradesById[i];
								if (spl[i*2])
								{
									var mestr=[spl[i*2],spl[i*2+1]];
									me.unlocked=parseInt(mestr[0]);me.bought=parseInt(mestr[1]);
									if (me.bought && Game.CountsAsUpgradeOwned(me.pool)) Game.UpgradesOwned++;
								}
								else
								{
									me.unlocked=0;me.bought=0;
								}
							}
							if (str[7]) spl=str[7]; else spl=[];//achievements
							if (version<1.05) spl=UncompressLargeBin(spl);
							else spl=unpack(spl);
							Game.AchievementsOwned=0;
							for (var i in Game.AchievementsById)
							{
								var me=Game.AchievementsById[i];
								if (spl[i])
								{
									var mestr=[spl[i]];
									me.won=parseInt(mestr[0]);
								}
								else
								{
									me.won=0;
								}
								if (me.won && Game.CountsAsAchievementOwned(me.pool)) Game.AchievementsOwned++;
							}
						}
						else
						{
							if (str[6]) spl=str[6]; else spl=[];//upgrades
							if (version<2.0046) spl=unpack2(spl).split('');
							else spl=(spl).split('');
							Game.UpgradesOwned=0;
							for (var i in Game.UpgradesById)
							{
								var me=Game.UpgradesById[i];
								if (spl[i*2])
								{
									var mestr=[spl[i*2],spl[i*2+1]];
									me.unlocked=parseInt(mestr[0]);me.bought=parseInt(mestr[1]);
									if (me.bought && Game.CountsAsUpgradeOwned(me.pool)) Game.UpgradesOwned++;
								}
								else
								{
									me.unlocked=0;me.bought=0;
								}
							}
							if (str[7]) spl=str[7]; else spl=[];//achievements
							if (version<2.0046) spl=unpack2(spl).split('');
							else spl=(spl).split('');
							Game.AchievementsOwned=0;
							for (var i in Game.AchievementsById)
							{
								var me=Game.AchievementsById[i];
								if (spl[i])
								{
									var mestr=[spl[i]];
									me.won=parseInt(mestr[0]);
								}
								else
								{
									me.won=0;
								}
								if (me.won && Game.CountsAsAchievementOwned(me.pool)) Game.AchievementsOwned++;
							}
						}
						
						Game.killBuffs();
						var buffsToLoad=[];
						spl=(str[8]||'').split(';');//buffs
						for (var i in spl)
						{
							if (spl[i])
							{
								var mestr=spl[i].toString().split(',');
								buffsToLoad.push(mestr);
							}
						}
						
						spl=(str[9]||'').split(';');//mod data
						
						for (var i in spl)
						{
							if (spl[i])
							{
								var data=spl[i].split(':');
								var modId=data[0];
								if (modId=='META') continue;
								data.shift();
								data=Game.safeLoadString(data.join(':'));
								Game.modSaveData[modId]=data;
							}
						}
						
						for (var i in Game.ObjectsById)
						{
							var me=Game.ObjectsById[i];
							if (me.buyFunction) me.buyFunction();
							me.refresh();
							if (me.id>0)
							{
								if (me.muted) me.mute(1);
							}
						}
						
						if (version<1.0503)//upgrades that used to be regular, but are now heavenly
						{
							var me=Game.Upgrades['Persistent memory'];me.unlocked=0;me.bought=0;
							var me=Game.Upgrades['Season switcher'];me.unlocked=0;me.bought=0;
						}
						
						if (Game.bgType==-1) Game.bgType=0;
						if (Game.milkType==-1 || !Game.AllMilks[Game.milkType]) Game.milkType=0;
						
						
						//advance timers
						var framesElapsed=Math.ceil(((Date.now()-Game.lastDate)/1000)*Game.fps);
						if (Game.pledgeT>0) Game.pledgeT=Math.max(Game.pledgeT-framesElapsed,1);
						if (Game.seasonT>0) Game.seasonT=Math.max(Game.seasonT-framesElapsed,1);
						if (Game.researchT>0) Game.researchT=Math.max(Game.researchT-framesElapsed,1);
						
						
						Game.ResetWrinklers();
						Game.LoadWrinklers(wrinklers.amount,wrinklers.number,wrinklers.shinies,wrinklers.amountShinies);
						
						//recompute season trigger prices
						if (Game.Has('Season switcher')) {for (var i in Game.seasons) {Game.Unlock(Game.seasons[i].trigger);}}
						Game.computeSeasonPrices();
						
						//recompute prestige
						Game.prestige=Math.floor(Game.HowMuchPrestige(Game.cookiesReset));
						//if ((Game.heavenlyChips+Game.heavenlyChipsSpent)<Game.prestige)
						//{Game.heavenlyChips=Game.prestige;Game.heavenlyChipsSpent=0;}//chips owned and spent don't add up to total prestige? set chips owned to prestige
						
						Game.bakeryNameSet(bakeryName);
						
						Game.loadModData();
						
						
						if (version==1.037 && Game.beta)//are we opening the new beta? if so, save the old beta to /betadungeons
						{
							window.localStorage.setItem('CookieClickerGameBetaDungeons',window.localStorage.getItem('CookieClickerGameBeta'));
							Game.Notify('Beta save data','Your beta save data has been safely exported to /betadungeons.',20);
						}
						else if (version==1.0501 && Game.beta)//are we opening the newer beta? if so, save the old beta to /oldbeta
						{
							window.localStorage.setItem('CookieClickerGameOld',window.localStorage.getItem('CookieClickerGameBeta'));
							//Game.Notify('Beta save data','Your beta save data has been safely exported to /oldbeta.',20);
						}
						if (version<=1.0466 && !Game.beta)//export the old 2014 version to /v10466
						{
							window.localStorage.setItem('CookieClickerGamev10466',window.localStorage.getItem('CookieClickerGame'));
							//Game.Notify('Beta save data','Your save data has been safely exported to /v10466.',20);
						}
						if (version==1.9)//are we importing from the 1.9 beta? remove all heavenly upgrades and refund heavenly chips
						{
							for (var i in Game.UpgradesById)
							{
								var me=Game.UpgradesById[i];
								if (me.bought && me.pool=='prestige')
								{
									me.unlocked=0;
									me.bought=0;
								}
							}
							Game.heavenlyChips=Game.prestige;
							Game.heavenlyChipsSpent=0;
							
							setTimeout(function(){Game.Prompt('<h3>Beta patch</h3><div class="block">We\'ve tweaked some things and fixed some others, please check the update notes!<div class="line"></div>Of note : due to changes in prestige balancing, all your heavenly upgrades have been removed and your heavenly chips refunded; you\'ll be able to reallocate them next time you ascend.<div class="line"></div>Thank you again for beta-testing Cookie Clicker!</div>',[['Alright then!','Game.ClosePrompt();']]);},200);
						}
						if (version<=1.0466)//are we loading from the old live version? reset HCs
						{
							Game.heavenlyChips=Game.prestige;
							Game.heavenlyChipsSpent=0;
						}
						
						if (Game.ascensionMode!=1)
						{
							if (Game.Has('Starter kit')) Game.Objects['Cursor'].free=10;
							if (Game.Has('Starter kitchen')) Game.Objects['Grandma'].free=5;
						}
						
						Game.CalculateGains();
						
						var timeOffline=(Date.now()-Game.lastDate)/1000;
						
						if (Math.random()<1/10000) Game.TOYS=1;//teehee!
						if (Math.random()<1/10000) Game.WINKLERS=1;//squeak
						
						//compute cookies earned while the game was closed
						if (Game.mobile || Game.Has('Perfect idling') || Game.Has('Twin Gates of Transcendence'))
						{
							if (Game.Has('Perfect idling'))
							{
								var maxTime=60*60*24*1000000000;
								var percent=100;
							}
							else
							{
								var maxTime=60*60;
								if (Game.Has('Belphegor')) maxTime*=2;
								if (Game.Has('Mammon')) maxTime*=2;
								if (Game.Has('Abaddon')) maxTime*=2;
								if (Game.Has('Satan')) maxTime*=2;
								if (Game.Has('Asmodeus')) maxTime*=2;
								if (Game.Has('Beelzebub')) maxTime*=2;
								if (Game.Has('Lucifer')) maxTime*=2;
								
								var percent=5;
								if (Game.Has('Angels')) percent+=10;
								if (Game.Has('Archangels')) percent+=10;
								if (Game.Has('Virtues')) percent+=10;
								if (Game.Has('Dominions')) percent+=10;
								if (Game.Has('Cherubim')) percent+=10;
								if (Game.Has('Seraphim')) percent+=10;
								if (Game.Has('God')) percent+=10;
								
								if (Game.Has('Chimera')) {maxTime+=60*60*24*2;percent+=5;}
								
								if (Game.Has('Fern tea')) percent+=3;
								if (Game.Has('Ichor syrup')) percent+=7;
								if (Game.Has('Fortune #102')) percent+=1;
							}
							
							var timeOfflineOptimal=Math.min(timeOffline,maxTime);
							var timeOfflineReduced=Math.max(0,timeOffline-timeOfflineOptimal);
							var amount=(timeOfflineOptimal+timeOfflineReduced*0.1)*Game.cookiesPs*(percent/100);
							
							if (amount>0)
							{
								Game.Notify(loc("Welcome back!"),loc("You earned <b>%1</b> while you were away.",loc("%1 cookie",LBeautify(amount)))+(EN?('<br>('+Game.sayTime(timeOfflineOptimal*Game.fps,-1)+' at '+Math.floor(percent)+'% CpS'+(timeOfflineReduced?', plus '+Game.sayTime(timeOfflineReduced*Game.fps,-1)+' at '+(Math.floor(percent*10)/100)+'%':'')+'.)'):''),[Math.floor(Math.random()*16),11]);
								Game.Earn(amount);
							}
						}
						
						//we load buffs after everything as we do not want them to interfer with offline CpS
						for (var i in buffsToLoad)
						{
							var mestr=buffsToLoad[i];
							var type=Game.buffTypes[parseInt(mestr[0])];
							Game.gainBuff(type.name,parseFloat(mestr[1])/Game.fps,parseFloat(mestr[3]||0),parseFloat(mestr[4]||0),parseFloat(mestr[5]||0)).time=parseFloat(mestr[2]);
						}
						
						
						Game.loadLumps(timeOffline);
			
						Game.bakeryNameRefresh();
						
					}
					else//importing old version save
					{
						Game.Notify(loc("Error importing save"),loc("Sorry, you can't import saves from the classic version."),'',6,1);
						return false;
					}
					
					if (Game.prefs.screenreader)
					{
						Game.BuildStore();
					}
					
					Game.RebuildUpgrades();
					
					Game.TickerAge=0;
					Game.TickerEffect=0;
					
					Game.elderWrathD=0;
					Game.recalculateGains=1;
					Game.storeToRefresh=1;
					Game.upgradesToRebuild=1;
					
					Game.buyBulk=1;Game.buyMode=1;Game.storeBulkButton(-1);
					
					
					Game.specialTab='';
					Game.ToggleSpecialMenu(0);
					
					Game.killShimmers();
					
					if (Game.T>Game.fps*5 && Game.ReincarnateTimer==0)//fade out of black and pop the cookie
					{
						Game.ReincarnateTimer=1;
						Game.addClass('reincarnating');
						Game.BigCookieSize=0;
					}
					
					
					var prestigeUpgradesOwned=0;
					for (var i in Game.Upgrades)
					{
						if (Game.Upgrades[i].bought && Game.Upgrades[i].pool=='prestige') prestigeUpgradesOwned++;
					}
					if (prestigeUpgradesOwned>=100) Game.Win('All the stars in heaven');
					
					
					if (version<Game.version) l('logButton').classList.add('hasUpdate');
					
					if (Game.season!='' && Game.season==Game.baseSeason)
					{
						if (Game.season=='valentines') Game.Notify(loc("Valentine's Day!"),loc("It's <b>Valentine's season</b>!<br>Love's in the air and cookies are just that much sweeter!"),[20,3],60*3);
						else if (Game.season=='fools') Game.Notify(loc("Business Day!"),loc("It's <b>Business season</b>!<br>Don't panic! Things are gonna be looking a little more corporate for a few days."),[17,6],60*3);
						else if (Game.season=='halloween') Game.Notify(loc("Halloween!"),loc("It's <b>Halloween season</b>!<br>Everything is just a little bit spookier!"),[13,8],60*3);
						else if (Game.season=='christmas') Game.Notify(loc("Christmas time!"),loc("It's <b>Christmas season</b>!<br>Bring good cheer to all and you just may get cookies in your stockings!"),[12,10],60*3);
						else if (Game.season=='easter') Game.Notify(loc("Easter!"),loc("It's <b>Easter season</b>!<br>Keep an eye out and you just might click a rabbit or two!"),[0,12],60*3);
					}
					
					Game.heralds=actualHeralds;
					
					Game.Notify(loc("Game loaded"),'','',1,1);
					
					if (!App && Game.prefs.showBackupWarning==1) Game.showBackupWarning();
					
					if (App) App.justLoadedSave();
				}
			}
			else return false;
			return true;
		}
		
		/*=====================================================================================
		RESET
		=======================================================================================*/
		Game.Reset=function(hard)
		{
			Game.T=0;
			
			if (hard) {Game.loadedFromVersion=Game.version;}
			
			var cookiesForfeited=Game.cookiesEarned;
			if (!hard)
			{
				if (cookiesForfeited>=1000000) Game.Win('Sacrifice');
				if (cookiesForfeited>=1000000000) Game.Win('Oblivion');
				if (cookiesForfeited>=1000000000000) Game.Win('From scratch');
				if (cookiesForfeited>=1000000000000000) Game.Win('Nihilism');
				if (cookiesForfeited>=1000000000000000000) Game.Win('Dematerialize');
				if (cookiesForfeited>=1000000000000000000000) Game.Win('Nil zero zilch');
				if (cookiesForfeited>=1000000000000000000000000) Game.Win('Transcendence');
				if (cookiesForfeited>=1000000000000000000000000000) Game.Win('Obliterate');
				if (cookiesForfeited>=1000000000000000000000000000000) Game.Win('Negative void');
				if (cookiesForfeited>=1000000000000000000000000000000000) Game.Win('To crumbs, you say?');
				if (cookiesForfeited>=1000000000000000000000000000000000000) Game.Win('You get nothing');
				if (cookiesForfeited>=1000000000000000000000000000000000000000) Game.Win('Humble rebeginnings');
				if (cookiesForfeited>=1000000000000000000000000000000000000000000) Game.Win('The end of the world');
				if (cookiesForfeited>=1000000000000000000000000000000000000000000000) Game.Win('Oh, you\'re back');
				if (cookiesForfeited>=1000000000000000000000000000000000000000000000000) Game.Win('Lazarus');
				if (cookiesForfeited>=1000000000000000000000000000000000000000000000000000) Game.Win('Smurf account');
				if (cookiesForfeited>=1000000000000000000000000000000000000000000000000000000) Game.Win('If at first you don\'t succeed');
				
				if (Math.round(Game.cookies)==1000000000000) Game.Win('When the cookies ascend just right');
			}
			
			Game.killBuffs();
			
			Game.seed=Game.makeSeed();
			
			Game.cookiesReset+=Game.cookiesEarned;
			Game.cookies=0;
			Game.cookiesEarned=0;
			Game.cookieClicks=0;
			Game.goldenClicksLocal=0;
			//Game.goldenClicks=0;
			//Game.missedGoldenClicks=0;
			Game.handmadeCookies=0;
			Game.cookiesPsRawHighest=0;
			if (hard)
			{
				Game.bgType=0;
				Game.milkType=0;
				Game.chimeType=0;
				
				Game.vault=[];
			}
			Game.pledges=0;
			Game.pledgeT=0;
			Game.elderWrath=0;
			Game.elderWrathOld=0;
			Game.elderWrathD=0;
			Game.nextResearch=0;
			Game.researchT=0;
			Game.seasonT=0;
			Game.seasonUses=0;
			Game.season=Game.baseSeason;
			Game.computeSeasonPrices();
			
			Game.startDate=parseInt(Date.now());
			Game.lastDate=parseInt(Date.now());
			
			Game.cookiesSucked=0;
			Game.wrinklersPopped=0;
			Game.ResetWrinklers();
			
			Game.santaLevel=0;
			Game.reindeerClicked=0;
			
			Game.dragonLevel=0;
			Game.dragonAura=0;
			Game.dragonAura2=0;
			
			Game.fortuneGC=0;
			Game.fortuneCPS=0;
			
			Game.TickerClicks=0;
			
			if (Game.gainedPrestige>0) Game.resets++;
			if (!hard && Game.canLumps() && Game.ascensionMode!=1) Game.addClass('lumpsOn');
			else Game.removeClass('lumpsOn');
			Game.gainedPrestige=0;
			
			for (var i in Game.ObjectsById)
			{
				var me=Game.ObjectsById[i];
				me.amount=0;me.bought=0;me.highest=0;me.free=0;me.totalCookies=0;
				me.switchMinigame(false);
				if (hard) {me.muted=0;}
				me.pics=[];
				me.refresh();
			}
			for (var i in Game.UpgradesById)
			{
				var me=Game.UpgradesById[i];
				if (hard || me.pool!='prestige') me.bought=0;
				if (hard) me.unlocked=0;
				if (me.pool!='prestige' && !me.lasting)
				{
					if (Game.Has('Keepsakes') && Game.seasonDrops.indexOf(me.name)!=-1 && Math.random()<1/5){}
					else if (Game.ascensionMode==1 && Game.HasAchiev('O Fortuna') && me.tier=='fortune'){}
					else if (Game.HasAchiev('O Fortuna') && me.tier=='fortune' && Math.random()<0.4){}
					else me.unlocked=0;
				}
			}
			
			Game.BuildingsOwned=0;
			Game.UpgradesOwned=0;
			
			Game.cookiesPsByType={};
			Game.cookiesMultByType={};
			
			if (!hard)
			{
				if (Game.ascensionMode!=1)
				{
					for (var i in Game.permanentUpgrades)
					{
						if (Game.permanentUpgrades[i]!=-1)
						{Game.UpgradesById[Game.permanentUpgrades[i]].earn();}
					}
					if (Game.Has('Season switcher')) {for (var i in Game.seasons) {Game.Unlock(Game.seasons[i].trigger);}}
					
					if (Game.Has('Starter kit')) Game.Objects['Cursor'].getFree(10);
					if (Game.Has('Starter kitchen')) Game.Objects['Grandma'].getFree(5);
				}
			}
			
			/*for (var i in Game.AchievementsById)
			{
				var me=Game.AchievementsById[i];
				me.won=0;
			}*/
			//Game.DefaultPrefs();
			BeautifyAll();
			
			Game.RebuildUpgrades();
			Game.TickerAge=0;
			Game.TickerEffect=0;
			Game.recalculateGains=1;
			Game.storeToRefresh=1;
			Game.upgradesToRebuild=1;
			Game.killShimmers();
			
			Game.buyBulk=1;Game.buyMode=1;Game.storeBulkButton(-1);
			
			Game.LoadMinigames();
			for (var i in Game.ObjectsById)
			{
				var me=Game.ObjectsById[i];
				if (hard && me.minigame && me.minigame.launch) {me.minigame.launch();me.minigame.reset(true);}
				else if (!hard && me.minigame && me.minigame.reset) me.minigame.reset();
			}
			
			l('toggleBox').style.display='none';
			l('toggleBox').innerHTML='';
			Game.choiceSelectorOn=-1;
			Game.ToggleSpecialMenu(0);
			Game.specialTab='';
			
			l('logButton').classList.remove('hasUpdate');
			
			Game.runModHook('reset',hard);
			
			if (hard)
			{
				Game.clicksThisSession=0;
				if (Game.T>Game.fps*5 && Game.ReincarnateTimer==0)//fade out of black and pop the cookie
				{
					Game.ReincarnateTimer=1;
					Game.addClass('reincarnating');
					Game.BigCookieSize=0;
				}
				Game.Notify(loc("Game reset"),EN?"So long, cookies.":loc("Good bye, cookies."),[21,6],6);
			}
			else Game.clicksThisSession=Math.max(Game.clicksThisSession,1);
			
			Game.jukebox.reset();
			if (hard) PlayCue('launch');
			else PlayCue('play');
		}
		Game.HardReset=function(bypass)
		{
			if (!bypass)
			{
				Game.Prompt('<id WipeSave><h3>'+loc("Wipe save")+'</h3><div class="block">'+tinyIcon([15,5])+'<div class="line"></div>'+loc("Do you REALLY want to wipe your save?<br><small>You will lose your progress, your achievements, and your heavenly chips!</small>")+'</div>',[[EN?'Yes!':loc("Yes"),'Game.ClosePrompt();Game.HardReset(1);','float:left'],[loc("No"),0,'float:right']]);
			}
			else if (bypass==1)
			{
				Game.Prompt('<id ReallyWipeSave><h3>'+loc("Wipe save")+'</h3><div class="block">'+tinyIcon([15,5])+'<div class="line"></div>'+loc("Whoah now, are you really, <b><i>REALLY</i></b> sure you want to go through with this?<br><small>Don't say we didn't warn you!</small>")+'</div>',[[EN?'Do it!':loc("Yes"),'Game.ClosePrompt();Game.HardReset(2);','float:left'],[loc("No"),0,'float:right']]);
			}
			else
			{
				for (var i in Game.AchievementsById)
				{
					var me=Game.AchievementsById[i];
					me.won=0;
				}
				for (var i in Game.ObjectsById)
				{
					var me=Game.ObjectsById[i];
					me.level=0;
				}

				Game.AchievementsOwned=0;
				Game.goldenClicks=0;
				Game.missedGoldenClicks=0;
				Game.Reset(1);
				Game.resets=0;
				Game.fullDate=parseInt(Date.now());
				Game.bakeryName=Game.GetBakeryName();
				Game.bakeryNameRefresh();
				Game.cookiesReset=0;
				Game.prestige=0;
				Game.heavenlyChips=0;
				Game.heavenlyChipsSpent=0;
				Game.heavenlyCookies=0;
				Game.permanentUpgrades=[-1,-1,-1,-1,-1];
				Game.ascensionMode=0;
				Game.lumps=-1;
				Game.lumpsTotal=-1;
				Game.lumpT=Date.now();
				Game.lumpRefill=0;
				Game.removeClass('lumpsOn');
				if (App) App.hardReset();
			}
		}
		
		
		
		Game.onCrate=0;
		Game.setOnCrate=function(what)
		{
			Game.onCrate=what;
		}
		Game.crate=function(me,context,forceClickStr,id,style)
		{
			//produce a crate with associated tooltip for an upgrade or achievement
			//me is an object representing the upgrade or achievement
			//context can be "store", "ascend", "stats" or undefined
			//forceClickStr changes what is done when the crate is clicked
			//id is the resulting div's desired id
			
			var classes='crate';
			var enabled=0;
			var noFrame=0;
			var attachment='top';
			var neuromancy=0;
			if (context=='stats' && (Game.Has('Neuromancy') || (Game.sesame && me.pool=='debug'))) neuromancy=1;
			var mysterious=0;
			var clickStr='';
			
			if (me.type=='upgrade')
			{
				var canBuy=(context=='store'?me.canBuy():true);
				if (context=='stats' && me.bought==0 && !Game.Has('Neuromancy') && (!Game.sesame || me.pool!='debug')) return '';
				else if (context=='stats' && (Game.Has('Neuromancy') || (Game.sesame && me.pool=='debug'))) neuromancy=1;
				else if (context=='store' && !canBuy) enabled=0;
				else if (context=='ascend' && me.bought==0) enabled=0;
				else enabled=1;
				if (me.bought>0) enabled=1;
				
				if (context=='stats' && !Game.prefs.crates) noFrame=1;
				
				classes+=' upgrade';
				if (me.pool=='prestige') classes+=' heavenly';
				
				
				if (neuromancy) clickStr='Game.UpgradesById['+me.id+'].toggle();';
			}
			else if (me.type=='achievement')
			{
				if (context=='stats' && me.won==0 && me.pool!='normal') return '';
				else if (context!='stats') enabled=1;
				
				if (context=='stats' && !Game.prefs.crates) noFrame=1;
				
				classes+=' achievement';
				if (me.pool=='shadow') classes+=' shadow';
				if (me.won>0) enabled=1;
				else mysterious=1;
				if (!enabled) clickStr='Game.AchievementsById['+me.id+'].click();';
				
				if (neuromancy) clickStr='Game.AchievementsById['+me.id+'].toggle();';
			}
			
			if (context=='store') attachment='store';
			
			if (forceClickStr) clickStr=forceClickStr;
			
			if (me.choicesFunction) classes+=' selector';
			
			
			var icon=me.icon;
			if (mysterious) icon=[0,7];
			
			if (me.iconFunction) icon=me.iconFunction();
			
			if (me.bought && context=='store') enabled=0;
			
			if (enabled) classes+=' enabled';// else classes+=' disabled';
			if (noFrame) classes+=' noFrame';
			
			var text=[];
			if (Game.sesame)
			{
				if (Game.debuggedUpgradeCpS[me.name] || Game.debuggedUpgradeCpClick[me.name])
				{
					text.push('x'+Beautify(1+Game.debuggedUpgradeCpS[me.name],2));text.push(Game.debugColors[Math.floor(Math.max(0,Math.min(Game.debugColors.length-1,Math.pow(Game.debuggedUpgradeCpS[me.name]/2,0.5)*Game.debugColors.length)))]);
					text.push('x'+Beautify(1+Game.debuggedUpgradeCpClick[me.name],2));text.push(Game.debugColors[Math.floor(Math.max(0,Math.min(Game.debugColors.length-1,Math.pow(Game.debuggedUpgradeCpClick[me.name]/2,0.5)*Game.debugColors.length)))]);
				}
				if (Game.extraInfo) {text.push(Math.floor(me.order)+(me.power?'<br>P:'+me.power:''));text.push('#fff');}
			}
			var textStr='';
			for (var i=0;i<text.length;i+=2)
			{
				textStr+='<div style="opacity:0.9;z-index:1000;padding:0px 2px;background:'+text[i+1]+';color:#000;font-size:10px;position:absolute;top:'+(i/2*10)+'px;left:0px;">'+text[i]+'</div>';
			}
			return (Game.prefs.screenreader?'<button aria-labelledby="ariaReader-'+me.type+'-'+me.id+'"':'<div')+
			(clickStr!=''?(' '+Game.clickStr+'="'+clickStr+'"'):'')+
			' class="'+classes+'" '+
			Game.getDynamicTooltip(
				'function(){return Game.crateTooltip(Game.'+(me.type=='upgrade'?'Upgrades':'Achievements')+'ById['+me.id+'],'+(context?'\''+context+'\'':'')+');}',
				attachment,true
			)+
			(id?'id="'+id+'" ':'')+
			'style="'+(mysterious?
				'background-position:'+(-0*48)+'px '+(-7*48)+'px;':
				writeIcon(icon))+
				((context=='ascend' && me.pool=='prestige')?'position:absolute;left:'+me.posX+'px;top:'+me.posY+'px;':'')+
				(style||'')+
			'">'+
			textStr+
			(Game.prefs.screenreader?'<label class="srOnly" id="ariaReader-'+me.type+'-'+me.id+'"></label>':'')+
			(me.choicesFunction?'<div class="selectorCorner"></div>':'')+
			(Game.prefs.screenreader?'</button>':'</div>');
		}
		Game.crateTooltip=function(me,context)
		{
			var tags=[];
			var mysterious=0;
			var neuromancy=0;
			var price='';
			if (context=='stats' && (Game.Has('Neuromancy') || (Game.sesame && me.pool=='debug'))) neuromancy=1;
			
			var ariaText='';
			
			if (me.type=='upgrade')
			{
				ariaText+='Upgrade. ';
				
				if (me.pool=='prestige') tags.push(loc("[Tag]Heavenly",0,'Heavenly'),'#efa438');
				else if (me.pool=='tech') tags.push(loc("[Tag]Tech",0,'Tech'),'#36a4ff');
				else if (me.pool=='cookie') tags.push(loc("[Tag]Cookie",0,'Cookie'),0);
				else if (me.pool=='debug') tags.push(loc("[Tag]Debug",0,'Debug'),'#00c462');
				else if (me.pool=='toggle') tags.push(loc("[Tag]Switch",0,'Switch'),0);
				else tags.push(loc("[Tag]Upgrade",0,'Upgrade'),0);
				
				if (Game.Has('Label printer'))
				{
					if (me.tier!=0) tags.push(loc("Tier:")+' '+loc("[Tier]"+Game.Tiers[me.tier].name,0,Game.Tiers[me.tier].name),Game.Tiers[me.tier].color);
					if (me.name=='Label printer' || me.name=='This upgrade') tags.push(loc("Tier:")+' '+loc("[Tier]Self-referential"),'#ff00ea');
				}
				
				if (me.isVaulted()) tags.push(loc("Vaulted"),'#4e7566');
				
				if (me.bought>0)
				{
					ariaText+='Owned. ';
					if (me.pool=='tech') tags.push(loc("Researched"),0);
					else if (EN && me.kitten) tags.push('Purrchased',0);
					else tags.push(loc("Purchased"),0);
				}
				
				if (me.lasting && me.unlocked) tags.push(loc("Unlocked forever"),'#f2ff87');
				
				if (neuromancy && me.bought==0) tags.push(loc("Click to learn!"),'#00c462');
				else if (neuromancy && me.bought>0) tags.push(loc("Click to unlearn!"),'#00c462');
				
				var canBuy=(context=='store'?me.canBuy():true);
				var cost=me.getPrice();
				if (me.priceLumps>0) cost=me.priceLumps;
				
				if (me.priceLumps==0 && cost==0) price='';
				else
				{
					price='<div style="float:right;text-align:right;"><span class="price'+
						(me.priceLumps>0?(' lump'):'')+
						(me.pool=='prestige'?((me.bought || Game.heavenlyChips>=cost)?' heavenly':' heavenly disabled'):'')+
						(context=='store'?(canBuy?'':' disabled'):'')+
					'">'+Beautify(Math.round(cost))+'</span>'+((me.pool!='prestige' && me.priceLumps==0)?Game.costDetails(cost):'')+'</div>';
					
					ariaText+=(me.bought?'Bought for':canBuy?'Can buy for':'Cannot afford the')+' '+Beautify(Math.round(cost))+' '+((me.priceLumps>0)?'sugar lumps':(me.pool=='prestige')?'heavenly chips':'cookies')+'. ';
				}
			}
			else if (me.type=='achievement')
			{
				ariaText+='Achievement. ';
				if (me.pool=='shadow') tags.push(loc("Shadow Achievement"),'#9700cf');
				else tags.push(loc("Achievement"),0);
				if (me.won>0) {tags.push(loc("Unlocked"),0);ariaText+='Unlocked. ';}
				else {tags.push(loc("Locked"),0);mysterious=1;}
				
				if (neuromancy && me.won==0) tags.push(loc("Click to win!"),'#00c462');
				else if (neuromancy && me.won>0) tags.push(loc("Click to lose!"),'#00c462');
			}
			
			var tagsStr='';
			for (var i=0;i<tags.length;i+=2)
			{
				if (i%2==0) tagsStr+='<div class="tag" style="background-color:'+(tags[i+1]==0?'#fff':tags[i+1])+';">'+tags[i]+'</div>';
			}
			
			var icon=me.icon;
			if (mysterious) icon=[0,7];
			
			if (me.iconFunction) icon=me.iconFunction();
			
			ariaText+=(mysterious?'Hidden':me.dname)+'. ';
			
			var tip='';
			if (context=='store')
			{
				if (me.pool!='toggle' && me.pool!='tech')
				{
					var purchase=me.kitten?'purrchase':'purchase';
					if (Game.Has('Inspired checklist'))
					{
						if (me.isVaulted()) tip=EN?('Upgrade is vaulted and will not be auto-'+purchase+'d.<br>Click to '+purchase+'. Shift-click to unvault.'):(loc("Upgrade is vaulted and will not be auto-purchased.")+'<br>'+loc("Click to purchase.")+' '+loc("%1 to unvault.",loc("Shift-click")));
						else tip=EN?('Click to '+purchase+'. Shift-click to vault.'):(loc("Click to purchase.")+' '+loc("%1 to vault.",loc("Shift-click")));
						if (EN){
							if (Game.keys[16]) tip+='<br>(You are holding Shift.)';
							else tip+='<br>(You are not holding Shift.)';
						}
					}
					else tip=EN?('Click to '+purchase+'.'):loc("Click to purchase.");
				}
				else if (me.pool=='toggle' && me.choicesFunction) tip=loc("Click to open selector.");
				else if (me.pool=='toggle') tip=loc("Click to toggle.");
				else if (me.pool=='tech') tip=loc("Click to research.");
			}
			
			if (tip!='') ariaText+=tip+' ';
			
			var desc=me.ddesc;
			if (me.descFunc) desc=me.descFunc(context);
			if (me.bought && context=='store' && me.displayFuncWhenOwned) desc=me.displayFuncWhenOwned()+'<div class="line"></div>'+desc;
			if (me.unlockAt)
			{
				if (me.unlockAt.require)
				{
					var it=Game.Upgrades[me.unlockAt.require];
					desc='<div style="font-size:80%;text-align:center;">'+(EN?'From':loc("Source:"))+' '+tinyIcon(it.icon)+' '+it.dname+'</div><div class="line"></div>'+desc;
				}
				else if (me.unlockAt.text)
				{
					//var it=Game.Upgrades[me.unlockAt.require];
					desc='<div style="font-size:80%;text-align:center;">'+(EN?'From':loc("Source:"))+' <b>'+text+'</b></div><div class="line"></div>'+desc;
				}
			}
			
			if (!mysterious) ariaText+='Description: '+desc+' ';
			
			if (Game.prefs.screenreader)
			{
				var ariaLabel=l('ariaReader-'+me.type+'-'+me.id);
				if (ariaLabel) ariaLabel.innerHTML=ariaText.replace(/(<([^>]+)>)/gi,' ');
			}
			
			return '<div style="position:absolute;left:1px;top:1px;right:1px;bottom:1px;background:linear-gradient(125deg,'+(me.pool=='prestige'?'rgba(15,115,130,1) 0%,rgba(15,115,130,0)':'rgba(50,40,40,1) 0%,rgba(50,40,40,0)')+' 20%);mix-blend-mode:screen;z-index:1;"></div><div style="z-index:10;padding:8px 4px;min-width:350px;position:relative;" id="tooltipCrate">'+
			'<div class="icon" style="float:left;margin-left:-8px;margin-top:-8px;'+writeIcon(icon)+'"></div>'+
			(me.bought && context=='store'?'':price)+
			'<div class="name">'+(mysterious?'???':me.dname)+'</div>'+
			tagsStr+
			'<div class="line"></div><div class="description">'+(mysterious?'???':desc)+'</div></div>'+
			(tip!=''?('<div class="line"></div><div style="font-size:10px;font-weight:bold;color:#999;text-align:center;padding-bottom:4px;line-height:100%;" class="crateTip">'+tip+'</div>'):'')+
			(Game.sesame?('<div style="font-size:9px;">Id: '+me.id+' | Order: '+Math.floor(me.order)+(me.tier?' | Tier: '+me.tier:'')+'</div>'):'');
		}
		
		Game.costDetails=function(cost)
		{
			if (!Game.Has('Genius accounting')) return '';
			if (!cost) return '';
			var priceInfo='';
			var cps=Game.cookiesPs*(1-Game.cpsSucked);
			if (cost>Game.cookies) priceInfo+=loc("in %1",Game.sayTime(((cost-Game.cookies)/cps+1)*Game.fps))+'<br>';
			priceInfo+=loc("%1 worth",Game.sayTime((cost/cps+1)*Game.fps))+'<br>';
			priceInfo+=loc("%1% of bank",Beautify((cost/Game.cookies)*100,1))+'<br>';
			return '<div style="font-size:80%;opacity:0.7;line-height:90%;" class="costDetails">'+priceInfo+'</div>';
		}
		
		
		/*=====================================================================================
		PRESTIGE
		=======================================================================================*/
		
		Game.HCfactor=3;
		Game.HowMuchPrestige=function(cookies)//how much prestige [cookies] should land you
		{
			return Math.pow(cookies/1000000000000,1/Game.HCfactor);
		}
		Game.HowManyCookiesReset=function(chips)//how many cookies [chips] are worth
		{
			//this must be the inverse of the above function (ie. if cookies=chips^2, chips=cookies^(1/2) )
			return Math.pow(chips,Game.HCfactor)*1000000000000;
		}
		Game.gainedPrestige=0;
		Game.EarnHeavenlyChips=function(cookiesForfeited,silent)
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
		
		Game.GetHeavenlyMultiplier=function()
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
		
		Game.ascensionModes={
		0:{name:'None',dname:loc("None [ascension type]"),desc:loc("No special modifiers."),icon:[10,0]},
		1:{name:'Born again',dname:loc("Born again [ascension type]"),desc:loc("This run will behave as if you'd just started the game from scratch. Prestige levels and heavenly upgrades will have no effect, as will sugar lumps and building levels. Perma-upgrades and minigames will be unavailable.<div class=\"line\"></div>Some achievements are only available in this mode."),icon:[2,7]}/*,
		2:{name:'Trigger finger',dname:loc("Trigger finger [ascension type]"),desc:loc("In this run, scrolling your mouse wheel on the cookie counts as clicking it. Some upgrades introduce new clicking behaviors.<br>No clicking achievements may be obtained in this mode.<div class=\"line\"></div>Reaching 1 quadrillion cookies in this mode unlocks a special heavenly upgrade."),icon:[12,0]}*/
		};
		
		Game.ascendMeterPercent=0;
		Game.ascendMeterPercentT=0;
		Game.ascendMeterLevel=100000000000000000000000000000;
		
		Game.nextAscensionMode=0;
		Game.UpdateAscensionModePrompt=function()
		{
			var icon=Game.ascensionModes[Game.nextAscensionMode].icon;
			var name=Game.ascensionModes[Game.nextAscensionMode].dname;
			l('ascendModeButton').innerHTML=
			'<div class="crate noFrame enabled" '+Game.clickStr+'="Game.PickAscensionMode();" '+Game.getTooltip(
				'<div style="min-width:200px;text-align:center;font-size:11px;" id="tooltipNextChallengeMode">'+loc("Challenge mode for the next run:")+'<br><b>'+name+'</b><div class="line"></div>'+loc("Challenge modes apply special modifiers to your next ascension.<br>Click to change.")+'</div>'
			,'bottom-right')+' style="opacity:1;float:none;display:block;background-position:'+(-icon[0]*48)+'px '+(-icon[1]*48)+'px;"></div>';
		}
		Game.PickAscensionMode=function()
		{
			PlaySound('snd/tick.mp3');
			Game.tooltip.hide();
			
			var str='';
			for (var i in Game.ascensionModes)
			{
				var icon=Game.ascensionModes[i].icon;
				str+='<div class="crate enabled'+(i==Game.nextAscensionMode?' highlighted':'')+'" id="challengeModeSelector'+i+'" style="opacity:1;float:none;display:inline-block;background-position:'+(-icon[0]*48)+'px '+(-icon[1]*48)+'px;" '+Game.clickStr+'="Game.nextAscensionMode='+i+';Game.PickAscensionMode();PlaySound(\'snd/tick.mp3\');Game.choiceSelectorOn=-1;" onMouseOut="l(\'challengeSelectedName\').innerHTML=Game.ascensionModes[Game.nextAscensionMode].dname;l(\'challengeSelectedDesc\').innerHTML=Game.ascensionModes[Game.nextAscensionMode].desc;" onMouseOver="l(\'challengeSelectedName\').innerHTML=Game.ascensionModes['+i+'].dname;l(\'challengeSelectedDesc\').innerHTML=Game.ascensionModes['+i+'].desc;"'+
				'></div>';
			}
			Game.Prompt('<id PickChallengeMode><h3>'+loc("Select a challenge mode")+'</h3>'+
						'<div class="line"></div><div class="crateBox">'+str+'</div><h4 id="challengeSelectedName">'+Game.ascensionModes[Game.nextAscensionMode].dname+'</h4><div class="line"></div><div id="challengeSelectedDesc" style="min-height:128px;">'+Game.ascensionModes[Game.nextAscensionMode].desc+'</div><div class="line"></div>'
						,[[loc("Confirm"),'Game.UpdateAscensionModePrompt();Game.ClosePrompt();']],0,'widePrompt');
		}
		
		
		l('ascendOverlay').innerHTML=
			'<div id="ascendBox">'+
			'<div id="ascendData1" class="ascendData smallFramed prompt" style="margin-top:8px;"><h3 id="ascendPrestige"></h3></div>'+
			'<div id="ascendData2" class="ascendData smallFramed prompt"><h3 id="ascendHCs"></h3></div>'+
			'<a id="ascendButton" class="option framed large red" '+Game.getTooltip(
							'<div style="min-width:300px;text-align:center;font-size:11px;padding:8px;" id="tooltipReincarnate">'+loc("Click this once you've bought<br>everything you need!")+'</div>'
							,'bottom-right')+' style="font-size:16px;margin-top:0px;"><span class="fancyText" style="font-size:20px;">'+loc("Reincarnate")+'</span></a>'+
			'<div id="ascendModeButton" style="position:absolute;right:34px;bottom:25px;display:none;"></div>'+
			'<input type="text" style="display:block;" id="upgradePositions"/></div>'+
			
			'<div id="ascendInfo"><div class="ascendData smallFramed" style="margin-top:22px;width:75%;font-size:11px;">'+loc("You are ascending.<br>Drag the screen around<br>or use arrow keys!<br>When you're ready,<br>click Reincarnate.")+'</div></div>';
		
		Game.attachTooltip(l('ascendData1'),function(){return '<div style="min-width:300px;text-align:center;font-size:11px;padding:8px;" id="tooltipAscendData1">(<b>'+Beautify(Game.heavenlyChips)+'</b>)<div class="line"></div>'+loc("Each prestige level grants you a permanent <b>+%1% CpS</b>.<br>The more levels you have, the more cookies they require.",1)+'</div>';},'bottom-right');
		Game.attachTooltip(l('ascendData2'),function(){return '<div style="min-width:300px;text-align:center;font-size:11px;padding:8px;" id="tooltipAscendData2">(<b>'+loc("%1 heavenly chip",LBeautify(Game.heavenlyChips))+'</b>)<div class="line"></div>'+loc("Heavenly chips are used to buy heavenly upgrades.<br>You gain <b>1 chip</b> every time you gain a prestige level.")+'</div>';},'bottom-right');
		
		Game.UpdateAscensionModePrompt();
		
		AddEvent(l('ascendButton'),'click',function(){
			PlaySound('snd/tick.mp3');
			Game.Reincarnate();
		});
		
		Game.ascendl=l('ascend');
		Game.ascendContentl=l('ascendContent');
		Game.ascendZoomablel=l('ascendZoomable');
		Game.ascendUpgradesl=l('ascendUpgrades');
		Game.OnAscend=0;
		Game.AscendTimer=0;//how far we are into the ascend animation
		Game.AscendDuration=Game.fps*5;//how long the ascend animation is
		Game.AscendBreakpoint=Game.AscendDuration*0.5;//at which point the cookie explodes during the ascend animation
		Game.UpdateAscendIntro=function()
		{
			if (Game.AscendTimer==1) PlaySound('snd/charging.mp3');
			if (Game.AscendTimer==Math.floor(Game.AscendBreakpoint)) PlaySound('snd/thud.mp3');
			Game.AscendTimer++;
			if (Game.AscendTimer>Game.AscendDuration)//end animation and launch ascend screen
			{
				PlayCue('ascend');
				PlayMusicSound('snd/cymbalRev.mp3');
				if (!App || Game.volumeMusic==0) PlaySound('snd/choir.mp3');
				Game.EarnHeavenlyChips(Game.cookiesEarned);
				Game.AscendTimer=0;
				Game.OnAscend=1;Game.removeClass('ascendIntro');
				Game.addClass('ascending');
				Game.BuildAscendTree();
				Game.heavenlyChipsDisplayed=Game.heavenlyChips;
				Game.nextAscensionMode=0;
				Game.ascensionMode=0;
				Game.UpdateAscensionModePrompt();
			}
		}
		Game.ReincarnateTimer=0;//how far we are into the reincarnation animation
		Game.ReincarnateDuration=Game.fps*1;//how long the reincarnation animation is
		Game.UpdateReincarnateIntro=function()
		{
			if (Game.ReincarnateTimer==1) PlaySound('snd/pop'+Math.floor(Math.random()*3+1)+'.mp3',0.75);
			Game.ReincarnateTimer++;
			if (Game.ReincarnateTimer>Game.ReincarnateDuration)//end animation and launch regular game
			{
				Game.ReincarnateTimer=0;
				Game.removeClass('reincarnating');
			}
		}
		Game.Reincarnate=function(bypass)
		{
			if (!bypass) Game.Prompt('<id Reincarnate><h3>'+loc("Reincarnate")+'</h3><div class="block">'+loc("Are you ready to return to the mortal world?")+'</div>',[[loc("Yes"),'Game.ClosePrompt();Game.Reincarnate(1);'],loc("No")]);
			else
			{
				Game.ascendUpgradesl.innerHTML='';
				Game.ascensionMode=Game.nextAscensionMode;
				Game.nextAscensionMode=0;
				Game.Reset();
				if (Game.HasAchiev('Rebirth'))
				{
					Game.Notify('Reincarnated',loc("Hello, cookies!"),[10,0],4);
				}
				if (Game.resets>=1000) Game.Win('Endless cycle');
				if (Game.resets>=100) Game.Win('Reincarnation');
				if (Game.resets>=10) Game.Win('Resurrection');
				if (Game.resets>=1) Game.Win('Rebirth');
				
				var prestigeUpgradesOwned=0;
				for (var i in Game.Upgrades)
				{
					if (Game.Upgrades[i].bought && Game.Upgrades[i].pool=='prestige') prestigeUpgradesOwned++;
				}
				if (prestigeUpgradesOwned>=100) Game.Win('All the stars in heaven');
				
				Game.removeClass('ascending');
				Game.OnAscend=0;
				//trigger the reincarnate animation
				Game.ReincarnateTimer=1;
				Game.addClass('reincarnating');
				Game.BigCookieSize=0;
				
				Game.runModHook('reincarnate');
			}
		}
		Game.Ascend=function(bypass)
		{
			if (!bypass) Game.Prompt('<id Ascend><h3>'+loc("Ascend")+'</h3><div class="block">'+tinyIcon([19,7])+'<div class="line"></div>'+loc("Do you REALLY want to ascend?<div class=\"line\"></div>You will lose your progress and start over from scratch.<div class=\"line\"></div>All your cookies will be converted into prestige and heavenly chips.")+'<div class="line"></div>'+(Game.canLumps()?loc("You will keep your achievements, building levels and sugar lumps."):loc("You will keep your achievements."))+'<div class="optionBox"><a class="option smallFancyButton" style="margin:16px;padding:8px 16px;animation:rainbowCycle 5s infinite ease-in-out,pucker 0.2s ease-out;box-shadow:0px 0px 0px 1px #000,0px 0px 1px 2px currentcolor;background:linear-gradient(to bottom,transparent 0%,currentColor 500%);width:auto;text-align:center;" '+Game.clickStr+'="PlaySound(\'snd/tick.mp3\');Game.ClosePrompt();Game.Ascend(1);" id="promptOption0">'+loc("Ascend")+'</a></div></div>',[[loc("Yes"),'Game.ClosePrompt();Game.Ascend(1);','float:left;display:none;'],[loc("Cancel"),0,'float:right']]);
			else
			{
				Game.Notify(loc("Ascending"),loc("So long, cookies."),[20,7],4);
				Game.OnAscend=0;Game.removeClass('ascending');
				Game.addClass('ascendIntro');
				//trigger the ascend animation
				Game.AscendTimer=1;
				Game.killShimmers();
				l('toggleBox').style.display='none';
				l('toggleBox').innerHTML='';
				Game.choiceSelectorOn=-1;
				Game.ToggleSpecialMenu(0);
				Game.AscendOffX=0;
				Game.AscendOffY=0;
				Game.AscendOffXT=0;
				Game.AscendOffYT=0;
				Game.AscendZoomT=1;
				Game.AscendZoom=0.2;
				
				Game.jukebox.reset();
				PlayCue('preascend');
			}
		}
		
		Game.DebuggingPrestige=0;
		Game.AscendDragX=0;
		Game.AscendDragY=0;
		Game.AscendOffX=0;
		Game.AscendOffY=0;
		Game.AscendZoom=1;
		Game.AscendOffXT=0;
		Game.AscendOffYT=0;
		Game.AscendZoomT=1;
		Game.AscendDragging=0;
		Game.AscendGridSnap=24;
		Game.heavenlyBounds={left:0,right:0,top:0,bottom:0};
		Game.UpdateAscend=function()
		{
			if (Game.keys[37]) Game.AscendOffXT+=16*(1/Game.AscendZoomT);
			if (Game.keys[38]) Game.AscendOffYT+=16*(1/Game.AscendZoomT);
			if (Game.keys[39]) Game.AscendOffXT-=16*(1/Game.AscendZoomT);
			if (Game.keys[40]) Game.AscendOffYT-=16*(1/Game.AscendZoomT);
			
			if (Game.AscendOffXT>-Game.heavenlyBounds.left) Game.AscendOffXT=-Game.heavenlyBounds.left;
			if (Game.AscendOffXT<-Game.heavenlyBounds.right) Game.AscendOffXT=-Game.heavenlyBounds.right;
			if (Game.AscendOffYT>-Game.heavenlyBounds.top) Game.AscendOffYT=-Game.heavenlyBounds.top;
			if (Game.AscendOffYT<-Game.heavenlyBounds.bottom) Game.AscendOffYT=-Game.heavenlyBounds.bottom;
			Game.AscendOffX+=(Game.AscendOffXT-Game.AscendOffX)*0.5;
			Game.AscendOffY+=(Game.AscendOffYT-Game.AscendOffY)*0.5;
			Game.AscendZoom+=(Game.AscendZoomT-Game.AscendZoom)*0.25;
			if (Math.abs(Game.AscendZoomT-Game.AscendZoom)<0.005) Game.AscendZoom=Game.AscendZoomT;
			
			
			if (Game.mouseDown && !Game.promptOn)
			{
				if (!Game.AscendDragging)
				{
					Game.AscendDragX=Game.mouseX;
					Game.AscendDragY=Game.mouseY;
				}
				Game.AscendDragging=1;
				
				if (Game.DebuggingPrestige)
				{
					if (Game.SelectedHeavenlyUpgrade)
					{
						Game.tooltip.hide();
						//drag upgrades around
						var me=Game.SelectedHeavenlyUpgrade;
						me.posX+=(Game.mouseX-Game.AscendDragX)*(1/Game.AscendZoomT);
						me.posY+=(Game.mouseY-Game.AscendDragY)*(1/Game.AscendZoomT);
						var posX=me.posX;//Math.round(me.posX/Game.AscendGridSnap)*Game.AscendGridSnap;
						var posY=me.posY;//Math.round(me.posY/Game.AscendGridSnap)*Game.AscendGridSnap;
						l('heavenlyUpgrade'+me.id).style.left=Math.floor(posX)+'px';
						l('heavenlyUpgrade'+me.id).style.top=Math.floor(posY)+'px';
						for (var ii in me.parents)
						{
							var origX=0;
							var origY=0;
							var targX=me.posX+28;
							var targY=me.posY+28;
							if (me.parents[ii]!=-1) {origX=me.parents[ii].posX+28;origY=me.parents[ii].posY+28;}
							var rot=-(Math.atan((targY-origY)/(origX-targX))/Math.PI)*180;
							if (targX<=origX) rot+=180;
							var dist=Math.floor(Math.sqrt((targX-origX)*(targX-origX)+(targY-origY)*(targY-origY)));
							
							l('heavenlyLink'+me.id+'-'+ii).style='width:'+dist+'px;transform:rotate('+rot+'deg);left:'+(origX)+'px;top:'+(origY)+'px;';
						}
					}
				}
				if (!Game.SelectedHeavenlyUpgrade)
				{
					Game.AscendOffXT+=(Game.mouseX-Game.AscendDragX)*(1/Game.AscendZoomT);
					Game.AscendOffYT+=(Game.mouseY-Game.AscendDragY)*(1/Game.AscendZoomT);
				}
				Game.AscendDragX=Game.mouseX;
				Game.AscendDragY=Game.mouseY;
			}
			else
			{
				/*if (Game.SelectedHeavenlyUpgrade)
				{
					var me=Game.SelectedHeavenlyUpgrade;
					me.posX=Math.round(me.posX/Game.AscendGridSnap)*Game.AscendGridSnap;
					me.posY=Math.round(me.posY/Game.AscendGridSnap)*Game.AscendGridSnap;
					l('heavenlyUpgrade'+me.id).style.left=me.posX+'px';
					l('heavenlyUpgrade'+me.id).style.top=me.posY+'px';
				}*/
				Game.AscendDragging=0;
				Game.SelectedHeavenlyUpgrade=0;
			}
			if (Game.Click || Game.promptOn)
			{
				Game.AscendDragging=0;
			}
			
			//Game.ascendl.style.backgroundPosition=Math.floor(Game.AscendOffX/2)+'px '+Math.floor(Game.AscendOffY/2)+'px';
			//Game.ascendl.style.backgroundPosition=Math.floor(Game.AscendOffX/2)+'px '+Math.floor(Game.AscendOffY/2)+'px,'+Math.floor(Game.AscendOffX/4)+'px '+Math.floor(Game.AscendOffY/4)+'px';
			//Game.ascendContentl.style.left=Math.floor(Game.AscendOffX)+'px';
			//Game.ascendContentl.style.top=Math.floor(Game.AscendOffY)+'px';
			Game.ascendContentl.style.webkitTransform='translate('+Math.floor(Game.AscendOffX)+'px,'+Math.floor(Game.AscendOffY)+'px)';
			Game.ascendContentl.style.msTransform='translate('+Math.floor(Game.AscendOffX)+'px,'+Math.floor(Game.AscendOffY)+'px)';
			Game.ascendContentl.style.oTransform='translate('+Math.floor(Game.AscendOffX)+'px,'+Math.floor(Game.AscendOffY)+'px)';
			Game.ascendContentl.style.mozTransform='translate('+Math.floor(Game.AscendOffX)+'px,'+Math.floor(Game.AscendOffY)+'px)';
			Game.ascendContentl.style.transform='translate('+Math.floor(Game.AscendOffX)+'px,'+Math.floor(Game.AscendOffY)+'px)';
			Game.ascendZoomablel.style.webkitTransform='scale('+(Game.AscendZoom)+','+(Game.AscendZoom)+')';
			Game.ascendZoomablel.style.marginLeft=(Game.windowW/2)+'px';
			Game.ascendZoomablel.style.marginTop=(Game.windowH/2)+'px';
			Game.ascendZoomablel.style.msTransform='scale('+(Game.AscendZoom)+','+(Game.AscendZoom)+')';
			Game.ascendZoomablel.style.oTransform='scale('+(Game.AscendZoom)+','+(Game.AscendZoom)+')';
			Game.ascendZoomablel.style.mozTransform='scale('+(Game.AscendZoom)+','+(Game.AscendZoom)+')';
			Game.ascendZoomablel.style.transform='scale('+(Game.AscendZoom)+','+(Game.AscendZoom)+')';
			
			//if (Game.Scroll!=0) Game.ascendContentl.style.transformOrigin=Math.floor(Game.windowW/2-Game.mouseX)+'px '+Math.floor(Game.windowH/2-Game.mouseY)+'px';
			if (Game.Scroll<0 && !Game.promptOn) {Game.AscendZoomT=0.5;}
			if (Game.Scroll>0 && !Game.promptOn) {Game.AscendZoomT=1;}
			
			if (Game.T%2==0)
			{
				l('ascendPrestige').innerHTML=loc("Prestige level:")+'<br>'+SimpleBeautify(Game.prestige);
				l('ascendHCs').innerHTML=loc("Heavenly chips:")+'<br><span class="price heavenly">'+SimpleBeautify(Math.round(Game.heavenlyChipsDisplayed))+'</span>';
				if (Game.prestige>0) l('ascendModeButton').style.display='block';
				else l('ascendModeButton').style.display='none';
			}
			Game.heavenlyChipsDisplayed+=(Game.heavenlyChips-Game.heavenlyChipsDisplayed)*0.4;
			
			if (Game.DebuggingPrestige && Game.T%10==0)
			{
				var str='';
				for (var i in Game.PrestigeUpgrades)
				{
					var me=Game.PrestigeUpgrades[i];
					if (me.placedByCode) continue;
					str+=me.id+':['+Math.floor(me.posX)+','+Math.floor(me.posY)+'],';
				}
				l('upgradePositions').value='Game.UpgradePositions={'+str+'};';
			}
			//if (Game.T%5==0) Game.BuildAscendTree();
		}
		Game.AscendRefocus=function()
		{
			Game.AscendOffX=0;
			Game.AscendOffY=0;
			Game.ascendl.className='';
		}
		
		Game.SelectedHeavenlyUpgrade=0;
		Game.PurchaseHeavenlyUpgrade=function(what)
		{
			//if (Game.Has('Neuromancy')) Game.UpgradesById[what].toggle(); else
			if (Game.UpgradesById[what].buy())
			{
				if (l('heavenlyUpgrade'+what)){var rect=l('heavenlyUpgrade'+what).getBounds();Game.SparkleAt((rect.left+rect.right)/2,(rect.top+rect.bottom)/2-24);}
				//Game.BuildAscendTree();
			}
		}
		Game.BuildAscendTree=function(justBought)
		{
			var str='';
			Game.heavenlyBounds={left:0,right:0,top:0,bottom:0};

			if (Game.DebuggingPrestige) l('upgradePositions').style.display='block'; else l('upgradePositions').style.display='none';
			
			var toPop=[];
			for (var i in Game.PrestigeUpgrades)
			{
				var me=Game.PrestigeUpgrades[i];
				var prevCanBePurchased=me.canBePurchased;
				me.canBePurchased=1;
				if (!me.bought && !Game.DebuggingPrestige)
				{
					if (me.showIf && !me.showIf()) me.canBePurchased=0;
					else
					{
						for (var ii in me.parents)
						{
							if (me.parents[ii]!=-1 && !me.parents[ii].bought) me.canBePurchased=0;
						}
					}
				}
				if (justBought && me.parents.indexOf(justBought)!=-1 && !prevCanBePurchased && me.canBePurchased && !me.bought) toPop.push(me);
			}
			toPop.sort(function(parent){return function(a,b){
				var rot=Math.atan2(a.posY-parent.posY,parent.posX-a.posX)-Math.PI/2;
				var rot2=Math.atan2(b.posY-parent.posY,parent.posX-b.posX)-Math.PI/2;
				return rot<rot2;
			}}(justBought));
			for (var i=0;i<toPop.length;i++)
			{
				setTimeout(function(){PlaySound('snd/pop'+Math.floor(Math.random()*3+1)+'.mp3',0.5);},(0.2+i*0.1)*1000);
			}
			str+='<div class="crate upgrade heavenly enabled" style="position:absolute;left:-30px;top:-30px;opacity:0.8;pointer-events:none;transform:scale(1.3);background:transparent;"></div>';
			str+='<div class="crateBox" style="filter:none;-webkit-filter:none;">';//chrome is still bad at these
			for (var i in Game.PrestigeUpgrades)
			{
				var me=Game.PrestigeUpgrades[i];
				
				var ghosted=0;
				if (me.canBePurchased || Game.Has('Neuromancy'))
				{
					str+=Game.crate(me,'ascend','Game.PurchaseHeavenlyUpgrade('+me.id+');','heavenlyUpgrade'+me.id,toPop.indexOf(me)!=-1?('animation:pucker 0.2s ease-out;animation-delay:'+(toPop.indexOf(me)*0.1+0.2)+'s;'):'');
				}
				else
				{
					for (var ii in me.parents)
					{
						if (me.parents[ii]!=-1 && me.parents[ii].canBePurchased) ghosted=1;
					}
					if (me.showIf && !me.showIf()) ghosted=0;
					if (ghosted)
					{
						//maybe replace this with Game.crate()
						str+='<div class="crate upgrade heavenly ghosted" id="heavenlyUpgrade'+me.id+'" style="position:absolute;left:'+me.posX+'px;top:'+me.posY+'px;'+writeIcon(me.icon)+'"></div>';
					}
				}
				if (me.canBePurchased || Game.Has('Neuromancy') || ghosted)
				{
					if (me.posX<Game.heavenlyBounds.left) Game.heavenlyBounds.left=me.posX;
					if (me.posX>Game.heavenlyBounds.right) Game.heavenlyBounds.right=me.posX;
					if (me.posY<Game.heavenlyBounds.top) Game.heavenlyBounds.top=me.posY;
					if (me.posY>Game.heavenlyBounds.bottom) Game.heavenlyBounds.bottom=me.posY;
				}
				for (var ii in me.parents)//create pulsing links
				{
					if (me.parents[ii]!=-1 && (me.canBePurchased || ghosted))
					{
						var origX=0;
						var origY=0;
						var targX=me.posX+28;
						var targY=me.posY+28;
						if (me.parents[ii]!=-1) {origX=me.parents[ii].posX+28;origY=me.parents[ii].posY+28;}
						var rot=-(Math.atan((targY-origY)/(origX-targX))/Math.PI)*180;
						if (targX<=origX) rot+=180;
						var dist=Math.floor(Math.sqrt((targX-origX)*(targX-origX)+(targY-origY)*(targY-origY)));
						str+='<div class="parentLink" id="heavenlyLink'+me.id+'-'+ii+'" style="'+(ghosted?'opacity:0.1;':'')+'width:'+dist+'px;-webkit-transform:rotate('+rot+'deg);-moz-transform:rotate('+rot+'deg);-ms-transform:rotate('+rot+'deg);-o-transform:rotate('+rot+'deg);transform:rotate('+rot+'deg);left:'+(origX)+'px;top:'+(origY)+'px;"></div>';
					}
				}
			}
			Game.heavenlyBounds.left-=128;
			Game.heavenlyBounds.top-=128;
			Game.heavenlyBounds.right+=128+64;
			Game.heavenlyBounds.bottom+=128+64;
			//str+='<div style="border:1px solid red;position:absolute;left:'+Game.heavenlyBounds.left+'px;width:'+(Game.heavenlyBounds.right-Game.heavenlyBounds.left)+'px;top:'+Game.heavenlyBounds.top+'px;height:'+(Game.heavenlyBounds.bottom-Game.heavenlyBounds.top)+'px;"></div>';
			str+='</div>';
			Game.ascendUpgradesl.innerHTML=str;
			
			if (Game.DebuggingPrestige)
			{
				for (var i in Game.PrestigeUpgrades)
				{
					var me=Game.PrestigeUpgrades[i];
					AddEvent(l('heavenlyUpgrade'+me.id),'mousedown',function(me){return function(){
						if (!Game.DebuggingPrestige) return;
						if (Game.keys[16] && typeof LASTHEAVENLYSELECTED!=='undefined' && me!=LASTHEAVENLYSELECTED)
						{
							//when clicking an upgrade with ctrl, set it as reference point; clicking any sibling upgrade with shift will align it in a nice arc around their shared parent
							var parent=0;
							for (var i=0;i<me.parents.length;i++)
							{
								if (LASTHEAVENLYSELECTED.parents.indexOf(me.parents[i])!=-1) parent=me.parents[i];
							}
							if (parent)
							{
								var origX=parent.posX;var origY=parent.posY;
								var targX=LASTHEAVENLYSELECTED.posX;var targY=LASTHEAVENLYSELECTED.posY;
								var rot=Math.atan2(targY-origY,origX-targX)-Math.PI/2;
								var dist=Math.floor(Math.sqrt((targX-origX)*(targX-origX)+(targY-origY)*(targY-origY)));
								me.posX=parent.posX+Math.sin(rot-Math.PI*2/8)*dist;
								me.posY=parent.posY+Math.cos(rot-Math.PI*2/8)*dist;
							}
							LASTHEAVENLYSELECTED=me;console.log('Set reference point to',me.name,'.');
						}
						if (Game.keys[17]) {LASTHEAVENLYSELECTED=me;console.log('Set reference point to',me.name,'.');}
						Game.SelectedHeavenlyUpgrade=me;
					}}(me));
					AddEvent(l('heavenlyUpgrade'+me.id),'mouseup',function(me){return function(){
						if (Game.SelectedHeavenlyUpgrade==me) {Game.SelectedHeavenlyUpgrade=0;Game.BuildAscendTree();}
					}}(me));
				}
			}
			setTimeout(function(){Game.tooltip.shouldHide=true;},100);
		}
		
		/*=====================================================================================
		COALESCING SUGAR LUMPS
		=======================================================================================*/
		Game.lumpMatureAge=1;
		Game.lumpRipeAge=1;
		Game.lumpOverripeAge=1;
		Game.lumpCurrentType=0;
		l('comments').innerHTML=l('comments').innerHTML+
			'<div id="lumps" onclick="Game.clickLump();" '+Game.getDynamicTooltip('Game.lumpTooltip','bottom')+'><div id="lumpsIcon" class="usesIcon"></div><div id="lumpsIcon2" class="usesIcon"></div><div id="lumpsAmount">0</div></div>';
		Game.lumpTooltip=function()
		{
			var str='<div style="padding:8px;width:400px;font-size:11px;text-align:center;" id="tooltipLumps">'+
			loc("You have %1.",'<span class="price lump">'+loc("%1 sugar lump",LBeautify(Game.lumps))+'</span>')+
			'<div class="line"></div>'+
			loc("A <b>sugar lump</b> is coalescing here, attracted by your accomplishments.");
			
			var age=Date.now()-Game.lumpT;
			str+='<div class="line"></div>';
			if (age<0) str+=loc("This sugar lump has been exposed to time travel shenanigans and will take an excruciating <b>%1</b> to reach maturity.",Game.sayTime(((Game.lumpMatureAge-age)/1000+1)*Game.fps,-1));
			else if (age<Game.lumpMatureAge) str+=loc("This sugar lump is still growing and will take <b>%1</b> to reach maturity.",Game.sayTime(((Game.lumpMatureAge-age)/1000+1)*Game.fps,-1));
			else if (age<Game.lumpRipeAge) str+=loc("This sugar lump is mature and will be ripe in <b>%1</b>.<br>You may <b>click it to harvest it now</b>, but there is a <b>50% chance you won't get anything</b>.",Game.sayTime(((Game.lumpRipeAge-age)/1000+1)*Game.fps,-1));
			else if (age<Game.lumpOverripeAge) str+=loc("<b>This sugar lump is ripe! Click it to harvest it.</b><br>If you do nothing, it will auto-harvest in <b>%1</b>.",Game.sayTime(((Game.lumpOverripeAge-age)/1000+1)*Game.fps,-1));
			
			var phase=(age/Game.lumpOverripeAge)*7;
			if (phase>=3)
			{
				if (Game.lumpCurrentType!=0) str+='<div class="line"></div>';
				if (Game.lumpCurrentType==1) str+=loc("This sugar lump grew to be <b>bifurcated</b>; harvesting it has a 50% chance of yielding two lumps.");
				else if (Game.lumpCurrentType==2) str+=loc("This sugar lump grew to be <b>golden</b>; harvesting it will yield 2 to 7 lumps, your current cookies will be doubled (capped to a gain of 24 hours of your CpS), and you will find 10% more golden cookies for the next 24 hours.");
				else if (Game.lumpCurrentType==3) str+=loc("This sugar lump was affected by the elders and grew to be <b>meaty</b>; harvesting it will yield between 0 and 2 lumps.");
				else if (Game.lumpCurrentType==4) str+=loc("This sugar lump is <b>caramelized</b>, its stickiness binding it to unexpected things; harvesting it will yield between 1 and 3 lumps and will refill your sugar lump cooldowns.");
			}
			
			str+='<div class="line"></div>';
			str+=loc("Your sugar lumps mature after <b>%1</b>,<br>ripen after <b>%2</b>,<br>and fall after <b>%3</b>.",[Game.sayTime((Game.lumpMatureAge/1000)*Game.fps,-1),Game.sayTime((Game.lumpRipeAge/1000)*Game.fps,-1),Game.sayTime((Game.lumpOverripeAge/1000)*Game.fps,-1)]);
			
			str+='<div class="line"></div>'+loc("&bull; Sugar lumps can be harvested when mature, though if left alone beyond that point they will start ripening (increasing the chance of harvesting them) and will eventually fall and be auto-harvested after some time.<br>&bull; Sugar lumps are delicious and may be used as currency for all sorts of things.<br>&bull; Once a sugar lump is harvested, another one will start growing in its place.<br>&bull; Note that sugar lumps keep growing when the game is closed.")+'</div>';
			return str;
		}
		Game.computeLumpTimes=function()
		{
			var hour=1000*60*60;
			Game.lumpMatureAge=hour*20;
			Game.lumpRipeAge=hour*23;
			if (Game.Has('Stevia Caelestis')) Game.lumpRipeAge-=hour;
			if (Game.Has('Diabetica Daemonicus')) Game.lumpMatureAge-=hour;
			if (Game.Has('Ichor syrup')) Game.lumpMatureAge-=1000*60*7;
			if (Game.Has('Sugar aging process')) Game.lumpRipeAge-=6000*Math.min(600,Game.Objects['Grandma'].amount);//capped at 600 grandmas
			if (Game.hasGod && Game.BuildingsOwned%10==0)
			{
				var godLvl=Game.hasGod('order');
				if (godLvl==1) Game.lumpRipeAge-=hour;
				else if (godLvl==2) Game.lumpRipeAge-=(hour/3)*2;
				else if (godLvl==3) Game.lumpRipeAge-=(hour/3);
			}
			//if (Game.hasAura('Dragon\'s Curve')) {Game.lumpMatureAge/=1.05;Game.lumpRipeAge/=1.05;}
			Game.lumpMatureAge/=1+Game.auraMult('Dragon\'s Curve')*0.05;Game.lumpRipeAge/=1+Game.auraMult('Dragon\'s Curve')*0.05;
			Game.lumpOverripeAge=Game.lumpRipeAge+hour;
			if (Game.Has('Glucose-charged air')) {Game.lumpMatureAge/=2000;Game.lumpRipeAge/=2000;Game.lumpOverripeAge/=2000;}
		}
		Game.loadLumps=function(time)
		{
			Game.computeLumpTimes();
			//Game.computeLumpType();
			if (!Game.canLumps()) Game.removeClass('lumpsOn');
			else
			{
				if (Game.ascensionMode!=1) Game.addClass('lumpsOn');
				Game.lumpT=Math.min(Date.now(),Game.lumpT);
				var age=Math.max(Date.now()-Game.lumpT,0);
				var amount=Math.floor(age/Game.lumpOverripeAge);//how many lumps did we harvest since we closed the game?
				if (amount>=1)
				{
					Game.harvestLumps(1,true);
					Game.lumpCurrentType=0;//all offline lumps after the first one have a normal type
					if (amount>1) Game.harvestLumps(amount-1,true);
					Game.Notify('',loc("You harvested <b>%1</b> while you were away.",loc("%1 sugar lump",LBeautify(amount))),[29,14]);
					Game.lumpT=Date.now()-(age-amount*Game.lumpOverripeAge);
					Game.computeLumpType();
				}
			}
		}
		Game.gainLumps=function(total)
		{
			if (Game.lumpsTotal==-1){Game.lumpsTotal=0;Game.lumps=0;}
			Game.lumps+=total;
			Game.lumpsTotal+=total;
			
			if (Game.lumpsTotal>=7) Game.Win('Dude, sweet');
			if (Game.lumpsTotal>=30) Game.Win('Sugar rush');
			if (Game.lumpsTotal>=365) Game.Win('Year\'s worth of cavities');
		}
		Game.clickLump=function()
		{
			triggerAnim(l('lumpsIcon'),'pucker');
			triggerAnim(l('lumpsIcon2'),'pucker');
			if (!Game.canLumps()) return;
			var age=Date.now()-Game.lumpT;
			if (age<Game.lumpMatureAge) {}
			else if (age<Game.lumpRipeAge)
			{
				var amount=choose([0,1]);
				if (amount!=0) Game.Win('Hand-picked');
				Game.harvestLumps(amount);
				Game.computeLumpType();
			}
			else if (age<Game.lumpOverripeAge)
			{
				Game.harvestLumps(1);
				Game.computeLumpType();
			}
		}
		Game.harvestLumps=function(amount,silent)
		{
			if (!Game.canLumps()) return;
			Game.lumpT=Date.now();
			var total=amount;
			if (Game.lumpCurrentType==1 && Game.Has('Sucralosia Inutilis') && Math.random()<0.05) total*=2;
			else if (Game.lumpCurrentType==1) total*=choose([1,2]);
			else if (Game.lumpCurrentType==2)
			{
				total*=choose([2,3,4,5,6,7]);
				Game.gainBuff('sugar blessing',24*60*60,1);
				Game.Earn(Math.min(Game.cookiesPs*60*60*24,Game.cookies));
				Game.Notify(loc("Sugar blessing activated!"),loc("Your cookies have been doubled.<br>+10% golden cookies for the next 24 hours."),[29,16]);
			}
			else if (Game.lumpCurrentType==3) total*=choose([0,0,1,2,2]);
			else if (Game.lumpCurrentType==4)
			{
				total*=choose([1,2,3]);
				Game.lumpRefill=0;//Date.now()-Game.getLumpRefillMax();
				Game.Notify(loc("Sugar lump cooldowns cleared!"),'',[29,27]);
			}
			total=Math.floor(total);
			Game.gainLumps(total);
			if (Game.lumpCurrentType==1) Game.Win('Sugar sugar');
			else if (Game.lumpCurrentType==2) Game.Win('All-natural cane sugar');
			else if (Game.lumpCurrentType==3) Game.Win('Sweetmeats');
			else if (Game.lumpCurrentType==4) Game.Win('Maillard reaction');
			
			if (!silent)
			{
				var rect=l('lumpsIcon2').getBounds();Game.SparkleAt((rect.left+rect.right)/2,(rect.top+rect.bottom)/2-24+32-TopBarOffset);
				if (total>0) Game.Popup('<small>+'+loc("%1 sugar lump",LBeautify(total))+'</small>',(rect.left+rect.right)/2,(rect.top+rect.bottom)/2-48);
				else Game.Popup('<small>'+loc("Botched harvest!")+'</small>',(rect.left+rect.right)/2,(rect.top+rect.bottom)/2-48);
				PlaySound('snd/pop'+Math.floor(Math.random()*3+1)+'.mp3',0.75);
			}
			Game.computeLumpTimes();
		}
		Game.computeLumpType=function()
		{
			Math.seedrandom(Game.seed+'/'+Game.lumpT);
			var types=[0];
			var loop=1;
			//if (Game.hasAura('Dragon\'s Curve')) loop=2;
			loop+=Game.auraMult('Dragon\'s Curve');
			loop=randomFloor(loop);
			for (var i=0;i<loop;i++)
			{
				if (Math.random()<(Game.Has('Sucralosia Inutilis')?0.15:0.1)) types.push(1);//bifurcated
				if (Math.random()<3/1000) types.push(2);//golden
				if (Math.random()<0.1*Game.elderWrath) types.push(3);//meaty
				if (Math.random()<1/50) types.push(4);//caramelized
			}
			Game.lumpCurrentType=choose(types);
			Math.seedrandom();
		}
		
		Game.canLumps=function()//grammatically pleasing function name
		{
			if (Game.lumpsTotal>-1 || (Game.ascensionMode!=1 && (Game.cookiesEarned+Game.cookiesReset)>=1000000000)) return true;
			return false;
		}
		
		Game.getLumpRefillMax=function()
		{
			return Game.fps*60*15;//1000*60*15;//15 minutes
		}
		Game.getLumpRefillRemaining=function()
		{
			return Game.lumpRefill;//Game.getLumpRefillMax()-(Date.now()-Game.lumpRefill);
		}
		Game.canRefillLump=function()
		{
			return Game.lumpRefill<=0;//((Date.now()-Game.lumpRefill)>=Game.getLumpRefillMax());
		}
		Game.refillLump=function(n,func)
		{
			if (Game.lumps>=n && Game.canRefillLump())
			{
				Game.spendLump(n,'refill',function()
				{
					if (!Game.sesame) Game.lumpRefill=Game.getLumpRefillMax();//Date.now();
					func();
				})();
			}
		}
		Game.spendLump=function(n,str,func,free)
		{
			//ask if we want to spend N lumps (unless free)
			return function()
			{
				if (!free && Game.lumps<n) return false;
				if (!free && Game.prefs.askLumps)
				{
					PlaySound('snd/tick.mp3');
					Game.promptConfirmFunc=func;//bit dumb
					Game.Prompt('<id SpendLump><div class="icon" style="background:url(img/icons.webp?v='+Game.version+');float:left;margin-left:-8px;margin-top:-8px;background-position:'+(-29*48)+'px '+(-14*48)+'px;"></div><div style="margin:16px 8px;">'+loc("Do you want to spend %1 to %2?",['<b>'+loc("%1 sugar lump",LBeautify(n))+'</b>',str])+'</div>',[[loc("Yes"),'Game.lumps-='+n+';Game.promptConfirmFunc();Game.promptConfirmFunc=0;Game.recalculateGains=1;Game.ClosePrompt();'],loc("No")]);
					return false;
				}
				else
				{
					if (!free) Game.lumps-=n;
					func();
					Game.recalculateGains=1;
				}
			}
		}
		
		Game.doLumps=function()
		{
			if (Game.lumpRefill>0) Game.lumpRefill--;
			
			if (!Game.canLumps()) {Game.removeClass('lumpsOn');return;}
			if (Game.lumpsTotal==-1)
			{
				//first time !
				if (Game.ascensionMode!=1) Game.addClass('lumpsOn');
				Game.lumpT=Date.now();
				Game.lumpsTotal=0;
				Game.lumps=0;
				Game.computeLumpType();
				
				Game.Notify(loc("Sugar lumps!"),loc("Because you've baked a <b>billion cookies</b> in total, you are now attracting <b>sugar lumps</b>. They coalesce quietly near the top of your screen, under the Stats button.<br>You will be able to harvest them when they're ripe, after which you may spend them on all sorts of things!"),[23,14]);
			}
			var age=Date.now()-Game.lumpT;
			if (age>Game.lumpOverripeAge)
			{
				age=0;
				Game.harvestLumps(1);
				Game.computeLumpType();
			}
			
			var phase=Math.min(6,Math.floor((age/Game.lumpOverripeAge)*7));
			var phase2=Math.min(6,Math.floor((age/Game.lumpOverripeAge)*7)+1);
			var row=14;
			var row2=14;
			var type=Game.lumpCurrentType;
			if (type==1)//double
			{
				//if (phase>=6) row=15;
				if (phase2>=6) row2=15;
			}
			else if (type==2)//golden
			{
				if (phase>=4) row=16;
				if (phase2>=4) row2=16;
			}
			else if (type==3)//meaty
			{
				if (phase>=4) row=17;
				if (phase2>=4) row2=17;
			}
			else if (type==4)//caramelized
			{
				if (phase>=4) row=27;
				if (phase2>=4) row2=27;
			}
			var icon=[23+Math.min(phase,5),row];
			var icon2=[23+phase2,row2];
			if (age<0){icon=[17,5];icon2=[17,5];}
			var opacity=Math.min(6,(age/Game.lumpOverripeAge)*7)%1;
			if (phase>=6) {opacity=1;}
			l('lumpsIcon').style.backgroundPosition=(-icon[0]*48)+'px '+(-icon[1]*48)+'px';
			l('lumpsIcon2').style.backgroundPosition=(-icon2[0]*48)+'px '+(-icon2[1]*48)+'px';
			l('lumpsIcon2').style.opacity=opacity;
			l('lumpsAmount').textContent=Beautify(Game.lumps);
		}
		
		/*=====================================================================================
		COOKIE ECONOMICS
		=======================================================================================*/
		Game.Earn=function(howmuch)
		{
			Game.cookies+=howmuch;
			Game.cookiesEarned+=howmuch;
		}
		Game.Spend=function(howmuch)
		{
			Game.cookies-=howmuch;
		}
		Game.Dissolve=function(howmuch)
		{
			Game.cookies-=howmuch;
			Game.cookiesEarned-=howmuch;
			Game.cookies=Math.max(0,Game.cookies);
			Game.cookiesEarned=Math.max(0,Game.cookiesEarned);
		}
		Game.mouseCps=function()
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
			var mult=1;
			
			
			if (Game.Has('Santa\'s helpers')) mult*=1.1;
			if (Game.Has('Cookie egg')) mult*=1.1;
			if (Game.Has('Halo gloves')) mult*=1.1;
			if (Game.Has('Dragon claw')) mult*=1.03;
			
			if (Game.Has('Aura gloves'))
			{
				mult*=1+0.05*Math.min(Game.Objects['Cursor'].level,Game.Has('Luminous gloves')?20:10);
			}
			
			mult*=Game.eff('click');
			
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
		Game.computedMouseCps=1;
		Game.globalCpsMult=1;
		Game.unbuffedCps=0;
		Game.buildingCps=0;
		Game.lastClick=0;
		Game.CanClick=1;
		Game.autoclickerDetected=0;
		Game.BigCookieState=0;//0 = normal, 1 = clicked (small), 2 = released/hovered (big)
		Game.BigCookieSize=0;
		Game.BigCookieSizeD=0;
		Game.BigCookieSizeT=1;
		Game.cookieClickSound=Math.floor(Math.random()*7)+1;
		Game.playCookieClickSound=function()
		{
			if (Game.prefs.cookiesound) PlaySound('snd/clickb'+(Game.cookieClickSound)+'.mp3',0.5);
			else PlaySound('snd/click'+(Game.cookieClickSound)+'.mp3',0.5);
			Game.cookieClickSound+=Math.floor(Math.random()*4)+1;
			if (Game.cookieClickSound>7) Game.cookieClickSound-=7;
		}
		Game.ClickCookie=function(e,amount)
		{
			var now=Date.now();
			if (e) e.preventDefault();
			if (Game.OnAscend || Game.AscendTimer>0 || Game.T<3 || now-Game.lastClick<1000/((e?e.detail:1)===0?3:50)) {}
			else
			{
				if (now-Game.lastClick<(1000/15))
				{
					Game.autoclickerDetected+=Game.fps;
					if (Game.autoclickerDetected>=Game.fps*5) Game.Win('Uncanny clicker');
				}
				Game.loseShimmeringVeil('click');
				var amount=amount?amount:Game.computedMouseCps;
				Game.Earn(amount);
				Game.handmadeCookies+=amount;
				if (Game.prefs.particles)
				{
					Game.particleAdd();
					Game.particleAdd(Game.mouseX,Game.mouseY,Math.random()*4-2,Math.random()*-2-2,Math.random()*0.5+0.75,1,2);
				}
				if (Game.prefs.numbers) Game.particleAdd(Game.mouseX+Math.random()*8-4,Game.mouseY-8+Math.random()*8-4,0,-2,1,4,2,'','+'+Beautify(amount,1));
				
				Game.runModHook('click');
				
				Game.playCookieClickSound();
				Game.cookieClicks++;
				
				if (Game.clicksThisSession==0) PlayCue('preplay');
				Game.clicksThisSession++;
				Game.lastClick=now;
			}
			Game.Click=0;
		}
		Game.mouseX=0;
		Game.mouseY=0;
		Game.mouseX2=0;
		Game.mouseY2=0;
		Game.mouseMoved=0;
		Game.GetMouseCoords=function(e)
		{
			var posx=0;
			var posy=0;
			if (!e) var e=window.event;
			if (e.pageX||e.pageY)
			{
				posx=e.pageX;
				posy=e.pageY;
			}
			else if (e.clientX || e.clientY)
			{
				posx=e.clientX+document.body.scrollLeft+document.documentElement.scrollLeft;
				posy=e.clientY+document.body.scrollTop+document.documentElement.scrollTop;
			}
			var x=0;
			var y=TopBarOffset;
			/*
			var el=l('sectionLeft');
			while(el && !isNaN(el.offsetLeft) && !isNaN(el.offsetTop))
			{
				x+=el.offsetLeft-el.scrollLeft;
				y+=el.offsetTop-el.scrollTop;
				el=el.offsetParent;
			}*/
			Game.mouseX2=Game.mouseX;
			Game.mouseY2=Game.mouseY;
			Game.mouseX=(posx-x)/Game.scale;
			Game.mouseY=(posy-y)/Game.scale;
			Game.mouseMoved=1;
			Game.lastActivity=Game.time;
		}
		var bigCookie=l('bigCookie');
		if (Game.prefs.screenreader)
		{
			bigCookie.ariaLabelledby='bigCookieLabel';
			bigCookie.insertAdjacentHTML('beforeend','<label id="bigCookieLabel" style="font-size:100px !important;" class="srOnly">'+loc("Big clickable cookie")+'</label>');
			bigCookie.tabIndex=1;
		}
		Game.Click=0;
		Game.lastClickedEl=0;
		Game.clicksThisSession=0;
		Game.clickFrom=0;
		Game.Scroll=0;
		Game.mouseDown=0;
		if (!Game.touchEvents)
		{
			AddEvent(bigCookie,'click',Game.ClickCookie);
			AddEvent(bigCookie,'mousedown',function(event){Game.BigCookieState=1;if (Game.prefs.cookiesound) {Game.playCookieClickSound();}if (event) event.preventDefault();});
			AddEvent(bigCookie,'mouseup',function(event){Game.BigCookieState=2;if (event) event.preventDefault();});
			AddEvent(bigCookie,'mouseout',function(event){Game.BigCookieState=0;});
			AddEvent(bigCookie,'mouseover',function(event){Game.BigCookieState=2;});
			AddEvent(document,'mousemove',Game.GetMouseCoords);
			AddEvent(document,'mousedown',function(event){Game.lastActivity=Game.time;Game.mouseDown=1;Game.clickFrom=event.target;});
			AddEvent(document,'mouseup',function(event){Game.lastActivity=Game.time;Game.mouseDown=0;Game.clickFrom=0;});
			AddEvent(document,'click',function(event){Game.lastActivity=Game.time;Game.Click=1;Game.lastClickedEl=event.target;Game.clickFrom=0;});
			Game.handleScroll=function(e)
			{
				if (!e) e=event;
				Game.Scroll=(e.detail<0||e.wheelDelta>0)?1:-1;
				Game.lastActivity=Game.time;
			};
			AddEvent(document,'DOMMouseScroll',Game.handleScroll);
			AddEvent(document,'mousewheel',Game.handleScroll);
		}
		else
		{
			//touch events
			AddEvent(bigCookie,'touchend',Game.ClickCookie);
			AddEvent(bigCookie,'touchstart',function(event){Game.BigCookieState=1;if (event) event.preventDefault();});
			AddEvent(bigCookie,'touchend',function(event){Game.BigCookieState=0;if (event) event.preventDefault();});
			//AddEvent(document,'touchmove',Game.GetMouseCoords);
			AddEvent(document,'mousemove',Game.GetMouseCoords);
			AddEvent(document,'touchstart',function(event){Game.lastActivity=Game.time;Game.mouseDown=1;});
			AddEvent(document,'touchend',function(event){Game.lastActivity=Game.time;Game.mouseDown=0;});
			AddEvent(document,'touchend',function(event){Game.lastActivity=Game.time;Game.Click=1;});
		}
		
		Game.keys=[];
		AddEvent(window,'keyup',function(e){
			Game.lastActivity=Game.time;
			if (e.keyCode==27)
			{
				if (Game.promptOn) {Game.ClosePrompt();PlaySound('snd/tickOff.mp3');}
				if (Game.AscendTimer>0) Game.AscendTimer=Game.AscendDuration;
			}//esc closes prompt
			if (Game.promptOn)
			{
				if (e.keyCode==13) Game.ConfirmPrompt();//enter confirms prompt
			}
			Game.keys[e.keyCode]=0;
		});
		AddEvent(window,'keydown',function(e){
			if (Game.promptOn)
			{
				if (e.keyCode==9)
				{
					//tab to shift through prompt buttons
					if (e.shiftKey) Game.FocusPromptOption(-1);
					else Game.FocusPromptOption(1);
					e.preventDefault();
				}
			}
			if (!Game.OnAscend && Game.AscendTimer==0)
			{
				if (e.ctrlKey && e.keyCode==83) {Game.toSave=true;e.preventDefault();}//ctrl-s saves the game
				else if (e.ctrlKey && e.keyCode==79) {Game.ImportSave();e.preventDefault();}//ctrl-o opens the import menu
			}
			if ((e.keyCode==16 || e.keyCode==17) && Game.tooltip.dynamic) Game.tooltip.update();
			Game.keys[e.keyCode]=1;
			if (e.keyCode==9) Game.keys=[];//reset keys on tab press
		});
		
		AddEvent(window,'visibilitychange',function(e){
			Game.keys=[];//reset all key pressed on visibility change (should help prevent ctrl still being down after ctrl-tab)
		});
		
		/*=====================================================================================
		CPS RECALCULATOR
		=======================================================================================*/
		
		Game.heavenlyPower=1;//how many CpS percents a single heavenly chip gives
		Game.recalculateGains=1;
		Game.cookiesPsByType={};
		Game.cookiesMultByType={};
		//display bars with http://codepen.io/anon/pen/waGyEJ
		Game.effs={};
		Game.eff=function(name,def){if (typeof Game.effs[name]==='undefined') return (typeof def==='undefined'?1:def); else return Game.effs[name];};
		
		Game.CalculateGains=function()
		{
			Game.cookiesPs=0;
			var mult=1;
			//add up effect bonuses from building minigames
			var effs={};
			for (var i in Game.Objects)
			{
				if (Game.Objects[i].minigameLoaded && Game.Objects[i].minigame.effs)
				{
					var myEffs=Game.Objects[i].minigame.effs;
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
			
			for (var i in Game.cookieUpgrades)
			{
				var me=Game.cookieUpgrades[i];
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
			
			for (var i in Game.Objects)
			{
				var me=Game.Objects[i];
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
			
			//if (Game.hasAura('Radiant Appetite')) mult*=2;
			mult*=1+Game.auraMult('Radiant Appetite');
			
			var rawCookiesPs=Game.cookiesPs*mult;
			for (var i in Game.CpsAchievements)
			{
				if (rawCookiesPs>=Game.CpsAchievements[i].threshold) Game.Win(Game.CpsAchievements[i].name);
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
			for (var i in Game.wrinklers)
			{
				if (Game.wrinklers[i].phase==2)
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
					for (var i in upgrades) {if (Game.Has(upgrades[i])) goldenSwitchMult+=0.1;}
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
			
			for (var i in Game.buffs)
			{
				if (typeof Game.buffs[i].multCpS!=='undefined') mult*=Game.buffs[i].multCpS;
			}
			
			Game.globalCpsMult=mult;
			Game.cookiesPs*=Game.globalCpsMult;
			
			//if (Game.hasBuff('Cursed finger')) Game.cookiesPs=0;
			
			Game.computedMouseCps=Game.mouseCps();
			
			Game.computeLumpTimes();
			
			Game.recalculateGains=0;
		}
		
		Game.dropRateMult=function()
		{
			var rate=1;
			if (Game.Has('Green yeast digestives')) rate*=1.03;
			if (Game.Has('Dragon teddy bear')) rate*=1.03;
			rate*=Game.eff('itemDrops');
			//if (Game.hasAura('Mind Over Matter')) rate*=1.25;
			rate*=1+Game.auraMult('Mind Over Matter')*0.25;
			if (Game.Has('Santa\'s bottomless bag')) rate*=1.1;
			if (Game.Has('Cosmic beginner\'s luck') && !Game.Has('Heavenly chip secret')) rate*=5;
			return rate;
		}
		/*=====================================================================================
		SHIMMERS (GOLDEN COOKIES & SUCH)
		=======================================================================================*/
		Game.shimmersL=l('shimmers');
		Game.shimmers=[];//all shimmers currently on the screen
		Game.shimmersN=Math.floor(Math.random()*10000);
		Game.shimmer=function(type,obj,noCount)
		{
			this.type=type;
			
			this.l=document.createElement('div');
			this.l.className='shimmer';
			if (!Game.touchEvents) {AddEvent(this.l,'click',function(what){return function(event){what.pop(event);};}(this));}
			else {AddEvent(this.l,'touchend',function(what){return function(event){what.pop(event);};}(this));}//touch events
			
			this.x=0;
			this.y=0;
			this.id=Game.shimmersN;
			
			this.force='';
			this.forceObj=obj||0;
			if (this.forceObj.type) this.force=this.forceObj.type;
			this.noCount=noCount;
			if (!this.noCount) {Game.shimmerTypes[this.type].n++;Game.recalculateGains=1;}
			
			this.init();
			
			Game.shimmersL.appendChild(this.l);
			Game.shimmers.push(this);
			Game.shimmersN++;
		}
		Game.shimmer.prototype.init=function()//executed when the shimmer is created
		{
			Game.shimmerTypes[this.type].initFunc(this);
		}
		Game.shimmer.prototype.update=function()//executed every frame
		{
			Game.shimmerTypes[this.type].updateFunc(this);
		}
		Game.shimmer.prototype.pop=function(event)//executed when the shimmer is popped by the player
		{
			if (event) event.preventDefault();
			Game.loseShimmeringVeil('shimmer');
			Game.Click=0;
			Game.shimmerTypes[this.type].popFunc(this);
		}
		Game.shimmer.prototype.die=function()//executed after the shimmer disappears (from old age or popping)
		{
			if (Game.shimmerTypes[this.type].spawnsOnTimer && this.spawnLead)
			{
				//if this was the spawn lead for this shimmer type, set the shimmer type's "spawned" to 0 and restart its spawn timer
				var type=Game.shimmerTypes[this.type];
				type.time=0;
				type.spawned=0;
				type.minTime=type.getMinTime(this);
				type.maxTime=type.getMaxTime(this);
			}
			Game.shimmersL.removeChild(this.l);
			if (Game.shimmers.indexOf(this)!=-1) Game.shimmers.splice(Game.shimmers.indexOf(this),1);
			if (!this.noCount) {Game.shimmerTypes[this.type].n=Math.max(0,Game.shimmerTypes[this.type].n-1);Game.recalculateGains=1;}
		}
		
		
		Game.updateShimmers=function()//run shimmer functions, kill overtimed shimmers and spawn new ones
		{
			for (var i in Game.shimmers)
			{
				Game.shimmers[i].update();
			}
			
			//cookie storm!
			if (Game.hasBuff('Cookie storm') && Math.random()<0.5)
			{
				var newShimmer=new Game.shimmer('golden',{type:'cookie storm drop'},1);
				newShimmer.dur=Math.ceil(Math.random()*4+1);
				newShimmer.life=Math.ceil(Game.fps*newShimmer.dur);
				//newShimmer.force='cookie storm drop';
				newShimmer.sizeMult=Math.random()*0.75+0.25;
			}
			
			//spawn shimmers
			for (var i in Game.shimmerTypes)
			{
				var me=Game.shimmerTypes[i];
				if (me.spawnsOnTimer && me.spawnConditions())//only run on shimmer types that work on a timer
				{
					if (!me.spawned)//no shimmer spawned for this type? check the timer and try to spawn one
					{
						me.time++;
						if (Math.random()<Math.pow(Math.max(0,(me.time-me.minTime)/(me.maxTime-me.minTime)),5))
						{
							var newShimmer=new Game.shimmer(i);
							newShimmer.spawnLead=1;
							if (Game.Has('Distilled essence of redoubled luck') && Math.random()<0.01) var newShimmer=new Game.shimmer(i);
							me.spawned=1;
						}
					}
				}
			}
		}
		Game.killShimmers=function()//stop and delete all shimmers (used on resetting etc)
		{
			for (var i=Game.shimmers.length-1;i>=0;i--)
			{
				Game.shimmers[i].die();
			}
			for (var i in Game.shimmerTypes)
			{
				var me=Game.shimmerTypes[i];
				if (me.reset) me.reset();
				me.n=0;
				if (me.spawnsOnTimer)
				{
					me.time=0;
					me.spawned=0;
					me.minTime=me.getMinTime(me);
					me.maxTime=me.getMaxTime(me);
				}
			}
		}
		
		Game.shimmerTypes={
			//in these, "me" refers to the shimmer itself, and "this" to the shimmer's type object
			'golden':{
				reset:function()
				{
					this.chain=0;
					this.totalFromChain=0;
					this.last='';
				},
				initFunc:function(me)
				{
					if (!this.spawned && me.force!='cookie storm drop' && Game.chimeType!=0 && Game.ascensionMode!=1) Game.playGoldenCookieChime();
					
					//set image
					var bgPic='img/goldCookie.webp';
					var picX=0;var picY=0;
					
					
					if ((!me.forceObj || !me.forceObj.noWrath) && ((me.forceObj && me.forceObj.wrath) || (Game.elderWrath==1 && Math.random()<1/3) || (Game.elderWrath==2 && Math.random()<2/3) || (Game.elderWrath==3) || (Game.hasGod && Game.hasGod('scorn'))))
					{
						me.wrath=1;
						if (Game.season=='halloween') bgPic='img/spookyCookie.webp';
						else bgPic='img/wrathCookie.webp';
					}
					else
					{
						me.wrath=0;
					}
					
					if (Game.season=='valentines')
					{
						bgPic='img/hearts.webp';
						picX=Math.floor(Math.random()*8);
					}
					else if (Game.season=='fools')
					{
						bgPic='img/contract.webp';
						if (me.wrath) bgPic='img/wrathContract.webp';
					}
					else if (Game.season=='easter')
					{
						bgPic='img/bunnies.webp';
						picX=Math.floor(Math.random()*4);
						picY=0;
						if (me.wrath) picY=1;
					}
					
					me.x=Math.floor(Math.random()*Math.max(0,(Game.bounds.right-300)-Game.bounds.left-128)+Game.bounds.left+64)-64;
					me.y=Math.floor(Math.random()*Math.max(0,Game.bounds.bottom-Game.bounds.top-128)+Game.bounds.top+64)-64;
					me.l.style.left=me.x+'px';
					me.l.style.top=me.y+'px';
					me.l.style.width='96px';
					me.l.style.height='96px';
					me.l.style.backgroundImage='url('+bgPic+')';
					me.l.style.backgroundPosition=(-picX*96)+'px '+(-picY*96)+'px';
					me.l.style.opacity='0';
					me.l.style.display='block';
					me.l.setAttribute('alt',loc(me.wrath?"Wrath cookie":"Golden cookie"));
					
					me.life=1;//the cookie's current progression through its lifespan (in frames)
					me.dur=13;//duration; the cookie's lifespan in seconds before it despawns
					
					var dur=13;
					if (Game.Has('Lucky day')) dur*=2;
					if (Game.Has('Serendipity')) dur*=2;
					if (Game.Has('Decisive fate')) dur*=1.05;
					if (Game.Has('Lucky digit')) dur*=1.01;
					if (Game.Has('Lucky number')) dur*=1.01;
					if (Game.Has('Lucky payout')) dur*=1.01;
					if (!me.wrath) dur*=Game.eff('goldenCookieDur');
					else dur*=Game.eff('wrathCookieDur');
					dur*=Math.pow(0.95,Game.shimmerTypes['golden'].n-1);//5% shorter for every other golden cookie on the screen
					if (this.chain>0) dur=Math.max(2,10/this.chain);//this is hilarious
					me.dur=dur;
					me.life=Math.ceil(Game.fps*me.dur);
					me.sizeMult=1;
				},
				updateFunc:function(me)
				{
					var curve=1-Math.pow((me.life/(Game.fps*me.dur))*2-1,4);
					me.l.style.opacity=curve;
					//this line makes each golden cookie pulse in a unique way
					if (Game.prefs.fancy) me.l.style.transform='rotate('+(Math.sin(me.id*0.69)*24+Math.sin(Game.T*(0.35+Math.sin(me.id*0.97)*0.15)+me.id/*+Math.sin(Game.T*0.07)*2+2*/)*(3+Math.sin(me.id*0.36)*2))+'deg) scale('+(me.sizeMult*(1+Math.sin(me.id*0.53)*0.2)*curve*(1+(0.06+Math.sin(me.id*0.41)*0.05)*(Math.sin(Game.T*(0.25+Math.sin(me.id*0.73)*0.15)+me.id))))+')';
					me.life--;
					if (me.life<=0) {this.missFunc(me);me.die();}
				},
				popFunc:function(me)
				{
					//get achievs and stats
					if (me.spawnLead)
					{
						Game.goldenClicks++;
						Game.goldenClicksLocal++;
						
						if (Game.goldenClicks>=1) Game.Win('Golden cookie');
						if (Game.goldenClicks>=7) Game.Win('Lucky cookie');
						if (Game.goldenClicks>=27) Game.Win('A stroke of luck');
						if (Game.goldenClicks>=77) Game.Win('Fortune');
						if (Game.goldenClicks>=777) Game.Win('Leprechaun');
						if (Game.goldenClicks>=7777) Game.Win('Black cat\'s paw');
						if (Game.goldenClicks>=27777) Game.Win('Seven horseshoes');
						
						if (Game.goldenClicks>=7) Game.Unlock('Lucky day');
						if (Game.goldenClicks>=27) Game.Unlock('Serendipity');
						if (Game.goldenClicks>=77) Game.Unlock('Get lucky');
						
						if ((me.life/Game.fps)>(me.dur-1)) Game.Win('Early bird');
						if (me.life<Game.fps) Game.Win('Fading luck');
					}
					
					if (Game.forceUnslotGod)
					{
						if (Game.forceUnslotGod('asceticism')) Game.useSwap(1000000);
					}
					
					//select an effect
					var list=[];
					if (me.wrath>0) list.push('clot','multiply cookies','ruin cookies');
					else list.push('frenzy','multiply cookies');
					if (me.wrath>0 && Game.hasGod && Game.hasGod('scorn')) list.push('clot','ruin cookies','clot','ruin cookies');
					if (me.wrath>0 && Math.random()<0.3) list.push('blood frenzy','chain cookie','cookie storm');
					else if (Math.random()<0.03 && Game.cookiesEarned>=100000) list.push('chain cookie','cookie storm');
					if (Math.random()<0.05 && Game.season=='fools') list.push('everything must go');
					if (Math.random()<0.1 && (Math.random()<0.05 || !Game.hasBuff('Dragonflight'))) list.push('click frenzy');
					if (me.wrath && Math.random()<0.1) list.push('cursed finger');
					
					if (Game.BuildingsOwned>=10 && Math.random()<0.25) list.push('building special');
					
					if (Game.canLumps() && Math.random()<0.0005) list.push('free sugar lump');
					
					if ((me.wrath==0 && Math.random()<0.15) || Math.random()<0.05)
					{
						//if (Game.hasAura('Reaper of Fields')) list.push('dragon harvest');
						if (Math.random()<Game.auraMult('Reaper of Fields')) list.push('dragon harvest');
						//if (Game.hasAura('Dragonflight')) list.push('dragonflight');
						if (Math.random()<Game.auraMult('Dragonflight')) list.push('dragonflight');
					}
					
					if (this.last!='' && Math.random()<0.8 && list.indexOf(this.last)!=-1) list.splice(list.indexOf(this.last),1);//80% chance to force a different one
					if (Math.random()<0.0001) list.push('blab');
					var choice=choose(list);
					
					if (this.chain>0) choice='chain cookie';
					if (me.force!='') {this.chain=0;choice=me.force;me.force='';}
					if (choice!='chain cookie') this.chain=0;
					
					this.last=choice;
					
					//create buff for effect
					//buff duration multiplier
					var effectDurMod=1;
					if (Game.Has('Get lucky')) effectDurMod*=2;
					if (Game.Has('Lasting fortune')) effectDurMod*=1.1;
					if (Game.Has('Lucky digit')) effectDurMod*=1.01;
					if (Game.Has('Lucky number')) effectDurMod*=1.01;
					if (Game.Has('Green yeast digestives')) effectDurMod*=1.01;
					if (Game.Has('Lucky payout')) effectDurMod*=1.01;
					//if (Game.hasAura('Epoch Manipulator')) effectDurMod*=1.05;
					effectDurMod*=1+Game.auraMult('Epoch Manipulator')*0.05;
					if (!me.wrath) effectDurMod*=Game.eff('goldenCookieEffDur');
					else effectDurMod*=Game.eff('wrathCookieEffDur');
					
					if (Game.hasGod)
					{
						var godLvl=Game.hasGod('decadence');
						if (godLvl==1) effectDurMod*=1.07;
						else if (godLvl==2) effectDurMod*=1.05;
						else if (godLvl==3) effectDurMod*=1.02;
					}
					
					//effect multiplier (from lucky etc)
					var mult=1;
					//if (me.wrath>0 && Game.hasAura('Unholy Dominion')) mult*=1.1;
					//else if (me.wrath==0 && Game.hasAura('Ancestral Metamorphosis')) mult*=1.1;
					if (me.wrath>0) mult*=1+Game.auraMult('Unholy Dominion')*0.1;
					else if (me.wrath==0) mult*=1+Game.auraMult('Ancestral Metamorphosis')*0.1;
					if (Game.Has('Green yeast digestives')) mult*=1.01;
					if (Game.Has('Dragon fang')) mult*=1.03;
					if (!me.wrath) mult*=Game.eff('goldenCookieGain');
					else mult*=Game.eff('wrathCookieGain');
					
					var popup='';
					var buff=0;
					
					if (choice=='building special')
					{
						var time=Math.ceil(30*effectDurMod);
						var list=[];
						for (var i in Game.Objects)
						{
							if (Game.Objects[i].amount>=10) list.push(Game.Objects[i].id);
						}
						if (list.length==0) {choice='frenzy';}//default to frenzy if no proper building
						else
						{
							var obj=choose(list);
							var pow=Game.ObjectsById[obj].amount/10+1;
							if (me.wrath && Math.random()<0.3)
							{
								buff=Game.gainBuff('building debuff',time,pow,obj);
							}
							else
							{
								buff=Game.gainBuff('building buff',time,pow,obj);
							}
						}
					}
					
					if (choice=='free sugar lump')
					{
						Game.gainLumps(1);
						popup=loc("Sweet!<br><small>Found 1 sugar lump!</small>");
					}
					else if (choice=='frenzy')
					{
						buff=Game.gainBuff('frenzy',Math.ceil(77*effectDurMod),7);
					}
					else if (choice=='dragon harvest')
					{
						buff=Game.gainBuff('dragon harvest',Math.ceil(60*effectDurMod),15);
					}
					else if (choice=='everything must go')
					{
						buff=Game.gainBuff('everything must go',Math.ceil(8*effectDurMod),5);
					}
					else if (choice=='multiply cookies')
					{
						var moni=mult*Math.min(Game.cookies*0.15,Game.cookiesPs*60*15)+13;//add 15% to cookies owned (+13), or 15 minutes of cookie production - whichever is lowest
						Game.Earn(moni);
						popup=loc("Lucky!")+'<br><small>'+loc("+%1!",loc("%1 cookie",LBeautify(moni)))+'</small>';
					}
					else if (choice=='ruin cookies')
					{
						var moni=Math.min(Game.cookies*0.05,Game.cookiesPs*60*10)+13;//lose 5% of cookies owned (-13), or 10 minutes of cookie production - whichever is lowest
						moni=Math.min(Game.cookies,moni);
						Game.Spend(moni);
						popup=loc("Ruin!")+'<br><small>'+loc("Lost %1!",loc("%1 cookie",LBeautify(moni)))+'</small>';
					}
					else if (choice=='blood frenzy')
					{
						buff=Game.gainBuff('blood frenzy',Math.ceil(6*effectDurMod),666);
					}
					else if (choice=='clot')
					{
						buff=Game.gainBuff('clot',Math.ceil(66*effectDurMod),0.5);
					}
					else if (choice=='cursed finger')
					{
						buff=Game.gainBuff('cursed finger',Math.ceil(10*effectDurMod),Game.cookiesPs*Math.ceil(10*effectDurMod));
					}
					else if (choice=='click frenzy')
					{
						buff=Game.gainBuff('click frenzy',Math.ceil(13*effectDurMod),777);
					}
					else if (choice=='dragonflight')
					{
						buff=Game.gainBuff('dragonflight',Math.ceil(10*effectDurMod),1111);
						if (Math.random()<0.8) Game.killBuff('Click frenzy');
					}
					else if (choice=='chain cookie')
					{
						//fix by Icehawk78
						if (this.chain==0) this.totalFromChain=0;
						this.chain++;
						var digit=me.wrath?6:7;
						if (this.chain==1) this.chain+=Math.max(0,Math.ceil(Math.log(Game.cookies)/Math.LN10)-10);
						
						var maxPayout=Math.min(Game.cookiesPs*60*60*6,Game.cookies*0.5)*mult;
						var moni=Math.max(digit,Math.min(Math.floor(1/9*Math.pow(10,this.chain)*digit*mult),maxPayout));
						var nextMoni=Math.max(digit,Math.min(Math.floor(1/9*Math.pow(10,this.chain+1)*digit*mult),maxPayout));
						this.totalFromChain+=moni;

						//break the chain if we're above 5 digits AND it's more than 50% of our bank, it grants more than 6 hours of our CpS, or just a 1% chance each digit (update : removed digit limit)
						if (Math.random()<0.01 || nextMoni>=maxPayout)
						{
							this.chain=0;
							popup=loc("Cookie chain")+'<br><small>'+loc("+%1!",loc("%1 cookie",LBeautify(moni)))+'<br>'+loc("Cookie chain over. You made %1.",loc("%1 cookie",LBeautify(this.totalFromChain)))+'</small>';
						}
						else
						{
							popup=loc("Cookie chain")+'<br><small>'+loc("+%1!",loc("%1 cookie",LBeautify(moni)))+'</small>';
						}
						Game.Earn(moni);
					}
					else if (choice=='cookie storm')
					{
						buff=Game.gainBuff('cookie storm',Math.ceil(7*effectDurMod),7);
					}
					else if (choice=='cookie storm drop')
					{
						var moni=Math.max(mult*(Game.cookiesPs*60*Math.floor(Math.random()*7+1)),Math.floor(Math.random()*7+1));//either 1-7 cookies or 1-7 minutes of cookie production, whichever is highest
						Game.Earn(moni);
						popup='<div style="font-size:75%;">'+loc("+%1!",loc('%1 cookie',LBeautify(moni)))+'</div>';
					}
					else if (choice=='blab')//sorry (it's really rare)
					{
						var str=EN?(choose([
						'Cookie crumbliness x3 for 60 seconds!',
						'Chocolatiness x7 for 77 seconds!',
						'Dough elasticity halved for 66 seconds!',
						'Golden cookie shininess doubled for 3 seconds!',
						'World economy halved for 30 seconds!',
						'Grandma kisses 23% stingier for 45 seconds!',
						'Thanks for clicking!',
						'Fooled you! This one was just a test.',
						'Golden cookies clicked +1!',
						'Your click has been registered. Thank you for your cooperation.',
						'Thanks! That hit the spot!',
						'Thank you. A team has been dispatched.',
						'They know.',
						'Oops. This was just a chocolate cookie with shiny aluminium foil.'
						])):choose(loc("Cookie blab"));
						popup=str;
					}
					
					if (popup=='' && buff && buff.name && buff.desc) popup=buff.dname+'<div style="font-size:65%;">'+buff.desc+'</div>';
					if (popup!='') Game.Popup(popup,me.x+me.l.offsetWidth/2,me.y);
					
					Game.DropEgg(0.9);
					
					//sparkle and kill the shimmer
					Game.SparkleAt(me.x+48,me.y+48);
					if (choice=='cookie storm drop')
					{
						if (Game.prefs.cookiesound) PlaySound('snd/clickb'+Math.floor(Math.random()*7+1)+'.mp3',0.75);
						else PlaySound('snd/click'+Math.floor(Math.random()*7+1)+'.mp3',0.75);
					}
					else PlaySound('snd/shimmerClick.mp3');
					me.die();
				},
				missFunc:function(me)
				{
					if (this.chain>0 && this.totalFromChain>0)
					{
						Game.Popup(loc("Cookie chain broken.<br><small>You made %1.</small>",loc("%1 cookie",LBeautify(this.totalFromChain))),me.x+me.l.offsetWidth/2,me.y);
						this.chain=0;this.totalFromChain=0;
					}
					if (me.spawnLead) Game.missedGoldenClicks++;
				},
				spawnsOnTimer:true,
				spawnConditions:function()
				{
					if (!Game.Has('Golden switch [off]')) return true; else return false;
				},
				spawned:0,
				time:0,
				minTime:0,
				maxTime:0,
				getTimeMod:function(me,m)
				{
					if (Game.Has('Lucky day')) m/=2;
					if (Game.Has('Serendipity')) m/=2;
					if (Game.Has('Golden goose egg')) m*=0.95;
					if (Game.Has('Heavenly luck')) m*=0.95;
					if (Game.Has('Green yeast digestives')) m*=0.99;
					//if (Game.hasAura('Arcane Aura')) m*=0.95;
					m*=1-Game.auraMult('Arcane Aura')*0.05;
					if (Game.hasBuff('Sugar blessing')) m*=0.9;
					if (Game.season=='easter' && Game.Has('Starspawn')) m*=0.98;
					else if (Game.season=='halloween' && Game.Has('Starterror')) m*=0.98;
					else if (Game.season=='valentines' && Game.Has('Starlove')) m*=0.98;
					else if (Game.season=='fools' && Game.Has('Startrade')) m*=0.95;
					if (!me.wrath) m*=1/Game.eff('goldenCookieFreq');
					else m*=1/Game.eff('wrathCookieFreq');
					if (Game.hasGod)
					{
						var godLvl=Game.hasGod('industry');
						if (godLvl==1) m*=1.1;
						else if (godLvl==2) m*=1.06;
						else if (godLvl==3) m*=1.03;
						var godLvl=Game.hasGod('mother');
						if (godLvl==1) m*=1.15;
						else if (godLvl==2) m*=1.1;
						else if (godLvl==3) m*=1.05;
						
						if (Game.season!='')
						{
							var godLvl=Game.hasGod('seasons');
							if (Game.season!='fools')
							{
								if (godLvl==1) m*=0.97;
								else if (godLvl==2) m*=0.98;
								else if (godLvl==3) m*=0.99;
							}
							else
							{
								if (godLvl==1) m*=0.955;
								else if (godLvl==2) m*=0.97;
								else if (godLvl==3) m*=0.985;
							}
						}
					}
					if (this.chain>0) m=0.05;
					if (Game.Has('Gold hoard')) m=0.01;
					return Math.ceil(Game.fps*60*m);
				},
				getMinTime:function(me)
				{
					var m=5;
					return this.getTimeMod(me,m);
				},
				getMaxTime:function(me)
				{
					var m=15;
					return this.getTimeMod(me,m);
				},
				last:'',
			},
			'reindeer':{
				reset:function()
				{
				},
				initFunc:function(me)
				{
					if (!this.spawned && Game.chimeType!=0 && Game.ascensionMode!=1) PlaySound('snd/jingle.mp3');
					
					me.x=-128;
					me.y=Math.floor(Math.random()*Math.max(0,Game.bounds.bottom-Game.bounds.top-256)+Game.bounds.top+128)-128;
					//me.l.style.left=me.x+'px';
					//me.l.style.top=me.y+'px';
					me.l.style.width='167px';
					me.l.style.height='212px';
					me.l.style.backgroundImage='url(img/frostedReindeer.webp)';
					me.l.style.opacity='0';
					//me.l.style.transform='rotate('+(Math.random()*60-30)+'deg) scale('+(Math.random()*1+0.25)+')';
					me.l.style.display='block';
					me.l.setAttribute('alt',loc("Reindeer"));
					
					me.life=1;//the reindeer's current progression through its lifespan (in frames)
					me.dur=4;//duration; the cookie's lifespan in seconds before it despawns
					
					var dur=4;
					if (Game.Has('Weighted sleighs')) dur*=2;
					dur*=Game.eff('reindeerDur');
					me.dur=dur;
					me.life=Math.ceil(Game.fps*me.dur);
					me.sizeMult=1;
				},
				updateFunc:function(me)
				{
					var curve=1-Math.pow((me.life/(Game.fps*me.dur))*2-1,12);
					me.l.style.opacity=curve;
					me.l.style.transform='translate('+(me.x+(Game.bounds.right-Game.bounds.left)*(1-me.life/(Game.fps*me.dur)))+'px,'+(me.y-Math.abs(Math.sin(me.life*0.1))*128)+'px) rotate('+(Math.sin(me.life*0.2+0.3)*10)+'deg) scale('+(me.sizeMult*(1+Math.sin(me.id*0.53)*0.1))+')';
					me.life--;
					if (me.life<=0) {this.missFunc(me);me.die();}
				},
				popFunc:function(me)
				{
					//get achievs and stats
					if (me.spawnLead)
					{
						Game.reindeerClicked++;
					}
					
					var val=Game.cookiesPs*60;
					if (Game.hasBuff('Elder frenzy')) val*=0.5;//very sorry
					if (Game.hasBuff('Frenzy')) val*=0.75;//I sincerely apologize
					var moni=Math.max(25,val);//1 minute of cookie production, or 25 cookies - whichever is highest
					if (Game.Has('Ho ho ho-flavored frosting')) moni*=2;
					moni*=Game.eff('reindeerGain');
					Game.Earn(moni);
					if (Game.hasBuff('Elder frenzy')) Game.Win('Eldeer');
					
					var cookie='';
					var failRate=0.8;
					if (Game.HasAchiev('Let it snow')) failRate=0.6;
					failRate*=1/Game.dropRateMult();
					if (Game.Has('Starsnow')) failRate*=0.95;
					if (Game.hasGod)
					{
						var godLvl=Game.hasGod('seasons');
						if (godLvl==1) failRate*=0.9;
						else if (godLvl==2) failRate*=0.95;
						else if (godLvl==3) failRate*=0.97;
					}
					if (Math.random()>failRate)//christmas cookie drops
					{
						cookie=choose(['Christmas tree biscuits','Snowflake biscuits','Snowman biscuits','Holly biscuits','Candy cane biscuits','Bell biscuits','Present biscuits']);
						if (!Game.HasUnlocked(cookie) && !Game.Has(cookie))
						{
							Game.Unlock(cookie);
						}
						else cookie='';
					}
					
					var popup='';
					
					Game.Notify(loc("You found %1!",choose(loc("Reindeer names"))),loc("The reindeer gives you %1.",loc("%1 cookie",LBeautify(moni)))+(cookie==''?'':'<br>'+loc("You are also rewarded with %1!",Game.Upgrades[cookie].dname)),[12,9],6);
					popup='<div style="font-size:80%;">'+loc("+%1!",loc("%1 cookie",LBeautify(moni)))+'</div>';
					
					if (popup!='') Game.Popup(popup,Game.mouseX,Game.mouseY);
					
					//sparkle and kill the shimmer
					Game.SparkleAt(Game.mouseX,Game.mouseY);
					PlaySound('snd/jingleClick.mp3');
					me.die();
				},
				missFunc:function(me)
				{
				},
				spawnsOnTimer:true,
				spawnConditions:function()
				{
					if (Game.season=='christmas') return true; else return false;
				},
				spawned:0,
				time:0,
				minTime:0,
				maxTime:0,
				getTimeMod:function(me,m)
				{
					if (Game.Has('Reindeer baking grounds')) m/=2;
					if (Game.Has('Starsnow')) m*=0.95;
					if (Game.hasGod)
					{
						var godLvl=Game.hasGod('seasons');
						if (godLvl==1) m*=0.9;
						else if (godLvl==2) m*=0.95;
						else if (godLvl==3) m*=0.97;
					}
					m*=1/Game.eff('reindeerFreq');
					if (Game.Has('Reindeer season')) m=0.01;
					return Math.ceil(Game.fps*60*m);
				},
				getMinTime:function(me)
				{
					var m=3;
					return this.getTimeMod(me,m);
				},
				getMaxTime:function(me)
				{
					var m=6;
					return this.getTimeMod(me,m);
				},
			}
		};
		
		Game.goldenCookieChoices=[
			"Frenzy","frenzy",
			"Lucky","multiply cookies",
			"Ruin","ruin cookies",
			"Elder frenzy","blood frenzy",
			"Clot","clot",
			"Click frenzy","click frenzy",
			"Cursed finger","cursed finger",
			"Cookie chain","chain cookie",
			"Cookie storm","cookie storm",
			"Building special","building special",
			"Dragon Harvest","dragon harvest",
			"Dragonflight","dragonflight",
			"Sweet","free sugar lump",
			"Blab","blab"
		];
		Game.goldenCookieBuildingBuffs={
			'Cursor':['High-five','Slap to the face'],
			'Grandma':['Congregation','Senility'],
			'Farm':['Luxuriant harvest','Locusts'],
			'Mine':['Ore vein','Cave-in'],
			'Factory':['Oiled-up','Jammed machinery'],
			'Bank':['Juicy profits','Recession'],
			'Temple':['Fervent adoration','Crisis of faith'],
			'Wizard tower':['Manabloom','Magivores'],
			'Shipment':['Delicious lifeforms','Black holes'],
			'Alchemy lab':['Breakthrough','Lab disaster'],
			'Portal':['Righteous cataclysm','Dimensional calamity'],
			'Time machine':['Golden ages','Time jam'],
			'Antimatter condenser':['Extra cycles','Predictable tragedy'],
			'Prism':['Solar flare','Eclipse'],
			'Chancemaker':['Winning streak','Dry spell'],
			'Fractal engine':['Macrocosm','Microcosm'],
			'Javascript console':['Refactoring','Antipattern'],
			'Idleverse':['Cosmic nursery','Big crunch'],
			'Cortex baker':['Brainstorm','Brain freeze'],
		};
		
		/*=====================================================================================
		PARTICLES
		=======================================================================================*/
		//generic particles (falling cookies etc)
		//only displayed on left section
		Game.particles=[];
		Game.particlesN=50;
		for (var i=0;i<Game.particlesN;i++)
		{
			Game.particles[i]={x:0,y:0,xd:0,yd:0,w:64,h:64,z:0,size:1,dur:2,life:-1,r:0,pic:'smallCookies.webp',picId:0,picPos:[0,0]};
		}
		
		Game.particlesUpdate=function()
		{
			for (var i=0;i<Game.particlesN;i++)
			{
				var me=Game.particles[i];
				if (me.life!=-1)
				{
					if (!me.text) me.yd+=0.2+Math.random()*0.1;
					me.x+=me.xd;
					me.y+=me.yd;
					//me.y+=me.life*0.25+Math.random()*0.25;
					me.life++;
					if (me.life>=Game.fps*me.dur)
					{
						me.life=-1;
					}
				}
			}
		}
		Game.particleAdd=function(x,y,xd,yd,size,dur,z,pic,text)
		{
			//Game.particleAdd(pos X,pos Y,speed X,speed Y,size (multiplier),duration (seconds),layer,picture,text);
			//pick the first free (or the oldest) particle to replace it
			if (true)//Game.prefs.particles)
			{
				var highest=0;
				var highestI=0;
				for (var i=0;i<Game.particlesN;i++)
				{
					if (Game.particles[i].life==-1) {highestI=i;break;}
					if (Game.particles[i].life>highest)
					{
						highest=Game.particles[i].life;
						highestI=i;
					}
				}
				var auto=0;
				if (x) auto=1;
				var i=highestI;
				var x=x||-64;
				if (Game.LeftBackground && !auto) x=Math.floor(Math.random()*Game.LeftBackground.canvas.width);
				var y=y||-64;
				var me=Game.particles[i];
				me.life=0;
				me.x=x;
				me.y=y;
				me.xd=xd||0;
				me.yd=yd||0;
				me.size=size||1;
				me.z=z||0;
				me.dur=dur||2;
				me.r=Math.floor(Math.random()*360);
				me.picId=Math.floor(Math.random()*10000);
				if (!pic)
				{
					if (Game.season=='fools') pic='smallDollars.webp';
					else
					{
						var cookies=[[10,0]];
						for (var i in Game.Upgrades)
						{
							var cookie=Game.Upgrades[i];
							if (cookie.bought>0 && cookie.pool=='cookie') cookies.push(cookie.icon);
						}
						me.picPos=choose(cookies);
						if (Game.bakeryName.toLowerCase()=='ortiel' || Math.random()<1/10000) me.picPos=[17,5];
						pic='icons.webp';
					}
				}
				else if (typeof pic!=='string'){me.picPos=pic;pic='icons.webp';}
				me.pic=pic||'smallCookies.webp';
				me.text=text||0;
				return me;
			}
			return {};
		}
		Game.particlesDraw=function(z)
		{
			var ctx=Game.LeftBackground;
			ctx.fillStyle='#fff';
			ctx.font='20px Merriweather';
			ctx.textAlign='center';
			
			for (var i=0;i<Game.particlesN;i++)
			{
				var me=Game.particles[i];
				if (me.z==z)
				{
					if (me.life!=-1)
					{
						var opacity=1-(me.life/(Game.fps*me.dur));
						ctx.globalAlpha=opacity;
						if (me.text)
						{
							ctx.fillText(me.text,me.x,me.y);
						}
						else
						{
							ctx.save();
							ctx.translate(me.x,me.y);
							ctx.rotate((me.r/360)*Math.PI*2);
							var w=64;
							var h=64;
							if (me.pic=='icons.webp')
							{
								w=48;
								h=48;
								ctx.drawImage(Pic(me.pic),me.picPos[0]*w,me.picPos[1]*h,w,h,-w/2*me.size,-h/2*me.size,w*me.size,h*me.size);
							}
							else
							{
								if (me.pic=='wrinklerBits.webp' || me.pic=='shinyWrinklerBits.webp') {w=100;h=200;}
								ctx.drawImage(Pic(me.pic),(me.picId%8)*w,0,w,h,-w/2*me.size,-h/2*me.size,w*me.size,h*me.size);
							}
							ctx.restore();
						}
					}
				}
			}
		}
		
		//text particles (popups etc)
		Game.textParticles=[];
		Game.textParticlesY=0;
		var str='';
		for (var i=0;i<20;i++)
		{
			Game.textParticles[i]={x:0,y:0,life:-1,text:''};
			str+='<div id="particle'+i+'" class="particle title"></div>';
		}
		l('particles').innerHTML=str;
		Game.textParticlesUpdate=function()
		{
			for (var i in Game.textParticles)
			{
				var me=Game.textParticles[i];
				if (me.life!=-1)
				{
					me.life++;
					if (me.life>=Game.fps*4)
					{
						var el=me.l;
						me.life=-1;
						el.style.opacity=0;
						el.style.display='none';
					}
				}
			}
		}
		Game.textParticlesAdd=function(text,el,posX,posY)
		{
			//pick the first free (or the oldest) particle to replace it
			var highest=0;
			var highestI=0;
			for (var i in Game.textParticles)
			{
				if (Game.textParticles[i].life==-1) {highestI=i;break;}
				if (Game.textParticles[i].life>highest)
				{
					highest=Game.textParticles[i].life;
					highestI=i;
				}
			}
			var i=highestI;
			var noStack=0;
			if (typeof posX!=='undefined' && typeof posY!=='undefined')
			{
				x=posX;
				y=posY;
				noStack=1;
			}
			else
			{
				var x=(Math.random()-0.5)*40;
				var y=0;//+(Math.random()-0.5)*40;
				if (!el)
				{
					var rect=Game.bounds;
					var x=Math.floor((rect.left+rect.right)/2);
					var y=Math.floor((rect.bottom))-(Game.mobile*64);
					x+=(Math.random()-0.5)*40;
					y+=0;//(Math.random()-0.5)*40;
				}
			}
			if (!noStack) y-=Game.textParticlesY;
			
			x=Math.max(Game.bounds.left+200,x);
			x=Math.min(Game.bounds.right-200,x);
			y=Math.max(Game.bounds.top+32+(App?32:0),y);
			
			var me=Game.textParticles[i];
			if (!me.l) me.l=l('particle'+i);
			me.life=0;
			me.x=x;
			me.y=y;
			me.text=text;
			me.l.innerHTML=text;
			me.l.style.left=Math.floor(Game.textParticles[i].x-200)+'px';
			me.l.style.bottom=Math.floor(-Game.textParticles[i].y)+'px';
			for (var ii in Game.textParticles)
			{if (ii!=i) (Game.textParticles[ii].l||l('particle'+ii)).style.zIndex=100000000;}
			me.l.style.zIndex=100000001;
			me.l.style.display='block';
			me.l.className='particle title';
			void me.l.offsetWidth;
			me.l.className='particle title risingUpLinger';
			if (!noStack) Game.textParticlesY+=60;
		}
		Game.popups=1;
		Game.Popup=function(text,x,y)
		{
			if (Game.popups) Game.textParticlesAdd(text,0,x,y);
		}
		
		//display sparkles at a set position
		Game.sparkles=l('sparkles');
		Game.sparklesT=0;
		Game.sparklesFrames=16;
		Game.SparkleAt=function(x,y)
		{
			if (Game.blendModesOn)
			{
				Game.sparklesT=Game.sparklesFrames+1;
				Game.sparkles.style.backgroundPosition='0px 0px';
				Game.sparkles.style.left=Math.floor(x-64)+'px';
				Game.sparkles.style.top=Math.floor(y-64)+'px';
				Game.sparkles.style.display='block';
			}
		}
		Game.SparkleOn=function(el)
		{
			var rect=el.getBounds();
			Game.SparkleAt((rect.left+rect.right)/2,(rect.top+rect.bottom)/2-24);
		}
		
		/*=====================================================================================
		NOTIFICATIONS
		=======================================================================================*/
		//maybe do all this mess with proper DOM instead of rewriting the innerHTML
		Game.Notes=[];
		Game.NotesById=[];
		Game.noteId=0;
		Game.noteL=l('notes');
		Game.Note=function(title,desc,pic,quick)
		{
			this.title=title;
			this.desc=desc||'';
			this.pic=pic||'';
			this.id=Game.noteId;
			this.date=Date.now();
			this.quick=quick||0;
			this.life=(this.quick||1)*Game.fps;
			this.l=0;
			this.height=0;
			this.tooltip=0;
			Game.noteId++;
			Game.NotesById[this.id]=this;
			Game.Notes.unshift(this);
			if (Game.Notes.length>50) Game.Notes.pop();
			//Game.Notes.push(this);
			//if (Game.Notes.length>50) Game.Notes.shift();
			Game.UpdateNotes();
		}
		Game.CloseNote=function(id)
		{
			var me=Game.NotesById[id];
			if (Game.tooltip.from && Game.tooltip.from.id.indexOf('note-')==0) Game.tooltip.hide();
			Game.Notes.splice(Game.Notes.indexOf(me),1);
			//Game.NotesById.splice(Game.NotesById.indexOf(me),1);
			Game.NotesById[id]=null;
			Game.UpdateNotes();
		}
		Game.CloseNotes=function()
		{
			Game.Notes=[];
			Game.NotesById=[];
			Game.tooltip.hide();
			Game.UpdateNotes();
		}
		Game.UpdateNotes=function()
		{
			var str='';
			var remaining=Game.Notes.length;
			for (var i in Game.Notes)
			{
				if (i<5)
				{
					var me=Game.Notes[i];
					var pic='';
					if (me.pic!='') pic='<div class="icon" style="'+writeIcon(me.pic)+'"></div>';
					str='<div id="note-'+me.id+'" '+(me.tooltip?Game.getDynamicTooltip(me.tooltip,'this',true)+' ':'')+'class="framed note '+(me.pic!=''?'haspic':'nopic')+' '+(me.desc!=''?'hasdesc':'nodesc')+'"><div class="close" onclick="PlaySound(\'snd/tick.mp3\');Game.CloseNote('+me.id+');">x</div>'+pic+'<div class="text"><h3>'+me.title+'</h3>'+(me.desc!=''?'<div class="line"></div><h5>'+me.desc+'</h5>':'')+'</div></div>'+str;
					remaining--;
				}
			}
			if (remaining>0) str='<div class="remaining">'+loc("+%1 more notification.",LBeautify(remaining))+'</div>'+str;
			if (Game.Notes.length>1)
			{
				str+='<div class="framed close sidenote" onclick="PlaySound(\'snd/tick.mp3\');Game.CloseNotes();">x</div>';
			}
			Game.noteL.innerHTML=str;
			for (var i in Game.Notes)
			{
				me.l=0;
				if (i<5)
				{
					var me=Game.Notes[i];
					me.l=l('note-'+me.id);
				}
			}
		}
		Game.NotesLogic=function()
		{
			for (var i in Game.Notes)
			{
				if (Game.Notes[i].quick>0)
				{
					var me=Game.Notes[i];
					me.life--;
					if (me.life<=0) Game.CloseNote(me.id);
				}
			}
		}
		Game.NotesDraw=function()
		{
			for (var i in Game.Notes)
			{
				if (Game.Notes[i].quick>0)
				{
					var me=Game.Notes[i];
					if (me.l)
					{
						if (me.life<10)
						{
							me.l.style.opacity=(me.life/10);
						}
					}
				}
			}
		}
		Game.Notify=function(title,desc,pic,quick,noLog)
		{
			if (Game.prefs.notifs)
			{
				quick=Math.min(6,quick);
				if (!quick) quick=6;
			}
			desc=replaceAll('==CLOSETHIS()==','Game.CloseNote('+Game.noteId+');',desc);
			if (Game.popups) new Game.Note(title,desc,pic,quick);
			if (!noLog) Game.AddToLog('<b>'+title+'</b> | '+desc);
		}
		Game.NotifyTooltip=function(content)
		{
			//attaches a tooltip to the last spawned note
			if (!Game.NotesById[Game.noteId-1]) return false;
			var me=Game.NotesById[Game.noteId-1];
			me.tooltip=content;
			Game.UpdateNotes();
		}
		
		
		/*=====================================================================================
		PROMPT
		=======================================================================================*/
		Game.darkenL=l('darken');
		AddEvent(Game.darkenL,'click',function(){Game.Click=0;PlaySound('snd/tickOff.mp3');Game.ClosePrompt();});
		Game.promptL=l('promptContent');
		Game.promptAnchorL=l('promptAnchor');
		Game.promptWrapL=l('prompt');
		Game.promptConfirm='';
		Game.promptOn=0;
		Game.promptUpdateFunc=0;
		Game.promptOptionsN=0;
		Game.promptOptionFocus=0;
		Game.UpdatePrompt=function()
		{
			if (Game.promptUpdateFunc) Game.promptUpdateFunc();
			Game.promptAnchorL.style.top=Math.floor((Game.windowH-Game.promptWrapL.offsetHeight)/2-16)+'px';
		}
		Game.Prompt=function(content,options,updateFunc,style)
		{
			if (updateFunc) Game.promptUpdateFunc=updateFunc;
			if (style) Game.promptWrapL.className='framed '+style; else Game.promptWrapL.className='framed';
			var str='';
			str+=content;
			if (str.indexOf('<id ')==0)
			{
				var id=str.substring(4,str.indexOf('>'));
				str=str.substring(str.indexOf('>')+1);
				str='<div id="promptContent'+id+'">'+str+'</div>';
			}
			var opts='';
			Game.promptOptionsN=0;
			for (var i=0;i<options.length;i++)
			{
				if (options[i]=='br')//just a linebreak
				{opts+='<br>';}
				else
				{
					if (typeof options[i]=='string') options[i]=[options[i],'PlaySound(\'snd/tickOff.mp3\');Game.ClosePrompt();'];
					else if (!options[i][1]) options[i]=[options[i][0],'PlaySound(\'snd/tickOff.mp3\');Game.ClosePrompt();',options[i][2]];
					else options[i][1]='PlaySound(\'snd/tick.mp3\');'+options[i][1];
					options[i][1]=options[i][1].replace(/'/g,'&#39;').replace(/"/g,'&#34;');
					opts+='<a id="promptOption'+i+'" class="option" '+(options[i][2]?'style="'+options[i][2]+'" ':'')+''+Game.clickStr+'="'+options[i][1]+'">'+options[i][0]+'</a>';
					Game.promptOptionsN++;
				}
			}
			Game.promptL.innerHTML=str+'<div class="optionBox">'+opts+'</div>';
			Game.promptAnchorL.style.display='block';
			Game.darkenL.style.display='block';
			Game.promptL.focus();
			Game.promptOn=1;
			Game.promptOptionFocus=0;
			Game.FocusPromptOption(0);
			Game.UpdatePrompt();
		}
		Game.ClosePrompt=function()
		{
			if (!Game.promptOn) return false;
			Game.promptAnchorL.style.display='none';
			Game.darkenL.style.display='none';
			Game.promptOn=0;
			Game.promptUpdateFunc=0;
			Game.promptOptionFocus=0;
			Game.promptOptionsN=0;
		}
		Game.ConfirmPrompt=function()
		{
			if (Game.promptOn && l('promptOption'+Game.promptOptionFocus) && l('promptOption'+Game.promptOptionFocus).style.display!='none') FireEvent(l('promptOption'+Game.promptOptionFocus),'click');
		}
		Game.FocusPromptOption=function(dir,tryN)
		{
			var id=Game.promptOptionFocus+dir;
			if (id<0) id=Game.promptOptionsN-1;
			if (id>=Game.promptOptionsN) id=0;
			while (id>=0 && id<Game.promptOptionsN && (!l('promptOption'+id) || l('promptOption'+id).style.display=='none'))
			{id+=(dir||1);}
			if (l('promptOption'+id) && l('promptOption'+id).style.display!='none')
			{
				if (l('promptOption'+Game.promptOptionFocus)) l('promptOption'+Game.promptOptionFocus).classList.remove('focused');
				Game.promptOptionFocus=id;
				if (l('promptOption'+Game.promptOptionFocus)) l('promptOption'+Game.promptOptionFocus).classList.add('focused');
			}
			else if (!tryN && dir!=0) {Game.promptOptionFocus=id;Game.FocusPromptOption(dir,1);}
		}
		
		/*=====================================================================================
		MENUS
		=======================================================================================*/
		Game.cssClasses=[];
		Game.addClass=function(what) {if (Game.cssClasses.indexOf(what)==-1) Game.cssClasses.push(what);Game.updateClasses();}
		Game.removeClass=function(what) {var i=Game.cssClasses.indexOf(what);if(i!=-1) {Game.cssClasses.splice(i,1);}Game.updateClasses();}
		Game.updateClasses=function() {Game.l.className=Game.cssClasses.join(' ');}
		
		Game.WritePrefButton=function(prefName,button,on,off,callback,invert)
		{
			var invert=invert?1:0;
			if (!callback) callback='';
			callback+='PlaySound(\'snd/tick.mp3\');';
			return '<a class="smallFancyButton prefButton option'+((Game.prefs[prefName]^invert)?'':' off')+'" id="'+button+'" '+Game.clickStr+'="Game.Toggle(\''+prefName+'\',\''+button+'\',\''+on+'\',\''+off+'\',\''+invert+'\');'+callback+'">'+(Game.prefs[prefName]?on:off)+'</a>';
		}
		Game.Toggle=function(prefName,button,on,off,invert)
		{
			if (Game.prefs[prefName])
			{
				l(button).innerHTML=off;
				Game.prefs[prefName]=0;
			}
			else
			{
				l(button).innerHTML=on;
				Game.prefs[prefName]=1;
			}
			l(button).className='smallFancyButton prefButton option'+((Game.prefs[prefName]^invert)?'':' off');
			
		}
		Game.ToggleFancy=function()
		{
			if (Game.prefs.fancy) Game.removeClass('noFancy');
			else if (!Game.prefs.fancy) Game.addClass('noFancy');
		}
		Game.ToggleFilters=function()
		{
			if (Game.prefs.filters) Game.removeClass('noFilters');
			else if (!Game.prefs.filters) Game.addClass('noFilters');
		}
		Game.ToggleExtraButtons=function()
		{
			if (!Game.prefs.extraButtons) Game.removeClass('extraButtons');
			else if (Game.prefs.extraButtons) Game.addClass('extraButtons');
			for (var i in Game.Objects)
			{
				Game.Objects[i].mute(0);
			}
		}
		Game.ToggleFullscreen=function()
		{
			if (App) App.setFullscreen(Game.prefs.fullscreen);
		}
		
		Game.WriteSlider=function(slider,leftText,rightText,startValueFunction,callback)
		{
			if (!callback) callback='';
			return '<div class="sliderBox"><div style="float:left;" class="smallFancyButton">'+leftText+'</div><div style="float:right;" class="smallFancyButton" id="'+slider+'RightText">'+rightText.replace('[$]',startValueFunction())+'</div><input class="slider" style="clear:both;" type="range" min="0" max="100" step="1" value="'+startValueFunction()+'" onchange="'+callback+'" oninput="'+callback+'" onmouseup="PlaySound(\'snd/tick.mp3\');" id="'+slider+'"/></div>';
		}
		
		Game.onPanel='Left';
		Game.addClass('focus'+Game.onPanel);
		Game.ShowPanel=function(what)
		{
			if (!what) what='';
			if (Game.onPanel!=what)
			{
				Game.removeClass('focus'+Game.onPanel);
				Game.addClass('focus'+what);
			}
			Game.onPanel=what;
		}
		
		Game.onMenu='';
		Game.ShowMenu=function(what)
		{
			if (!what || what=='') what=Game.onMenu;
			if (Game.onMenu=='' && what!='') Game.addClass('onMenu');
			else if (Game.onMenu!='' && what!=Game.onMenu) Game.addClass('onMenu');
			else if (what==Game.onMenu) {Game.removeClass('onMenu');what='';}
			//if (what=='log') l('donateBox').className='on'; else l('donateBox').className='';
			Game.onMenu=what;
			
			l('prefsButton').className=(Game.onMenu=='prefs')?'panelButton selected':'panelButton';
			l('statsButton').className=(Game.onMenu=='stats')?'panelButton selected':'panelButton';
			l('logButton').className=(Game.onMenu=='log')?'panelButton selected':'panelButton';
			
			if (Game.onMenu=='') PlaySound('snd/clickOff2.mp3');
			else PlaySound('snd/clickOn2.mp3');
			
			Game.UpdateMenu();
			
			if (what=='')
			{
				for (var i in Game.Objects)
				{
					var me=Game.Objects[i];
					if (me.minigame && me.minigame.onResize) me.minigame.onResize();
				}
			}
		}
		Game.sayTime=function(time,detail)
		{
			//time is a value where one second is equal to Game.fps (30).
			//detail skips days when >1, hours when >2, minutes when >3 and seconds when >4.
			//if detail is -1, output something like "3 hours, 9 minutes, 48 seconds"
			if (time<=0) return '';
			var str='';
			var detail=detail||0;
			time=Math.floor(time);
			if (detail==-1)
			{
				//var months=0;
				var days=0;
				var hours=0;
				var minutes=0;
				var seconds=0;
				//if (time>=Game.fps*60*60*24*30) months=(Math.floor(time/(Game.fps*60*60*24*30)));
				if (time>=Game.fps*60*60*24) days=(Math.floor(time/(Game.fps*60*60*24)));
				if (time>=Game.fps*60*60) hours=(Math.floor(time/(Game.fps*60*60)));
				if (time>=Game.fps*60) minutes=(Math.floor(time/(Game.fps*60)));
				if (time>=Game.fps) seconds=(Math.floor(time/(Game.fps)));
				//days-=months*30;
				hours-=days*24;
				minutes-=hours*60+days*24*60;
				seconds-=minutes*60+hours*60*60+days*24*60*60;
				if (days>10) {hours=0;}
				if (days) {minutes=0;seconds=0;}
				if (hours) {seconds=0;}
				var bits=[];
				//if (months>0) bits.push(Beautify(months)+' month'+(days==1?'':'s'));
				if (days>0) bits.push(loc("%1 day",LBeautify(days)));
				if (hours>0) bits.push(loc("%1 hour",LBeautify(hours)));
				if (minutes>0) bits.push(loc("%1 minute",LBeautify(minutes)));
				if (seconds>0) bits.push(loc("%1 second",LBeautify(seconds)));
				if (bits.length==0) str=loc("less than 1 second");
				else str=bits.join(', ');
				/*//if (months>0) bits.push(Beautify(months)+' month'+(days==1?'':'s'));
				if (days>0) bits.push(Beautify(days)+' day'+(days==1?'':'s'));
				if (hours>0) bits.push(Beautify(hours)+' hour'+(hours==1?'':'s'));
				if (minutes>0) bits.push(Beautify(minutes)+' minute'+(minutes==1?'':'s'));
				if (seconds>0) bits.push(Beautify(seconds)+' second'+(seconds==1?'':'s'));
				if (bits.length==0) str='less than 1 second';
				else str=bits.join(', ');*/
			}
			else
			{
				/*if (time>=Game.fps*60*60*24*30*2 && detail<1) str=Beautify(Math.floor(time/(Game.fps*60*60*24*30)))+' months';
				else if (time>=Game.fps*60*60*24*30 && detail<1) str='1 month';
				else */if (time>=Game.fps*60*60*24 && detail<2) str=loc("%1 day",LBeautify(Math.floor(time/(Game.fps*60*60*24))));//Beautify(Math.floor(time/(Game.fps*60*60*24)))+' days';
				else if (time>=Game.fps*60*60 && detail<3) str=loc("%1 hour",LBeautify(Math.floor(time/(Game.fps*60*60))));//Beautify(Math.floor(time/(Game.fps*60*60)))+' hours';
				else if (time>=Game.fps*60 && detail<4) str=loc("%1 minute",LBeautify(Math.floor(time/(Game.fps*60))));//Beautify(Math.floor(time/(Game.fps*60)))+' minutes';
				else if (time>=Game.fps && detail<5) str=loc("%1 second",LBeautify(Math.floor(time/(Game.fps))));//Beautify(Math.floor(time/(Game.fps)))+' seconds';
				else str=loc("less than 1 second");
			}
			return str;
		}
		
		Game.tinyCookie=function()
		{
			if (!Game.HasAchiev('Tiny cookie'))
			{
				return '<div class="tinyCookie" '+Game.clickStr+'="Game.ClickTinyCookie();"></div>';
			}
			return '';
		}
		Game.ClickTinyCookie=function(){if (!Game.HasAchiev('Tiny cookie')){PlaySound('snd/tick.mp3');Game.Win('Tiny cookie');}}
		
		Game.setVolume=function(what)
		{
			Game.volume=what;
			/*for (var i in Sounds)
			{
				Sounds[i].volume=Game.volume;
			}*/
		}
		Game.setVolumeMusic=function(what)
		{
			Game.volumeMusic=what;
			if (Music) Music.setVolume(what/100);
		}
		Game.setWubMusic=function(what)
		{
			if (Music) Music.setFilter(what/100);
		}
		
		Game.showLangSelection=function()
		{
			var str='';
			for (var i in Langs)
			{
				var lang=Langs[i];
				str+='<div class="langSelectButton title'+(locId==lang.file?' selected':'')+'" style="padding:4px;" id="langSelect-'+i+'">'+lang.name+'</div>';
			}
			Game.Prompt('<id ChangeLanguage><h3>'+loc("Change language")+'</h3>'+
				'<div class="line"></div>'+
				'<div style="font-size:11px;opacity:0.5;margin-bottom:12px;">('+loc("note: this will save and reload your game")+')</div>'+
				str,
				[loc("Cancel")]);
			
			for (var i in Langs)
			{
				var lang=Langs[i];
				AddEvent(l('langSelect-'+i),'click',function(lang){return function(){
					if (lang!=locId)
					{
						PlaySound('snd/tick.mp3');
						localStorageSet('CookieClickerLang',lang);
						Game.toSave=true;
						Game.toReload=true;
					}
				};}(i));
				AddEvent(l('langSelect-'+i),'mouseover',function(lang){return function(){
					if (lang!=locId) PlaySound('snd/smallTick.mp3',0.75);
				};}(i));
			}
		}
		
		ON=' '+loc("ON");
		OFF=' '+loc("OFF");
		Game.UpdateMenu=function()
		{
			var str='';
			if (Game.onMenu!='')
			{
				str+='<div class="close menuClose" '+Game.clickStr+'="Game.ShowMenu();">x</div>';
				//str+='<div style="position:absolute;top:8px;right:8px;cursor:pointer;font-size:16px;" '+Game.clickStr+'="Game.ShowMenu();">X</div>';
			}
			if (Game.onMenu=='prefs')
			{
				str+='<div class="section">'+loc("Options")+'</div>';
				
				str+=
					'<div class="block" style="padding:0px;margin:8px 4px;">'+
						'<div class="subsection" style="padding:0px;">'+
						'<div class="title">'+loc("General")+'</div>'+
							'<div class="listing" style="text-align:center;"><div style="display:inline-block;padding:2px 8px;opacity:0.75;font-size:12px;vertical-align:middle;" class="smallFancyButton">'+loc("Language: %1",'<b>'+Langs[locId].name+'</b>')+'</div><div class="icon" style="vertical-align:middle;display:inline-block;background-position:'+(-30*48)+'px '+(-29*48)+'px;transform:scale(0.5);margin:-16px -12px;"></div><a style="font-size:15px;text-align:center;width:auto;min-width:130px;" class="option smallFancyButton" id="changeLanguageOption" '+Game.clickStr+'="PlaySound(\'snd/tick.mp3\');Game.showLangSelection();">'+(!EN?'Change language<div class="line"></div>':'')+loc("Change language")+'</a><div style="clear:both;text-align:right;padding-bottom:2px;"></div></div>'+
							(App?'<div class="listing"><a class="option smallFancyButton" '+Game.clickStr+'="PlaySound(\'snd/tick.mp3\');Game.toSave=true;Game.toQuit=true;">'+loc("Save & Quit")+'</a></div>':'')+
							'<div class="listing"><a class="option smallFancyButton" '+Game.clickStr+'="Game.toSave=true;PlaySound(\'snd/tick.mp3\');">'+loc("Save")+'</a><label>'+loc("Save manually (the game autosaves every 60 seconds; shortcut: ctrl+S)")+'</label></div>'+
							'<div class="listing"><a class="option smallFancyButton" '+Game.clickStr+'="Game.ExportSave();PlaySound(\'snd/tick.mp3\');">'+loc("Export save")+'</a><a class="option smallFancyButton" '+Game.clickStr+'="Game.ImportSave();PlaySound(\'snd/tick.mp3\');">'+loc("Import save")+'</a><label>'+loc("You can use this to backup your save or to transfer it to another computer (shortcut for import: ctrl+O)")+'</label></div>'+
							(!App?('<div class="listing"><a class="option smallFancyButton" '+Game.clickStr+'="Game.FileSave();PlaySound(\'snd/tick.mp3\');">'+loc("Save to file")+'</a><a class="option smallFancyButton" style="position:relative;"><input id="FileLoadInput" type="file" style="cursor:pointer;opacity:0;position:absolute;left:0px;top:0px;width:100%;height:100%;" onchange="Game.FileLoad(event);" '+Game.clickStr+'="PlaySound(\'snd/tick.mp3\');"/>'+loc("Load from file")+'</a><label>'+loc("Use this to keep backups on your computer")+'</label></div>'):'')+
							'<div class="listing" style="text-align:right;"><label>'+loc("Delete all your progress, including your achievements")+'</label><a class="option smallFancyButton warning" '+Game.clickStr+'="Game.HardReset();PlaySound(\'snd/tick.mp3\');">'+loc("Wipe save")+'</a></div>'+
							
						'</div>'+
					'</div>'+
					'<div class="block" style="padding:0px;margin:8px 4px;">'+
						'<div class="subsection" style="padding:0px;">'+
					
						'<div class="title">'+loc("Settings")+'</div>'+
						((App && App.writeCloudUI)?App.writeCloudUI():'')+
						'<div class="listing">'+
							Game.WriteSlider('volumeSlider',loc("Volume"),'[$]%',function(){return Game.volume;},'Game.setVolume(Math.round(l(\'volumeSlider\').value));l(\'volumeSliderRightText\').innerHTML=Game.volume+\'%\';')+
							(App?Game.WriteSlider('volumeMusicSlider',loc("Volume (music)"),'[$]%',function(){return Game.volumeMusic;},'Game.setVolumeMusic(Math.round(l(\'volumeMusicSlider\').value));l(\'volumeMusicSliderRightText\').innerHTML=Game.volumeMusic+\'%\';'):'')+
							/*(App?Game.WriteSlider('wubMusicSlider',loc("Wub"),'[$]%',function(){return 100;},'Game.setWubMusic(Math.round(l(\'wubMusicSlider\').value));l(\'wubMusicSliderRightText\').innerHTML=(Math.round(l(\'wubMusicSlider\').value))+\'%\';'):'')+*/
							'<br>'+
							(App?Game.WritePrefButton('bgMusic','bgMusicButton',loc("Music in background")+ON,loc("Music in background")+OFF,'')+'<label>('+loc("music will keep playing even when the game window isn't focused")+')</label><br>':'')+
							(App?Game.WritePrefButton('fullscreen','fullscreenButton',loc("Fullscreen")+ON,loc("Fullscreen")+OFF,'Game.ToggleFullscreen();')+'<br>':'')+
							Game.WritePrefButton('fancy','fancyButton',loc("Fancy graphics")+ON,loc("Fancy graphics")+OFF,'Game.ToggleFancy();')+'<label>('+loc("visual improvements; disabling may improve performance")+')</label><br>'+
							Game.WritePrefButton('filters','filtersButton',loc("CSS filters")+ON,loc("CSS filters")+OFF,'Game.ToggleFilters();')+'<label>('+(EN?'cutting-edge visual improvements; disabling may improve performance':loc("visual improvements; disabling may improve performance"))+')</label><br>'+
							Game.WritePrefButton('particles','particlesButton',loc("Particles")+ON,loc("Particles")+OFF)+(EN?'<label>(cookies falling down, etc; disabling may improve performance)</label>':'')+'<br>'+
							Game.WritePrefButton('numbers','numbersButton',loc("Numbers")+ON,loc("Numbers")+OFF)+'<label>('+loc("numbers that pop up when clicking the cookie")+')</label><br>'+
							Game.WritePrefButton('milk','milkButton',loc("Milk [setting]")+ON,loc("Milk [setting]")+OFF)+(EN?'<label>(only appears with enough achievements)</label>':'')+'<br>'+
							Game.WritePrefButton('cursors','cursorsButton',loc("Cursors [setting]")+ON,loc("Cursors [setting]")+OFF)+'<label>('+loc("visual display of your cursors")+')</label><br>'+
							Game.WritePrefButton('wobbly','wobblyButton',loc("Wobbly cookie")+ON,loc("Wobbly cookie")+OFF)+(EN?'<label>(your cookie will react when you click it)</label>':'')+'<br>'+
							Game.WritePrefButton('cookiesound','cookiesoundButton',loc("Alt cookie sound")+ON,loc("Alt cookie sound")+OFF)+(EN?'<label>(how your cookie sounds when you click on it)</label>':'')+'<br>'+
							Game.WritePrefButton('crates','cratesButton',loc("Icon crates")+ON,loc("Icon crates")+OFF)+'<label>('+loc("display boxes around upgrades and achievements in Stats")+')</label><br>'+
							Game.WritePrefButton('monospace','monospaceButton',loc("Alt font")+ON,loc("Alt font")+OFF)+'<label>('+loc("your cookies are displayed using a monospace font")+')</label><br>'+
							Game.WritePrefButton('format','formatButton',loc("Short numbers")+OFF,loc("Short numbers")+ON,'BeautifyAll();Game.RefreshStore();Game.upgradesToRebuild=1;',1)+(EN?'<label>(shorten big numbers)</label>':'')+'<br>'+
							Game.WritePrefButton('notifs','notifsButton',loc("Fast notes")+ON,loc("Fast notes")+OFF)+'<label>('+loc("notifications disappear much faster")+')</label><br>'+
							//Game.WritePrefButton('autoupdate','autoupdateButton','Offline mode OFF','Offline mode ON',0,1)+'<label>(disables update notifications)</label><br>'+
							(!App?Game.WritePrefButton('warn','warnButton',loc("Closing warning")+ON,loc("Closing warning")+OFF)+'<label>('+loc("the game will ask you to confirm when you close the window")+')</label><br>':'')+
							//Game.WritePrefButton('focus','focusButton',loc("Defocus")+OFF,loc("Defocus")+ON,0,1)+'<label>('+loc("the game will be less resource-intensive when out of focus")+')</label><br>'+
							Game.WritePrefButton('extraButtons','extraButtonsButton',loc("Extra buttons")+ON,loc("Extra buttons")+OFF,'Game.ToggleExtraButtons();')+'<label>('+loc("add options on buildings like Mute")+')</label><br>'+
							Game.WritePrefButton('askLumps','askLumpsButton',loc("Lump confirmation")+ON,loc("Lump confirmation")+OFF)+'<label>('+loc("the game will ask you to confirm before spending sugar lumps")+')</label><br>'+
							(!App?Game.WritePrefButton('customGrandmas','customGrandmasButton',loc("Custom grandmas")+ON,loc("Custom grandmas")+OFF)+'<label>('+loc("some grandmas will be named after Patreon supporters")+')</label><br>':'')+
							Game.WritePrefButton('notScary','notScaryButton',loc("Scary stuff")+OFF,loc("Scary stuff")+ON,0,1)+'<br>'+
							Game.WritePrefButton('timeout','timeoutButton',loc("Sleep mode timeout")+ON,loc("Sleep mode timeout")+OFF)+'<label>('+loc("on slower computers, the game will put itself in sleep mode when it's inactive and starts to lag out; offline CpS production kicks in during sleep mode")+')</label><br>'+
							Game.WritePrefButton('screenreader','screenreaderButton',loc("Screen reader mode")+ON,loc("Screen reader mode")+OFF,'Game.toSave=true;Game.toReload=true;')+'<label>('+loc("allows optimizations for screen readers; game will reload")+')</label><br>'+
						'</div>'+
						//'<div class="listing">'+Game.WritePrefButton('autosave','autosaveButton','Autosave ON','Autosave OFF')+'</div>'+
						(!App?'<div class="listing"><a class="option smallFancyButton" '+Game.clickStr+'="Game.CheckModData();PlaySound(\'snd/tick.mp3\');">'+loc("Check mod data")+'</a><label>('+loc("view and delete save data created by mods")+')</label></div>':'')+
						
						'</div>'+
					'</div>'+
				'</div>';
				
				if (App && App.writeModUI)
				{
					str+=
						'<div class="block" style="padding:0px;margin:8px 4px;">'+
							'<div class="subsection" style="padding:0px;">'+
							
							'<div class="title">'+loc("Mods")+'</div>'+
							App.writeModUI()+
							'</div>'+
						'</div>';
				}
				
				str+='<div style="height:128px;"></div>';
			}
			else if (Game.onMenu=='log')
			{
				//str+=replaceAll('[bakeryName]',Game.bakeryName,Game.updateLog);
				str+=Game.updateLog;
				if (!Game.HasAchiev('Olden days')) str+='<div id="oldenDays" style="text-align:right;width:100%;"><div '+Game.clickStr+'="Game.SparkleAt(Game.mouseX,Game.mouseY);PlaySound(\'snd/tick.mp3\');PlaySound(\'snd/shimmerClick.mp3\');Game.Win(\'Olden days\');Game.UpdateMenu();" class="icon" style="display:inline-block;transform:scale(0.5);cursor:pointer;width:48px;height:48px;background-position:'+(-12*48)+'px '+(-3*48)+'px;"></div></div>';
			}
			else if (Game.onMenu=='stats')
			{
				var buildingsOwned=0;
				buildingsOwned=Game.BuildingsOwned;
				var upgrades='';
				var cookieUpgrades='';
				var hiddenUpgrades='';
				var prestigeUpgrades='';
				var upgradesTotal=0;
				var upgradesOwned=0;
				var prestigeUpgradesTotal=0;
				var prestigeUpgradesOwned=0;
				
				var list=[];
				//sort the upgrades
				for (var i in Game.Upgrades){list.push(Game.Upgrades[i]);}//clone first
				var sortMap=function(a,b)
				{
					if (a.order>b.order) return 1;
					else if (a.order<b.order) return -1;
					else return 0;
				}
				list.sort(sortMap);
				for (var i in list)
				{
					var str2='';
					var me=list[i];
					
					str2+=Game.crate(me,'stats');
					
					if (me.bought)
					{
						if (Game.CountsAsUpgradeOwned(me.pool)) upgradesOwned++;
						else if (me.pool=='prestige') prestigeUpgradesOwned++;
					}
					
					if (me.pool=='' || me.pool=='cookie' || me.pool=='tech') upgradesTotal++;
					if (me.pool=='debug') hiddenUpgrades+=str2;
					else if (me.pool=='prestige') {prestigeUpgrades+=str2;prestigeUpgradesTotal++;}
					else if (me.pool=='cookie') cookieUpgrades+=str2;
					else if (me.pool!='toggle' && me.pool!='unused') upgrades+=str2;
				}
				var achievements=[];
				var achievementsOwned=0;
				var achievementsOwnedOther=0;
				var achievementsTotal=0;
				
				var list=[];
				for (var i in Game.Achievements)//sort the achievements
				{
					list.push(Game.Achievements[i]);
				}
				var sortMap=function(a,b)
				{
					if (a.order>b.order) return 1;
					else if (a.order<b.order) return -1;
					else return 0;
				}
				list.sort(sortMap);
				
				
				for (var i in list)
				{
					var me=list[i];
					//if (me.pool=='normal' || me.won>0) achievementsTotal++;
					if (Game.CountsAsAchievementOwned(me.pool)) achievementsTotal++;
					var pool=me.pool;
					if (!achievements[pool]) achievements[pool]='';
					achievements[pool]+=Game.crate(me,'stats');
					
					if (me.won)
					{
						if (Game.CountsAsAchievementOwned(me.pool)) achievementsOwned++;
						else achievementsOwnedOther++;
					}
				}
				
				var achievementsStr='';
				var pools={
					'dungeon':(EN?'<b>Dungeon achievements</b> <small>(Not technically achievable yet.)</small>':'<b>???</b>'),
					'shadow':'<b>'+loc("Shadow achievements")+'</b> <small>('+loc("These are feats that are either unfair or difficult to attain. They do not give milk.")+')</small>'
				};
				for (var i in achievements)
				{
					if (achievements[i]!='')
					{
						if (pools[i]) achievementsStr+='<div class="listing">'+pools[i]+'</div>';
						achievementsStr+='<div class="listing crateBox">'+achievements[i]+'</div>';
					}
				}
				
				var milkStr='';
				for (var i=0;i<Game.Milks.length;i++)
				{
					if (Game.milkProgress>=i)
					{
						var milk=Game.Milks[i];
						milkStr+='<div '+Game.getTooltip(
						'<div class="prompt" style="text-align:center;padding-bottom:6px;white-space:nowrap;margin:0px;padding-bottom:96px;" id="tooltipMilk"><h3 style="margin:6px 32px 0px 32px;">'+(loc("Rank %1",romanize(i+1))+' - '+milk.name)+'</h3><div style="opacity:0.75;font-size:9px;">('+(i==0?loc("starter milk"):loc("for %1 achievements",Beautify(i*25)))+')</div><div class="line"></div><div style="width:100%;height:96px;position:absolute;left:0px;bottom:0px;background:url(img/'+milk.pic+');"></div></div>'
						,'top')+' style="background:url(img/icons.webp?v='+Game.version+') '+(-milk.icon[0]*48)+'px '+(-milk.icon[1]*48)+'px;margin:2px 0px;" class="trophy"></div>';
					}
				}
				milkStr+='<div style="clear:both;"></div>';
				
				var santaStr='';
				var frames=15;
				if (Game.Has('A festive hat'))
				{
					for (var i=0;i<=Game.santaLevel;i++)
					{
						santaStr+='<div '+Game.getTooltip(
						'<div class="prompt" style="text-align:center;padding-bottom:6px;white-space:nowrap;margin:0px 32px;"><div style="width:96px;height:96px;margin:4px auto;background:url(img/santa.webp) '+(-i*96)+'px 0px;filter:drop-shadow(0px 3px 2px #000);-webkit-filter:drop-shadow(0px 3px 2px #000);" id="tooltipSanta"></div><div class="line"></div><h3>'+Game.santaLevels[i]+'</h3></div>'
						,'top')+' style="background:url(img/santa.webp) '+(-i*48)+'px 0px;background-size:'+(frames*48)+'px 48px;" class="trophy"></div>';
					}
					santaStr+='<div style="clear:both;"></div>';
				}
				var dragonStr='';
				var frames=9;
				var mainLevels=[0,4,8,Game.dragonLevels.length-3,Game.dragonLevels.length-2,Game.dragonLevels.length-1];
				if (Game.Has('A crumbly egg'))
				{
					for (var i=0;i<=mainLevels.length;i++)
					{
						if (Game.dragonLevel>=mainLevels[i])
						{
							var level=Game.dragonLevels[mainLevels[i]];
							dragonStr+='<div '+Game.getTooltip(
							//'<div style="width:96px;height:96px;margin:4px auto;background:url(img/dragon.webp?v='+Game.version+') '+(-level.pic*96)+'px 0px;"></div><div class="line"></div><div style="min-width:200px;text-align:center;margin-bottom:6px;">'+level.name+'</div>'
							'<div class="prompt" style="text-align:center;padding-bottom:6px;white-space:nowrap;margin:0px 32px;" id="tooltipDragon"><div style="width:96px;height:96px;margin:4px auto;background:url(img/dragon.webp?v='+Game.version+') '+(-level.pic*96)+'px 0px;filter:drop-shadow(0px 3px 2px #000);-webkit-filter:drop-shadow(0px 3px 2px #000);"></div><div class="line"></div><h3>'+level.name+'</h3></div>'
							,'top')+' style="background:url(img/dragon.webp?v='+Game.version+') '+(-level.pic*48)+'px 0px;background-size:'+(frames*48)+'px 48px;" class="trophy"></div>';
						}
					}
					dragonStr+='<div style="clear:both;"></div>';
				}
				var ascensionModeStr='';
				var icon=Game.ascensionModes[Game.ascensionMode].icon;
				if (Game.resets>0) ascensionModeStr='<span style="cursor:pointer;" '+Game.getTooltip(
							'<div style="min-width:200px;text-align:center;font-size:11px;" id="tooltipChallengeMode">'+Game.ascensionModes[Game.ascensionMode].desc+'</div>'
							,'top')+'><div class="icon" style="display:inline-block;float:none;transform:scale(0.5);margin:-24px -16px -19px -8px;'+writeIcon(icon)+'"></div>'+Game.ascensionModes[Game.ascensionMode].dname+'</span>';
				
				var milkName=Game.Milk.name;
				
				var researchStr=Game.sayTime(Game.researchT,-1);
				var pledgeStr=Game.sayTime(Game.pledgeT,-1);
				var wrathStr='';
				if (Game.elderWrath==1) wrathStr=loc("awoken");
				else if (Game.elderWrath==2) wrathStr=loc("displeased");
				else if (Game.elderWrath==3) wrathStr=loc("angered");
				else if (Game.elderWrath==0 && Game.pledges>0) wrathStr=loc("appeased");
				
				var dropMult=Game.dropRateMult();
				
				var date=new Date();
				date.setTime(Date.now()-Game.startDate);
				var timeInSeconds=date.getTime()/1000;
				var startDate=Game.sayTime(timeInSeconds*Game.fps,-1);
				date.setTime(Date.now()-Game.fullDate);
				var fullDate=Game.sayTime(date.getTime()/1000*Game.fps,-1);
				if (!Game.fullDate || !fullDate || fullDate.length<1) fullDate=loc("a long while");
				/*date.setTime(new Date().getTime()-Game.lastDate);
				var lastDate=Game.sayTime(date.getTime()/1000*Game.fps,2);*/
				
				var heavenlyMult=Game.GetHeavenlyMultiplier();
				
				var seasonStr=Game.sayTime(Game.seasonT,-1);
				
				str+='<div class="section">'+(EN?"Statistics":loc("Stats"))+'</div>'+
				'<div class="subsection">'+
				'<div class="title">'+loc("General")+'</div>'+
				'<div id="statsGeneral">'+
					'<div class="listing"><b>'+loc("Cookies in bank:")+'</b> <div class="price plain">'+Game.tinyCookie()+Beautify(Game.cookies)+'</div></div>'+
					'<div class="listing"><b>'+loc("Cookies baked (this ascension):")+'</b> <div class="price plain">'+Game.tinyCookie()+Beautify(Game.cookiesEarned)+'</div></div>'+
					'<div class="listing"><b>'+loc("Cookies baked (all time):")+'</b> <div class="price plain">'+Game.tinyCookie()+Beautify(Game.cookiesEarned+Game.cookiesReset)+'</div></div>'+
					(Game.cookiesReset>0?'<div class="listing"><b>'+loc("Cookies forfeited by ascending:")+'</b> <div class="price plain">'+Game.tinyCookie()+Beautify(Game.cookiesReset)+'</div></div>':'')+
					(Game.resets?('<div class="listing"><b>'+loc("Legacy started:")+'</b> '+(fullDate==''?loc("just now"):loc("%1 ago",fullDate))+', '+loc("with %1 ascension",LBeautify(Game.resets))+'</div>'):'')+
					'<div class="listing"><b>'+loc("Run started:")+'</b> '+(startDate==''?loc("just now"):loc("%1 ago",startDate))+'</div>'+
					'<div class="listing"><b>'+loc("Buildings owned:")+'</b> '+Beautify(buildingsOwned)+'</div>'+
					'<div class="listing"><b>'+loc("Cookies per second:")+'</b> '+Beautify(Game.cookiesPs,1)+' <small>'+
						'('+loc("multiplier:")+' '+Beautify(Math.round(Game.globalCpsMult*100),1)+'%)'+
						(Game.cpsSucked>0?' <span class="warning">('+loc("withered:")+' '+Beautify(Math.round(Game.cpsSucked*100),1)+'%)</span>':'')+
						'</small></div>'+
					'<div class="listing"><b>'+loc("Raw cookies per second:")+'</b> '+Beautify(Game.cookiesPsRaw,1)+' <small>'+
						'('+loc("highest this ascension:")+' '+Beautify(Game.cookiesPsRawHighest,1)+')'+
						'</small></div>'+
					'<div class="listing"><b>'+loc("Cookies per click:")+'</b> '+Beautify(Game.computedMouseCps,1)+'</div>'+
					'<div class="listing"><b>'+loc("Cookie clicks:")+'</b> '+Beautify(Game.cookieClicks)+'</div>'+
					'<div class="listing"><b>'+loc("Hand-made cookies:")+'</b> '+Beautify(Game.handmadeCookies)+'</div>'+
					'<div class="listing"><b>'+loc("Golden cookie clicks:")+'</b> '+Beautify(Game.goldenClicksLocal)+' <small>('+loc("all time:")+' '+Beautify(Game.goldenClicks)+')</small></div>'+//' <span class="hidden">(<b>Missed golden cookies :</b> '+Beautify(Game.missedGoldenClicks)+')</span></div>'+
					(dropMult!=1?'<div class="listing"><b>'+loc("Random drop multiplier:")+'</b> <small>x</small>'+Beautify(dropMult,2)+'</div>':'')+
				'</div>'+
				'<br><div class="listing"><b>'+loc("Running version:")+'</b> '+Game.version.toFixed(3)+'</div>'+
				
				((researchStr!='' || wrathStr!='' || pledgeStr!='' || santaStr!='' || dragonStr!='' || Game.season!='' || ascensionModeStr!='' || Game.canLumps())?(
				'</div><div class="subsection">'+
				'<div class="title">'+loc("Special")+'</div>'+
				'<div id="statsSpecial">'+
					(ascensionModeStr!=''?'<div class="listing"><b>'+loc("Challenge mode:")+'</b>'+ascensionModeStr+'</div>':'')+
					(Game.season!=''?'<div class="listing"><b>'+loc("Seasonal event:")+'</b> '+Game.seasons[Game.season].name+
						(seasonStr!=''?' <small>('+loc("%1 remaining",seasonStr)+')</small>':'')+
					'</div>':'')+
					(EN && Game.season=='fools'?
						'<div class="listing"><b>Money made from selling cookies :</b> '+Beautify(Game.cookiesEarned*0.08,2)+' cookie dollars</div>'+
						(Game.Objects['Portal'].highest>0?'<div class="listing"><b>TV show seasons produced :</b> '+Beautify(Math.floor((timeInSeconds/60/60)*(Game.Objects['Portal'].highest*0.13)+1))+'</div>':'')
					:'')+
					(researchStr!=''?'<div class="listing"><b>'+loc("Research:")+'</b> '+loc("%1 remaining",researchStr)+'</div>':'')+
					(wrathStr!=''?'<div class="listing"><b>'+loc("Grandmatriarchs status:")+'</b> '+wrathStr+'</div>':'')+
					(pledgeStr!=''?'<div class="listing"><b>'+loc("Pledge:")+'</b> '+loc("%1 remaining",pledgeStr)+'</div>':'')+
					(Game.wrinklersPopped>0?'<div class="listing"><b>'+loc("Wrinklers popped:")+'</b> '+Beautify(Game.wrinklersPopped)+'</div>':'')+
					((Game.canLumps() && Game.lumpsTotal>-1)?'<div class="listing"><b>'+loc("Sugar lumps harvested:")+'</b> <div class="price lump plain">'+Beautify(Game.lumpsTotal)+'</div></div>':'')+
					//(Game.cookiesSucked>0?'<div class="listing warning"><b>Withered :</b> '+Beautify(Game.cookiesSucked)+' cookies</div>':'')+
					(Game.reindeerClicked>0?'<div class="listing"><b>'+loc("Reindeer found:")+'</b> '+Beautify(Game.reindeerClicked)+'</div>':'')+
					(santaStr!=''?'<div class="listing"><b>'+loc("Santa stages unlocked:")+'</b></div><div>'+santaStr+'</div>':'')+
					(dragonStr!=''?'<div class="listing"><b>'+loc("Dragon training:")+'</b></div><div>'+dragonStr+'</div>':'')+
				'</div>'
				):'')+
				((Game.prestige>0 || prestigeUpgrades!='')?(
				'</div><div class="subsection">'+
				'<div class="title">'+loc("Prestige")+'</div>'+
				'<div id="statsPrestige">'+
					'<div class="listing"><div class="icon" style="float:left;background-position:'+(-19*48)+'px '+(-7*48)+'px;"></div>'+
						'<div style="margin-top:8px;"><span class="title" style="font-size:22px;">'+loc("Prestige level:")+' '+Beautify(Game.prestige)+'</span> '+loc("at %1% of its potential <b>(+%2% CpS)</b>",[Beautify(heavenlyMult*100,1),Beautify(parseFloat(Game.prestige)*Game.heavenlyPower*heavenlyMult,1)])+'<br>'+loc("Heavenly chips:")+' <b>'+Beautify(Game.heavenlyChips)+'</b></div>'+
					'</div>'+
					(prestigeUpgrades!=''?(
					'<div class="listing" style="clear:left;"><b>'+loc("Prestige upgrades unlocked:")+'</b> '+prestigeUpgradesOwned+'/'+prestigeUpgradesTotal+' ('+Math.floor((prestigeUpgradesOwned/prestigeUpgradesTotal)*100)+'%)</div>'+
					'<div class="listing crateBox">'+prestigeUpgrades+'</div>'):'')+
				'</div>'
				):'')+

				'</div><div class="subsection">'+
				'<div class="title">'+loc("Upgrades")+'</div>'+
				'<div id="statsUpgrades">'+
					(hiddenUpgrades!=''?('<div class="listing"><b>Debug</b></div>'+
					'<div class="listing crateBox">'+hiddenUpgrades+'</div>'):'')+
					'<div class="listing"><b>'+loc("Upgrades unlocked:")+'</b> '+upgradesOwned+'/'+upgradesTotal+' ('+Math.floor((upgradesOwned/upgradesTotal)*100)+'%)</div>'+
					'<div class="listing crateBox">'+upgrades+'</div>'+
					(cookieUpgrades!=''?('<div class="listing"><b>'+loc("Cookies")+'</b></div>'+
					'<div class="listing crateBox">'+cookieUpgrades+'</div>'):'')+
				'</div>'+
				'</div><div class="subsection">'+
				'<div class="title">'+loc("Achievements")+'</div>'+
				'<div id="statsAchievs">'+
					'<div class="listing"><b>'+loc("Achievements unlocked:")+'</b> '+achievementsOwned+'/'+achievementsTotal+' ('+Math.floor((achievementsOwned/achievementsTotal)*100)+'%)'+(achievementsOwnedOther>0?('<span style="font-weight:bold;font-size:10px;color:#70a;"> (+'+achievementsOwnedOther+')</span>'):'')+'</div>'+
					(Game.cookiesMultByType['kittens']>1?('<div class="listing"><b>'+loc("Kitten multiplier:")+'</b> '+Beautify((Game.cookiesMultByType['kittens'])*100)+'%</div>'):'')+
					'<div class="listing"><b>'+loc("Milk")+':</b> '+milkName+'</div>'+
					(milkStr!=''?'<div class="listing"><b>'+loc("Milk flavors unlocked:")+'</b></div><div>'+milkStr+'</div>':'')+
					'<div class="listing"><small style="opacity:0.75;">('+loc("Milk is gained with each achievement. It can unlock unique upgrades over time.")+')</small></div>'+
					achievementsStr+
				'</div>'+
				'</div>'+
				'<div style="padding-bottom:128px;"></div>'
				;
			}
			//str='<div id="selectionKeeper" class="selectable">'+str+'</div>';
			l('menu').innerHTML=str;
			if (App)
			{
				var anchors=l('menu').getElementsByTagName('a');
				for (var i=0;i<anchors.length;i++)
				{
					var it=anchors[i];
					if (it.href)
					{
						console.log(it.href);
						AddEvent(it,'click',function(href){return function(){
							App.openLink(href);
						}}(it.href));
						it.removeAttribute('href');
					}
				}
			}
			/*AddEvent(l('selectionKeeper'),'mouseup',function(e){
				console.log('selection:',window.getSelection());
			});*/
		}
		
		AddEvent(l('prefsButton'),'click',function(){Game.ShowMenu('prefs');});
		AddEvent(l('statsButton'),'click',function(){Game.ShowMenu('stats');});
		AddEvent(l('logButton'),'click',function(){Game.ShowMenu('log');});
		AddEvent(l('legacyButton'),'click',function(){PlaySound('snd/tick.mp3');Game.Ascend();});
		Game.ascendMeter=l('ascendMeter');
		Game.ascendNumber=l('ascendNumber');
		
		
		/*=====================================================================================
		NEWS TICKER
		=======================================================================================*/
		Game.Ticker='';
		Game.TickerAge=0;
		Game.TickerEffect=0;
		Game.TickerN=0;
		Game.TickerClicks=0;
		Game.UpdateTicker=function()
		{
			Game.TickerAge--;
			if (Game.TickerAge<=0) Game.getNewTicker();
			else if (Game.Ticker=='') Game.getNewTicker(true);
		}
		Game.getNewTicker=function(manual)//note : "manual" is true if the ticker was clicked, but may also be true on startup etc
		{
			var list=[];
			
			var NEWS=loc("News :").replace(' ','&nbsp;')+' ';
			
			if (Game.TickerN%2==0 || Game.cookiesEarned>=10100000000)
			{
				var animals=['newts','penguins','scorpions','axolotls','puffins','porpoises','blowfish','horses','crayfish','slugs','humpback whales','nurse sharks','giant squids','polar bears','fruit bats','frogs','sea squirts','velvet worms','mole rats','paramecia','nematodes','tardigrades','giraffes','monkfish','wolfmen','goblins','hippies'];
				
				if (Math.random()<0.75 || Game.cookiesEarned<10000)
				{
					if (Game.Objects['Grandma'].amount>0) list.push('<q>'+choose(loc("Ticker (grandma)"))+'</q><sig>'+Game.Objects['Grandma'].single+'</sig>');
					
					if (!Game.prefs.notScary && Game.Objects['Grandma'].amount>=50) list.push('<q>'+choose(loc("Ticker (threatening grandma)"))+'</q><sig>'+Game.Objects['Grandma'].single+'</sig>');
					
					if (EN && Game.HasAchiev('Just wrong') && Math.random()<0.05) list.push(NEWS+'cookie manufacturer downsizes, sells own grandmother!');
					if (!Game.prefs.notScary && Game.HasAchiev('Just wrong') && Math.random()<0.4) list.push('<q>'+choose(loc("Ticker (angry grandma)"))+'</q><sig>'+Game.Objects['Grandma'].single+'</sig>');
					
					if (!Game.prefs.notScary && Game.Objects['Grandma'].amount>=1 && Game.pledges>0 && Game.elderWrath==0) list.push('<q>'+choose(loc("Ticker (grandmas return)"))+'</q><sig>'+Game.Objects['Grandma'].single+'</sig>');
					
					if (!EN)
					{
						for (var i in Game.Objects)
						{
							if (i!='Cursor' && i!='Grandma' && Game.Objects[i].amount>0) list.push(NEWS+choose(loc("Ticker ("+i+")")));
						}
						
						if (Game.cookiesEarned>=1000)
						{
							if (Game.season=='halloween') list.push(NEWS+choose(loc("Ticker (Halloween)")));
							if (Game.season=='christmas') list.push(NEWS+choose(loc("Ticker (Christmas)")));
							if (Game.season=='valentines') list.push(NEWS+choose(loc("Ticker (Valentines)")));
							if (Game.season=='easter') list.push(NEWS+choose(loc("Ticker (Easter)")));
						}
					}
					else
					{
						if (Game.Objects['Farm'].amount>0) list.push(choose([
						'News : cookie farms suspected of employing undeclared elderly workforce!',
						'News : cookie farms release harmful chocolate in our rivers, says scientist!',
						'News : genetically-modified chocolate controversy strikes cookie farmers!',
						'News : free-range farm cookies popular with today\'s hip youth, says specialist.',
						'News : farm cookies deemed unfit for vegans, says nutritionist.'
						]));
						
						if (Game.Objects['Mine'].amount>0) list.push(choose([
						'News : is our planet getting lighter? Experts examine the effects of intensive chocolate mining.',
						'News : '+Math.floor(Math.random()*1000+2)+' miners trapped in collapsed chocolate mine!',
						'News : chocolate mines found to cause earthquakes and sinkholes!',
						'News : chocolate mine goes awry, floods village in chocolate!',
						'News : depths of chocolate mines found to house "peculiar, chocolaty beings"!'
						]));
						
						if (Game.Objects['Factory'].amount>0) list.push(choose([
						'News : cookie factories linked to global warming!',
						'News : cookie factories involved in chocolate weather controversy!',
						'News : cookie factories on strike, robotic minions employed to replace workforce!',
						'News : cookie factories on strike - workers demand to stop being paid in cookies!',
						'News : factory-made cookies linked to obesity, says study.'
						]));
						
						if (Game.Objects['Bank'].amount>0) list.push(choose([
						'News : cookie loans on the rise as people can no longer afford them with regular money.',
						'News : cookies slowly creeping up their way as a competitor to traditional currency!',
						'News : most bakeries now fitted with ATMs to allow for easy cookie withdrawals and deposits.',
						'News : cookie economy now strong enough to allow for massive vaults doubling as swimming pools!',
						'News : "Tomorrow\'s wealthiest people will be calculated by their worth in cookies", predict economists.'
						]));
						
						if (Game.Objects['Temple'].amount>0) list.push(choose([
						'News : explorers bring back ancient artifact from abandoned temple; archeologists marvel at the centuries-old '+choose(['magic','carved','engraved','sculpted','royal','imperial','mummified','ritual','golden','silver','stone','cursed','plastic','bone','blood','holy','sacred','sacrificial','electronic','singing','tapdancing'])+' '+choose(['spoon','fork','pizza','washing machine','calculator','hat','piano','napkin','skeleton','gown','dagger','sword','shield','skull','emerald','bathtub','mask','rollerskates','litterbox','bait box','cube','sphere','fungus'])+'!',
						'News : recently-discovered chocolate temples now sparking new cookie-related cult; thousands pray to Baker in the sky!',
						'News : just how extensive is the cookie pantheon? Theologians speculate about possible '+choose(['god','goddess'])+' of '+choose([choose(animals),choose(['kazoos','web design','web browsers','kittens','atheism','handbrakes','hats','aglets','elevator music','idle games','the letter "P"','memes','hamburgers','bad puns','kerning','stand-up comedy','failed burglary attempts','clickbait','one weird tricks'])])+'.',
						'News : theists of the world discover new cookie religion - "Oh boy, guess we were wrong all along!"',
						'News : cookie heaven allegedly "sports elevator instead of stairway"; cookie hell "paved with flagstone, as good intentions make for poor building material".'
						]));
						
						if (Game.Objects['Wizard tower'].amount>0) list.push(choose([
						'News : all '+choose([choose(animals),choose(['public restrooms','clouds','politicians','moustaches','hats','shoes','pants','clowns','encyclopedias','websites','potted plants','lemons','household items','bodily fluids','cutlery','national landmarks','yogurt','rap music','underwear'])])+' turned into '+choose([choose(animals),choose(['public restrooms','clouds','politicians','moustaches','hats','shoes','pants','clowns','encyclopedias','websites','potted plants','lemons','household items','bodily fluids','cutlery','national landmarks','yogurt','rap music','underwear'])])+' in freak magic catastrophe!',
						'News : heavy dissent rages between the schools of '+choose(['water','fire','earth','air','lightning','acid','song','battle','peace','pencil','internet','space','time','brain','nature','techno','plant','bug','ice','poison','crab','kitten','dolphin','bird','punch','fart'])+' magic and '+choose(['water','fire','earth','air','lightning','acid','song','battle','peace','pencil','internet','space','time','brain','nature','techno','plant','bug','ice','poison','crab','kitten','dolphin','bird','punch','fart'])+' magic!',
						'News : get your new charms and curses at the yearly National Spellcrafting Fair! Exclusive prices on runes and spellbooks.',
						'News : cookie wizards deny involvement in shockingly ugly newborn - infant is "honestly grody-looking, but natural", say doctors.',
						'News : "Any sufficiently crude magic is indistinguishable from technology", claims renowned technowizard.'
						]));
						
						if (Game.Objects['Shipment'].amount>0) list.push(choose([
						'News : new chocolate planet found, becomes target of cookie-trading spaceships!',
						'News : massive chocolate planet found with 99.8% certified pure dark chocolate core!',
						'News : space tourism booming as distant planets attract more bored millionaires!',
						'News : chocolate-based organisms found on distant planet!',
						'News : ancient baking artifacts found on distant planet; "terrifying implications", experts say.'
						]));
						
						if (Game.Objects['Alchemy lab'].amount>0) list.push(choose([
						'News : national gold reserves dwindle as more and more of the precious mineral is turned to cookies!',
						'News : chocolate jewelry found fashionable, gold and diamonds "just a fad", says specialist.',
						'News : silver found to also be transmutable into white chocolate!',
						'News : defective alchemy lab shut down, found to convert cookies to useless gold.',
						'News : alchemy-made cookies shunned by purists!'
						]));
						
						if (Game.Objects['Portal'].amount>0) list.push(choose([
						'News : nation worried as more and more unsettling creatures emerge from dimensional portals!',
						'News : dimensional portals involved in city-engulfing disaster!',
						'News : tourism to cookieverse popular with bored teenagers! Casualty rate as high as 73%!',
						'News : cookieverse portals suspected to cause fast aging and obsession with baking, says study.',
						'News : "do not settle near portals," says specialist; "your children will become strange and corrupted inside."'
						]));
						
						if (Game.Objects['Time machine'].amount>0) list.push(choose([
						'News : time machines involved in history-rewriting scandal! Or are they?',
						'News : time machines used in unlawful time tourism!',
						'News : cookies brought back from the past "unfit for human consumption", says historian.',
						'News : various historical figures inexplicably replaced with talking lumps of dough!',
						'News : "I have seen the future," says time machine operator, "and I do not wish to go there again."'
						]));
						
						if (Game.Objects['Antimatter condenser'].amount>0) list.push(choose([
						'News : whole town seemingly swallowed by antimatter-induced black hole; more reliable sources affirm town "never really existed"!',
						'News : "explain to me again why we need particle accelerators to bake cookies?" asks misguided local woman.',
						'News : first antimatter condenser successfully turned on, doesn\'t rip apart reality!',
						'News : researchers conclude that what the cookie industry needs, first and foremost, is "more magnets".',
						'News : "unravelling the fabric of reality just makes these cookies so much tastier", claims scientist.'
						]));
						
						if (Game.Objects['Prism'].amount>0) list.push(choose([
						'News : new cookie-producing prisms linked to outbreak of rainbow-related viral videos.',
						'News : scientists warn against systematically turning light into matter - "One day, we\'ll end up with all matter and no light!"',
						'News : cookies now being baked at the literal speed of light thanks to new prismatic contraptions.',
						'News : "Can\'t you sense the prism watching us?", rambles insane local man. "No idea what he\'s talking about", shrugs cookie magnate/government official.',
						'News : world citizens advised "not to worry" about frequent atmospheric flashes.',
						]));
						
						if (Game.Objects['Chancemaker'].amount>0) list.push(choose([
						'News : strange statistical anomalies continue as weather forecast proves accurate an unprecedented 3 days in a row!',
						'News : local casino ruined as all gamblers somehow hit a week-long winning streak! "We might still be okay", says owner before being hit by lightning 47 times.',
						'News : neighboring nation somehow elects president with sensible policies in freak accident of random chance!',
						'News : million-to-one event sees gritty movie reboot turning out better than the original! "We have no idea how this happened", say movie execs.',
						'News : all scratching tickets printed as winners, prompting national economy to crash and, against all odds, recover overnight.',
						]));
						
						if (Game.Objects['Fractal engine'].amount>0) list.push(choose([
						'News : local man "done with Cookie Clicker", finds the constant self-references "grating and on-the-nose".',
						'News : local man sails around the world to find himself - right where he left it.',
						'News : local guru claims "there\'s a little bit of ourselves in everyone", under investigation for alleged cannibalism.',
						'News : news writer finds herself daydreaming about new career. Or at least a raise.',
						'News : polls find idea of cookies made of cookies "acceptable" - "at least we finally know what\'s in them", says interviewed citizen.',
						]));
						
						if (Game.Objects['Javascript console'].amount>0) list.push(choose([
						'News : strange fad has parents giving their newborns names such as Emma.js or Liam.js. At least one Baby.js reported.',
						'News : coding is hip! More and more teenagers turn to technical fields like programming, ensuring a future robot apocalypse and the doom of all mankind.',
						'News : developers unsure what to call their new javascript libraries as all combinations of any 3 dictionary words have already been taken.',
						'News : nation holds breath as nested ifs about to hatch.',
						'News : clueless copywriter forgets to escape a quote, ends news line prematurely; last words reported to be "Huh, why isn',
						]));
						
						if (Game.Objects['Idleverse'].amount>0) list.push(choose([
						'News : is another you living out their dreams in an alternate universe? Probably, you lazy bum!',
						'News : public recoils at the notion of a cosmos made of infinite idle games. "I kinda hoped there\'d be more to it", says distraught citizen.',
						'News : with an infinity of parallel universes, people turn to reassuring alternate dimensions, which only number "in the high 50s".',
						'News : "I find solace in the knowledge that at least some of my alternate selves are probably doing fine out there", says citizen\'s last remaining exemplar in the multiverse.',
						'News : comic book writers point to actual multiverse in defense of dubious plot points. "See? I told you it wasn\'t \'hackneyed and contrived\'!"'
						]));
						
						if (Game.Objects['Cortex baker'].amount>0) list.push(choose([
						'News : cortex baker wranglers kindly remind employees that cortex bakers are the bakery\'s material property and should not be endeared with nicknames.',
						'News : space-faring employees advised to ignore unusual thoughts and urges experienced within 2 parsecs of gigantic cortex bakers, say guidelines.',
						'News : astronomers warn of cortex baker trajectory drift, fear future head-on collisions resulting in costly concussions.',
						'News : runt cortex baker identified with an IQ of only quintuple digits: "just a bit of a dummy", say specialists.',
						'News : are you smarter than a cortex baker? New game show deemed "unfair" by contestants.'
						]));
						
						if (Game.season=='halloween' && Game.cookiesEarned>=1000) list.push(choose([
						'News : strange twisting creatures amass around cookie factories, nibble at assembly lines.',
						'News : ominous wrinkly monsters take massive bites out of cookie production; "this can\'t be hygienic", worries worker.',
						'News : pagan rituals on the rise as children around the world dress up in strange costumes and blackmail homeowners for candy.',
						'News : new-age terrorism strikes suburbs as houses find themselves covered in eggs and toilet paper.',
						'News : children around the world "lost and confused" as any and all Halloween treats have been replaced by cookies.'
						]));
						
						if (Game.season=='christmas' && Game.cookiesEarned>=1000) list.push(choose([
						'News : bearded maniac spotted speeding on flying sleigh! Investigation pending.',
						'News : Santa Claus announces new brand of breakfast treats to compete with cookie-flavored cereals! "They\'re ho-ho-horrible!" says Santa.',
						'News : "You mean he just gives stuff away for free?!", concerned moms ask. "Personally, I don\'t trust his beard."',
						'News : obese jolly lunatic still on the loose, warn officials. "Keep your kids safe and board up your chimneys. We mean it."',
						'News : children shocked as they discover Santa Claus isn\'t just their dad in a costume after all!<br>"I\'m reassessing my life right now", confides Laura, aged 6.',
						'News : mysterious festive entity with quantum powers still wrecking havoc with army of reindeer, officials say.',
						'News : elves on strike at toy factory! "We will not be accepting reindeer chow as payment anymore. And stop calling us elves!"',
						'News : elves protest around the nation; wee little folks in silly little outfits spread mayhem, destruction; rabid reindeer running rampant through streets.',
						'News : scholars debate regarding the plural of reindeer(s) in the midst of elven world war.',
						'News : elves "unrelated to gnomes despite small stature and merry disposition", find scientists.',
						'News : elves sabotage radioactive frosting factory, turn hundreds blind in vicinity - "Who in their right mind would do such a thing?" laments outraged mayor.',
						'News : drama unfolds at North Pole as rumors crop up around Rudolph\'s red nose; "I may have an addiction or two", admits reindeer.'
						]));
						
						if (Game.season=='valentines' && Game.cookiesEarned>=1000) list.push(choose([
						'News : organ-shaped confectioneries being traded in schools all over the world; gruesome practice undergoing investigation.',
						'News : heart-shaped candies overtaking sweets business, offering competition to cookie empire. "It\'s the economy, cupid!"',
						'News : love\'s in the air, according to weather specialists. Face masks now offered in every city to stunt airborne infection.',
						'News : marrying a cookie - deranged practice, or glimpse of the future?',
						'News : boyfriend dumped after offering his lover cookies for Valentine\'s Day, reports say. "They were off-brand", shrugs ex-girlfriend.'
						]));
						
						if (Game.season=='easter' && Game.cookiesEarned>=1000) list.push(choose([
						'News : long-eared critters with fuzzy tails invade suburbs, spread terror and chocolate!',
						'News : eggs have begun to materialize in the most unexpected places; "no place is safe", warn experts.',
						'News : packs of rampaging rabbits cause billions in property damage; new strain of myxomatosis being developed.',
						'News : egg-laying rabbits "not quite from this dimension", warns biologist; advises against petting, feeding, or cooking the creatures.',
						'News : mysterious rabbits found to be egg-layers, but mammalian, hinting at possible platypus ancestry.'
						]));
					}
				}
				if (!EN)
				{
					if (Game.cookiesEarned>=10000)
					{
						list.push(NEWS+choose(loc("Ticker (misc)")));
						list.push(NEWS+choose(loc("Ticker (misc)")));
						list.push(NEWS+choose(loc("Ticker (misc)")));
					}
				}
				else
				{
					if (Math.random()<0.05)
					{
						if (Game.HasAchiev('Base 10')) list.push('News : cookie manufacturer completely forgoes common sense, lets strange obsession with round numbers drive building decisions!');
						if (Game.HasAchiev('From scratch')) list.push('News : follow the tear-jerking, riches-to-rags story about a local cookie manufacturer who decided to give it all up!');
						if (Game.HasAchiev('A world filled with cookies')) list.push('News : known universe now jammed with cookies! No vacancies!');
						if (Game.HasAchiev('Last Chance to See')) list.push('News : incredibly rare albino wrinkler on the brink of extinction poached by cookie-crazed pastry magnate!');
						if (Game.Has('Serendipity')) list.push('News : local cookie manufacturer becomes luckiest being alive!');
						if (Game.Has('Season switcher')) list.push('News : seasons are all out of whack! "We need to get some whack back into them seasons", says local resident.');
						
						if (Game.Has('Kitten helpers')) list.push('News : faint meowing heard around local cookie facilities; suggests new ingredient being tested.');
						if (Game.Has('Kitten workers')) list.push('News : crowds of meowing kittens with little hard hats reported near local cookie facilities.');
						if (Game.Has('Kitten engineers')) list.push('News : surroundings of local cookie facilities now overrun with kittens in adorable little suits. Authorities advise to stay away from the premises.');
						if (Game.Has('Kitten overseers')) list.push('News : locals report troupe of bossy kittens meowing adorable orders at passersby.');
						if (Game.Has('Kitten managers')) list.push('News : local office cubicles invaded with armies of stern-looking kittens asking employees "what\'s happening, meow".');
						if (Game.Has('Kitten accountants')) list.push('News : tiny felines show sudden and amazing proficiency with fuzzy mathematics and pawlinomials, baffling scientists and pet store owners.');
						if (Game.Has('Kitten specialists')) list.push('News : new kitten college opening next week, offers courses on cookie-making and catnip studies.');
						if (Game.Has('Kitten experts')) list.push('News : unemployment rates soaring as woefully adorable little cats nab jobs on all levels of expertise, says study.');
						if (Game.Has('Kitten consultants')) list.push('News : "In the future, your job will most likely be done by a cat", predicts suspiciously furry futurologist.');
						if (Game.Has('Kitten assistants to the regional manager')) list.push('News : strange kittens with peculiar opinions on martial arts spotted loitering on local beet farms!');
						if (Game.Has('Kitten marketeers')) list.push('News : nonsensical kitten billboards crop up all over countryside, trying to sell people the cookies they already get for free!');
						if (Game.Has('Kitten analysts')) list.push('News : are your spending habits sensible? For a hefty fee, these kitten analysts will tell you!');
						if (Game.Has('Kitten executives')) list.push('News : kittens strutting around in hot little business suits shouting cut-throat orders at their assistants, possibly the cutest thing this reporter has ever seen!');
						if (Game.Has('Kitten admins')) list.push('News : all systems nominal, claim kitten admins obviously in way over their heads.');
						if (Game.Has('Kitten angels')) list.push('News : "Try to ignore any ghostly felines that may be purring inside your ears," warn scientists. "They\'ll just lure you into making poor life choices."');
						if (Game.Has('Kitten wages')) list.push('News : kittens break glass ceiling! Do they have any idea how expensive those are!');
						if (Game.HasAchiev('Jellicles')) list.push('News : local kittens involved in misguided musical production, leave audience perturbed and unnerved.');
					}
					
					if (Game.HasAchiev('Dude, sweet') && Math.random()<0.2) list.push(choose([
					'News : major sugar-smuggling ring dismantled by authorities; '+Math.floor(Math.random()*30+3)+' tons of sugar lumps seized, '+Math.floor(Math.random()*48+2)+' suspects apprehended.',
					'News : authorities warn tourists not to buy bootleg sugar lumps from street peddlers - "You think you\'re getting a sweet deal, but what you\'re being sold is really just ordinary cocaine", says agent.',
					'News : pro-diabetes movement protests against sugar-shaming. "I\'ve eaten nothing but sugar lumps for the past '+Math.floor(Math.random()*10+4)+' years and I\'m feeling great!", says woman with friable skin.',
					'News : experts in bitter disagreement over whether sugar consumption turns children sluggish or hyperactive.',
					'News : fishermen deplore upturn in fish tooth decay as sugar lumps-hauling cargo sinks into the ocean.',
					'News : rare black sugar lump that captivated millions in unprecedented auction revealed to be common toxic fungus.',
					'News : "Back in my day, sugar lumps were these little cubes you\'d put in your tea, not those fist-sized monstrosities people eat for lunch", whines curmudgeon with failing memory.',
					'News : sugar lump-snacking fad sweeps the nation; dentists everywhere rejoice.'
					]));
					
					if (Math.random()<0.001)//apologies to Will Wright
					{
						list.push(
						'You have been chosen. They will come soon.',
						'They\'re coming soon. Maybe you should think twice about opening the door.',
						'The end is near. Make preparations.',
						'News : broccoli tops for moms, last for kids; dads indifferent.',
						'News : middle age a hoax, declares study; turns out to be bad posture after all.',
						'News : kitties want answers in possible Kitty Kibble shortage.'
						);
					}
					
					if (Game.cookiesEarned>=10000) list.push(
					'News : '+choose([
						'cookies found to '+choose(['increase lifespan','sensibly increase intelligence','reverse aging','decrease hair loss','prevent arthritis','cure blindness'])+' in '+choose(animals)+'!',
						'cookies found to make '+choose(animals)+' '+choose(['more docile','more handsome','nicer','less hungry','more pragmatic','tastier'])+'!',
						'cookies tested on '+choose(animals)+', found to have no ill effects.',
						'cookies unexpectedly popular among '+choose(animals)+'!',
						'unsightly lumps found on '+choose(animals)+' near cookie facility; "they\'ve pretty much always looked like that", say biologists.',
						'new species of '+choose(animals)+' discovered in distant country; "yup, tastes like cookies", says biologist.',
						'cookies go well with '+choose([choose(['roasted','toasted','boiled','sauteed','minced'])+' '+choose(animals),choose(['sushi','soup','carpaccio','steak','nuggets'])+' made from '+choose(animals)])+', says controversial chef.',
						'"do your cookies contain '+choose(animals)+'?", asks PSA warning against counterfeit cookies.',
						'doctors recommend twice-daily consumption of fresh cookies.',
						'doctors warn against chocolate chip-snorting teen fad.',
						'doctors advise against new cookie-free fad diet.',
						'doctors warn mothers about the dangers of "home-made cookies".'
						]),
					'News : "'+choose([
						'I\'m all about cookies',
						'I just can\'t stop eating cookies. I think I seriously need help',
						'I guess I have a cookie problem',
						'I\'m not addicted to cookies. That\'s just speculation by fans with too much free time',
						'my upcoming album contains 3 songs about cookies',
						'I\'ve had dreams about cookies 3 nights in a row now. I\'m a bit worried honestly',
						'accusations of cookie abuse are only vile slander',
						'cookies really helped me when I was feeling low',
						'cookies are the secret behind my perfect skin',
						'cookies helped me stay sane while filming my upcoming movie',
						'cookies helped me stay thin and healthy',
						'I\'ll say one word, just one : cookies',
						'alright, I\'ll say it - I\'ve never eaten a single cookie in my life'
						])+'", reveals celebrity.',
					choose([
						'News : scientist predicts imminent cookie-related "end of the world"; becomes joke among peers.',
						'News : man robs bank, buys cookies.',
						'News : scientists establish that the deal with airline food is, in fact, a critical lack of cookies.',
						'News : hundreds of tons of cookies dumped into starving country from airplanes; thousands dead, nation grateful.',
						'News : new study suggests cookies neither speed up nor slow down aging, but instead "take you in a different direction".',
						'News : overgrown cookies found in fishing nets, raise questions about hormone baking.',
						'News : "all-you-can-eat" cookie restaurant opens in big city; waiters trampled in minutes.',
						'News : man dies in cookie-eating contest; "a less-than-impressive performance", says judge.',
						'News : what makes cookies taste so right? "Probably all the [*****] they put in them", says anonymous tipper.',
						'News : man found allergic to cookies; "what a weirdo", says family.',
						'News : foreign politician involved in cookie-smuggling scandal.',
						'News : cookies now more popular than '+choose(['cough drops','broccoli','smoked herring','cheese','video games','stable jobs','relationships','time travel','cat videos','tango','fashion','television','nuclear warfare','whatever it is we ate before','politics','oxygen','lamps'])+', says study.',
						'News : obesity epidemic strikes nation; experts blame '+choose(['twerking','that darn rap music','video-games','lack of cookies','mysterious ghostly entities','aliens','parents','schools','comic-books','cookie-snorting fad'])+'.',
						'News : cookie shortage strikes town, people forced to eat cupcakes; "just not the same", concedes mayor.',
						'News : "you gotta admit, all this cookie stuff is a bit ominous", says confused idiot.',
						//'News : scientists advise getting used to cookies suffusing every aspect of life; "this is the new normal", expert says.',
						//'News : doctors advise against wearing face masks when going outside. "You never know when you might need a cookie... a mask would just get in the way."',//these were written back when covid hadn't really done much damage yet but they just feel in poor taste now
						'News : is there life on Mars? Various chocolate bar manufacturers currently under investigation for bacterial contaminants.',
						'News : "so I guess that\'s a thing now", scientist comments on cookie particles now present in virtually all steel manufactured since cookie production ramped up worldwide.',
						'News : trace amounts of cookie particles detected in most living creatures, some of which adapting them as part of new and exotic metabolic processes.',
					]),
					choose([
						'News : movie cancelled from lack of actors; "everybody\'s at home eating cookies", laments director.',
						'News : comedian forced to cancel cookie routine due to unrelated indigestion.',
						'News : new cookie-based religion sweeps the nation.',
						'News : fossil records show cookie-based organisms prevalent during Cambrian explosion, scientists say.',
						'News : mysterious illegal cookies seized; "tastes terrible", says police.',
						'News : man found dead after ingesting cookie; investigators favor "mafia snitch" hypothesis.',
						'News : "the universe pretty much loops on itself," suggests researcher; "it\'s cookies all the way down."',
						'News : minor cookie-related incident turns whole town to ashes; neighboring cities asked to chip in for reconstruction.',
						'News : is our media controlled by the cookie industry? This could very well be the case, says crackpot conspiracy theorist.',
						'News : '+choose(['cookie-flavored popcorn pretty damn popular; "we kinda expected that", say scientists.','cookie-flavored cereals break all known cereal-related records','cookies popular among all age groups, including fetuses, says study.','cookie-flavored popcorn sales exploded during screening of Grandmothers II : The Moistening.']),
						'News : all-cookie restaurant opening downtown. Dishes such as braised cookies, cookie thermidor, and for dessert : crepes.',
						'News : "Ook", says interviewed orangutan.',
						'News : cookies could be the key to '+choose(['eternal life','infinite riches','eternal youth','eternal beauty','curing baldness','world peace','solving world hunger','ending all wars world-wide','making contact with extraterrestrial life','mind-reading','better living','better eating','more interesting TV shows','faster-than-light travel','quantum baking','chocolaty goodness','gooder thoughtness'])+', say scientists.',
						'News : flavor text '+choose(['not particularly flavorful','kind of unsavory','"rather bland"','pretty spicy lately'])+', study finds.',
					]),
					choose([
						'News : what do golden cookies taste like? Study reveals a flavor "somewhere between spearmint and liquorice".',
						'News : what do wrath cookies taste like? Study reveals a flavor "somewhere between blood sausage and seawater".',
						'News : '+Game.bakeryName+'-brand cookies "'+choose(['much less soggy','much tastier','relatively less crappy','marginally less awful','less toxic','possibly more edible','more fashionable','slightly nicer','trendier','arguably healthier','objectively better choice','slightly less terrible','decidedly cookier','a tad cheaper'])+' than competitors", says consumer survey.',
						'News : "'+Game.bakeryName+'" set to be this year\'s most popular baby name.',
						'News : new popularity survey says '+Game.bakeryName+'\'s the word when it comes to cookies.',
						'News : major city being renamed '+Game.bakeryName+'ville after world-famous cookie manufacturer.',
						'News : '+choose(['street','school','nursing home','stadium','new fast food chain','new planet','new disease','flesh-eating bacteria','deadly virus','new species of '+choose(animals),'new law','baby','programming language'])+' to be named after '+Game.bakeryName+', the world-famous cookie manufacturer.',
						'News : don\'t miss tonight\'s biopic on '+Game.bakeryName+'\'s irresistible rise to success!',
						'News : don\'t miss tonight\'s interview of '+Game.bakeryName+' by '+choose(['Bloprah','Blavid Bletterman','Blimmy Blimmel','Blellen Blegeneres','Blimmy Blallon','Blonan Blo\'Brien','Blay Bleno','Blon Blewart','Bleven Blolbert','Lord Toxikhron of dimension 7-B19',Game.bakeryName+'\'s own evil clone'])+'!',
						'News : people all over the internet still scratching their heads over nonsensical reference : "Okay, but why an egg?"',
						'News : viral video "Too Many Cookies" could be "a grim commentary on the impending crisis our world is about to face", says famous economist.',
						'News : "memes from last year somehow still relevant", deplore experts.',
						'News : cookie emoji most popular among teenagers, far ahead of "judgmental OK hand sign" and "shifty-looking dark moon", says study.',
					]),
					choose([
						'News : births of suspiciously bald babies on the rise; ancient alien cabal denies involvement.',
						'News : "at this point, cookies permeate the economy", says economist. "If we start eating anything else, we\'re all dead."',
						'News : pun in headline infuriates town, causes riot. 21 wounded, 5 dead; mayor still missing.',
						'Nws : ky btwn W and R brokn, plas snd nw typwritr ASAP.',
						'Neeeeews : "neeeew EEEEEE keeeeey working fineeeeeeeee", reeeports gleeeeeeeeful journalist.',
						'News : cookies now illegal in some backwards country nobody cares about. Political tensions rising; war soon, hopefully.',
						'News : irate radio host rambles about pixelated icons. "None of the cookies are aligned! Can\'t anyone else see it? I feel like I\'m taking crazy pills!"',
						'News : nation cheers as legislators finally outlaw '+choose(['cookie criticism','playing other games than Cookie Clicker','pineapple on pizza','lack of cheerfulness','mosquitoes','broccoli','the human spleen','bad weather','clickbait','dabbing','the internet','memes','millennials'])+'!',
						'News : '+choose(['local','area'])+' '+choose(['man','woman'])+' goes on journey of introspection, finds cookies : "I honestly don\'t know what I was expecting."',
						'News : '+choose(['man','woman'])+' wakes up from coma, '+choose(['tries cookie for the first time, dies.','regrets it instantly.','wonders "why everything is cookies now".','babbles incoherently about some supposed "non-cookie food" we used to eat.','cites cookies as main motivator.','asks for cookies.']),
						'News : pet '+choose(animals)+', dangerous fad or juicy new market?',
						'News : person typing these wouldn\'t mind someone else breaking the news to THEM, for a change.',
						'News : "average person bakes '+Beautify(Math.ceil(Game.cookiesEarned/7300000000))+' cookie'+(Math.ceil(Game.cookiesEarned/7300000000)==1?'':'s')+' a year" factoid actually just statistical error; '+Game.bakeryName+', who has produced '+Beautify(Game.cookiesEarned)+' cookies in their lifetime, is an outlier and should not have been counted.'
						])
					);
				}
			}
			
			if (list.length==0)
			{
				if (Game.cookiesEarned<5) list.push(loc("You feel like making cookies. But nobody wants to eat your cookies."));
				else if (Game.cookiesEarned<50) list.push(loc("Your first batch goes to the trash. The neighborhood raccoon barely touches it."));
				else if (Game.cookiesEarned<100) list.push(loc("Your family accepts to try some of your cookies."));
				else if (Game.cookiesEarned<500) list.push(loc("Your cookies are popular in the neighborhood."));
				else if (Game.cookiesEarned<1000) list.push(loc("People are starting to talk about your cookies."));
				else if (Game.cookiesEarned<5000) list.push(loc("Your cookies are talked about for miles around."));
				else if (Game.cookiesEarned<10000) list.push(loc("Your cookies are renowned in the whole town!"));
				else if (Game.cookiesEarned<50000) list.push(loc("Your cookies bring all the boys to the yard."));
				else if (Game.cookiesEarned<100000) list.push(loc("Your cookies now have their own website!"));
				else if (Game.cookiesEarned<500000) list.push(loc("Your cookies are worth a lot of money."));
				else if (Game.cookiesEarned<1000000) list.push(loc("Your cookies sell very well in distant countries."));
				else if (Game.cookiesEarned<5000000) list.push(loc("People come from very far away to get a taste of your cookies."));
				else if (Game.cookiesEarned<10000000) list.push(loc("Kings and queens from all over the world are enjoying your cookies."));
				else if (Game.cookiesEarned<50000000) list.push(loc("There are now museums dedicated to your cookies."));
				else if (Game.cookiesEarned<100000000) list.push(loc("A national day has been created in honor of your cookies."));
				else if (Game.cookiesEarned<500000000) list.push(loc("Your cookies have been named a part of the world wonders."));
				else if (Game.cookiesEarned<1000000000) list.push(loc("History books now include a whole chapter about your cookies."));
				else if (Game.cookiesEarned<5000000000) list.push(loc("Your cookies have been placed under government surveillance."));
				else if (Game.cookiesEarned<10000000000) list.push(loc("The whole planet is enjoying your cookies!"));
				else if (Game.cookiesEarned<50000000000) list.push(loc("Strange creatures from neighboring planets wish to try your cookies."));
				else if (Game.cookiesEarned<100000000000) list.push(loc("Elder gods from the whole cosmos have awoken to taste your cookies."));
				else if (Game.cookiesEarned<500000000000) list.push(loc("Beings from other dimensions lapse into existence just to get a taste of your cookies."));
				else if (Game.cookiesEarned<1000000000000) list.push(loc("Your cookies have achieved sentience."));
				else if (Game.cookiesEarned<5000000000000) list.push(loc("The universe has now turned into cookie dough, to the molecular level."));
				else if (Game.cookiesEarned<10000000000000) list.push(loc("Your cookies are rewriting the fundamental laws of the universe."));
				else if (Game.cookiesEarned<10000000000000) list.push(loc("A local news station runs a 10-minute segment about your cookies. Success!<br><span style=\"font-size:50%;\">(you win a cookie)</span>"));
				else if (Game.cookiesEarned<10100000000000) list.push(loc("it's time to stop playing"));//only show this for 100 millions (it's funny for a moment)
			}
			
			//if (Game.elderWrath>0 && (Game.pledges==0 || Math.random()<0.2))
			if (Game.elderWrath>0 && (((Game.pledges==0 && Game.resets==0) && Math.random()<0.3) || Math.random()<0.03))
			{
				list=[];
				if (Game.elderWrath==1) list.push(EN?choose([
					'News : millions of old ladies reported missing!',
					'News : processions of old ladies sighted around cookie facilities!',
					'News : families around the continent report agitated, transfixed grandmothers!',
					'News : doctors swarmed by cases of old women with glassy eyes and a foamy mouth!',
					'News : nurses report "strange scent of cookie dough" around female elderly patients!'
				]):(NEWS+choose(loc("Ticker (grandma invasion start)"))));
				if (Game.elderWrath==2) list.push(EN?choose([
					'News : town in disarray as strange old ladies break into homes to abduct infants and baking utensils!',
					'News : sightings of old ladies with glowing eyes terrify local population!',
					'News : retirement homes report "female residents slowly congealing in their seats"!',
					'News : whole continent undergoing mass exodus of old ladies!',
					'News : old women freeze in place in streets, ooze warm sugary syrup!'
				]):(NEWS+choose(loc("Ticker (grandma invasion rise)"))));
				if (Game.elderWrath==3) list.push(EN?choose([
					'News : large "flesh highways" scar continent, stretch between various cookie facilities!',
					'News : wrinkled "flesh tendrils" visible from space!',
					'News : remains of "old ladies" found frozen in the middle of growing fleshy structures!', 
					'News : all hope lost as writhing mass of flesh and dough engulfs whole city!',
					'News : nightmare continues as wrinkled acres of flesh expand at alarming speeds!'
				]):(NEWS+choose(loc("Ticker (grandma invasion full)"))));
			}
			
			if (EN && Game.season=='fools')
			{
				list=[];
				
				if (Game.cookiesEarned>=1000) list.push(choose([
					'Your office chair is really comfortable.',
					'Business meetings are such a joy!',
					'You\'ve spent the whole day '+choose(['signing contracts','filling out forms','touching base with the team','examining exciting new prospects','playing with your desk toys','getting new nameplates done','attending seminars','videoconferencing','hiring dynamic young executives','meeting new investors','playing minigolf in your office'])+'!',
					'The word of the day is : '+choose(['viral','search engine optimization','blags and wobsites','social networks','web 3.0','logistics','leveraging','branding','proactive','synergizing','market research','demographics','pie charts','blogular','blogulacious','blogastic','authenticity','electronic mail','cellular phones','rap music','cookies, I guess'])+'.',
					'Profit\'s in the air!'
				]));
				if (Game.cookiesEarned>=1000 && Math.random()<0.1) list.push(choose([
					'If you could get some more cookies baked, that\'d be great.',
					'So. About those TPS reports.',
					'Another day in paradise!',
					'Working hard, or hardly working?'
				]));
				
				
				if (Game.TickerN%2==0 || Game.cookiesEarned>=10100000000)
				{
					if (Game.Objects['Grandma'].amount>0) list.push(choose([
					'Your rolling pins are rolling and pinning!',
					'Production is steady!'
					]));
					
					if (Game.Objects['Grandma'].amount>0) list.push(choose([
					'Your ovens are diligently baking more and more cookies.',
					'Your ovens burn a whole batch. Ah well! Still good.'
					]));
					
					if (Game.Objects['Farm'].amount>0) list.push(choose([
					'Scores of cookies come out of your kitchens.',
					'Today, new recruits are joining your kitchens!'
					]));
					
					if (Game.Objects['Factory'].amount>0) list.push(choose([
					'Your factories are producing an unending stream of baked goods.',
					'Your factory workers decide to go on strike!',
					'It\'s safety inspection day in your factories.'
					]));
					
					if (Game.Objects['Mine'].amount>0) list.push(choose([
					'Your secret recipes are kept safely inside a giant underground vault.',
					'Your chefs are working on new secret recipes!'
					]));
					
					if (Game.Objects['Shipment'].amount>0) list.push(choose([
					'Your supermarkets are bustling with happy, hungry customers.',
					'Your supermarkets are full of cookie merch!'
					]));
					
					if (Game.Objects['Alchemy lab'].amount>0) list.push(choose([
					'It\'s a new trading day at the stock exchange, and traders can\'t get enough of your shares!',
					'Your stock is doubling in value by the minute!'
					]));
					
					if (Game.Objects['Portal'].amount>0) list.push(choose([
					'You just released a new TV show episode!',
					'Your cookie-themed TV show is being adapted into a new movie!'
					]));
					
					if (Game.Objects['Time machine'].amount>0) list.push(choose([
					'Your theme parks are doing well - puddles of vomit and roller-coaster casualties are being swept under the rug!',
					'Visitors are stuffing themselves with cookies before riding your roller-coasters. You might want to hire more clean-up crews.'
					]));
					
					if (Game.Objects['Antimatter condenser'].amount>0) list.push(choose([
					'Cookiecoin is officially the most mined digital currency in the history of mankind!',
					'Cookiecoin piracy is rampant!'
					]));
					
					if (Game.Objects['Prism'].amount>0) list.push(choose([
					'Your corporate nations just gained a new parliament!',
					'You\'ve just annexed a new nation!',
					'A new nation joins the grand cookie conglomerate!'
					]));
					
					if (Game.Objects['Chancemaker'].amount>0) list.push(choose([
					'Your intergalactic federation of cookie-sponsored planets reports record-breaking profits!',
					'Billions of unwashed aliens are pleased to join your workforce as you annex their planet!',
					'New toll opened on interstellar highway, funnelling more profits into the cookie economy!'
					]));
					
					if (Game.Objects['Fractal engine'].amount>0) list.push(choose([
					'Your cookie-based political party is doing fantastic in the polls!',
					'New pro-cookie law passes without a hitch thanks to your firm grasp of the political ecosystem!',
					'Your appointed senators are overturning cookie bans left and right!'
					]));
					
					if (Game.Objects['Javascript console'].amount>0) list.push(choose([
					'Cookies are now one of the defining aspects of mankind! Congratulations!',
					'Time travelers report that this era will later come to be known, thanks to you, as the cookie millennium!',
					'Cookies now deeply rooted in human culture, likely puzzling future historians!'
					]));
					
					if (Game.Objects['Idleverse'].amount>0) list.push(choose([
					'Public aghast as all remaining aspects of their lives overtaken by universal cookie industry!',
					'Every single product currently sold in the observable universe can be traced back to your company! And that\'s a good thing.',
					'Antitrust laws let out a helpless whimper before being engulfed by your sprawling empire!'
					]));
					
					if (Game.Objects['Cortex baker'].amount>0) list.push(choose([
					'Bold new law proposal would grant default ownership of every new idea by anyone anywhere to '+Game.bakeryName+'\'s bakery!',
					'Bakery think tanks accidentally reinvent cookies for the 57th time this week!',
					'Bakery think tanks invent entire new form of human communication to advertise and boost cookie sales!'
					]));
				}
				
				if (Game.cookiesEarned<5) list.push('Such a grand day to begin a new business.');
				else if (Game.cookiesEarned<50) list.push('You\'re baking up a storm!');
				else if (Game.cookiesEarned<100) list.push('You are confident that one day, your cookie company will be the greatest on the market!');
				else if (Game.cookiesEarned<1000) list.push('Business is picking up!');
				else if (Game.cookiesEarned<5000) list.push('You\'re making sales left and right!');
				else if (Game.cookiesEarned<20000) list.push('Everyone wants to buy your cookies!');
				else if (Game.cookiesEarned<50000) list.push('You are now spending most of your day signing contracts!');
				else if (Game.cookiesEarned<500000) list.push('You\'ve been elected "business tycoon of the year"!');
				else if (Game.cookiesEarned<1000000) list.push('Your cookies are a worldwide sensation! Well done, old chap!');
				else if (Game.cookiesEarned<5000000) list.push('Your brand has made its way into popular culture. Children recite your slogans and adults reminisce them fondly!');
				else if (Game.cookiesEarned<1000000000) list.push('A business day like any other. It\'s good to be at the top!');
				else if (Game.cookiesEarned<10100000000) list.push('You look back at your career. It\'s been a fascinating journey, building your baking empire from the ground up.');//only show this for 100 millions
			}
			
			for (var i=0;i<Game.modHooks['ticker'].length;i++)
			{
				var arr=Game.modHooks['ticker'][i]();
				if (arr) list=list.concat(arr);
			}
			
			Game.TickerEffect=0;
			
			if (!manual && Game.T>Game.fps*10 && Game.Has('Fortune cookies') && Math.random()<(Game.HasAchiev('O Fortuna')?0.04:0.02))
			{
				var fortunes=[];
				for (var i in Game.Tiers['fortune'].upgrades)
				{
					var it=Game.Tiers['fortune'].upgrades[i];
					if (!Game.HasUnlocked(it.name)) fortunes.push(it);
				}
				
				if (!Game.fortuneGC) fortunes.push('fortuneGC');
				if (!Game.fortuneCPS) fortunes.push('fortuneCPS');
				
				if (fortunes.length>0)
				{
					list=[];
					var me=choose(fortunes);
					Game.TickerEffect={type:'fortune',sub:me};
					
					if (me=='fortuneGC') me=loc("Today is your lucky day!");/*<br>Click here for a golden cookie.';*/
					else if (me=='fortuneCPS') {Math.seedrandom(Game.seed+'-fortune');me=loc("Your lucky numbers are:")+' '+Math.floor(Math.random()*100)+' '+Math.floor(Math.random()*100)+' '+Math.floor(Math.random()*100)+' '+Math.floor(Math.random()*100)/*+'<br>Click here to gain one hour of your CpS.'*/;Math.seedrandom();}
					else
					{
						if (EN)
						{
							me=me.dname.substring(me.name.indexOf('#'))+' : '+me.baseDesc.substring(me.baseDesc.indexOf('<q>')+3);
							me=me.substring(0,me.length-4);
						}
						else if (me.buildingTie) me=me.dname+' : '+loc(choose(["Never forget your %1.","Pay close attention to the humble %1.","You've been neglecting your %1.","Remember to visit your %1 sometimes."]),me.buildingTie.single);
						else me=me.dname+' : '+loc(choose(["You don't know what you have until you've lost it.","Remember to take breaks.","Hey, what's up. I'm a fortune cookie.","You think you have it bad? Look at me."]));
					}
					me='<span class="fortune"><div class="icon" style="vertical-align:middle;display:inline-block;background-position:'+(-29*48)+'px '+(-8*48)+'px;transform:scale(0.5);margin:-16px;position:relative;left:-4px;top:-2px;"></div>'+me+'</span>';
					list=[me];
				}
			}
			
			if (Game.windowW<Game.tickerTooNarrow) list=['<div style="transform:scale(0.8,1.2);">'+NEWS+(EN?'help!':loc("help me!"))+'</div>'];
			
			Game.TickerAge=Game.fps*10;
			Game.Ticker=choose(list);
			Game.AddToLog(Game.Ticker);
			Game.TickerN++;
			Game.TickerDraw();
		}
		Game.tickerL=l('commentsText1');
		Game.tickerBelowL=l('commentsText2');
		Game.tickerTooNarrow=900;
		Game.TickerDraw=function()
		{
			var str='';
			if (Game.Ticker!='') str=Game.Ticker;
			Game.tickerBelowL.innerHTML=Game.tickerL.innerHTML;
			Game.tickerL.innerHTML=str;
			
			Game.tickerBelowL.className='commentsText';
			void Game.tickerBelowL.offsetWidth;
			Game.tickerBelowL.className='commentsText risingAway';
			Game.tickerL.className='commentsText';
			void Game.tickerL.offsetWidth;
			Game.tickerL.className='commentsText risingUp';
		}
		AddEvent(Game.tickerL,'click',function(event){
			Game.Ticker='';
			Game.TickerClicks++;
			if (Game.windowW<Game.tickerTooNarrow) {Game.Win('Stifling the press');}
			else if (Game.TickerClicks>=50) {Game.Win('Tabloid addiction');}
			
			if (Game.TickerEffect && Game.TickerEffect.type=='fortune')
			{
				PlaySound('snd/fortune.mp3',1);
				Game.SparkleAt(Game.mouseX,Game.mouseY);
				var effect=Game.TickerEffect.sub;
				if (effect=='fortuneGC')
				{
					Game.Notify(loc("Fortune!"),loc("A golden cookie has appeared."),[10,32]);
					Game.fortuneGC=1;
					var newShimmer=new Game.shimmer('golden',{noWrath:true});
				}
				else if (effect=='fortuneCPS')
				{
					Game.Notify(loc("Fortune!"),loc("You gain <b>one hour</b> of your CpS (capped at double your bank)."),[10,32]);
					Game.fortuneCPS=1;
					Game.Earn(Math.min(Game.cookiesPs*60*60,Game.cookies));
				}
				else
				{
					Game.Notify(effect.dname,loc("You've unlocked a new upgrade."),effect.icon);
					effect.unlock();
				}
			}
			
			Game.TickerEffect=0;
			
		});
		
		Game.Log=[];
		Game.AddToLog=function(what)
		{
			Game.Log.unshift(what);
			if (Game.Log.length>100) Game.Log.pop();
		}
		
		Game.vanilla=1;
		/*=====================================================================================
		BUILDINGS
		=======================================================================================*/
		Game.last=0;
		
		Game.storeToRefresh=1;
		Game.priceIncrease=1.15;
		Game.buyBulk=1;
		Game.buyMode=1;//1 for buy, -1 for sell
		Game.buyBulkOld=Game.buyBulk;//used to undo changes from holding Shift or Ctrl
		Game.buyBulkShortcut=0;//are we pressing Shift or Ctrl?
		
		Game.Objects={};
		Game.ObjectsById=[];
		Game.ObjectsN=0;
		Game.BuildingsOwned=0;
		Game.Object=Building;//CC3 rewrite (phase 3, slice 2): the 737-line ctor moved to core/building.ts as the real Building class; the engine keeps the same Game.Object slot, same call sites, same self-registration.
		
		Game.DrawBuildings=function()//draw building displays with canvas
		{
			if (Game.drawT%3==0)
			{
				for (var i in Game.Objects)
				{
					var me=Game.Objects[i];
					if (me.id>0 && !me.onMinigame && !me.muted) me.draw();
					else me.pics=[];
				}
			}
		}
		
		Game.sortSprites=function(a,b)
		{
			if (a.z>b.z) return 1;
			else if (a.z<b.z) return -1;
			else return 0;
		}
		Game.sortSpritesById=function(a,b)
		{
			if (a.id>b.id) return 1;
			else if (a.id<b.id) return -1;
			else return 0;
		}
		
		Game.modifyBuildingPrice=function(building,price)
		{
			if (Game.Has('Season savings')) price*=0.99;
			if (Game.Has('Santa\'s dominion')) price*=0.99;
			if (Game.Has('Faberge egg')) price*=0.99;
			if (Game.Has('Divine discount')) price*=0.99;
			if (Game.Has('Fortune #100')) price*=0.99;
			//if (Game.hasAura('Fierce Hoarder')) price*=0.98;
			price*=1-Game.auraMult('Fierce Hoarder')*0.02;
			if (Game.hasBuff('Everything must go')) price*=0.95;
			if (Game.hasBuff('Crafty pixies')) price*=0.98;
			if (Game.hasBuff('Nasty goblins')) price*=1.02;
			if (building.fortune && Game.Has(building.fortune.name)) price*=0.93;
			price*=Game.eff('buildingCost');
			if (Game.hasGod)
			{
				var godLvl=Game.hasGod('creation');
				if (godLvl==1) price*=0.93;
				else if (godLvl==2) price*=0.95;
				else if (godLvl==3) price*=0.98;
			}
			return price;
		}
		
		Game.storeBulkButton=function(id)
		{
			if (id==0) Game.buyMode=1;
			else if (id==1) Game.buyMode=-1;
			else if (id==2) Game.buyBulk=1;
			else if (id==3) Game.buyBulk=10;
			else if (id==4) Game.buyBulk=100;
			else if (id==5) Game.buyBulk=-1;
			
			if (Game.buyMode==1 && Game.buyBulk==-1) Game.buyBulk=100;
			
			if (Game.buyMode==1) l('storeBulkBuy').className='storePreButton storeBulkMode selected'; else l('storeBulkBuy').className='storePreButton storeBulkMode';
			if (Game.buyMode==-1) l('storeBulkSell').className='storePreButton storeBulkMode selected'; else l('storeBulkSell').className='storePreButton storeBulkMode';
			
			if (Game.buyBulk==1) l('storeBulk1').className='storePreButton storeBulkAmount selected'; else l('storeBulk1').className='storePreButton storeBulkAmount';
			if (Game.buyBulk==10) l('storeBulk10').className='storePreButton storeBulkAmount selected'; else l('storeBulk10').className='storePreButton storeBulkAmount';
			if (Game.buyBulk==100) l('storeBulk100').className='storePreButton storeBulkAmount selected'; else l('storeBulk100').className='storePreButton storeBulkAmount';
			if (Game.buyBulk==-1) l('storeBulkMax').className='storePreButton storeBulkAmount selected'; else l('storeBulkMax').className='storePreButton storeBulkAmount';
			
			if (Game.buyMode==1)
			{
				l('storeBulkMax').style.visibility='hidden';
				l('products').className='storeSection';
			}
			else
			{
				l('storeBulkMax').style.visibility='visible';
				l('products').className='storeSection selling';
			}
			
			Game.storeToRefresh=1;
			if (id!=-1) PlaySound('snd/tick.mp3');
		}
		Game.BuildStore=function()//create the DOM for the store's buildings
		{
			//if (typeof showAds!=='undefined') l('store').scrollTop=100;
			
			var str='';
			str+='<div id="storeBulk" class="storePre" '+Game.getTooltip(
							'<div style="padding:8px;min-width:200px;text-align:center;font-size:11px;" id="tooltipStoreBulk">'+loc("You can also press %1 to bulk-buy or sell %2 of a building at a time, or %3 for %4.",['<b>'+loc("Ctrl")+'</b>','<b>10</b>','<b>'+loc("Shift")+'</b>','<b>100</b>'])+'</div>'
							,'store')+
				'>'+
				'<div id="storeBulkBuy" class="storePreButton storeBulkMode" '+Game.clickStr+'="Game.storeBulkButton(0);">'+loc("Buy")+'</div>'+
				'<div id="storeBulkSell" class="storePreButton storeBulkMode" '+Game.clickStr+'="Game.storeBulkButton(1);">'+loc("Sell")+'</div>'+
				'<div id="storeBulk1" class="storePreButton storeBulkAmount" '+Game.clickStr+'="Game.storeBulkButton(2);">1</div>'+
				'<div id="storeBulk10" class="storePreButton storeBulkAmount" '+Game.clickStr+'="Game.storeBulkButton(3);">10</div>'+
				'<div id="storeBulk100" class="storePreButton storeBulkAmount" '+Game.clickStr+'="Game.storeBulkButton(4);">100</div>'+
				'<div id="storeBulkMax" class="storePreButton storeBulkAmount" '+Game.clickStr+'="Game.storeBulkButton(5);">'+loc("all")+'</div>'+
				'</div>';
			for (var i in Game.Objects)
			{
				var me=Game.Objects[i];
				str+=(Game.prefs.screenreader?'<button aria-labelledby="ariaReader-product-'+(me.id)+'"':'<div')+' class="product toggledOff" '+Game.getDynamicTooltip('Game.ObjectsById['+me.id+'].tooltip','store')+' id="product'+me.id+'"><div class="icon off" id="productIconOff'+me.id+'" style=""></div><div class="icon" id="productIcon'+me.id+'" style=""></div><div class="content"><div class="lockedTitle">???</div><div class="title productName" id="productName'+me.id+'"></div><span class="priceMult" id="productPriceMult'+me.id+'"></span><span class="price" id="productPrice'+me.id+'"></span><div class="title owned" id="productOwned'+me.id+'"></div>'+(Game.prefs.screenreader?'<label class="srOnly" style="width:64px;left:-64px;" id="ariaReader-product-'+(me.id)+'"></label>':'')+'</div>'+
				/*'<div class="buySell"><div style="left:0px;" id="buttonBuy10-'+me.id+'">Buy 10</div><div style="left:100px;" id="buttonSell-'+me.id+'">Sell 1</div><div style="left:200px;" id="buttonSellAll-'+me.id+'">Sell all</div></div>'+*/
				(Game.prefs.screenreader?'</button>':'</div>');
			}
			l('products').innerHTML=str;
			
			Game.storeBulkButton(-1);
			
			/*var SellAllPrompt=function(id)
			{
				return function(id){Game.Prompt('<div class="block">Do you really want to sell your '+loc("%1 "+Game.ObjectsById[id].bsingle,LBeautify(Game.ObjectsById[id].amount))+'?</div>',[['Yes','Game.ObjectsById['+id+'].sell(-1);Game.ClosePrompt();'],['No','Game.ClosePrompt();']]);}(id);
			}*/
			
			for (var i in Game.Objects)
			{
				var me=Game.Objects[i];
				me.l=l('product'+me.id);
				
				//these are a bit messy but ah well
				if (!Game.touchEvents)
				{
					AddEvent(me.l,'click',function(what){return function(e){Game.ClickProduct(what);e.preventDefault();};}(me.id));
				}
				else
				{
					AddEvent(me.l,'touchend',function(what){return function(e){Game.ClickProduct(what);e.preventDefault();};}(me.id));
				}
			}
		}
		
		Game.ClickProduct=function(what)
		{
			Game.ObjectsById[what].buy();
		}
		
		Game.RefreshStore=function()//refresh the store's buildings
		{
			for (var i in Game.Objects)
			{
				Game.Objects[i].refresh();
			}
			Game.storeToRefresh=0;
		}
		
		Game.ComputeCps=function(base,mult,bonus)
		{
			if (!bonus) bonus=0;
			return ((base)*(Math.pow(2,mult))+bonus);
		}
		
		Game.isMinigameReady=function(me)
		{return (me.minigameUrl && me.minigameLoaded && me.level>0);}
		Game.scriptBindings=[];
		Game.showedScriptLoadError=false;
		Game.LoadMinigames=function()//load scripts for each minigame
		{
			for (var i in Game.Objects)
			{
				const me=Game.Objects[i];
				if (me.minigameUrl && me.level>0 && !me.minigameLoaded && !me.minigameLoading && !l('minigameScript-'+me.id))
				{
					me.minigameLoading=true;
					//we're only loading the minigame scripts that aren't loaded yet and which have enough building level
					//we call this function on building level up and on load
					//console.log('Loading script '+me.minigameUrl+'...');
					// CC3: minigame scripts are ES modules resolved by the entry point
window.loadMinigameModule(me.minigameUrl).then(function(){
						if (!me.minigameLoaded) Game.scriptLoaded(me);
					},function(){
						me.minigameLoading=false;
						if (!me.minigameLoaded && !Game.showedScriptLoadError)
						{
							Game.showedScriptLoadError=true;
							Game.Notify(loc("Error!"),'Couldn\'t load minigames. Try reloading.');
						}
					});
				}
			}
		}
		Game.scriptLoaded=function(who,script)
		{
			who.minigameLoading=false;
			who.minigameLoaded=true;
			who.refresh();
			who.minigame.launch();
			if (who.minigameSave) {who.minigame.reset(true);who.minigame.load(who.minigameSave);who.minigameSave=0;}
		}
		
		Game.magicCpS=function(what)
		{
			/*
			if (Game.Objects[what].amount>=250)
			{
				//this makes buildings give 1% more cookies for every building over 250.
				//this turns out to be rather stupidly overpowered.
				var n=Game.Objects[what].amount-250;
				return 1+Math.pow(1.01,n);
			}
			else return 1;
			*/
			return 1;
		}
		
		// CC3 rewrite: the 19 vanilla building declarations now live in the
		// typed content layer (content/buildings.ts) — same new Game.Object
		// calls, same order, same closures; only the file moved.
		declareVanillaBuildings(Game);
		
		// CC3 rewrite: the foolObjects joke-business map + its localization
		// loop now live in the typed content layer (content/foolObjects.ts)
		// same data, same loop, same position after the building block.
		declareVanillaFoolObjects(Game);
		
		//build store
		Game.BuildStore();
		
		//build master bar
		var str='';
		str+='<div id="buildingsMute" class="shadowFilter" style="position:relative;z-index:100;padding:4px 16px 0px 64px;"></div>';
		str+='<div class="separatorBottom" style="position:absolute;bottom:-8px;z-index:0;"></div>';
		l('buildingsMaster').innerHTML=str;
		
		//build object displays
		var muteStr='<div style="position:absolute;left:8px;bottom:12px;opacity:0.5;">'+loc("Muted:")+'</div>';
		for (var i in Game.Objects)
		{
			var me=Game.Objects[i];
			
			if (locStrings[me.name+' (short)']) me.displayName=loc(me.name+' (short)');
			
			if (me.id>0)
			{
				me.canvas=l('rowCanvas'+me.id);
				me.ctx=me.canvas.getContext('2d',{alpha:false});
				me.pics=[];
				var icon=[0*64,me.icon*64];
				muteStr+='<div class="tinyProductIcon" id="mutedProduct'+me.id+'" style="display:none;background-position:-'+icon[0]+'px -'+icon[1]+'px;" '+Game.clickStr+'="Game.ObjectsById['+me.id+'].mute(0);PlaySound(Game.ObjectsById['+me.id+'].muted?\'snd/clickOff2.mp3\':\'snd/clickOn2.mp3\');" '+Game.getDynamicTooltip('Game.mutedBuildingTooltip('+me.id+')','this')+'></div>';
				//muteStr+='<div class="tinyProductIcon" id="mutedProduct'+me.id+'" style="display:none;background-position:-'+icon[0]+'px -'+icon[1]+'px;" '+Game.clickStr+'="Game.ObjectsById['+me.id+'].mute(0);PlaySound(Game.ObjectsById['+me.id+'].muted?\'snd/clickOff2.mp3\':\'snd/clickOn2.mp3\');" '+Game.getTooltip('<div style="width:150px;text-align:center;font-size:11px;"><b>Unmute '+me.plural+'</b><br>(Display this building)</div>')+'></div>';
				
				AddEvent(me.canvas,'mouseover',function(me){return function(){me.mouseOn=true;}}(me));
				AddEvent(me.canvas,'mouseout',function(me){return function(){me.mouseOn=false;}}(me));
				AddEvent(me.canvas,'mousemove',function(me){return function(e){var box=this.getBounds();me.mousePos[0]=e.pageX-box.left;me.mousePos[1]=e.pageY-box.top;}}(me));
			}
		}
		Game.mutedBuildingTooltip=function(id)
		{
			return function(){
				var me=Game.ObjectsById[id];
				return '<div style="width:150px;text-align:center;font-size:11px;" id="tooltipMutedBuilding">'+(EN?('<b>'+cap(me.plural)+(me.level>0?' (lvl.&nbsp;'+me.level+')':'')+'</b><div class="line"></div>Click to unmute '+me.plural+'<br>(display this building)'):('<b>'+loc("Level %1 %2",[Beautify(me.level),me.plural])+'</b><div class="line"></div>'+loc("Click to unmute")))+'</div>';
			}
		}
		l('buildingsMute').innerHTML=muteStr;
		
		/*=====================================================================================
		UPGRADES
		=======================================================================================*/
		Game.upgradesToRebuild=1;
		Game.Upgrades={};
		Game.UpgradesById={};
		Game.UpgradesN=0;
		Game.UpgradesInStore=[];
		Game.UpgradesOwned=0;
		Game.Upgrade=function(name,desc,price,icon,buyFunction)
		{
			this.id=Game.UpgradesN;
			this.name=name;
			this.dname=this.name;
			this.desc=desc;
			this.baseDesc=this.desc;
			this.basePrice=price;
			this.priceLumps=0;//note : doesn't do much on its own, you still need to handle the buying yourself
			this.icon=icon;
			this.iconFunction=0;
			this.buyFunction=buyFunction;
			/*this.unlockFunction=unlockFunction;
			this.unlocked=(this.unlockFunction?0:1);*/
			this.unlocked=0;
			this.bought=0;
			this.order=this.id;
			if (order) this.order=order+this.id*0.001;
			this.pool='';//can be '', cookie, toggle, debug, prestige, prestigeDecor, tech, or unused
			if (pool) this.pool=pool;
			this.power=0;
			if (power) this.power=power;
			this.vanilla=Game.vanilla;
			this.unlockAt=0;
			this.techUnlock=[];
			this.parents=[];
			this.type='upgrade';
			this.tier=0;
			this.buildingTie=0;//of what building is this a tiered upgrade of ?
			
			Game.last=this;
			Game.Upgrades[this.name]=this;
			Game.UpgradesById[this.id]=this;
			Game.UpgradesN++;
			return this;
		}
		Game.Upgrade.prototype.getType=function(){return 'Upgrade';}
		
		Game.Upgrade.prototype.getPrice=function()
		{
			var price=this.basePrice;
			if (this.priceFunc) price=this.priceFunc(this);
			if (price==0) return 0;
			if (this.pool!='prestige')
			{
				if (Game.Has('Toy workshop')) price*=0.95;
				if (Game.Has('Five-finger discount')) price*=Math.pow(0.99,Game.Objects['Cursor'].amount/100);
				if (Game.Has('Santa\'s dominion')) price*=0.98;
				if (Game.Has('Faberge egg')) price*=0.99;
				if (Game.Has('Divine sales')) price*=0.99;
				if (Game.Has('Fortune #100')) price*=0.99;
				if (this.kitten && Game.Has('Kitten wages')) price*=0.9;
				if (Game.hasBuff('Haggler\'s luck')) price*=0.98;
				if (Game.hasBuff('Haggler\'s misery')) price*=1.02;
				//if (Game.hasAura('Master of the Armory')) price*=0.98;
				price*=1-Game.auraMult('Master of the Armory')*0.02;
				price*=Game.eff('upgradeCost');
				if (this.pool=='cookie' && Game.Has('Divine bakeries')) price/=5;
			}
			return Math.ceil(price);
		}
		
		Game.Upgrade.prototype.canBuy=function()
		{
			if (this.canBuyFunc) return this.canBuyFunc();
			if (Game.cookies>=this.getPrice()) return true; else return false;
		}
		
		Game.storeBuyAll=function()
		{
			if (!Game.Has('Inspired checklist')) return false;
			for (var i in Game.UpgradesInStore)
			{
				var me=Game.UpgradesInStore[i];
				if (!me.isVaulted() && me.pool!='toggle' && me.pool!='tech') me.buy(1);
			}
		}
		
		Game.vault=[];
		Game.Upgrade.prototype.isVaulted=function()
		{
			if (Game.vault.indexOf(this.id)!=-1) return true; else return false;
		}
		Game.Upgrade.prototype.vault=function()
		{
			if (!this.isVaulted()) Game.vault.push(this.id);
		}
		Game.Upgrade.prototype.unvault=function()
		{
			if (this.isVaulted()) Game.vault.splice(Game.vault.indexOf(this.id),1);
		}
		
		Game.Upgrade.prototype.click=function(e)
		{
			if ((e && e.shiftKey) || Game.keys[16])
			{
				if (this.pool=='toggle' || this.pool=='tech') {}
				else if (Game.Has('Inspired checklist'))
				{
					if (this.isVaulted()) this.unvault();
					else this.vault();
					Game.upgradesToRebuild=1;
					PlaySound('snd/tick.mp3');
				}
			}
			else this.buy();
		}
		
		
		Game.Upgrade.prototype.buy=function(bypass)
		{
			var success=0;
			var cancelPurchase=0;
			if (this.clickFunction && !bypass) cancelPurchase=!this.clickFunction();
			if (!cancelPurchase)
			{
				if (this.choicesFunction)
				{
					if (Game.choiceSelectorOn==this.id)
					{
						l('toggleBox').style.display='none';
						l('toggleBox').innerHTML='';
						Game.choiceSelectorOn=-1;
						PlaySound('snd/tickOff.mp3');
					}
					else
					{
						Game.choiceSelectorOn=this.id;
						var choices=this.choicesFunction();
						var str='';
						str+='<div class="close" onclick="Game.UpgradesById['+this.id+'].buy();">x</div>';
						str+='<h3>'+this.dname+'</h3>'+
						'<div class="line"></div>';
						if (typeof choices==='string')
						{
							str+=choices;
						}
						else if (choices.length>0)
						{
							var selected=0;
							for (var i in choices) {if (choices[i].selected) selected=i;}
							Game.choiceSelectorChoices=choices;//this is a really dumb way of doing this i am so sorry
							Game.choiceSelectorSelected=selected;
							str+='<h4 id="choiceSelectedName">'+choices[selected].name+'</h4>'+
							'<div class="line"></div>';
							
							for (var i in choices)
							{
								choices[i].id=i;
								choices[i].order=choices[i].order||0;
							}
							
							var sortMap=function(a,b)
							{
								if (a.order>b.order) return 1;
								else if (a.order<b.order) return -1;
								else return 0;
							}
							choices.sort(sortMap);
							
							for (var i=0;i<choices.length;i++)
							{
								if (!choices[i]) continue;
								var icon=choices[i].icon;
								var id=choices[i].id;
								if (choices[i].div) str+='<div class="line"></div>';
								str+='<div class="crate noFrame enabled'+(id==selected?' highlighted':'')+'" style="opacity:1;float:none;display:inline-block;'+writeIcon(icon)+'" '+Game.clickStr+'="Game.UpgradesById['+this.id+'].choicesPick('+id+');Game.choiceSelectorOn=-1;Game.UpgradesById['+this.id+'].buy();" onMouseOut="l(\'choiceSelectedName\').innerHTML=Game.choiceSelectorChoices[Game.choiceSelectorSelected].name;" onMouseOver="l(\'choiceSelectedName\').innerHTML=Game.choiceSelectorChoices['+i+'].name;"'+
								'></div>';
							}
						}
						l('toggleBox').innerHTML=str;
						l('toggleBox').style.display='block';
						l('toggleBox').focus();
						Game.tooltip.hide();
						PlaySound('snd/tick.mp3');
						success=1;
					}
				}
				else if (this.pool!='prestige')
				{
					var price=this.getPrice();
					if (this.canBuy() && !this.bought)
					{
						Game.Spend(price);
						this.bought=1;
						if (this.buyFunction) this.buyFunction();
						if (this.toggleInto)
						{
							Game.Lock(this.toggleInto);
							Game.Unlock(this.toggleInto);
						}
						Game.upgradesToRebuild=1;
						Game.recalculateGains=1;
						if (Game.CountsAsUpgradeOwned(this.pool)) Game.UpgradesOwned++;
						Game.setOnCrate(0);
						Game.tooltip.hide();
						PlaySound('snd/buy'+choose([1,2,3,4])+'.mp3',0.75);
						success=1;
					}
				}
				else
				{
					var price=this.getPrice();
					if (Game.heavenlyChips>=price && !this.bought)
					{
						Game.heavenlyChips-=price;
						Game.heavenlyChipsSpent+=price;
						this.unlocked=1;
						this.bought=1;
						if (this.buyFunction) this.buyFunction();
						Game.BuildAscendTree(this);
						PlaySound('snd/buy'+choose([1,2,3,4])+'.mp3',0.75);
						PlaySound('snd/shimmerClick.mp3');
						//PlaySound('snd/buyHeavenly.mp3');
						success=1;
					}
				}
			}
			if (this.bought && this.activateFunction) this.activateFunction();
			return success;
		}
		Game.Upgrade.prototype.earn=function()//just win the upgrades without spending anything
		{
			this.unlocked=1;
			this.bought=1;
			if (this.buyFunction) this.buyFunction();
			Game.upgradesToRebuild=1;
			Game.recalculateGains=1;
			if (Game.CountsAsUpgradeOwned(this.pool)) Game.UpgradesOwned++;
		}
		Game.Upgrade.prototype.unearn=function()//remove the upgrade, but keep it unlocked
		{
			this.bought=0;
			Game.upgradesToRebuild=1;
			Game.recalculateGains=1;
			if (Game.CountsAsUpgradeOwned(this.pool)) Game.UpgradesOwned--;
		}
		Game.Upgrade.prototype.unlock=function()
		{
			this.unlocked=1;
			Game.upgradesToRebuild=1;
		}
		Game.Upgrade.prototype.lose=function()
		{
			this.unlocked=0;
			this.bought=0;
			Game.upgradesToRebuild=1;
			Game.recalculateGains=1;
			if (Game.CountsAsUpgradeOwned(this.pool)) Game.UpgradesOwned--;
		}
		Game.Upgrade.prototype.toggle=function()//cheating only
		{
			if (!this.bought)
			{
				this.bought=1;
				if (this.buyFunction) this.buyFunction();
				Game.upgradesToRebuild=1;
				Game.recalculateGains=1;
				if (Game.CountsAsUpgradeOwned(this.pool)) Game.UpgradesOwned++;
				PlaySound('snd/buy'+choose([1,2,3,4])+'.mp3',0.75);
				if (this.pool=='prestige' || this.pool=='debug') PlaySound('snd/shimmerClick.mp3');
			}
			else
			{
				this.bought=0;
				Game.upgradesToRebuild=1;
				Game.recalculateGains=1;
				if (Game.CountsAsUpgradeOwned(this.pool)) Game.UpgradesOwned--;
				PlaySound('snd/sell'+choose([1,2,3,4])+'.mp3',0.75);
				if (this.pool=='prestige' || this.pool=='debug') PlaySound('snd/shimmerClick.mp3');
			}
			if (Game.onMenu=='stats') Game.UpdateMenu();
		}
		
		Game.CountsAsUpgradeOwned=function(pool)
		{
			if (pool=='' || pool=='cookie' || pool=='tech') return true; else return false;
		}
		
		/*AddEvent(l('toggleBox'),'blur',function()//if we click outside of the selector, close it
			{
				//this has a couple problems, such as when clicking on the upgrade - this toggles it off and back on instantly
				l('toggleBox').style.display='none';
				l('toggleBox').innerHTML='';
				Game.choiceSelectorOn=-1;
			}
		);*/
		
		Game.RequiresConfirmation=function(upgrade,prompt)
		{
			upgrade.clickFunction=function(){Game.Prompt('<id RequiresConfirmation>'+prompt,[[loc("Yes"),'Game.UpgradesById['+upgrade.id+'].buy(1);Game.ClosePrompt();'],loc("No")]);return false;};
		}
		
		Game.Unlock=function(what)
		{
			if (typeof what==='string')
			{
				if (Game.Upgrades[what])
				{
					if (Game.Upgrades[what].unlocked==0)
					{
						Game.Upgrades[what].unlocked=1;
						Game.upgradesToRebuild=1;
						Game.recalculateGains=1;
						/*Game.Notify('Upgrade unlocked','<div class="title" style="font-size:18px;margin-top:-2px;">'+Game.Upgrades[what].dname+'</div>',Game.Upgrades[what].icon,6);*/
					}
				}
			}
			else {for (var i in what) {Game.Unlock(what[i]);}}
		}
		Game.Lock=function(what)
		{
			if (typeof what==='string')
			{
				if (Game.Upgrades[what])
				{
					Game.Upgrades[what].unlocked=0;
					Game.upgradesToRebuild=1;
					if (Game.Upgrades[what].bought==1 && Game.CountsAsUpgradeOwned(Game.Upgrades[what].pool)) Game.UpgradesOwned--;
					Game.Upgrades[what].bought=0;
					Game.recalculateGains=1;
				}
			}
			else {for (var i in what) {Game.Lock(what[i]);}}
		}
		
		Game.Has=function(what)
		{
			var it=Game.Upgrades[what];
			if (it && Game.ascensionMode==1 && (it.pool=='prestige' || it.tier=='fortune')) return 0;
			return (it?it.bought:0);
		}
		Game.HasUnlocked=function(what)
		{
			return (Game.Upgrades[what]?Game.Upgrades[what].unlocked:0);
		}
		
		
		Game.RebuildUpgrades=function()//recalculate the upgrades you can buy
		{
			Game.upgradesToRebuild=0;
			var list=[];
			for (var i in Game.Upgrades)
			{
				var me=Game.Upgrades[i];
				if (!me.bought && me.pool!='debug' && me.pool!='prestige' && me.pool!='prestigeDecor' && (Game.ascensionMode!=1 || (!me.lasting && me.tier!='fortune')))
				{
					if (me.unlocked) list.push(me);
				}
				else if (me.displayFuncWhenOwned && me.bought) list.push(me);
			}
			var sortMap=function(a,b)
			{
				var ap=a.pool=='toggle'?a.order:a.getPrice();
				var bp=b.pool=='toggle'?b.order:b.getPrice();
				if (ap>bp) return 1;
				else if (ap<bp) return -1;
				else return 0;
			}
			list.sort(sortMap);
			
			Game.UpgradesInStore=[];
			for (var i in list)
			{
				Game.UpgradesInStore.push(list[i]);
			}
			var storeStr='';
			var toggleStr='';
			var techStr='';
			var vaultStr='';
			
			if (Game.Has('Inspired checklist'))
			{
				storeStr+='<div id="storeBuyAll" class="storePre" '+Game.getTooltip(
								'<div style="padding:8px;min-width:250px;text-align:center;font-size:11px;" id="tooltipStorePre">'+loc("Will <b>instantly purchase</b> every upgrade you can afford, starting from the cheapest one.<br>Upgrades in the <b>vault</b> will not be auto-purchased.<br>You may place an upgrade into the vault by <b>Shift-clicking</b> on it.")+'</div>'
								,'store')+
					'>'+
						'<div id="storeBuyAllButton" class="storePreButton" '+Game.clickStr+'="Game.storeBuyAll();">'+loc("Buy all upgrades")+'</div>'+
					'</div>';
				l('upgrades').classList.add('hasMenu');
			}
			else l('upgrades').classList.remove('hasMenu');
			
			for (var i in Game.UpgradesInStore)
			{
				//if (!Game.UpgradesInStore[i]) break;
				var me=Game.UpgradesInStore[i];
				var str=Game.crate(me,'store','Game.UpgradesById['+me.id+'].click(event);','upgrade'+i);
				
				/*var str='<div class="crate upgrade" '+Game.getTooltip(
				'<div style="min-width:200px;"><div style="float:right;"><span class="price">'+Beautify(Math.round(me.getPrice()))+'</span></div><small>'+(me.pool=='toggle'?'[Togglable]':'[Upgrade]')+'</small><div class="name">'+me.dname+'</div><div class="line"></div><div class="description">'+me.desc+'</div></div>'
				,'store')+' '+Game.clickStr+'="Game.UpgradesById['+me.id+'].buy();" id="upgrade'+i+'" style="'+writeIcon(me.icon)+'"></div>';*/
				if (me.pool=='toggle') toggleStr+=str; else if (me.pool=='tech') techStr+=str; else
				{
					if (me.isVaulted() && Game.Has('Inspired checklist')) vaultStr+=str; else storeStr+=str;
				}
			}
			
			l('upgrades').innerHTML=storeStr;
			l('toggleUpgrades').innerHTML=toggleStr;
			if (toggleStr=='') l('toggleUpgrades').style.display='none'; else l('toggleUpgrades').style.display='block';
			l('techUpgrades').innerHTML=techStr;
			if (techStr=='') l('techUpgrades').style.display='none'; else l('techUpgrades').style.display='block';
			l('vaultUpgrades').innerHTML=vaultStr;
			if (vaultStr=='') l('vaultUpgrades').style.display='none'; else l('vaultUpgrades').style.display='block';
		}
		
		Game.UnlockAt=[];//this contains an array of every upgrade with a cookie requirement in the form of {cookies:(amount of cookies earned required),name:(name of upgrade or achievement to unlock)} (and possibly require:(name of upgrade of achievement to own))
		//note : the cookie will not be added to the list if it contains locked:1 (use for seasonal cookies and such)
		
		
		//tiered upgrades system
		//each building has several upgrade tiers
		//all upgrades in the same tier have the same color, unlock threshold and price multiplier
		// CC3 rewrite: the tier table now lives in the typed content layer
		// (content/tiers.ts). Game.Init runs exactly once (Loader.doneLoading
		// guard), so the module singleton's lifetime matches the original
		// once-created literal; the .upgrades append below mutates it as before.
		Game.Tiers=TIERS;
		for (var i in Game.Tiers){Game.Tiers[i].upgrades=[];}
		Game.GetIcon=function(type,tier)
		{
			var col=0;
			if (type=='Kitten') col=18; else col=Game.Objects[type].iconColumn;
			return [col,Game.Tiers[tier].iconRow];
		}
		Game.SetTier=function(building,tier)
		{
			if (!Game.Objects[building]) console.log('Warning: No building named',building);
			Game.last.tier=tier;
			Game.last.buildingTie=Game.Objects[building];
			if (Game.last.type=='achievement') Game.Objects[building].tieredAchievs[tier]=Game.last;
			else Game.Objects[building].tieredUpgrades[tier]=Game.last;
		}
		Game.MakeTiered=function(upgrade,tier,col)
		{
			upgrade.tier=tier;
			if (typeof col!=='undefined') upgrade.icon=[col,Game.Tiers[tier].iconRow];
		}
		Game.TieredUpgrade=function(name,desc,building,tier)
		{
			if (tier=='fortune' && building) desc=loc("%1 are <b>%2%</b> more efficient and <b>%3%</b> cheaper.",[cap(Game.Objects[building].plural),7,7])+desc;
			else desc=loc("%1 are <b>twice</b> as efficient.",cap(Game.Objects[building].plural))+desc;
			var upgrade=new Game.Upgrade(name,desc,Game.Objects[building].basePrice*Game.Tiers[tier].price,Game.GetIcon(building,tier));
			if (tier!='fortune')
			{
				upgrade.descFunc=function(){
					return ((Game.ascensionMode!=1 && Game.Has(this.buildingTie1.unshackleUpgrade) && Game.Has(Game.Tiers[this.tier].unshackleUpgrade))?('<div style="text-align:center;">'+loc("Unshackled! <b>+%1%</b> extra production.",Math.round((this.buildingTie.id==1?0.5:(20-this.buildingTie.id)*0.1)*100))+'</div><div class="line"></div>'):'')+this.ddesc;
				};
			}
			
			Game.SetTier(building,tier);
			if (!upgrade.buildingTie1 && building) upgrade.buildingTie1=Game.Objects[building];
			if (tier=='fortune' && building) Game.Objects[building].fortune=upgrade;
			return upgrade;
		}
		Game.SynergyUpgrade=function(name,desc,building1,building2,tier)
		{
			/*
				creates a new upgrade that :
				-unlocks when you have tier.unlock of building1 and building2
				-is priced at (building1.price*10+building2.price*1)*tier.price (formerly : Math.sqrt(building1.price*building2.price)*tier.price)
				-gives +(0.1*building1)% cps to building2 and +(5*building2)% cps to building1
				-if building2 is below building1 in worth, swap them
			*/
			//if (Game.Objects[building1].basePrice>Game.Objects[building2].basePrice) {var temp=building2;building2=building1;building1=temp;}
			var b1=Game.Objects[building1];
			var b2=Game.Objects[building2];
			if (b1.basePrice>b2.basePrice) {b1=Game.Objects[building2];b2=Game.Objects[building1];}//swap
			
			desc=
				loc("%1 gain <b>+%2%</b> CpS per %3.",[cap(b1.plural),5,b2.single])+'<br>'+
				loc("%1 gain <b>+%2%</b> CpS per %3.",[cap(b2.plural),0.1,b1.single])+
				(EN?desc:'');
			var upgrade=new Game.Upgrade(name,desc,(b1.basePrice*10+b2.basePrice*1)*Game.Tiers[tier].price,Game.GetIcon(building1,tier));//Math.sqrt(b1.basePrice*b2.basePrice)*Game.Tiers[tier].price
			upgrade.tier=tier;
			upgrade.buildingTie1=b1;
			upgrade.buildingTie2=b2;
			upgrade.priceFunc=function(){return (this.buildingTie1.basePrice*10+this.buildingTie2.basePrice*1)*Game.Tiers[this.tier].price*(Game.Has('Chimera')?0.98:1);};
			Game.Objects[building1].synergies.push(upgrade);
			Game.Objects[building2].synergies.push(upgrade);
			//Game.SetTier(building1,tier);
			return upgrade;
		}
		Game.GetTieredCpsMult=function(me)
		{
			var mult=1;
			for (var i in me.tieredUpgrades)
			{
				if (!Game.Tiers[me.tieredUpgrades[i].tier].special && Game.Has(me.tieredUpgrades[i].name))
				{
					var tierMult=2;
					//unshackled
					if (Game.ascensionMode!=1 && Game.Has(me.unshackleUpgrade) && Game.Has(Game.Tiers[me.tieredUpgrades[i].tier].unshackleUpgrade)) tierMult+=me.id==1?0.5:(20-me.id)*0.1;
					mult*=tierMult;
				}
			}
			for (var i in me.synergies)
			{
				var syn=me.synergies[i];
				if (Game.Has(syn.name))
				{
					if (syn.buildingTie1.name==me.name) mult*=(1+0.05*syn.buildingTie2.amount);
					else if (syn.buildingTie2.name==me.name) mult*=(1+0.001*syn.buildingTie1.amount);
				}
			}
			if (me.fortune && Game.Has(me.fortune.name)) mult*=1.07;
			if (me.grandma && Game.Has(me.grandma.name)) mult*=(1+Game.Objects['Grandma'].amount*0.01*(1/(me.id-1)));
			return mult;
		}
		Game.UnlockTiered=function(me)
		{
			for (var i in me.tieredUpgrades) {if (Game.Tiers[me.tieredUpgrades[i].tier].unlock!=-1 && me.amount>=Game.Tiers[me.tieredUpgrades[i].tier].unlock) Game.Unlock(me.tieredUpgrades[i].name);}
			for (var i in me.tieredAchievs) {if (me.amount>=Game.Tiers[me.tieredAchievs[i].tier].achievUnlock) Game.Win(me.tieredAchievs[i].name);}
			for (var i in me.synergies) {var syn=me.synergies[i];if (Game.Has(Game.Tiers[syn.tier].req) && syn.buildingTie1.amount>=Game.Tiers[syn.tier].unlock && syn.buildingTie2.amount>=Game.Tiers[syn.tier].unlock) Game.Unlock(syn.name);}
		}
		
		
		
		
		//define upgrades
		//WARNING : do NOT add new upgrades in between, this breaks the saves. Add them at the end !
		// CC3 rewrite (slice 3): the 786 vanilla upgrade declarations now live
		// in the typed content layer (content/upgrades.ts). They run at this
		// exact point in Init, so declaration order (and every id, save slot
		// and Game.last hand-off) is unchanged.
		declareVanillaUpgrades(Game);
		Game.baseResearchTime=Game.fps*60*30;
		Game.SetResearch=function(what,time)
		{
			if (Game.Upgrades[what] && !Game.Has(what))
			{
				Game.researchT=Game.baseResearchTime;
				if (Game.Has('Persistent memory')) Game.researchT=Math.ceil(Game.baseResearchTime/10);
				if (Game.Has('Ultrascience')) Game.researchT=Game.fps*5;
				Game.nextResearch=Game.Upgrades[what].id;
				Game.Notify(loc("Research has begun"),loc("Your bingo center/research facility is conducting experiments."),[9,0]);
			}
		}
		Game.getPledgeDuration=function(){return Game.fps*60*(Game.Has('Sacrificial rolling pins')?60:30);}
		Game.GetHowManyHalloweenDrops=function()
		{
			var num=0;
			for (var i in Game.halloweenDrops) {if (Game.Has(Game.halloweenDrops[i])) num++;}
			return num;
		}
		/*for (var i in Game.halloweenDrops)
		{
			Game.Upgrades[Game.halloweenDrops[i]].descFunc=function(){return '<div style="text-align:center;">You currently own <b>'+Game.GetHowManyHalloweenDrops()+'/'+Game.halloweenDrops.length+'</b> halloween cookies.</div><div class="line"></div>'+this.ddesc;};
		}*/
		Game.GetHowManyHeartDrops=function()
		{
			var num=0;
			for (var i in Game.heartDrops) {if (Game.Has(Game.heartDrops[i])) num++;}
			return num;
		}
		Game.GetHowManyEggs=function()
		{
			var num=0;
			for (var i in Game.easterEggs) {if (Game.Has(Game.easterEggs[i])) num++;}
			return num;
		}
		Game.DropEgg=function(failRate)
		{
			failRate*=1/Game.dropRateMult();
			if (Game.season!='easter') return;
			if (Game.HasAchiev('Hide & seek champion')) failRate*=0.7;
			if (Game.Has('Omelette')) failRate*=0.9;
			if (Game.Has('Starspawn')) failRate*=0.9;
			if (Game.hasGod)
			{
				var godLvl=Game.hasGod('seasons');
				if (godLvl==1) failRate*=0.9;
				else if (godLvl==2) failRate*=0.95;
				else if (godLvl==3) failRate*=0.97;
			}
			if (Math.random()>=failRate)
			{
				var drop='';
				if (Math.random()<0.1) drop=choose(Game.rareEggDrops);
				else drop=choose(Game.eggDrops);
				if (Game.Has(drop) || Game.HasUnlocked(drop))//reroll if we have it
				{
					if (Math.random()<0.1) drop=choose(Game.rareEggDrops);
					else drop=choose(Game.eggDrops);
				}
				if (Game.Has(drop) || Game.HasUnlocked(drop)) return;
				Game.Unlock(drop);
				Game.Notify(loc("You found an egg!"),'<b>'+drop+'</b>',Game.Upgrades[drop].icon);
			}
		};
		Game.PermanentSlotIcon=function(slot)
		{
			if (Game.permanentUpgrades[slot]==-1) return [slot,10];
			return Game.UpgradesById[Game.permanentUpgrades[slot]].icon;
		}
		Game.AssignPermanentSlot=function(slot)
		{
			PlaySound('snd/tick.mp3');
			Game.tooltip.hide();
			var list=[];
			for (var i in Game.Upgrades)
			{
				var me=Game.Upgrades[i];
				if (me.bought && me.unlocked && !me.noPerm && (me.pool=='' || me.pool=='cookie'))
				{
					var fail=0;
					for (var ii in Game.permanentUpgrades) {if (Game.permanentUpgrades[ii]==me.id) fail=1;}//check if not already in another permaslot
					if (!fail) list.push(me);
				}
			}
			
			var sortMap=function(a,b)
			{
				if (a.order>b.order) return 1;
				else if (a.order<b.order) return -1;
				else return 0;
			}
			list.sort(sortMap);
			
			var upgrades='';
			for (var i in list)
			{
				var me=list[i];
				upgrades+=Game.crate(me,'','PlaySound(\'snd/tick.mp3\');Game.PutUpgradeInPermanentSlot('+me.id+','+slot+');','upgradeForPermanent'+me.id);
			}
			var upgrade=Game.permanentUpgrades[slot];
			Game.SelectingPermanentUpgrade=upgrade;
			Game.Prompt('<id PickPermaUpgrade><h3>'+loc("Pick an upgrade to make permanent")+'</h3>'+
			
						'<div class="line"></div><div style="margin:4px auto;clear:both;width:120px;"><div class="crate upgrade enabled" style="background-position:'+(-slot*48)+'px '+(-10*48)+'px;"></div><div id="upgradeToSlotNone" class="crate upgrade enabled" style="background-position:'+(-0*48)+'px '+(-7*48)+'px;display:'+(upgrade!=-1?'none':'block')+';"></div><div id="upgradeToSlotWrap" style="float:left;display:'+(upgrade==-1?'none':'block')+';">'+(Game.crate(Game.UpgradesById[upgrade==-1?0:upgrade],'','','upgradeToSlot'))+'</div></div>'+
						'<div class="block crateBox" style="overflow-y:scroll;float:left;clear:left;width:317px;padding:0px;height:250px;">'+upgrades+'</div>'+
						'<div class="block" style="float:right;width:152px;clear:right;height:234px;">'+loc("Here are all the upgrades you've purchased last playthrough.<div class=\"line\"></div>Pick one to permanently gain its effects!<div class=\"line\"></div>You can reassign this slot anytime you ascend.")+'</div>'
						,[[loc("Confirm"),'Game.permanentUpgrades['+slot+']=Game.SelectingPermanentUpgrade;Game.BuildAscendTree();Game.ClosePrompt();'],loc("Cancel")],0,'widePrompt');
		}
		Game.SelectingPermanentUpgrade=-1;
		Game.PutUpgradeInPermanentSlot=function(upgrade,slot)
		{
			Game.SelectingPermanentUpgrade=upgrade;
			l('upgradeToSlotWrap').innerHTML='';
			l('upgradeToSlotWrap').style.display=(upgrade==-1?'none':'block');
			l('upgradeToSlotNone').style.display=(upgrade!=-1?'none':'block');
			l('upgradeToSlotWrap').innerHTML=(Game.crate(Game.UpgradesById[upgrade==-1?0:upgrade],'','','upgradeToSlot'));
		}
		Game.playGoldenCookieChime=function()
		{
			if (Game.chimeType==1) PlaySound('snd/chime.mp3');
			else if (Game.chimeType==2) PlaySound('snd/fortune.mp3');
			else if (Game.chimeType==3) PlaySound('snd/cymbalRev.mp3');
			else if (Game.chimeType==4) {Game.wrinklerSquishSound++;if (Game.wrinklerSquishSound>4) {Game.wrinklerSquishSound-=4;}PlaySound('snd/squeak'+(Game.wrinklerSquishSound)+'.mp3');}
		}
		Game.loseShimmeringVeil=function(context)
		{
			if (!Game.Has('Shimmering veil')) return false;
			if (!Game.Has('Shimmering veil [off]') && Game.Has('Shimmering veil [on]')) return false;
			if (Game.Has('Reinforced membrane'))
			{
				if (context=='shimmer') Math.seedrandom(Game.seed+'/'+(Game.goldenClicks+Game.reindeerClicked));
				else if (context=='click') Math.seedrandom(Game.seed+'/'+Game.cookieClicks);
				if (Math.random()<Game.getVeilDefense())
				{
					Game.Notify(loc("The reinforced membrane protects the shimmering veil."),'',[7,10]);
					Game.Win('Thick-skinned');
					return false;
				}
				Math.seedrandom();
			}
			var me=Game.Upgrades['Shimmering veil [on]'];
			me.bought=1;
			//Game.Upgrades[me.toggleInto].bought=false;
			Game.Lock(me.toggleInto);
			Game.Unlock(me.toggleInto);
			Game.Notify(loc("The shimmering veil disappears..."),'',[9,10]);
			Game.upgradesToRebuild=1;
			Game.recalculateGains=1;
			PlaySound('snd/spellFail.mp3',0.75);
		}
		Game.getVeilDefense=function()
		{
			var n=0;
			if (Game.Has('Reinforced membrane')) n+=0.1;
			if (Game.Has('Delicate touch')) n+=0.1;
			if (Game.Has('Steadfast murmur')) n+=0.1;
			if (Game.Has('Glittering edge')) n+=0.1;
			return n;
		}
		Game.getVeilBoost=function()
		{
			var n=0.5;
			if (Game.Has('Reinforced membrane')) n+=0.1;
			if (Game.Has('Delicate touch')) n+=0.05;
			if (Game.Has('Steadfast murmur')) n+=0.05;
			if (Game.Has('Glittering edge')) n+=0.05;
			return n;
		}
		Game.listTinyOwnedUpgrades=function(arr)
		{
			var str='';
			for (var i=0;i<arr.length;i++)
			{
				if (Game.Has(arr[i]))
				{
					var it=Game.Upgrades[arr[i]];
					str+=tinyIcon(it.icon);
				}
			}
			return str;
		}
		Game.GetHowManySantaDrops=function()
		{
			var num=0;
			for (var i in Game.santaDrops) {if (Game.Has(Game.santaDrops[i])) num++;}
			return num;
		}
		Game.GetHowManyReindeerDrops=function()
		{
			var num=0;
			for (var i in Game.reindeerDrops) {if (Game.Has(Game.reindeerDrops[i])) num++;}
			return num;
		}
		/*for (var i in Game.santaDrops)
		{
			Game.Upgrades[Game.santaDrops[i]].descFunc=function(){return '<div style="text-align:center;">You currently own <b>'+Game.GetHowManySantaDrops()+'/'+Game.santaDrops.length+'</b> of Santa\'s gifts.</div><div class="line"></div>'+this.ddesc;};
		}*/
		Game.saySeasonSwitchUses=function()
		{
			if (Game.seasonUses==0) return loc("You haven't switched seasons this ascension yet.");
			return EN?('You\'ve switched seasons <b>'+(Game.seasonUses==1?'once':Game.seasonUses==2?'twice':(Game.seasonUses+' times'))+'</b> this ascension.'):(Game.seasonUses==1?loc("You've switched seasons <b>once</b> this ascension."):loc("You've switched seasons <b>%1 times</b> this ascension.",Game.seasonUses));
		}
		Game.computeSeasonPrices=function()
		{
			for (var i in Game.seasons)
			{
				Game.seasons[i].triggerUpgrade.priceFunc=function(){
					var m=1;
					if (Game.hasGod)
					{
						var godLvl=Game.hasGod('seasons');
						if (godLvl==1) m*=2;
						else if (godLvl==2) m*=1.50;
						else if (godLvl==3) m*=1.25;
					}
					//return Game.seasonTriggerBasePrice*Math.pow(2,Game.seasonUses)*m;
					//return Game.cookiesPs*60*Math.pow(1.5,Game.seasonUses)*m;
					return Game.seasonTriggerBasePrice+Game.unbuffedCps*60*Math.pow(1.5,Game.seasonUses)*m;
				}
			}
		}
		Game.computeSeasons=function()
		{
			for (var i in Game.seasons)
			{
				var me=Game.Upgrades[Game.seasons[i].trigger];
				Game.seasons[i].triggerUpgrade=me;
				me.pool='toggle';
				me.buyFunction=function()
				{
					Game.seasonUses+=1;
					Game.computeSeasonPrices();
					//Game.Lock(this.name);
					for (var i in Game.seasons)
					{
						var me=Game.Upgrades[Game.seasons[i].trigger];
						if (me.name!=this.name) {Game.Lock(me.name);Game.Unlock(me.name);}
					}
					if (Game.season!='' && Game.season!=this.season)
					{
						Game.Notify(Game.seasons[Game.season].over+'<div class="line"></div>','',Game.seasons[Game.season].triggerUpgrade.icon,4);
					}
					Game.season=this.season;
					Game.seasonT=Game.getSeasonDuration();
					Game.storeToRefresh=1;
					Game.upgradesToRebuild=1;
					Game.Objects['Grandma'].redraw();
					Game.Notify(Game.seasons[this.season].start+'<div class="line"></div>','',this.icon,4);
				}
				
				me.clickFunction=function(me){return function()
				{
					//undo season
					if (me.bought && Game.season && me==Game.seasons[Game.season].triggerUpgrade)
					{
						me.lose();
						Game.Notify(Game.seasons[Game.season].over,'',Game.seasons[Game.season].triggerUpgrade.icon);
						if (Game.Has('Season switcher')) {Game.Unlock(Game.seasons[Game.season].trigger);Game.seasons[Game.season].triggerUpgrade.bought=0;}
						
						Game.upgradesToRebuild=1;
						Game.recalculateGains=1;
						Game.season=Game.baseSeason;
						Game.seasonT=-1;
						PlaySound('snd/tick.mp3');
						return false;
					}
					else return true;
				};}(me);
				
				me.displayFuncWhenOwned=function(){return '<div style="text-align:center;">'+loc("Time remaining:")+'<br><b>'+(Game.Has('Eternal seasons')?loc("forever"):Game.sayTime(Game.seasonT,-1))+'</b><div style="font-size:80%;">('+loc("Click again to cancel season")+')</div></div>';}
				me.timerDisplay=function(upgrade){return function(){if (!Game.Upgrades[upgrade.name].bought || Game.Has('Eternal seasons')) return -1; else return 1-Game.seasonT/Game.getSeasonDuration();}}(me);
				
			}
		}
		Game.getSeasonDuration=function(){return Game.fps*60*60*24;}
		Game.computeSeasons();
		
		//alert untiered building upgrades
		for (var i in Game.Upgrades)
		{
			var me=Game.Upgrades[i];
			if (me.order>=200 && me.order<2000 && !me.tier && me.name.indexOf('grandma')==-1 && me.pool!='prestige') console.log(me.name+' has no tier.');
		}
		
		Game.UpgradesByPool={'kitten':[]};
		for (var i in Game.Upgrades)
		{
			if (!Game.UpgradesByPool[Game.Upgrades[i].pool]) Game.UpgradesByPool[Game.Upgrades[i].pool]=[];
			Game.UpgradesByPool[Game.Upgrades[i].pool].push(Game.Upgrades[i]);
			if (Game.Upgrades[i].kitten) Game.UpgradesByPool['kitten'].push(Game.Upgrades[i]);
		}
		
		Game.PrestigeUpgrades=[];
		for (var i in Game.Upgrades)
		{
			if (Game.Upgrades[i].pool=='prestige' || Game.Upgrades[i].pool=='prestigeDecor')
			{
				Game.PrestigeUpgrades.push(Game.Upgrades[i]);
				if (Game.Upgrades[i].posX || Game.Upgrades[i].posY) Game.Upgrades[i].placedByCode=true;
				else {Game.Upgrades[i].posX=0;Game.Upgrades[i].posY=0;}
				if (Game.Upgrades[i].parents.length==0 && Game.Upgrades[i].name!='Legacy') Game.Upgrades[i].parents=['Legacy'];
				for (var ii in Game.Upgrades[i].parents) {Game.Upgrades[i].parents[ii]=Game.Upgrades[Game.Upgrades[i].parents[ii]];}
			}
		}
		
		Game.goldenCookieUpgrades=['Get lucky','Lucky day','Serendipity','Heavenly luck','Lasting fortune','Decisive fate','Lucky digit','Lucky number','Lucky payout','Golden goose egg'];
		
		Game.cookieUpgrades=[];
		for (var i in Game.Upgrades)
		{
			var me=Game.Upgrades[i];
			if ((me.pool=='cookie' || me.pseudoCookie)) Game.cookieUpgrades.push(me);
			if (me.tier) Game.Tiers[me.tier].upgrades.push(me);
		}
		for (var i in Game.UnlockAt){Game.Upgrades[Game.UnlockAt[i].name].unlockAt=Game.UnlockAt[i];}
		for (var i in Game.Upgrades){if (Game.Upgrades[i].pool=='prestige') Game.Upgrades[i].order=Game.Upgrades[i].id;}
		
		/*var oldPrestigePrices={"Chimera":5764801,"Synergies Vol. I":2525,"Synergies Vol. II":252525,"Label printer":9999};
		for (var i in oldPrestigePrices){Game.Upgrades[i].basePrice=oldPrestigePrices[i];}*/
		
		Game.UpgradePositions={141:[118,-42],181:[-555,-93],253:[-237,-226],254:[-56,-234],255:[-149,-267],264:[68,97],265:[157,196],266:[287,212],267:[413,157],268:[480,35],269:[-640,42],270:[-471,-228],271:[-690,-178],272:[-591,-249],273:[-711,-58],274:[270,-328],275:[317,-439],276:[333,-556],277:[334,-676],278:[333,-796],279:[328,-922],280:[303,-1040],281:[194,-230],282:[-293,156],283:[-335,289],284:[-328,422],285:[-247,567],286:[-375,579],287:[-296,726],288:[-260,-396],289:[-375,-502],290:[-127,-415],291:[479,-739],292:[-399,-649],293:[-401,-806],323:[-76,109],325:[198,-1153],326:[-270,-134],327:[-221,261],328:[19,247],329:[42,402],353:[121,-326],354:[77,-436],355:[64,-548],356:[57,-673],357:[52,-793],358:[58,-924],359:[82,-1043],360:[49,506],362:[156,325],363:[-30,-30],364:[-238,-728],365:[-123,423],368:[-55,-527],393:[196,-714],394:[197,-964],395:[-143,-140],396:[-244,-897],397:[-97,641],408:[-204,-1036],409:[-72,-1152],410:[42,-1278],411:[-476,105],412:[-522,259],413:[-516,433],449:[-367,-1113],450:[-306,-1216],451:[-184,-1241],495:[-408,-974],496:[200,49],505:[411,-94],520:[-303,-12],537:[-795,-243],539:[-534,-1130],540:[-702,-1135],541:[-656,-1014],542:[-650,-1252],561:[298,-21],562:[32,744],591:[148,844],592:[-52,858],643:[57,616],646:[485,-882],647:[-102,246],717:[621,-676],718:[618,-537],719:[-225,-520],720:[-150,-631],801:[-188,920],802:[-344,916],803:[-462,848],804:[320,350],805:[221,486],};
		
		for (var i in Game.UpgradePositions) {Game.UpgradesById[i].posX=Game.UpgradePositions[i][0];Game.UpgradesById[i].posY=Game.UpgradePositions[i][1];}
		
		
		/*=====================================================================================
		ACHIEVEMENTS
		=======================================================================================*/		
		Game.Achievements={};
		Game.AchievementsById={};
		Game.AchievementsN=0;
		Game.AchievementsOwned=0;
		// CC3 rewrite (slice 4): the achievement ctors/factories and the 501
		// vanilla achievement declarations now live in the typed content layer
		// (content/achievements.ts). They run at this exact point in Init, so
		// declaration order (and every id, save slot and Game.last hand-off)
		// is unchanged; the order bookkeeping inherits the slice-3
		// order/pool/power bridge.
		declareVanillaAchievements(Game);
		
		
		
		
		for (var i in Game.Objects)
		{
			if (Game.Objects[i].levelAchiev10) {Game.Objects[i].levelAchiev10.baseDesc=loc("Reach level <b>%1</b> %2.",[10,Game.Objects[i].plural]);Game.Objects[i].levelAchiev10.desc=Game.Objects[i].levelAchiev10.baseDesc;}
		}
		
		
		
		LocalizeUpgradesAndAchievs();
		
		
		/*=====================================================================================
		BUFFS
		=======================================================================================*/
		
		Game.buffs={};//buffs currently in effect by name
		Game.buffsI=0;
		Game.buffsL=l('buffs');
		Game.gainBuff=function(type,time,arg1,arg2,arg3)
		{
			type=Game.buffTypesByName[type];
			var obj=type.func(time,arg1,arg2,arg3);
			obj.type=type;
			obj.arg1=arg1;
			obj.arg2=arg2;
			obj.arg3=arg3;
			if (!obj.dname && obj.name!='???') obj.dname=loc(obj.name);
			
			var buff={
				visible:true,
				time:0,
				name:'???',
				desc:'',
				icon:[0,0]
			};
			if (Game.buffs[obj.name])//if there is already a buff in effect with this name
			{
				var buff=Game.buffs[obj.name];
				if (obj.max) buff.time=Math.max(obj.time,buff.time);//new duration is max of old and new
				if (obj.add) buff.time+=obj.time;//new duration is old + new
				if (!obj.max && !obj.add) buff.time=obj.time;//new duration is set to new
				buff.maxTime=buff.time;
			}
			else//create new buff
			{
				for (var i in obj)//paste parameters onto buff
				{buff[i]=obj[i];}
				buff.maxTime=buff.time;
				Game.buffs[buff.name]=buff;
				buff.id=Game.buffsI;
				
				//create dom
				Game.buffsL.innerHTML=Game.buffsL.innerHTML+'<div id="buff'+buff.id+'" class="crate enabled buff" '+(buff.desc?Game.getTooltip(
					'<div class="prompt" style="min-width:200px;text-align:center;font-size:11px;margin:8px 0px;" id="tooltipBuff"><h3>'+buff.dname+'</h3><div class="line"></div>'+buff.desc+'</div>'
				,'left',true):'')+' style="opacity:1;float:none;display:block;'+writeIcon(buff.icon)+'"></div>';
				
				buff.l=l('buff'+buff.id);
				
				Game.buffsI++;
			}
			Game.recalculateGains=1;
			Game.storeToRefresh=1;
			return buff;
		}
		Game.hasBuff=function(what)//returns 0 if there is no buff in effect with this name; else, returns it
		{if (!Game.buffs[what]) return 0; else return Game.buffs[what];}
		Game.updateBuffs=function()//executed every logic frame
		{
			for (var i in Game.buffs)
			{
				var buff=Game.buffs[i];
				
				if (buff.time>=0)
				{
					if (!l('buffPieTimer'+buff.id)) l('buff'+buff.id).innerHTML=l('buff'+buff.id).innerHTML+'<div class="pieTimer" id="buffPieTimer'+buff.id+'"></div>';
					var T=1-(buff.time/buff.maxTime);
					T=(T*144)%144;
					l('buffPieTimer'+buff.id).style.backgroundPosition=(-Math.floor(T%18))*48+'px '+(-Math.floor(T/18))*48+'px';
				}
				buff.time--;
				if (buff.time<=0)
				{
					if (Game.onCrate==l('buff'+buff.id)) Game.tooltip.hide();
					if (buff.onDie) buff.onDie();
					Game.buffsL.removeChild(l('buff'+buff.id));
					if (Game.buffs[buff.name])
					{
						Game.buffs[buff.name]=0;
						delete Game.buffs[buff.name];
					}
					Game.recalculateGains=1;
					Game.storeToRefresh=1;
				}
			}
		}
		Game.killBuff=function(what)//remove a buff by name
		{if (Game.buffs[what]){Game.buffs[what].time=0;/*Game.buffs[what]=0;*/}}
		Game.killBuffs=function()//remove all buffs
		{Game.buffsL.innerHTML='';Game.buffs={};Game.recalculateGains=1;Game.storeToRefresh=1;}
		
		
		Game.buffTypes=[];//buff archetypes; only buffs declared from these can be saved and loaded
		Game.buffTypesByName=[];
		Game.buffTypesN=0;
		Game.buffType=function(name,func)
		{
			this.name=name;
			this.func=func;//this is a function that returns a buff object; it takes a "time" argument in seconds, and 3 more optional arguments at most, which will be saved and loaded as floats
			this.id=Game.buffTypesN;
			this.vanilla=Game.vanilla;
			Game.buffTypesByName[this.name]=this;
			Game.buffTypes[Game.buffTypesN]=this;
			Game.buffTypesN++;
		}
		
		/*
		basic buff parameters :
			name:'Kitten rain',
			desc:'It\'s raining kittens!',
			icon:[0,0],
			time:30*Game.fps
		other parameters :
			visible:false - will hide the buff from the buff list
			add:true - if this buff already exists, add the new duration to the old one
			max:true - if this buff already exists, set the new duration to the max of either
			onDie:function(){} - function will execute when the buff runs out
			power:3 - used by some buffs
			multCpS:3 - buff multiplies CpS by this amount
			multClick:3 - buff multiplies click power by this amount
		*/
		
		//base buffs
		new Game.buffType('frenzy',function(time,pow)
		{
			return {
				name:'Frenzy',
				desc:loc("Cookie production x%1 for %2!",[pow,Game.sayTime(time*Game.fps,-1)]),
				icon:[10,14],
				time:time*Game.fps,
				add:true,
				multCpS:pow,
				aura:1
			};
		});
		new Game.buffType('blood frenzy',function(time,pow)
		{
			return {
				name:'Elder frenzy',
				desc:loc("Cookie production x%1 for %2!",[pow,Game.sayTime(time*Game.fps,-1)]),
				icon:[29,6],
				time:time*Game.fps,
				add:true,
				multCpS:pow,
				aura:1
			};
		});
		new Game.buffType('clot',function(time,pow)
		{
			return {
				name:'Clot',
				desc:loc("Cookie production halved for %1!",Game.sayTime(time*Game.fps,-1)),
				icon:[15,5],
				time:time*Game.fps,
				add:true,
				multCpS:pow,
				aura:2
			};
		});
		new Game.buffType('dragon harvest',function(time,pow)
		{
			if (Game.Has('Dragon fang')) pow=Math.ceil(pow*1.1);
			return {
				name:'Dragon Harvest',
				desc:loc("Cookie production x%1 for %2!",[pow,Game.sayTime(time*Game.fps,-1)]),
				icon:[10,25],
				time:time*Game.fps,
				add:true,
				multCpS:pow,
				aura:1
			};
		});
		new Game.buffType('everything must go',function(time,pow)
		{
			return {
				name:'Everything must go',
				desc:loc("All buildings are %1% cheaper for %2!",[pow,Game.sayTime(time*Game.fps,-1)]),
				icon:[17,6],
				time:time*Game.fps,
				add:true,
				power:pow,
				aura:1
			};
		});
		new Game.buffType('cursed finger',function(time,pow)
		{
			return {
				name:'Cursed finger',
				desc:loc("Cookie production halted for %1,<br>but each click is worth %2 of CpS.",[Game.sayTime(time*Game.fps,-1),Game.sayTime(time*Game.fps,-1)]),
				icon:[12,17],
				time:time*Game.fps,
				add:true,
				power:pow,
				multCpS:0,
				aura:1
			};
		});
		new Game.buffType('click frenzy',function(time,pow)
		{
			return {
				name:'Click frenzy',
				desc:loc("Clicking power x%1 for %2!",[pow,Game.sayTime(time*Game.fps,-1)]),
				icon:[0,14],
				time:time*Game.fps,
				add:true,
				multClick:pow,
				aura:1
			};
		});
		new Game.buffType('dragonflight',function(time,pow)
		{
			if (Game.Has('Dragon fang')) pow=Math.ceil(pow*1.1);
			return {
				name:'Dragonflight',
				desc:loc("Clicking power x%1 for %2!",[pow,Game.sayTime(time*Game.fps,-1)]),
				icon:[0,25],
				time:time*Game.fps,
				add:true,
				multClick:pow,
				aura:1
			};
		});
		new Game.buffType('cookie storm',function(time,pow)
		{
			return {
				name:'Cookie storm',
				desc:loc("Cookies everywhere!"),
				icon:[22,6],
				time:time*Game.fps,
				add:true,
				power:pow,
				aura:1
			};
		});
		new Game.buffType('building buff',function(time,pow,building)
		{
			var obj=Game.ObjectsById[building];
			return {
				name:Game.goldenCookieBuildingBuffs[obj.name][0],
				dname:EN?Game.goldenCookieBuildingBuffs[obj.name][0]:loc("%1 Power!",obj.dname),
				desc:loc("Your %1 are boosting your CpS!",loc("%1 "+obj.bsingle,LBeautify(obj.amount)))+'<br>'+loc("Cookie production +%1% for %2!",[Beautify(Math.ceil(pow*100-100)),Game.sayTime(time*Game.fps,-1)]),
				icon:[obj.iconColumn,14],
				time:time*Game.fps,
				add:true,
				multCpS:pow,
				aura:1
			};
		});
		new Game.buffType('building debuff',function(time,pow,building)
		{
			var obj=Game.ObjectsById[building];
			return {
				name:Game.goldenCookieBuildingBuffs[obj.name][1],
				dname:EN?Game.goldenCookieBuildingBuffs[obj.name][1]:loc("%1 Burden!",obj.dname),
				desc:loc("Your %1 are rusting your CpS!",loc("%1 "+obj.bsingle,LBeautify(obj.amount)))+'<br>'+loc("Cookie production %1% slower for %2!",[Beautify(Math.ceil(pow*100-100)),Game.sayTime(time*Game.fps,-1)]),
				icon:[obj.iconColumn,15],
				time:time*Game.fps,
				add:true,
				multCpS:1/pow,
				aura:2
			};
		});
		new Game.buffType('sugar blessing',function(time,pow)
		{
			return {
				name:'Sugar blessing',
				desc:loc("You find %1% more golden cookies for the next %2.",[10,Game.sayTime(time*Game.fps,-1)]),
				icon:[29,16],
				time:time*Game.fps,
				//add:true
			};
		});
		new Game.buffType('haggler luck',function(time,pow)
		{
			return {
				name:'Haggler\'s luck',
				desc:loc("All upgrades are %1% cheaper for %2!",[pow,Game.sayTime(time*Game.fps,-1)]),
				icon:[25,11],
				time:time*Game.fps,
				power:pow,
				max:true
			};
		});
		new Game.buffType('haggler misery',function(time,pow)
		{
			return {
				name:'Haggler\'s misery',
				desc:loc("All upgrades are %1% pricier for %2!",[pow,Game.sayTime(time*Game.fps,-1)]),
				icon:[25,11],
				time:time*Game.fps,
				power:pow,
				max:true
			};
		});
		new Game.buffType('pixie luck',function(time,pow)
		{
			return {
				name:'Crafty pixies',
				desc:loc("All buildings are %1% cheaper for %2!",[pow,Game.sayTime(time*Game.fps,-1)]),
				icon:[26,11],
				time:time*Game.fps,
				power:pow,
				max:true
			};
		});
		new Game.buffType('pixie misery',function(time,pow)
		{
			return {
				name:'Nasty goblins',
				desc:loc("All buildings are %1% pricier for %2!",[pow,Game.sayTime(time*Game.fps,-1)]),
				icon:[26,11],
				time:time*Game.fps,
				power:pow,
				max:true
			};
		});
		new Game.buffType('magic adept',function(time,pow)
		{
			return {
				name:'Magic adept',
				desc:loc("Spells backfire %1 times less for %2.",[pow,Game.sayTime(time*Game.fps,-1)]),
				icon:[29,11],
				time:time*Game.fps,
				power:pow,
				max:true
			};
		});
		new Game.buffType('magic inept',function(time,pow)
		{
			return {
				name:'Magic inept',
				desc:loc("Spells backfire %1 times more for %2.",[pow,Game.sayTime(time*Game.fps,-1)]),
				icon:[29,11],
				time:time*Game.fps,
				power:pow,
				max:true
			};
		});
		new Game.buffType('devastation',function(time,pow)
		{
			return {
				name:'Devastation',
				desc:loc("Clicking power +%1% for %2!",[Math.floor(pow*100-100),Game.sayTime(time*Game.fps,-1)]),
				icon:[23,18],
				time:time*Game.fps,
				multClick:pow,
				aura:1,
				max:true
			};
		});
		new Game.buffType('sugar frenzy',function(time,pow)
		{
			return {
				name:'Sugar frenzy',
				desc:loc("Cookie production x%1 for %2!",[pow,Game.sayTime(time*Game.fps,-1)]),
				icon:[29,14],
				time:time*Game.fps,
				add:true,
				multCpS:pow,
				aura:0
			};
		});
		new Game.buffType('loan 1',function(time,pow)
		{
			return {
				name:'Loan 1',
				dname:loc("Loan %1",1),
				desc:loc("Cookie production x%1 for %2!",[pow,Game.sayTime(time*Game.fps,-1)]),
				icon:[1,33],
				time:time*Game.fps,
				power:pow,
				multCpS:pow,
				max:true,
				onDie:function(){if (Game.takeLoan) {Game.takeLoan(1,true);}},
			};
		});
		new Game.buffType('loan 1 interest',function(time,pow)
		{
			return {
				name:'Loan 1 (interest)',
				dname:loc("Loan %1 (interest)",1),
				desc:loc("Cookie production x%1 for %2!",[pow,Game.sayTime(time*Game.fps,-1)]),
				icon:[1,33],
				time:time*Game.fps,
				power:pow,
				multCpS:pow,
				max:true
			};
		});
		new Game.buffType('loan 2',function(time,pow)
		{
			return {
				name:'Loan 2',
				dname:loc("Loan %1",2),
				desc:loc("Cookie production x%1 for %2!",[pow,Game.sayTime(time*Game.fps,-1)]),
				icon:[1,33],
				time:time*Game.fps,
				power:pow,
				multCpS:pow,
				max:true,
				onDie:function(){if (Game.takeLoan) {Game.takeLoan(2,true);}},
			};
		});
		new Game.buffType('loan 2 interest',function(time,pow)
		{
			return {
				name:'Loan 2 (interest)',
				dname:loc("Loan %1 (interest)",2),
				desc:loc("Cookie production x%1 for %2!",[pow,Game.sayTime(time*Game.fps,-1)]),
				icon:[1,33],
				time:time*Game.fps,
				power:pow,
				multCpS:pow,
				max:true
			};
		});
		new Game.buffType('loan 3',function(time,pow)
		{
			return {
				name:'Loan 3',
				dname:loc("Loan %1",3),
				desc:loc("Cookie production x%1 for %2!",[pow,Game.sayTime(time*Game.fps,-1)]),
				icon:[1,33],
				time:time*Game.fps,
				power:pow,
				multCpS:pow,
				max:true,
				onDie:function(){if (Game.takeLoan) {Game.takeLoan(3,true);}},
			};
		});
		new Game.buffType('loan 3 interest',function(time,pow)
		{
			return {
				name:'Loan 3 (interest)',
				dname:loc("Loan %1 (interest)",3),
				desc:loc("Cookie production x%1 for %2!",[pow,Game.sayTime(time*Game.fps,-1)]),
				icon:[1,33],
				time:time*Game.fps,
				power:pow,
				multCpS:pow,
				max:true
			};
		});
		
		//end of buffs
		
		
		
		
		/*=====================================================================================
		GRANDMAPOCALYPSE
		=======================================================================================*/
		Game.UpdateGrandmapocalypse=function()
		{
			if (Game.Has('Elder Covenant') || Game.Objects['Grandma'].amount==0) Game.elderWrath=0;
			else if (Game.pledgeT>0)//if the pledge is active, lower it
			{
				Game.pledgeT--;
				if (Game.pledgeT==0)//did we reach 0? make the pledge purchasable again
				{
					Game.Lock('Elder Pledge');
					Game.Unlock('Elder Pledge');
					Game.elderWrath=1;
				}
			}
			else
			{
				if (Game.Has('One mind') && Game.elderWrath==0)
				{
					Game.elderWrath=1;
				}
				if (Math.random()<0.001 && Game.elderWrath<Game.Has('One mind')+Game.Has('Communal brainsweep')+Game.Has('Elder Pact'))
				{
					Game.elderWrath++;//have we already pledged? make the elder wrath shift between different stages
				}
				if (Game.Has('Elder Pact') && Game.Upgrades['Elder Pledge'].unlocked==0)
				{
					Game.Lock('Elder Pledge');
					Game.Unlock('Elder Pledge');
				}
			}
			Game.elderWrathD+=((Game.elderWrath+1)-Game.elderWrathD)*0.001;//slowly fade to the target wrath state
			
			if (Game.elderWrath!=Game.elderWrathOld)
			{
				if (Game.clicksThisSession>0)
				{
					if (Game.elderWrath>=3) PlayCue('fadeTo','grandmapocalypse');
					else PlayCue('fadeTo','click');
				}
				Game.storeToRefresh=1;
			}
			
			Game.elderWrathOld=Game.elderWrath;
			
			Game.UpdateWrinklers();
		}
		
		//wrinklers
		
		function inRect(x,y,rect)
		{
			//find out if the point x,y is in the rotated rectangle rect{w,h,r,o} (width,height,rotation in radians,y-origin) (needs to be normalized)
			//I found this somewhere online I guess
			var dx = x+Math.sin(-rect.r)*(-(rect.h/2-rect.o)),dy=y+Math.cos(-rect.r)*(-(rect.h/2-rect.o));
			var h1 = Math.sqrt(dx*dx + dy*dy);
			var currA = Math.atan2(dy,dx);
			var newA = currA - rect.r;
			var x2 = Math.cos(newA) * h1;
			var y2 = Math.sin(newA) * h1;
			if (x2 > -0.5 * rect.w && x2 < 0.5 * rect.w && y2 > -0.5 * rect.h && y2 < 0.5 * rect.h) return true;
			return false;
		}
		
		Game.wrinklerHP=2.1;
		Game.wrinklers=[];
		for (var i=0;i<12;i++)
		{
			Game.wrinklers.push({id:parseInt(i),close:0,sucked:0,phase:0,x:0,y:0,r:0,hurt:0,hp:Game.wrinklerHP,selected:0,type:0});
		}
		Game.getWrinklersMax=function()
		{
			var n=10;
			if (Game.Has('Elder spice')) n+=2;
			return n;
		}
		Game.ResetWrinklers=function()
		{
			for (var i in Game.wrinklers)
			{
				Game.wrinklers[i]={id:parseInt(i),close:0,sucked:0,phase:0,x:0,y:0,r:0,hurt:0,hp:Game.wrinklerHP,selected:0,type:0};
			}
		}
		Game.CollectWrinklers=function()
		{
			for (var i in Game.wrinklers)
			{
				Game.wrinklers[i].hp=0;
			}
		}
		Game.wrinklerSquishSound=Math.floor(Math.random()*4)+1;
		Game.playWrinklerSquishSound=function()
		{
			PlaySound('snd/'+(Game.WINKLERS?'squeak':'squish')+(Game.wrinklerSquishSound)+'.mp3',0.5);
			Game.wrinklerSquishSound+=Math.floor(Math.random()*1.5)+1;
			if (Game.wrinklerSquishSound>4) Game.wrinklerSquishSound-=4;
		}
		Game.SpawnWrinkler=function(me)
		{
			if (!me)
			{
				var max=Game.getWrinklersMax();
				var n=0;
				for (var i in Game.wrinklers)
				{
					if (Game.wrinklers[i].phase>0) n++;
				}
				for (var i in Game.wrinklers)
				{
					var it=Game.wrinklers[i];
					if (it.phase==0 && Game.elderWrath>0 && n<max && it.id<max)
					{
						me=it;
						break;
					}
				}
			}
			if (!me) return false;
			me.phase=1;
			me.hp=Game.wrinklerHP;
			me.type=0;
			if (Math.random()<0.0001) me.type=1;//shiny wrinkler
			return me;
		}
		Game.PopRandomWrinkler=function()
		{
			var wrinklers=[];
			for (var i in Game.wrinklers)
			{
				if (Game.wrinklers[i].phase>0 && Game.wrinklers[i].hp>0) wrinklers.push(Game.wrinklers[i]);
			}
			if (wrinklers.length>0)
			{
				var me=choose(wrinklers);
				me.hp=-10;
				return me;
			}
			return false;
		}
		Game.UpdateWrinklers=function()
		{
			var xBase=0;
			var yBase=0;
			var onWrinkler=0;
			if (Game.LeftBackground)
			{
				xBase=Game.cookieOriginX;
				yBase=Game.cookieOriginY;
			}
			var max=Game.getWrinklersMax();
			var n=0;
			for (var i in Game.wrinklers)
			{
				if (Game.wrinklers[i].phase>0) n++;
			}
			for (var i in Game.wrinklers)
			{
				var me=Game.wrinklers[i];
				if (me.phase==0 && Game.elderWrath>0 && n<max && me.id<max)
				{
					var chance=0.00001*Game.elderWrath;
					chance*=Game.eff('wrinklerSpawn');
					if (Game.Has('Unholy bait')) chance*=5;
					if (Game.hasGod)
					{
						var godLvl=Game.hasGod('scorn');
						if (godLvl==1) chance*=2.5;
						else if (godLvl==2) chance*=2;
						else if (godLvl==3) chance*=1.5;
					}
					if (Game.Has('Wrinkler doormat')) chance=0.1;
					if (Math.random()<chance)//respawn
					{
						Game.SpawnWrinkler(me);
					}
				}
				if (me.phase>0)
				{
					if (me.close<1) me.close+=(1/Game.fps)/10;
					if (me.close>1) me.close=1;
				}
				else me.close=0;
				if (me.close==1 && me.phase==1)
				{
					me.phase=2;
					Game.recalculateGains=1;
				}
				if (me.phase==2)
				{
					me.sucked+=(((Game.cookiesPs/Game.fps)*Game.cpsSucked));//suck the cookies
				}
				if (me.phase>0)
				{
					if (me.type==0)
					{
						if (me.hp<Game.wrinklerHP) me.hp+=0.04;
						me.hp=Math.min(Game.wrinklerHP,me.hp);
					}
					else if (me.type==1)
					{
						if (me.hp<Game.wrinklerHP*3) me.hp+=0.04;
						me.hp=Math.min(Game.wrinklerHP*3,me.hp);
					}
					var d=128*(2-me.close);//*Game.BigCookieSize;
					if (Game.prefs.fancy) d+=Math.cos(Game.T*0.05+parseInt(me.id))*4;
					me.r=(me.id/max)*360;
					if (Game.prefs.fancy) me.r+=Math.sin(Game.T*0.05+parseInt(me.id))*4;
					me.x=xBase+(Math.sin(me.r*Math.PI/180)*d);
					me.y=yBase+(Math.cos(me.r*Math.PI/180)*d);
					if (Game.prefs.fancy) me.r+=Math.sin(Game.T*0.09+parseInt(me.id))*4;
					var rect={w:100,h:200,r:(-me.r)*Math.PI/180,o:10};
					if (Math.random()<0.01 && !Game.prefs.notScary) me.hurt=Math.max(me.hurt,Math.random());
					if (Game.T%5==0 && Game.CanClick) {if (Game.LeftBackground && Game.mouseX<Game.LeftBackground.canvas.width && inRect(Game.mouseX-me.x,Game.mouseY-me.y,rect)) me.selected=1; else me.selected=0;}
					if (me.selected && onWrinkler==0 && Game.CanClick)
					{
						me.hurt=Math.max(me.hurt,0.25);
						//me.close*=0.99;
						if (Game.Click && Game.lastClickedEl==l('backgroundLeftCanvas'))
						{
							if (Game.keys[17] && Game.sesame) {me.type=!me.type;PlaySound('snd/shimmerClick.mp3');}//ctrl-click on a wrinkler in god mode to toggle its shininess
							else
							{
								Game.playWrinklerSquishSound();
								me.hurt=1;
								me.hp-=0.75;
								if (Game.prefs.particles && !Game.prefs.notScary && !Game.WINKLERS && !(me.hp<=0.5 && me.phase>0))
								{
									var x=me.x+(Math.sin(me.r*Math.PI/180)*90);
									var y=me.y+(Math.cos(me.r*Math.PI/180)*90);
									for (var ii=0;ii<3;ii++)
									{
										//Game.particleAdd(x+Math.random()*50-25,y+Math.random()*50-25,Math.random()*4-2,Math.random()*-2-2,1,1,2,'wrinklerBits.webp');
										var part=Game.particleAdd(x,y,Math.random()*4-2,Math.random()*-2-2,1,1,2,me.type==1?'shinyWrinklerBits.webp':'wrinklerBits.webp');
										part.r=-me.r;
									}
								}
							}
							Game.Click=0;
						}
						onWrinkler=1;
					}
				}
				
				if (me.hurt>0)
				{
					me.hurt-=5/Game.fps;
					//me.close-=me.hurt*0.05;
					//me.x+=Math.random()*2-1;
					//me.y+=Math.random()*2-1;
					me.r+=(Math.sin(Game.T*1)*me.hurt)*18;//Math.random()*2-1;
				}
				if (me.hp<=0.5 && me.phase>0)
				{
					Game.playWrinklerSquishSound();
					PlaySound('snd/pop'+Math.floor(Math.random()*3+1)+'.mp3',0.75);
					Game.wrinklersPopped++;
					Game.recalculateGains=1;
					me.phase=0;
					me.close=0;
					me.hurt=0;
					me.hp=3;
					var toSuck=1.1;
					if (Game.Has('Sacrilegious corruption')) toSuck*=1.05;
					if (me.type==1) toSuck*=3;//shiny wrinklers are an elusive, profitable breed
					me.sucked*=toSuck;//cookie dough does weird things inside wrinkler digestive tracts
					if (Game.Has('Wrinklerspawn')) me.sucked*=1.05;
					if (Game.hasGod)
					{
						var godLvl=Game.hasGod('scorn');
						if (godLvl==1) me.sucked*=1.15;
						else if (godLvl==2) me.sucked*=1.1;
						else if (godLvl==3) me.sucked*=1.05;
					}
					if (me.sucked>0.5)
					{
						Game.Notify(me.type==1?loc("Exploded a shiny wrinkler"):loc("Exploded a wrinkler"),loc("Found <b>%1</b>!",loc("%1 cookie",LBeautify(me.sucked))),[19,8],6);
						Game.Popup('<div style="font-size:80%;">'+loc("+%1!",loc("%1 cookie",LBeautify(me.sucked)))+'</div>',Game.mouseX,Game.mouseY);
						
						if (Game.season=='halloween')
						{
							//if (Math.random()<(Game.HasAchiev('Spooky cookies')?0.2:0.05))//halloween cookie drops
							var failRate=0.95;
							if (Game.HasAchiev('Spooky cookies')) failRate=0.8;
							if (Game.Has('Starterror')) failRate*=0.9;
							failRate*=1/Game.dropRateMult();
							if (Game.hasGod)
							{
								var godLvl=Game.hasGod('seasons');
								if (godLvl==1) failRate*=0.9;
								else if (godLvl==2) failRate*=0.95;
								else if (godLvl==3) failRate*=0.97;
							}
							if (me.type==1) failRate*=0.9;
							if (Math.random()>failRate)//halloween cookie drops
							{
								var cookie=choose(['Skull cookies','Ghost cookies','Bat cookies','Slime cookies','Pumpkin cookies','Eyeball cookies','Spider cookies']);
								if (!Game.HasUnlocked(cookie) && !Game.Has(cookie))
								{
									Game.Unlock(cookie);
									Game.Notify(Game.Upgrades[cookie].dname,loc("You also found <b>%1</b>!",Game.Upgrades[cookie].dname),Game.Upgrades[cookie].icon);
								}
							}
						}
						Game.DropEgg(0.98);
					}
					if (me.type==1) Game.Win('Last Chance to See');
					Game.Earn(me.sucked);
					/*if (Game.prefs.particles && !Game.WINKLERS)
					{
						var x=me.x+(Math.sin(me.r*Math.PI/180)*100);
						var y=me.y+(Math.cos(me.r*Math.PI/180)*100);
						for (var ii=0;ii<6;ii++)
						{
							Game.particleAdd(x+Math.random()*50-25,y+Math.random()*50-25,Math.random()*4-2,Math.random()*-2-2,1,1,2,'wrinklerBits.webp');
						}
					}*/
					if (Game.prefs.particles)
					{
						var x=me.x+(Math.sin(me.r*Math.PI/180)*90);
						var y=me.y+(Math.cos(me.r*Math.PI/180)*90);
						if (me.sucked>0)
						{
							for (var ii=0;ii<5;ii++)
							{
								Game.particleAdd(Game.mouseX,Game.mouseY,Math.random()*4-2,Math.random()*-2-2,Math.random()*0.5+0.75,1.5,2);
							}
						}
						if (!Game.prefs.notScary && !Game.WINKLERS)
						{
							for (var ii=0;ii<8;ii++)
							{
								var part=Game.particleAdd(x,y,Math.random()*4-2,Math.random()*-2-2,1,1,2,me.type==1?'shinyWrinklerBits.webp':'wrinklerBits.webp');
								part.r=-me.r;
							}
						}
					}
					me.sucked=0;
				}
			}
			if (onWrinkler)
			{
				Game.mousePointer=1;
			}
		}
		Game.DrawWrinklers=function()
		{
			var ctx=Game.LeftBackground;
			var selected=0;
			for (var i in Game.wrinklers)
			{
				var me=Game.wrinklers[i];
				if (me.phase>0)
				{
					ctx.globalAlpha=me.close;
					ctx.save();
					ctx.translate(me.x,me.y);
					var sw=100+2*Math.sin(Game.T*0.2+i*3);
					var sh=200+5*Math.sin(Game.T*0.2-2+i*3);
					if (Game.prefs.fancy)
					{
						ctx.translate(0,30);
						ctx.rotate(-(me.r)*Math.PI/180);
						ctx.drawImage(Pic('wrinklerShadow.webp'),-sw/2,-10,sw,sh);
						ctx.rotate((me.r)*Math.PI/180);
						ctx.translate(0,-30);
					}
					ctx.rotate(-(me.r)*Math.PI/180);
					//var s=Math.min(1,me.sucked/(Game.cookiesPs*60))*0.75+0.25;//scale wrinklers as they eat
					//ctx.scale(Math.pow(s,1.5)*1.25,s);
					//ctx.fillRect(-50,-10,100,200);
					var pic=Game.WINKLERS?'winkler.webp':'wrinkler.webp';
					if (me.type==1) pic=Game.WINKLERS?'shinyWinkler.webp':'shinyWrinkler.webp';
					else if (Game.season=='christmas') pic=Game.WINKLERS?'winterWinkler.webp':'winterWrinkler.webp';
					ctx.drawImage(Pic(pic),-sw/2,-10,sw,sh);
					if (!Game.WINKLERS && Game.prefs.notScary) ctx.drawImage(Pic(Math.sin(Game.T*0.003+i*11+137+Math.sin(Game.T*0.017+i*13))>0.9997?'wrinklerBlink.webp':'wrinklerGooglies.webp'),-sw/2,-10+1*Math.sin(Game.T*0.2+i*3+1.2),sw,sh);
					//ctx.drawImage(Pic(pic),-50,-10);
					//ctx.fillText(me.id+' : '+me.sucked,0,0);
					if (me.type==1 && Math.random()<0.3 && Game.prefs.particles)//sparkle
					{
						ctx.globalAlpha=Math.random()*0.65+0.1;
						var s=Math.random()*30+5;
						ctx.globalCompositeOperation='lighter';
						ctx.drawImage(Pic('glint.webp'),-s/2+Math.random()*50-25,-s/2+Math.random()*200,s,s);
					}
					ctx.restore();
					
					if (Game.prefs.particles && me.phase==2 && Math.random()<0.03)
					{
						Game.particleAdd(me.x,me.y,Math.random()*4-2,Math.random()*-2-2,Math.random()*0.5+0.5,1,2);
					}
					
					if (me.selected) selected=me;
				}
			}
			if (selected && Game.Has('Eye of the wrinkler'))
			{
				var x=Game.cookieOriginX;
				var y=Game.cookieOriginY;
				ctx.font='14px Merriweather';
				ctx.textAlign='center';
				var text=loc("Swallowed:");
				var width=Math.ceil(Math.max(ctx.measureText(text).width,ctx.measureText(Beautify(selected.sucked)).width));
				ctx.fillStyle='#000';
				ctx.globalAlpha=0.65;
				/*ctx.strokeStyle='#000';
				ctx.lineWidth=8;
				ctx.beginPath();
				ctx.moveTo(x,y);
				ctx.lineTo(Math.floor(selected.x),Math.floor(selected.y));
				ctx.stroke();*/
				var xO=x-width/2-16;
				var yO=y-4;
				var dist=Math.floor(Math.sqrt((selected.x-xO)*(selected.x-xO)+(selected.y-yO)*(selected.y-yO)));
				var angle=-Math.atan2(yO-selected.y,xO-selected.x)+Math.PI/2;
				ctx.strokeStyle='#fff';
				ctx.lineWidth=1;
				for (var i=0;i<Math.floor(dist/12);i++)
				{
					var xC=selected.x+Math.sin(angle)*i*12;
					var yC=selected.y+Math.cos(angle)*i*12;
					ctx.beginPath();
					ctx.arc(xC,yC,4+(Game.prefs.fancy?2*Math.pow(Math.sin(-Game.T*0.2+i*0.3),4):0),0,2*Math.PI,false);
					ctx.fill();
					ctx.stroke();
				}
				ctx.fillRect(x-width/2-8-10,y-23,width+16+20,38);
				ctx.strokeStyle='#fff';
				ctx.lineWidth=1;
				ctx.strokeRect(x-width/2-8-10+1.5,y-23+1.5,width+16+20-3,38-3);
				ctx.globalAlpha=1;
				ctx.fillStyle='#fff';
				ctx.fillText(text,x+14,y-8);
				ctx.fillText(Beautify(selected.sucked),x+10,y+8);
				var s=54+2*Math.sin(Game.T*0.4);
				ctx.drawImage(Pic('icons.webp'),27*48,26*48,48,48,x-width/2-16-s/2,y-4-s/2,s,s);
			}
		}
		Game.SaveWrinklers=function()
		{
			var amount=0;
			var amountShinies=0;
			var number=0;
			var shinies=0;
			for (var i in Game.wrinklers)
			{
				if (Game.wrinklers[i].sucked>0.5)
				{
					number++;
					if (Game.wrinklers[i].type==1)
					{
						shinies++;
						amountShinies+=Game.wrinklers[i].sucked;
					}
					else amount+=Game.wrinklers[i].sucked;
				}
			}
			return {amount:amount,number:number,shinies:shinies,amountShinies:amountShinies};
		}
		Game.LoadWrinklers=function(amount,number,shinies,amountShinies)
		{
			if (number>0 && (amount>0 || amountShinies>0))
			{
				var fullNumber=number-shinies;
				var fullNumberShinies=shinies;
				for (var i in Game.wrinklers)
				{
					if (number>0)
					{
						Game.wrinklers[i].phase=2;
						Game.wrinklers[i].close=1;
						Game.wrinklers[i].hp=3;
						if (shinies>0) {Game.wrinklers[i].type=1;Game.wrinklers[i].sucked=amountShinies/fullNumberShinies;shinies--;}
						else Game.wrinklers[i].sucked=amount/fullNumber;
						number--;
					}//respawn
				}
			}
		}
		
		/*=====================================================================================
		SPECIAL THINGS AND STUFF
		=======================================================================================*/
		
		
		Game.specialTab='';
		Game.specialTabHovered='';
		Game.specialTabs=[];
		
		Game.UpdateSpecial=function()
		{
			Game.specialTabs=[];
			if (Game.Has('A festive hat')) Game.specialTabs.push('santa');
			if (Game.Has('A crumbly egg')) Game.specialTabs.push('dragon');
			if (Game.specialTabs.length==0) {Game.ToggleSpecialMenu(0);return;}
		
			if (Game.LeftBackground)
			{
				Game.specialTabHovered='';
				var len=Game.specialTabs.length;
				if (len==0) return;
				var y=Game.LeftBackground.canvas.height-24-48*len;
				for (var i=0;i<Game.specialTabs.length;i++)
				{
					var selected=0;
					if (Game.specialTab==Game.specialTabs[i]) selected=1;
					var x=24;
					var s=1;
					if (selected) {s=2;x+=24;}
					
					if (Math.abs(Game.mouseX-x)<=24*s && Math.abs(Game.mouseY-y)<=24*s)
					{
						Game.specialTabHovered=Game.specialTabs[i];
						Game.mousePointer=1;
						Game.CanClick=0;
						if (Game.Click && Game.lastClickedEl==l('backgroundLeftCanvas'))
						{
							if (Game.specialTab!=Game.specialTabs[i]) {Game.specialTab=Game.specialTabs[i];Game.ToggleSpecialMenu(1);PlaySound('snd/press.mp3');}
							else {Game.ToggleSpecialMenu(0);PlaySound('snd/press.mp3');}
							//PlaySound('snd/tick.mp3');
						}
					}
					
					y+=48;
				}
			}
		}
		
		Game.santaLevels=['Festive test tube','Festive ornament','Festive wreath','Festive tree','Festive present','Festive elf fetus','Elf toddler','Elfling','Young elf','Bulky elf','Nick','Santa Claus','Elder Santa','True Santa','Final Claus'];
		if (!EN){for (var i in Game.santaLevels){Game.santaLevels[i]=loc(Game.santaLevels[i]);}}
		for (var i in Game.santaDrops)//scale christmas upgrade prices with santa level
		{Game.Upgrades[Game.santaDrops[i]].priceFunc=function(){return Math.pow(3,Game.santaLevel)*2525;}}
		
		Game.UpgradeSanta=function()
		{
			var moni=Math.pow(Game.santaLevel+1,Game.santaLevel+1);
			if (Game.cookies>moni && Game.santaLevel<14)
			{
				PlaySound('snd/shimmerClick.mp3');
				
				Game.Spend(moni);
				Game.santaLevel=(Game.santaLevel+1)%15;
				if (Game.santaLevel==14)
				{
					Game.Unlock('Santa\'s dominion');
					Game.Notify(loc("You are granted %1.",Game.Upgrades['Santa\'s dominion'].dname),'',Game.Upgrades['Santa\'s dominion'].icon);
				}
				var drops=[];
				for (var i in Game.santaDrops) {if (!Game.HasUnlocked(Game.santaDrops[i])) drops.push(Game.santaDrops[i]);}
				var drop=choose(drops);
				if (drop)
				{
					Game.Unlock(drop);
					Game.Notify(loc("Found a present!"),loc("You find a present which contains...")+'<br><b>'+Game.Upgrades[drop].dname+'</b>!',Game.Upgrades[drop].icon);
				}
				
				Game.ToggleSpecialMenu(1);
				
				if (l('specialPic')){var rect=l('specialPic').getBounds();Game.SparkleAt((rect.left+rect.right)/2,(rect.top+rect.bottom)/2)+32-TopBarOffset;}
				
				if (Game.santaLevel>=6) Game.Win('Coming to town');
				if (Game.santaLevel>=14) Game.Win('All hail Santa');
				Game.recalculateGains=1;
				Game.upgradesToRebuild=1;
			}
		}
		
		Game.dragonLevels=[
			{name:'Dragon egg',action:loc("Chip it"),pic:0,
				cost:function(){return Game.cookies>=1000000;},
				buy:function(){Game.Spend(1000000);},
				costStr:function(){return loc("%1 cookie",LBeautify(1000000));}},
			{name:'Dragon egg',action:loc("Chip it"),pic:1,
				cost:function(){return Game.cookies>=1000000*2;},
				buy:function(){Game.Spend(1000000*2);},
				costStr:function(){return loc("%1 cookie",LBeautify(1000000*2));}},
			{name:'Dragon egg',action:loc("Chip it"),pic:2,
				cost:function(){return Game.cookies>=1000000*4;},
				buy:function(){Game.Spend(1000000*4);},
				costStr:function(){return loc("%1 cookie",LBeautify(1000000*4));}},
			{name:'Shivering dragon egg',action:loc("Hatch it"),pic:3,
				cost:function(){return Game.cookies>=1000000*8;},
				buy:function(){Game.Spend(1000000*8);},
				costStr:function(){return loc("%1 cookie",LBeautify(1000000*8));}},
			{name:'Krumblor, cookie hatchling',action:'Train Breath of Milk<br><small>Aura : kittens are 5% more effective</small>',pic:4,
				cost:function(){return Game.cookies>=1000000*16;},
				buy:function(){Game.Spend(1000000*16);},
				costStr:function(){return loc("%1 cookie",LBeautify(1000000*16));}},
			{name:'Krumblor, cookie hatchling',action:'Train Dragon Cursor<br><small>Aura : clicking is 5% more effective</small>',pic:4,},
			{name:'Krumblor, cookie hatchling',action:'Train Elder Battalion<br><small>Aura : grandmas gain +1% CpS for every non-grandma building</small>',pic:4,},
			{name:'Krumblor, cookie hatchling',action:'Train Reaper of Fields<br><small>Aura : golden cookies may trigger a Dragon Harvest</small>',pic:4,},
			{name:'Krumblor, cookie dragon',action:'Train Earth Shatterer<br><small>Aura : buildings sell back for 50% instead of 25%</small>',pic:5,},
			{name:'Krumblor, cookie dragon',action:'Train Master of the Armory<br><small>Aura : all upgrades are 2% cheaper</small>',pic:5,},
			{name:'Krumblor, cookie dragon',action:'Train Fierce Hoarder<br><small>Aura : all buildings are 2% cheaper</small>',pic:5,},
			{name:'Krumblor, cookie dragon',action:'Train Dragon God<br><small>Aura : prestige CpS bonus +5%</small>',pic:5,},
			{name:'Krumblor, cookie dragon',action:'Train Arcane Aura<br><small>Aura : golden cookies appear 5% more often</small>',pic:5,},
			{name:'Krumblor, cookie dragon',action:'Train Dragonflight<br><small>Aura : golden cookies may trigger a Dragonflight</small>',pic:5,},
			{name:'Krumblor, cookie dragon',action:'Train Ancestral Metamorphosis<br><small>Aura : golden cookies give 10% more cookies</small>',pic:5,},
			{name:'Krumblor, cookie dragon',action:'Train Unholy Dominion<br><small>Aura : wrath cookies give 10% more cookies</small>',pic:5,},
			{name:'Krumblor, cookie dragon',action:'Train Epoch Manipulator<br><small>Aura : golden cookie effects last 5% longer</small>',pic:5,},
			{name:'Krumblor, cookie dragon',action:'Train Mind Over Matter<br><small>Aura : +25% random drops</small>',pic:5,},
			{name:'Krumblor, cookie dragon',action:'Train Radiant Appetite<br><small>Aura : all cookie production multiplied by 2</small>',pic:5,},
			{name:'Krumblor, cookie dragon',action:'Train Dragon\'s Fortune<br><small>Aura : +123% CpS per golden cookie on-screen</small>',pic:5,},
			{name:'Krumblor, cookie dragon',action:'Train Dragon\'s Curve<br><small>Aura : sugar lumps grow 5% faster, 50% weirder</small>',pic:5,},
			{name:'Krumblor, cookie dragon',action:'Train Reality Bending<br><small>Aura : 10% of every other aura, combined</small>',pic:5,},
			{name:'Krumblor, cookie dragon',action:'Train Dragon Orbs<br><small>Aura : selling your best building may grant a wish</small>',pic:5,},
			{name:'Krumblor, cookie dragon',action:'Train Supreme Intellect<br><small>Aura : confers various powers to your minigames</small>',pic:5,},
			{name:'Krumblor, cookie dragon',action:loc("Bake dragon cookie")+'<br><small>'+loc("Delicious!")+'</small>',pic:6,
				cost:function(){var fail=0;for (var i in Game.Objects){if (Game.Objects[i].amount<50) fail=1;}return (fail==0);},
				buy:function(){for (var i in Game.Objects){Game.Objects[i].sacrifice(50);}Game.Unlock('Dragon cookie');},
				costStr:function(){return loc("%1 of every building",50);}},
			{name:'Krumblor, cookie dragon',action:loc("Train secondary aura")+'<br><small>'+loc("Lets you use two dragon auras simultaneously")+'</small>',pic:7,
				cost:function(){var fail=0;for (var i in Game.Objects){if (Game.Objects[i].amount<200) fail=1;}return (fail==0);},
				buy:function(){for (var i in Game.Objects){Game.Objects[i].sacrifice(200);}},
				costStr:function(){return loc("%1 of every building",200);}},
			{name:'Krumblor, cookie dragon',action:loc("Your dragon is fully trained."),pic:8}
		];
		
		Game.dragonAuras={
			0:{name:'No aura',pic:[0,7],desc:loc("Select an aura from those your dragon knows.")},
			1:{name:'Breath of Milk',pic:[18,25],desc:loc("Kittens are <b>%1%</b> more effective.",5)},
			2:{name:'Dragon Cursor',pic:[0,25],desc:loc("Clicking is <b>%1%</b> more powerful.",5)},
			3:{name:'Elder Battalion',pic:[1,25],desc:loc("Grandmas gain <b>+%1% CpS</b> for each non-grandma building.",1)},
			4:{name:'Reaper of Fields',pic:[2,25],desc:loc("Golden cookies may trigger a <b>Dragon Harvest</b>.")},
			5:{name:'Earth Shatterer',pic:[3,25],desc:loc("Buildings sell back for <b>%1%</b> instead of %2%.",[50,25])},
			6:{name:'Master of the Armory',pic:[4,25],desc:loc("All upgrades are <b>%1% cheaper</b>.",2)},
			7:{name:'Fierce Hoarder',pic:[15,25],desc:loc("All buildings are <b>%1% cheaper</b>.",2)},
			8:{name:'Dragon God',pic:[16,25],desc:loc("<b>+%1%</b> prestige level effect on CpS.",5)},
			9:{name:'Arcane Aura',pic:[17,25],desc:loc("Golden cookies appear <b>%1%</b> more often.",5)},
			10:{name:'Dragonflight',pic:[5,25],desc:loc("Golden cookies may trigger a <b>Dragonflight</b>.")},
			11:{name:'Ancestral Metamorphosis',pic:[6,25],desc:loc("Golden cookies give <b>%1%</b> more cookies.",10)},
			12:{name:'Unholy Dominion',pic:[7,25],desc:loc("Wrath cookies give <b>%1%</b> more cookies.",10)},
			13:{name:'Epoch Manipulator',pic:[8,25],desc:loc("Golden cookies stay <b>%1%</b> longer.",5)},
			14:{name:'Mind Over Matter',pic:[13,25],desc:loc("Random drops are <b>%1% more common</b>.",25)},
			15:{name:'Radiant Appetite',pic:[14,25],desc:loc("All cookie production <b>multiplied by %1</b>.",2)},
			16:{name:'Dragon\'s Fortune',pic:[19,25],desc:loc("<b>+%1% CpS</b> per golden cookie on-screen, multiplicative.",123)},
			17:{name:'Dragon\'s Curve',pic:[20,25],desc:loc("<b>+%1%</b> sugar lump growth.",5)+" "+loc("Sugar lumps are <b>twice as likely</b> to be unusual.")},
			18:{name:'Reality Bending',pic:[32,25],desc:loc("<b>One tenth</b> of every other dragon aura, <b>combined</b>.")},
			19:{name:'Dragon Orbs',pic:[33,25],desc:loc("With no buffs and no golden cookies on screen, selling your most powerful building has <b>%1% chance to summon one</b>.",10)},
			20:{name:'Supreme Intellect',pic:[34,25],desc:loc("Confers various powers to your minigames while active.<br>See the bottom of each minigame for more details.")},
		};
		
		Game.dragonAurasBN={};for (var i in Game.dragonAuras){Game.dragonAurasBN[Game.dragonAuras[i].name]=Game.dragonAuras[i];}
		for (var i in Game.dragonAuras){Game.dragonAuras[i].id=parseInt(i);Game.dragonAuras[i].dname=loc(Game.dragonAuras[i].name);}
		
		for (var i=0;i<Game.dragonLevels.length;i++)
		{
			var it=Game.dragonLevels[i];
			it.name=loc(it.name);
			if (i>=4 && i<Game.dragonLevels.length-3)
			{
				if (!EN) it.action=loc("Train %1",Game.dragonAuras[i-3].dname)+'<br><small>'+loc("Aura: %1",Game.dragonAuras[i-3].desc)+'</small>';
				if (i>=5)
				{
					it.costStr=function(building){return function(){return loc("%1 "+building.bsingle,LBeautify(100));}}(Game.ObjectsById[i-5]);
					it.cost=function(building){return function(){return building.amount>=100;}}(Game.ObjectsById[i-5]);
					it.buy=function(building){return function(){building.sacrifice(100);}}(Game.ObjectsById[i-5]);
				}
			}
		}
		
		Game.hasAura=function(what)
		{
			if (Game.dragonAuras[Game.dragonAura].name==what || Game.dragonAuras[Game.dragonAura2].name==what) return true; else return false;
		}
		Game.auraMult=function(what)
		{
			var n=0;
			if (Game.dragonAuras[Game.dragonAura].name==what || Game.dragonAuras[Game.dragonAura2].name==what) n=1;
			if ((Game.dragonAuras[Game.dragonAura].name=='Reality Bending' || Game.dragonAuras[Game.dragonAura2].name=='Reality Bending') && Game.dragonLevel>=Game.dragonAurasBN[what].id+4) n+=0.1;
			return n;
		}
		
		Game.SelectDragonAura=function(slot,update)
		{	
			var currentAura=0;
			var otherAura=0;
			if (slot==0) currentAura=Game.dragonAura; else currentAura=Game.dragonAura2;
			if (slot==0) otherAura=Game.dragonAura2; else otherAura=Game.dragonAura;
			if (!update) Game.SelectingDragonAura=currentAura;
			
			var str='';
			for (var i in Game.dragonAuras)
			{
				if (Game.dragonLevel>=parseInt(i)+4)
				{
					var icon=Game.dragonAuras[i].pic;
					if (i==0 || i!=otherAura) str+='<div class="crate enabled'+(i==Game.SelectingDragonAura?' highlighted':'')+'" style="opacity:1;float:none;display:inline-block;'+writeIcon(icon)+'" '+Game.clickStr+'="PlaySound(\'snd/tick.mp3\');Game.SetDragonAura('+i+','+slot+');" onMouseOut="Game.DescribeDragonAura('+Game.SelectingDragonAura+');" onMouseOver="Game.DescribeDragonAura('+i+');"'+
					'></div>';
				}
			}
			
			var highestBuilding=0;
			for (var i in Game.Objects) {if (Game.Objects[i].amount>0) highestBuilding=Game.Objects[i];}
			
			Game.Prompt('<id PickDragonAura><h3>'+loc(slot==1?"Set your dragon's secondary aura":"Set your dragon's aura")+'</h3>'+
						'<div class="line"></div>'+
						'<div id="dragonAuraInfo" style="min-height:60px;"></div>'+
						'<div style="text-align:center;">'+str+'</div>'+
						'<div class="line"></div>'+
						'<div style="text-align:center;margin-bottom:8px;">'+(highestBuilding==0?loc("Switching your aura is <b>free</b> because you own no buildings."):loc("The cost of switching your aura is <b>%1</b>.<br>This will affect your CpS!",loc("%1 "+highestBuilding.bsingle,LBeautify(1))))+'</div>'
						,[[loc("Confirm"),(slot==0?'Game.dragonAura':'Game.dragonAura2')+'=Game.SelectingDragonAura;'+(highestBuilding==0 || currentAura==Game.SelectingDragonAura?'':'Game.ObjectsById['+highestBuilding.id+'].sacrifice(1);')+'Game.ToggleSpecialMenu(1);Game.ClosePrompt();'],loc("Cancel")],0,'widePrompt');
			Game.DescribeDragonAura(Game.SelectingDragonAura);
		}
		Game.SelectingDragonAura=-1;
		Game.SetDragonAura=function(aura,slot)
		{
			Game.SelectingDragonAura=aura;
			Game.SelectDragonAura(slot,1);
		}
		Game.DescribeDragonAura=function(aura)
		{
			l('dragonAuraInfo').innerHTML=
			'<div style="min-width:200px;text-align:center;"><h4>'+Game.dragonAuras[aura].dname+'</h4>'+
			'<div class="line"></div>'+
			Game.dragonAuras[aura].desc+
			'</div>';
		}
		
		Game.UpgradeDragon=function()
		{
			if (Game.dragonLevel<Game.dragonLevels.length-1 && Game.dragonLevels[Game.dragonLevel].cost())
			{
				PlaySound('snd/shimmerClick.mp3');
				Game.dragonLevels[Game.dragonLevel].buy();
				Game.dragonLevel=(Game.dragonLevel+1)%Game.dragonLevels.length;
				
				if (Game.dragonLevel>=Game.dragonLevels.length-1) Game.Win('Here be dragon');
				Game.ToggleSpecialMenu(1);
				if (l('specialPic')){var rect=l('specialPic').getBounds();Game.SparkleAt((rect.left+rect.right)/2,(rect.top+rect.bottom)/2)+32-TopBarOffset;}
				Game.recalculateGains=1;
				Game.upgradesToRebuild=1;
			}
		}
		
		Game.lastClickedSpecialPic=0;
		Game.ClickSpecialPic=function()
		{
			if (Game.specialTab=='dragon' && Game.dragonLevel>=4 && Game.Has('Pet the dragon') && l('specialPic'))
			{
				triggerAnim(l('specialPic'),'pucker');
				PlaySound('snd/click'+Math.floor(Math.random()*7+1)+'.mp3',0.5);
				if (Date.now()-Game.lastClickedSpecialPic>2000) PlaySound('snd/growl.mp3');
				//else if (Math.random()<0.5) PlaySound('snd/growl.mp3',0.5+Math.random()*0.2);
				Game.lastClickedSpecialPic=Date.now();
				if (Game.prefs.particles)
				{
					Game.particleAdd(Game.mouseX,Game.mouseY-32,Math.random()*4-2,Math.random()*-2-4,Math.random()*0.2+0.5,1,2,[20,3]);
				}
				if (Game.dragonLevel>=8 && Math.random()<1/20)
				{
					Math.seedrandom(Game.seed+'/dragonTime');
					var drops=['Dragon scale','Dragon claw','Dragon fang','Dragon teddy bear'];
					drops=shuffle(drops);
					var drop=drops[Math.floor((new Date().getMinutes()/60)*drops.length)];
					if (!Game.Has(drop) && !Game.HasUnlocked(drop))
					{
						Game.Unlock(drop);
						Game.Notify(drop,'<b>'+loc("Your dragon dropped something!")+'</b>',Game.Upgrades[drop].icon);
					}
					Math.seedrandom();
				}
			}
		}
		
		Game.ToggleSpecialMenu=function(on)
		{
			if (on)
			{
				var pic='';
				var frame=0;
				if (Game.specialTab=='santa') {pic='santa.webp';frame=Game.santaLevel;}
				else if (Game.specialTab=='dragon') {pic='dragon.webp?v='+Game.version;frame=Game.dragonLevels[Game.dragonLevel].pic;}
				else {pic='dragon.webp?v='+Game.version;frame=4;}
				
				var str='<div id="specialPic" '+Game.clickStr+'="Game.ClickSpecialPic();" style="'+((Game.specialTab=='dragon' && Game.dragonLevel>=4 && Game.Has('Pet the dragon'))?'cursor:pointer;':'')+'position:absolute;left:-16px;top:-64px;width:96px;height:96px;background:url(img/'+pic+');background-position:'+(-frame*96)+'px 0px;filter:drop-shadow(0px 3px 2px #000);-webkit-filter:drop-shadow(0px 3px 2px #000);"></div>';
				str+='<div class="close" onclick="PlaySound(\'snd/press.mp3\');Game.ToggleSpecialMenu(0);">x</div>';
				
				if (Game.specialTab=='santa')
				{
					var moni=Math.pow(Game.santaLevel+1,Game.santaLevel+1);
					
					str+='<h3 style="pointer-events:none;">'+Game.santaLevels[Game.santaLevel]+'</h3>';
					if (Game.santaLevel<14)
					{
						str+='<div class="line"></div>'+
						'<div class="optionBox" style="margin-bottom:0px;"><a class="option framed large title" '+Game.clickStr+'="Game.UpgradeSanta();">'+
							'<div style="display:table-cell;vertical-align:middle;">'+loc("Evolve")+'</div>'+
							'<div style="display:table-cell;vertical-align:middle;padding:4px 12px;">|</div>'+
							'<div style="display:table-cell;vertical-align:middle;font-size:65%;">'+loc("sacrifice %1",'<div'+(Game.cookies>moni?'':' style="color:#777;"')+'>'+loc("%1 cookie",LBeautify(Math.pow(Game.santaLevel+1,Game.santaLevel+1)))+'</div>')+'</div>'+
						'</a></div>';
					}
				}
				else if (Game.specialTab=='dragon')
				{
					var level=Game.dragonLevels[Game.dragonLevel];
				
					str+='<h3 style="pointer-events:none;">'+level.name+'</h3>';
					
					if (Game.dragonLevel>=5)
					{
						var icon=Game.dragonAuras[Game.dragonAura].pic;
						str+='<div class="crate enabled" style="opacity:1;position:absolute;right:18px;top:-58px;'+writeIcon(icon)+'" '+Game.clickStr+'="PlaySound(\'snd/tick.mp3\');Game.SelectDragonAura(0);" '+Game.getTooltip(
							'<div style="min-width:200px;text-align:center;" id="tooltipDragonAuraSelect"><h4>'+Game.dragonAuras[Game.dragonAura].dname+'</h4>'+
							'<div class="line"></div>'+
							Game.dragonAuras[Game.dragonAura].desc+
							'</div>'
						,'top')+
						'></div>';
					}
					if (Game.dragonLevel>=26)//2nd aura slot; increased with last building (cortex baker)
					{
						var icon=Game.dragonAuras[Game.dragonAura2].pic;
						str+='<div class="crate enabled" style="opacity:1;position:absolute;right:80px;top:-58px;'+writeIcon(icon)+'" '+Game.clickStr+'="PlaySound(\'snd/tick.mp3\');Game.SelectDragonAura(1);" '+Game.getTooltip(
							'<div style="min-width:200px;text-align:center;" id="tooltipDragonAuraSelect2"><h4>'+Game.dragonAuras[Game.dragonAura2].dname+'</h4>'+
							'<div class="line"></div>'+
							Game.dragonAuras[Game.dragonAura2].desc+
							'</div>'
						,'top')+
						'></div>';
					}
					
					if (Game.dragonLevel<Game.dragonLevels.length-1)
					{
						str+='<div class="line"></div>'+
						'<div class="optionBox" style="margin-bottom:0px;"><a class="option framed large title" '+Game.clickStr+'="Game.UpgradeDragon();">'+
							'<div style="display:table-cell;vertical-align:middle;">'+level.action+'</div>'+
							'<div style="display:table-cell;vertical-align:middle;padding:4px 12px;">|</div>'+
							'<div style="display:table-cell;vertical-align:middle;font-size:65%;">'+loc("sacrifice %1",'<div'+(level.cost()?'':' style="color:#777;"')+'>'+level.costStr()+'</div>')+'</div>'+
						'</a></div>';
					}
					else
					{
						str+='<div class="line"></div>'+
						'<div style="text-align:center;margin-bottom:4px;">'+level.action+'</div>';
					}
				}
				
				l('specialPopup').innerHTML=str;
				
				l('specialPopup').className='framed prompt onScreen';
			}
			else
			{
				if (Game.specialTab!='')
				{
					Game.specialTab='';
					l('specialPopup').className='framed prompt offScreen';
					setTimeout(function(){if (Game.specialTab=='') {/*l('specialPopup').style.display='none';*/l('specialPopup').innerHTML='';}},1000*0.2);
				}
			}
		}
		Game.DrawSpecial=function()
		{
			var len=Game.specialTabs.length;
			if (len==0) return;
			Game.LeftBackground.globalAlpha=1;
			var y=Game.LeftBackground.canvas.height-24-48*len;
			var tabI=0;
			
			for (var i in Game.specialTabs)
			{
				var selected=0;
				var hovered=0;
				if (Game.specialTab==Game.specialTabs[i]) selected=1;
				if (Game.specialTabHovered==Game.specialTabs[i]) hovered=1;
				var x=24;
				var s=1;
				var pic='';
				var frame=0;
				if (hovered) {s=1;x=24;}
				if (selected) {s=1;x=48;}
				
				if (Game.specialTabs[i]=='santa') {pic='santa.webp';frame=Game.santaLevel;}
				else if (Game.specialTabs[i]=='dragon') {pic='dragon.webp?v='+Game.version;frame=Game.dragonLevels[Game.dragonLevel].pic;}
				else {pic='dragon.webp?v='+Game.version;frame=4;}
				
				if (hovered || selected)
				{
					var ss=s*64;
					var r=Math.floor((Game.T*0.5)%360);
					Game.LeftBackground.save();
					Game.LeftBackground.translate(x,y);
					if (Game.prefs.fancy) Game.LeftBackground.rotate((r/360)*Math.PI*2);
					Game.LeftBackground.globalAlpha=0.75;
					Game.LeftBackground.drawImage(Pic('shine.webp'),-ss/2,-ss/2,ss,ss);
					Game.LeftBackground.restore();
				}
				
				if (Game.prefs.fancy) Game.LeftBackground.drawImage(Pic(pic),96*frame,0,96,96,(x+(selected?0:Math.sin(Game.T*0.2+tabI)*3)-24*s),(y-(selected?6:Math.abs(Math.cos(Game.T*0.2+tabI))*6)-24*s),48*s,48*s);
				else Game.LeftBackground.drawImage(Pic(pic),96*frame,0,96,96,(x-24*s),(y-24*s),48*s,48*s);
				
				tabI++;
				y+=48;
			}
			
		}
		
		/*=====================================================================================
		VISUAL EFFECTS
		=======================================================================================*/
		
		Game.AllMilks=[
			{name:'Automatic',icon:[0,7],type:-1,pic:'milkPlain'},
			{name:'Plain milk',icon:[1,8],type:0,pic:'milkPlain'},
			{name:'Chocolate milk',icon:[2,8],type:0,pic:'milkChocolate'},
			{name:'Raspberry milk',icon:[3,8],type:0,pic:'milkRaspberry'},
			{name:'Orange milk',icon:[4,8],type:0,pic:'milkOrange'},
			{name:'Caramel milk',icon:[5,8],type:0,pic:'milkCaramel'},
			{name:'Banana milk',icon:[6,8],type:0,pic:'milkBanana'},
			{name:'Lime milk',icon:[7,8],type:0,pic:'milkLime'},
			{name:'Blueberry milk',icon:[8,8],type:0,pic:'milkBlueberry'},
			{name:'Strawberry milk',icon:[9,8],type:0,pic:'milkStrawberry'},
			{name:'Vanilla milk',icon:[10,8],type:0,pic:'milkVanilla'},
			{name:'Zebra milk',icon:[10,7],type:1,pic:'milkZebra'},
			{name:'Cosmic milk',icon:[9,7],type:1,pic:'milkStars'},
			{name:'Flaming milk',icon:[8,7],type:1,pic:'milkFire'},
			{name:'Sanguine milk',icon:[7,7],type:1,pic:'milkBlood'},
			{name:'Midas milk',icon:[6,7],type:1,pic:'milkGold'},
			{name:'Midnight milk',icon:[5,7],type:1,pic:'milkBlack'},
			{name:'Green inferno milk',icon:[4,7],type:1,pic:'milkGreenFire'},
			{name:'Frostfire milk',icon:[3,7],type:1,pic:'milkBlueFire'},
			{name:'Honey milk',icon:[21,23],type:0,pic:'milkHoney'},
			{name:'Coffee milk',icon:[22,23],type:0,pic:'milkCoffee'},
			{name:'Tea milk',icon:[23,23],type:0,pic:'milkTea'},
			{name:'Coconut milk',icon:[24,23],type:0,pic:'milkCoconut'},
			{name:'Cherry milk',icon:[25,23],type:0,pic:'milkCherry'},
			{name:'Soy milk',icon:[27,23],type:1,pic:'milkSoy'},
			{name:'Spiced milk',icon:[26,23],type:0,pic:'milkSpiced'},
			{name:'Maple milk',icon:[28,23],type:0,pic:'milkMaple'},
			{name:'Mint milk',icon:[29,23],type:0,pic:'milkMint'},
			{name:'Licorice milk',icon:[30,23],type:0,pic:'milkLicorice'},
			{name:'Rose milk',icon:[31,23],type:0,pic:'milkRose'},
			{name:'Dragonfruit milk',icon:[21,24],type:0,pic:'milkDragonfruit'},
			{name:'Melon milk',icon:[22,24],type:0,pic:'milkMelon'},
			{name:'Blackcurrant milk',icon:[23,24],type:0,pic:'milkBlackcurrant'},
		];
		
		Game.Milks=[];
		for (var i=0;i<Game.AllMilks.length;i++)
		{
			Game.AllMilks[i].bname=Game.AllMilks[i].name;
			Game.AllMilks[i].name=loc(Game.AllMilks[i].name);
			Game.AllMilks[i].pic+='.webp';
			if (Game.AllMilks[i].type==0)
			{
				Game.AllMilks[i].rank=Game.Milks.length;
				Game.Milks.push(Game.AllMilks[i]);
			}
		}
		Game.Milk=Game.Milks[0];
		
		Game.mousePointer=0;//when 1, draw the mouse as a pointer on the left screen
		
		Game.cookieOriginX=0;
		Game.cookieOriginY=0;
		Game.DrawBackground=function()
		{
			
			Timer.clean();
			//background
			if (!Game.Background)//init some stuff
			{
				Game.Background=l('backgroundCanvas').getContext('2d');
				Game.Background.canvas.width=Game.Background.canvas.parentNode.offsetWidth;
				Game.Background.canvas.height=Game.Background.canvas.parentNode.offsetHeight;
				Game.LeftBackground=l('backgroundLeftCanvas').getContext('2d');
				Game.LeftBackground.canvas.width=Game.LeftBackground.canvas.parentNode.offsetWidth;
				Game.LeftBackground.canvas.height=Game.LeftBackground.canvas.parentNode.offsetHeight;
					//preload ascend animation bits so they show up instantly
					Game.LeftBackground.globalAlpha=0;
					Game.LeftBackground.drawImage(Pic('brokenCookie.webp'),0,0);
					Game.LeftBackground.drawImage(Pic('brokenCookieHalo.webp'),0,0);
					Game.LeftBackground.drawImage(Pic('starbg.webp'),0,0);
				
				window.addEventListener('resize',function(event)
				{
					Game.Background.canvas.width=Game.Background.canvas.parentNode.offsetWidth;
					Game.Background.canvas.height=Game.Background.canvas.parentNode.offsetHeight;
					Game.LeftBackground.canvas.width=Game.LeftBackground.canvas.parentNode.offsetWidth;
					Game.LeftBackground.canvas.height=Game.LeftBackground.canvas.parentNode.offsetHeight;
				});
			}
			
			var ctx=Game.LeftBackground;
			
			if (Game.OnAscend)
			{
				Timer.clean();
				//starry background on ascend screen
				var w=Game.Background.canvas.width;
				var h=Game.Background.canvas.height;
				var b=Game.ascendl.getBounds();
				var x=(b.left+b.right)/2;
				var y=(b.top+b.bottom)/2;
				Game.Background.globalAlpha=0.5;
				var s=1*Game.AscendZoom*(1+Math.cos(Game.T*0.0027)*0.05);
				Game.Background.fillPattern(Pic('starbg.webp'),0,0,w,h,1024*s,1024*s,x+Game.AscendOffX*0.25*s,y+Game.AscendOffY*0.25*s);
				Timer.track('star layer 1');
				if (Game.prefs.fancy)
				{
					//additional star layer
					Game.Background.globalAlpha=0.5*(0.5+Math.sin(Game.T*0.02)*0.3);
					var s=2*Game.AscendZoom*(1+Math.sin(Game.T*0.002)*0.07);
					//Game.Background.globalCompositeOperation='lighter';
					Game.Background.fillPattern(Pic('starbg.webp'),0,0,w,h,1024*s,1024*s,x+Game.AscendOffX*0.25*s,y+Game.AscendOffY*0.25*s);
					//Game.Background.globalCompositeOperation='source-over';
					Timer.track('star layer 2');
					
					x=x+Game.AscendOffX*Game.AscendZoom;
					y=y+Game.AscendOffY*Game.AscendZoom;
					//wispy nebula around the center
					Game.Background.save();
					Game.Background.globalAlpha=0.5;
					Game.Background.translate(x,y);
					Game.Background.globalCompositeOperation='lighter';
					Game.Background.rotate(Game.T*0.001);
					s=(600+150*Math.sin(Game.T*0.007))*Game.AscendZoom;
					Game.Background.drawImage(Pic('heavenRing1.webp'),-s/2,-s/2,s,s);
					Game.Background.rotate(-Game.T*0.0017);
					s=(600+150*Math.sin(Game.T*0.0037))*Game.AscendZoom;
					Game.Background.drawImage(Pic('heavenRing2.webp'),-s/2,-s/2,s,s);
					Game.Background.restore();
					Timer.track('nebula');
					
					//Game.Background.drawImage(Pic('shadedBorders.webp'),0,0,w,h);
					//Timer.track('border');
				}
			}
			else
			{
			
				var goodBuff=0;
				var badBuff=0;
				for (var i in Game.buffs)
				{
					if (Game.buffs[i].aura==1) goodBuff=1;
					if (Game.buffs[i].aura==2) badBuff=1;
				}
				
				if (Game.drawT%5==0)
				{
					if (false && Game.bgType!=0 && Game.ascensionMode!=1)
					{
						//l('backgroundCanvas').style.background='url(img/shadedBordersSoft.webp) 0px 0px,url(img/bgWheat.webp) 50% 50%';
						//l('backgroundCanvas').style.backgroundSize='100% 100%,cover';
					}
					else
					{
						l('backgroundCanvas').style.background='transparent';
						Game.defaultBg='bgBlue';
						Game.bgR=0;
						
						if (Game.season=='fools') Game.defaultBg='bgMoney';
						if (Game.elderWrathD<1 || Game.prefs.notScary)
						{
							Game.bgR=0;
							Game.bg=Game.defaultBg;
							Game.bgFade=Game.defaultBg;
						}
						else if (Game.elderWrathD>=1 && Game.elderWrathD<2)
						{
							Game.bgR=(Game.elderWrathD-1)/1;
							Game.bg=Game.defaultBg;
							Game.bgFade='grandmas1';
						}
						else if (Game.elderWrathD>=2 && Game.elderWrathD<3)
						{
							Game.bgR=(Game.elderWrathD-2)/1;
							Game.bg='grandmas1';
							Game.bgFade='grandmas2';
						}
						else if (Game.elderWrathD>=3)// && Game.elderWrathD<4)
						{
							Game.bgR=(Game.elderWrathD-3)/1;
							Game.bg='grandmas2';
							Game.bgFade='grandmas3';
						}
						
						if (Game.bgType!=0 && Game.ascensionMode!=1)
						{
							Game.bgR=0;
							Game.bg=Game.BGsByChoice[Game.bgType].pic;
							Game.bgFade=Game.bg;
						}
						
						Game.Background.fillPattern(Pic(Game.bg+'.webp'),0,0,Game.Background.canvas.width,Game.Background.canvas.height,512,512,0,0);
						if (Game.bgR>0)
						{
							Game.Background.globalAlpha=Game.bgR;
							Game.Background.fillPattern(Pic(Game.bgFade+'.webp'),0,0,Game.Background.canvas.width,Game.Background.canvas.height,512,512,0,0);
						}
						Game.Background.globalAlpha=1;
						Game.Background.drawImage(Pic('shadedBordersSoft.webp'),0,0,Game.Background.canvas.width,Game.Background.canvas.height);
					}
					
				}
				Timer.track('window background');
				
				//clear
				ctx.clearRect(0,0,ctx.canvas.width,ctx.canvas.height);
				/*if (Game.AscendTimer<Game.AscendBreakpoint) ctx.clearRect(0,0,ctx.canvas.width,ctx.canvas.height);
				else
				{
					ctx.globalAlpha=0.05;
					ctx.fillStyle='#000';
					ctx.fillRect(0,0,ctx.canvas.width,ctx.canvas.height);
					ctx.globalAlpha=1;
					OldCanvasDrawImage.apply(ctx,[ctx.canvas,Math.random()*4-2,Math.random()*4-2-4]);
					ctx.globalAlpha=1;
				}*/
				Timer.clean();
				
				var showDragon=0;
				if (Game.hasBuff('Dragonflight') || Game.hasBuff('Dragon Harvest')) showDragon=1;
				
				Game.cookieOriginX=Math.floor(ctx.canvas.width/2);
				Game.cookieOriginY=Math.floor(ctx.canvas.height*0.4);
				
				if (Game.AscendTimer==0)
				{	
					if (Game.prefs.particles)
					{
						//falling cookies
						var pic='';
						var opacity=1;
						if (Game.elderWrathD<=1.5 || Game.prefs.notScary)
						{
							if (Game.cookiesPs>=1000) pic='cookieShower3.webp';
							else if (Game.cookiesPs>=500) pic='cookieShower2.webp';
							else if (Game.cookiesPs>=50) pic='cookieShower1.webp';
							else pic='';
						}
						if (pic!='')
						{
							if (Game.elderWrathD>=1 && !Game.prefs.notScary) opacity=1-((Math.min(Game.elderWrathD,1.5)-1)/0.5);
							ctx.globalAlpha=opacity;
							var y=(Math.floor(Game.T*2)%512);
							ctx.fillPattern(Pic(pic),0,0,ctx.canvas.width,ctx.canvas.height+512,512,512,0,y);
							ctx.globalAlpha=1;
						}
						//snow
						if (Game.season=='christmas')
						{
							var y=(Math.floor(Game.T*2.5)%512);
							ctx.globalAlpha=0.75;
							ctx.globalCompositeOperation='lighter';
							ctx.fillPattern(Pic('snow2.webp'),0,0,ctx.canvas.width,ctx.canvas.height+512,512,512,0,y);
							ctx.globalCompositeOperation='source-over';
							ctx.globalAlpha=1;
						}
						//hearts
						if (Game.season=='valentines')
						{
							var y=(Math.floor(Game.T*2.5)%512);
							ctx.globalAlpha=1;
							ctx.fillPattern(Pic('heartStorm.webp'),0,0,ctx.canvas.width,ctx.canvas.height+512,512,512,0,y);
							ctx.globalAlpha=1;
						}
						Timer.track('left background');
						
						Game.particlesDraw(0);
						ctx.globalAlpha=1;
						Timer.track('particles');
						
						//big cookie shine
						var s=512;
						
						var x=Game.cookieOriginX;
						var y=Game.cookieOriginY;
						
						var r=Math.floor((Game.T*0.5)%360);
						ctx.save();
						ctx.translate(x,y);
						ctx.rotate((r/360)*Math.PI*2);
						var alphaMult=1;
						if (Game.bgType==2 || Game.bgType==4) alphaMult=0.5;
						var pic='shine.webp';
						if (goodBuff) {pic='shineGold.webp';alphaMult=1;}
						else if (badBuff) {pic='shineRed.webp';alphaMult=1;}
						if (goodBuff && Game.prefs.fancy) ctx.globalCompositeOperation='lighter';
						ctx.globalAlpha=0.5*alphaMult;
						ctx.drawImage(Pic(pic),-s/2,-s/2,s,s);
						ctx.rotate((-r*2/360)*Math.PI*2);
						ctx.globalAlpha=0.25*alphaMult;
						ctx.drawImage(Pic(pic),-s/2,-s/2,s,s);
						ctx.restore();
						Timer.track('shine');
				
						if (Game.ReincarnateTimer>0)
						{
							ctx.globalAlpha=1-Game.ReincarnateTimer/Game.ReincarnateDuration;
							ctx.fillStyle='#000';
							ctx.fillRect(0,0,ctx.canvas.width,ctx.canvas.height);
							ctx.globalAlpha=1;
						}
						
						if (showDragon)
						{
							//big dragon
							var s=300*2*(1+Math.sin(Game.T*0.013)*0.1);
							var x=Game.cookieOriginX-s/2;
							var y=Game.cookieOriginY-s/(1.4+0.2*Math.sin(Game.T*0.01));
							ctx.drawImage(Pic('dragonBG.webp'),x,y,s,s);
						}
						
						//big cookie
						if (false)//don't do that
						{
							ctx.globalAlpha=1;
							var amount=Math.floor(Game.cookies).toString();
							var digits=amount.length;
							var space=0;
							for (var i=0;i<digits;i++)
							{
								var s=16*(digits-i);
								var num=parseInt(amount[i]);
								if (i>0) space-=s*(1-num/10)/2;
								if (i==0 && num>1) space+=s*0.1;
								for (var ii=0;ii<num;ii++)
								{
									var x=Game.cookieOriginX;
									var y=Game.cookieOriginY;
									var spin=Game.T*(0.005+i*0.001)+i+(ii/num)*Math.PI*2;
									x+=Math.sin(spin)*space;
									y+=Math.cos(spin)*space;
									ctx.drawImage(Pic('perfectCookie.webp'),x-s/2,y-s/2,s,s);
								}
								space+=s/2;
							}
						}
						else
						{
							ctx.globalAlpha=1;
							var s=256*Game.BigCookieSize;
							var x=Game.cookieOriginX;
							var y=Game.cookieOriginY;
							ctx.save();
							if (Game.prefs.fancy) ctx.drawImage(Pic('cookieShadow.webp'),x-s/2,y-s/2+20,s,s);
							ctx.translate(x,y);
							if (Game.season=='easter')
							{
								var nestW=304*0.98*Game.BigCookieSize;
								var nestH=161*0.98*Game.BigCookieSize;
								ctx.drawImage(Pic('nest.webp'),-nestW/2,-nestH/2+130,nestW,nestH);
							}
							//ctx.rotate(((Game.startDate%360)/360)*Math.PI*2);
							ctx.drawImage(Pic('perfectCookie.webp'),-s/2,-s/2,s,s);
							
							if (goodBuff && Game.prefs.particles)//sparkle
							{
								ctx.globalCompositeOperation='lighter';
								for (var i=0;i<1;i++)
								{
									ctx.globalAlpha=Math.random()*0.65+0.1;
									var size=Math.random()*30+5;
									var a=Math.random()*Math.PI*2;
									var d=s*0.9*Math.random()/2;
									ctx.drawImage(Pic('glint.webp'),-size/2+Math.sin(a)*d,-size/2+Math.cos(a)*d,size,size);
								}
							}
							
							ctx.restore();
							Timer.track('big cookie');
						}
					}
					else//no particles
					{
						//big cookie shine
						var s=512;
						var x=Game.cookieOriginX-s/2;
						var y=Game.cookieOriginY-s/2;
						ctx.globalAlpha=0.5;
						ctx.drawImage(Pic('shine.webp'),x,y,s,s);
						
						if (showDragon)
						{
							//big dragon
							var s=300*2*(1+Math.sin(Game.T*0.013)*0.1);
							var x=Game.cookieOriginX-s/2;
							var y=Game.cookieOriginY-s/(1.4+0.2*Math.sin(Game.T*0.01));
							ctx.drawImage(Pic('dragonBG.webp'),x,y,s,s);
						}
					
						//big cookie
						ctx.globalAlpha=1;
						var s=256*Game.BigCookieSize;
						var x=Game.cookieOriginX-s/2;
						var y=Game.cookieOriginY-s/2;
						if (Game.prefs.fancy) ctx.drawImage(Pic('cookieShadow.webp'),x,y+20,s,s);
						ctx.drawImage(Pic('perfectCookie.webp'),x,y,s,s);
					}
					
					//cursors
					if (Game.prefs.cursors)
					{
						ctx.save();
						ctx.translate(Game.cookieOriginX,Game.cookieOriginY);
						var pic=Pic('cursor.webp');
						var fancy=Game.prefs.fancy;
						
						if (showDragon) ctx.globalAlpha=0.25;
						var amount=Game.Objects['Cursor'].amount;
						//var spe=-1;
						for (var i=0;i<amount;i++)
						{
							var n=Math.floor(i/50);
							//var a=((i+0.5*n)%50)/50;
							var w=0;
							if (fancy) w=(Math.sin(Game.T*0.025+(((i+n*12)%25)/25)*Math.PI*2));
							if (w>0.997) w=1.5;
							else if (w>0.994) w=0.5;
							else w=0;
							w*=-4;
							if (fancy) w+=Math.sin((n+Game.T*0.01)*Math.PI/2)*4;
							var x=0;
							var y=(140/* *Game.BigCookieSize*/+n*16+w)-16;
							
							var rot=7.2;//(1/50)*360
							if (i==0 && fancy) rot-=Game.T*0.1;
							if (i%50==0) rot+=7.2/2;
							ctx.rotate((rot/360)*Math.PI*2);
							ctx.drawImage(pic,0,0,32,32,x,y,32,32);
							//ctx.drawImage(pic,32*(i==spe),0,32,32,x,y,32,32);
							
							/*if (i==spe)
							{
								y+=16;
								x=Game.cookieOriginX+Math.sin(-((r-5)/360)*Math.PI*2)*y;
								y=Game.cookieOriginY+Math.cos(-((r-5)/360)*Math.PI*2)*y;
								if (Game.CanClick && ctx && Math.abs(Game.mouseX-x)<16 && Math.abs(Game.mouseY-y)<16) Game.mousePointer=1;
							}*/
						}
						ctx.restore();
						Timer.track('cursors');
					}
				}
				else
				{
					var tBase=Math.max(0,(Game.AscendTimer-Game.AscendBreakpoint)/(Game.AscendDuration-Game.AscendBreakpoint));
					//big crumbling cookie
					//var t=(3*Math.pow(tBase,2)-2*Math.pow(tBase,3));//S curve
					var t=Math.pow(tBase,0.5);
					
					var shake=0;
					if (Game.AscendTimer<Game.AscendBreakpoint) {shake=Game.AscendTimer/Game.AscendBreakpoint;}
					//else {shake=1-t;}

					ctx.globalAlpha=1;
					
					var x=Game.cookieOriginX;
					var y=Game.cookieOriginY;
					
					x+=(Math.random()*2-1)*10*shake;
					y+=(Math.random()*2-1)*10*shake;
					
					var s=1;
					if (tBase>0)
					{
						ctx.save();
						ctx.globalAlpha=1-Math.pow(t,0.5);
						ctx.translate(x,y);
						ctx.globalCompositeOperation='lighter';
						ctx.rotate(Game.T*0.007);
						s=0.5+Math.pow(tBase,0.6)*1;
						var s2=(600)*s;
						ctx.drawImage(Pic('heavenRing1.webp'),-s2/2,-s2/2,s2,s2);
						ctx.rotate(-Game.T*0.002);
						s=0.5+Math.pow(1-tBase,0.4)*1;
						s2=(600)*s;
						ctx.drawImage(Pic('heavenRing2.webp'),-s2/2,-s2/2,s2,s2);
						ctx.restore();
					}
					
					s=256;//*Game.BigCookieSize;
					
					ctx.save();
					ctx.translate(x,y);
					ctx.rotate((t*(-0.1))*Math.PI*2);
					
					var chunks={0:7,1:6,2:3,3:2,4:8,5:1,6:9,7:5,8:0,9:4};
					s*=t/2+1;
					/*ctx.globalAlpha=(1-t)*0.33;
					for (var i=0;i<10;i++)
					{
						var d=(t-0.2)*(80+((i+2)%3)*40);
						ctx.drawImage(Pic('brokenCookie.webp'),256*(chunks[i]),0,256,256,-s/2+Math.sin(-(((chunks[i]+4)%10)/10)*Math.PI*2)*d,-s/2+Math.cos(-(((chunks[i]+4)%10)/10)*Math.PI*2)*d,s,s);
					}
					ctx.globalAlpha=(1-t)*0.66;
					for (var i=0;i<10;i++)
					{
						var d=(t-0.1)*(80+((i+2)%3)*40);
						ctx.drawImage(Pic('brokenCookie.webp'),256*(chunks[i]),0,256,256,-s/2+Math.sin(-(((chunks[i]+4)%10)/10)*Math.PI*2)*d,-s/2+Math.cos(-(((chunks[i]+4)%10)/10)*Math.PI*2)*d,s,s);
					}*/
					ctx.globalAlpha=1-t;
					for (var i=0;i<10;i++)
					{
						var d=(t)*(80+((i+2)%3)*40);
						var x2=(Math.random()*2-1)*5*shake;
						var y2=(Math.random()*2-1)*5*shake;
						ctx.drawImage(Pic('brokenCookie.webp'),256*(chunks[i]),0,256,256,-s/2+Math.sin(-(((chunks[i]+4)%10)/10)*Math.PI*2)*d+x2,-s/2+Math.cos(-(((chunks[i]+4)%10)/10)*Math.PI*2)*d+y2,s,s);
					}
					var brokenHalo=1-Math.min(t/(1/3),1/3)*3;
					if (Game.AscendTimer<Game.AscendBreakpoint) brokenHalo=Game.AscendTimer/Game.AscendBreakpoint;
					ctx.globalAlpha=brokenHalo;
					ctx.drawImage(Pic('brokenCookieHalo.webp'),-s/1.3333,-s/1.3333,s*1.5,s*1.5);
					
					ctx.restore();
					
					//flares
					var n=9;
					var t=Game.AscendTimer/Game.AscendBreakpoint;
					if (Game.AscendTimer<Game.AscendBreakpoint)
					{
						ctx.save();
						ctx.translate(x,y);
						for (var i=0;i<n;i++)
						{
							if (Math.floor(t/3*n*3+i*2.7)%2)
							{
								var t2=Math.pow((t/3*n*3+i*2.7)%1,1.5);
								ctx.globalAlpha=(1-t)*(Game.drawT%2==0?0.5:1);
								var sw=(1-t2*0.5)*96;
								var sh=(0.5+t2*1.5)*96;
								ctx.drawImage(Pic('shineSpoke.webp'),-sw/2,-sh-32-(1-t2)*256,sw,sh);
							}
							ctx.rotate(Math.PI*2/n);
						}
						ctx.restore();
					}
					
					
					//flash at breakpoint
					if (tBase<0.1 && tBase>0)
					{
						ctx.globalAlpha=1-tBase/0.1;
						ctx.fillStyle='#fff';
						ctx.fillRect(0,0,ctx.canvas.width,ctx.canvas.height);
						ctx.globalAlpha=1;
					}
					if (tBase>0.8)
					{
						ctx.globalAlpha=(tBase-0.8)/0.2;
						ctx.fillStyle='#000';
						ctx.fillRect(0,0,ctx.canvas.width,ctx.canvas.height);
						ctx.globalAlpha=1;
					}
				}
				
				//milk and milk accessories
				if (Game.prefs.milk)
				{
					var width=ctx.canvas.width;
					var height=ctx.canvas.height;
					var x=Math.floor((Game.T*2-(Game.milkH-Game.milkHd)*2000+480*2)%480);//Math.floor((Game.T*2+Math.sin(Game.T*0.1)*2+Math.sin(Game.T*0.03)*2-(Game.milkH-Game.milkHd)*2000+480*2)%480);
					var y=(Game.milkHd)*height;//(((Game.milkHd)*ctx.canvas.height)*(1+0.05*(Math.sin(Game.T*0.017)/2+0.5)));
					var a=1;
					if (Game.AscendTimer>0)
					{
						y*=1-Math.pow((Game.AscendTimer/Game.AscendBreakpoint),2)*2;
						a*=1-Math.pow((Game.AscendTimer/Game.AscendBreakpoint),2)*2;
					}
					else if (Game.ReincarnateTimer>0)
					{
						y*=1-Math.pow(1-(Game.ReincarnateTimer/Game.ReincarnateDuration),2)*2;
						a*=1-Math.pow(1-(Game.ReincarnateTimer/Game.ReincarnateDuration),2)*2;
					}
					
					if (Game.TOYS)
					{
						//golly
						if (!Game.Toy)
						{
							Game.toys=[];
							Game.toysType=choose([1,2]);
							Game.Toy=function(x,y)
							{
								this.id=Game.toys.length;
								this.x=x;
								this.y=y;
								this.xd=Math.random()*10-5;
								this.yd=Math.random()*10-5;
								this.r=Math.random()*Math.PI*2;
									this.rd=Math.random()*0.1-0.05;
									var v=Math.random();var a=0.5;var b=0.5;
									if (v<=a) v=b-b*Math.pow(1-v/a,3); else v=b+(1-b)*Math.pow((v-a)/(1-a),3);
								this.s=(Game.toysType==1?64:48)*(0.1+v*1.9);
								if (Game.toysType==2) this.s=(this.id%10==1)?96:48;
								this.st=this.s;this.s=0;
									var cookies=[[10,0]];
									for (var i in Game.Upgrades)
									{
										var cookie=Game.Upgrades[i];
										if (cookie.bought>0 && cookie.pool=='cookie') cookies.push(cookie.icon);
									}
								this.icon=choose(cookies);
								this.dragged=false;
								this.l=document.createElement('div');
								this.l.innerHTML=this.id;
								this.l.style.cssText='cursor:pointer;border-radius:'+(this.s/2)+'px;opacity:0;width:'+this.s+'px;height:'+this.s+'px;background:#999;position:absolute;left:0px;top:0px;z-index:10000000;transform:translate(-1000px,-1000px);';
								l('sectionLeft').appendChild(this.l);
								AddEvent(this.l,'mousedown',function(what){return function(){what.dragged=true;};}(this));
								AddEvent(this.l,'mouseup',function(what){return function(){what.dragged=false;};}(this));
								Game.toys.push(this);
								return this;
							}
							for (var i=0;i<Math.floor(Math.random()*15+(Game.toysType==1?5:30));i++)
							{
								new Game.Toy(Math.random()*width,Math.random()*height*0.3);
							}
						}
						ctx.globalAlpha=0.5;
						for (var i in Game.toys)
						{
							var me=Game.toys[i];
							ctx.save();
							ctx.translate(me.x,me.y);
							ctx.rotate(me.r);
							if (Game.toysType==1) ctx.drawImage(Pic('smallCookies.webp'),(me.id%8)*64,0,64,64,-me.s/2,-me.s/2,me.s,me.s);
							else ctx.drawImage(Pic('icons.webp'),me.icon[0]*48,me.icon[1]*48,48,48,-me.s/2,-me.s/2,me.s,me.s);
							ctx.restore();
						}
						ctx.globalAlpha=1;
						for (var i in Game.toys)
						{
							var me=Game.toys[i];
							//psst... not real physics
							for (var ii in Game.toys)
							{
								var it=Game.toys[ii];
								if (it.id!=me.id)
								{
									var x1=me.x+me.xd;
									var y1=me.y+me.yd;
									var x2=it.x+it.xd;
									var y2=it.y+it.yd;
									var dist=Math.sqrt(Math.pow((x1-x2),2)+Math.pow((y1-y2),2))/(me.s/2+it.s/2);
									if (dist<(Game.toysType==1?0.95:0.75))
									{
										var angle=Math.atan2(y1-y2,x1-x2);
										var v1=Math.sqrt(Math.pow((me.xd),2)+Math.pow((me.yd),2));
										var v2=Math.sqrt(Math.pow((it.xd),2)+Math.pow((it.yd),2));
										var v=((v1+v2)/2+dist)*0.75;
										var ratio=it.s/me.s;
										me.xd+=Math.sin(-angle+Math.PI/2)*v*(ratio);
										me.yd+=Math.cos(-angle+Math.PI/2)*v*(ratio);
										it.xd+=Math.sin(-angle-Math.PI/2)*v*(1/ratio);
										it.yd+=Math.cos(-angle-Math.PI/2)*v*(1/ratio);
										me.rd+=(Math.random()*1-0.5)*0.1*(ratio);
										it.rd+=(Math.random()*1-0.5)*0.1*(1/ratio);
										me.rd*=Math.min(1,v);
										it.rd*=Math.min(1,v);
									}
								}
							}
							if (me.y>=height-(Game.milkHd)*height+8)
							{
								me.xd*=0.85;
								me.yd*=0.85;
								me.rd*=0.85;
								me.yd-=1;
								me.xd+=(Math.random()*1-0.5)*0.3;
								me.yd+=(Math.random()*1-0.5)*0.05;
								me.rd+=(Math.random()*1-0.5)*0.02;
							}
							else
							{
								me.xd*=0.99;
								me.rd*=0.99;
								me.yd+=1;
							}
							me.yd*=(Math.min(1,Math.abs(me.y-(height-(Game.milkHd)*height)/16)));
							me.rd+=me.xd*0.01/(me.s/(Game.toysType==1?64:48));
							if (me.x<me.s/2 && me.xd<0) me.xd=Math.max(0.1,-me.xd*0.6); else if (me.x<me.s/2) {me.xd=0;me.x=me.s/2;}
							if (me.x>width-me.s/2 && me.xd>0) me.xd=Math.min(-0.1,-me.xd*0.6); else if (me.x>width-me.s/2) {me.xd=0;me.x=width-me.s/2;}
							me.xd=Math.min(Math.max(me.xd,-30),30);
							me.yd=Math.min(Math.max(me.yd,-30),30);
							me.rd=Math.min(Math.max(me.rd,-0.5),0.5);
							me.x+=me.xd;
							me.y+=me.yd;
							me.r+=me.rd;
							me.r=me.r%(Math.PI*2);
							me.s+=(me.st-me.s)*0.5;
							if (Game.toysType==2 && !me.dragged && Math.random()<0.003) me.st=choose([48,48,48,48,96]);
							if (me.dragged)
							{
								me.x=Game.mouseX;
								me.y=Game.mouseY;
								me.xd+=((Game.mouseX-Game.mouseX2)*3-me.xd)*0.5;
								me.yd+=((Game.mouseY-Game.mouseY2)*3-me.yd)*0.5
								me.l.style.transform='translate('+(me.x-me.s/2)+'px,'+(me.y-me.s/2)+'px) scale(50)';
							}
							else me.l.style.transform='translate('+(me.x-me.s/2)+'px,'+(me.y-me.s/2)+'px)';
							me.l.style.width=me.s+'px';
							me.l.style.height=me.s+'px';
							ctx.save();
							ctx.translate(me.x,me.y);
							ctx.rotate(me.r);
							if (Game.toysType==1) ctx.drawImage(Pic('smallCookies.webp'),(me.id%8)*64,0,64,64,-me.s/2,-me.s/2,me.s,me.s);
							else ctx.drawImage(Pic('icons.webp'),me.icon[0]*48,me.icon[1]*48,48,48,-me.s/2,-me.s/2,me.s,me.s);
							ctx.restore();
						}
					}
					
					var pic=Game.Milk.pic;
					if (Game.milkType!=0 && Game.ascensionMode!=1) pic=Game.AllMilks[Game.milkType].pic;
					ctx.globalAlpha=0.95*a;
					ctx.fillPattern(Pic(pic),0,height-y,width+480,1,480,480,x,0);
					
					ctx.fillStyle='#000';
					ctx.fillRect(0,height-y+480,width,Math.max(0,(y-480)));
					ctx.globalAlpha=1;
					
					Timer.track('milk');
				}
				
				if (Game.AscendTimer>0)
				{
					ctx.drawImage(Pic('shadedBordersSoft.webp'),0,0,ctx.canvas.width,ctx.canvas.height);
				}
				
				if (Game.AscendTimer==0)
				{
					Game.DrawWrinklers();Timer.track('wrinklers');
					Game.DrawSpecial();Timer.track('evolvables');
					
					Game.particlesDraw(2);Timer.track('text particles');
					
					//shiny border during frenzies etc
					ctx.globalAlpha=1;
					var borders='shadedBordersSoft.webp';
					if (goodBuff) borders='shadedBordersGold.webp';
					else if (badBuff) borders='shadedBordersRed.webp';
					if (goodBuff && Game.prefs.fancy) ctx.globalCompositeOperation='lighter';
					ctx.drawImage(Pic(borders),0,0,ctx.canvas.width,ctx.canvas.height);
					if (goodBuff && Game.prefs.fancy) ctx.globalCompositeOperation='source-over';
				}
			}
		};
		
		
		/*=====================================================================================
		INITIALIZATION END; GAME READY TO LAUNCH
		=======================================================================================*/
		
		Game.killShimmers();
		
		//booooo
		Game.RuinTheFun=function(silent)
		{
			Game.popups=0;
			Game.SetAllUpgrades(1);
			Game.SetAllAchievs(1);
			Game.popups=0;
			Game.Earn(999999999999999999999999999999);
			Game.MaxSpecials();
			Game.nextResearch=0;
			Game.researchT=-1;
			Game.upgradesToRebuild=1;
			Game.recalculateGains=1;
			Game.popups=1;
			for (var i in Game.Objects)
			{
				var me=Game.Objects[i];
				if (me.level<10)
				{
					me.level=9;
					me.levelUp(true);
				}
				if (me.minigame && me.minigame.onRuinTheFun) me.minigame.onRuinTheFun();
			}
			if (!silent)
			{
				Game.Notify('Thou doth ruineth the fun!','You\'re free. Free at last.',[11,5]);
			}
			return 'You feel a bitter taste in your mouth...';
		}
		
		Game.SetAllUpgrades=function(on)
		{
			Game.popups=0;
			var leftout=['Magic shenanigans','Occult obstruction','Glucose-charged air'];
			for (var i in Game.Upgrades)
			{
				if (on && (Game.Upgrades[i].pool=='toggle' || leftout.indexOf(Game.Upgrades[i].name)!=-1)) {}
				else if (on) Game.Upgrades[i].earn();
				else if (!on) Game.Upgrades[i].lose();
			}
			Game.upgradesToRebuild=1;
			Game.recalculateGains=1;
			Game.popups=1;
		}
		Game.SetAllAchievs=function(on)
		{
			Game.popups=0;
			for (var i in Game.Achievements)
			{
				if (on && Game.Achievements[i].pool!='dungeon') Game.Win(Game.Achievements[i].name);
				else if (!on) Game.RemoveAchiev(Game.Achievements[i].name);
			}
			Game.recalculateGains=1;
			Game.popups=1;
		}
		Game.GetAllDebugs=function()
		{
			Game.popups=0;
			for (var i in Game.Upgrades)
			{
				if (Game.Upgrades[i].pool=='debug') Game.Upgrades[i].earn();
			}
			Game.upgradesToRebuild=1;
			Game.recalculateGains=1;
			Game.popups=1;
		}
		Game.MaxSpecials=function()
		{
			Game.dragonLevel=Game.dragonLevels.length-1;
			Game.santaLevel=Game.santaLevels.length-1;
		}
		
		Game.SesameReset=function()
		{
			var name=Game.bakeryName;
			Game.HardReset(2);
			Game.bakeryName=name;
			Game.bakeryNameRefresh();
			Game.Achievements['Cheated cookies taste awful'].won=1;
		}
		
		Game.debugTimersOn=0;
		Game.sesame=0;
		Game.OpenSesame=function()
		{
			var str='';
			str+='<div class="icon" style="position:absolute;left:-9px;top:-6px;background-position:'+(-10*48)+'px '+(-6*48)+'px;"></div>';
			str+='<div style="position:absolute;left:0px;top:0px;z-index:10;font-size:10px;background:#000;padding:1px;" id="fpsCounter"></div>';
			
			str+='<div id="devConsoleContent">';
			str+='<div class="title" style="font-size:14px;margin:6px;">Dev tools</div>';
			
			str+='<a class="option neato" '+Game.clickStr+'="Game.Ascend(1);">Ascend</a>';
			str+='<div class="line"></div>';
			str+='<a class="option neato" '+Game.clickStr+'="Game.cookies*=10;Game.cookiesEarned*=10;">x10</a>';
			str+='<a class="option neato" '+Game.clickStr+'="Game.cookies/=10;Game.cookiesEarned/=10;">/10</a><br>';
			str+='<a class="option neato" '+Game.clickStr+'="Game.cookies*=1000;Game.cookiesEarned*=1000;">x1k</a>';
			str+='<a class="option neato" '+Game.clickStr+'="Game.cookies/=1000;Game.cookiesEarned/=1000;">/1k</a><br>';
			str+='<a class="option neato" '+Game.clickStr+'="for (var i in Game.Objects){Game.Objects[i].buy(100);}">Buy 100 of all</a>';//for (var n=0;n<100;n++){for (var i in Game.Objects){Game.Objects[i].buy(1);}}
			str+='<a class="option neato" '+Game.clickStr+'="for (var i in Game.Objects){Game.Objects[i].sell(100);}">Sell 100 of all</a><br>';
			str+='<a class="option neato" '+Game.clickStr+'="Game.gainLumps(10);">+10 lumps</a>';
			str+='<a class="option neato" '+Game.clickStr+'="for (var i in Game.Objects){Game.Objects[i].level=0;Game.Objects[i].onMinigame=false;Game.Objects[i].refresh();}Game.recalculateGains=1;">Reset levels</a>';
			str+='<a class="option neato" '+Game.clickStr+'="Game.cookiesReset+=Game.HowManyCookiesReset((Game.heavenlyChips||1)*1000);Game.EarnHeavenlyChips(0,true);Game.recalculateGains=1;">HC x1k</a>';
			str+='<a class="option neato" '+Game.clickStr+'="Game.cookiesReset=(Game.heavenlyChips<100?0:Game.HowManyCookiesReset(Math.floor(Game.heavenlyChips*0.001)));Game.cookiesReset=Math.max(Game.cookiesReset,0);Game.EarnHeavenlyChips(0,true);if (Game.cookiesReset<=0){Game.heavenlyChips=0;}Game.recalculateGains=1;">HC /1k</a><br>';//wee bit inaccurate
			str+='<a class="option neato" '+Game.clickStr+'="Game.cookiesEarned=0;Game.recalculateGains=1;">Reset cookies earned</a><br>';
			str+='<div class="line"></div>';
			str+='<a class="option warning" '+Game.clickStr+'="Game.RuinTheFun(1);">Ruin The Fun</a>';
			str+='<a class="option warning" '+Game.clickStr+'="Game.SesameReset();">Wipe</a>';
			str+='<a class="option neato" '+Game.clickStr+'="Game.GetAllDebugs();">All debugs</a>';
			str+='<a class="option neato" '+Game.clickStr+'="Game.debugTimersOn=!Game.debugTimersOn;Game.OpenSesame();">Timers '+(Game.debugTimersOn?'On':'Off')+'</a><br>';
			str+='<a class="option neato" '+Game.clickStr+'="Game.SetAllUpgrades(0);">No upgrades</a>';
			str+='<a class="option neato" '+Game.clickStr+'="Game.SetAllUpgrades(1);">All upgrades</a><br>';
			str+='<a class="option neato" '+Game.clickStr+'="Game.SetAllAchievs(0);">No achievs</a>';
			str+='<a class="option neato" '+Game.clickStr+'="Game.SetAllAchievs(1);">All achievs</a><br>';
			str+='<a class="option neato" '+Game.clickStr+'="Game.santaLevel=0;Game.dragonLevel=0;">Reset specials</a>';
			str+='<a class="option neato" '+Game.clickStr+'="Game.MaxSpecials();">Max specials</a><br>';
			str+='<a class="option neato" '+Game.clickStr+'="Game.lumpRefill=0;/*Date.now()-Game.getLumpRefillMax();*/">Reset refills</a>';
			str+='<a class="option neato" '+Game.clickStr+'="Game.EditAscend();">'+(Game.DebuggingPrestige?'Exit Ascend Edit':'Ascend Edit')+'</a>';
			str+='<a class="option neato" '+Game.clickStr+'="Game.DebugUpgradeCpS();">Debug upgrades CpS</a>';
			str+='<a class="option neato" '+Game.clickStr+'="Game.seed=Game.makeSeed();">Re-seed</a>';
			str+='<a class="option neato" '+Game.clickStr+'="Game.heralds=100;l(\'heraldsAmount\').textContent=Game.heralds;Game.externalDataLoaded=true;Game.recalculateGains=1;">Max heralds</a>';
			str+='<div class="line"></div>';
			for (var i=0;i<Game.goldenCookieChoices.length/2;i++)
			{
				str+='<a class="option neato" '+Game.clickStr+'="var newShimmer=new Game.shimmer(\'golden\');newShimmer.force=\''+Game.goldenCookieChoices[i*2+1]+'\';">'+Game.goldenCookieChoices[i*2]+'</a>';
				//str+='<a class="option neato" '+Game.clickStr+'="Game.goldenCookie.force=\''+Game.goldenCookie.choices[i*2+1]+'\';Game.goldenCookie.spawn();">'+Game.goldenCookie.choices[i*2]+'</a>';
				//str+='<a class="option neato" '+Game.clickStr+'="Game.goldenCookie.click(0,\''+Game.goldenCookie.choices[i*2+1]+'\');">'+Game.goldenCookie.choices[i*2]+'</a>';
			}
			str+='</div>';
			
			l('devConsole').innerHTML=str;
			
			if (!l('fpsGraph'))
			{
				var div=document.createElement('canvas');
				div.id='fpsGraph';
				div.width=128;
				div.height=64;
				div.style.opacity=0.5;
				div.style.pointerEvents='none';
				div.style.transformOrigin='0% 0%';
				div.style.transform='scale(0.75)';
				//l('devConsole').appendChild(div);
				l('devConsole').parentNode.insertBefore(div,l('devConsole').nextSibling);
				Game.fpsGraph=div;
				Game.fpsGraphCtx=Game.fpsGraph.getContext('2d',{alpha:false});
				var ctx=Game.fpsGraphCtx;
				ctx.fillStyle='#000';
				ctx.fillRect(0,0,128,64);
			}
			
			l('debug').style.display='block';
			Game.sesame=1;
			Game.Achievements['Cheated cookies taste awful'].won=1;
		}
		
		Game.EditAscend=function()
		{
			if (!Game.DebuggingPrestige)
			{
				Game.DebuggingPrestige=true;
				Game.AscendTimer=0;
				Game.OnAscend=1;
				Game.removeClass('ascendIntro');
				Game.addClass('ascending');
				
			}
			else
			{
				Game.DebuggingPrestige=false;
			}
			Game.BuildAscendTree();
			Game.OpenSesame();
		}
		
		//experimental debugging function that cycles through every owned upgrade, turns it off and on, and lists how much each upgrade is participating to CpS
		Game.debuggedUpgradeCpS=[];
		Game.debuggedUpgradeCpClick=[];
		Game.debugColors=['#322','#411','#600','#900','#f30','#f90','#ff0','#9f0','#0f9','#09f','#90f'];
		Game.DebugUpgradeCpS=function()
		{
			Game.CalculateGains();
			Game.debuggedUpgradeCpS=[];
			Game.debuggedUpgradeCpClick=[];
			var CpS=Game.cookiesPs;
			var CpClick=Game.computedMouseCps;
			for (var i in Game.Upgrades)
			{
				var me=Game.Upgrades[i];
				if (me.bought)
				{
					me.bought=0;
					Game.CalculateGains();
					//Game.debuggedUpgradeCpS[me.name]=CpS-Game.cookiesPs;
					Game.debuggedUpgradeCpS[me.name]=(CpS/(Game.cookiesPs||1)-1);
					Game.debuggedUpgradeCpClick[me.name]=(CpClick/(Game.computedMouseCps||1)-1);
					me.bought=1;
				}
			}
			Game.CalculateGains();
		}
		
		Game.vanilla=0;//everything we create beyond this will be saved in mod structures
		
		Game.launchMods();
		
		Game.runModHook('create');//declare custom upgrades/achievs/buffs/buildings here!
		
		BeautifyAll();
		
		if (!App)
		{
			if (!Game.LoadSave())
			{//try to load the save when we open the page. if this fails, try to brute-force it half a second later
				setTimeout(function(){
					var local=localStorageGet(Game.SaveTo);
					Game.LoadSave(local);
				},500);
			}
		}
		else if (App.saveData) setTimeout(function(){Game.LoadSave(App.saveData);},100);
		else setTimeout(function(){Game.LoadSave();},100);
		
		Game.ready=1;
		setTimeout(function(){if (typeof showAds==='undefined' && (!l('detectAds') || l('detectAds').clientHeight<1)) Game.addClass('noAds');},500);
		l('offGameMessage').innerHTML='';
		l('offGameMessageWrap').style.display='none';
		Game.Loop();
		Game.Draw();
		
		PlayCue('launch');
		
		if (!EN)
		{
			var adaptWidth=function(node)
			{
				var el=node.firstChild;
				var width=el.clientWidth;
				if (el.classList.contains('subButton'))
				{
					if (width/95>1) el.style.padding='6px 0px';
				}
				width=width/95;
				if (width>1)
				{
					el.style.fontSize=(parseInt(window.getComputedStyle(el).fontSize)*1/width)+'px';
					el.style.transform='scale(1,'+(width)+')';
				}
			}
			l('prefsButton').firstChild.innerHTML=loc("Options");
			l('statsButton').firstChild.innerHTML=loc("Stats");
			l('logButton').firstChild.innerHTML=loc("Info");
			l('legacyButton').firstChild.innerHTML=loc("Legacy");
			adaptWidth(l('prefsButton'));
			adaptWidth(l('statsButton'));
			adaptWidth(l('logButton'));
			adaptWidth(l('legacyButton'));
			l('checkForUpdate').childNodes[0].textContent=loc("New update!");
			l('buildingsTitle').childNodes[0].textContent=loc("Buildings");
			l('storeTitle').childNodes[0].textContent=loc("Store");
		}
	}
	/*=====================================================================================
	LOGIC
	=======================================================================================*/
	Game.Logic=function()
	{
		Game.bounds=Game.l.getBounds();
		
		if (!Game.OnAscend && Game.AscendTimer==0)
		{
			for (var i in Game.Objects)
			{
				if (Game.Objects[i].eachFrame) Game.Objects[i].eachFrame();
			}
			Game.UpdateSpecial();
			Game.UpdateGrandmapocalypse();
			
			//these are kinda fun
			//if (Game.BigCookieState==2 && !Game.promptOn && Game.Scroll!=0) Game.ClickCookie();
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
					Game.Notify(loc("Research complete"),loc("You have discovered: <b>%1</b>.",Game.UpgradesById[Game.nextResearch].dname),Game.UpgradesById[Game.nextResearch].icon);
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
			for (var i in Game.Objects)
			{
				var me=Game.Objects[i];
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
			
			for (var i in Game.Objects)
			{
				var me=Game.Objects[i];
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
				
				var timePlayed=new Date();
				timePlayed.setTime(Date.now()-Game.startDate);
				
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
				
				for (var i in Game.UnlockAt)
				{
					var unlock=Game.UnlockAt[i];
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
					for (var i in Game.easterEggs)
					{
						if (Game.HasUnlocked(Game.easterEggs[i])) eggs++;
					}
					if (eggs>=1) Game.Win('The hunt is on');
					if (eggs>=7) Game.Win('Egging on');
					if (eggs>=14) Game.Win('Mass Easteria');
					if (eggs>=Game.easterEggs.length) Game.Win('Hide & seek champion');
				}
				
				if (Game.Has('Fortune cookies'))
				{
					var list=Game.Tiers['fortune'].upgrades;
					var fortunes=0;
					for (var i in list)
					{
						if (Game.Has(list[i].name)) fortunes++;
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
			
				for (var i in Game.BankAchievements)
				{
					if (Game.cookiesEarned>=Game.BankAchievements[i].threshold) Game.Win(Game.BankAchievements[i].name);
				}
				
				var buildingsOwned=0;
				var mathematician=1;
				var base10=1;
				var minAmount=100000;
				for (var i in Game.Objects)
				{
					buildingsOwned+=Game.Objects[i].amount;
					minAmount=Math.min(Game.Objects[i].amount,minAmount);
					if (!Game.HasAchiev('Mathematician')) {if (Game.Objects[i].amount<Math.min(128,Math.pow(2,(Game.ObjectsById.length-Game.Objects[i].id)-1))) mathematician=0;}
					if (!Game.HasAchiev('Base 10')) {if (Game.Objects[i].amount<(Game.ObjectsById.length-Game.Objects[i].id)*10) base10=0;}
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
				for (var i in Game.GrandmaSynergies)
				{
					if (Game.Has(Game.GrandmaSynergies[i])) grandmas++;
				}
				if (!Game.HasAchiev('Elder') && grandmas>=7) Game.Win('Elder');
				if (!Game.HasAchiev('Veteran') && grandmas>=14) Game.Win('Veteran');
				if (Game.Objects['Grandma'].amount>=6 && !Game.Has('Bingo center/Research facility') && Game.HasAchiev('Elder')) Game.Unlock('Bingo center/Research facility');
				if (Game.pledges>0) Game.Win('Elder nap');
				if (Game.pledges>=5) Game.Win('Elder slumber');
				if (Game.pledges>=10) Game.Unlock('Sacrificial rolling pins');
				if (Game.Objects['Cursor'].amount+Game.Objects['Grandma'].amount>=777) Game.Win('The elder scrolls');
				
				for (var i in Game.Objects)
				{
					var it=Game.Objects[i];
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
		
		if ((Game.toSave || (Game.T%(Game.fps*60)==0 && Game.T>Game.fps*10 && Game.prefs.autosave)) && !Game.OnAscend)
		{
			//check if we can save : no minigames are loading
			var canSave=true;
			for (var i in Game.Objects)
			{
				var me=Game.Objects[i];
				if (me.minigameLoading){canSave=false;break;}
			}
			if (canSave) Game.WriteSave();
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
	
	/*=====================================================================================
	DRAW
	=======================================================================================*/
	
	Game.Draw=function()
	{
		Game.DrawBackground();Timer.track('end of background');
		
		if (!Game.OnAscend)
		{
			
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
			
			str=loc("%1 cookie",{n:Math.round(Game.cookiesd),b:str});
			if (str.length>14) str=str.replace(' ','<br>');
			
			if (Game.prefs.monospace) str='<span class="monospace">'+str+'</span>';
			str=str+'<div id="cookiesPerSecond"'+(Game.cpsSucked>0?' class="wrinkled"':'')+'>'+loc("per second:")+' '+Beautify(Game.cookiesPs*(1-Game.cpsSucked),1)+'</div>';
			l('cookies').innerHTML=str;
			Timer.track('cookie amount');
			
			for (var i in Game.Objects)
			{
				var me=Game.Objects[i];
				if (me.onMinigame && me.minigame.draw && !me.muted && !Game.onMenu) me.minigame.draw();
			}
			Timer.track('draw minigames');
			
			if (Game.drawT%5==0)
			{
				//if (Game.prefs.monospace) {l('cookies').className='title monospace';} else {l('cookies').className='title';}
				var lastLocked=0;
				for (var i in Game.Objects)
				{
					var me=Game.Objects[i];
					
					//make products full-opacity if we can buy them
					var classes='product';
					var price=me.bulkPrice;
					if (Game.cookiesEarned>=me.basePrice || me.bought>0) {classes+=' unlocked';lastLocked=0;me.locked=0;} else {classes+=' locked';lastLocked++;me.locked=1;}
					if ((Game.buyMode==1 && Game.cookies>=price) || (Game.buyMode==-1 && me.amount>0)) classes+=' enabled'; else classes+=' disabled';
					if (lastLocked>2) classes+=' toggledOff';
					me.l.className=classes;
					//if (me.id>0) {l('productName'+me.id).innerHTML=Beautify(me.storedTotalCps/Game.ObjectsById[me.id-1].storedTotalCps,2);}
				}
				
				//make upgrades full-opacity if we can buy them
				var lastPrice=0;
				for (var i in Game.UpgradesInStore)
				{
					var me=Game.UpgradesInStore[i];
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
				Game.l.style.filter='hue-rotate('+((Game.T*5)%360)+'deg) brightness('+(150-50*pulse)+'%)';
				Game.l.style.webkitFilter='hue-rotate('+((Game.T*5)%360)+'deg) brightness('+(150-50*pulse)+'%)';
				Game.l.style.transform='scale('+(1.02-0.02*pulse)+','+(1.02-0.02*pulse)+') rotate('+(Math.sin(Game.T*0.5)*0.5)+'deg)';
				Game.wrapper.style.overflowX='hidden';
				Game.wrapper.style.overflowY='hidden';
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
	
	/*=====================================================================================
	MAIN LOOP
	=======================================================================================*/
	Game.Loop=function()
	{
		if (Game.timedout) return false;
		Timer.say('START');
		Timer.track('browser stuff');
		Timer.say('LOGIC');
		//update game logic !
		Game.catchupLogic=0;
		Game.Logic();
		Game.catchupLogic=1;
		
		var time=Date.now();
		
		
		//latency compensator
		Game.accumulatedDelay+=((time-Game.time)-1000/Game.fps);
		if (Game.prefs.timeout && time-Game.lastActivity>=1000*60*5)
		{
			if (Game.accumulatedDelay>1000*60*30) Game.delayTimeouts+=3;//more than 30 minutes delay? computer probably asleep and not making cookies anyway
			else if (Game.accumulatedDelay>1000*5) Game.delayTimeouts++;//add to timeout counter when we skip 10 seconds worth of frames (and the player has been inactive for at least 5 minutes)
			if (Game.delayTimeouts>=3) Game.Timeout();//trigger timeout when the timeout counter is 3+
		}
		
		Game.accumulatedDelay=Math.min(Game.accumulatedDelay,1000*5);//don't compensate over 5 seconds; if you do, something's probably very wrong
		Game.time=time;
		
		//if (Game.accumulatedDelay>=Game.fps) console.log('delay:',Math.round(Game.accumulatedDelay/Game.fps));
		while (Game.accumulatedDelay>0)
		{
			Game.Logic();
			Game.accumulatedDelay-=1000/Game.fps;//as long as we're detecting latency (slower than target fps), execute logic (this makes drawing slower but makes the logic behave closer to correct target fps)
		}
		Game.catchupLogic=0;
		Timer.track('logic');
		Timer.say('END LOGIC');
		/*
		if (!Game.prefs.altDraw)
		{
			var hasFocus=document.hasFocus();
			Timer.say('DRAW');
			if (hasFocus || Game.prefs.focus || Game.loopT%10==0) requestAnimationFrame(Game.Draw);
			//if (document.hasFocus() || Game.loopT%5==0) Game.Draw();
			Timer.say('END DRAW');
		}
		else requestAnimationFrame(Game.Draw);*/
		if (Game.visible) Game.Draw();
		
		//if (!hasFocus) Game.tooltip.hide();
		
		if (Game.sesame)
		{
			//fps counter and graph
			Game.previousFps=Game.currentFps;
			Game.currentFps=Game.getFps();
				var ctx=Game.fpsGraphCtx;
				ctx.drawImage(Game.fpsGraph,-1,0);
				ctx.fillStyle='rgb('+Math.round((1-Game.currentFps/Game.fps)*128)+',0,0)';
				ctx.fillRect(128-1,0,1,64);
				ctx.strokeStyle='#fff';
				ctx.beginPath();
				ctx.moveTo(128-1,(1-Game.previousFps/Game.fps)*64);
				ctx.lineTo(128,(1-Game.currentFps/Game.fps)*64);
				ctx.stroke();
			
			l('fpsCounter').textContent=Game.currentFps+' fps';
			var str='';
			for (var i in Timer.labels) {str+=Timer.labels[i];}
			if (Game.debugTimersOn) l('debugLog').style.display='block';
			else l('debugLog').style.display='none';
			l('debugLog').innerHTML=str;
			
		}
		Timer.reset();
		
		Game.loopT++;
		setTimeout(Game.Loop,1000/Game.fps);
	}
}

/*=====================================================================================
LAUNCH THIS THING
=======================================================================================*/
//Game.Launch();


//try {Game.Launch();}
//catch(err) {console.log('ERROR : '+err.message);}

window.addEventListener('load',function()
{
	if (!Game.ready)
	{
		var loadLangAndLaunch=function(lang)
		{
			localStorageSet('CookieClickerLang',lang);
			
			//LoadLang('../Cookie Clicker Localization/EN.js',function(lang){return function(){
			window.loadLangModule('EN',function(){
				locStringsFallback=locStrings;
				window.loadLangModule(lang,function(){
					var launch=function(){
						Game.Launch();
						if (top!=self) Game.ErrorFrame();
						else
						{
							console.log('[=== '+choose([
								'Oh, hello!',
								'hey, how\'s it hangin',
								'About to cheat in some cookies or just checking for bugs?',
								'Remember : cheated cookies taste awful!',
								'Hey, Orteil here. Cheated cookies taste awful... or do they?',
							])+' ===]');
							Game.Load();
							//try {Game.Load();}
							//catch(err) {console.log('ERROR : '+err.message);}
						}
					}
					if (App && App.loadMods) App.loadMods(launch);
					else launch();
				});
			});
		}
		
		var showLangSelect=function(callback)
		{
			var str='';
			for (var i in Langs)
			{
				var lang=Langs[i];
				str+='<div class="langSelectButton title" id="langSelect-'+i+'">'+lang.name+'</div>';
			}
			l('offGameMessage').innerHTML=
			'<div class="title" id="languageSelectHeader">Language</div>'+
			'<div class="line" style="max-width:300px;"></div>'+
			str;
			for (var i in Langs)
			{
				var lang=Langs[i];
				AddEvent(l('langSelect-'+i),'click',function(lang){return function(){callback(lang);};}(i));
				AddEvent(l('langSelect-'+i),'mouseover',function(lang){return function(){l('languageSelectHeader').innerHTML=Langs[lang].changeLanguage;};}(i));
			}
		}
		
		var lang=localStorageGet('CookieClickerLang');
		if (!lang) showLangSelect(loadLangAndLaunch);
		else loadLangAndLaunch(lang);
	}
});
/* =====================================================================
 * CC3: engine globals shim. The 2.048 engine was a single classic script,
 * so every top-level binding was global. The minigame modules and the
 * legacy mod loader still resolve their free variables against window,
 * so we republish the engine surface here.
 * ===================================================================== */
Object.assign(window, {
	Audio,
	localStorageGet,
	localStorageSet,
	Music,
	PlayCue,
	TopBarOffset,
	LASTHEAVENLYSELECTED,
	ON,
	OFF,
	l,
	choose,
	escapeRegExp,
	replaceAll,
	cap,
	romanize,
	realAudio,
	randomFloor,
	shuffle,
	LoadScript,
	ajax,
	toFixed,
	formatEveryThirdPower,
	rawFormatter,
	formatLong,
	prefixes,
	suffixes,
	formatShort,
	numberFormatters,
	Beautify,
	shortenNumber,
	SimpleBeautify,
	beautifyInTextFilter,
	BeautifyInTextFunction,
	BeautifyInText,
	BeautifyAll,
	locStrings,
	locStringsFallback,
	locId,
	EN,
	locName,
	locPatches,
	locPlur,
	locPlurFallback,
	locStringsByPart,
	FindLocStringByPart,
	Langs,
	locBlink,
	localizationNotFound,
	loc,
	parseLoc,
	LBeautify,
	ModLanguage,
	AddLanguage,
	LoadLang,
	LocalizeUpgradesAndAchievs,
	getUpgradeName,
	getAchievementName,
	utf8_to_b64,
	b64_to_utf8,
	CompressBin,
	UncompressBin,
	CompressLargeBin,
	UncompressLargeBin,
	pack,
	unpack,
	pack2,
	unpack2,
	pack3,
	saveAs,
	bind,
	grabProps,
	OldCanvasDrawImage,
	AddEvent,
	RemoveEvent,
	FireEvent,
	writeIcon,
	tinyIcon,
	Loader,
	Pic,
	Sounds,
	OldPlaySound,
	SoundInsts,
	SoundI,
	pitchSupport,
	PlaySound,
	PlayMusicSound,
	triggerAnim,
	debugStr,
	Debug,
	Timer,
	Game
});

/* CC3 rewrite (slice 3): live-bridge the vanilla-content order/pool/power
 * globals. The content modules (content/upgrades.ts; later
 * content/achievements.ts) read and write those names as bare globals, which
 * in ESM resolves to window; the accessors below point those window
 * properties at the module-level vars declared at the top of this file. The
 * engine's own ctors (Game.Upgrade, Game.Achievement) keep reading the
 * unqualified names, which resolve to the same module-level vars — so both
 * sides observe one shared state, exactly like the original Init-scoped
 * closure vars. (Object.assign above copies values by reference-free
 * assignment, so it is not a bridge; the accessors are.) */
Object.defineProperty(window, 'order', {get(){return order;}, set(v){order=v;}});
Object.defineProperty(window, 'pool', {get(){return pool;}, set(v){pool=v;}});
Object.defineProperty(window, 'power', {get(){return power;}, set(v){power=v;}});
/* CC3 rewrite (phase 3, slice 2): the core Building class reads these three
 * primitives unqualified, i.e. from window — but Object.assign above copied
 * them by value at module-eval time, before the language load reassigns
 * them (locId 'NONE'→'EN', EN, TopBarOffset). Read-only accessors bridge the
 * live engine vars, the same way order/pool/power are bridged. (EN also
 * fixes the content modules' non-English games to match master, where EN
 * was a live global.) */
Object.defineProperty(window, 'locId', {get(){return locId;}});
Object.defineProperty(window, 'EN', {get(){return EN;}});
Object.defineProperty(window, 'TopBarOffset', {get(){return TopBarOffset;}});

/* CC3: explicit module marker — at runtime these files are always ESM modules
 * (Vite bundles them as such), and this keeps their top-level var/function
 * declarations out of the TS global scope. Zero runtime effect. */
export {};
