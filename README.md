# SignBridge — Indian Sign Language (ISL) Translator Web Portal

Real-time ISL gesture recognition in the browser, built on the **MERN stack** with **client-side Edge AI**.
The webcam is processed on the user's device by **MediaPipe Hands** (21 × 3D landmarks per hand) and a **TensorFlow.js** neural
network; recognised signs become live captions and speech via the **Web Speech API**. The Node/Express API and MongoDB store only text and
metadata — **video never leaves the browser**.

> Final-year project · Department of Information Technology, Easwari Engineering College

---

## 1. Features

| Area | What it does |
|---|---|
| **Live translator** | Webcam → hand landmarks → 126-D normalised features → TF.js classifier → temporal smoothing → caption + speech. Sentence builder (space, backspace, copy, speak), adjustable confidence threshold and hold time, live top-3 probabilities, FPS / backend / latency readouts. Works for guests; signed-in users get history. |
| **ISL dictionary** | 51 seeded signs (A–Z, 0–9, 15 everyday words) with category / hand-type filters, search, how-to steps and links to the official ISLRTC reference videos. |
| **Learn mode** | Per-sign practice: 3-2-1 countdown, 4-second attempt, accuracy score, mastery at ≥ 85 %, progress dashboard. |
| **History & feedback** | Paginated translation log with confidence and latency; users can report a wrong result and pick the correct sign (feeds retraining). |
| **Model Studio (admin)** | Record landmark samples per sign from the webcam, train a DNN **in the browser** (WebGL), view learning curves and a confusion matrix, test live, and publish to the model registry with one click. Import/export CSV. |
| **Model registry (admin)** | Versioned models (`v1.0.0`, `v1.0.1` …), exactly one active, upload Python-trained models, activate / roll back / delete. |
| **Admin console** | KPIs, 7-day usage chart, most-used and weakest signs, dictionary CRUD, user roles / enable-disable, feedback triage. |
| **Security** | bcrypt (12 rounds), JWT, role-based access (user / learner / admin), Joi validation on every route, Helmet + CSP, rate limiting, CORS allow-list, ownership checks on every user resource. |

---

## 2. Architecture

```
┌──────────────────────────────── CLIENT TIER · React SPA (browser) ─────────────────────────────────┐
│  Webcam ──► MediaPipe Hands ──► Feature engineering ──► TF.js DNN ──► Smoother ──► Caption + TTS      │
│  (getUserMedia)  (21×3D ×2 hands)  (wrist-origin, scale-norm, 126-D)   (WebGL)    (k-frame vote)       │
│  Pages: Translate · Dictionary · Learn · History · Profile · Admin (Overview, Model Studio, Models …) │
└──────────────── PRIVACY BOUNDARY: only JSON (text, confidence, metadata) over HTTPS + JWT ───────────┘
┌──────────────────────────── APPLICATION TIER · Node.js + Express REST API ───────────────────────────┐
│  Helmet/CSP · CORS → Rate limit → JWT verify → Role guard → Joi validation → Controller → Error handler │
│  Auth · Translations · Sessions · Signs · Progress · Feedback · Model registry · Admin analytics       │
└──────────────────────────────────────────────┬────────────────────────────────────────────────────────┘
                                   Mongoose ODM │                 static /uploads/models/<version>/model.json
┌──────────────────────────────── DATA TIER · MongoDB ─────────────────────────────────────────────────┐
│  users · signs · translation_logs · sessions · learning_progress · model_versions · feedback           │
└───────────────────────────────────────────────────────────────────────────────────────────────────────┘
OFFLINE (optional): dataset → training/extract_landmarks.py → training/train.py → TF.js files → Admin ▸ Models
```

The feature vector is defined once in two mirrored implementations — `client/src/ml/features.js` and `training/isl_features.py` —
with parity tests, so browser-trained and Python-trained models are interchangeable.

---

## 3. Database design (MongoDB)

