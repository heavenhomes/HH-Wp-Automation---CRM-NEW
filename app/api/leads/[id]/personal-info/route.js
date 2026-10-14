import dbConnect, { isDbConnected } from '@/lib/mongodb';
import Lead from '@/lib/models/Lead';
import SiteVisit from '@/lib/models/SiteVisit';
import { verifySessionToken, SESSION_COOKIE_NAME } from '@/lib/auth/session';
import { NextResponse } from 'next/server';

function isValidObjectId(id) {
  return typeof id === 'string' && /^[0-9a-fA-F]{24}$/.test(id);
}

export async function PUT(request, { params }) {
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
    if (!isValidObjectId(id)) {
      return NextResponse.json({ error: 'Invalid lead ID' }, { status: 400 });
    }
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    const name = typeof body?.name === 'string' ? body.name.trim() : '';
    const phone = typeof body?.phone === 'string' ? body.phone.trim() : '';
    if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    if (!phone) return NextResponse.json({ error: 'Phone number is required' }, { status: 400 });
    if (name.length > 200 || phone.length > 50) {
      return NextResponse.json({ error: 'Name or phone number is too long' }, { status: 400 });
    }

    const lead = await Lead.findById(id);
    if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    if (
      session.role === 'channel_partner' &&
      (!session.name || lead.assignedTo?.trim().toLowerCase() !== session.name.trim().toLowerCase())
    ) {
      return NextResponse.json({ error: 'You can only edit leads assigned to you' }, { status: 403 });
    }

    const duplicate = await Lead.findOne({ phone, _id: { $ne: lead._id } }).select('_id').lean();
    if (duplicate) {
      return NextResponse.json({ error: 'A lead with this phone number already exists' }, { status: 409 });
    }

    lead.name = name;
    lead.phone = phone;
    lead.phoneNumber = phone;
    await lead.save();
    await SiteVisit.updateMany(
      { lead: lead._id },
      { $set: { leadName: lead.name, leadPhone: lead.phone } }
    );
    return NextResponse.json({
      success: true,
      data: {
        _id: lead._id,
        name: lead.name,
        phone: lead.phone,
        phoneNumber: lead.phoneNumber,
      },
    });
  } catch (error) {
    console.error('[leads/personal-info] PUT error:', error);
    return NextResponse.json({ error: 'Failed to update personal information', message: error.message }, { status: 500 });
  }
}
