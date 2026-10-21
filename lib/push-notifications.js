import TeamMember from '@/lib/models/TeamMember';

const INVALID_TOKEN_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-argument',
]);

async function sendPushToMember(member, { title, body, link }) {
  const tokens = [...new Set(member.fcmTokens || [])];
  if (!tokens.length) return;

  const messaging = (await import('@/lib/firebase-admin')).default;
  for (let start = 0; start < tokens.length; start += 500) {
    const batch = tokens.slice(start, start + 500);
    const result = await messaging.sendEachForMulticast({
      tokens: batch,
      notification: { title, body },
      webpush: {
        notification: { sound: 'default' },
        fcmOptions: { link },
      },
    });

    const deadTokens = result.responses.flatMap((response, index) =>
      !response.success && INVALID_TOKEN_CODES.has(response.error?.code)
        ? [batch[index]]
        : []
    );
    const failureCodes = result.responses.reduce((counts, response) => {
      if (!response.success) {
        const code = response.error?.code || 'unknown';
        counts[code] = (counts[code] || 0) + 1;
      }
      return counts;
    }, {});

    if (deadTokens.length) {
      await TeamMember.updateOne(
        { _id: member._id },
        { $pull: { fcmTokens: { $in: deadTokens } } }
      );
    }

    if (result.failureCount > deadTokens.length) {
      console.error(
        `[push] FCM send failed for team member ${member._id}:`,
        failureCodes
      );
    }
    if (result.successCount > 0) {
      console.info(
        `[push] Sent ${result.successCount} notification(s) to team member ${member._id}`
      );
    }
  }
}

export async function notifyOwnersOfNewLead(lead, appUrl) {
  const owners = await TeamMember.find({
    role: 'owner',
    active: { $ne: false },
    fcmTokens: { $exists: true, $ne: [] },
  })
    .select('_id fcmTokens')
    .lean();
  if (!owners.length) {
    console.warn('[push] No active owner accounts have registered notification tokens');
    return;
  }

  const link = new URL(`/leads/${lead._id}`, appUrl).toString();
  await Promise.all(
    owners.map((owner) =>
      sendPushToMember(owner, {
        title: '🔔 New Lead Received',
        body: `A new lead "${lead.name || lead.phone}" was added to the CRM.`,
        link,
      })
    )
  );
}

export async function notifyAssignedChannelPartner(lead, assignedTo, appUrl) {
  if (!assignedTo) return;

  const partner = await TeamMember.findOne({
    name: assignedTo,
    role: 'channel_partner',
    active: { $ne: false },
  })
    .select('_id fcmTokens')
    .lean();

  if (!partner) {
    console.warn(`[push] No active channel partner found for assignment "${assignedTo}"`);
    return;
  }
  if (!partner.fcmTokens?.length) {
    console.warn(`[push] Assigned channel partner ${partner._id} has no registered notification tokens`);
    return;
  }

  const link = new URL(`/leads/${lead._id}`, appUrl).toString();
  await sendPushToMember(partner, {
    title: '🔔 New Lead Assigned',
    body: `Lead "${lead.name || lead.phone}" was assigned to you.`,
    link,
  });
}
