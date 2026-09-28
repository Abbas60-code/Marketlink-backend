import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.Gmailuser,
    pass: process.env.Gmailpass,
  },
});

// ── Registration OTP Email ─────────────────────────────────────────
export const sendOTPEmail = async (toEmail, otp) => {
  try {
    await transporter.sendMail({
      from: `"MarketLink" <${process.env.Gmailuser}>`,
      to: toEmail,
      replyTo: process.env.Gmailuser,
      subject: `${otp} is your MarketLink verification code`,
      text: `Your MarketLink Account Verification Code\n\nYour 6-digit OTP code is: ${otp}\n\nThis code expires in 10 minutes.\n\nIf you did not register for MarketLink, you can safely ignore this email.\n\n— MarketLink eGreen Basket`,
      html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verification Code</title>
</head>
<body style="margin:0;padding:0;background-color:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1e293b;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:540px;background-color:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;box-shadow:0 4px 6px -1px rgba(0,0,0,0.05);">
          <tr>
            <td style="background:#10b981;padding:28px 32px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.3px;">MarketLink</h1>
              <p style="margin:4px 0 0;color:#d1fae5;font-size:13px;font-weight:500;">Account Verification</p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 32px 24px;">
              <p style="margin:0 0 14px;font-size:15px;color:#334155;line-height:1.5;">Hello,</p>
              <p style="margin:0 0 24px;font-size:15px;color:#334155;line-height:1.5;">
                Thank you for joining MarketLink. Please use the verification code below to activate your account:
              </p>
              <div style="background:#f0fdf4;border:1.5px solid #86efac;border-radius:10px;padding:18px 24px;text-align:center;margin:24px 0;">
                <span style="font-family:monospace,'Courier New',Courier;font-size:36px;font-weight:700;letter-spacing:10px;color:#047857;display:inline-block;padding-left:10px;">${otp}</span>
              </div>
              <p style="margin:20px 0 0;font-size:13px;color:#64748b;text-align:center;line-height:1.5;">
                This code will expire in <strong>10 minutes</strong>.
              </p>
              <p style="margin:8px 0 0;font-size:12px;color:#94a3b8;text-align:center;line-height:1.5;">
                If you did not request this code, you can safely ignore this email.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:18px 32px;background-color:#f8fafc;border-top:1px solid #e2e8f0;text-align:center;">
              <p style="margin:0;font-size:12px;color:#94a3b8;">&copy; ${new Date().getFullYear()} MarketLink — eGreen Basket. All rights reserved.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
    });
  } catch (error) {
    console.error(`[EMAIL] Registration OTP failed for ${toEmail}:`, error.message);
  }
};

