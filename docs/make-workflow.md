# Make.com Workflow Contract

Terrova calls Make from `POST /api/generations`. The browser never receives the Make webhook URL.

## Request

```json
{
  "requestId": "uuid",
  "sessionId": "uuid",
  "property": {
    "type": "villa",
    "district": "Almadies",
    "transaction": "Vente",
    "comments": "Mettre en valeur la lumière naturelle et la terrasse."
  },
  "video": {
    "style": "elegant",
    "ratio": "9:16",
    "duration": 10,
    "prompt": "Crée une seule vidéo immobilière...",
    "platform": "instagram"
  },
  "images": [
    {
      "key": "temp/session-id/input/image-id.jpg",
      "url": "TEMPORARY_SIGNED_URL"
    }
  ]
}
```

Headers:

```http
content-type: application/json
x-terrova-secret: MAKE_WEBHOOK_SECRET
```

## Initial Response

```json
{
  "jobId": "abc123",
  "status": "pending"
}
```

Allowed statuses are `pending`, `analyzing`, `generating`, `processing`, `completed`, and `failed`.

## Status Response

For this MVP, `GET /api/generations/:jobId` uses demo state unless a status backend is added. The provider boundary is intentionally isolated in `src/lib/video/make-video-provider.ts`.

Recommended future response shape:

```json
{
  "jobId": "abc123",
  "status": "completed",
  "videoUrl": "TEMPORARY_URL"
}
```

## Media Rules

Make should download input images from temporary signed URLs, generate the video, upload the result to `temp/{sessionId}/output/{uuid}.mp4`, and return only a job id/status to Terrova. Do not log signed URLs, source photos, generated video binaries, API keys, or authorization headers.
