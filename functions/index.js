const { onCall, onRequest, HttpsError } = require('firebase-functions/v2/https');
const { setGlobalOptions } = require('firebase-functions/v2');
const admin = require('firebase-admin');
const { defineSecret } = require('firebase-functions/params');
const Stripe = require('stripe');
const crypto = require('crypto');

setGlobalOptions({ region: 'us-central1' });

const STRIPE_SECRET_KEY = defineSecret('STRIPE_SECRET_KEY');
const STRIPE_WEBHOOK_SECRET = defineSecret('STRIPE_WEBHOOK_SECRET');

admin.initializeApp();

const pairingRef = (id) => admin.database().ref(`tv_pairings/${id}`);
const pairingHash = (secret) => crypto.createHash('sha256').update(String(secret)).digest('hex');

async function removeExpiredTvPairings(now = Date.now()) {
    const snapshot = await admin.database().ref('tv_pairings').once('value');
    const removals = {};
    snapshot.forEach(child => {
        if (Number(child.val()?.expiresAt) <= now) removals[child.key] = null;
    });
    if (Object.keys(removals).length) await admin.database().ref('tv_pairings').update(removals);
}

exports.createTvPairing = onCall(async () => {
    await removeExpiredTvPairings();
    const pairId = crypto.randomBytes(5).toString('hex').toUpperCase();
    const tvSecret = crypto.randomBytes(24).toString('base64url');
    const approvalSecret = crypto.randomBytes(24).toString('base64url');
    const expiresAt = Date.now() + 10 * 60 * 1000;
    await pairingRef(pairId).set({
        tvSecretHash: pairingHash(tvSecret),
        approvalSecretHash: pairingHash(approvalSecret),
        status: 'pending',
        createdAt: admin.database.ServerValue.TIMESTAMP,
        expiresAt
    });
    return { pairId, tvSecret, approvalSecret, expiresAt };
});

exports.approveTvPairing = onCall(async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Entre com a conta do DJ.');
    const pairId = String(request.data?.pairId || '').toUpperCase();
    const secret = String(request.data?.secret || '');
    const partyName = String(request.data?.partyName || '').trim().slice(0, 50);
    if (!/^[A-F0-9]{10}$/.test(pairId) || secret.length < 24 || !partyName) throw new HttpsError('invalid-argument', 'Dados do pareamento incompletos.');
    const ref = pairingRef(pairId);
    const pairing = (await ref.once('value')).val();
    if (!pairing || pairing.approvalSecretHash !== pairingHash(secret) || Number(pairing.expiresAt) < Date.now()) {
        throw new HttpsError('not-found', 'Este QR Code expirou. Gere outro na TV.');
    }
    if (pairing.status !== 'pending' && pairing.djUid !== request.auth.uid) {
        throw new HttpsError('already-exists', 'Esta TV já foi autorizada por outra conta.');
    }
    const banned = (await admin.database().ref(`users/${request.auth.uid}/isBanned`).once('value')).val() === true;
    if (banned) throw new HttpsError('permission-denied', 'Esta conta não pode abrir festas.');
    const tvUid = `tv_${pairId.toLowerCase()}`;
    const djName = request.auth.token.name || request.auth.token.email || 'DJ';
    let customToken;
    try {
        customToken = await admin.auth().createCustomToken(tvUid, { djUid: request.auth.uid, djName, tvPairing: true });
    } catch (error) {
        console.error('Não foi possível assinar o token da TV.', error);
        throw new HttpsError('internal', 'Não foi possível autorizar a TV agora. Gere um novo QR Code e tente novamente.');
    }
    await ref.update({
        status: 'approved',
        djUid: request.auth.uid,
        djName,
        partyName,
        customToken,
        approvedAt: admin.database.ServerValue.TIMESTAMP
    });
    return { approved: true };
});

exports.getTvPairing = onCall(async (request) => {
    const pairId = String(request.data?.pairId || '').toUpperCase();
    const secret = String(request.data?.secret || '');
    if (!/^[A-F0-9]{10}$/.test(pairId) || secret.length < 24) throw new HttpsError('invalid-argument', 'Pareamento inválido.');
    const pairing = (await pairingRef(pairId).once('value')).val();
    const isTv = pairing?.tvSecretHash === pairingHash(secret);
    const isApprover = pairing?.approvalSecretHash === pairingHash(secret);
    if (!pairing || (!isTv && !isApprover)) throw new HttpsError('not-found', 'Pareamento não encontrado.');
    if (Number(pairing.expiresAt) < Date.now()) throw new HttpsError('deadline-exceeded', 'O pareamento expirou.');
    return {
        status: pairing.status,
        customToken: isTv && pairing.status === 'approved' ? pairing.customToken : null,
        partyName: pairing.partyName || null,
        roomCode: pairing.roomCode || null
    };
});

