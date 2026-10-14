import dbConnect, { isDbConnected } from '@/lib/mongodb';
import Lead from '@/lib/models/Lead';
import { verifySessionToken, SESSION_COOKIE_NAME } from '@/lib/auth/session';
import { NextResponse } from 'next/server';

export async function GET(request) {
  try {
    const session = verifySessionToken(request.cookies.get(SESSION_COOKIE_NAME)?.value);
    if (!session || !['owner', 'channel_partner'].includes(session.role)) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    if (!isDbConnected()) {
      const conn = await dbConnect();
      if (!conn) return NextResponse.json({ error: 'DB unavailable' }, { status: 503 });
    }

    const now = new Date();
    const query = {
      'ownerNotes.nextFollowUpAt': { $gte: now },
    };
    if (session.role === 'channel_partner') {
      if (!session.name) {
        return NextResponse.json({ error: 'Channel partner name is missing from session' }, { status: 403 });
      }
      query.assignedTo = { $regex: `^\\s*${session.name.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, $options: 'i' };
    }

    const leads = await Lead.collection.find(query, {
      projection: { name: 1, phone: 1, assignedTo: 1, ownerNotes: 1 },
    }).toArray();
    const reminders = leads.flatMap((lead) =>
      (lead.ownerNotes || [])
        .filter((entry) => {
          const followUpAt = new Date(entry.nextFollowUpAt);
          return followUpAt >= now;
        })
        .map((entry) => ({
          _id: entry._id,
          leadId: lead._id,
          leadName: lead.name || 'Lead',
          phone: lead.phone,
          note: entry.note,
          nextFollowUpAt: entry.nextFollowUpAt,
          assignedTo: lead.assignedTo || '',
        }))
    ).sort((a, b) => new Date(a.nextFollowUpAt) - new Date(b.nextFollowUpAt));

    return NextResponse.json(
      { success: true, data: reminders },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } }
    );
  } catch (error) {
    console.error('[lead-note-reminders] GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch lead reminders', message: error.message }, { status: 500 });
  }
}
