# lm-homebridge

Homebridge integration for La Marzocco espresso machines.

## Homebridge plugin
### Install (local)

Using the `homebridge` terminal copy the repo into your machine and

```bash
npm install --prefix /var/lib/homebridge <path_to_homebridge_repo> 
```

### Configure
Add the platform in your Homebridge `config.json`:

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

The plugin stores the installation key under the Homebridge storage path by
default. Override with `installationKeyPath` if needed. Set
`pollIntervalSeconds` to `0` to disable polling.

## Manual integration test
This repo includes a Node.js script that exercises the LM cloud API flow using
the local client library.

### Prerequisites
- Node.js 18+ (for built-in `fetch` and crypto support).

### Run
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
