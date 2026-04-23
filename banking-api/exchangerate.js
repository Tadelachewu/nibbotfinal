const express = require("express");
const cors = require("cors");

const app = express();

/* =========================
   🔐 MIDDLEWARE
========================= */

app.use(express.json());
app.use(cors());

/* =========================
   🔑 API KEY AUTH
========================= */

const API_KEY = "my-secret-key-123";

function authenticate(req, res, next) {
    const clientKey = req.headers["api-key"];

    if (!clientKey) {
        return res.status(401).json({
            status: "ERROR",
            message: "API key is required"
        });
    }

    if (clientKey !== API_KEY) {
        return res.status(403).json({
            status: "ERROR",
            message: "Invalid API key"
        });
    }

    next();
}

/* =========================
   💱 MOCK DATABASE
========================= */

const rates = {
    USD: { EUR: 0.92, ETB: 56.2, GBP: 0.78, KES: 150 },
    EUR: { USD: 1.09, ETB: 61.3, GBP: 0.85, KES: 163 },
    ETB: { USD: 0.017, EUR: 0.016, GBP: 0.014, KES: 2.7 }
};

/* =========================
   🧠 UTIL
========================= */

function isValidCurrency(code) {
    return rates.hasOwnProperty(code);
}

/* =========================
   🏦 1. GET RATES
   Supports:
   - /api/rates?base=USD
   - /api/rates/USD (optional)
========================= */

app.get("/api/rates/:base?", authenticate, (req, res) => {
    const base = (req.query.base || req.params.base)?.toUpperCase();

    if (!base) {
        return res.status(400).json({
            status: "ERROR",
            message: "base currency is required (query or path)"
        });
    }

    if (!isValidCurrency(base)) {
        return res.status(404).json({
            status: "ERROR",
            message: "Currency not supported"
        });
    }

    res.json({
        status: "SUCCESS",
        data: {
            baseCurrency: base,
            rates: rates[base]
        },
        meta: {
            timestamp: new Date().toISOString()
        }
    });
});

/* =========================
   💱 2. CONVERT CURRENCY
========================= */

app.post("/api/convert", authenticate, (req, res) => {
    let { from, to, amount } = req.body;

    if (!from || !to || amount === undefined) {
        return res.status(400).json({
            status: "ERROR",
            message: "from, to, amount are required"
        });
    }

    if (isNaN(amount)) {
        return res.status(400).json({
            status: "ERROR",
            message: "amount must be a number"
        });
    }

    const base = from.toUpperCase();
    const target = to.toUpperCase();

    let rate;

    // direct rate
    if (rates[base] && rates[base][target]) {
        rate = rates[base][target];
    }
    // reverse rate support
    else if (rates[target] && rates[target][base]) {
        rate = 1 / rates[target][base];
    } else {
        return res.status(404).json({
            status: "ERROR",
            message: "Currency pair not supported"
        });
    }

    const converted = amount * rate;

    res.json({
        status: "SUCCESS",
        data: {
            from: base,
            to: target,
            amount: Number(amount),
            rate,
            converted: Number(converted.toFixed(2))
        },
        meta: {
            timestamp: new Date().toISOString()
        }
    });
});

/* =========================
   🔁 3. CONVERT ALL
   Supports:
   - /api/convert-all?base=USD&amount=100
   - /api/convert-all/USD?amount=100
========================= */

app.get("/api/convert-all/:base?", authenticate, (req, res) => {
    const base = (req.query.base || req.params.base)?.toUpperCase();
    const amount = Number(req.query.amount || 1);

    if (!base) {
        return res.status(400).json({
            status: "ERROR",
            message: "base currency is required"
        });
    }

    if (!isValidCurrency(base)) {
        return res.status(404).json({
            status: "ERROR",
            message: "Currency not supported"
        });
    }

    if (isNaN(amount)) {
        return res.status(400).json({
            status: "ERROR",
            message: "amount must be a number"
        });
    }

    const result = Object.entries(rates[base]).map(([currency, rate]) => ({
        currency,
        rate,
        converted: Number((rate * amount).toFixed(2))
    }));

    res.json({
        status: "SUCCESS",
        data: {
            baseCurrency: base,
            amount,
            result
        },
        meta: {
            total: result.length,
            timestamp: new Date().toISOString()
        }
    });
});

/* =========================
   🚀 START SERVER
========================= */

const PORT = 3003;

app.listen(PORT, () => {
    console.log(`🏦 Secure Exchange API running on http://localhost:${PORT}`);
});