| Collection | Purpose | Key fields & indexes |
|---|---|---|
| `users` | Accounts | `email` **unique**, `passwordHash` (bcrypt, never returned), `role` user/learner/admin, `preferredLang` en/ta/hi, `isActive` |
| `signs` | ISL dictionary | `word` **unique** + text index, `category`, `handType`, `gestureType`, `labelIndex` **unique**, `howTo[]`, `mediaUrl`, `createdBy → users` |
| `translation_logs` | Every committed sign | `userId → users`, `sessionId → sessions`, `signId → signs`, `recognizedText`, `confidence` 0–1, `latencyMs`, `spoken` · index `{userId, createdAt}` |
| `sessions` | One camera run | `userId`, `modelVersionId → model_versions`, `device{browser, backend, fps}`, `startedAt`, `endedAt`, `gestureCount` |
| `learning_progress` | Learner mastery | `userId`, `signId`, `attempts`, `bestAccuracy`, `status` new/learning/mastered · **unique `{userId, signId}`** (resolves users M:N signs) |
| `model_versions` | Model registry | `version` **unique** (`vX.Y.Z`), `modelUrl`, `classLabels[]`, `numClasses`, `valAccuracy`, `source` browser/python, `isActive` (**partial unique index → only one active**) |
| `feedback` | Corrections for retraining | `logId → translation_logs` **unique (1:1)**, `expectedSignId → signs`, `comment`, `status` open/reviewed/used |

---

## 4. Project structure

```
isl-translator/
├── server/                      Express API
│   ├── src/
│   │   ├── config/              env + MongoDB connection
│   │   ├── models/              7 Mongoose schemas (one per collection)
│   │   ├── middleware/          auth (JWT/RBAC), Joi validation, error handler
│   │   ├── controllers/         auth, signs, sessions, translations, progress, feedback, models, admin
│   │   ├── routes/index.js      all routes + validation schemas
│   │   ├── seed/                admin user + 51 ISL signs
│   │   ├── app.js / server.js
│   └── tests/api.test.js        20 API test cases (node:test + supertest)
├── client/                      React 18 + Vite + Tailwind
│   ├── src/ml/                  features, smoother, classifier (TF.js), handTracker (MediaPipe), dataset (CSV/IndexedDB)
│   ├── src/hooks/               useHandTracking, useActiveModel, useSpeech
│   ├── src/pages/               Home, Auth, Translate, Dictionary, Learn, History, Profile, admin/*
│   └── scripts/prepare-mediapipe.mjs   self-hosts the MediaPipe WASM runtime
├── training/                    Python offline pipeline (MediaPipe → CSV → Keras → TF.js)
├── Dockerfile · docker-compose.yml
```

---

## 5. Getting started (local development)

**Prerequisites:** Node.js 18+ (20 LTS recommended), MongoDB 6+ running locally *or* a free MongoDB Atlas cluster, Chrome/Edge with a webcam.

```bash
# 1. Install everything
npm run install:all

# 2. Configure the API
cp server/.env.example server/.env        # set MONGO_URI (Atlas URI works) and a long JWT_SECRET
cp client/.env.example client/.env        # optional — defaults work for local development

# 3. Create the admin account and the 51 dictionary signs
npm run seed                               # admin@isl.local / Admin@123  (change in server/.env)

# 4. Run API (http://localhost:5050) + web app (http://localhost:5173)
npm run dev
```

Open **http://localhost:5173**, sign in as the admin, and allow camera access.

### Your first recognition model (≈10 minutes, no Python needed)

1. **Admin → Model Studio** → *Start camera*.
2. Add 3–5 visually distinct signs from the dictionary (e.g. `A`, `B`, `C`, `Hello`).
3. For each sign press **Rec** and hold the sign; vary distance and angle slightly. Aim for 80–150 samples per sign (record several people if possible).
4. **Train model** → watch the accuracy curves → **Test live**.
5. **Publish** (keep *Make this the active model* ticked). Every user's translator now loads it automatically.
6. Use **Export CSV** to keep the dataset; it plugs straight into the Python pipeline.

---

## 6. Offline training (Python)

```bash
cd training
python -m venv .venv && source .venv/bin/activate      # Python 3.9–3.11
pip install -r requirements.txt

# dataset/<SIGN>/*.jpg|*.png|*.mp4   (folder name = class label, must match the dictionary word)
python extract_landmarks.py --data dataset --out output/landmarks.csv
python train.py --csv output/landmarks.csv [studio-export.csv ...] --epochs 80
python test_features.py                                 # JS ⇄ Python feature parity
```

Upload `output/tfjs_model/model.json`, the `*.bin` shard(s) and `labels.json` in **Admin → Models → Upload trained model**.
The server validates that every weight shard is present and that the output layer size equals the number of labels.

---

## 7. REST API

Base URL `/api` · JSON · `Authorization: Bearer <token>` where marked 🔒 (🛡 = admin only).

