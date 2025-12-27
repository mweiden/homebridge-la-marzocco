"use strict";

const fs = require("fs");
const path = require("path");
const {
  LaMarzoccoCloudClient,
  generateInstallationKey,
  extractPowerFromDashboard,
} = require("../lib/lm_client");

const SERIAL = process.env.LM_SERIAL;
const USERNAME = process.env.LM_USERNAME;
const PASSWORD = process.env.LM_PASSWORD;
const KEY_PATH = process.env.LM_KEY_PATH || path.join(process.cwd(), "installation_key.json");

function requireEnv(value, name) {
  if (!value) {
    throw new Error(`Missing ${name} in environment.`);
  }
}

function loadOrCreateInstallationKey() {
  if (fs.existsSync(KEY_PATH)) {
    const raw = fs.readFileSync(KEY_PATH, "utf8");
    return { key: JSON.parse(raw), created: false };
  }

  const installationId = cryptoRandomId();
  const key = generateInstallationKey(installationId);
  fs.writeFileSync(KEY_PATH, JSON.stringify(key, null, 2));
  return { key, created: true };
}

function cryptoRandomId() {
  const crypto = require("crypto");
  return crypto.randomUUID().toLowerCase();
}

function parseArgs() {
  const args = process.argv.slice(2);
  const options = { power: null, register: false };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--power" && args[i + 1]) {
      options.power = args[i + 1].toLowerCase();
      i += 1;
    } else if (arg === "--register") {
      options.register = true;
    }
  }

  return options;
}

async function main() {
  requireEnv(SERIAL, "LM_SERIAL");
  requireEnv(USERNAME, "LM_USERNAME");
  requireEnv(PASSWORD, "LM_PASSWORD");

  const { key: installationKey, created } = loadOrCreateInstallationKey();

  const client = new LaMarzoccoCloudClient({
    username: USERNAME,
    password: PASSWORD,
    installationKey,
  });

  const options = parseArgs();

  if (options.register || created) {
    console.log("Registering installation key...");
    await client.registerClient();
    console.log("Registration complete.");
  }

  if (options.power) {
    const enabled = options.power === "on" || options.power === "true";
    console.log(`Setting power to ${enabled ? "on" : "standby"}...`);
    await client.setPower(SERIAL, enabled);
  }

  const dashboard = await client.getDashboard(SERIAL);
  const power = extractPowerFromDashboard(dashboard);
  console.log("Machine power:", power === null ? "unknown" : power ? "on" : "standby");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
