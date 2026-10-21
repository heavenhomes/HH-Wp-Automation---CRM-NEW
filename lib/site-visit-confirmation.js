import Lead from '@/lib/models/Lead';
import {
  bodyParameters,
  sendWhatsAppTemplate,
  WHATSAPP_TEMPLATE_NAMES,
} from '@/lib/whatsapp-template';
import { formatSiteVisitTime } from '@/lib/site-visit-time';

export async function sendSiteVisitScheduledConfirmation(lead, visit, { persist = true } = {}) {
  if (!lead?.phone) {
    console.error(`[site-visit-confirmation] Lead has no phone number: ${lead?._id || visit?._id}`);
    return null;
  }

  const customerName = lead.name?.trim() || 'there';
  const propertyName = visit.propertyTitle?.trim() || 'Property to be confirmed';
  const visitDate = new Date(visit.scheduledDate).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  });
  const visitTime = formatSiteVisitTime(visit.scheduledTime) || 'To be confirmed';
  const text =
    `Hello *${customerName}*, your site visit with Heaven Homes has been scheduled successfully.\n\n` +
    `*Property:* ${propertyName}\n*Date:* ${visitDate}\n*Time:* ${visitTime}\n\n` +
    'Please arrive on time for your scheduled visit. We look forward to assisting you!\n\n' +
    'Thank you,\nTeam *Heaven Homes*';
  const sent = await sendWhatsAppTemplate(
    lead.phone,
    WHATSAPP_TEMPLATE_NAMES.siteVisitScheduledConfirmation,
    'en',
    bodyParameters([customerName, propertyName, visitDate, visitTime])
  );

  if (!sent) {
    console.error(`[site-visit-confirmation] Template send failed for site visit ${visit._id}`);
    return null;
  }

  const entry = {
    direction: 'out',
    type: 'template',
    text,
    payload: { templateName: WHATSAPP_TEMPLATE_NAMES.siteVisitScheduledConfirmation },
    at: new Date(),
  };

  if (persist) {
    try {
      await Lead.findByIdAndUpdate(lead._id, {
        $push: { conversation: { $each: [entry], $slice: -500 } },
        $set: { lastActivityAt: entry.at },
      });
    } catch (error) {
      console.error(
        `[site-visit-confirmation] Template sent but conversation logging failed for lead ${lead._id}:`,
        error
      );
    }
  }

  return entry;
}
