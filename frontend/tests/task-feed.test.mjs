import test from 'node:test';
import assert from 'node:assert/strict';
import { createTaskFeed, decodeTask, mergeTasks, stages } from '../src/lib/tasks.ts';

const flush = async () => { for (let i=0;i<40;i++) await Promise.resolve(); };
function deferred() { let resolve, reject; const promise=new Promise((yes,no)=>{resolve=yes;reject=no;}); return {promise,resolve,reject}; }
function clock() {
  let now=0, next=0; const timers=new Map();
  return {
    schedule(callback,delay) { const id=++next; timers.set(id,{at:now+delay,callback}); return id; },
    cancel(id) { timers.delete(id); },
    count:()=>timers.size,
    async advance(ms) {
      const target=now+ms;
      for (;;) {
        const first=[...timers].filter(([,v])=>v.at<=target).sort((a,b)=>a[1].at-b[1].at||a[0]-b[0])[0];
        if (!first) break;
        timers.delete(first[0]); now=first[1].at; first[1].callback(); await flush();
      }
      now=target; await flush();
    },
  };
}
function task(id,status='QUEUED',stage=null,ownerId='demo-chen',updated) {
  const final=status==='SUCCEEDED'||status==='FAILED';
  const current=stage??(status==='RUNNING'?'GENERATE':status==='SUCCEEDED'?'FINALIZE':status==='FAILED'?'GENERATE':null);
  const rank=final?4:status==='RUNNING'?2:1;
  return decodeTask({id,ownerId,templateId:'pet-portrait',status,stage:current,
    createdAt:'2026-11-02T10:00:00Z',updatedAt:updated??`2026-11-02T10:00:0${rank}Z`,finishedAt:final?'2026-11-02T10:00:04Z':null,
    errorMessage:status==='FAILED'?'模拟生成：按演示配置模拟失败。':null,resultUrl:status==='SUCCEEDED'?`/api/tasks/${id}/result`:null,
    steps:stages.map((s,index)=>({stage:s,status:current===null?'WAITING':index<stages.indexOf(current)?'SUCCEEDED':s===current?(status==='FAILED'?'FAILED':final?'SUCCEEDED':'RUNNING'):'WAITING',startedAt:null,finishedAt:null,errorMessage:null}))});
}
function harness({history=async()=>[],individual=async(id)=>task(id,'SUCCEEDED'),ownerId='demo-chen',templateId}={}) {
  const time=clock(), calls=[], signals=[]; let lost=0;
  const feed=createTaskFeed({ownerId,templateId,schedule:time.schedule,cancel:time.cancel,
    loadHistory:(signal)=>{calls.push('history');signals.push(signal);return history(signal);},
    loadTask:(id,signal)=>{calls.push(id);signals.push(signal);return individual(id,signal);},
    onIdentityLost:()=>{lost++;}});
  return {feed,time,calls,signals,lost:()=>lost};
}

test('initial restoration automatically tracks each pending job, never queries terminal jobs, then stops',async()=>{
  const counts={};
  const h=harness({history:async()=>[task('done','SUCCEEDED'),task('one'),task('two')],individual:async(id)=>{
    counts[id]=(counts[id]??0)+1;
    return id==='one'?task(id,'SUCCEEDED'):task(id,counts[id]===1?'RUNNING':'FAILED');
  }});
  h.feed.start(); await flush(); assert.equal(h.feed.getSnapshot().historyLoaded,true);
  await h.time.advance(2000);
  assert.deepEqual(h.calls,['history','two','one']);
  assert.equal(h.feed.getSnapshot().tasks.find(t=>t.id==='one').resultUrl,'/api/tasks/one/result');
  await h.time.advance(2000);
  assert.deepEqual(h.calls,['history','two','one','two']);
  assert.equal(h.feed.getSnapshot().tasks.find(t=>t.id==='two').status,'FAILED');
  assert.equal(h.time.count(),0);
  await h.time.advance(20000); assert.equal(h.calls.length,4); h.feed.stop();
});

test('one query failure pauses only that job while another can fail or succeed independently; manual retry resumes',async()=>{
  let available=false;
  const h=harness({history:async()=>[task('offline','RUNNING'),task('other')],individual:async(id)=>{
    if(id==='offline'&&!available) throw new TypeError('network unavailable');
    return task(id,id==='other'?'FAILED':'SUCCEEDED');
  }});
  h.feed.start(); await flush(); await h.time.advance(2000);
  let snapshot=h.feed.getSnapshot();
  assert.equal(snapshot.tasks.find(t=>t.id==='offline').status,'RUNNING');
  assert.equal(snapshot.tasks.find(t=>t.id==='offline').errorMessage,null);
  assert.match(snapshot.taskErrors.offline,/查询/);
  assert.equal(snapshot.tasks.find(t=>t.id==='other').status,'FAILED');
  assert.match(snapshot.tasks.find(t=>t.id==='other').errorMessage,/模拟失败/);
  assert.equal(snapshot.taskErrors.other,undefined); assert.equal(h.time.count(),0);
  available=true; h.feed.refresh(); await flush(); await h.time.advance(2000);
  snapshot=h.feed.getSnapshot();
  assert.equal(snapshot.tasks.find(t=>t.id==='offline').status,'SUCCEEDED');
  assert.deepEqual(snapshot.taskErrors,{}); assert.equal(h.time.count(),0); h.feed.stop();
});

