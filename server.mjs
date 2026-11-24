import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const page=await readFile(fileURLToPath(new URL('./index.html',import.meta.url)));
const key=process.env.ANYMODEL_API_KEY;
const prompt="Ты планировщик домашних блюд. Отвечай только JSON без markdown. Создавай выполнимые и разнообразные семейные рецепты, учитывай все ограничения, бюджет, продукты дома, оборудование. Используй только идентификаторы продуктов из каталога. Количества целые на одну порцию в г/мл, яйца в штуках; крупы в сухом виде, фасоль готовая. Не используй сырые яйца, мясо или рыбу, пропиши полную термообработку. Не придумывай цены и не заявляй медицинскую или нутриционную полноценность. Не назначай детям диеты или нормы калорий. Цены ориентировочные за кг/л или за штуку яиц; стоимость покупок округляется вверх до упаковок. Для каждого выбранного дня и приема пищи ровно одна запись. Индексы дней 0–6. Формат {\"recipes\":[{\"name\":\"название\",\"type\":\"прием пищи из анкеты\",\"time\":20,\"equipment\":[\"Плита\"],\"ingredients\":{\"rice\":80,\"chicken\":120},\"method\":\"Подробные шаги приготовления. Следующий шаг.\"}],\"plan\":[{\"day\":0,\"meal\":\"прием пищи\",\"id\":0}],\"note\":\"Краткое объяснение выбора и ограничений\"}. id — индекс рецепта в recipes, нумерация с 0. До 28 рецептов, допустимы повторы. Для блюд без нагрева equipment может быть пустым массивом. Не используй неизвестные продукты, даже соль или специи вне каталога, кроме воды. Учитывай бюджет для всей семьи, не уменьшай порции до неразумных размеров ради экономии. Дополнительные продукты weeklyExtras уже включены в корзину отдельными позициями на всю неделю, не добавляй их повторно в рецепты. Учитывай их в общей оценке разнообразия питания и зарезервируй weeklyExtrasKnownCost из бюджета; если weeklyExtrasUnknownPrices больше нуля, не обещай точного попадания в бюджет. Не считай добавки безопасными при аллергиях: состав проверяет пользователь. Если бюджета недостаточно, предложи разумное меню и честно укажи это.";
const pagesOrigin='https://anufriev163.github.io';
const windows=new Map(); let active=0,day=0,used=0;
const limit=Math.max(1,Math.min(1000,Number(process.env.DAILY_AI_LIMIT)||100));
function send(res,status,data){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data))}
function allow(req){const origin=req.headers.origin;return !origin||origin===pagesOrigin||origin==='https://'+req.headers.host||origin==='http://'+req.headers.host}
const server=http.createServer(async(req,res)=>{
 const path=new URL(req.url,'http://localhost').pathname;
 if(path==='/'||path==='/index.html'){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-cache'});return res.end(page)}
 if(!allow(req))return send(res,403,{error:'Origin not allowed'});
 if(req.headers.origin===pagesOrigin){res.setHeader('Access-Control-Allow-Origin',pagesOrigin);res.setHeader('Vary','Origin');res.setHeader('Access-Control-Allow-Methods','GET, POST, OPTIONS');res.setHeader('Access-Control-Allow-Headers','Content-Type')}
 if(req.method==='OPTIONS'){res.writeHead(204);return res.end()}
 if(path==='/health'&&req.method==='GET')return send(res,200,{ready:!!key});
 if(path!=='/api/menu'||req.method!=='POST')return send(res,404,{error:'Not found'});
 if(!key)return send(res,503,{error:'Service unavailable'});
 if(!String(req.headers['content-type']).startsWith('application/json'))return send(res,415,{error:'JSON required'});
 let raw='';try{for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>24000){send(res,413,{error:'Payload too large'});return}}}catch{return}
 let data;try{data=JSON.parse(raw)}catch{return send(res,400,{error:'Invalid JSON'})}
 if(!data?.profile||!data.catalog||typeof data.profile!=='object'||typeof data.catalog!=='object'||Array.isArray(data.catalog)||Object.keys(data.catalog).length>40||!Array.isArray(data.profile.days)||data.profile.days.length>7||!Array.isArray(data.profile.meals)||data.profile.meals.length>4)return send(res,400,{error:'Invalid profile'});
 const now=Date.now(),d=Math.floor(now/86400000);if(day!==d){day=d;used=0}
 for(const [k,v] of windows)if(now-v.start>=600000)windows.delete(k);
 const ip=req.socket.remoteAddress||'unknown';let w=windows.get(ip)||{start:now,n:0};
 if(w.n>=8||used>=limit||active>=4)return send(res,429,{error:'Generation limit reached'});
 w.n++;windows.set(ip,w);used++;active++;
 try{
 const upstream=await fetch('https://anymodel.org/v1/chat/completions',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+key},body:JSON.stringify({model:'ds/deepseek-v4-flash',messages:[{role:'system',content:prompt},{role:'user',content:JSON.stringify({profile:data.profile,catalog:data.catalog,correction:String(data.correction||'').slice(0,500)})}],max_tokens:12000,stream:false}),signal:AbortSignal.timeout(150000),redirect:'error'});
 if(!upstream.ok)return send(res,502,{error:'Generation temporarily unavailable'});
 const out=await upstream.json();const content=out?.choices?.[0]?.message?.content;
 if(typeof content!=='string')return send(res,502,{error:'Empty result'});
 return send(res,200,{content});
 }catch{return send(res,502,{error:'Generation temporarily unavailable'})}finally{active--}
});
server.listen(Number(process.env.PORT)||8080,'0.0.0.0');
