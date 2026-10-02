import test from 'node:test';
import assert from 'node:assert/strict';
import { assertVoiceMcpOperation, isVoiceMcpOperationAllowed, listAllowedVoiceMcpOperations } from '../src/voice-mcp-boundary.js';

test('voice MCP exposes only bounded speech operations', () => {
  for (const op of ['health','list-engines','list-voices','transcribe','synthesize']) assert.equal(isVoiceMcpOperationAllowed(op), true);
  assert.equal(isVoiceMcpOperationAllowed('modify-corpus'), false);
  assert.equal(isVoiceMcpOperationAllowed('publish-source-content'), false);
  assert.equal(isVoiceMcpOperationAllowed('bypass-rights-gates'), false);
  assert.deepEqual(listAllowedVoiceMcpOperations(), ['health','list-engines','list-voices','transcribe','synthesize']);
});

test('blocked operations fail closed', () => {
  assert.throws(() => assertVoiceMcpOperation('modify-corpus'), /Blocked Al-Huda voice MCP operation/);
});