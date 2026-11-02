// HTTP + actual frontend polling controller smoke check; not a browser/E2E test.
import assert from 'node:assert/strict';
const {createTaskFeed,decodeTask,decodeTasks}=await import(process.env.TASK_MODULE_URL ?? new URL('../frontend/src/lib/tasks.ts',import.meta.url).href);
const base=process.env.STUDIO_SMOKE_ORIGIN ?? 'http://127.0.0.1:3000';
const cookies=[], feeds=[];
async function request(path,{cookie,...options}={}) {
  return fetch(base+path,{...options,headers:{'X-Studio-Request':'1',...(cookie?{Cookie:cookie}:{}),...options.headers}});
}
async function json(path,cookie,signal) {
  const response=await request(path,{cookie,signal}); assert.equal(response.status,200); return response.json();
}
async function login(userId) {
  const response=await request('/api/auth/session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({userId})});
  assert.equal(response.status,200); const cookie=response.headers.get('set-cookie').split(';',1)[0]; cookies.push(cookie); return cookie;
}
function makeFeed(cookie,{failId}={}) {
  const calls=[]; let injected=false;
  const feed=createTaskFeed({ownerId:cookie.owner,loadHistory:async(signal)=>decodeTasks(await json('/api/tasks',cookie.value,signal)),
    loadTask:async(id,signal)=>{
      calls.push(id);
      if(id===failId&&!injected){injected=true;throw new TypeError('controlled temporary query outage');}
      return decodeTask(await json('/api/tasks/'+id,cookie.value,signal));
    },onIdentityLost:()=>{throw new Error('unexpected identity mismatch');}});
  feeds.push(feed); return {feed,calls};
}
async function waitFor(feed,predicate,description) {
  if(predicate(feed.getSnapshot()))return;
  await new Promise((resolve,reject)=>{
    const timeout=setTimeout(()=>{unsubscribe();reject(new Error('Timeout: '+description));},30000);
    const unsubscribe=feed.subscribe(()=>{if(predicate(feed.getSnapshot())){clearTimeout(timeout);unsubscribe();resolve();}});
  });
}
try {
  const page=await request('/history'); assert.equal(page.status,200); assert.match(await page.text(),/我的作品/);
  const owner=await login('demo-chen');
  const sample=new Uint8Array(await (await request('/demo/sample-1.png')).arrayBuffer());
  const form=new FormData();form.append('templateId','pet-portrait');form.append('file',new Blob([sample],{type:'image/png'}),'feed-smoke.png');
  const uploaded=await request('/api/assets',{cookie:owner,method:'POST',body:form});assert.equal(uploaded.status,201);const asset=await uploaded.json();
  const created=[];
  for(const failAtStage of [null,'GENERATE']) {
    const response=await request('/api/tasks',{cookie:owner,method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({templateId:'pet-portrait',assetIds:[asset.id],simulation:{stepDelayMs:1500,failAtStage}})});
    assert.equal(response.status,202);created.push(decodeTask(await response.json()));
  }
  const first=created[0].id,second=created[1].id;
  const tracked=makeFeed({owner:'demo-chen',value:owner},{failId:first}); tracked.feed.start();
  await waitFor(tracked.feed,s=>s.taskErrors[first],'individual query error');
  assert.ok(['QUEUED','RUNNING'].includes(tracked.feed.getSnapshot().tasks.find(t=>t.id===first).status));
  assert.equal(tracked.feed.getSnapshot().tasks.find(t=>t.id===first).errorMessage,null);
  await waitFor(tracked.feed,s=>s.tasks.some(t=>t.id===second&&t.status==='FAILED'),'other task continues independently');
  assert.equal(tracked.calls.filter(id=>id===first).length,1);
  tracked.feed.refresh();
  await waitFor(tracked.feed,s=>!s.historyLoading&&!s.historyError&&created.every(item=>s.tasks.some(t=>t.id===item.id&&['SUCCEEDED','FAILED'].includes(t.status))),'query recovery');
  const final=tracked.feed.getSnapshot();
  assert.equal(final.tasks.find(t=>t.id===first).status,'SUCCEEDED');
  assert.equal(final.tasks.find(t=>t.id===second).steps[2].status,'WAITING');
  assert.deepEqual(final.taskErrors,{});
  const queriedBefore=tracked.calls.filter(id=>id===first||id===second).length;
  await new Promise(resolve=>setTimeout(resolve,2300));
  assert.equal(tracked.calls.filter(id=>id===first||id===second).length,queriedBefore);
  tracked.feed.stop();
  const restored=makeFeed({owner:'demo-chen',value:owner}); restored.feed.start();
  await waitFor(restored.feed,s=>s.historyLoaded,'new scope restores automatically');
  assert.ok(created.every(item=>restored.feed.getSnapshot().tasks.some(t=>t.id===item.id)));
  restored.feed.stop();
  const other=await login('demo-lin'); const switched=makeFeed({owner:'demo-lin',value:other}); switched.feed.start();
  await waitFor(switched.feed,s=>s.historyLoaded,'switched user loads own history');
  assert.ok(switched.feed.getSnapshot().tasks.every(t=>t.ownerId==='demo-lin'));
  assert.ok(created.every(item=>!switched.feed.getSnapshot().tasks.some(t=>t.id===item.id)));
  switched.feed.stop();
  console.log(JSON.stringify({result:'PASS',tasks:created.map(t=>t.id),checks:['history route','automatic history load','individual query error preserves status','other task keeps updating','manual recovery','terminal polling stops','fresh scope restores history','user isolation']}));
} finally {
  feeds.forEach(feed=>feed.stop());
  for(const cookie of cookies)await request('/api/auth/session',{cookie,method:'DELETE'}).catch(()=>{});
}
