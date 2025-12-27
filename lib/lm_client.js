"use strict";

const crypto = require("crypto");

const BASE_URL = "https://lion.lamarzocco.io";
const CUSTOMER_APP_URL = `${BASE_URL}/api/customer-app`;
const TOKEN_TIME_TO_REFRESH_MS = 10 * 60 * 1000;
const TOKEN_EXPIRATION_MS = 60 * 60 * 1000;

function b64(buf) {
  return Buffer.from(buf).toString("base64");
}

function sha256(buf) {
  return crypto.createHash("sha256").update(buf).digest();
}

function generateRequestProof(baseString, secret32) {
  if (!Buffer.isBuffer(secret32) || secret32.length !== 32) {
    throw new Error("secret must be 32 bytes");
  }

  const work = Buffer.from(secret32);
  const input = Buffer.from(baseString, "utf8");

  for (const byteVal of input) {
    const idx = byteVal % 32;
    const shiftIdx = (idx + 1) % 32;
    const shiftAmount = work[shiftIdx] & 7;

    const xorResult = byteVal ^ work[idx];
    const rotated = ((xorResult << shiftAmount) | (xorResult >> (8 - shiftAmount))) & 0xff;
    work[idx] = rotated;
  }

  return b64(sha256(work));
}

function generateInstallationKey(installationId) {
  const { privateKey } = crypto.generateKeyPairSync("ec", {
    namedCurve: "prime256v1",
  });

  const privateKeyDer = privateKey.export({ format: "der", type: "pkcs8" });
  const publicKeyDer = crypto.createPublicKey(privateKey).export({ format: "der", type: "spki" });

  const pubB64 = b64(publicKeyDer);
  const instHashB64 = b64(sha256(Buffer.from(installationId, "utf8")));
  const secret = sha256(Buffer.from(`${installationId}.${pubB64}.${instHashB64}`, "utf8"));

  return {
    installation_id: installationId,
    secret: b64(secret),
    private_key: b64(privateKeyDer),
  };
}

function parseInstallationKey(raw) {
  if (!raw || !raw.installation_id || !raw.secret || !raw.private_key) {
    throw new Error("Invalid installation key data");
  }

  return {
    installation_id: raw.installation_id,
    secret: Buffer.from(raw.secret, "base64"),
    private_key: raw.private_key,
  };
}

function loadPrivateKey(installationKey) {
  return crypto.createPrivateKey({
    key: Buffer.from(installationKey.private_key, "base64"),
    format: "der",
    type: "pkcs8",
  });
}

function publicKeyBase64(installationKey) {
  const privateKey = loadPrivateKey(installationKey);
  const publicDer = crypto.createPublicKey(privateKey).export({ format: "der", type: "spki" });
  return b64(publicDer);
}

function baseStringForRegistration(installationKey) {
  const privateKey = loadPrivateKey(installationKey);
  const publicDer = crypto.createPublicKey(privateKey).export({ format: "der", type: "spki" });
  const pubHashB64 = b64(sha256(publicDer));
  return `${installationKey.installation_id}.${pubHashB64}`;
}

function generateExtraRequestHeaders(installationKey) {
  const nonce = crypto.randomUUID().toLowerCase();
  const timestamp = Date.now().toString();
  const proofInput = `${installationKey.installation_id}.${nonce}.${timestamp}`;
  const proof = generateRequestProof(proofInput, installationKey.secret);
  const signatureData = `${proofInput}.${proof}`;

  const signer = crypto.createSign("SHA256");
  signer.update(signatureData, "utf8");
  signer.end();

  const privateKey = loadPrivateKey(installationKey);
  const signature = signer.sign(privateKey);

  return {
    "X-App-Installation-Id": installationKey.installation_id,
    "X-Timestamp": timestamp,
    "X-Nonce": nonce,
    "X-Request-Signature": b64(signature),
  };
}

async function jsonRequest(url, options) {
  const response = await fetch(url, options);
  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch (err) {
    data = text;
  }

  if (!response.ok) {
    const error = new Error(`Request failed: ${response.status} ${response.statusText}`);
    error.status = response.status;
    error.payload = data;
    throw error;
  }

  return data;
}

class LaMarzoccoCloudClient {
  constructor({ username, password, installationKey }) {
    this.username = username;
    this.password = password;
    this.installationKey = parseInstallationKey(installationKey);
    this.token = null;
  }

  async registerClient() {
    const baseString = baseStringForRegistration(this.installationKey);
    const proof = generateRequestProof(baseString, this.installationKey.secret);

    const headers = {
      "X-App-Installation-Id": this.installationKey.installation_id,
      "X-Request-Proof": proof,
    };

    const body = {
      pk: publicKeyBase64(this.installationKey),
    };

    await jsonRequest(`${CUSTOMER_APP_URL}/auth/init`, {
      method: "POST",
      headers: {
        ...headers,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  }

  async getAccessToken() {
    if (!this.token) {
      this.token = await this.signIn();
      return this.token.access_token;
    }

    const now = Date.now();
    if (this.token.expires_at <= now) {
      this.token = await this.signIn();
      return this.token.access_token;
    }

    if (this.token.expires_at <= now + TOKEN_TIME_TO_REFRESH_MS) {
      this.token = await this.refreshToken();
      return this.token.access_token;
    }

    return this.token.access_token;
  }

  async signIn() {
    const headers = generateExtraRequestHeaders(this.installationKey);
    const data = await jsonRequest(`${CUSTOMER_APP_URL}/auth/signin`, {
      method: "POST",
      headers: {
        ...headers,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        username: this.username,
        password: this.password,
      }),
    });

    return {
      access_token: data.accessToken,
      refresh_token: data.refreshToken,
      expires_at: Date.now() + TOKEN_EXPIRATION_MS,
    };
  }

  async refreshToken() {
    if (!this.token) {
      return this.signIn();
    }

    const headers = generateExtraRequestHeaders(this.installationKey);
    const data = await jsonRequest(`${CUSTOMER_APP_URL}/auth/refreshtoken`, {
      method: "POST",
      headers: {
        ...headers,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        username: this.username,
        refreshToken: this.token.refresh_token,
      }),
    });

    return {
      access_token: data.accessToken,
      refresh_token: data.refreshToken,
      expires_at: Date.now() + TOKEN_EXPIRATION_MS,
    };
  }

  async apiCall({ url, method, body }) {
    const token = await this.getAccessToken();
    const headers = {
      ...generateExtraRequestHeaders(this.installationKey),
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };

    return jsonRequest(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async getDashboard(serialNumber) {
    return this.apiCall({
      url: `${CUSTOMER_APP_URL}/things/${serialNumber}/dashboard`,
      method: "GET",
    });
  }

  async setPower(serialNumber, enabled) {
    const mode = enabled ? "BrewingMode" : "StandBy";
    const response = await this.apiCall({
      url: `${CUSTOMER_APP_URL}/things/${serialNumber}/command/CoffeeMachineChangeMode`,
      method: "POST",
      body: { mode },
    });

    return response;
  }
}

function extractPowerFromDashboard(dashboard) {
  if (!dashboard || !Array.isArray(dashboard.widgets)) {
    return null;
  }

  const statusWidget = dashboard.widgets.find(
    (widget) => widget && widget.code === "CMMachineStatus"
  );
  if (!statusWidget || !statusWidget.output || !statusWidget.output.mode) {
    return null;
  }

  return statusWidget.output.mode === "BrewingMode";
}

module.exports = {
  LaMarzoccoCloudClient,
  generateInstallationKey,
  extractPowerFromDashboard,
};
