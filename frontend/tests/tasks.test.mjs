import test from 'node:test';
import assert from 'node:assert/strict';
import { acceptTask, decodeTask, decodeTasks, queryFailed, querySucceeded, stages } from '../src/lib/tasks.ts';

function task(id, status='QUEUED', stage=null) {
  return decodeTask({ id, ownerId:'demo-chen', templateId:'pet-portrait', status, stage,
    errorMessage:status==='FAILED'?'模拟生成：按演示配置模拟失败。':null,
    resultUrl:status==='SUCCEEDED'?`/api/tasks/${id}/result`:null,
    createdAt:'2026-11-02T10:00:00Z',updatedAt:'2026-11-02T10:00:00Z',finishedAt:null,
    steps:stages.map((s)=>({stage:s,status:s===stage?'RUNNING':'WAITING',startedAt:null,finishedAt:null,errorMessage:null})) });
}

test('two accepted jobs retain separate stage, failure and result fields', () => {
  let state=acceptTask({tasks:[],queryError:null},task('first'));
  state=acceptTask(state,task('second'));
  assert.deepEqual(state.tasks.map((t)=>t.id),['second','first']);
  state=querySucceeded([task('second','SUCCEEDED','FINALIZE'),task('first','FAILED','GENERATE')]);
  assert.equal(state.tasks[0].resultUrl,'/api/tasks/second/result');
  assert.equal(state.tasks[0].errorMessage,null);
  assert.equal(state.tasks[1].resultUrl,null);
  assert.match(state.tasks[1].errorMessage,/模拟失败/);
  assert.equal(state.tasks[1].stage,'GENERATE');
});

test('temporary query failure preserves pending and terminal jobs; later success recovers query feedback', () => {
  const previous=querySucceeded([task('working','RUNNING','GENERATE'),task('done','SUCCEEDED','FINALIZE')]);
  const failed=queryFailed(previous,'网络连接异常');
  assert.equal(failed.tasks,previous.tasks);
  assert.equal(failed.tasks[0].status,'RUNNING');
  assert.equal(failed.tasks[1].status,'SUCCEEDED');
  assert.equal(failed.tasks[0].errorMessage,null);
  assert.equal(previous.queryError,null);
  const recovered=querySucceeded([task('working','SUCCEEDED','FINALIZE'),previous.tasks[1]]);
  assert.equal(recovered.queryError,null);
  assert.equal(recovered.tasks[0].resultUrl,'/api/tasks/working/result');
});

test('new submission while query is unavailable preserves existing records and query error', () => {
  const before=queryFailed(querySucceeded([task('first','FAILED','GENERATE')]),'查询暂时失败');
  const after=acceptTask(before,task('second'));
  assert.equal(before.tasks.length,1);
  assert.equal(after.tasks.length,2);
  assert.equal(after.queryError,'查询暂时失败');
  assert.equal(after.tasks[1],before.tasks[0]);
});

test('malformed task responses are request errors, never fabricated failed jobs', () => {
  assert.throws(()=>decodeTask({...task('one'),status:'NOT_A_STATUS'}),/格式异常/);
  assert.throws(()=>decodeTask({...task('one'),resultUrl:'https://example.com/other-user.png'}),/格式异常/);
  assert.throws(()=>decodeTask({...task('one'),steps:[]}),/格式异常/);
  assert.throws(()=>decodeTasks({tasks:[]}),/格式异常/);
});
