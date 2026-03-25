import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_EMAIL = process.env.FROM_EMAIL || 'Chirri <notifications@chirri.io>';
const DASHBOARD_URL = process.env.DASHBOARD_URL || 'https://app.chirri.io';

// ============================================================================
// Types
// ============================================================================

export interface ChangeInfo {
  id: string;
  summary: string;
  severity: string;
  changeType: string;
  url: string;
  detectedAt: string;
  diff?: Record<string, unknown>;
}

// ============================================================================
// Template Helpers
// ============================================================================

function severityColor(severity: string): string {
  switch (severity) {
    case 'critical':
      return '#DC2626';
    case 'high':
      return '#EA580C';
    case 'medium':
      return '#F59E0B';
    case 'low':
      return '#22C55E';
    default:
      return '#6B7280';
  }
}

function severityEmoji(severity: string): string {
  switch (severity) {
    case 'critical':
      return '🔴';
    case 'high':
      return '🟠';
    case 'medium':
      return '🟡';
    case 'low':
      return '🟢';
    default:
      return '⚪';
  }
}

// ============================================================================
// Email Templates
// ============================================================================

function changeAlertHtml(change: ChangeInfo): string {
  const color = severityColor(change.severity);
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1a1a1a;">
  <div style="border-left: 4px solid ${color}; padding-left: 16px; margin-bottom: 24px;">
    <h2 style="margin: 0 0 8px 0; font-size: 20px;">API Change Detected</h2>
    <p style="margin: 0; color: #6B7280; font-size: 14px;">Severity: <strong style="color: ${color};">${change.severity.toUpperCase()}</strong></p>
  </div>
  
  <div style="background: #F9FAFB; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
    <p style="margin: 0 0 8px 0; font-size: 16px; font-weight: 600;">${escapeHtml(change.summary)}</p>
    <p style="margin: 0; color: #6B7280; font-size: 14px;">
      Type: ${change.changeType} · URL: <code style="background: #E5E7EB; padding: 2px 6px; border-radius: 4px; font-size: 13px;">${escapeHtml(change.url)}</code>
    </p>
    <p style="margin: 8px 0 0 0; color: #6B7280; font-size: 13px;">
      Detected: ${new Date(change.detectedAt).toUTCString()}
    </p>
  </div>

  <a href="${DASHBOARD_URL}/changes/${change.id}" style="display: inline-block; background: #2563EB; color: #fff; text-decoration: none; padding: 10px 20px; border-radius: 6px; font-size: 14px; font-weight: 500;">
    View Change Details →
  </a>

  <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 32px 0 16px 0;">
  <p style="color: #9CA3AF; font-size: 12px;">
    You're receiving this because you monitor this API on <a href="${DASHBOARD_URL}" style="color: #6B7280;">Chirri</a>. 
    <a href="${DASHBOARD_URL}/settings/notifications" style="color: #6B7280;">Manage preferences</a>
  </p>
</body>
</html>`;
}

function changeAlertText(change: ChangeInfo): string {
  return `${severityEmoji(change.severity)} API Change Detected — ${change.severity.toUpperCase()}

${change.summary}

Type: ${change.changeType}
URL: ${change.url}
Detected: ${new Date(change.detectedAt).toUTCString()}

View details: ${DASHBOARD_URL}/changes/${change.id}

---
Chirri · ${DASHBOARD_URL}`;
}

function weeklyDigestHtml(changes: ChangeInfo[]): string {
  const changeRows = changes
    .map(
      (c) => `
    <tr>
      <td style="padding: 8px 12px; border-bottom: 1px solid #E5E7EB;">
        <span style="color: ${severityColor(c.severity)}; font-weight: 600;">${c.severity.toUpperCase()}</span>
      </td>
      <td style="padding: 8px 12px; border-bottom: 1px solid #E5E7EB;">
        <a href="${DASHBOARD_URL}/changes/${c.id}" style="color: #2563EB; text-decoration: none;">${escapeHtml(c.summary)}</a>
      </td>
      <td style="padding: 8px 12px; border-bottom: 1px solid #E5E7EB; color: #6B7280; font-size: 13px;">
        ${c.changeType}
      </td>
    </tr>`,
    )
    .join('');

  const bySeverity = {
    critical: changes.filter((c) => c.severity === 'critical').length,
    high: changes.filter((c) => c.severity === 'high').length,
    medium: changes.filter((c) => c.severity === 'medium').length,
    low: changes.filter((c) => c.severity === 'low').length,
  };

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1a1a1a;">
  <h2 style="margin: 0 0 8px 0;">Your Weekly API Changes</h2>
  <p style="color: #6B7280; margin: 0 0 24px 0;">${changes.length} change${changes.length === 1 ? '' : 's'} detected this week</p>

  <div style="display: flex; gap: 12px; margin-bottom: 24px;">
    ${bySeverity.critical > 0 ? `<span style="background: #FEF2F2; color: #DC2626; padding: 4px 12px; border-radius: 12px; font-size: 13px; font-weight: 600;">🔴 ${bySeverity.critical} Critical</span>` : ''}
    ${bySeverity.high > 0 ? `<span style="background: #FFF7ED; color: #EA580C; padding: 4px 12px; border-radius: 12px; font-size: 13px; font-weight: 600;">🟠 ${bySeverity.high} High</span>` : ''}
    ${bySeverity.medium > 0 ? `<span style="background: #FFFBEB; color: #D97706; padding: 4px 12px; border-radius: 12px; font-size: 13px; font-weight: 600;">🟡 ${bySeverity.medium} Medium</span>` : ''}
    ${bySeverity.low > 0 ? `<span style="background: #F0FDF4; color: #16A34A; padding: 4px 12px; border-radius: 12px; font-size: 13px; font-weight: 600;">🟢 ${bySeverity.low} Low</span>` : ''}
  </div>

  <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
    <thead>
      <tr style="background: #F9FAFB;">
        <th style="padding: 8px 12px; text-align: left; font-size: 12px; color: #6B7280; text-transform: uppercase;">Severity</th>
        <th style="padding: 8px 12px; text-align: left; font-size: 12px; color: #6B7280; text-transform: uppercase;">Summary</th>
        <th style="padding: 8px 12px; text-align: left; font-size: 12px; color: #6B7280; text-transform: uppercase;">Type</th>
      </tr>
    </thead>
    <tbody>${changeRows}</tbody>
  </table>

  <div style="margin-top: 24px;">
    <a href="${DASHBOARD_URL}/changes" style="display: inline-block; background: #2563EB; color: #fff; text-decoration: none; padding: 10px 20px; border-radius: 6px; font-size: 14px; font-weight: 500;">
      View All Changes →
    </a>
  </div>

  <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 32px 0 16px 0;">
  <p style="color: #9CA3AF; font-size: 12px;">
    Weekly digest from <a href="${DASHBOARD_URL}" style="color: #6B7280;">Chirri</a>. 
    <a href="${DASHBOARD_URL}/settings/notifications" style="color: #6B7280;">Manage preferences</a>
  </p>
</body>
</html>`;
}

