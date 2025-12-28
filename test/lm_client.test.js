"use strict";

process.env.NODE_ENV = "test";

const {
  generateInstallationKey,
  extractPowerFromDashboard,
  _test,
  LaMarzoccoCloudClient,
} = require("../lib/lm_client");

function createMockResponse({ ok, status = 200, statusText = "OK", body = {} }) {
  return {
    ok,
    status,
    statusText,
    text: async () => JSON.stringify(body),
  };
}

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

test("registerClient posts installation key and headers", async () => {
  const key = generateInstallationKey("register-test");
  const client = new LaMarzoccoCloudClient({
    username: "user",
    password: "pass",
    installationKey: key,
  });

  global.fetch = jest.fn(async () =>
    createMockResponse({ ok: true, body: {} })
  );

  await client.registerClient();

  const [url, options] = global.fetch.mock.calls[0];
  expect(url).toContain("/auth/init");
  expect(options.method).toBe("POST");
  expect(options.headers["X-App-Installation-Id"]).toBe("register-test");
  expect(options.headers["X-Request-Proof"]).toBeTruthy();
  const body = JSON.parse(options.body);
  expect(body.pk).toBeTruthy();
});

test("getAccessToken stores access and refresh tokens", async () => {
  const key = generateInstallationKey("signin-test");
  const client = new LaMarzoccoCloudClient({
    username: "user",
    password: "pass",
    installationKey: key,
  });

  global.fetch = jest.fn(async () =>
    createMockResponse({
      ok: true,
      body: { accessToken: "token-a", refreshToken: "token-r" },
    })
  );

  await client.getAccessToken();

  expect(client.token.access_token).toBe("token-a");
  expect(client.token.refresh_token).toBe("token-r");
});

test("signIn surfaces jsonRequest errors", async () => {
  const key = generateInstallationKey("signin-error");
  const client = new LaMarzoccoCloudClient({
    username: "user",
    password: "pass",
    installationKey: key,
  });

  global.fetch = jest.fn(async () =>
    createMockResponse({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
      body: { message: "bad creds" },
    })
  );

  await expect(client.signIn()).rejects.toMatchObject({
    status: 401,
    payload: { message: "bad creds" },
  });
});

test("getAccessToken refreshes when near expiry", async () => {
  const key = generateInstallationKey("refresh-test");
  const client = new LaMarzoccoCloudClient({
    username: "user",
    password: "pass",
    installationKey: key,
  });

  const now = Date.now();
  client.token = {
    access_token: "old",
    refresh_token: "refresh",
    expires_at: now + 1000,
  };

  client.refreshToken = jest.fn().mockResolvedValue({
    access_token: "new",
    refresh_token: "refresh-2",
    expires_at: now + 3600000,
  });

  const token = await client.getAccessToken();
  expect(token).toBe("new");
  expect(client.refreshToken).toHaveBeenCalledTimes(1);
});

test("apiCall sends authorization header and body", async () => {
  const key = generateInstallationKey("api-test");
  const client = new LaMarzoccoCloudClient({
    username: "user",
    password: "pass",
    installationKey: key,
  });

  client.getAccessToken = jest.fn().mockResolvedValue("token-x");
  global.fetch = jest.fn(async () =>
    createMockResponse({ ok: true, body: { ok: true } })
  );

  await client.apiCall({
    url: "https://example.com/test",
    method: "POST",
    body: { value: 123 },
  });

  const [, options] = global.fetch.mock.calls[0];
  expect(options.headers.Authorization).toBe("Bearer token-x");
  expect(JSON.parse(options.body)).toEqual({ value: 123 });
});

test("getDashboard calls apiCall with dashboard endpoint", async () => {
  const key = generateInstallationKey("dashboard-test");
  const client = new LaMarzoccoCloudClient({
    username: "user",
    password: "pass",
    installationKey: key,
  });

  client.apiCall = jest.fn().mockResolvedValue({ widgets: [] });
  await client.getDashboard("SERIAL123");
  expect(client.apiCall).toHaveBeenCalledWith(
    expect.objectContaining({
      url: expect.stringContaining("/things/SERIAL123/dashboard"),
      method: "GET",
    })
  );
});

test("setPower posts BrewingMode or StandBy", async () => {
  const key = generateInstallationKey("power-test");
  const client = new LaMarzoccoCloudClient({
    username: "user",
    password: "pass",
    installationKey: key,
  });

  client.apiCall = jest.fn().mockResolvedValue({ ok: true });

  await client.setPower("SERIAL123", true);
  await client.setPower("SERIAL123", false);

  expect(client.apiCall).toHaveBeenNthCalledWith(
    1,
    expect.objectContaining({
      body: { mode: "BrewingMode" },
    })
  );
  expect(client.apiCall).toHaveBeenNthCalledWith(
    2,
    expect.objectContaining({
      body: { mode: "StandBy" },
    })
  );
});
