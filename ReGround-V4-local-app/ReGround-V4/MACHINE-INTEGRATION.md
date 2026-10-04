# ReGround V4 machine reading interface

This prototype has a working browser-side reading adapter and JSON import. No physical machine, HTTP ingestion server, device authentication or cross-company messaging is connected. A machine gateway already running within this browser can call:

```js
const result = window.ReGroundMachine.submitReading({
  eventId: 'FIELD-01-20261014-0001',
  machineId: 'RG-FIELD-01',
  projectId: 'RG-024',
  batchId: 'M-0001',
  originalRoute: 'local',
  targetRoute: 'alternative',
  mass: 18.4,
  moisture: 22,
  fines: 42,
  visual: 'clear',
  note: 'Original moisture range exceeded'
});
```

The object can also be pasted in Supplier → Projects → Loads → Alternative requests → Import machine reading → Machine payload / integration details. The collapsed payload is prefilled with a labelled demo reading for one-click demonstration.

## Input and result

- `eventId`: unique reading identifier, 1–80 characters. Replays of the last 1,000 stored events are rejected; batch ID uniqueness is also enforced per project.
- `machineId`: 1–80 characters.
- `projectId`: existing source project ID.
- `batchId`: unique within the project, 1–30 characters.
- `originalRoute`: existing route ID (`local`, `alternative`, `fallback`).
- `targetRoute`: a different receiver site (`local` or `alternative`). Disposal/fallback requests are not supported by this receiver-review prototype.
- `mass`: finite number, more than 0 and at most 40 tonnes.
- `moisture`, `fines`: finite numbers from 0 to 100 percent.
- `visual`: `clear`, `uncertain`, or `anomaly`.
- `note`: optional reference text, truncated to 1,000 characters.

A compatible original reading is rejected by this alternative adapter and should go through the normal PASS workflow. A mismatch creates a HOLD batch and a Pending review request. An anomaly creates a quarantined FAIL record and no alternative request. This is demo conformance checking, not contamination certification.

Return: `{ batchId, status, requestId }`. Invalid data throws an Error without creating the request. The receiving app must show or log this error and reconcile failed input; it must not assume a request was received.

## Release controls

1. The request is scoped to one batch. The project’s default route remains unchanged.
2. Only the requested site's Receiver view can record the receiver decision.
3. Approval requires a suitability/evidence review acknowledgement and a decision reference. Material, source date window and remaining batch capacity must fit the site.
4. Approval allows a fresh check; it does not allow dispatch on its own.
5. Fresh measurements, visual inspection and retest reference are recorded. Original measurements and route remain in request.original and history.
6. Only a current approval and fresh PASS can enable Supplier dispatch. A changed receiving specification invalidates approval; source material/dates, remaining capacity and total dispatched source quantity are checked again at release.
7. HOLD remains blocked. FAIL enters quarantine. Dispatched loads cannot be rechecked or rerouted.
8. The existing receiver receipt workflow acknowledges the alternative site and updates its totals.

For a production machine connection, put this validation and state transition logic on an authenticated server, retain durable unique event IDs, bind devices to authorised projects, store immutable measurement timestamps/calibration provenance and transmit decisions to both organisations. The browser bridge is an integration demonstration, not a secure public ingestion endpoint.
