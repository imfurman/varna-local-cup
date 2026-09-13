import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {positionAt,trackSegments,categoryStanding} from '../src/lib/replay.js';
import {cleanTrack,findDwells,timerPauses} from '../scripts/finale-analysis.mjs';
const finale=JSON.parse(readFileSync('data/finale.json'));
const replay=JSON.parse(readFileSync('public/race-replay.json'));
const results=JSON.parse(readFileSync('data/results.json'));

test('one UTC clock interpolates riders, holds GPS gaps, never extrapolates before/after a recording',()=>{
 const track=[[100,43,27,0,0,null],[110,44,28,100,100,null],[200,45,29,200,200,50]];
 assert.equal(positionAt(track,99).state,'waiting');
 assert.deepEqual(positionAt(track,105).point,[105,43.5,27.5,50,50,null]);
 assert.equal(positionAt(track,150).state,'gap');
 assert.deepEqual(positionAt(track,150).point,track[1]);
 assert.deepEqual(positionAt(track,999).point,track[2]);
 assert.equal(positionAt(track,999).state,'ended');
 assert.equal(trackSegments(track).length,2);
 assert.equal(positionAt([],50),null);
});
test('GPS filter removes a teleport without discarding subsequent valid points',()=>{
 const {clean,rejected}=cleanTrack([{time:0,lat:43,lon:27},{time:1,lat:48,lon:30},{time:2,lat:43.00001,lon:27}]);
 assert.equal(clean.length,2);assert.deepEqual(rejected,[1]);
});
test('spatial dwell and device timer pause are independent and clipped to the ride',()=>{
 const points=[0,30,60,90].map(time=>({time,lat:43,lon:27,courseM:100}));
 assert.equal(findDwells(points)[0].seconds,90);
 const event=(seconds,eventType)=>({timestamp:new Date(seconds*1000),event:'timer',eventType});
 assert.deepEqual(timerPauses([event(10,'stopAll'),event(80,'start')],20,60),[{start:20,end:60,seconds:40}]);
 assert.equal(timerPauses([],20,60).length,0);
});
test('organizer female gold on a shortened route never becomes a fabricated full-course finish',()=>{
 const women=categoryStanding(finale.athletes,'female');assert.equal(women.length,1);
 assert.equal(women[0].place,1);assert.equal(women[0].rank,5);assert.equal(women[0].complete,false);
 assert.equal(women[0].courseAverageKmh,null);assert.equal(results.some(r=>r.riderId===women[0].id),false);
 assert.deepEqual(categoryStanding(finale.athletes).map(a=>a.id),['ruslan-shchur','ilya-garkusha','andrey-tikhiy','nikita-bez','evgeniya-shatskaya']);
});
test('published replay matches analysis boundaries, source hashes and all official complete times',()=>{
 assert.equal(replay.courseHash,finale.courseHash);assert.equal(replay.eventId,finale.eventId);
 for(const a of finale.athletes){const points=replay.tracks[a.id];assert.equal(points[0][0],a.start);assert.equal(points.at(-1)[0],a.end);assert.equal(a.elapsed,a.end-a.start);
 for(let i=1;i<points.length;i++)assert.ok(points[i][0]>points[i-1][0]);
 assert.ok(points.every(p=>p.length===6&&p.slice(0,5).every(Number.isFinite)));
 if(a.complete){const r=results.find(r=>r.riderId===a.id);assert.equal(r.elapsedSeconds,a.elapsed);assert.equal(r.sourceHash,a.sourceHash);}
 }
 const nikita=finale.athletes.find(a=>a.id==='nikita-bez'),ruslan=finale.athletes[0];
 assert.equal(ruslan.splits.find(s=>s.toKm===30).end-nikita.splits.find(s=>s.toKm===30).end,214);
 assert.equal(nikita.splits.find(s=>s.toKm===35).seconds,3936);
});
