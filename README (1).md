# Priya: Hinglish Voice AI Lead Qualifier

Priya is a voice AI agent that talks to property buyers in English, Hindi or
Hinglish, qualifies them as real estate leads, and saves each lead to a Google
Sheet automatically when the call ends.

This repo holds the webhook server that receives Vapi's "call ended" event and
writes the lead data to Google Sheets.

**Try it:** [Talk to Priya in your browser](https://vapi.ai?demo=true&shareKey=1b8df46f-a975-47ca-8bcf-cf098242876e&assistantId=e3b7fed8-e4ac-4968-92ee-a254b1eafb85)

> The first request after a quiet period can take about 50 seconds, because the
> free hosting tier puts the server to sleep. If a lead doesn't appear straight
> away, give it a moment.

---

## What it does

1. A caller talks to Priya, a voice agent built on Vapi.
2. Priya mirrors the caller's language (English, Hindi or Hinglish) and asks
   about what they are looking for.
3. When the call ends, Vapi runs a post-call analysis and sends the result to
   this server.
4. The server writes one row per lead to a Google Sheet.

### Lead fields saved

| Field               | Example                         |
|---------------------|---------------------------------|
| Timestamp           | Time the call ended             |
| Customer name       |                                 |
| Contact number      |                                 |
| Location preference | Area or locality                |
| Property type       | For example 3 BHK               |
| Budget range        |                                 |
| Purpose             | For example self-use            |
| Timeline            | For example 0-3 months          |
| Call summary        | Short summary of the conversation |

---

## Architecture

```
Caller -> Vapi (voice call)
            |  GPT-4o (conversation), Deepgram Nova-3 (speech-to-text),
            |  Vapi Voice "Clara" (text-to-speech)
            v  call ends
     Vapi Server URL webhook
            v  POST /webhook
   Node.js / Express server (this repo, hosted on Render)
            v  Google Sheets API (service account)
        Google Sheet (lead storage)
```

### Tools used

- **Vapi.ai**: voice orchestration platform
- **OpenAI GPT-4o**: conversation model, handles language mirroring across
  English, Hindi and Hinglish
- **Deepgram Nova-3 (multi-language mode)**: speech-to-text, auto-detects Hindi
  and English
- **Vapi Voice (Clara)**: text-to-speech
- **Node.js and Express**: webhook server for lead data processing
- **Google Sheets API with a service account**: automated lead storage with no
  browser login
- **Render**: webhook hosting
- **GitHub**: version control

### Why a service account?

Vapi's built-in Google connection opens a browser login (OAuth) popup, which
blocked the flow. A Google service account lets the server write to the sheet
directly, with no popup.

---

## Setup

### 1. Create a Google service account

1. Open the [Google Cloud Console](https://console.cloud.google.com) and create
   a project, or use an existing one.
2. Go to **APIs & Services, then Library**, search for "Google Sheets API" and
   enable it.
3. Go to **APIs & Services, then Credentials**, and choose **Create
   Credentials, then Service Account**. Give it a name such as
   `vapi-lead-writer`.
4. Open the service account, go to **Keys**, choose **Add Key, then Create new
   key, then JSON**, and download the file.
5. Rename it to `credentials.json`.

### 2. Share the sheet with the service account

1. Open `credentials.json` and copy the `client_email` value.
2. Open your Google Sheet, click **Share**, paste that email and give it
   **Editor** access.

### 3. Run locally

```bash
npm install
cp .env.example .env
```

Edit `.env` and set:

```
SPREADSHEET_ID=your_google_sheet_id_here
SHEET_NAME=your_sheet_tab_name_here
```

Put `credentials.json` in the project folder, then start the server:

```bash
npm start
```

The terminal shows `Webhook server listening on port 3000`.

> **Never commit `credentials.json` or `.env`.** Both are listed in
> `.gitignore`. If a key is ever exposed, delete it in Google Cloud and create
> a new one.

### 4. Deploy to Render (recommended)

1. Push the repo to GitHub.
2. On [render.com](https://render.com), choose **New, then Web Service** and
   connect the repo.
3. Build command: `npm install`. Start command: `npm start`.
4. Add `SPREADSHEET_ID` and `SHEET_NAME` under **Environment**.
5. Add the contents of `credentials.json` as a **Secret File** at
   `/etc/secrets/credentials.json`, and point the key file path in `server.js`
   to that location.
6. After deploying, you get a permanent URL such as
   `https://your-app.onrender.com`.

For quick local testing without deploying, you can expose your local server
with [ngrok](https://ngrok.com) (`ngrok http 3000`). The ngrok URL changes each
time it restarts, so use Render for anything you want to keep.

### 5. Connect Vapi

1. In the Vapi dashboard, open your assistant and find the **Server URL**
   setting.
2. Enter `https://your-app.onrender.com/webhook`.
3. Save.

### 6. Test

1. Make a test call from Vapi and finish the conversation.
2. Check the server logs for `Incoming webhook: ...`.
3. Check the Google Sheet. A new row should appear.

---

## Troubleshooting

If a field comes through empty or in the wrong column, Vapi's payload may be
structured slightly differently than the code expects. Read the full
`Incoming webhook: ...` JSON in the logs, find where the lead data actually sits
(for example under `message.analysis` or `message.artifact`), and update the
`extractLeadData()` function in `server.js` to read from that path.

---

## Known limitations

- **Cold starts:** the free Render tier sleeps after about 15 minutes of
  inactivity, so the first request afterwards can take about 50 seconds.
- **Blank fields:** lead data comes from Vapi's AI-based post-call analysis. In
  very short or ambiguous calls, a field can come back blank.
- **US phone number:** the assistant has a Vapi-provisioned US number. An Indian
  number would need a Twilio or local carrier number, so the browser demo is the
  recommended way to try Priya.
- **Language mirroring:** I started with Claude 3.5 Sonnet, but it mirrored
  Hindi and Hinglish inconsistently, so I switched to GPT-4o.
- **Project knowledge:** answers about the project come from details in the
  system prompt, not a separate knowledge base. That is fine for a single-project
  demo but would need restructuring for many projects.
- **Interruptions:** handling works, but there can be a 1 to 2 second lag when
  the caller speaks over Priya.