test('initial history errors stop requests until recovery, without fabricating failed records',async()=>{
  let available=false;
  const h=harness({history:async()=>{if(!available)throw new Error('503');return [task('restored')];}});
  h.feed.start(); await flush();
  assert.equal(h.feed.getSnapshot().historyLoaded,false); assert.match(h.feed.getSnapshot().historyError,/查询/);
  assert.deepEqual(h.feed.getSnapshot().tasks,[]); assert.equal(h.time.count(),0);
  await h.time.advance(20000); assert.deepEqual(h.calls,['history']);
  available=true; h.feed.refresh(); await flush(); await h.time.advance(2000);
  assert.equal(h.feed.getSnapshot().historyError,null); assert.equal(h.feed.getSnapshot().tasks[0].status,'SUCCEEDED'); h.feed.stop();
});

test('failed history refresh retains already known results and pending stages',async()=>{
  let available=true;
  const h=harness({history:async()=>{if(!available)throw new Error('503');return [task('working','RUNNING'),task('done','SUCCEEDED')];}});
  h.feed.start(); await flush(); const before=h.feed.getSnapshot().tasks;
  available=false; h.feed.refresh(); await flush();
  assert.equal(h.feed.getSnapshot().tasks,before);
  assert.equal(h.feed.getSnapshot().tasks.find(t=>t.id==='working').status,'RUNNING');
  assert.equal(h.feed.getSnapshot().tasks.find(t=>t.id==='done').resultUrl,'/api/tasks/done/result');
  assert.equal(h.time.count(),0); h.feed.stop();
});

test('switching users aborts old history and ignores even a response that disregards cancellation',async()=>{
  const late=deferred(), first=harness({history:()=>late.promise});
  first.feed.start(); assert.equal(first.feed.getSnapshot().historyLoading,true);
  first.feed.stop(); assert.equal(first.feed.getSnapshot().historyLoading,false);
  const changes=[]; first.feed.subscribe(()=>changes.push(true));
  const second=harness({ownerId:'demo-lin',history:async()=>[task('lin','SUCCEEDED',null,'demo-lin')]});
  second.feed.start(); await flush(); late.resolve([task('chen','SUCCEEDED')]); await flush();
  assert.equal(first.signals[0].aborted,true); assert.equal(first.time.count(),0); assert.equal(changes.length,0);
  assert.deepEqual(second.feed.getSnapshot().tasks.map(t=>t.id),['lin']); assert.equal(second.lost(),0); second.feed.stop();
});

test('page cleanup cancels an active poll and timers; late poll cannot overwrite a restarted scope',async()=>{
  const late=deferred(), current=deferred(); let queries=0;
  const h=harness({history:async()=>[task('one','RUNNING')],individual:()=>++queries===1?late.promise:current.promise});
  h.feed.start(); await flush(); await h.time.advance(2000);
  assert.equal(h.feed.getSnapshot().polling,true);
  const before=h.feed.getSnapshot().tasks;
  h.feed.stop();
  assert.equal(h.feed.getSnapshot().polling,false);
  assert.equal(h.feed.getSnapshot().historyLoading,false);
  assert.equal(h.feed.getSnapshot().tasks,before);
  assert.equal(h.signals.at(-1).aborted,true); assert.equal(h.time.count(),0);
  const stopped=h.feed.getSnapshot(); h.feed.stop(); assert.equal(h.feed.getSnapshot(),stopped);
  h.feed.start(); await flush(); assert.equal(h.feed.getSnapshot().polling,false);
  await h.time.advance(2000); assert.equal(h.feed.getSnapshot().polling,true);
  late.resolve(task('one','SUCCEEDED')); await flush();
  assert.equal(h.feed.getSnapshot().tasks[0].status,'RUNNING');
  assert.equal(h.feed.getSnapshot().polling,true);
  current.resolve(task('one','SUCCEEDED')); await flush();
  assert.equal(h.feed.getSnapshot().polling,false);
  assert.equal(h.feed.getSnapshot().tasks[0].status,'SUCCEEDED'); assert.equal(h.time.count(),0); h.feed.stop();
});

