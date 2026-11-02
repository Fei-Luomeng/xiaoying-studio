// Run in the frontend container. Creates two non-personal demo tasks and keeps their history.
import assert from 'node:assert/strict';
const base = 'http://127.0.0.1:3000';
const cookies = [];
async function request(path, {cookie, ...options} = {}) {
  return fetch(base + path, { ...options, headers: { 'X-Studio-Request':'1', ...(cookie ? {Cookie:cookie}:{}), ...options.headers } });
}
async function login(userId) {
  const response = await request('/api/auth/session', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({userId})});
  assert.equal(response.status,200);
  const cookie = response.headers.get('set-cookie').split(';',1)[0]; cookies.push(cookie); return cookie;
}
async function json(path, cookie) {
  const response = await request(path,{cookie}); assert.equal(response.status,200); return response.json();
}
try {
  const cookie = await login('demo-chen');
  const sample = new Uint8Array(await (await request('/demo/sample-1.png')).arrayBuffer());
  const form = new FormData(); form.append('templateId','pet-portrait'); form.append('file',new Blob([sample],{type:'image/png'}),'smoke-sample.png');
  const uploaded = await request('/api/assets',{method:'POST',body:form,cookie}); assert.equal(uploaded.status,201);
  const asset = await uploaded.json();
  const created = [];
  for (const failAtStage of [null,'GENERATE']) {
    const start = performance.now();
    const response = await request('/api/tasks',{method:'POST',cookie,headers:{'Content-Type':'application/json'},body:JSON.stringify({templateId:'pet-portrait',assetIds:[asset.id],simulation:{stepDelayMs:700,failAtStage}})});
    assert.equal(response.status,202); const task = await response.json();
    assert.equal(task.status,'QUEUED');
    assert.ok(task.steps.every((step)=>step.status==='WAITING'));
    console.log(JSON.stringify({accepted:task.id,status:task.status,requestMs:Math.round(performance.now()-start)}));
    created.push(task);
  }
  const seen = new Map(created.map((task)=>[task.id,new Set()]));
  let final;
  const deadline = Date.now()+20000;
  do {
    final = await Promise.all(created.map((task)=>json('/api/tasks/'+task.id,cookie)));
    for (const task of final) seen.get(task.id).add(task.status+':'+(task.stage??'NONE'));
    if (final.every((task)=>['SUCCEEDED','FAILED'].includes(task.status))) break;
    await new Promise((resolve)=>setTimeout(resolve,150));
  } while (Date.now()<deadline);
  assert.equal(final[0].status,'SUCCEEDED'); assert.equal(final[1].status,'FAILED');
  assert.equal(final[1].stage,'GENERATE'); assert.match(final[1].errorMessage,/模拟失败/);
  assert.equal(final[1].steps[2].status,'WAITING'); assert.equal(final[1].steps[2].startedAt,null);
  for (const stage of ['MATERIAL_CHECK','GENERATE','FINALIZE']) assert.ok(seen.get(final[0].id).has('RUNNING:'+stage));
  const result = await request(final[0].resultUrl,{cookie}); assert.equal(result.status,200);
  assert.deepEqual(new Uint8Array(await result.arrayBuffer()),sample);
  assert.match(result.headers.get('cache-control'),/no-store/);
  const history = await json('/api/tasks',cookie);
  assert.ok(final.every((task)=>history.some((item)=>item.id===task.id)));
  assert.deepEqual(await json('/api/tasks/'+final[0].id,cookie),final[0]);
  const other = await login('demo-lin');
  assert.equal((await request('/api/tasks/'+final[0].id,{cookie:other})).status,404);
  assert.equal((await request(final[0].resultUrl,{cookie:other})).status,404);
  const otherHistory = await json('/api/tasks',other);
  assert.ok(final.every((task)=>!otherHistory.some((item)=>item.id===task.id)));
  console.log(JSON.stringify({result:'PASS',tasks:final.map((task)=>({id:task.id,status:task.status,stage:task.stage,observed:[...seen.get(task.id)]})),checks:['real background scheduling','queued multi-task','three observable stages','failure interruption','result bytes','history','terminal stability','ownership']}));
} finally {
  for (const cookie of cookies) await request('/api/auth/session',{method:'DELETE',cookie}).catch(()=>{});
}
