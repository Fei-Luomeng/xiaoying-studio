import test from 'node:test';
import assert from 'node:assert/strict';
import { decodeTask, decodeTasks, stages } from '../src/lib/tasks.ts';

function task(id, status='QUEUED', stage=null) {
  return decodeTask({ id, ownerId:'demo-chen', templateId:'pet-portrait', status, stage,
    errorMessage:status==='FAILED'?'模拟生成：按演示配置模拟失败。':null,
    resultUrl:status==='SUCCEEDED'?`/api/tasks/${id}/result`:null,
    createdAt:'2026-11-02T10:00:00Z',updatedAt:'2026-11-02T10:00:00Z',finishedAt:null,
    steps:stages.map((s)=>({stage:s,status:s===stage?'RUNNING':'WAITING',startedAt:null,finishedAt:null,errorMessage:null})) });
}

test('malformed task responses are request errors, never fabricated failed jobs', () => {
  assert.throws(()=>decodeTask({...task('one'),status:'NOT_A_STATUS'}),/格式异常/);
  assert.throws(()=>decodeTask({...task('one'),resultUrl:'https://example.com/other-user.png'}),/格式异常/);
  assert.throws(()=>decodeTask({...task('one'),steps:[]}),/格式异常/);
  assert.throws(()=>decodeTask({...task('one'),ownerId:''}),/格式异常/);
  assert.throws(()=>decodeTask({...task('one'),createdAt:'not a date'}),/格式异常/);
  assert.throws(()=>decodeTasks({tasks:[]}),/格式异常/);
});
