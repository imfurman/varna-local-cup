import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildCommentary,commentaryAt} from '../src/lib/race-commentary.js';
import {stories} from '../src/finale-stories.js';
const finale=JSON.parse(readFileSync('data/finale.json'));
const events=buildCommentary(finale);
const rider=id=>finale.athletes.find(a=>a.id===id);
const gate=(a,km)=>a.splits.find(s=>s.toKm===km).end;

test('commentator never selects a future event and rewinding restores the earlier call',()=>{
 assert.equal(commentaryAt(events,finale.start-1),null);
 for(let j=0;j<events.length;j++){
  const e=events[j];assert.equal(commentaryAt(events,e.at).id,e.id);
  assert.notEqual(commentaryAt(events,e.at-1)?.id,e.id);
 }
 assert.equal(commentaryAt(events,finale.end).id,'last-finish');
 assert.equal(commentaryAt(events,events[2].at).id,events[2].id);
 assert.equal(commentaryAt([],0),null);
});
test('gap comparisons wait until the trailing rider reaches the same checkpoint',()=>{
 const n=rider('nikita-bez'),r=rider('ruslan-shchur'),i=rider('ilya-garkusha'),a=rider('andrey-tikhiy');
 const event=id=>events.find(e=>e.id===id);
 assert.equal(event('twenty-five').at,gate(r,25));assert.equal(gate(r,25)-gate(n,25),147);
 assert.equal(event('thirty-gap').at,gate(r,30));assert.equal(gate(r,30)-gate(n,30),214);
 assert.equal(event('thirty-five').at,gate(i,35));assert.equal(gate(i,35)-gate(a,35),28);
 assert.equal(gate(a,40)-gate(i,40),109);
 assert.equal(a.splits.find(s=>s.toKm===40).seconds-i.splits.find(s=>s.toKm===40).seconds,137);
 const four=[r,i,a,n];assert.equal(event('first-five').at,Math.max(...four.map(a=>gate(a,5))));
 assert.equal(Math.max(...four.map(a=>gate(a,5)))-Math.min(...four.map(a=>gate(a,5))),10);
 assert.equal(event('fast-five').at,Math.max(...four.map(a=>gate(a,20))));
});
test('every story chapter links to a real localized replay event within the recording',()=>{
 assert.equal(new Set(events.map(e=>e.id)).size,events.length);
 for(const e of events){assert.ok(e.at>=finale.start&&e.at<=finale.end);assert.ok(rider(e.riderId));for(const pair of [e.text,e.tag,e.bubble])assert.ok(pair.length===2&&pair.every(s=>typeof s==='string'&&s.length>0));}
 for(const a of finale.athletes){const story=stories[a.id];assert.ok(story.chapters.length>=3);for(const c of story.chapters){if(c.event)assert.ok(events.some(e=>e.id===c.event));for(const pair of [c.tag,c.title,c.text])assert.ok(pair.length===2&&pair.every(s=>s.length));}}
});
