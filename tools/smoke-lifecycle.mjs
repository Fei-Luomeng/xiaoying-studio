// Destructive-process simulation ONLY for the isolated xiaoying-acceptance project.
// Never use the prepare/kill/restart workflow on the regular demonstration environment.
import assert from 'node:assert/strict';
import {readFile,writeFile,unlink} from 'node:fs/promises';
import {createHash} from 'node:crypto';
if(process.env.STUDIO_ACCEPTANCE!=='1')throw new Error('Set STUDIO_ACCEPTANCE=1 only inside the isolated acceptance frontend container.');
const mode=process.argv[2], file='/tmp/xiaoying-lifecycle-state.json',base='http://127.0.0.1:3000';
const digest=(bytes)=>createHash('sha256').update(bytes).digest('hex');
async function request(path,cookie,options={}) {
  return fetch(base+path,{...options,headers:{'X-Studio-Request':'1',...(cookie?{Cookie:cookie}:{}),...options.headers}});
}
async function json(path,cookie){const response=await request(path,cookie);assert.equal(response.status,200);return response.json();}
async function waitFor(id,cookie,predicate){
  const until=Date.now()+20000;
  do { const task=await json('/api/tasks/'+id,cookie);if(predicate(task))return task;await new Promise(resolve=>setTimeout(resolve,100)); }while(Date.now()<until);
  throw new Error('Timed out waiting for task '+id);
}
async function create(cookie,asset,delay,failAtStage=null){
  const response=await request('/api/tasks',cookie,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({templateId:'pet-portrait',assetIds:[asset],simulation:{stepDelayMs:delay,failAtStage}})});
  assert.equal(response.status,202);return response.json();
}
if(mode==='prepare'){
  const response=await request('/api/auth/session',null,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({userId:'demo-chen'})});assert.equal(response.status,200);
  const cookie=response.headers.get('set-cookie').split(';',1)[0];
  const bytes=new Uint8Array(await (await request('/demo/sample-1.png')).arrayBuffer());
  const form=new FormData();form.append('templateId','pet-portrait');form.append('file',new Blob([bytes],{type:'image/png'}),'lifecycle.png');
  const uploaded=await request('/api/assets',cookie,{method:'POST',body:form});assert.equal(uploaded.status,201);const asset=await uploaded.json();
  const success=await create(cookie,asset.id,50),failed=await create(cookie,asset.id,50,'FINALIZE');
  const terminal=[];
  for(const task of [success,failed])terminal.push(await waitFor(task.id,cookie,t=>['SUCCEEDED','FAILED'].includes(t.status)));
  assert.equal(terminal[0].status,'SUCCEEDED');assert.equal(terminal[1].status,'FAILED');
  const running=await create(cookie,asset.id,30000);await waitFor(running.id,cookie,t=>t.status==='RUNNING'&&t.stage!==null);
  const queued=await create(cookie,asset.id,0);assert.equal(queued.status,'QUEUED');
  await writeFile(file,JSON.stringify({cookie,asset:asset.id,expectedHash:digest(bytes),terminal,running:running.id,queued:queued.id}),{mode:0o600});
  console.log(JSON.stringify({result:'PREPARED',terminal:terminal.map(t=>t.id),running:running.id,queued:queued.id}));
}else if(mode==='verify'){
  const state=JSON.parse(await readFile(file,'utf8'));
  try{
    assert.equal((await json('/api/auth/me',state.cookie)).id,'demo-chen');
    for(const previous of state.terminal)assert.deepEqual(await json('/api/tasks/'+previous.id,state.cookie),previous);
    const interrupted=await waitFor(state.running,state.cookie,t=>t.status==='FAILED');
    assert.match(interrupted.errorMessage,/重启/);
    const completed=await waitFor(state.queued,state.cookie,t=>t.status==='SUCCEEDED');
    for(const task of [state.terminal[0],completed]){
      const result=await request(task.resultUrl,state.cookie);assert.equal(result.status,200);assert.equal(digest(new Uint8Array(await result.arrayBuffer())),state.expectedHash);
    }
    const source=await request('/api/assets/'+state.asset+'/content',state.cookie);assert.equal(source.status,200);assert.equal(digest(new Uint8Array(await source.arrayBuffer())),state.expectedHash);
    const history=await json('/api/tasks',state.cookie);
    for(const id of [...state.terminal.map(t=>t.id),state.running,state.queued])assert.ok(history.some(t=>t.id===id));
    console.log(JSON.stringify({result:'PASS',checks:['session survives restart','terminal records unchanged','running marked interrupted','queued resumes','source and result bytes survive volume restart','history retained']}));
  }finally{await request('/api/auth/session',state.cookie,{method:'DELETE'}).catch(()=>{});await unlink(file).catch(()=>{});}
}else throw new Error('Use prepare or verify.');