function weeklyDigestText(changes: ChangeInfo[]): string {
  const lines = changes.map(
    (c) => `${severityEmoji(c.severity)} [${c.severity.toUpperCase()}] ${c.summary} (${c.changeType})`,
  );
  return `Your Weekly API Changes — ${changes.length} change${changes.length === 1 ? '' : 's'}

${lines.join('\n')}

View all: ${DASHBOARD_URL}/changes

---
Chirri · ${DASHBOARD_URL}`;
}

function welcomeHtml(name: string): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1a1a1a;">
  <h2 style="margin: 0 0 8px 0;">Welcome to Chirri! 🐦</h2>
  <p style="color: #374151; line-height: 1.6;">
    Hey ${escapeHtml(name)}, thanks for signing up. Chirri watches your APIs so you don't have to.
  </p>

  <h3 style="margin: 24px 0 12px 0; font-size: 16px;">Get started in 3 steps:</h3>
  <ol style="color: #374151; line-height: 1.8; padding-left: 20px;">
    <li><strong>Add an API URL</strong> — paste any endpoint you depend on</li>
    <li><strong>Let Chirri learn</strong> — we'll establish a baseline (takes ~3 checks)</li>
    <li><strong>Get notified</strong> — when something changes, you'll know</li>
  </ol>

  <a href="${DASHBOARD_URL}/urls/new" style="display: inline-block; background: #2563EB; color: #fff; text-decoration: none; padding: 10px 20px; border-radius: 6px; font-size: 14px; font-weight: 500; margin-top: 16px;">
    Add Your First API →
  </a>

  <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 32px 0 16px 0;">
  <p style="color: #9CA3AF; font-size: 12px;">
    <a href="${DASHBOARD_URL}" style="color: #6B7280;">Chirri</a> — APIs change. We'll let you know.
  </p>
</body>
</html>`;
}

function welcomeText(name: string): string {
  return `Welcome to Chirri! 🐦

Hey ${name}, thanks for signing up. Chirri watches your APIs so you don't have to.

Get started:
1. Add an API URL — paste any endpoint you depend on
2. Let Chirri learn — we'll establish a baseline (~3 checks)
3. Get notified — when something changes, you'll know

Add your first API: ${DASHBOARD_URL}/urls/new

---
Chirri — APIs change. We'll let you know.`;
}

