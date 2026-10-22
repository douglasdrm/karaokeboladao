'use strict';
const assert = require('node:assert/strict');
const ChallengeCore = require('../App/challenge-core.js');

const now = 1_800_000_000_000;
const members = {
    host: { uid: 'host', name: 'DJ' },
    author: { uid: 'author', name: 'Ana' },
    target: { uid: 'target', name: 'Beto' },
    guest: { uid: 'guest', name: 'Caio' }
};
const env = { active: true, now, hostUid: 'host', members, songs: { '10': { id: '10', title: 'Canção', artist: 'Artista' } } };
const command = (key, uid, action, extra = {}) => ({ key, uid, action, timestamp: now, ...extra });
const apply = (state, cmd, customEnv = env) => ChallengeCore.reduce(state, cmd, customEnv);

let state = apply(null, command('directed', 'author', 'create', { songId: '10', targetUid: 'target' }));
let directed = state.items.directed;
assert.equal(directed.targetUid, 'target');
assert.equal(directed.targetName, 'Beto');
assert.equal(ChallengeCore.canView(directed, 'author', 'host'), true);
assert.equal(ChallengeCore.canView(directed, 'target', 'host'), true);
assert.equal(ChallengeCore.canView(directed, 'host', 'host'), true);
assert.equal(ChallengeCore.canView(directed, 'guest', 'host'), false);

state = apply(state, command('wrong_accept', 'guest', 'accept', { challengeId: 'directed', revealed: true }));
assert.equal(state.items.directed.status, 'open');
assert.equal(state.receipts.wrong_accept.ok, false);
state = apply(state, command('wrong_decline', 'author', 'decline', { challengeId: 'directed' }));
assert.equal(state.items.directed.status, 'open');
assert.equal(state.receipts.wrong_decline.ok, false);

state = apply(state, command('accept', 'target', 'accept', { challengeId: 'directed', revealed: true, partners: ['guest'] }));
assert.equal(state.items.directed.status, 'forming');
assert.equal(ChallengeCore.canView(state.items.directed, 'guest', 'host'), true);
state = apply(state, command('confirm', 'guest', 'confirm', { challengeId: 'directed', revealed: true }));
assert.equal(state.items.directed.status, 'ready');
const request = ChallengeCore.request(state.items.directed);
assert.equal(request.singerUid, 'target');
assert.deepEqual(request.recipientUids.sort(), ['guest', 'target']);
assert.equal(request.challenge.targetUid, 'target');

let interrupted = apply(null, command('interrupted', 'author', 'create', { songId: '10', targetUid: 'target' }));
interrupted = apply(interrupted, command('interrupted_accept', 'target', 'accept', { challengeId: 'interrupted', revealed: true, partners: ['guest'] }));
const withoutLeader = { ...env, members: { host: members.host, author: members.author, guest: members.guest } };
interrupted = apply(interrupted, command('interrupted_confirm', 'guest', 'confirm', { challengeId: 'interrupted', revealed: true }), withoutLeader);
assert.equal(interrupted.items.interrupted.status, 'open');
assert.equal(interrupted.items.interrupted.members, undefined);

let declined = apply(null, command('declined', 'author', 'create', { songId: '10', targetUid: 'target' }));
declined = apply(declined, command('decline', 'target', 'decline', { challengeId: 'declined' }));
assert.equal(declined.items.declined.status, 'declined');
const duplicate = apply(declined, command('decline', 'target', 'decline', { challengeId: 'declined' }));
assert.deepEqual(duplicate, declined);

const selfTarget = apply(null, command('self', 'author', 'create', { songId: '10', targetUid: 'author' }));
assert.equal(selfTarget.receipts.self.ok, false);
const missingTarget = apply(null, command('missing', 'author', 'create', { songId: '10', targetUid: 'absent' }));
assert.equal(missingTarget.receipts.missing.ok, false);

let publicState = apply(null, command('public', 'author', 'create', { songId: '10' }));
assert.equal(ChallengeCore.canView(publicState.items.public, 'guest', 'host'), true);
publicState = apply(publicState, command('public_accept', 'guest', 'accept', { challengeId: 'public', revealed: true }));
assert.equal(publicState.items.public.status, 'ready');

const withoutTarget = { ...env, members: { host: members.host, author: members.author, guest: members.guest } };
let left = apply(null, command('left', 'author', 'create', { songId: '10', targetUid: 'target' }));
left = apply(left, command('left_accept', 'target', 'accept', { challengeId: 'left', revealed: true }), withoutTarget);
assert.equal(left.items.left.status, 'open');
assert.equal(left.receipts.left_accept.ok, false);

console.log('challenge-core: desafios públicos e direcionados validados');
