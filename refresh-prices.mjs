import {readFile,writeFile} from 'node:fs/promises';
const file=new URL('./catalog-prices.json',import.meta.url);
const data=JSON.parse(await readFile(file,'utf8'));
const decode=s=>s.replace(/&nbsp;|&#160;|&#8239;/gi,' ').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#(\d+);/g,(_,n)=>String.fromCharCode(Number(n)));
const clean=html=>decode(html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ').replace(/<[^>]*>/g,' ')).replace(/\s+/g,' ');
const escapeRegex=s=>s.replace(/[.*+?^$\\{}()|[\]]/g,'\\$&');
function extract(html,row){
 const text=clean(html);
 // Require name, exact size, then explicit price without crossing into another card.
 const name=escapeRegex(row.match).replace(/ /g,'\\s+');
 const size=escapeRegex(row.size).replace(/ /g,'\\s*').replace(/(\d)(г|кг|мл|л|шт)/gi,'$1\\s*$2');
 const amount='(\\d{1,5}(?:\\s\\d{3})*)[\\s,.]+(\\d{2})\\s*₽';
 const optionalRepeat='(?:\\s+\\d+(?:[.,]\\d+)?\\s*(?:кг|мл|г|л|шт)\\.?)?';
 const regex=new RegExp(name+'\\s*,?\\s*'+size+optionalRepeat+'\\s*(?:Старая цена|Цена)\\s*'+amount,'gi');
 const found=new Set();
 for(const p of text.matchAll(regex)){
  const v=Number(p[1].replace(/\s/g,''))+Number(p[2])/100;
  if(v>=5&&v<=5000&&v>=row.price*.3&&v<=row.price*3)found.add(v)
 }
 return found.size===1?[...found][0]:null
}
if(process.argv.includes('--test')){
 const row={match:'Печенье Юбилейное Традиционное',size:'403г',price:129.99};
 const tests=[
 ['<p>Печенье Юбилейное Традиционное 403г Цена 129 99 ₽ В корзину</p>',129.99],
 ['Печенье Юбилейное Традиционное 403г 403 г Старая цена 139 99 ₽Цена 109 99 ₽',139.99],
 ['Печенье Юбилейное Традиционное 300г Цена 99 99 ₽',null],
 ['Печенье Юбилейное Традиционное 403г В корзину Другой товар Цена 149 99 ₽',null],
 ['Печенье Юбилейное Традиционное 403г Цена 129 99 ₽ Печенье Юбилейное Традиционное 403г Цена 149 99 ₽',null],
 ['Печенье Юбилейное Традиционное 403г Цена 129,99 ₽',129.99]
 ];
 for(const [input,expected] of tests)if(extract(input,row)!==expected)throw Error('Parser test failed: '+input);
 const weighted={match:'Морковь мытая',size:'Цена за 1 кг',price:72.99};
 if(extract('Морковь мытая Цена за 1 кг Цена 72 99 ₽',weighted)!==72.99)throw Error('Weighted product test failed');
 console.log('7 parser tests passed');process.exit(0)
}
let changed=0;
const pages=new Map();
for(const [id,row] of Object.entries(data.rows)){
 try{
  const u=new URL(row.url);if(u.origin!=='https://5ka.ru')continue;
  if(!pages.has(u.href)){
   let html=null;
   try{
    const res=await fetch(u,{headers:{'User-Agent':'Nalegke public price reference/1.0','Accept':'text/html'},redirect:'error',signal:AbortSignal.timeout(8000)});
    if(res.ok)html=await res.text();else console.log(u.pathname,'HTTP',res.status)
   }catch{console.log(u.pathname,'unavailable')}
   pages.set(u.href,html)
  }
  const html=pages.get(u.href);if(!html)continue;
  const p=extract(html,row);
  if(p===null){console.log(id,'no unambiguous price');continue}
  row.price=p;row.checked=new Date().toISOString().slice(0,10);row.origin='public_catalog_fetch';changed++;console.log(id,'updated');
 }catch{console.log(id,'unavailable')}
}
if(changed){data.lastRefresh=new Date().toISOString();await writeFile(file,JSON.stringify(data,null,2)+'\n')}
console.log(changed+' of '+Object.keys(data.rows).length+' rows verified; previous values retained for all others');
