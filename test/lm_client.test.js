"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  generateInstallationKey,
  extractPowerFromDashboard,
  _test,
} = require("../lib/lm_client");

test("generateInstallationKey returns base64 key material", () => {
  const key = generateInstallationKey("test-installation-id");
  assert.equal(key.installation_id, "test-installation-id");

  const secret = Buffer.from(key.secret, "base64");
  assert.equal(secret.length, 32);

  const privateKey = Buffer.from(key.private_key, "base64");
  assert.ok(privateKey.length > 0);
});

test("parseInstallationKey rejects invalid payloads", () => {
  assert.throws(() => _test.parseInstallationKey(null));
  assert.throws(() => _test.parseInstallationKey({}));
  assert.throws(() => _test.parseInstallationKey({ installation_id: "x" }));
});

test("parseInstallationKey returns secret buffer", () => {
  const key = generateInstallationKey("parse-test");
  const parsed = _test.parseInstallationKey(key);
  assert.ok(Buffer.isBuffer(parsed.secret));
  assert.equal(parsed.secret.length, 32);
  assert.equal(parsed.installation_id, "parse-test");
});

test("generateRequestProof is deterministic", () => {
  const secret = Buffer.from([...Array(32).keys()]);
  const proof = _test.generateRequestProof(
    "installation.nonce.timestamp",
    secret
  );
  assert.equal(proof, "eX0MVKqbkc9tIyJFv+Q9gMELTaRzCFTepXSz9+yIJBw=");
});

test("extractPowerFromDashboard returns false for standby", () => {
  const dashboard = {
    widgets: [
      {
        code: "CMMachineStatus",
        output: { mode: "StandBy" },
      },
    ],
  };
  assert.equal(extractPowerFromDashboard(dashboard), false);
});

test("extractPowerFromDashboard returns true for brewing", () => {
  const dashboard = {
    widgets: [
      {
        code: "CMMachineStatus",
        output: { mode: "BrewingMode" },
      },
    ],
  };
  assert.equal(extractPowerFromDashboard(dashboard), true);
});

test("extractPowerFromDashboard returns null for missing widgets", () => {
  assert.equal(extractPowerFromDashboard({}), null);
  assert.equal(extractPowerFromDashboard({ widgets: [] }), null);
});
