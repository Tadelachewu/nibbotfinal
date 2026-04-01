import nodemailer from 'nodemailer';

type MailOptions = {
    to: string;
    subject: string;
    text?: string;
    html?: string;
};

function createTransporter() {
    const host = process.env.SMTP_HOST;
    const port = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (!host || !port || !user || !pass) {
        return null;
    }

    return nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass },
    });
}

export async function sendEmail(opts: MailOptions) {
    const transporter = createTransporter();
    const from = process.env.EMAIL_FROM || `noreply@localhost`;

    if (!transporter) {
        // In non-configured environments, log to console for dev visibility
        // and return as success so API can behave non-destructively.
        // DO NOT rely on this in production.
        console.info('[email] transporter not configured, skipping send', opts);
        return { ok: true };
    }

    const info = await transporter.sendMail({
        from,
        to: opts.to,
        subject: opts.subject,
        text: opts.text,
        html: opts.html,
    });

    return { ok: true, info };
}

export async function sendRecoveryEmail(to: string, token: string, username: string) {
    const host = process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || 'https://your-site.example';
    const resetLink = `${host.replace(/\/$/, '')}/admin/reset?token=${encodeURIComponent(token)}`;
    const subject = 'Admin console password reset';
    const text = `Hello ${username},\n\nWe received a request to reset your admin console password. Use the link below to reset your password. This link expires soon.\n\n${resetLink}\n\nIf you did not request this, ignore this message.`;
    const html = `<p>Hello ${username},</p><p>We received a request to reset your admin console password. Click the link below to reset your password. This link expires soon.</p><p><a href="${resetLink}">${resetLink}</a></p><p>If you did not request this, ignore this message.</p>`;

    return sendEmail({ to, subject, text, html });
}

export default { sendEmail, sendRecoveryEmail };
