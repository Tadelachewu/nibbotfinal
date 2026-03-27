const express = require('express');
const cors = require('cors');
const app = express();
const PORT = 3000;

app.use(cors()); // Enable CORS for all routes
app.use(express.json());

// Simple request logger (masks sensitive headers)
app.use((req, res, next) => {
    try {
        const headers = { ...req.headers };
        if (headers.authorization) headers.authorization = headers.authorization.replace(/Bearer\s+(.+)/i, 'Bearer ****');
        if (headers['x-api-key']) headers['x-api-key'] = '****';

        console.log('HTTP', {
            method: req.method,
            url: req.originalUrl,
            params: req.params,
            query: req.query,
            headers
        });

        if (req.body && Object.keys(req.body).length) console.log('HTTP BODY', req.body);
    } catch (e) {
        // don't break request on logging failure
        console.warn('Request logger error', e && e.message ? e.message : e);
    }
    next();
});

// ---------------- Mock Database ---------------- //
const accountsDB = {
    "99887766": {
        balance: 12500.0,
        currency: "ETB",
        transactions: [
            { id: 1, amount: -500, type: "debit", date: "2026-03-20" },
            { id: 2, amount: 2000, type: "credit", date: "2026-03-21" },
            { id: 3, amount: -300, type: "debit", date: "2026-03-22" },
        ]
    },
    "88991122": {
        balance: 8500.0,
        currency: "ETB",
        transactions: [
            { id: 1, amount: -1000, type: "debit", date: "2026-03-20" },
            { id: 2, amount: 500, type: "credit", date: "2026-03-21" },
        ]
    },
};

// ---------------- Auth Middlewares ---------------- //

// Bearer Token Auth (existing)
function bearerAuth(req, res, next) {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    const token = authHeader.split(' ')[1];
    if (token !== 'secret-token-123') {
        return res.status(401).json({ success: false, message: 'Invalid token' });
    }
    next();
}

// API Key Auth
function apiKeyAuth(req, res, next) {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey || apiKey !== 'my-secret-api-key') {
        return res.status(401).json({ success: false, message: 'Invalid API Key' });
    }
    next();
}

// ---------------- Existing Endpoints ---------------- //

// 1️⃣ Account balance
app.get('/api/accounts/:account_id/balance', bearerAuth, (req, res) => {
    const accountId = req.params.account_id;
    const currency = req.query.currency || 'ETB';

    const account = accountsDB[accountId];
    if (!account) return res.status(404).json({ success: false, message: 'Account not found' });

    res.json({
        success: true,
        data: {
            account_id: accountId,
            currency,
            available_balance: account.balance,
            last_updated: new Date().toISOString()
        }
    });
});

// 2️⃣ Transactions with type & minAmount query params
app.get('/api/accounts/:account_id/transactions', bearerAuth, (req, res) => {
    const account = accountsDB[req.params.account_id];
    if (!account) return res.status(404).json({ success: false, message: 'Account not found' });

    const { type, minAmount } = req.query;

    let filteredTransactions = account.transactions;

    if (type) {
        filteredTransactions = filteredTransactions.filter(txn => txn.type === type);
    }

    if (minAmount) {
        const min = parseFloat(minAmount);
        filteredTransactions = filteredTransactions.filter(txn => Math.abs(txn.amount) >= min);
    }

    res.json({
        success: true,
        data: filteredTransactions
    });
});

// ---------------- New API Key Endpoint ---------------- //
// GET /api/apikey/accounts/summary?account_id=...&currency=...&includeTransactions=...

app.get('/api/apikey/accounts/summary', apiKeyAuth, (req, res) => {
    const { account_id, currency, includeTransactions } = req.query;

    // Validate mandatory params
    if (!account_id || !currency) {
        return res.status(400).json({ success: false, message: 'Missing mandatory query params: account_id and currency' });
    }

    const account = accountsDB[account_id];
    if (!account) return res.status(404).json({ success: false, message: 'Account not found' });

    const response = {
        account_id,
        currency,
        balance: account.balance,
    };

    // Optional param: includeTransactions=true
    if (includeTransactions === 'true') {
        response.transactions = account.transactions;
    }

    res.json({ success: true, data: response });
});

// ---------------- Start Server ---------------- //
app.listen(PORT, '0.0.0.0', () => console.log(`Server running on http://0.0.0.0:${PORT}`));