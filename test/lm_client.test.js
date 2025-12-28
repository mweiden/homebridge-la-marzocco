"use strict";

process.env.NODE_ENV = "test";

const {
  generateInstallationKey,
  extractPowerFromDashboard,
  _test,
} = require("../lib/lm_client");

test("generateInstallationKey returns base64 key material", () => {
  const key = generateInstallationKey("test-installation-id");
  expect(key.installation_id).toBe("test-installation-id");

  const secret = Buffer.from(key.secret, "base64");
  expect(secret.length).toBe(32);

  const privateKey = Buffer.from(key.private_key, "base64");
  expect(privateKey.length).toBeGreaterThan(0);
});

test("parseInstallationKey rejects invalid payloads", () => {
  expect(() => _test.parseInstallationKey(null)).toThrow();
  expect(() => _test.parseInstallationKey({})).toThrow();
  expect(() => _test.parseInstallationKey({ installation_id: "x" })).toThrow();
});

test("parseInstallationKey returns secret buffer", () => {
  const key = generateInstallationKey("parse-test");
  const parsed = _test.parseInstallationKey(key);
  expect(Buffer.isBuffer(parsed.secret)).toBe(true);
  expect(parsed.secret.length).toBe(32);
  expect(parsed.installation_id).toBe("parse-test");
});

test("generateRequestProof is deterministic", () => {
  const secret = Buffer.from([...Array(32).keys()]);
  const proof = _test.generateRequestProof(
    "installation.nonce.timestamp",
    secret
  );
  expect(proof).toBe("eX0MVKqbkc9tIyJFv+Q9gMELTaRzCFTepXSz9+yIJBw=");
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
  expect(extractPowerFromDashboard(dashboard)).toBe(false);
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
  expect(extractPowerFromDashboard(dashboard)).toBe(true);
});

test("extractPowerFromDashboard returns null for missing widgets", () => {
  expect(extractPowerFromDashboard({})).toBeNull();
  expect(extractPowerFromDashboard({ widgets: [] })).toBeNull();
});
