'use strict';
const assert = require('node:assert/strict');
const ScoreCore = require('../App/score-core.js');

const calculate = (settings, extra = {}) => ScoreCore.calculate({ settings, randomValue: 0.5, ...extra });

assert.equal(calculate({ scoreMode: 'random', minRandomScore: 80 }).score, 90);
assert.deepEqual(calculate({ scoreMode: 'mic' }, { micAvailable: true, micScore: 87 }).meta.sources, { mic: 100 });
assert.equal(calculate({ scoreMode: 'mic', minRandomScore: 75 }, { micAvailable: false }).meta.source, 'fallback-random');
assert.deepEqual(calculate({ scoreMode: 'audience' }, { votes: { a: { stars: 5 }, b: { stars: 3 } } }), {
    score: 80,
    meta: { mode: 'audience', voteCount: 2, fallback: false, sources: { audience: 100 }, source: 'audience' }
});
assert.equal(calculate({ scoreMode: 'audience' }, { votes: {}, legacyScore: 73 }).meta.source, 'fallback-legacy');
assert.equal(calculate({ scoreMode: 'audience' }, { votes: {}, legacyScore: 73 }).score, 73);
assert.equal(calculate({ scoreMode: 'mixed', scoreWeights: { mic: 20, audience: 70, random: 10 } }, {
    micAvailable: true, micScore: 80, votes: { a: { stars: 5 } }
}).score, 95);
const redistributed = calculate({ scoreMode: 'mixed', scoreWeights: { mic: 20, audience: 70, random: 10 } }, {
    micAvailable: false, votes: { a: { stars: 4 } }
});
assert.equal(redistributed.score, 81);
assert.equal(redistributed.meta.fallback, true);
assert.equal(redistributed.meta.sources.mic, undefined);
assert.equal(calculate({ scoreMode: 'mixed', scoreWeights: { mic: 50, audience: 50, random: 0 } }, {
    micAvailable: false, votes: {}
}).meta.source, 'fallback-random');
assert.equal(ScoreCore.normalizeSettings({ scoreMode: 'mixed', scoreWeights: { mic: 2, audience: 2, random: 2 } }).scoreWeights.audience, 70);
assert.equal(ScoreCore.normalizeSettings({ minRandomScore: 0 }).minRandomScore, 0);

console.log('score-core: 13 verificações validadas');
