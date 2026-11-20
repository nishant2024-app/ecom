# Agent endpoints

Used by the delivery agent PWA (and an Android build of it later). All endpoints need a signed-in agent (`client: "agent"`). Conventions: [API guide](README.md).

The app is **offline-first**: it downloads the day's run on Wi-Fi or good network, records events locally, and syncs when it can. Every event carries a `clientEventId` generated on the phone, so sending the same event twice is harmless.

## Index

| Method | Path | Description |
|---|---|---|
| GET | `/v1/agent/me` | Agent profile |
| GET | `/v1/agent/runs` | My runs for a date (default today) |
| GET | `/v1/agent/runs/{runId}` | Run with ordered stops |
| POST | `/v1/agent/runs/{runId}/start` | Start the run (marks deliveries out for delivery) |
| POST | `/v1/agent/runs/{runId}/complete` | Finish the run |
| POST | `/v1/agent/stops/{deliveryId}/events` | Record one stop outcome |
| POST | `/v1/agent/sync` | Upload a batch of queued events |
| POST | `/v1/agent/uploads` | Get a signed URL to upload a proof photo |

---

## GET /v1/agent/runs/{runId}

```json
200 OK
{
  "id": "run_01JD…",
  "date": "2026-12-02",
  "slot": { "code": "morning", "label": "5–8 AM" },
  "route": { "id": "rte_01JD…", "name": "Baner A" },
  "status": "planned",
  "loadSheet": [
    { "variantId": "var_toned500", "name": "Toned Milk 500 ml", "quantity": 214 },
    { "variantId": "var_curd400", "name": "Curd 400 g", "quantity": 37 }
  ],
  "stops": [
    {
      "deliveryId": "dlv_01JD…",
      "sequence": 1,
      "status": "scheduled",
      "customer": { "name": "Asha V.", "phone": "+919876543210" },
      "address": {
        "line1": "B-704, Sai Residency",
        "landmark": "Opp. D-Mart",
        "location": { "lat": 18.559, "lng": 73.7868 },
        "instructions": "Leave at door, don't ring bell before 7"
      },
      "items": [ { "name": "Toned Milk 500 ml", "quantity": 2 } ],
      "bottles": { "toDeliver": 0, "outstanding": 2 }
    }
  ],
  "updatedAt": "2026-12-01T16:31:20Z"
}
```

Customer names are shortened and only the data needed to deliver is included.

## POST /v1/agent/stops/{deliveryId}/events

```json
{
  "clientEventId": "8f0b1a8e-63c4-4a4c-9d0f-2f3c9b7e1a55",
  "type": "delivered",
  "occurredAt": "2026-12-02T01:12:00Z",
  "bottlesCollected": 2,
  "photoUploadId": null,
  "note": null,
  "location": { "lat": 18.5591, "lng": 73.7869 }
}
```

| `type` | Notes |
|---|---|
| `delivered` | |
| `not_available` | `photoUploadId` required (photo of the door) |
| `refused` | `note` recommended |
| `missed` | Our fault (ran out, couldn't reach); `note` required. Triggers an automatic wallet refund. |

`200` with the stop's new status. Events are applied in `occurredAt` order; a later event wins.

## POST /v1/agent/sync

```json
{
  "events": [
    { "deliveryId": "dlv_01JD…", "clientEventId": "8f0b…", "type": "delivered", "occurredAt": "2026-12-02T01:12:00Z", "bottlesCollected": 2 },
    { "deliveryId": "dlv_01JE…", "clientEventId": "a1c3…", "type": "not_available", "occurredAt": "2026-12-02T01:20:00Z", "photoUploadId": "upl_01JD…" }
  ]
}
```

```json
200 OK
{
  "results": [
    { "clientEventId": "8f0b…", "status": "applied" },
    { "clientEventId": "a1c3…", "status": "duplicate" }
  ]
}
```

Per-event `status`: `applied`, `duplicate` (already received, ignored), `rejected` (with `code`, e.g. delivery not in this agent's run). Up to 200 events per call.

## POST /v1/agent/uploads

```json
{ "purpose": "proof_photo", "contentType": "image/jpeg", "sizeBytes": 184320 }
```

```json
201 Created
{ "uploadId": "upl_01JD…", "url": "https://<r2-presigned-put-url>", "method": "PUT", "headers": { "Content-Type": "image/jpeg" }, "expiresAt": "2026-12-02T01:30:00Z" }
```

Upload the file directly to the URL, then reference `uploadId` in the event. Max 2 MB; the app compresses photos to ~1280 px JPEG before upload. If offline, the photo is kept on the phone and uploaded before its event is synced.