| Method | Endpoint | Description |
|---|---|---|
| POST | `/auth/register` | Create account (`role`: user or learner) |
| POST | `/auth/login` | Returns `{ token, user }` |
| GET / PATCH | `/auth/me` 🔒 | Current user · update name, voice language, password |
| GET | `/signs?q=&category=&page=&limit=` | Dictionary (public) |
| GET | `/signs/:id` | One sign |
| POST / PATCH / DELETE | `/signs[/:id]` 🛡 | Manage dictionary (auto `labelIndex`) |
| POST | `/sessions` 🔒 | Start a translation session |
| PATCH | `/sessions/:id/end` 🔒 | End session (records FPS) |
| GET | `/sessions/me` 🔒 | My sessions |
| POST | `/translations` 🔒 | Log a recognised sign (`signId` auto-resolved from text) |
| GET | `/translations/me` 🔒 | My history (paginated, date filters) |
| GET | `/translations/me/stats` 🔒 | Totals, avg confidence/latency, top signs |
| DELETE | `/translations/:id` · `/translations/me` 🔒 | Delete one / clear all |
| GET | `/progress/me` 🔒 | Learning progress + summary |
| POST | `/progress/attempt` 🔒 | Record a practice attempt `{ signId, accuracy }` |
| POST | `/feedback` 🔒 | Report a wrong translation |
| GET | `/feedback/me` 🔒 | My reports |
| GET / PATCH | `/feedback[/:id]` 🛡 | Triage reports |
| GET | `/models/active` | Active model metadata (public — browsers load it) |
| GET | `/models` 🛡 | All versions |
| POST | `/models` 🛡 | Multipart upload: `files[]` (model.json + .bin), `classLabels`, `activate` … |
| PATCH | `/models/:id/activate` 🛡 | Switch active model (transactional on replica sets) |
| DELETE | `/models/:id` 🛡 | Delete an inactive version |
| GET | `/admin/overview` 🛡 | KPIs and charts |
| GET / PATCH | `/admin/users[/:id]` 🛡 | List users · change role / disable |
| GET | `/health` | Liveness + DB state |

Errors are uniform: `{ "success": false, "message": "...", "details": [{ "field", "message" }] }`.

---

## 8. Testing

```bash
npm test                       # server API tests + client ML unit tests
cd training && python test_features.py
```

* **Server** (`server/tests/api.test.js`) — validation, auth guards and the full user journey (register → session → translations → stats → feedback → learning → model upload/activation → admin). The DB-backed suite runs against `MONGO_URI_TEST` (default `mongodb://127.0.0.1:27017/isl_translator_test`) and is skipped automatically if MongoDB is not running.
* **Client** (`client/src/ml/ml.test.js`) — translation/scale invariance, hand-slot assignment, smoothing/commit logic, CSV round-trip, stratified split.
* **Python** (`training/test_features.py`) — numerical parity with the JavaScript feature extractor.

---

## 9. Deployment

**Docker (single command):**
```bash
cp .env.example .env                       # then set JWT_SECRET to the output of: openssl rand -hex 32
docker compose up -d --build
docker compose exec app npm run seed
# → http://localhost:5000
```
In production Express serves the built React app, so the whole portal is one deployable. Uploaded models live in the `model-files` volume.

**Cloud:** MongoDB Atlas (free M0) + any Node host (Render, Railway, Azure App Service). Build with `npm run build`, start with
`npm start`, set `MONGO_URI`, `JWT_SECRET`, `CLIENT_ORIGIN`. HTTPS is required for webcam access on non-localhost domains.

---

## 10. Design notes & limitations

* **Static key-pose recognition.** Each frame is classified independently and smoothed over a short window, which suits fingerspelling,
  digits and the held pose of many words. Fully dynamic signs (motion trajectories) are the natural next step: an LSTM/Transformer over a
  30-frame landmark sequence, using the same feature extractor.
* **Handedness.** MediaPipe labels are kept consistent between collection and inference (both use the un-mirrored frame); only the on-screen preview is mirrored.
* **Dictionary metadata** (hand-type, gesture-type) is a starting point — have it verified against the ISLRTC dictionary before production use.
* **Data quality matters more than model size.** Collect samples from several signers, lighting conditions and distances; use the feedback queue and the *weakest signs* panel to target retraining.

---

## 11. Tech stack

React 18 · Vite 5 · Tailwind CSS 3 · React Router 6 · Recharts · MediaPipe Tasks Vision 0.10.21 · TensorFlow.js 4.22 · Web Speech API ·
Node.js 20 · Express 4 · MongoDB · Mongoose 8 · JWT · bcrypt · Joi · Helmet · Multer · Python · TensorFlow / Keras · tensorflowjs · Docker
