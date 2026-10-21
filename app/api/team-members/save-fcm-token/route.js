import dbConnect, { isDbConnected } from '@/lib/mongodb';
import TeamMember from '@/lib/models/TeamMember';
import { verifySessionToken, SESSION_COOKIE_NAME } from '@/lib/auth/session';
import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    if (!isDbConnected()) await dbConnect();

    const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
    const session = verifySessionToken(token);
    if (!session?.name) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { token: fcmToken } = await request.json();
    if (!fcmToken) {
      return NextResponse.json({ error: 'Missing FCM token' }, { status: 400 });
    }

    const member = await TeamMember.findById(session.sub).select('_id').lean();
    if (!member) {
      return NextResponse.json({ error: 'Team member not found' }, { status: 404 });
    }

    // Bind the token to the authenticated account, not a potentially shared name.
    await TeamMember.updateMany(
      { _id: { $ne: member._id }, fcmTokens: fcmToken },
      { $pull: { fcmTokens: fcmToken } }
    );
    await TeamMember.updateOne(
      { _id: member._id },
      { $addToSet: { fcmTokens: fcmToken } }
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[save-fcm-token]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}