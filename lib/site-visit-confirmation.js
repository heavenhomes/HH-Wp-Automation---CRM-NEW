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

  const lang = ['en', 'hi', 'gu'].includes(lead.preferredLanguage)
    ? lead.preferredLanguage
    : 'en';
  const customerName = lead.name?.trim() || (
    lang === 'hi' ? 'मित्र' : lang === 'gu' ? 'મિત્ર' : 'there'
  );
  const propertyName = visit.propertyTitle?.trim() || 'Property to be confirmed';
  const dateLocale = { en: 'en-GB', hi: 'hi-IN', gu: 'gu-IN' }[lang];
  const visitDate = new Date(visit.scheduledDate).toLocaleDateString(dateLocale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  });
  const visitTime = formatSiteVisitTime(visit.scheduledTime) || 'To be confirmed';
  const text = {
    en:
      `Hello *${customerName}*, your site visit with Heaven Homes has been scheduled successfully.\n\n` +
      `*Property:* ${propertyName}\n*Date:* ${visitDate}\n*Time:* ${visitTime}\n\n` +
      'Please arrive on time for your scheduled visit. We look forward to assisting you!\n\n' +
      'Thank you,\nTeam *Heaven Homes*',
    hi:
      `नमस्ते *${customerName} जी*, Heaven Homes के साथ आपकी साइट विज़िट सफलतापूर्वक शेड्यूल हो गई है।\n\n` +
      `*प्रॉपर्टी:* ${propertyName}\n*तारीख:* ${visitDate}\n*समय:* ${visitTime}\n\n` +
      'कृपया निर्धारित समय पर पहुंचें। हम आपकी सहायता के लिए तत्पर हैं!\n\n' +
      'धन्यवाद,\nटीम *Heaven Homes*',
    gu:
      `નમસ્તે *${customerName} જી*, Heaven Homes સાથે તમારી સાઇટ વિઝિટ સફળતાપૂર્વક શેડ્યૂલ થઈ ગઈ છે.\n\n` +
      `*પ્રોપર્ટી:* ${propertyName}\n*તારીખ:* ${visitDate}\n*સમય:* ${visitTime}\n\n` +
      'કૃપા કરીને નક્કી કરેલા સમયે પહોંચશો. તમને મદદ કરવા અમે આતુર છીએ!\n\n' +
      'આભાર,\nટીમ *Heaven Homes*',
  }[lang];
  const sent = await sendWhatsAppTemplate(
    lead.phone,
    WHATSAPP_TEMPLATE_NAMES.siteVisitScheduledConfirmation,
    lang,
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
