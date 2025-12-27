# Design: Homebridge Plugin for La Marzocco

## Goal (MVP)
Expose a single HomeKit switch in Homebridge that toggles the espresso machine
between standby and on (power) using the La Marzocco cloud API.

## Assumptions
- The La Marzocco cloud API remains reachable and stable enough for HomeKit use.
- Cloud credentials are supplied by the user via Homebridge config.
- We can maintain a small Node.js client that mirrors the minimal LM auth flow.

## Proposed Architecture
Homebridge plugins run on Node.js. We will implement a small Node.js LM client
library that covers auth, status, and power control.

### Components
1. **Homebridge plugin (Node.js/TypeScript)**
   - Exposes a `Switch` service.
   - Implements `get` (read state) and `set` (toggle power).
   - Uses the LM Node client library directly.
2. **LM Node client library**
   - Auth + request signing (installation key, request proof, ECDSA signatures).
   - API calls for dashboard and power command.
   - Persists installation key locally (JSON).

## Data Flow (MVP)
1. HomeKit user toggles switch.
2. Homebridge calls LM client `setPower()`.
3. LM client posts command to LM cloud API.
4. Homebridge polls `getDashboard()` to reflect current state.

## Configuration
Homebridge config (`config.json` or UI) needs:
- `serial`
- `username`
- `password`
- `installationKeyPath` (optional; default in plugin data dir)

Manual script config:
- `LM_SERIAL`, `LM_USERNAME`, `LM_PASSWORD`
- `LM_KEY_PATH` (optional; defaults to `installation_key.json`)

## Milestones
1. **Implement LM Node client**
   - Port auth + request signing from `pylamarzocco`.
   - Support dashboard + power command endpoints.
2. **Manual integration script**
   - Script to register the installation key, fetch dashboard, and optionally
     toggle power using the LM client library.
3. **Scaffold plugin**
   - Create Homebridge plugin skeleton and register a `Switch` accessory.
   - Implement config parsing + logging.
4. **Wire plugin to LM client**
   - Implement status polling + optimistic updates.
   - Basic error handling and backoff.
5. **Basic validation**
   - Manual test: toggle in Home app, verify machine power.

## Risks / Blockers
- **Auth/signing correctness**
  - LM auth uses custom request proof + ECDSA signing. Any mismatch will fail
    authentication and is hard to debug without LM docs.
- **LM API reliability / rate limits**
  - Cloud API may throttle or be intermittently unavailable, causing stale
    status in HomeKit.
- **Auth / registration lifecycle**
  - The installation key process may require one-time registration and device
    pairing. This must be smooth and documented.
- **State drift**
  - The machine can be toggled outside HomeKit; status polling needs to keep
    HomeKit in sync.
- **Security**
  - Storing LM credentials locally; need to avoid logging secrets and document
    where config is stored.
- **API compatibility drift**
  - LM could change endpoints or headers; we need to track upstream changes.

## Open Questions
- Should the MVP expose only power, or include standby vs full power states?
- What polling interval is acceptable without stressing the LM API?
