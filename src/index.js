"use strict";

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const {
  LaMarzoccoCloudClient,
  generateInstallationKey,
  extractPowerFromDashboard,
} = require("../lib/lm_client");

const PLUGIN_NAME = "homebridge-lm-homebridge";
const ACCESSORY_NAME = "LaMarzoccoSwitch";

module.exports = (api) => {
  api.registerAccessory(PLUGIN_NAME, ACCESSORY_NAME, LaMarzoccoSwitchAccessory);
};

class LaMarzoccoSwitchAccessory {
  constructor(log, config, api) {
    this.log = log;
    this.config = config || {};
    this.api = api;
    this.cachedPower = false;

    this.name = this.config.name || "La Marzocco";
    this.serial = this.config.serial;
    this.username = this.config.username;
    this.password = this.config.password;

    this.service = new this.api.hap.Service.Switch(this.name);
    this.service
      .getCharacteristic(this.api.hap.Characteristic.On)
      .onGet(this.handleGet.bind(this))
      .onSet(this.handleSet.bind(this));

    if (!this.serial || !this.username || !this.password) {
      this.log.error(
        "Missing required config. Please set serial, username, and password."
      );
      return;
    }

    const storageRoot = this.api.user.storagePath();
    const defaultKeyPath = path.join(
      storageRoot,
      "lm-homebridge",
      "installation_key.json"
    );
    this.installationKeyPath = this.config.installationKeyPath || defaultKeyPath;
    this.ensureKeyDir();

    const { key, created } = this.loadOrCreateInstallationKey();
    this.client = new LaMarzoccoCloudClient({
      username: this.username,
      password: this.password,
      installationKey: key,
    });

    if (created) {
      this.registerInstallationKey().catch((err) => {
        this.log.error("Failed to register installation key: %s", err.message);
      });
    }

    const pollIntervalSeconds = Number(this.config.pollIntervalSeconds || 30);
    if (pollIntervalSeconds > 0) {
      this.startPolling(pollIntervalSeconds);
    }
  }

  getServices() {
    return [this.service];
  }

  ensureKeyDir() {
    const dir = path.dirname(this.installationKeyPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  loadOrCreateInstallationKey() {
    if (fs.existsSync(this.installationKeyPath)) {
      const raw = fs.readFileSync(this.installationKeyPath, "utf8");
      return { key: JSON.parse(raw), created: false };
    }

    const installationId = crypto.randomUUID().toLowerCase();
    const key = generateInstallationKey(installationId);
    fs.writeFileSync(this.installationKeyPath, JSON.stringify(key, null, 2));
    return { key, created: true };
  }

  async registerInstallationKey() {
    this.log.info("Registering installation key with LM cloud...");
    await this.client.registerClient();
    this.log.info("Installation key registration complete.");
  }

  async handleGet() {
    if (!this.client) {
      return this.cachedPower;
    }

    try {
      const dashboard = await this.client.getDashboard(this.serial);
      const power = extractPowerFromDashboard(dashboard);
      if (power === null) {
        this.log.warn("Unable to determine machine power from dashboard.");
        return this.cachedPower;
      }
      this.cachedPower = power;
      return power;
    } catch (err) {
      this.log.error("Failed to fetch dashboard: %s", err.message || err);
      return this.cachedPower;
    }
  }

  async handleSet(value) {
    if (!this.client) {
      throw new Error("Accessory not configured.");
    }

    const enabled = value === true;
    try {
      await this.client.setPower(this.serial, enabled);
      this.cachedPower = enabled;
    } catch (err) {
      this.log.error("Failed to set power: %s", err.message || err);
      throw err;
    }
  }

  startPolling(intervalSeconds) {
    const intervalMs = intervalSeconds * 1000;
    setInterval(async () => {
      try {
        const power = await this.handleGet();
        this.service.updateCharacteristic(
          this.api.hap.Characteristic.On,
          power
        );
      } catch (err) {
        this.log.debug("Polling error: %s", err.message || err);
      }
    }, intervalMs);
  }
}
