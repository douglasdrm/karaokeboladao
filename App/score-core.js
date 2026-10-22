(function (root) {
    'use strict';

    const MODES = Object.freeze(['random', 'mic', 'audience', 'mixed']);
    const DEFAULT_WEIGHTS = Object.freeze({ mic: 20, audience: 70, random: 10 });

    const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
    const finite = value => Number.isFinite(Number(value));

    function normalizeSettings(input = {}) {
        const mode = MODES.includes(input.scoreMode) ? input.scoreMode : 'mic';
        const rawMinimum = Number(input.minRandomScore);
        const minRandomScore = clamp(Math.round(Number.isFinite(rawMinimum) ? rawMinimum : 75), 0, 100);
        const source = input.scoreWeights || {};
        const scoreWeights = {
            mic: clamp(Math.round(Number(source.mic) || 0), 0, 100),
            audience: clamp(Math.round(Number(source.audience) || 0), 0, 100),
            random: clamp(Math.round(Number(source.random) || 0), 0, 100)
        };
        if (scoreWeights.mic + scoreWeights.audience + scoreWeights.random !== 100) {
            Object.assign(scoreWeights, DEFAULT_WEIGHTS);
        }
        return { scoreMode: mode, minRandomScore, scoreWeights };
    }

    function randomScore(minimum, randomValue = Math.random()) {
        const min = clamp(Math.round(Number(minimum) || 0), 0, 100);
        const roll = clamp(Number(randomValue) || 0, 0, 0.999999999);
        return min + Math.floor(roll * (101 - min));
    }

    function audienceScore(votes) {
        const valid = Object.values(votes || {}).map(vote => Number(vote?.stars))
            .filter(stars => Number.isFinite(stars) && stars >= 1 && stars <= 5);
        if (!valid.length) return { available: false, score: null, voteCount: 0 };
        const average = valid.reduce((sum, stars) => sum + stars, 0) / valid.length;
        return { available: true, score: Math.round((average / 5) * 100), voteCount: valid.length };
    }

    function calculate(input = {}) {
        const settings = normalizeSettings(input.settings);
        const audience = audienceScore(input.votes);
        const random = randomScore(settings.minRandomScore, input.randomValue);
        const micAvailable = input.micAvailable === true && finite(input.micScore);
        const mic = micAvailable ? clamp(Math.round(Number(input.micScore)), 0, 100) : null;
        const legacy = finite(input.legacyScore) ? clamp(Math.round(Number(input.legacyScore)), 0, 100) : random;
        const meta = { mode: settings.scoreMode, voteCount: audience.voteCount, fallback: false, sources: {} };

        if (settings.scoreMode === 'random') {
            meta.source = 'random'; meta.sources.random = 100;
            return { score: random, meta };
        }
        if (settings.scoreMode === 'mic') {
            if (micAvailable) {
                meta.source = 'mic'; meta.sources.mic = 100;
                return { score: mic, meta };
            }
            meta.source = 'fallback-random'; meta.fallback = true; meta.sources.random = 100;
            return { score: random, meta };
        }
        if (settings.scoreMode === 'audience') {
            if (audience.available) {
                meta.source = 'audience'; meta.sources.audience = 100;
                return { score: audience.score, meta };
            }
            meta.source = 'fallback-legacy'; meta.fallback = true;
            meta.sources[micAvailable ? 'mic' : 'random'] = 100;
            return { score: legacy, meta };
        }

        const values = { mic, audience: audience.score, random };
        const available = { mic: micAvailable, audience: audience.available, random: true };
        const active = Object.entries(settings.scoreWeights)
            .filter(([key, weight]) => weight > 0 && available[key]);
        const totalWeight = active.reduce((sum, [, weight]) => sum + weight, 0);
        if (!totalWeight) {
            meta.source = 'fallback-random'; meta.fallback = true; meta.sources.random = 100;
            return { score: random, meta };
        }
        let total = 0;
        for (const [key, weight] of active) {
            const normalizedWeight = weight / totalWeight;
            total += values[key] * normalizedWeight;
            meta.sources[key] = Math.round(normalizedWeight * 10000) / 100;
        }
        meta.fallback = active.length < Object.values(settings.scoreWeights).filter(weight => weight > 0).length;
        meta.source = meta.fallback && active.length === 1 && active[0][0] === 'random' ? 'fallback-random' : 'mixed';
        return { score: clamp(Math.round(total), 0, 100), meta };
    }

    const api = { MODES, DEFAULT_WEIGHTS, normalizeSettings, randomScore, audienceScore, calculate };
    root.ScoreCore = api;
    if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
