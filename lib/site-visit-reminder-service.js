import dbConnect, { isDbConnected } from '@/lib/mongodb';
import Lead from '@/lib/models/Lead';
import SiteVisit from '@/lib/models/SiteVisit';
import {
  bodyParameters,
  quickReplyParameters,
  sendWhatsAppTemplate,
  WHATSAPP_TEMPLATE_NAMES,
} from '@/lib/whatsapp-template';

const REMINDER_LEAD_TIME_MS = 2 * 60 * 60 * 1000;
const INDIA_TIME_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const ACTIVE_SITE_VISIT_STATUSES = ['scheduled', 'pending', 'rescheduled'];

function getVisitDateTime(visit) {
  const date = new Date(visit.scheduledDate);
  if (Number.isNaN(date.getTime())) return null;

  const timeMatch = String(visit.scheduledTime || '').match(
    /^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?$/i
  );
  if (!timeMatch && !visit.scheduledTime && date.getUTCHours() === 0 && date.getUTCMinutes() === 0) {
    return null;
  }

  let hour = timeMatch ? Number(timeMatch[1]) : date.getUTCHours();
  const minute = timeMatch ? Number(timeMatch[2] || 0) : date.getUTCMinutes();
  const meridiem = timeMatch?.[3]?.toUpperCase();
  if (minute > 59 || hour > (meridiem ? 12 : 23) || (meridiem && hour === 0)) {
    return null;
  }
  if (meridiem === 'PM' && hour < 12) hour += 12;
  if (meridiem === 'AM' && hour === 12) hour = 0;

  const indiaDateParts = new Intl.DateTimeFormat('en', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).formatToParts(date);
  const indiaDate = Object.fromEntries(
    indiaDateParts
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, Number(part.value)])
  );
  const localWallClock = Date.UTC(
    indiaDate.year,
    indiaDate.month - 1,
    indiaDate.day,
    hour,
    minute
  );
  return new Date(localWallClock - INDIA_TIME_OFFSET_MS);
}

function formatVisitTime(date) {
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Kolkata',
  });
}

function getReminderMessage(lead, visit, scheduledAt) {
  const lang = ['en', 'hi', 'gu'].includes(lead.preferredLanguage)
    ? lead.preferredLanguage
    : 'en';
  const customerName = lead.name?.trim() || (
    lang === 'hi' ? 'मित्र' : lang === 'gu' ? 'મિત્ર' : 'there'
  );
  const propertyName = visit.propertyTitle || '';
  const visitDate = scheduledAt.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  });
  const visitTime = formatVisitTime(scheduledAt);
  const text = {
    en: `Hello ${customerName}!\n\nThis is a reminder of your scheduled property site visit.\n\nProperty: ${propertyName}\nDate: ${visitDate}\nTime: ${visitTime}\n\nPlease confirm your availability by selecting one of the options below.`,
    hi: `नमस्ते ${customerName} जी!\n\nआपकी निर्धारित प्रॉपर्टी साइट विज़िट के लिए यह एक रिमाइंडर है।\n\nप्रॉपर्टी: ${propertyName}\nतारीख: ${visitDate}\nसमय: ${visitTime}\n\nकृपया अपनी विज़िट की पुष्टि करें या बदलाव करने के लिए नीचे दिए गए विकल्पों में से चुनें।`,
    gu: `નમસ્તે ${customerName} જી!\n\nતમારી નિર્ધારિત પ્રોપર્ટી સાઇટ વિઝિટ માટે આ એક રિમાઇન્ડર છે.\n\n🏡 પ્રોપર્ટી: ${propertyName}\n📅 તારીખ: ${visitDate}\n⏰ સમય: ${visitTime}\n\nકૃપા કરીને તમારી વિઝિટની પુષ્ટિ કરો અથવા ફેરફાર કરવા માટે નીચે આપેલા વિકલ્પોમાંથી પસંદ કરો.`,
  }[lang];
  return { lang, customerName, propertyName, visitDate, visitTime, text };
}

