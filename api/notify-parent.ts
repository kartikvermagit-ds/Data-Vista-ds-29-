/**
 * POST /api/notify-parent
 *
 * Sends an SMS (Twilio) and/or email (SendGrid) to a student's guardian.
 *
 * Body:
 *   template   – "low_attendance" | "poor_marks" | "weekly_report" | "custom"
 *   studentName – string
 *   guardianName – string
 *   phone       – E.164 phone number, e.g. "+91xxxxxxxxxx"
 *   email       – guardian email (optional)
 *   stats       – { attendance?: number; marks?: number; subject?: string }
 *   customMessage – string (only used when template === "custom")
 *   className   – string  (class label, e.g. "10-A")
 *   schoolName  – string
 *
 * Env vars required:
 *   TWILIO_ACCOUNT_SID
 *   TWILIO_AUTH_TOKEN
 *   TWILIO_FROM_NUMBER       (+15xxxxxxxxx or Messaging Service SID)
 *   SENDGRID_API_KEY         (optional – only needed for email)
 *   SENDGRID_FROM_EMAIL      (optional – verified sender)
 */

const TWILIO_SID   = process.env.TWILIO_ACCOUNT_SID?.trim() ?? "";
const TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN?.trim() ?? "";
const TWILIO_FROM  = process.env.TWILIO_FROM_NUMBER?.trim() ?? "";
const SG_KEY       = process.env.SENDGRID_API_KEY?.trim() ?? "";
const SG_FROM      = process.env.SENDGRID_FROM_EMAIL?.trim() ?? "";

type Stats = { attendance?: number; marks?: number; subject?: string };

type NotifyRequest = {
  template: "low_attendance" | "poor_marks" | "weekly_report" | "custom";
  studentName: string;
  guardianName: string;
  phone?: string;
  email?: string;
  stats?: Stats;
  customMessage?: string;
  className?: string;
  schoolName?: string;
};

function buildMessage(body: NotifyRequest): string {
  const { template, studentName, guardianName, stats = {}, customMessage, className = "", schoolName = "School" } = body;
  const first = guardianName.split(" ")[0];
  const cls = className ? ` (${className})` : "";

  switch (template) {
    case "low_attendance":
      return (
        `Dear ${first}, this is a notice from ${schoolName}. ` +
        `Your ward ${studentName}${cls} has an attendance of only ${stats.attendance ?? "—"}%, ` +
        `which is below the required 75%. Please ensure regular attendance. ` +
        `Contact us if you need support. — DataVista`
      );
    case "poor_marks":
      return (
        `Dear ${first}, your ward ${studentName}${cls} scored ${stats.marks ?? "—"}% overall this term` +
        (stats.subject ? `, with particular weakness in ${stats.subject}` : "") +
        `. We recommend scheduling extra study sessions. Please contact the class teacher. — ${schoolName}`
      );
    case "weekly_report":
      return (
        `Weekly Report — ${schoolName}\n` +
        `Student: ${studentName}${cls}\n` +
        `Attendance: ${stats.attendance ?? "—"}%\n` +
        `Marks: ${stats.marks ?? "—"}%\n` +
        (stats.subject ? `Focus area: ${stats.subject}\n` : "") +
        `Thank you for staying engaged with your child's education. — DataVista`
      );
    case "custom":
      return customMessage ?? "Message from your school.";
  }
}

async function sendSms(to: string, message: string): Promise<{ ok: boolean; error?: string }> {
  if (!TWILIO_SID || !TWILIO_TOKEN || !TWILIO_FROM) {
    return { ok: false, error: "Twilio credentials not configured on server." };
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`;
  const encoded = Buffer.from(`${TWILIO_SID}:${TWILIO_TOKEN}`).toString("base64");

  const params = new URLSearchParams({ To: to, From: TWILIO_FROM, Body: message });

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${encoded}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: "Unknown error" })) as { message?: string };
    return { ok: false, error: err.message ?? "SMS send failed." };
  }
  return { ok: true };
}

async function sendEmail(to: string, subject: string, text: string): Promise<{ ok: boolean; error?: string }> {
  if (!SG_KEY || !SG_FROM) {
    return { ok: false, error: "SendGrid credentials not configured on server." };
  }

  const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SG_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }], subject }],
      from: { email: SG_FROM, name: "DataVista School" },
      content: [
        { type: "text/plain", value: text },
        { type: "text/html", value: `<p style="font-family:sans-serif;line-height:1.6">${text.replace(/\n/g, "<br>")}</p>` },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ errors: [] })) as { errors?: Array<{ message: string }> };
    return { ok: false, error: body.errors?.[0]?.message ?? "Email send failed." };
  }
  return { ok: true };
}

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed." });
    return;
  }

  let body: NotifyRequest;
  try {
    body = (typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {}) as NotifyRequest;
  } catch {
    res.status(400).json({ error: "Invalid JSON body." });
    return;
  }

  if (!body.studentName || !body.template) {
    res.status(400).json({ error: "Missing required fields: studentName, template." });
    return;
  }

  const message = buildMessage(body);
  const subject = {
    low_attendance: `Attendance Alert — ${body.studentName}`,
    poor_marks:     `Academic Alert — ${body.studentName}`,
    weekly_report:  `Weekly Report — ${body.studentName}`,
    custom:         `Message from ${body.schoolName ?? "School"} — ${body.studentName}`,
  }[body.template];

  const results: Record<string, { ok: boolean; error?: string }> = {};

  if (body.phone) {
    results.sms = await sendSms(body.phone, message);
  }

  if (body.email) {
    results.email = await sendEmail(body.email, subject, message);
  }

  const allOk = Object.values(results).every((r) => r.ok);
  const errors = Object.entries(results)
    .filter(([, r]) => !r.ok)
    .map(([ch, r]) => `${ch}: ${r.error}`);

  res.status(allOk ? 200 : 207).json({
    ok: allOk,
    message,
    channels: results,
    ...(errors.length ? { errors } : {}),
  });
}