exports.completeTvPairing = onCall(async (request) => {
    if (!request.auth?.token?.tvPairing || !request.auth.token.djUid) throw new HttpsError('permission-denied', 'Sessão de TV inválida.');
    const pairId = String(request.data?.pairId || '').toUpperCase();
    const secret = String(request.data?.secret || '');
    const roomCode = String(request.data?.roomCode || '').toUpperCase();
    if (!/^[A-F0-9]{10}$/.test(pairId) || secret.length < 24 || !/^[A-Z0-9]{5}$/.test(roomCode)) {
        throw new HttpsError('invalid-argument', 'Dados da sala inválidos.');
    }
    const ref = pairingRef(pairId);
    const pairing = (await ref.once('value')).val();
    if (!pairing || pairing.tvSecretHash !== pairingHash(secret) || pairing.djUid !== request.auth.token.djUid) {
        throw new HttpsError('permission-denied', 'Pareamento inválido.');
    }
    await ref.update({
        status: 'ready',
        roomCode,
        customToken: null,
        readyAt: admin.database.ServerValue.TIMESTAMP,
        expiresAt: Date.now() + 5 * 60 * 1000
    });
    return { ready: true };
});

exports.createCheckoutSession = onCall(
    { secrets: [STRIPE_SECRET_KEY] },
    async (request) => {
        const { uid, planId } = request.data;
        const stripe = new Stripe(STRIPE_SECRET_KEY.value());

        if (!request.auth) {
            throw new HttpsError('unauthenticated', 'Login necessário.');
        }

        const plans = {
            'avulso3h':   { name: 'Avulso 3h',         price: 1000,  hours: 3,   mode: 'payment' },
            'avulso8h':   { name: 'Avulso 8h',         price: 1500,  hours: 8,   mode: 'payment' },
            'avulso24h':  { name: 'Avulso 24h',        price: 2500,  hours: 24,  mode: 'payment' },
            'avulso48h':  { name: 'Avulso 48h',        price: 3500,  hours: 48,  mode: 'payment' },
            'casual':     { name: 'Plano Casual',      price: 4000,  days: 30,   mode: 'payment' },
            'festa':      { name: 'Plano Festa',       price: 9900,  days: 90,   mode: 'payment' },
            'semestral':  { name: 'Plano Semestral',   price: 18900, days: 180,  mode: 'payment' },
            'anual':      { name: 'Plano Anual',       price: 34900, days: 365,  mode: 'payment' }
        };

        const plan = plans[planId];
        if (!plan) throw new HttpsError('invalid-argument', 'Plano inválido.');

        try {
            const session = await stripe.checkout.sessions.create({
                payment_method_types: ['card'],
                line_items: [{
                    price_data: {
                        currency: 'brl',
                        product_data: { name: plan.name },
                        unit_amount: plan.price,
                        // Se for assinatura, o Stripe exige um intervalo recursivo
                        ...(plan.mode === 'subscription' && {
                            recurring: { interval: planId === 'anual' ? 'year' : (planId === 'festa' ? 'month' : 'month'), interval_count: planId === 'festa' ? 3 : 1 }
                        })
                    },
                    quantity: 1,
                }],
                mode: plan.mode,
                success_url: 'https://karaoke.unodev.com.br/App/index.html?session_id={CHECKOUT_SESSION_ID}',
                cancel_url: 'https://karaoke.unodev.com.br/index.html',
                client_reference_id: uid, 
                metadata: { 
                    uid: uid, 
                    planId: planId, 
                    days: plan.days || 0,
                    hours: plan.hours || 0
                }
            });

            return { url: session.url };
        } catch (error) {
            console.error('Erro Stripe:', error);
            throw new HttpsError('internal', error.message);
        }
    }
);

exports.stripeWebhook = onRequest(
    { secrets: [STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET] }, 
    async (req, res) => {
        const sig = req.headers['stripe-signature'];
        const stripe = new Stripe(STRIPE_SECRET_KEY.value());
        const endpointSecret = STRIPE_WEBHOOK_SECRET.value();

        let event;
        try {
            event = stripe.webhooks.constructEvent(req.rawBody, sig, endpointSecret);
        } catch (err) {
            return res.status(400).send(`Webhook Error: ${err.message}`);
        }

        if (event.type === 'checkout.session.completed') {
            const session = event.data.object;
            const uid = session.client_reference_id || session.metadata.uid;
            const planId = session.metadata.planId;
            const days = parseInt(session.metadata.days || 0);
            const hours = parseInt(session.metadata.hours || 0);

            if (uid && planId) {
                let expirationDate;
                if (days > 0) {
                    expirationDate = Date.now() + (days * 24 * 60 * 60 * 1000);
                } else if (hours > 0) {
                    expirationDate = Date.now() + (hours * 60 * 60 * 1000);
                }

                const planNames = {
                    casual: 'Casual', festa: 'Festa', semestral: 'Semestral', anual: 'Anual',
                    avulso3h: 'Avulso 3h', avulso8h: 'Avulso 8h',
                    avulso24h: 'Avulso 24h', avulso48h: 'Avulso 48h'
                };

                await admin.database().ref(`users/${uid}/subscription`).update({
                    active: true,
                    status: 'active',
                    plan: planNames[planId] || planId,
                    expiresAt: expirationDate,
                    lastUpdate: admin.database.ServerValue.TIMESTAMP,
                    paymentId: session.id,
                    mode: session.mode
                });
            }
        }
        res.status(200).json({ received: true });
    }
);
