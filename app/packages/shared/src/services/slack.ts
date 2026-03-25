import type { ChangeInfo } from './email.js';

// ============================================================================
// Slack Block Kit message builder
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

const DASHBOARD_URL = process.env.DASHBOARD_URL || 'https://app.chirri.io';

interface SlackBlock {
  type: string;
  text?: { type: string; text: string; emoji?: boolean };
  elements?: Array<{ type: string; text?: { type: string; text: string }; url?: string }>;
  fields?: Array<{ type: string; text: string }>;
}

function buildSlackBlocks(change: ChangeInfo): SlackBlock[] {
  return [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `${severityEmoji(change.severity)} *API Change Detected* — \`${change.severity.toUpperCase()}\``,
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*${change.summary}*`,
      },
    },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*Type:*\n${change.changeType}` },
        { type: 'mrkdwn', text: `*URL:*\n\`${change.url}\`` },
        {
          type: 'mrkdwn',
          text: `*Detected:*\n${new Date(change.detectedAt).toUTCString()}`,
        },
      ],
    },
    {
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: { type: 'plain_text', text: 'View in Chirri →' },
          url: `${DASHBOARD_URL}/changes/${change.id}`,
        },
      ],
    },
  ];
}

// ============================================================================
// Public API
// ============================================================================

export async function sendSlackNotification(
  webhookUrl: string,
  change: ChangeInfo,
): Promise<{ success: boolean; error?: string }> {
  try {
    const payload = {
      attachments: [
        {
          color: severityColor(change.severity),
          blocks: buildSlackBlocks(change),
        },
      ],
    };

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      return { success: false, error: `Slack webhook returned ${response.status}: ${text}` };
    }

    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}
