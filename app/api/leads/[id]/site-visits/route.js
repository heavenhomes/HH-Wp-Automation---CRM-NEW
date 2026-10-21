import dbConnect, { isDbConnected } from '@/lib/mongodb';
import SiteVisit from '@/lib/models/SiteVisit';
import Lead from '@/lib/models/Lead';
import Property from '@/lib/models/Property';
import { verifySessionToken, SESSION_COOKIE_NAME } from '@/lib/auth/session';
import { logActivity } from '@/lib/activity/log';
import { formatSiteVisitTime } from '@/lib/site-visit-time';
import { sendSiteVisitScheduledConfirmation } from '@/lib/site-visit-confirmation';
import { NextResponse } from 'next/server';

function isValidObjectId(id) {
  return /^[0-9a-fA-F]{24}$/.test(id);
}

export async function POST(request, { params }) {
  try {
    const session = verifySessionToken(request.cookies.get(SESSION_COOKIE_NAME)?.value);
    if (!session || !['owner', 'channel_partner'].includes(session.role)) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    if (!isDbConnected()) {
      const conn = await dbConnect();
      if (!conn) return NextResponse.json({ error: 'DB unavailable' }, { status: 503 });
    }

    const { id } = await params;
    if (!id || !isValidObjectId(id)) {
      return NextResponse.json({ error: 'Invalid lead ID' }, { status: 400 });
    }
    const body = await request.json();
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }
    if (
      !isValidObjectId(body.propertyId) ||
      typeof body.scheduledDate !== 'string' ||
      typeof body.scheduledTime !== 'string' ||
      !body.scheduledTime.trim()
    ) {
      return NextResponse.json({ error: 'A valid property, date, and time are required' }, { status: 400 });
    }
    const scheduledDate = new Date(body.scheduledDate);
    const scheduledTime = formatSiteVisitTime(body.scheduledTime);
    if (!Number.isFinite(scheduledDate.getTime()) || !scheduledTime) {
      return NextResponse.json({ error: 'A valid date and time are required' }, { status: 400 });
    }

    const [lead, property] = await Promise.all([
      Lead.findById(id).lean(),
      Property.findOne({ _id: body.propertyId, status: 'available' }).lean(),
    ]);
    if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    if (
      session.role === 'channel_partner' &&
      (!session.name || lead.assignedTo?.trim().toLowerCase() !== session.name.trim().toLowerCase())
    ) {
      return NextResponse.json({ error: 'You can only schedule site visits for leads assigned to you' }, { status: 403 });
    }
    if (!property) return NextResponse.json({ error: 'Available property not found' }, { status: 404 });

    const visit = await SiteVisit.create({
      lead: lead._id,
      property: property._id,
      leadName: lead.name || '',
      leadPhone: lead.phone || '',
      propertyTitle: property.title || '',
      propertyCode: property.propertyId || '',
      scheduledDate,
      scheduledTime,
      channelPartnerName: lead.assignedTo || '',
      status: 'scheduled',
      source: 'manual',
      notes: typeof body.notes === 'string' ? body.notes.trim() : '',
    });
    await sendSiteVisitScheduledConfirmation(lead, visit);
    await Lead.findByIdAndUpdate(lead._id, {
      $set: {
        activeSiteVisit: visit._id,
        currentStatus: 'site_visit_scheduled',
        lastActivityAt: new Date(),
      },
    });
    await logActivity(request, {
      action: 'site_visit.created',
      category: 'site_visit',
      description: `Site visit scheduled: ${visit.leadName} → ${visit.propertyTitle}`,
      targetType: 'SiteVisit',
      targetId: visit._id,
      targetLabel: `${visit.leadName} · ${visit.propertyTitle}`,
      severity: 'success',
    });
    return NextResponse.json({ success: true, data: visit }, { status: 201 });
  } catch (error) {
    console.error('[leads/site-visits] POST error:', error);
    return NextResponse.json({ error: 'Failed to schedule site visit', message: error.message }, { status: 500 });
  }
}

export async function GET(request, { params }) {
  try {
    if (!isDbConnected()) {
      const conn = await dbConnect();
      if (!conn) return NextResponse.json({ error: 'DB unavailable' }, { status: 503 });
    }

    const { id } = await params;
    if (!id || !isValidObjectId(id)) {
      return NextResponse.json({ error: 'Invalid lead ID' }, { status: 400 });
    }

    const visits = await SiteVisit.find({ lead: id })
      .populate('property', 'propertyId title city area price configuration imageUrl')
      .sort({ scheduledDate: -1 })
      .lean();

    return NextResponse.json({ success: true, data: visits });
  } catch (error) {
    console.error('[leads/site-visits] error:', error);
    return NextResponse.json({ error: 'Failed to fetch site visits', message: error.message }, { status: 500 });
  }
}