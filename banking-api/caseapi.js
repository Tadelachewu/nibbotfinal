const express = require("express");
const cors = require('cors');
const app = express();
app.use(cors()); // Enable CORS for all routes
app.use(express.json());
// Dummy database
const cases = [
    {
        caseNumber: "CASE123",
        customerName: "Abel Tesfaye",
        issue: "Unable to transfer funds",
        status: "Open",
        priority: "High",
        createdAt: "2026-04-17T10:00:00Z"
    },
    {
        caseNumber: "CASE124",
        customerName: "Sara Mohammed",
        issue: "Login problem",
        status: "Closed",
        priority: "Medium",
        createdAt: "2026-04-16T09:30:00Z"
    }
];

// API endpoint
app.get("/api/cases/:caseNumber", (req, res) => {
    const caseNumber = req.params.caseNumber;

    const foundCase = cases.find(c => c.caseNumber === caseNumber);

    if (!foundCase) {
        return res.status(404).json({
            message: "Case not found"
        });
    }

    res.json(foundCase);
});

app.listen(3002, () => {
    console.log("Server running on port 3002");
});