function dunningHtml(daysLeft: number): string {
  const urgency = daysLeft <= 3 ? '#DC2626' : '#F59E0B';
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1a1a1a;">
  <div style="border-left: 4px solid ${urgency}; padding-left: 16px; margin-bottom: 24px;">
    <h2 style="margin: 0 0 8px 0; font-size: 20px;">Payment Issue</h2>
    <p style="margin: 0; color: #6B7280; font-size: 14px;">Your subscription payment failed</p>
  </div>

  <p style="color: #374151; line-height: 1.6;">
    We couldn't process your payment. ${
      daysLeft > 0
        ? `Your account will be downgraded to the free plan in <strong style="color: ${urgency};">${daysLeft} day${daysLeft === 1 ? '' : 's'}</strong> unless we can charge your card successfully.`
        : `Your account has been <strong style="color: ${urgency};">downgraded to the free plan</strong>. URLs exceeding free tier limits have been paused.`
    }
  </p>

  <a href="${DASHBOARD_URL}/settings/billing" style="display: inline-block; background: #2563EB; color: #fff; text-decoration: none; padding: 10px 20px; border-radius: 6px; font-size: 14px; font-weight: 500; margin-top: 16px;">
    Update Payment Method →
  </a>

  <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 32px 0 16px 0;">
  <p style="color: #9CA3AF; font-size: 12px;">
    <a href="${DASHBOARD_URL}" style="color: #6B7280;">Chirri</a>
  </p>
</body>
</html>`;
}

function dunningText(daysLeft: number): string {
  const msg =
    daysLeft > 0
      ? `Your account will be downgraded in ${daysLeft} day${daysLeft === 1 ? '' : 's'}.`
      : `Your account has been downgraded to the free plan.`;
  return `⚠️ Payment Issue

We couldn't process your subscription payment. ${msg}

Update your payment method: ${DASHBOARD_URL}/settings/billing

---
Chirri · ${DASHBOARD_URL}`;
}

// ============================================================================
// Utility
// ============================================================================

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ============================================================================
// Public API
// ============================================================================

export async function sendChangeAlert(
  to: string,
  change: ChangeInfo,
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject: `${severityEmoji(change.severity)} [${change.severity.toUpperCase()}] ${change.summary}`,
      html: changeAlertHtml(change),
      text: changeAlertText(change),
    });
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

export async function sendWeeklyDigest(
  to: string,
  changes: ChangeInfo[],
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject: `📊 Your Weekly API Changes — ${changes.length} change${changes.length === 1 ? '' : 's'}`,
      html: weeklyDigestHtml(changes),
      text: weeklyDigestText(changes),
    });
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

export async function sendWelcome(
  to: string,
  name: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject: 'Welcome to Chirri! 🐦',
      html: welcomeHtml(name),
      text: welcomeText(name),
    });
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

export async function sendAgentSignupEmail(
  to: string,
  verifyUrl: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject: 'Your AI agent set up Chirri for you',
      html: agentSignupEmailHtml(verifyUrl),
      text: agentSignupEmailText(verifyUrl),
    });
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

function agentSignupEmailHtml(verifyUrl: string): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1a1a1a;">
  <h2 style="margin: 0 0 16px 0;">Your AI agent set up Chirri for you 🤖</h2>
  
  <p style="color: #374151; line-height: 1.6;">
    An AI agent is monitoring your API dependencies using Chirri. Your account is active and watching for changes.
  </p>

  <p style="color: #374151; line-height: 1.6;">
    Click below to access your dashboard and configure notifications, add more APIs, or manage your account.
  </p>

  <a href="${verifyUrl}" style="display: inline-block; background: #2563EB; color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-size: 14px; font-weight: 500; margin: 16px 0;">
    Access Your Dashboard →
  </a>

  <p style="color: #6B7280; font-size: 13px; line-height: 1.6; margin-top: 24px;">
    If you didn't expect this, you can safely ignore this email. The free plan monitors up to 3 API endpoints with daily checks.
  </p>

  <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 32px 0 16px 0;">
  <p style="color: #9CA3AF; font-size: 12px;">
    <a href="${DASHBOARD_URL}" style="color: #6B7280;">Chirri</a> — APIs change. We'll let you know.
  </p>
</body>
</html>`;
}

function agentSignupEmailText(verifyUrl: string): string {
  return `Your AI agent set up Chirri for you 🤖

An AI agent is monitoring your API dependencies using Chirri. Your account is active and watching for changes.

Access your dashboard and configure notifications: ${verifyUrl}

If you didn't expect this, you can safely ignore this email. The free plan monitors up to 3 API endpoints with daily checks.

---
Chirri — APIs change. We'll let you know.`;
}

export async function sendDunning(
  to: string,
  daysLeft: number,
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject:
        daysLeft > 0
          ? `⚠️ Payment failed — ${daysLeft} day${daysLeft === 1 ? '' : 's'} until downgrade`
          : '⚠️ Your account has been downgraded',
      html: dunningHtml(daysLeft),
      text: dunningText(daysLeft),
    });
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}
