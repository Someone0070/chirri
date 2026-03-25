#!/usr/bin/env tsx
/**
 * MCP Monitoring Test Script — Wayback Machine MCP Server
 *
 * Two modes:
 *   1. SIMULATED (default) — runs fake snapshots through our differ + impact analyzer
 *   2. LIVE (pass --live)  — spawns the real wayback MCP server via stdio
 *
 * Usage:
 *   pnpm test:mcp            # simulated only
 *   pnpm test:mcp -- --live  # also run live server test
 */

import { spawn, type ChildProcess } from 'child_process';
import { existsSync, readFileSync, writeFileSync, copyFileSync } from 'fs';
import { resolve } from 'path';

import { diffMcpTools } from '../packages/worker/src/checkers/mcp/differ.js';
import { classifyChangeSeverity, generateImpactReport } from '../packages/worker/src/checkers/mcp/impact.js';
import type { McpToolDefinition } from '../packages/worker/src/checkers/mcp/types.js';

// ─── Helpers ────────────────────────────────────────────────────────────────

const SNAPSHOT_0 = '/tmp/wayback-mcp-snapshot-0.json';
const SNAPSHOT_1 = '/tmp/wayback-mcp-snapshot-1.json';

function hr(label: string) {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  ${label}`);
  console.log(`${'═'.repeat(60)}\n`);
}

// ─── MCP Stdio Transport ────────────────────────────────────────────────────

/**
 * Encode a JSON-RPC message for stdio transport.
 * Supports both Content-Length framing (MCP spec) and plain JSON newline.
 */
function encodeMessage(msg: unknown, framing: 'content-length' | 'jsonl' = 'jsonl'): string {
  const body = JSON.stringify(msg);
  if (framing === 'content-length') {
    return `Content-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`;
  }
  return body + '\n';
}

/**
 * Read one MCP stdio message from a buffer.
 * Returns [parsedMessage, remainingBuffer] or [null, buffer] if incomplete.
 */
function tryParseMessage(buf: string): [unknown | null, string] {
  // Try Content-Length framing first
  const headerMatch = buf.match(/^Content-Length:\s*(\d+)\r?\n\r?\n/);
  if (headerMatch) {
    const headerLen = headerMatch[0].length;
    const bodyLen = parseInt(headerMatch[1], 10);
    if (buf.length >= headerLen + bodyLen) {
      const body = buf.slice(headerLen, headerLen + bodyLen);
      const rest = buf.slice(headerLen + bodyLen);
      try {
        return [JSON.parse(body), rest];
      } catch {
        return [null, buf];
      }
    }
    return [null, buf]; // incomplete
  }

  // Fallback: try line-delimited JSON (some servers do this)
  const nlIdx = buf.indexOf('\n');
  if (nlIdx !== -1) {
    const line = buf.slice(0, nlIdx).trim();
    const rest = buf.slice(nlIdx + 1);
    if (line.length === 0) return [null, rest]; // skip blank
    try {
      return [JSON.parse(line), rest];
    } catch {
      // Not JSON — skip this line
      return [null, rest];
    }
  }

  return [null, buf];
}

/**
 * Send a JSON-RPC request to the MCP server and wait for a response with matching id.
 */
function sendRequest(
  proc: ChildProcess,
  method: string,
  params: unknown,
  id: number,
): Promise<any> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`Timeout waiting for response to ${method}`)), 15000);

    let buffer = '';
    const onData = (chunk: Buffer) => {
      buffer += chunk.toString();
      let msg: unknown | null;
      [msg, buffer] = tryParseMessage(buffer);
      while (msg !== null) {
        const resp = msg as any;
        if (resp.id === id) {
          clearTimeout(timeout);
          proc.stdout!.off('data', onData);
          if (resp.error) {
            reject(new Error(`JSON-RPC error: ${JSON.stringify(resp.error)}`));
          } else {
            resolve(resp.result);
          }
          return;
        }
        // Not our response — try next message in buffer
        [msg, buffer] = tryParseMessage(buffer);
      }
    };

    proc.stdout!.on('data', onData);

    const request = {
      jsonrpc: '2.0',
      id,
      method,
      params: params ?? {},
    };
    proc.stdin!.write(encodeMessage(request));
  });
}

// ─── Simulated Test ─────────────────────────────────────────────────────────

function runSimulatedTest() {
  hr('SIMULATED DIFFER TEST');

  // Snapshot A: baseline with 3 tools
  const snapshotA: McpToolDefinition[] = [
    {
      name: 'get_snapshot',
      description: 'Get a snapshot of a URL from the Wayback Machine',
      inputSchema: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'The URL to look up' },
          timestamp: { type: 'string', description: 'Timestamp in YYYYMMDD format' },
        },
        required: ['url'],
      },
    },
    {
      name: 'search_pages',
      description: 'Search for archived pages matching a query',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query' },
          limit: { type: 'number', description: 'Max results' },
        },
        required: ['query'],
      },
    },
    {
      name: 'check_availability',
      description: 'Check if a URL is in the Wayback Machine',
      inputSchema: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'URL to check' },
        },
        required: ['url'],
      },
    },
  ];

  // Snapshot B: tool removed + new required param + new optional param + new tool
  const snapshotB: McpToolDefinition[] = [
    {
      name: 'get_snapshot',
      description: 'Retrieve a snapshot of a URL from the Wayback Machine archive',
      inputSchema: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'The URL to look up' },
          timestamp: { type: 'string', description: 'Timestamp in YYYYMMDD format' },
          format: { type: 'string', description: 'Output format', enum: ['html', 'json'] },
        },
        required: ['url', 'format'], // format is new and required → BREAKING
      },
    },
    // search_pages REMOVED → BREAKING
    {
      name: 'check_availability',
      description: 'Check if a URL is in the Wayback Machine',
      inputSchema: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'URL to check' },
          include_redirects: { type: 'boolean', description: 'Include redirects' }, // optional new param
        },
        required: ['url'],
      },
    },
    {
      name: 'get_calendar',
      description: 'Get calendar of available snapshots for a URL',
      inputSchema: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'URL to check' },
          year: { type: 'number', description: 'Year to query' },
        },
        required: ['url'],
      },
    },
  ];

  console.log('Snapshot A: %d tools (%s)', snapshotA.length, snapshotA.map((t) => t.name).join(', '));
  console.log('Snapshot B: %d tools (%s)', snapshotB.length, snapshotB.map((t) => t.name).join(', '));

  const diff = diffMcpTools(snapshotA, snapshotB);

  console.log('\n--- Diff Result ---');
  console.log('Has changes:', diff.hasChanges);
  console.log('Summary:', diff.summary);
  console.log('Breaking:', diff.breakingChanges, '| Non-breaking:', diff.nonBreakingChanges);
  console.log('Added:', diff.addedTools);
  console.log('Removed:', diff.removedTools);
  console.log('Modified:', diff.modifiedTools);

  console.log('\n--- All Changes ---');
  for (const c of diff.changes) {
    const icon = c.severity === 'breaking' ? '🔴' : '🟢';
    console.log(`  ${icon} [${c.type}] ${c.details}`);
  }

  const severity = classifyChangeSeverity(diff);
  console.log('\n--- Impact Classification ---');
  console.log('Severity:', severity.toUpperCase());

  console.log('\n--- Impact Report ---');
  console.log(generateImpactReport(diff));

  // Verify expected results
  const expectedBreaking = diff.changes.filter((c) => c.severity === 'breaking');
  const passed =
    diff.hasChanges === true &&
    diff.addedTools.includes('get_calendar') &&
    diff.removedTools.includes('search_pages') &&
    expectedBreaking.length >= 2 && // at least: tool removed + required param added
    severity === 'critical';

  console.log(passed ? '✅ SIMULATED TEST PASSED' : '❌ SIMULATED TEST FAILED');
  return passed;
}

// ─── Live Test ──────────────────────────────────────────────────────────────

async function runLiveTest() {
  hr('LIVE WAYBACK MACHINE MCP SERVER TEST');

  console.log('Spawning mcp-wayback-machine via stdio...');

  const proc = spawn('npx', ['mcp-wayback-machine'], {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env },
  });

  // Log stderr for debugging
  let stderrBuf = '';
  proc.stderr!.on('data', (chunk: Buffer) => {
    stderrBuf += chunk.toString();
  });

  proc.on('error', (err) => {
    console.error('Failed to spawn MCP server:', err.message);
    process.exit(1);
  });

  try {
    // Step 1: Initialize
    console.log('→ Sending initialize...');
    const initResult = await sendRequest(
      proc,
      'initialize',
      {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'chirri-test', version: '0.1.0' },
      },
      1,
    );
    console.log('← Server info:', JSON.stringify(initResult.serverInfo ?? initResult, null, 2));

    // Send initialized notification (no id = notification)
    const notification = {
      jsonrpc: '2.0',
      method: 'notifications/initialized',
      params: {},
    };
    proc.stdin!.write(encodeMessage(notification));

    // Step 2: List tools
    console.log('\n→ Sending tools/list...');
    const toolsResult = await sendRequest(proc, 'tools/list', {}, 2);
    const tools: McpToolDefinition[] = toolsResult.tools ?? [];

    console.log(`← Got ${tools.length} tools:`);
    for (const t of tools) {
      const params = Object.keys(t.inputSchema?.properties ?? {});
      console.log(`  • ${t.name} (${params.join(', ')})`);
    }

    // Step 3: Save snapshot
    const snapshot = {
      timestamp: new Date().toISOString(),
      serverInfo: initResult.serverInfo ?? initResult,
      tools,
    };
    writeFileSync(SNAPSHOT_1, JSON.stringify(snapshot, null, 2));
    console.log(`\nSnapshot saved to ${SNAPSHOT_1}`);

    // Step 4: Diff with previous if exists
    if (existsSync(SNAPSHOT_0)) {
      console.log(`\nPrevious snapshot found at ${SNAPSHOT_0}, running diff...`);
      const prev = JSON.parse(readFileSync(SNAPSHOT_0, 'utf-8'));
      const diff = diffMcpTools(prev.tools, tools);

      if (diff.hasChanges) {
        console.log('\n--- Changes Detected ---');
        console.log('Summary:', diff.summary);
        const severity = classifyChangeSeverity(diff);
        console.log('Severity:', severity.toUpperCase());
        console.log(generateImpactReport(diff));
      } else {
        console.log('No changes since last snapshot.');
      }
    } else {
      console.log(`\nNo previous snapshot. Copying to ${SNAPSHOT_0} for next comparison.`);
      copyFileSync(SNAPSHOT_1, SNAPSHOT_0);
    }

    console.log('\n✅ LIVE TEST PASSED');
  } catch (err: any) {
    console.error('\n❌ LIVE TEST FAILED:', err.message);
    if (stderrBuf) {
      console.error('Server stderr:', stderrBuf.slice(0, 500));
    }
  } finally {
    proc.stdin!.end();
    proc.kill('SIGTERM');
    // Give it a moment to exit
    await new Promise((r) => setTimeout(r, 500));
  }
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const runLive = args.includes('--live');

  const simPassed = runSimulatedTest();

  if (runLive) {
    await runLiveTest();
  } else {
    console.log('\nSkipping live test (pass --live to enable)');
  }

  process.exit(simPassed ? 0 : 1);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
