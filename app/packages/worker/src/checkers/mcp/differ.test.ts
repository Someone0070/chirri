/**
 * Tests for MCP Tool Definition Differ
 */

import { describe, it, expect } from 'vitest';
import { diffMcpTools, hashTool, canonicalJson, hashToolsList } from './differ.js';
import type { McpToolDefinition } from './types.js';

// ─── Helpers ────────────────────────────────────────────────────────────────

function tool(
  name: string,
  description: string,
  properties: Record<string, any> = {},
  required: string[] = [],
): McpToolDefinition {
  return {
    name,
    description,
    inputSchema: {
      type: 'object',
      properties,
      required,
    },
  };
}

// ─── canonicalJson ──────────────────────────────────────────────────────────

describe('canonicalJson', () => {
  it('sorts object keys', () => {
    const a = canonicalJson({ b: 1, a: 2 });
    const b = canonicalJson({ a: 2, b: 1 });
    expect(a).toBe(b);
  });

  it('handles nested objects', () => {
    const result = canonicalJson({ z: { b: 1, a: 2 }, a: 3 });
    expect(result).toBe('{"a":3,"z":{"a":2,"b":1}}');
  });

  it('handles arrays', () => {
    expect(canonicalJson([3, 1, 2])).toBe('[3,1,2]');
  });

  it('handles null', () => {
    expect(canonicalJson(null)).toBe('null');
  });
});

// ─── hashTool ───────────────────────────────────────────────────────────────

describe('hashTool', () => {
  it('produces same hash for equivalent tools regardless of key order', () => {
    const t1: McpToolDefinition = {
      name: 'test',
      description: 'desc',
      inputSchema: { type: 'object', properties: { a: { type: 'string' } } },
    };
    const t2: McpToolDefinition = {
      description: 'desc',
      name: 'test',
      inputSchema: { type: 'object', properties: { a: { type: 'string' } } },
    };
    expect(hashTool(t1)).toBe(hashTool(t2));
  });

  it('produces different hash for different tools', () => {
    const t1 = tool('read', 'Read a file');
    const t2 = tool('write', 'Write a file');
    expect(hashTool(t1)).not.toBe(hashTool(t2));
  });
});

// ─── diffMcpTools ───────────────────────────────────────────────────────────