function getPostVisitMessage(lead, visit) {
  const lang = ['en', 'hi', 'gu'].includes(lead.preferredLanguage)
    ? lead.preferredLanguage
    : 'en';
  const name = lead.name?.trim() || (
    lang === 'hi' ? 'मित्र' : lang === 'gu' ? 'મિત્ર' : 'there'
  );
  const propertyName = visit.propertyTitle || '';
  const text = {
    en: `Hi *${name}*! 👋\n\nThank you for visiting *${propertyName}* with us! 🏡\n\nWe hope you liked the property and had a great experience during your visit.\n\nWe'd love to hear your feedback and know what you think. Looking forward to hearing from you!\n\nPlease tap *Menu* to explore more property options that match your preferences. 🏡`,
    hi: `नमस्ते *${name} जी*! 👋\n\nहमारे साथ *${propertyName}* की प्रॉपर्टी विज़िट करने के लिए धन्यवाद! 🏡\n\nहमें उम्मीद है कि आपको प्रॉपर्टी पसंद आई होगी और आपका विज़िट का अनुभव अच्छा रहा होगा।\n\nहम आपकी राय जानना चाहेंगे। उम्मीद है कि जल्द ही आपका जवाब मिलेगा!\n\nअपनी पसंद के अनुसार और प्रॉपर्टी विकल्प देखने के लिए कृपया *मेन्यू* पर क्लिक करें। 🏡`,
    gu: `નમસ્તે *${name} જી*! 👋\n\nઅમારી સાથે *${propertyName}* ની પ્રોપર્ટી વિઝિટ કરવા બદલ આભાર! 🏡\n\nઅમને આશા છે કે તમને પ્રોપર્ટી પસંદ આવી હશે અને તમારી મુલાકાતનો અનુભવ સારો રહ્યો હશે.\n\nઅમે તમારો પ્રતિભાવ જાણવા આતુર છીએ. આશા છે કે ટૂંક સમયમાં તમારો જવાબ મળશે!\n\nતમારી પસંદગી મુજબ વધુ પ્રોપર્ટીના વિકલ્પો જોવા માટે કૃપા કરીને *મેનૂ* પર ક્લિક કરો. 🏡`,
  }[lang];
  return { lang, name, propertyName, text };
}

async function ensureDatabaseConnection() {
  if (isDbConnected()) return true;
  return Boolean(await dbConnect());
}

