import test from 'node:test';
import assert from 'node:assert/strict';
import { FINISH, PLAYERS, TRACK, SAFE, LANES, createGame, legalMoves, rollGame, moveGame, tokenCell, trackIndex, isValidGame } from '../src/rules.js';
const withTokens=(positions,turn=0)=>{const s=createGame();s.tokens=positions.map(x=>[...x]);s.turn=turn;return s;};
test('board circuit has 52 unique contiguous cells',()=>{
  assert.equal(TRACK.length,52);assert.equal(new Set(TRACK.map(c=>c.join(','))).size,52);
  TRACK.forEach(([x,y],i)=>{const [a,b]=TRACK[(i+1)%52];assert.ok(Math.abs(x-a)<=1&&Math.abs(y-b)<=1);});
  assert.equal(SAFE.size,8);
});
test('every player enters the correct private lane',()=>{
  PLAYERS.forEach((p,i)=>{assert.deepEqual(tokenCell(i,0,0),TRACK[p.start]);assert.deepEqual(tokenCell(i,0,51),LANES[i][0]);const a=tokenCell(i,0,50),b=tokenCell(i,0,51);assert.equal(Math.abs(a[0]-b[0])+Math.abs(a[1]-b[1]),1);assert.equal(trackIndex(i,51),null);assert.equal(trackIndex(i,FINISH),null);});
});
test('initial state is valid and all tokens start in yards',()=>{const s=createGame();assert.equal(isValidGame(s),true);assert.deepEqual(s.tokens,Array.from({length:4},()=>[-1,-1,-1,-1]));assert.equal(s.turn,0);});
test('non-six cannot release a token and passes the turn',()=>{const s=rollGame(createGame(),3);assert.equal(s.turn,1);assert.equal(s.phase,'roll');assert.deepEqual(legalMoves(s),[]);});
test('six allows all four yard tokens to enter at progress zero',()=>{const s=rollGame(createGame(),6);assert.deepEqual(legalMoves(s),[0,1,2,3]);const result=moveGame(s,2);assert.equal(result.state.tokens[0][2],0);assert.equal(result.state.turn,0);assert.equal(result.state.phase,'roll');});
test('ordinary moves advance by the die value and change player',()=>{let s=createGame();s.tokens[0][0]=0;s=rollGame(s,4);const {state}=moveGame(s,0);assert.equal(state.tokens[0][0],4);assert.equal(state.turn,1);});
test('three consecutive sixes forfeit only the third roll',()=>{let s=createGame();s=moveGame(rollGame(s,6),0).state;s=moveGame(rollGame(s,6),0).state;s=rollGame(s,6);assert.equal(s.turn,1);assert.equal(s.tokens[0][0],6);assert.equal(s.sixes,0);assert.equal(s.phase,'roll');});
test('non-six resets the consecutive-six counter',()=>{let s=moveGame(rollGame(createGame(),6),0).state;s=moveGame(rollGame(s,2),0).state;assert.equal(s.sixes,0);});
test('unsafe landing captures an opponent and returns it to its yard',()=>{let s=withTokens([[16,-1,-1,-1],[9,-1,-1,-1],[-1,-1,-1,-1],[-1,-1,-1,-1]]);const {state,move}=moveGame(rollGame(s,6),0);assert.equal(state.tokens[0][0],22);assert.equal(state.tokens[1][0],-1);assert.equal(move.captured.length,1);assert.equal(state.turn,0);});
test('safe square prevents capture of an opposing token',()=>{let s=withTokens([[7,-1,-1,-1],[-1,-1,-1,-1],[34,-1,-1,-1],[-1,-1,-1,-1]]);const {state,move}=moveGame(rollGame(s,1),0);assert.equal(trackIndex(2,34),8);assert.equal(state.tokens[2][0],34);assert.equal(move.captured.length,0);});
test('all four colored entry cells are safe',()=>{for(const player of PLAYERS)assert.equal(SAFE.has(player.start),true);});
test('documented variant captures every opposing token on an unsafe square',()=>{let s=withTokens([[16,-1,-1,-1],[9,9,-1,-1],[-1,-1,-1,-1],[-1,-1,-1,-1]]);const {state,move}=moveGame(rollGame(s,6),0);assert.equal(move.captured.length,2);assert.deepEqual(state.tokens[1],[-1,-1,-1,-1]);});
test('own token is never captured',()=>{let s=createGame();s.tokens[0]=[16,22,-1,-1];const {state,move}=moveGame(rollGame(s,6),0);assert.deepEqual(state.tokens[0],[22,22,-1,-1]);assert.equal(move.captured.length,0);});
test('private home lanes cannot capture each other',()=>{let s=withTokens([[51,-1,-1,-1],[54,-1,-1,-1],[-1,-1,-1,-1],[-1,-1,-1,-1]]);const {state,move}=moveGame(rollGame(s,3),0);assert.equal(state.tokens[1][0],54);assert.equal(move.captured.length,0);});
test('home requires an exact roll; overshoots are not legal',()=>{let s=createGame();s.tokens[0]=[54,50,-1,-1];s=rollGame(s,3);assert.deepEqual(legalMoves(s),[1]);assert.throws(()=>moveGame(s,0));});
test('exact finish reaches 56, not another circuit cell',()=>{let s=createGame();s.tokens[0][0]=53;const {state,move}=moveGame(rollGame(s,3),0);assert.equal(state.tokens[0][0],FINISH);assert.equal(move.finish,true);assert.equal(state.turn,1);});
test('finishing every token ends the game and blocks another roll',()=>{let s=createGame();s.tokens[0]=[FINISH,FINISH,FINISH,55];s=moveGame(rollGame(s,1),3).state;assert.equal(s.phase,'won');assert.equal(s.winner,0);assert.equal(isValidGame(s),true);assert.throws(()=>rollGame(s,2));});
test('a six with no exact legal move retains the turn',()=>{let s=createGame();s.tokens[0]=[55,55,55,55];s=rollGame(s,6);assert.equal(s.turn,0);assert.equal(s.phase,'roll');assert.equal(s.sixes,1);});
test('two-player mode alternates only Red and Yellow',()=>{let s=createGame(2);s=rollGame(s,1);assert.equal(s.turn,2);s=rollGame(s,2);assert.equal(s.turn,0);assert.equal(isValidGame(s),true);});
test('engine operations never mutate their input',()=>{const s=createGame(),before=JSON.stringify(s);const rolled=rollGame(s,6),snapshot=JSON.stringify(rolled);moveGame(rolled,1);assert.equal(JSON.stringify(s),before);assert.equal(JSON.stringify(rolled),snapshot);});
test('bad dice, wrong-phase rolls, and invalid token indices are rejected',()=>{for(const x of [0,7,-1,2.5,NaN,'6'])assert.throws(()=>rollGame(createGame(),x));assert.throws(()=>createGame(3));const s=rollGame(createGame(),6);assert.throws(()=>rollGame(s,2));for(const t of [-1,4,1.5,'0'])assert.throws(()=>moveGame(s,t));});
test('saved-state validation rejects corrupt and impossible structures',()=>{for(const x of [null,{},[],{version:2},'bad'])assert.equal(isValidGame(x),false);for(const change of [s=>s.tokens[0][0]=200,s=>s.turn=8,s=>s.phase='moving',s=>s.dice=7,s=>s.active=[0,0],s=>s.history=['x'.repeat(501)],s=>s.winner=1,s=>s.sixes=3]){const s=createGame();change(s);assert.equal(isValidGame(s),false);}const s=createGame();s.phase='select';assert.equal(isValidGame(s),false);});
test('many deterministic full games finish without invalid states',()=>{
  let seed=555;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
  for(let game=0;game<24;game++){
    let s=createGame(game%2?2:4),iterations=0;
    while(s.phase!=='won'&&iterations++<15000){if(s.phase==='roll')s=rollGame(s,1+Math.floor(random()*6));else{const legal=legalMoves(s);s=moveGame(s,legal[Math.floor(random()*legal.length)]).state;}assert.equal(isValidGame(s),true);}
    assert.equal(s.phase,'won',`Simulation ${game} failed to finish`);
  }
});
