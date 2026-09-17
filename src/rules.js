/**
 * Rendering-independent, deterministic rules for our documented local Ludo variant.
 * No DOM, Three.js, timers, storage, or random number generation belongs here.
 * progress: -1 = yard, 0..50 = shared circuit, 51..55 = private lane, 56 = finished.
 */
export const FINISH = 56;
export const PLAYERS = Object.freeze([
  { id: 'red', name: 'Red', hex: '#df5d62', start: 0, label: '01' },
  { id: 'green', name: 'Green', hex: '#37a880', start: 13, label: '02' },
  { id: 'yellow', name: 'Yellow', hex: '#e9b841', start: 26, label: '03' },
  { id: 'blue', name: 'Blue', hex: '#4c87d3', start: 39, label: '04' }
]);
export const TRACK = Object.freeze([
  [1,6],[2,6],[3,6],[4,6],[5,6],
  [6,5],[6,4],[6,3],[6,2],[6,1],[6,0],[7,0],[8,0],
  [8,1],[8,2],[8,3],[8,4],[8,5],
  [9,6],[10,6],[11,6],[12,6],[13,6],[14,6],[14,7],[14,8],
  [13,8],[12,8],[11,8],[10,8],[9,8],
  [8,9],[8,10],[8,11],[8,12],[8,13],[8,14],[7,14],[6,14],
  [6,13],[6,12],[6,11],[6,10],[6,9],
  [5,8],[4,8],[3,8],[2,8],[1,8],[0,8],[0,7],[0,6]
].map(Object.freeze));
export const SAFE = new Set([0,8,13,21,26,34,39,47]);
export const LANES = Object.freeze([
  [[1,7],[2,7],[3,7],[4,7],[5,7]],
  [[7,1],[7,2],[7,3],[7,4],[7,5]],
  [[13,7],[12,7],[11,7],[10,7],[9,7]],
  [[7,13],[7,12],[7,11],[7,10],[7,9]]
]);
export const YARDS = Object.freeze([
  [[1.8,1.8],[4.2,1.8],[1.8,4.2],[4.2,4.2]],
  [[9.8,1.8],[12.2,1.8],[9.8,4.2],[12.2,4.2]],
  [[9.8,9.8],[12.2,9.8],[9.8,12.2],[12.2,12.2]],
  [[1.8,9.8],[4.2,9.8],[1.8,12.2],[4.2,12.2]]
]);
export const FINISH_CENTERS = [[6.15,7],[7,6.15],[7.85,7],[7,7.85]];

