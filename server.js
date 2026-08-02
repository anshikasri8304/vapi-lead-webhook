const express = require("express");
const { google } = require("googleapis");
require("dotenv").config();

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

// Keep the most recent webhook payload in memory so it can be viewed
// easily in a browser at /last-payload (Render's log viewer truncates
// long lines, so this is a more reliable way to inspect the real
// structure Vapi sends).
let lastPayload = null;

// ---- Google Sheets auth (Service Account) ----
// Uses a service account JSON key (credentials.json) instead of OAuth popup flow.
// This avoids the "connect / popup blocked" issue entirely.
const auth = new google.auth.GoogleAuth({
  keyFile: "./credentials.json",
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

const SPREADSHEET_ID = process.env.SPREADSHEET_ID; // from your sheet URL
const SHEET_NAME = process.env.SHEET_NAME || "Sheet1";

async function appendLeadToSheet(row) {
  const client = await auth.getClient();
  const sheets = google.sheets({ version: "v4", auth: client });

  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!A:I`,
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: {
      values: [row],
    },
  });
}

// ---- Helper: pull structured lead data out of Vapi's end-of-call payload ----
// Vapi sends a "message" object with type "end-of-call-report" (or similar)
// containing "analysis" (if you configure structured extraction) or the
// raw transcript. We try structured data first, fall back to raw fields.
function extractLeadData(body) {
  const msg = body.message || body;

  // If you've configured Vapi's "Analysis" / structured data extraction,
  // it will appear here. Adjust the path below to match your actual payload
  // once you inspect a real webhook call (see /debug endpoint below).
  const analysis = msg.analysis?.structuredData || msg.analysis || {};

  return {
    name: analysis.customerName || analysis.name || "",
    contact: analysis.contactNumber || analysis.phone || "",
    location: analysis.location || "",
    propertyType: analysis.propertyType || "",
    budget: analysis.budget || "",
    purpose: analysis.purpose || "",
    timeline: analysis.timeline || "",
    summary: analysis.summary || msg.summary || "",
    callId: msg.call?.id || msg.callId || "",
  };
}

// ---- Main webhook endpoint (point Vapi's Server URL here) ----
app.post("/webhook", async (req, res) => {
  try {
    lastPayload = req.body;
    console.log("Incoming webhook type:", req.body.message?.type);

    const eventType = req.body.message?.type;

    // Only act on the call-ended / end-of-call-report event
    if (eventType === "end-of-call-report" || eventType === "call.ended") {
      const lead = extractLeadData(req.body);

      const row = [
        new Date().toISOString(),
        lead.name,
        lead.contact,
        lead.location,
        lead.propertyType,
        lead.budget,
        lead.purpose,
        lead.timeline,
        lead.summary,
      ];

      await appendLeadToSheet(row);
      console.log("Lead written to Google Sheet:", row);
    }

    res.status(200).json({ received: true });
  } catch (err) {
    console.error("Webhook error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ---- Debug endpoint: temporarily log full raw payloads so you can see ----
// ---- exactly what Vapi sends and adjust extractLeadData() accordingly ----
app.post("/debug", (req, res) => {
  console.log("DEBUG PAYLOAD:", JSON.stringify(req.body, null, 2));
  res.status(200).send("logged");
});

app.get("/", (req, res) => {
  res.send("Vapi lead webhook is running.");
});

// Visit this URL in your browser right after a test call to see the
// full, unabbreviated JSON payload Vapi sent on call end.
app.get("/last-payload", (req, res) => {
  if (!lastPayload) {
    return res.send("No webhook received yet. Make a test call, then refresh this page.");
  }
  res.json(lastPayload);
});

app.listen(PORT, () => {
  console.log(`Webhook server listening on port ${PORT}`);
});