test('a new acceptance invalidates an older history request and is automatically followed',async()=>{
  const late=deferred(); let count=0;
  const h=harness({history:()=>++count===1?late.promise:Promise.resolve([task('new')])});
  h.feed.start(); h.feed.accepted(task('new')); await flush();
  assert.equal(h.signals[0].aborted,true);
  late.resolve([]); await flush(); assert.equal(h.feed.getSnapshot().tasks[0].id,'new');
  await h.time.advance(2000); assert.equal(h.feed.getSnapshot().tasks[0].status,'SUCCEEDED'); assert.equal(h.time.count(),0); h.feed.stop();
});

test('manual refresh aborts a prior poll and an old snapshot cannot regress a terminal record',async()=>{
  const late=deferred(); let count=0;
  const h=harness({history:async()=>[task('one',++count===1?'RUNNING':'FAILED')],individual:()=>late.promise});
  h.feed.start(); await flush(); await h.time.advance(2000); h.feed.refresh(); await flush();
  assert.equal(h.signals[1].aborted,true); late.resolve(task('one','RUNNING')); await flush();
  assert.equal(h.feed.getSnapshot().tasks[0].status,'FAILED'); assert.equal(h.time.count(),0); h.feed.stop();
});

test('query timeout aborts the request and preserves backend status, without endless retry',async()=>{
  const h=harness({history:async()=>[task('one','RUNNING')],individual:()=>new Promise(()=>{})});
  h.feed.start(); await flush(); await h.time.advance(2000); await h.time.advance(15000);
  assert.equal(h.signals[1].aborted,true); assert.equal(h.feed.getSnapshot().tasks[0].status,'RUNNING');
  assert.match(h.feed.getSnapshot().taskErrors.one,/超时/); assert.equal(h.time.count(),0); h.feed.stop();
});

test('401 or a response owned by a different user clears the scope and requests identity restoration',async()=>{
  for(const history of [async()=>{throw {status:401};},async()=>[task('other','SUCCEEDED',null,'demo-lin')]]) {
    const h=harness({history}); h.feed.start(); await flush();
    assert.equal(h.lost(),1); assert.deepEqual(h.feed.getSnapshot().tasks,[]); assert.equal(h.time.count(),0);
  }
});

test('poll responses must match the requested task and template',async()=>{
  for(const response of [task('wrong','SUCCEEDED'),{...task('one','SUCCEEDED'),templateId:'different'}]) {
    const h=harness({templateId:'pet-portrait',history:async()=>[task('one')],individual:async()=>response});
    h.feed.start(); await flush(); await h.time.advance(2000);
    assert.equal(h.lost(),1); assert.deepEqual(h.feed.getSnapshot().tasks,[]); assert.equal(h.time.count(),0);
  }
});

test('polling limits simultaneous requests to four for a large pending set',async()=>{
  const waits=new Map(); let active=0, maximum=0;
  const h=harness({history:async()=>Array.from({length:9},(_,i)=>task(String(i))),individual:async(id)=>{
    active++; maximum=Math.max(maximum,active); const wait=deferred(); waits.set(id,wait); await wait.promise; active--; return task(id,'SUCCEEDED');
  }});
  h.feed.start(); await flush(); await h.time.advance(2000); assert.equal(waits.size,4);
  while(active) { const current=[...waits.values()]; waits.clear(); current.forEach(wait=>wait.resolve()); await flush(); }
  assert.equal(maximum,4); assert.equal(h.feed.getSnapshot().tasks.length,9);
  assert.ok(h.feed.getSnapshot().tasks.every(t=>t.status==='SUCCEEDED')); assert.equal(h.time.count(),0); h.feed.stop();
});

test('merge ignores older updates and never turns success or failure back into processing',()=>{
  const running=task('one','RUNNING');
  assert.equal(mergeTasks([running],[task('one')])[0],running);
  const microseconds=task('one','RUNNING','GENERATE','demo-chen','2026-11-02T10:00:02.0002Z');
  const older=task('one','RUNNING','MATERIAL_CHECK','demo-chen','2026-11-02T10:00:02.0001Z');
  assert.equal(mergeTasks([microseconds],[older])[0],microseconds);
  for(const terminal of [task('one','SUCCEEDED'),task('one','FAILED')]) {
    assert.equal(mergeTasks([terminal],[task('one','RUNNING',null,'demo-chen','2026-11-02T10:10:00Z')])[0],terminal);
  }
  assert.throws(()=>decodeTask({...running,updatedAt:'invalid date'}),/格式异常/);
});

test('an empty or already finished history performs one load and starts no polling timer',async()=>{
  for(const records of [[],[task('done','SUCCEEDED')]]) {
    const h=harness({history:async()=>records}); h.feed.start(); await flush();
    assert.equal(h.feed.getSnapshot().historyLoaded,true); assert.equal(h.time.count(),0);
    await h.time.advance(30000); assert.deepEqual(h.calls,['history']); h.feed.stop();
  }
});
