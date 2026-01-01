# Homebridge plugin for La Marzocco
[![Tests](https://github.com/mweiden/lm-homebridge/actions/workflows/tests.yml/badge.svg)](https://github.com/mweiden/lm-homebridge/actions/workflows/tests.yml)
[![codecov](https://codecov.io/gh/mweiden/lm-homebridge/branch/main/graph/badge.svg)](https://codecov.io/gh/mweiden/lm-homebridge)
[![verified-by-homebridge](https://img.shields.io/badge/homebridge-verified-blueviolet?color=%23491F59&style=for-the-badge&logoColor=%23FFFFFF&logo=homebridge)](https://github.com/homebridge/homebridge/wiki/Verified-Plugins)

[Homebridge](https://homebridge.io/) plugin for La Marzocco espresso machines. Enables turning your La Marzocco IoT-enabled espresso machine (i.e. a Linea Micra or Linea Mini) on and off with [Apple HomeKit](https://en.wikipedia.org/wiki/Apple_Home).

<img height="600" alt="IMG_2168" src="https://github.com/user-attachments/assets/b8f2e146-a8cb-42f2-9bc0-d658649d067d" />

## Configure
Add the platform in your Homebridge `config.json` or use the Plugin Config UI:

```json
{
  "platforms": [
    {
      "platform": "LaMarzocco",
      "name": "La Marzocco",
      "serial": "YOUR_SERIAL",
      "username": "YOUR_USERNAME",
      "password": "YOUR_PASSWORD",
      "pollIntervalSeconds": 30
    }
  ]
}
```

<img width="600" alt="Screenshot 2025-12-27 at 11 07 04 PM" src="https://github.com/user-attachments/assets/04494290-c1d2-46b0-836d-a998b33f06bd" />


Set `pollIntervalSeconds` to `0` to disable polling.

## Development

### Install for development

Using the `homebridge` terminal copy the repo into your machine and

```bash
npm install --prefix /var/lib/homebridge <path_to_homebridge_repo> 
```

You will then have to put homebridge into Debug mode and restart homebridge.

### Prerequisites
- Node.js 18+ (for built-in `fetch` and crypto support).

### Unit Tests
Run unit tests with:

```bash
npx jest
```

### Manual integration test
This repo includes a Node.js script that exercises the LM cloud API flow using
the local client library.

Set environment variables and run the script:

```bash
export LM_SERIAL="YOUR_SERIAL"
export LM_USERNAME="YOUR_USERNAME"
export LM_PASSWORD="YOUR_PASSWORD"
node scripts/lm_manual_test.js
```

To toggle power:

```bash
node scripts/lm_manual_test.js --power on
node scripts/lm_manual_test.js --power off
```

The script stores the installation key in `installation_key.json` by default and
will auto-register it on first run. Override the location with `LM_KEY_PATH`.

## Acknowledgements

Full props to @zweckj for figuring out the LM API. The client code here is based on https://github.com/zweckj/pylamarzocco.
