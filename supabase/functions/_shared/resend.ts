/**
 * Shared Resend email service for Supabase Edge Functions
 */

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendEmail(options: EmailOptions): Promise<void> {
  const resendApiKey = Deno.env.get('RESEND_API_KEY');
  const fromEmail = Deno.env.get('RESEND_FROM_EMAIL') || 'noreply@foundrylab.app';

  if (!resendApiKey) {
    throw new Error('RESEND_API_KEY environment variable is not set');
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${resendApiKey}`,
    },
    body: JSON.stringify({
      from: fromEmail,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text || stripHtml(options.html),
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to send email: ${error}`);
  }
}

function stripHtml(html: string): string {
  // Simple HTML stripping for plain text fallback
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .trim();
}

/**
 * Welcome email template
 */
export function welcomeEmailTemplate(userEmail: string, displayName?: string): { html: string; text: string } {
  const name = displayName || 'there';
  const appUrl = Deno.env.get('APP_URL') || 'https://foundrylab.app';

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to Foundry Lab</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #0E1116; color: #E6E8EB;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0E1116; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #1C222B; border-radius: 8px; border: 1px solid #353D4B;">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 30px; text-align: center; border-bottom: 1px solid #353D4B;">
              <h1 style="margin: 0; color: #2F80ED; font-size: 28px; font-weight: 700;">Foundry Lab</h1>
              <p style="margin: 10px 0 0; color: #878E9C; font-size: 14px;">Industrial-grade training analytics</p>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 20px; color: #E6E8EB; font-size: 24px; font-weight: 600;">Welcome, ${name}!</h2>
              <p style="margin: 0 0 20px; color: #C4C8D0; font-size: 16px; line-height: 1.6;">
                Thank you for joining Foundry Lab. You're now ready to track your training, analyze your performance, and forge your path to peak performance.
              </p>
              <p style="margin: 0 0 30px; color: #C4C8D0; font-size: 16px; line-height: 1.6;">
                Get started by logging your first workout or importing a training block to track your progress over time.
              </p>
              
              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding: 20px 0;">
                    <a href="${appUrl}" style="display: inline-block; padding: 14px 32px; background-color: #2F80ED; color: #FFFFFF; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">Open Foundry Lab</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px; border-top: 1px solid #353D4B; text-align: center;">
              <p style="margin: 0 0 10px; color: #6B7485; font-size: 14px;">Questions? Reply to this email.</p>
              <p style="margin: 0; color: #525C6E; font-size: 12px;">© ${new Date().getFullYear()} Foundry Lab. All rights reserved.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  const text = `Welcome to Foundry Lab!

Hi ${name},

Thank you for joining Foundry Lab. You're now ready to track your training, analyze your performance, and forge your path to peak performance.

Get started by logging your first workout or importing a training block to track your progress over time.

Visit ${appUrl} to get started.

Questions? Reply to this email.

© ${new Date().getFullYear()} Foundry Lab. All rights reserved.`;

  return { html, text };
}

/**
 * Password reset email template
 */
export function passwordResetEmailTemplate(resetLink: string, expiresIn: string = '1 hour'): { html: string; text: string } {
  const appUrl = Deno.env.get('APP_URL') || 'https://foundrylab.app';

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset your Foundry Lab password</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #0E1116; color: #E6E8EB;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0E1116; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #1C222B; border-radius: 8px; border: 1px solid #353D4B;">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 30px; text-align: center; border-bottom: 1px solid #353D4B;">
              <h1 style="margin: 0; color: #2F80ED; font-size: 28px; font-weight: 700;">Foundry Lab</h1>
              <p style="margin: 10px 0 0; color: #878E9C; font-size: 14px;">Industrial-grade training analytics</p>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 20px; color: #E6E8EB; font-size: 24px; font-weight: 600;">Reset Your Password</h2>
              <p style="margin: 0 0 20px; color: #C4C8D0; font-size: 16px; line-height: 1.6;">
                We received a request to reset your password. Click the button below to create a new password.
              </p>
              <p style="margin: 0 0 30px; color: #878E9C; font-size: 14px; line-height: 1.6;">
                This link will expire in ${expiresIn}. If you didn't request a password reset, you can safely ignore this email.
              </p>
              
              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding: 20px 0;">
                    <a href="${resetLink}" style="display: inline-block; padding: 14px 32px; background-color: #2F80ED; color: #FFFFFF; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">Reset Password</a>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 30px 0 0; color: #6B7485; font-size: 14px; line-height: 1.6;">
                If the button doesn't work, copy and paste this link into your browser:<br>
                <a href="${resetLink}" style="color: #5B9DEF; word-break: break-all;">${resetLink}</a>
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px; border-top: 1px solid #353D4B; text-align: center;">
              <p style="margin: 0 0 10px; color: #6B7485; font-size: 14px;">If you didn't request this, you can safely ignore this email.</p>
              <p style="margin: 0; color: #525C6E; font-size: 12px;">© ${new Date().getFullYear()} Foundry Lab. All rights reserved.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  const text = `Reset your Foundry Lab password

We received a request to reset your password. Click the link below to create a new password.

${resetLink}

This link will expire in ${expiresIn}. If you didn't request a password reset, you can safely ignore this email.

© ${new Date().getFullYear()} Foundry Lab. All rights reserved.`;

  return { html, text };
}

/**
 * Password changed confirmation email template
 */
export function passwordChangedEmailTemplate(userEmail: string): { html: string; text: string } {
  const appUrl = Deno.env.get('APP_URL') || 'https://foundrylab.app';

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your password was changed</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #0E1116; color: #E6E8EB;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0E1116; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #1C222B; border-radius: 8px; border: 1px solid #353D4B;">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 30px; text-align: center; border-bottom: 1px solid #353D4B;">
              <h1 style="margin: 0; color: #2F80ED; font-size: 28px; font-weight: 700;">Foundry Lab</h1>
              <p style="margin: 10px 0 0; color: #878E9C; font-size: 14px;">Industrial-grade training analytics</p>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 20px; color: #E6E8EB; font-size: 24px; font-weight: 600;">Password Changed Successfully</h2>
              <p style="margin: 0 0 20px; color: #C4C8D0; font-size: 16px; line-height: 1.6;">
                Your Foundry Lab password has been successfully changed.
              </p>
              <p style="margin: 0 0 30px; color: #878E9C; font-size: 14px; line-height: 1.6;">
                If you didn't make this change, please contact us immediately and secure your account.
              </p>
              
              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding: 20px 0;">
                    <a href="${appUrl}/login" style="display: inline-block; padding: 14px 32px; background-color: #2F80ED; color: #FFFFFF; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">Sign In</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px; border-top: 1px solid #353D4B; text-align: center;">
              <p style="margin: 0 0 10px; color: #EB5757; font-size: 14px; font-weight: 600;">Security Notice</p>
              <p style="margin: 0 0 20px; color: #6B7485; font-size: 14px; line-height: 1.6;">
                If you didn't change your password, reply to this email immediately.
              </p>
              <p style="margin: 0; color: #525C6E; font-size: 12px;">© ${new Date().getFullYear()} Foundry Lab. All rights reserved.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  const text = `Password Changed Successfully

Your Foundry Lab password has been successfully changed.

If you didn't make this change, please contact us immediately and secure your account.

Visit ${appUrl}/login to sign in with your new password.

SECURITY NOTICE: If you didn't change your password, reply to this email immediately.

© ${new Date().getFullYear()} Foundry Lab. All rights reserved.`;

  return { html, text };
}