export async function checkAndSendSiteVisitReminders() {
  if (!(await ensureDatabaseConnection())) {
    return { success: false, error: 'DB unavailable', sent: 0, total: 0 };
  }

  const now = new Date();
  const visits = await SiteVisit.find({
    status: { $in: ACTIVE_SITE_VISIT_STATUSES },
    scheduledDate: {
      $gte: new Date(now.getTime() - 24 * 60 * 60 * 1000),
      $lte: new Date(now.getTime() + 26 * 60 * 60 * 1000),
    },
    $or: [{ reminderSentAt: { $exists: false } }, { reminderSentAt: null }],
  })
    .sort({ scheduledDate: 1 })
    .limit(500)
    .lean();

  const results = [];
  for (const visit of visits) {
    const scheduledAt = getVisitDateTime(visit);
    if (!scheduledAt) continue;

    const reminderAt = scheduledAt.getTime() - REMINDER_LEAD_TIME_MS;
    if (now.getTime() < reminderAt || now.getTime() >= scheduledAt.getTime()) {
      continue;
    }

    const lead = await Lead.findById(visit.lead)
      .select('name phone preferredLanguage')
      .lean();
    if (!lead?.phone) {
      results.push({ success: false, visitId: visit._id.toString(), skipped: 'no_phone' });
      continue;
    }

    const claimed = await SiteVisit.findOneAndUpdate(
      {
        _id: visit._id,
        status: { $in: ACTIVE_SITE_VISIT_STATUSES },
        $or: [{ reminderSentAt: { $exists: false } }, { reminderSentAt: null }],
      },
      { $set: { reminderSentAt: now } },
      { new: true }
    );
    if (!claimed) continue;

    const message = getReminderMessage(lead, visit, scheduledAt);
    const visitId = visit._id.toString();
    const buttonPayloads = [
      `site_visit_confirm::${visitId}`,
      `site_visit_reschedule::${visitId}`,
      `site_visit_cancel::${visitId}`,
    ];
    const sent = await sendWhatsAppTemplate(
      lead.phone,
      WHATSAPP_TEMPLATE_NAMES.siteVisitReminder,
      message.lang,
      [
        ...bodyParameters([
          message.customerName,
          message.propertyName,
          message.visitDate,
          message.visitTime,
        ]),
        ...quickReplyParameters(buttonPayloads),
      ]
    );

    if (!sent) {
      await SiteVisit.updateOne(
        { _id: visit._id, reminderSentAt: now },
        { $unset: { reminderSentAt: 1 } }
      );
      results.push({ success: false, visitId, error: 'send_failed' });
      continue;
    }

    const buttonTitles = message.lang === 'hi'
      ? ['पुष्टि करें', 'समय बदलें', 'रद्द करें']
      : message.lang === 'gu'
        ? ['પુષ્ટિ કરો', 'સમય બદલો', 'રદ કરો']
        : ['Confirm', 'Reschedule', 'Cancel'];
    await Lead.updateOne(
      { _id: lead._id },
      {
        $push: {
          conversation: {
            $each: [{
              direction: 'out',
              type: 'template',
              text: message.text,
              payload: {
                siteVisitId: visit._id,
                options: buttonPayloads.map((id, index) => ({
                  id,
                  title: buttonTitles[index],
                })),
              },
              at: now,
            }],
            $slice: -500,
          },
        },
      }
    );
    results.push({ success: true, visitId });
  }

  return {
    success: true,
    total: visits.length,
    sent: results.filter((result) => result.success).length,
    results,
  };
}

