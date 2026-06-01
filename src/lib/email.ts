import nodemailer from 'nodemailer';

type MailOptions = {
    to: string;
    subject: string;
    text?: string;
    html?: string;
};

async function createTransporter() {
    const host = process.env.SMTP_HOST;
    const port = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (host && port && user && pass) {
        console.info(`[email] SMTP configured host=${host} port=${port} user=${user}`);
        return nodemailer.createTransport({
            host,
            port,
            // Enforce secure connection (SSL/TLS) if using port 465, 
            // otherwise use STARTTLS (requireTLS: true).
            secure: port === 465,
            requireTLS: true,
            auth: { user, pass },
            tls: {
                // Do not fail on invalid certificates in dev, but enforce in prod.
                rejectUnauthorized: process.env.NODE_ENV === 'production'
            }
        });
    }

    // In development, fall back to a disposable Ethereal test account so
    // password recovery emails can be inspected without a real SMTP provider.
    if (process.env.NODE_ENV !== 'production') {
        try {
            const testAccount = await nodemailer.createTestAccount();
            const transporter = nodemailer.createTransport({
                host: testAccount.smtp.host,
                port: testAccount.smtp.port,
                secure: testAccount.smtp.secure,
                auth: { user: testAccount.user, pass: testAccount.pass },
            });
            console.info('[email] using Ethereal test account for development:', testAccount.user);
            return transporter;
        } catch (err) {
            console.warn('[email] failed to create Ethereal test account', err);
            return null;
        }
    }

    return null;
}

export async function sendEmail(opts: MailOptions) {
    const transporter = await createTransporter();
    const from = process.env.EMAIL_FROM || `noreply@localhost`;

    if (!transporter) {
        // In non-configured environments, log a warning for dev visibility
        // but avoid logging the full payload which may contain sensitive tokens.
        console.warn(`[email] transporter not configured, skipping send to=${opts.to} subject=${opts.subject}`);
        return { ok: true };
    }

    console.info(`[email] sending to=${opts.to} subject=${opts.subject}`);
    try {
        const info = await transporter.sendMail({
            from,
            to: opts.to,
            subject: opts.subject,
            text: opts.text,
            html: opts.html,
        });

        // If using Ethereal (dev), include a preview URL to inspect the message
        const previewUrl = nodemailer.getTestMessageUrl(info) || undefined;
        console.info(`[email] sent to=${opts.to} messageId=${info.messageId}`);
        if (previewUrl) console.info('[email] preview URL:', previewUrl);

        return { ok: true, info, previewUrl };
    } catch (err) {
        console.error('[email] send failed', { to: opts.to, subject: opts.subject, err });
        throw err;
    }
}

export async function sendRecoveryEmail(to: string, token: string, username: string) {
    let host = process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || 'https://your-site.example';

    // Security Hardening: Enforce HTTPS for the recovery link in production
    if (process.env.NODE_ENV === 'production' && host.startsWith('http:')) {
        host = host.replace('http:', 'https:');
    }

    const resetLink = `${host.replace(/\/$/, '')}/api/admin/auth/reset/consume?token=${encodeURIComponent(token)}`;
    const subject = 'Users Login password reset';
    const text = `Hello ${username},\n\nWe received a request to reset your Users Login password. Use the link below to reset your password. This link expires soon.\n\n${resetLink}\n\nIf you did not request this, ignore this message and report suspicious activity.`;
    const html = `<p>Hello ${username},</p><p>We received a request to reset your Users Login password. Click the link below to reset your password. This link expires soon.</p><p><a href="${resetLink}">${resetLink}</a></p><p>If you did not request this, ignore this message and report suspicious activity.</p>`;

    return sendEmail({ to, subject, text, html });
}

export default { sendEmail, sendRecoveryEmail };
