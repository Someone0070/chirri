import type { ChangeInfo } from './email.js';

// ============================================================================
// Discord embed builder
// ============================================================================

function severityColorInt(severity: string): number {
  switch (severity) {
    case 'critical':
      return 0xdc2626; // red
    case 'high':
      return 0xea580c; // orange
    case 'medium':
      return 0xf59e0b; // amber
    case 'low':
      return 0x22c55e; // green
    default:
      return 0x6b7280; // gray
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

interface DiscordEmbed {
  title: string;
  description: string;
  color: number;
  fields: Array<{ name: string; value: string; inline?: boolean }>;
  footer: { text: string };
  timestamp: string;
  url: string;
}

function buildEmbed(change: ChangeInfo): DiscordEmbed {
  return {
    title: `${severityEmoji(change.severity)} API Change — ${change.severity.toUpperCase()}`,
    description: change.summary,
    color: severityColorInt(change.severity),
    url: `${DASHBOARD_URL}/changes/${change.id}`,
    fields: [
      { name: 'Type', value: change.changeType, inline: true },
      { name: 'URL', value: `\`${change.url}\``, inline: true },
      {
        name: 'Detected',
        value: new Date(change.detectedAt).toUTCString(),
        inline: false,
      },
    ],
    footer: { text: 'Chirri — APIs change. We\'ll let you know.' },
    timestamp: new Date(change.detectedAt).toISOString(),
  };
}

// ============================================================================
// Public API
// ============================================================================

export async function sendDiscordNotification(
  webhookUrl: string,
  change: ChangeInfo,
): Promise<{ success: boolean; error?: string }> {
  try {
    const payload = {
      embeds: [buildEmbed(change)],
    };

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      return { success: false, error: `Discord webhook returned ${response.status}: ${text}` };
    }

    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}
