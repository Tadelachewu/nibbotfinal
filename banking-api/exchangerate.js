const express = require("express");
const cors = require("cors");

const app = express();

/* =========================
   🔐 MIDDLEWARE
========================= */

// Enable JSON body parsing
app.use(express.json());

// Enable CORS (allow all origins for testing)
app.use(cors());

/* =========================
   🔑 API KEY AUTH MIDDLEWARE
========================= */

const API_KEY = "my-secret-key-123"; // change this in production

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
   🏦 1. GET ALL RATES
========================= */
app.get("/api/rates/:base", authenticate, (req, res) => {
    const base = req.params.base.toUpperCase();

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
   💱 2. CONVERT CURRENCY (POST JSON BODY)
========================= */
app.post("/api/convert", authenticate, (req, res) => {
    const { from, to, amount } = req.body;

    if (!from || !to || !amount) {
        return res.status(400).json({
            status: "ERROR",
            message: "from, to, amount are required"
        });
    }

    const base = from.toUpperCase();
    const target = to.toUpperCase();

    if (!isValidCurrency(base) || !rates[base][target]) {
        return res.status(404).json({
            status: "ERROR",
            message: "Currency pair not supported"
        });
    }

    const rate = rates[base][target];
    const converted = amount * rate;

    res.json({
        status: "SUCCESS",
        data: {
            from: base,
            to: target,
            amount,
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
========================= */
app.get("/api/convert-all/:base", authenticate, (req, res) => {
    const base = req.params.base.toUpperCase();
    const amount = Number(req.query.amount || 1);

    if (!isValidCurrency(base)) {
        return res.status(404).json({
            status: "ERROR",
            message: "Currency not supported"
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