describe('diffMcpTools', () => {
  it('detects no changes when tools are identical', () => {
    const tools = [tool('read_file', 'Read a file', { path: { type: 'string' } }, ['path'])];
    const result = diffMcpTools(tools, tools);
    expect(result.hasChanges).toBe(false);
    expect(result.changes).toHaveLength(0);
    expect(result.summary).toBe('No changes');
  });

  it('detects tool addition as non-breaking', () => {
    const before = [tool('read_file', 'Read a file')];
    const after = [
      tool('read_file', 'Read a file'),
      tool('write_file', 'Write a file'),
    ];

    const result = diffMcpTools(before, after);
    expect(result.hasChanges).toBe(true);
    expect(result.addedTools).toEqual(['write_file']);
    expect(result.breakingChanges).toBe(0);
    expect(result.nonBreakingChanges).toBe(1);
  });

  it('detects tool removal as breaking', () => {
    const before = [
      tool('read_file', 'Read'),
      tool('write_file', 'Write'),
    ];
    const after = [tool('read_file', 'Read')];

    const result = diffMcpTools(before, after);
    expect(result.removedTools).toEqual(['write_file']);
    expect(result.breakingChanges).toBe(1);
  });

  it('detects required parameter addition as breaking', () => {
    const before = [
      tool('create_user', 'Create user', { name: { type: 'string' } }, ['name']),
    ];
    const after = [
      tool(
        'create_user',
        'Create user',
        { name: { type: 'string' }, email: { type: 'string' } },
        ['name', 'email'],
      ),
    ];

    const result = diffMcpTools(before, after);
    expect(result.breakingChanges).toBeGreaterThan(0);
    expect(result.changes.some((c) => c.details.includes('email'))).toBe(true);
  });

  it('detects optional parameter addition as non-breaking', () => {
    const before = [
      tool('create_user', 'Create user', { name: { type: 'string' } }, ['name']),
    ];
    const after = [
      tool(
        'create_user',
        'Create user',
        { name: { type: 'string' }, age: { type: 'number' } },
        ['name'],
      ),
    ];

    const result = diffMcpTools(before, after);
    expect(result.nonBreakingChanges).toBeGreaterThan(0);
    expect(result.breakingChanges).toBe(0);
  });

  it('detects parameter type change as breaking', () => {
    const before = [
      tool('get_user', 'Get user', { id: { type: 'string' } }, ['id']),
    ];
    const after = [
      tool('get_user', 'Get user', { id: { type: 'number' } }, ['id']),
    ];

    const result = diffMcpTools(before, after);
    expect(result.breakingChanges).toBeGreaterThan(0);
    expect(
      result.changes.some(
        (c) => c.details.includes('type changed') && c.details.includes('id'),
      ),
    ).toBe(true);
  });

  it('detects parameter removal as breaking', () => {
    const before = [
      tool(
        'search',
        'Search',
        { query: { type: 'string' }, limit: { type: 'number' } },
        ['query'],
      ),
    ];
    const after = [
      tool('search', 'Search', { query: { type: 'string' } }, ['query']),
    ];

    const result = diffMcpTools(before, after);
    expect(result.breakingChanges).toBeGreaterThan(0);
    expect(
      result.changes.some(
        (c) => c.details.includes('limit') && c.details.includes('removed'),
      ),
    ).toBe(true);
  });

  it('detects description change as non-breaking', () => {
    const before = [tool('read_file', 'Read a file')];
    const after = [tool('read_file', 'Read a file from disk')];

    const result = diffMcpTools(before, after);
    expect(result.hasChanges).toBe(true);
    expect(result.breakingChanges).toBe(0);
    expect(
      result.changes.some((c) => c.type === 'description_changed'),
    ).toBe(true);
  });

  it('detects multiple changes correctly', () => {
    const before = [
      tool('tool_a', 'A', { x: { type: 'string' } }),
      tool('tool_b', 'B'),
      tool('tool_c', 'C'),
    ];
    const after = [
      tool('tool_a', 'A updated', { x: { type: 'string' } }), // description changed
      // tool_b removed
      tool('tool_c', 'C'),
      tool('tool_d', 'D'), // added
    ];

    const result = diffMcpTools(before, after);
    expect(result.addedTools).toEqual(['tool_d']);
    expect(result.removedTools).toEqual(['tool_b']);
    expect(result.modifiedTools).toContain('tool_a');
    expect(result.breakingChanges).toBeGreaterThan(0); // tool_b removed
  });

  it('detects required-to-optional change as non-breaking', () => {
    const before = [
      tool(
        'create_item',
        'Create',
        { name: { type: 'string' }, desc: { type: 'string' } },
        ['name', 'desc'],
      ),
    ];
    const after = [
      tool(
        'create_item',
        'Create',
        { name: { type: 'string' }, desc: { type: 'string' } },
        ['name'],
      ),
    ];

    const result = diffMcpTools(before, after);
    expect(result.hasChanges).toBe(true);
    // Required-to-optional is non-breaking
    const reqChange = result.changes.find(
      (c) => c.details.includes('desc') && c.details.includes('optional'),
    );
    expect(reqChange).toBeDefined();
    expect(reqChange!.severity).toBe('non-breaking');
  });

  it('builds a readable summary', () => {
    const before = [tool('a', 'A'), tool('b', 'B')];
    const after = [tool('a', 'A'), tool('c', 'C')];

    const result = diffMcpTools(before, after);
    expect(result.summary).toContain('added');
    expect(result.summary).toContain('removed');
    expect(result.summary).toContain('BREAKING');
  });
});
