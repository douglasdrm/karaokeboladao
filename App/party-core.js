(function (root) {
    'use strict';
    const normalize = value => String(value || '').normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('pt-BR');
    const encode = value => Array.from(new TextEncoder().encode(String(value))).map(x => x.toString(16).padStart(2, '0')).join('');
    // Legacy singerUid identifies the requester, not necessarily a singer.
    // Until explicit recipient IDs are implemented, use the displayed formation
    // within the DJ's own library and never treat the requester as the singer.
    const preferenceKey = song => encode(JSON.stringify([String(song.id), normalize(song.singer)]));
    const validPitch = value => typeof value === 'number' && Number.isFinite(value) && value >= 0.7 && value <= 1.3;
    function summarize(party) {
        const songs = Object.values(party?.songs || {});
        const completed = songs.filter(s => s.status === 'completed');
        return {
            completed,
            skipped: songs.filter(s => s.status === 'skipped').length,
            failed: songs.filter(s => s.status === 'error').length,
            formations: new Set(completed.map(s => normalize(s.singer))).size,
            ranking: completed.filter(s => typeof s.score === 'number').sort((a, b) => b.score - a.score).slice(0, 5)
        };
    }
    function summaryText(party) {
        const summary = summarize(party);
        return [party.name || 'Minha festa', new Date(party.startedAt).toLocaleString('pt-BR'),
            `${summary.completed.length} apresentações concluídas · ${summary.formations} formações diferentes`,
            '', 'Músicas cantadas:', ...summary.completed.map(s => `${s.singer} — ${s.title}${s.score == null ? '' : ` (${s.score} pontos)`}`),
            '', 'Destaques:', ...summary.ranking.map((s, i) => `${i + 1}. ${s.singer} — ${s.score} pontos`)].join('\n');
    }
    const api = { normalize, preferenceKey, validPitch, summarize, summaryText };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    root.PartyCore = api;
})(typeof window !== 'undefined' ? window : globalThis);
