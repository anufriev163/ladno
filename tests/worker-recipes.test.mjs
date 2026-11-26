import assert from 'node:assert/strict';
import test from 'node:test';
import worker from '../worker.mjs';

test('allergy profile only receives instructions built from checked ingredients', async t => {
 const catalog={rice:{name:'Рис',price:150,package:800,unit:'г'},milk:{name:'Молоко',price:120,package:900,unit:'мл'}};
 const limits={rice:120,milk:200};
 const profile={adults:1,children:0,servings:1,budget:1500,days:[1],meals:['Обед'],store:'Пятёрочка',goal:'Обычное питание',diet:'Без ограничений',style:'Разнообразие',stores:['Пятёрочка'],equipment:['Плита'],allergies:['Молоко'],likes:[],customDislikes:[],dislikes:[],dislikeNames:[],pantry:[],weeklyExtras:[],weeklyExtrasKnownCost:0,weeklyExtrasUnknownPrices:0,quantityLimits:limits,dailyQuantityLimits:limits,servingQuantityLimits:limits};
 const recipe={name:'Рис на молоке',type:'Обед',time:20,ingredients:{rice:80},method:'Влейте молоко.'};
 let modelRecipe;
 t.mock.method(globalThis,'fetch',async()=>Response.json({choices:[{message:{content:JSON.stringify({recipes:[modelRecipe],note:'Добавьте молоко.'})}}]}));
 const quota={idFromName:()=>null,get:()=>({fetch:async()=>Response.json({ok:true})})};
 const fetchMenu=()=>worker.fetch(new Request('https://worker.test/api/menu',{method:'POST',headers:{Origin:'https://anufriev163.github.io','Content-Type':'application/json'},body:JSON.stringify({mode:'generate',profile,catalog,requestId:'test-request-0001'})}),{ANYMODEL_API_KEY:'synthetic-test-key',MENU_QUOTA:quota});

 modelRecipe={...recipe,steps:[{action:'boil',ids:['rice','milk']}]};
 let response=await fetchMenu();
 assert.equal(response.status,422);
 assert.equal((await response.json()).reason,'RECIPE_STEPS');

 modelRecipe={...recipe,ingredients:{rice:80,milk:50},steps:[{action:'boil',ids:['rice','milk']}]};
 response=await fetchMenu();
 assert.equal(response.status,422);
 assert.equal((await response.json()).reason,'INGREDIENT_UNAVAILABLE');

 modelRecipe={...recipe,ingredients:{rice:160},steps:[{action:'boil',ids:['rice','water']}]};
 response=await fetchMenu();
 assert.equal(response.status,200);
 const plan=JSON.parse((await response.json()).content);
 assert.deepEqual(plan.plan,[{day:1,meal:'Обед',id:0}]);
 assert.equal(plan.recipes[0].verifiedSteps,true);
 assert.equal(plan.recipes[0].name,'Рис');
 assert.equal(plan.recipes[0].ingredients.rice,120);
 assert.equal(plan.recipes[0].method,'Отварите до полной готовности: рис, вода.');
 assert.equal(plan.note,'');
});
