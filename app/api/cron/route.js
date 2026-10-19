import { NextResponse } from 'next/server';
import {
  checkAndSendFollowUps,
  checkAndSendPropertyFollowUps,
} from '@/lib/followup-service';
import {
  checkAndSendSiteVisitReminders,
  checkAndSendPostSiteVisitFollowUps,
  markPastSiteVisitsPending,
} from '@/lib/site-visit-reminder-service';

export async function GET(request) {
  const authHeader = request.headers.get('authorization');
  const expectedSecret = process.env.CRON_SECRET;

  if (!expectedSecret || authHeader !== `Bearer ${expectedSecret}`) {
    console.log('❌ Unauthorized cron attempt');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    console.log('🔄 Cron job triggered - Starting follow-up check...');
    const result = await checkAndSendFollowUps();
    const propertyFollowUps = await checkAndSendPropertyFollowUps();
    const siteVisitStatusUpdates = await markPastSiteVisitsPending();
    const siteVisitReminders = await checkAndSendSiteVisitReminders();
    const postSiteVisitFollowUps = await checkAndSendPostSiteVisitFollowUps();

    if (
      !result.success ||
      !propertyFollowUps.success ||
      !siteVisitStatusUpdates.success ||
      !siteVisitReminders.success ||
      !postSiteVisitFollowUps.success
    ) {
      return NextResponse.json(
        { result, propertyFollowUps, siteVisitStatusUpdates, siteVisitReminders, postSiteVisitFollowUps },
        { status: 400 }
      );
    }

    console.log('✅ Cron job completed successfully');
    return NextResponse.json({
      success: true,
      message: 'Follow-up and site visit reminder checks executed',
      result,
      propertyFollowUps,
      siteVisitStatusUpdates,
      siteVisitReminders,
      postSiteVisitFollowUps,
    });
  } catch (error) {
    console.error('❌ Cron job error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
