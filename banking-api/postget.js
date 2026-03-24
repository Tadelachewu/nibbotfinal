const express = require("express");
const cors = require('cors');
const app = express();


app.use(express.json());
app.use(cors()); // Enable CORS for all routes
/* =========================================================
   🔐 AUTH MIDDLEWARE
========================================================= */
function authenticate(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ success: false, message: "Missing token" });
    }

    const token = authHeader.split(" ")[1];

    if (token !== "secure-bank-token") {
        return res.status(403).json({ success: false, message: "Unauthorized" });
    }

    next();
}

/* =========================================================
   🧠 DATA LAYER (Mock DB)
========================================================= */
const accounts = {
    "1001": { name: "Abel Tesfaye", balance: 15000, currency: "ETB", type: "savings", status: "active" },
    "1002": { name: "Selam Worku", balance: 8200, currency: "ETB", type: "current", status: "active" },
    "1003": { name: "Dawit Kebede", balance: 500, currency: "ETB", type: "savings", status: "active" },
    "1004": { name: "Marta Tesfaye", balance: 25000, currency: "ETB", type: "business", status: "active" },
    "1005": { name: "Biruk Alemu", balance: 0, currency: "ETB", type: "savings", status: "inactive" },
};

const transactions = {};

/* =========================================================
   ⚙️ SERVICE LAYER (CORE LOGIC)
========================================================= */
function transferMoney(data) {
    const { sender_account, receiver_account, amount, currency = "ETB", remark = "" } = data;

    if (!sender_account || !receiver_account || !amount) {
        throw { status: 400, message: "Missing fields" };
    }

    if (sender_account === receiver_account) {
        throw { status: 400, message: "Same account not allowed" };
    }

    if (typeof amount !== "number" || amount <= 0) {
        throw { status: 400, message: "Invalid amount" };
    }

    const sender = accounts[sender_account];
    const receiver = accounts[receiver_account];

    if (!sender || !receiver) {
        throw { status: 404, message: "Account not found" };
    }

    if (sender.status !== "active" || receiver.status !== "active") {
        throw { status: 400, message: "Inactive account" };
    }

    if (sender.currency !== currency) {
        throw { status: 400, message: "Currency mismatch" };
    }

    if (sender.type !== "business" && amount > 10000) {
        throw { status: 400, message: "Transfer limit exceeded" };
    }

    const fee = amount * 0.01;
    const totalDebit = amount + fee;

    if (sender.balance < totalDebit) {
        throw { status: 400, message: "Insufficient balance" };
    }

    // Balances before
    const sender_before = sender.balance;
    const receiver_before = receiver.balance;

    // Transfer
    sender.balance -= totalDebit;
    receiver.balance += amount;

    // Balances after
    const sender_after = sender.balance;
    const receiver_after = receiver.balance;

    const reference_id = `TRX-${new Date().getFullYear()}-${Date.now()}`;

    const transaction = {
        reference_id,

        sender: {
            account: sender_account,
            name: sender.name,
            balance_before: sender_before,
            balance_after: sender_after,
        },

        receiver: {
            account: receiver_account,
            name: receiver.name,
            balance_before: receiver_before,
            balance_after: receiver_after,
        },

        transaction: {
            amount,
            currency,
            fee,
            total_debit: totalDebit,
            remark,
        },

        status: "completed",
        created_at: new Date().toISOString(),
    };

    transactions[reference_id] = transaction;

    return transaction;
}

function getAccount(id) {
    const account = accounts[id];
    if (!account) throw { status: 404, message: "Account not found" };
    return { account_id: id, ...account };
}

function getTransaction(ref) {
    const txn = transactions[ref];
    if (!txn) throw { status: 404, message: "Transaction not found" };
    return txn;
}

/* =========================================================
   🎮 CONTROLLERS
========================================================= */
function transferController(req, res) {
    try {
        const result = transferMoney(req.body);

        res.json({
            success: true,
            message: "Transfer successful",
            data: result,
        });

    } catch (err) {
        res.status(err.status || 500).json({
            success: false,
            message: err.message || "Server error",
        });
    }
}

function accountController(req, res) {
    try {
        const data = getAccount(req.params.id);
        res.json({ success: true, data });

    } catch (err) {
        res.status(err.status || 500).json({
            success: false,
            message: err.message,
        });
    }
}

function transactionController(req, res) {
    try {
        const data = getTransaction(req.params.ref);
        res.json({ success: true, data });

    } catch (err) {
        res.status(err.status || 500).json({
            success: false,
            message: err.message,
        });
    }
}

/* =========================================================
   🛣️ ROUTES
========================================================= */
app.post("/api/transfer", authenticate, transferController);
app.get("/api/account/:id", authenticate, accountController);
app.get("/api/transaction/:ref", authenticate, transactionController);

/* =========================================================
   🚀 START SERVER
========================================================= */
app.listen(3001, () => {
    console.log("🚀 Server running on http://localhost:3001");
});