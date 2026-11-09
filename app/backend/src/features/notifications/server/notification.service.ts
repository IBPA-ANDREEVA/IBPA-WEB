import crypto from "crypto";
import { requireDb } from "@/lib/db";
import { deleteCanonicalNotification, insertCanonicalNotification, listCanonicalNotifications } from "./notification.repository";
import { sendCampaignEmails } from "./email.service";

type DbClient = ReturnType<typeof requireDb>;

function normalizeEmails(emails: string[]) {
  return [...new Set(emails.map((email) => email.trim().toLowerCase()).filter(Boolean))];
}

export async function sendEmailCampaign(db: DbClient, input: {
  subject: string;
  html: string;
  emails: string[];
}) {
  const emails = normalizeEmails(input.emails);
  if (emails.length === 0) {
    throw new Error("No valid recipient emails provided.");
  }

  const result = await sendCampaignEmails({
    subject: input.subject,
    html: input.html,
    emails,
  });

  if (result.error) {
    throw new Error(result.error.message);
  }

  await insertCanonicalNotification(db, {
    id: crypto.randomUUID(),
    title: input.subject,
    message: input.html,
    type: "EMAIL",
    visibility: "TARGETED",
    recipients: { emails },
    metadata: {
      delivery: "email_campaign",
      deliveryStatus: "sent",
      sender: "IBPA Support",
      sentAt: new Date().toISOString(),
    },
  });

  return { count: emails.length };
}

export async function listEmailLogs(db: DbClient) {
  const logs = await listCanonicalNotifications(db, { type: "EMAIL", limit: 50 });
  return logs.map((record: any) => ({
    id: record.id,
    recipients: Array.isArray((record.recipients as Record<string, unknown>)?.emails)
      ? ((record.recipients as Record<string, unknown>).emails as unknown[]).map(String)
      : [],
    to: Array.isArray((record.recipients as Record<string, unknown>)?.emails)
      ? ((record.recipients as Record<string, unknown>).emails as unknown[]).map(String).join(", ")
      : "",
    recipientCount: Array.isArray((record.recipients as Record<string, unknown>)?.emails)
      ? ((record.recipients as Record<string, unknown>).emails as unknown[]).length
      : 0,
    subject: record.title,
    content: record.message,
    status: String((record.metadata as Record<string, unknown>)?.deliveryStatus || "sent"),
    sender: String((record.metadata as Record<string, unknown>)?.sender || "IBPA Support"),
    createdAt: record.createdAt,
    sentAt: (record.metadata as Record<string, unknown>)?.sentAt || record.createdAt,
    relatedCampaign: record.id,
  }));
}

export async function removeEmailLog(db: DbClient, id: string) {
  return deleteCanonicalNotification(db, id);
}

