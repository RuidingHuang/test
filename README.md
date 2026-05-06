# Comment Moderation Vercel App

This is the Vercel-ready Next.js version of the Gradio comment moderation demo.

## Local Development

```powershell
cd vercel-app
npm install
npm run dev
```

Open `http://localhost:3000`.

## Vercel Deployment

When importing this repository in Vercel, set the project root directory to:

```text
vercel-app
```

Vercel should auto-detect Next.js. Keep the default build command:

```text
npm run build
```

## Model API

The app works without a model service by using a built-in mock classifier.

To connect the real Python/BERT model later, deploy a small HTTP service with a
`POST /predict` endpoint and set this environment variable in Vercel:

```text
MODEL_API_URL=https://your-model-service.example.com
```

Expected response shape:

```json
{
  "text": "example comment",
  "threshold": 0.5,
  "results": {
    "toxic": { "prob": 0.82, "pred": 1 },
    "severe_toxic": { "prob": 0.02, "pred": 0 },
    "obscene": { "prob": 0.01, "pred": 0 },
    "threat": { "prob": 0.01, "pred": 0 },
    "insult": { "prob": 0.76, "pred": 1 },
    "identity_hate": { "prob": 0.01, "pred": 0 }
  }
}
```

Do not commit `.pt`, `.zip`, `.csv`, `node_modules`, or `.next` files to GitHub.