// ── Password Reset OTP Email ──────────────────────────────────────
export const sendPasswordResetEmail = async (toEmail, otp) => {
  try {
    await transporter.sendMail({
      from: `"MarketLink" <${process.env.Gmailuser}>`,
      to: toEmail,
      replyTo: process.env.Gmailuser,
      subject: `${otp} is your MarketLink password reset code`,
      text: `MarketLink Password Reset\n\nYour 6-digit password reset code is: ${otp}\n\nThis code expires in 10 minutes.\n\nIf you did not request a password reset, your account is safe and you can ignore this email.\n\n— MarketLink eGreen Basket`,
      html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Password Reset Code</title>
</head>
<body style="margin:0;padding:0;background-color:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1e293b;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:540px;background-color:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;box-shadow:0 4px 6px -1px rgba(0,0,0,0.05);">
          <tr>
            <td style="background:#0f172a;padding:28px 32px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.3px;">MarketLink</h1>
              <p style="margin:4px 0 0;color:#94a3b8;font-size:13px;font-weight:500;">Password Reset Request</p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 32px 24px;">
              <p style="margin:0 0 14px;font-size:15px;color:#334155;line-height:1.5;">Hello,</p>
              <p style="margin:0 0 24px;font-size:15px;color:#334155;line-height:1.5;">
                We received a request to reset your MarketLink account password. Use the verification code below to set a new password:
              </p>
              <div style="background:#f0fdf4;border:1.5px solid #86efac;border-radius:10px;padding:18px 24px;text-align:center;margin:24px 0;">
                <span style="font-family:monospace,'Courier New',Courier;font-size:36px;font-weight:700;letter-spacing:10px;color:#047857;display:inline-block;padding-left:10px;">${otp}</span>
              </div>
              <p style="margin:20px 0 0;font-size:13px;color:#64748b;text-align:center;line-height:1.5;">
                This code is valid for <strong>10 minutes</strong>. Do not share this code with anyone.
              </p>
              <p style="margin:8px 0 0;font-size:12px;color:#94a3b8;text-align:center;line-height:1.5;">
                If you did not request a password reset, your account is secure and you can safely ignore this email.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:18px 32px;background-color:#f8fafc;border-top:1px solid #e2e8f0;text-align:center;">
              <p style="margin:0;font-size:12px;color:#94a3b8;">&copy; ${new Date().getFullYear()} MarketLink — eGreen Basket. All rights reserved.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
    });
  } catch (error) {
    console.error(`[EMAIL] Password reset OTP failed for ${toEmail}:`, error.message);
    throw new Error('Failed to send password reset email. Please try again.');
  }
};

// ── 2FA Login OTP Email ───────────────────────────────────────────
export const send2FAEmail = async (toEmail, otp) => {
  try {
    await transporter.sendMail({
      from: `"MarketLink" <${process.env.Gmailuser}>`,
      to: toEmail,
      replyTo: process.env.Gmailuser,
      subject: `${otp} is your MarketLink login verification code`,
      text: `MarketLink Login Verification\n\nYour 6-digit login code is: ${otp}\n\nThis code expires in 10 minutes.\n\nIf you did not attempt to log in, please secure your account immediately.\n\n— MarketLink eGreen Basket`,
      html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Login Verification Code</title>
</head>
<body style="margin:0;padding:0;background-color:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1e293b;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:540px;background-color:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;box-shadow:0 4px 6px -1px rgba(0,0,0,0.05);">
          <tr>
            <td style="background:#064e3b;padding:28px 32px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.3px;">MarketLink</h1>
              <p style="margin:4px 0 0;color:#6ee7b7;font-size:13px;font-weight:500;">Login Security Verification</p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 32px 24px;">
              <p style="margin:0 0 14px;font-size:15px;color:#334155;line-height:1.5;">Hello,</p>
              <p style="margin:0 0 24px;font-size:15px;color:#334155;line-height:1.5;">
                A login attempt was made for your MarketLink account. Enter the verification code below to complete sign-in:
              </p>
              <div style="background:#f0fdf4;border:1.5px solid #86efac;border-radius:10px;padding:18px 24px;text-align:center;margin:24px 0;">
                <span style="font-family:monospace,'Courier New',Courier;font-size:36px;font-weight:700;letter-spacing:10px;color:#047857;display:inline-block;padding-left:10px;">${otp}</span>
              </div>
              <p style="margin:20px 0 0;font-size:13px;color:#64748b;text-align:center;line-height:1.5;">
                This code will expire in <strong>10 minutes</strong>. Never share this code.
              </p>
              <p style="margin:8px 0 0;font-size:12px;color:#94a3b8;text-align:center;line-height:1.5;">
                If you did not attempt this login, we recommend changing your password immediately.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:18px 32px;background-color:#f8fafc;border-top:1px solid #e2e8f0;text-align:center;">
              <p style="margin:0;font-size:12px;color:#94a3b8;">&copy; ${new Date().getFullYear()} MarketLink — eGreen Basket. All rights reserved.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
    });
  } catch (error) {
    console.error(`[EMAIL] 2FA OTP failed for ${toEmail}:`, error.message);
    throw new Error('Failed to send 2FA code email. Please try again.');
  }
};