export async function sendPostSiteVisitFollowUp(visitId) {
  if (!(await ensureDatabaseConnection())) {
    return { success: false, error: 'DB unavailable' };
  }

  const now = new Date();
  const visit = await SiteVisit.findOneAndUpdate(
    {
      _id: visitId,
      status: 'completed',
      $and: [
        {
          $or: [
            { postVisitFollowUpSentAt: { $exists: false } },
            { postVisitFollowUpSentAt: null },
          ],
        },
        {
          $or: [
            { postVisitFollowUpSkippedAt: { $exists: false } },
            { postVisitFollowUpSkippedAt: null },
          ],
        },
        {
          $or: [
            { postVisitFollowUpClaimedAt: { $exists: false } },
            { postVisitFollowUpClaimedAt: null },
            { postVisitFollowUpClaimedAt: { $lte: new Date(now.getTime() - 10 * 60 * 1000) } },
          ],
        },
      ],
    },
    { $set: { postVisitFollowUpClaimedAt: now } },
    { new: true }
  ).lean();

  if (!visit) return { success: false, skipped: 'already_sent_or_claimed' };

  const lead = await Lead.findById(visit.lead)
    .select('name phone preferredLanguage followUpStatus')
    .lean();
  if (lead?.followUpStatus === 'unsubscribed') {
    await SiteVisit.updateOne(
      { _id: visit._id, postVisitFollowUpClaimedAt: now },
      {
        $set: { postVisitFollowUpSkippedAt: now },
        $unset: { postVisitFollowUpClaimedAt: 1 },
      }
    );
    return { success: false, skipped: 'unsubscribed' };
  }
  if (!lead?.phone) {
    await SiteVisit.updateOne(
      { _id: visit._id, postVisitFollowUpClaimedAt: now },
      {
        $set: { postVisitFollowUpSkippedAt: now },
        $unset: { postVisitFollowUpClaimedAt: 1 },
      }
    );
    return { success: false, error: 'Lead has no WhatsApp phone number' };
  }

  const message = getPostVisitMessage(lead, visit);
  const sent = await sendWhatsAppTemplate(
    lead.phone,
    WHATSAPP_TEMPLATE_NAMES.postSiteVisitFollowup,
    message.lang,
    [
      ...bodyParameters([message.name, message.propertyName]),
      ...quickReplyParameters(['main_menu']),
    ]
  );

  if (!sent) {
    await SiteVisit.updateOne(
      { _id: visit._id, postVisitFollowUpClaimedAt: now },
      { $unset: { postVisitFollowUpClaimedAt: 1 } }
    );
    return { success: false, error: 'Template send failed' };
  }

  const [sentRecord] = await Promise.all([
    SiteVisit.updateOne(
      { _id: visit._id, postVisitFollowUpClaimedAt: now },
      {
        $set: { postVisitFollowUpSentAt: now },
        $unset: { postVisitFollowUpClaimedAt: 1 },
      }
    ),
    Lead.updateOne(
      { _id: lead._id },
      {
        $push: {
          conversation: {
            $each: [{
              direction: 'out',
              type: 'template',
              text: message.text,
              payload: {
                template: WHATSAPP_TEMPLATE_NAMES.postSiteVisitFollowup,
                options: [{
                  id: 'main_menu',
                  title: message.lang === 'hi'
                    ? 'मेन्यू'
                    : message.lang === 'gu'
                      ? 'મેનૂ'
                      : 'Menu',
                }],
              },
              at: now,
            }],
            $slice: -500,
          },
        },
      }
    ),
  ]);
  if (sentRecord.matchedCount !== 1) {
    console.error(`[site-visit-followup] Could not record sent follow-up for ${visit._id}`);
    return { success: false, error: 'send_record_update_failed' };
  }

  return { success: true, visitId: visit._id.toString() };
}

export async function checkAndSendPostSiteVisitFollowUps() {
  if (!(await ensureDatabaseConnection())) {
    return { success: false, error: 'DB unavailable', sent: 0, total: 0 };
  }

  const visits = await SiteVisit.find({
    status: 'completed',
    $and: [
      {
        $or: [
          { postVisitFollowUpSentAt: { $exists: false } },
          { postVisitFollowUpSentAt: null },
        ],
      },
      {
        $or: [
          { postVisitFollowUpSkippedAt: { $exists: false } },
          { postVisitFollowUpSkippedAt: null },
        ],
      },
    ],
  })
    .sort({ updatedAt: 1 })
    .limit(100)
    .select('_id')
    .lean();
  const results = [];
  for (const visit of visits) {
    results.push(await sendPostSiteVisitFollowUp(visit._id));
  }

  return {
    success: true,
    total: visits.length,
    sent: results.filter((result) => result.success).length,
    results,
  };
}

export async function markPastSiteVisitsPending() {
  if (!(await ensureDatabaseConnection())) {
    return { success: false, error: 'DB unavailable', updated: 0, total: 0 };
  }

  const now = new Date();
  const visits = await SiteVisit.find({
    status: { $in: ['scheduled', 'rescheduled'] },
    scheduledDate: { $lte: now },
  })
    .select('_id scheduledDate scheduledTime')
    .sort({ scheduledDate: 1 })
    .lean();

  let updated = 0;
  for (const visit of visits) {
    const scheduledAt = getVisitDateTime(visit);
    if (!scheduledAt || scheduledAt >= now) continue;

    const result = await SiteVisit.updateOne(
      { _id: visit._id, status: { $in: ['scheduled', 'rescheduled'] } },
      { $set: { status: 'pending' } }
    );
    updated += result.modifiedCount;
  }

  return { success: true, total: visits.length, updated };
}
