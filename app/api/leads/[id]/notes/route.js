import dbConnect, { isDbConnected } from '@/lib/mongodb';
import Lead from '@/lib/models/Lead';
import mongoose from 'mongoose';
import { verifySessionToken, SESSION_COOKIE_NAME } from '@/lib/auth/session';
import { NextResponse } from 'next/server';

function isValidObjectId(id) {
  return typeof id === 'string' && /^[0-9a-fA-F]{24}$/.test(id);
}

function canAccessLead(session, lead) {
  return session.role === 'owner' ||
    (session.role === 'channel_partner' &&
      session.name &&
      lead.assignedTo?.trim().toLowerCase() === session.name.trim().toLowerCase());
}

async function getAuthorizedLead(request, params) {
  const session = verifySessionToken(request.cookies.get(SESSION_COOKIE_NAME)?.value);
  if (!session || !['owner', 'channel_partner'].includes(session.role)) {
    return { response: NextResponse.json({ error: 'Not authenticated' }, { status: 401 }) };
  }

  const { id } = await params;
  if (!isValidObjectId(id)) {
    return { response: NextResponse.json({ error: 'Invalid lead ID' }, { status: 400 }) };
  }

  const lead = await Lead.findById(id);
  if (!lead) {
    return { response: NextResponse.json({ error: 'Lead not found' }, { status: 404 }) };
  }
  if (!canAccessLead(session, lead)) {
    return { response: NextResponse.json({ error: 'You can only access leads assigned to you' }, { status: 403 }) };
  }
  return { session, lead };
}

export async function GET(request, { params }) {
  try {
    if (!isDbConnected()) {
      const conn = await dbConnect();
      if (!conn) return NextResponse.json({ error: 'DB unavailable' }, { status: 503 });
    }

    const result = await getAuthorizedLead(request, params);
    if (result.response) return result.response;
    const storedLead = await Lead.collection.findOne(
      { _id: result.lead._id },
      { projection: { ownerNotes: 1 } }
    );
    const notes = [...(Array.isArray(storedLead?.ownerNotes) ? storedLead.ownerNotes : [])]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return NextResponse.json(
      { success: true, data: notes },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } }
    );
  } catch (error) {
    console.error('[leads/notes] GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch notes', message: error.message }, { status: 500 });
  }
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

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    const note = typeof body?.note === 'string' ? body.note.trim() : '';
    const nextFollowUpAt = new Date(body?.nextFollowUpAt);
    if (!note) return NextResponse.json({ error: 'Note is required' }, { status: 400 });
    if (note.length > 5000) return NextResponse.json({ error: 'Note must be 5000 characters or fewer' }, { status: 400 });
    if (!body?.nextFollowUpAt || !Number.isFinite(nextFollowUpAt.getTime())) {
      return NextResponse.json({ error: 'A valid next follow-up date and time are required' }, { status: 400 });
    }

    const result = await getAuthorizedLead(request, params);
    if (result.response) return result.response;
    const noteEntry = {
      _id: new mongoose.Types.ObjectId(),
      note,
      createdAt: new Date(),
      nextFollowUpAt,
      createdBy: session.name || session.username || '',
    };
    const updateResult = await Lead.collection.updateOne(
      { _id: result.lead._id },
      { $push: { ownerNotes: noteEntry } }
    );
    if (updateResult.matchedCount !== 1) {
      return NextResponse.json({ error: 'Lead not found while saving note' }, { status: 404 });
    }
    const updatedLead = await Lead.collection.findOne(
      { _id: result.lead._id },
      { projection: { ownerNotes: 1 } }
    );
    if (!Array.isArray(updatedLead?.ownerNotes)) {
      console.error('[leads/notes] Note update completed but ownerNotes could not be loaded:', result.lead._id);
      return NextResponse.json({ error: 'Note was saved but could not be loaded' }, { status: 500 });
    }

    const notes = [...updatedLead.ownerNotes]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return NextResponse.json(
      { success: true, data: notes },
      { status: 201, headers: { 'Cache-Control': 'no-store, max-age=0' } }
    );
  } catch (error) {
    console.error('[leads/notes] POST error:', error);
    return NextResponse.json({ error: 'Failed to save note', message: error.message }, { status: 500 });
  }
}
