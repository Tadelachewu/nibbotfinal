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
   💱 ETB BASED RATES
========================= */

const rates = {
    ETB: {
        USD: 0.017,
        EUR: 0.016,
        GBP: 0.014,
        KES: 2.7
    }
};

/* =========================
   🧠 UTIL FUNCTIONS
========================= */

function isSupported(currency) {
    return currency === "ETB" || rates.ETB.hasOwnProperty(currency);
}

function getRate(from, to) {
    from = from.toUpperCase();
    to = to.toUpperCase();

    if (from === to) return 1;

    // ETB → Other
    if (from === "ETB" && rates.ETB[to]) {
        return rates.ETB[to];
    }

    // Other → ETB
    if (to === "ETB" && rates.ETB[from]) {
        return 1 / rates.ETB[from];
    }

    // Other → Other via ETB
    if (rates.ETB[from] && rates.ETB[to]) {
        return (1 / rates.ETB[from]) * rates.ETB[to];
    }

    return null;
}

/* =========================
   🏦 1. GET ALL RATES (ETB BASE)
========================= */

app.get("/api/rates", authenticate, (req, res) => {
    res.json({
        status: "SUCCESS",
        data: {
            baseCurrency: "ETB",
            rates: rates.ETB
        },
        meta: {
            timestamp: new Date().toISOString()
        }
    });
});

/* =========================
   💱 2. CONVERT
========================= */

app.post("/api/convert", authenticate, (req, res) => {
    let { from, to, amount } = req.body;

    if (!from || !to || amount === undefined) {
        return res.status(400).json({
            status: "ERROR",
            message: "from, to, amount are required"
        });
    }

    if (isNaN(amount) || Number(amount) <= 0) {
        return res.status(400).json({
            status: "ERROR",
            message: "amount must be a positive number"
        });
    }

    from = from.toUpperCase();
    to = to.toUpperCase();

    if (!isSupported(from) || !isSupported(to)) {
        return res.status(404).json({
            status: "ERROR",
            message: "Currency not supported"
        });
    }

    const rate = getRate(from, to);

    if (!rate) {
        return res.status(404).json({
            status: "ERROR",
            message: "Conversion not available"
        });
    }

    const converted = amount * rate;

    res.json({
        status: "SUCCESS",
        data: {
            from,
            to,
            amount: Number(amount),
            rate,
            converted: Number(converted.toFixed(2))
        },
        meta: {
            systemBase: "ETB",
            timestamp: new Date().toISOString()
        }
    });
});

/* =========================
   🔁 3. CONVERT ALL
========================= */

app.get("/api/convert-all", authenticate, (req, res) => {
    let base = req.query.base?.toUpperCase();
    let amount = Number(req.query.amount || 1);

    if (!base) {
        return res.status(400).json({
            status: "ERROR",
            message: "base currency is required"
        });
    }

    if (!isSupported(base)) {
        return res.status(404).json({
            status: "ERROR",
            message: "Currency not supported"
        });
    }

    if (isNaN(amount) || amount <= 0) {
        return res.status(400).json({
            status: "ERROR",
            message: "amount must be a positive number"
        });
    }

    const currencies = ["ETB", ...Object.keys(rates.ETB)];

    const result = currencies
        .filter(c => c !== base)
        .map(currency => {
            const rate = getRate(base, currency);

            return {
                currency,
                rate,
                converted: Number((rate * amount).toFixed(2))
            };
        });

    res.json({
        status: "SUCCESS",
        data: {
            baseCurrency: base,
            systemBase: "ETB",
            amount,
            conversions: result
        },
        meta: {
            total: result.length,
            timestamp: new Date().toISOString()
        }
    });
});

/* =========================
   ❤️ HEALTH CHECK
========================= */

app.get("/api/health", (req, res) => {
    res.json({
        status: "OK",
        message: "Exchange API is running",
        time: new Date().toISOString()
    });
});

/* =========================
   🚀 START SERVER
========================= */

const PORT = 3003;

app.listen(PORT, () => {
    console.log(`🏦 ETB Exchange API running on http://localhost:${PORT}`);
});