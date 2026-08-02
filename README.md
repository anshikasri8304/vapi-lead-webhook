# Vapi Lead Webhook → Google Sheets

Yeh ek chhota Node.js/Express server hai jo Vapi ke "call ended" event ko
receive karta hai aur qualified lead data seedha Google Sheet mein likh deta hai.

Isse Vapi ke OAuth "Connect" popup wala issue completely bypass ho jata hai,
kyunki yeh Google Service Account use karta hai (no browser login needed).

---

## Step 1 — Google Cloud Service Account Banao (15 min)

1. Jao [console.cloud.google.com](https://console.cloud.google.com)
2. Naya project banao (ya existing use karo)
3. Left menu → **APIs & Services → Library** → search karo "Google Sheets API" → **Enable** karo
4. Left menu → **APIs & Services → Credentials** → **Create Credentials → Service Account**
5. Naam do (jaise `vapi-lead-writer`), Create → Done
6. Us service account pe click karo → **Keys** tab → **Add Key → Create New Key → JSON**
7. Ek `.json` file download hogi — isko rename karke `credentials.json` bana do

## Step 2 — Sheet ko Service Account ke Saath Share Karo

1. `credentials.json` file kholo, usme ek field hai `"client_email"` — jaisa
   `vapi-lead-writer@your-project.iam.gserviceaccount.com`
2. Apni Google Sheet kholo → **Share** button → yeh email paste karo →
   **Editor** access do → Share

Bas — ab service account is Sheet mein likh sakta hai, koi OAuth popup nahi chahiye.

## Step 3 — Project Setup (Local)

```bash
# is folder mein jao
cd vapi-lead-webhook

# dependencies install karo
npm install

# credentials.json ko isi folder mein daalo (Step 1 se)

# .env file banao
cp .env.example .env
# .env kholke SPREADSHEET_ID apna daal do (already example mein tumhara ID hai)
```

## Step 4 — Locally Test Karo

```bash
npm start
```

Terminal mein dikhega: `Webhook server listening on port 3000`

## Step 5 — Public URL Banao (taaki Vapi isko call kar sake)

Local server ko internet pe expose karne ke liye [ngrok](https://ngrok.com) use karo
(free hai, sabse fast tareeka hai demo/testing ke liye):

```bash
# ngrok install karne ke baad
ngrok http 3000
```

Yeh ek public URL degा jaisa: `https://abcd1234.ngrok-free.app`

**Note**: ngrok free tier ka URL restart hone par badal jata hai — agar tumhe
permanent URL chahiye (interview ke live demo ke liye), Step 6 dekho (Render pe deploy).

## Step 6 — Permanent Deploy (Recommended for the actual interview demo)

Render.com pe free deploy kar sakti ho (ngrok se zyada reliable, URL fix rehta hai):

1. Is poore folder ko GitHub repo mein push karo
2. [render.com](https://render.com) pe jao → **New → Web Service** → apna GitHub repo connect karo
3. Build command: `npm install`
4. Start command: `npm start`
5. Environment tab mein `SPREADSHEET_ID` aur `SHEET_NAME` add karo
6. `credentials.json` ka content ek **Secret File** ke roop mein add karo (Render's "Secret Files" feature), path: `/etc/secrets/credentials.json` — phir server.js mein keyFile path update karna hoga usi hisab se
7. Deploy hone ke baad ek permanent URL milega: `https://your-app.onrender.com`

## Step 7 — Vapi Mein Webhook URL Set Karo

1. Vapi dashboard → apna Assistant kholo → **Advanced / Server URL** settings dhundo
2. Wahan apna webhook URL daalo: `https://your-app.onrender.com/webhook` (ya ngrok URL + `/webhook`)
3. Save karo

## Step 8 — Test Karo

1. Ek test call karo Vapi se (poori conversation complete karo)
2. Call end hone ke baad, terminal/Render logs check karo — `Incoming webhook: ...` dikhna chahiye
3. Apni Google Sheet check karo — naya row aana chahiye

## Debugging Tip

Agar `extractLeadData()` function sahi data nikaal nahi pa raha (kyunki Vapi ke
actual payload ka exact structure tumhare setup ke hisab se thoda alag ho sakta
hai), toh:

1. `/debug` endpoint ko bhi Vapi mein temporarily point karo, ya
2. Terminal mein pura `Incoming webhook: ...` JSON dekho
3. Usme dekho lead data kaha hai (`message.analysis`, `message.artifact`, etc.)
   aur `server.js` ke `extractLeadData()` function mein wahi sahi path daal do

---

## Architecture Summary (for your submission doc)

```
Customer → Vapi (voice call, Claude LLM + Deepgram STT + Vapi TTS)
              ↓ (call ends)
       Vapi Server URL webhook
              ↓ (POST /webhook)
     Node.js/Express server (this repo)
              ↓ (Google Sheets API, service account auth)
          Google Sheet (lead storage)
```
