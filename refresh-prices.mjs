import {readFile,writeFile} from 'node:fs/promises';
const file=new URL('./catalog-prices.json',import.meta.url);
const data=JSON.parse(await readFile(file,'utf8'));
const decode=s=>s.replace(/&nbsp;|&#160;|&#8239;/gi,' ').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#(\d+);/g,(_,n)=>String.fromCharCode(Number(n)));
function extract(html,row){
 const text=decode(html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ').replace(/<[^>]*>/g,' ')).replace(/\s+/g,' ');
 let at=text.toLowerCase().indexOf(row.match.toLowerCase());
 while(at>=0){
  const item=text.slice(at,at+row.match.length+180).split(/В корзину|Добавить в корзину|Нет оценок/)[0];
  const compact=item.toLowerCase().replace(/\s+/g,'');
  if(compact.includes(row.size.toLowerCase().replace(/\s+/g,''))){
   // Prefer regular price rather than temporary sale price; require explicit price and kopecks.
   const p=item.match(/(?:Старая цена|Цена)\s*(\d{1,5}(?:\s\d{3})*)\s+(\d{2})\s*₽/i)||item.match(/(?:Старая цена|Цена)\s*(\d{1,5}(?:\s\d{3})*)[,.](\d{2})\s*₽/i);
   if(p){const v=Number(p[1].replace(/\s/g,''))+Number(p[2])/100;if(v>=5&&v<=5000&&v>row.price*.3&&v<row.price*3)return v}
  }
  at=text.toLowerCase().indexOf(row.match.toLowerCase(),at+row.match.length)
 }
 return null
}
if(process.argv.includes('--test')){
 const x=extract('<p>Печенье Юбилейное Традиционное 403г Цена 129 99 ₽ В корзину</p>',data.rows.cookie);
 if(x!==129.99)throw Error('Parser test failed');console.log('Parser test passed');process.exit(0)
}
let changed=0;
for(const [id,row] of Object.entries(data.rows)){
 try{
  const u=new URL(row.url);if(u.origin!=='https://5ka.ru')continue;
  const res=await fetch(u,{headers:{'User-Agent':'Nalegke public price reference/1.0','Accept':'text/html'},redirect:'error',signal:AbortSignal.timeout(12000)});
  if(!res.ok){console.log(id,'HTTP',res.status);continue}
  const html=await res.text(),p=extract(html,row);
  if(p===null){console.log(id,'no verifiable price');continue}
  row.price=p;row.checked=new Date().toISOString().slice(0,10);changed++;console.log(id,'updated');
 }catch(e){console.log(id,'unavailable')}
}
if(changed){data.lastRefresh=new Date().toISOString();await writeFile(file,JSON.stringify(data,null,2)+'\n')}
else console.log('No verified updates; retained previous snapshot');
