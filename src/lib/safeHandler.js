// Wrapper for Next.js API route handlers to ensure internal errors are not leaked to clients.
module.exports = function safeHandler(fn) {
    return async function (req, res) {
        try {
            await fn(req, res);
        } catch (err) {
            console.error('Unhandled API error:', err && err.stack ? err.stack : (err && err.message) || err);
            if (!res.headersSent) {
                res.status(500).json({ status: 'error', message: 'Internal server error' });
            }
        }
    };
};