export function createGame(playerCount = 4) {
  if (![2, 4].includes(playerCount)) throw new RangeError('Choose two or four players.');
  return {
    version: 1, playerCount, active: playerCount === 2 ? [0, 2] : [0, 1, 2, 3],
    turn: 0, dice: null, phase: 'roll', sixes: 0, rollCount: 0, winner: null,
    tokens: Array.from({ length: 4 }, () => [-1, -1, -1, -1]),
    message: 'Red starts. Roll a six to leave the yard.',
    history: ['New game. Red starts.']
  };
}
export function copyGame(state) {
  return { ...state, active: [...state.active], tokens: state.tokens.map(row => [...row]), history: [...state.history] };
}
export function trackIndex(player, progress) {
  return progress >= 0 && progress <= 50 ? (PLAYERS[player].start + progress) % 52 : null;
}
export function tokenCell(player, token, progress) {
  if (progress === -1) return YARDS[player][token];
  if (progress === FINISH) {
    const [x, z] = FINISH_CENTERS[player];
    return [x + (token % 2 ? .15 : -.15), z + (token < 2 ? -.15 : .15)];
  }
  if (progress >= 51) return LANES[player][progress - 51];
  return TRACK[trackIndex(player, progress)];
}
export function legalMoves(state) {
  if (state.phase !== 'select' || !state.dice || state.winner !== null) return [];
  return state.tokens[state.turn].flatMap((progress, index) => {
    const legal = progress === -1 ? state.dice === 6 : progress < FINISH && progress + state.dice <= FINISH;
    return legal ? [index] : [];
  });
}
function record(state, text) {
  state.message = text;
  state.history = [text, ...state.history].slice(0, 10);
}
function nextTurn(state) {
  state.turn = state.active[(state.active.indexOf(state.turn) + 1) % state.active.length];
  state.phase = 'roll';
  state.sixes = 0;
}
export function rollGame(input, value) {
  if (input.phase !== 'roll' || input.winner !== null) throw new Error('Finish the current move before rolling.');
  if (!Number.isInteger(value) || value < 1 || value > 6) throw new RangeError('The die must be an integer from 1 to 6.');
  const state = copyGame(input);
  const name = PLAYERS[state.turn].name;
  state.dice = value;
  state.rollCount += 1;
  state.sixes = value === 6 ? state.sixes + 1 : 0;
  if (state.sixes === 3) {
    nextTurn(state);
    record(state, `${name} rolled a third six; the turn passes to ${PLAYERS[state.turn].name}.`);
    return state;
  }
  state.phase = 'select';
  if (legalMoves(state).length === 0) {
    if (value === 6) {
      state.phase = 'roll';
      record(state, `${name} rolled 6 but has no legal move. Roll again.`);
    } else {
      nextTurn(state);
      record(state, `${name} rolled ${value}: no legal move. ${PLAYERS[state.turn].name}'s turn.`);
    }
  } else record(state, `${name} rolled ${value}. Choose a highlighted token.`);
  return state;
}
export function moveGame(input, tokenIndex) {
  if (!Number.isInteger(tokenIndex) || !legalMoves(input).includes(tokenIndex)) throw new Error('That token cannot move.');
  const state = copyGame(input);
  const player = state.turn;
  const before = state.tokens[player][tokenIndex];
  const after = before === -1 ? 0 : before + state.dice;
  state.tokens[player][tokenIndex] = after;
  const captured = [];
  const landing = trackIndex(player, after);
  if (landing !== null && !SAFE.has(landing)) {
    for (const opponent of state.active) {
      if (opponent === player) continue;
      state.tokens[opponent].forEach((position, token) => {
        if (trackIndex(opponent, position) === landing) {
          state.tokens[opponent][token] = -1;
          captured.push({ player: opponent, token, from: position });
        }
      });
    }
  }
  const name = PLAYERS[player].name;
  const finish = after === FINISH;
  const extra = state.dice === 6;
  if (state.tokens[player].every(value => value === FINISH)) {
    state.winner = player;
    state.phase = 'won';
    record(state, `${name} wins! All four tokens are home.`);
  } else {
    if (extra) state.phase = 'roll'; else nextTurn(state);
    let text = before === -1 ? `${name} brought token ${tokenIndex + 1} out.` : `${name} moved token ${tokenIndex + 1} by ${input.dice}.`;
    if (captured.length) text += ` Captured ${captured.length} token${captured.length === 1 ? '' : 's'}!`;
    if (finish) text += ' Home!';
    text += extra ? ' Six: roll again.' : ` ${PLAYERS[state.turn].name}'s turn.`;
    record(state, text);
  }
  return { state, move: { player, token: tokenIndex, before, after, captured, finish } };
}
/** Untrusted saved games are checked before being allowed back into the engine. */
export function isValidGame(s) {
  if (!s || s.version !== 1 || ![2,4].includes(s.playerCount)) return false;
  const expected = s.playerCount === 2 ? [0,2] : [0,1,2,3];
  if (JSON.stringify(s.active) !== JSON.stringify(expected) || !expected.includes(s.turn)) return false;
  if (!Array.isArray(s.tokens) || s.tokens.length !== 4 || s.tokens.some(row => !Array.isArray(row) || row.length !== 4 || row.some(n => !Number.isInteger(n) || n < -1 || n > FINISH))) return false;
  if (s.dice !== null && (!Number.isInteger(s.dice) || s.dice < 1 || s.dice > 6)) return false;
  if (!['roll','select','won'].includes(s.phase) || !Number.isInteger(s.sixes) || s.sixes < 0 || s.sixes > 2) return false;
  if (!Number.isInteger(s.rollCount) || s.rollCount < 0 || s.rollCount > 1000000) return false;
  if (!Array.isArray(s.history) || s.history.length > 10 || s.history.some(x => typeof x !== 'string' || x.length > 500)) return false;
  if (typeof s.message !== 'string' || s.message.length > 500) return false;
  if (s.phase === 'won') return expected.includes(s.winner) && s.winner === s.turn && s.tokens[s.winner].every(n => n === FINISH);
  if (s.winner !== null || expected.some(p => s.tokens[p].every(n => n === FINISH))) return false;
  return s.phase !== 'select' || legalMoves(s).length > 0;
}
