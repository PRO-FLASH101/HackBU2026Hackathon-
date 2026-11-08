# Metro Crisis — Experimental LLM Adviser

A separate, working variant of the 3D simulator. A Google Gemini model chooses one response from an **unranked operational action menu**, explains its rationale, tradeoff and uncertainty, and waits for the human to accept or dismiss. Original physical model 2.0.2 and execution interlocks are retained. The measured simulator, replay and original three trial pairs are not modified or bundled as LLM evidence.

## Run on your Mac

Requires **Node.js 20 or newer**. Check with `node --version`. No npm dependencies need installing.

1. Unzip the project and open Terminal in the `gemini-project` folder.
2. Create your local settings file:
   ```sh
   cp .env.example .env
   open -e .env
   ```
3. Put your API key after `GEMINI_API_KEY=` in `.env`, save, and close the editor:
   ```dotenv
   GEMINI_API_KEY=your_actual_key_here
   GEMINI_MODEL=gemini-3.8-flash
   PORT=8787
   ```
4. Start the app:
   ```sh
   npm start
   ```
5. Open **http://127.0.0.1:8787** in Safari or Chrome. Keep Terminal running.

Get a key from your own Google Gemini API project at https://aistudio.google.com/api-keys. The API account must have access to the configured model and usable API billing/quota. The default is `gemini-3.8-flash`; you can change `GEMINI_MODEL` to a model that supports the Gemini generateContent API and structured JSON output. Restart the server and refresh the page after changing `.env`.

**Never put the API key in the HTML, upload `.env`, or enter it into the simulator.** `.env` is ignored by git and never served by the backend. `.env.example` is safe to share. The server binds only to your computer's loopback address. This is a local prototype, not a publicly hosted multi-user API proxy. GitHub Pages alone cannot run the backend.

## Using it

- The startup page prepares a matched Human / LLM-assisted pair. LLM assistance is first by default. Scenario and assumption sets are selectable.
- Press **Begin round**. A simulated hour runs at 20×, taking about three active minutes.
- In the assisted round, automatic requests start after the round begins. You can turn auto requests off and press **Request / retry advice** instead.
- Recommendations remain pinned until accepted or dismissed. Their observed-at time and snapshot age are visible. The simulation continues during API calls, so advice may be out of date.
- **Accept** rechecks the current action menu, then applies the simulator's native operational restrictions. An accepted action can still be blocked. The LLM never executes anything itself.
- **Dismiss** records a dismissal, not an acceptance. Dismissed actions are muted for five simulated minutes.
- **Monitor / WAIT** is a real option: acknowledging it executes no intervention. Accepted monitoring is not counted as an executed action.
- Human-only rounds do not request LLM advice. Standard tabs, station selection, repairs, camera controls and incident feed remain available.
- **Export** saves a distinct `metro-gemini-experimental-...json` file. It includes actions, recommendation decisions, model, observation snapshots, available menus, API request/receipt times, latency and usage when supplied by the API.
- There are no prerecorded LLM results. Run fresh trials before making claims about this version.

## What the LLM sees

Current sensor readings and ages, station capacities/status, resource assignments, train and line status, current funds, mobilization costs, and a short action/decision history. The server projects the snapshot into documented fields. It does **not** receive the seed, future incident schedule, actual hidden water storage, original adviser scores or measured comparison results.

The action menu is built from observed availability and basic operational eligibility, sorted by identifier. It does not use MetroMind's risk ranking. The LLM chooses the action and priority. Final execution is still constrained by physical interlocks; neither a menu entry nor an LLM explanation proves an action is safe or beneficial.

## Failure and cost controls

- No key: clear setup message; manual operation remains possible.
- API errors, rate limits, refused/malformed/incomplete responses or timeout: no intervention, visible error, automatic requests stop until you retry/re-enable them.
- No concealed rule-based fallback or canned response in normal operation.
- One backend request at a time, minimum three-second server interval, eight-second client auto interval, default **30 API requests per round**, and 20-second network timeout. No automatic paid retries.
- Adjustable in `.env`: `MAX_REQUESTS_PER_ROUND` and `GEMINI_TIMEOUT_MS`.
- API requests consume your API credits. Token usage is recorded, not converted into an invented dollar estimate.
- If port 8787 is occupied, change `PORT` and open that port in your browser.

## How it is built

| File | Responsibility |
|---|---|
| `server.mjs` | Loopback-only HTTP server, local `.env`, request limits and provider calls |
| `src/adviser.mjs` | Prompt, strict response schema, input projection, output validation |
| `src/llm-client.js` | Action menu, observation snapshot, async advice, pinned cards, review and exports |
| `src/base-simulator.html` | Unchanged copy of the supplied main simulator |
| `src/llm.css` | LLM advice panel styling |
| `public/simulator.html` | Ready-to-run generated 3D application |
| `build.py` | Rebuilds the isolated variant after source edits; Python 3 needed only for rebuilding |

Server → Gemini generateContent API → strict JSON answer → client validation → human acceptance → native action interlocks. No model tools, arbitrary code execution or API key are exposed in the browser.

## Verification

```sh
npm test
```

Built-in Node tests cover schema validation, unsupported actions, refusal/incomplete responses, API key isolation, missing key, origin restrictions, request caps, upstream failure and timeout. They use an explicitly mocked provider, so no API credits are spent.

The optional browser integration test (`node tests/browser.cjs`) requires a developer-installed Playwright and Chromium. It exercises the actual 3D simulator, pinned advice, dismissal counts, stale and valid acceptance, human-only mode, exports and HTML escaping, also with an explicitly labeled mock provider. It never establishes real model quality.

A live model call still needs your local key and API account. Test one recommendation with auto requests off before presenting. Verify that the model label is correct, a response arrives, Accept/Dismiss work, and an export is saved.

## Scope

Educational and experimental: not validated MTA operations. Costs, station geometry, hydraulic behavior and task times are simplified assumptions. LLM advice can be incorrect. The earlier rule-based results must not be described as LLM results.

Official Gemini references used for implementation:
- https://ai.google.dev/api/generate-content
- https://ai.google.dev/gemini-api/docs/structured-output
- https://ai.google.dev/gemini-api/docs/models/gemini-3.8-flash

If you downloaded the earlier OpenAI version, extract this Gemini project separately and create its own `.env`. The old `OPENAI_API_KEY` setting is not read by this server. Stop any earlier local server with Ctrl+C before running this one on port 8787.
