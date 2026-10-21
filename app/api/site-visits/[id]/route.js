import dbConnect, { isDbConnected } from "@/lib/mongodb";
import SiteVisit from "@/lib/models/SiteVisit";
import Lead from "@/lib/models/Lead";
import Property from "@/lib/models/Property";
import { logActivity } from "@/lib/activity/log";
import { sendPostSiteVisitFollowUp } from "@/lib/site-visit-reminder-service";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { formatSiteVisitTime } from "@/lib/site-visit-time";
import { sendSiteVisitScheduledConfirmation } from "@/lib/site-visit-confirmation";
import { NextResponse } from "next/server";

function isValidObjectId(id) {
  return /^[0-9a-fA-F]{24}$/.test(id);
}

// ---- PUT /api/site-visits/[id] ----
export async function PUT(request, { params }) {
  try {
    const session = verifySessionToken(request.cookies.get(SESSION_COOKIE_NAME)?.value);
    if (!session || !["owner", "channel_partner"].includes(session.role)) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    if (!isDbConnected()) {
      const conn = await dbConnect();
      if (!conn)
        return NextResponse.json({ error: "DB unavailable" }, { status: 503 });
    }

    const { id } = await params;
    if (!id || !isValidObjectId(id)) {
      return NextResponse.json(
        { error: "Invalid site visit ID" },
        { status: 400 },
      );
    }

    const body = await request.json();

    const allowed = [
      "scheduledDate",
      "scheduledTime",
      "propertyId",
      "channelPartnerName",
      "status",
      "notes",
    ];
    const clean = {};
    for (const k of allowed) if (body[k] !== undefined) clean[k] = body[k];
    if (clean.scheduledTime !== undefined) {
      clean.scheduledTime = formatSiteVisitTime(clean.scheduledTime);
      if (!clean.scheduledTime) {
        return NextResponse.json({ error: "A valid AM/PM time is required" }, { status: 400 });
      }
    }

    const existing = await SiteVisit.findById(id);
    if (!existing)
      return NextResponse.json(
        { error: "Site visit not found" },
        { status: 404 },
      );
    if (
      session.role === "channel_partner" &&
      existing.channelPartnerName?.trim().toLowerCase() !== session.name?.trim().toLowerCase()
    ) {
      return NextResponse.json({ error: "You can only edit visits assigned to you" }, { status: 403 });
    }

    if (clean.propertyId !== undefined) {
      if (!isValidObjectId(clean.propertyId)) {
        return NextResponse.json({ error: "Invalid property ID" }, { status: 400 });
      }
      const property = await Property.findOne({ _id: clean.propertyId, status: "available" }).lean();
      if (!property) return NextResponse.json({ error: "Available property not found" }, { status: 404 });
      clean.property = property._id;
      clean.propertyTitle = property.title || "";
      clean.propertyCode = property.propertyId || "";
      delete clean.propertyId;
    }

    // If the date changed and the status is now 'rescheduled', capture the old
    const scheduleChanged =
      (clean.scheduledDate &&
        new Date(clean.scheduledDate).getTime() !==
          new Date(existing.scheduledDate).getTime()) ||
      (clean.scheduledTime !== undefined &&
        clean.scheduledTime !== formatSiteVisitTime(existing.scheduledTime, existing.scheduledDate));
    if (scheduleChanged) {
      clean.rescheduledFrom = {
        date: existing.scheduledDate,
        time: existing.scheduledTime,
        rescheduledAt: new Date(),
      };
      if (clean.status === undefined) clean.status = "rescheduled";
    }

    const update = scheduleChanged
      ? { $set: clean, $unset: { reminderSentAt: 1 } }
      : clean;
    const visit = await SiteVisit.findByIdAndUpdate(id, update, {
      returnDocument: "after",
      runValidators: true,
    });
    if (visit.status === "scheduled" && (existing.status !== "scheduled" || scheduleChanged)) {
      const lead = await Lead.findById(visit.lead).select("name phone").lean();
      await sendSiteVisitScheduledConfirmation(lead, visit);
    }
    if (visit.status === "completed") {
      await Lead.findByIdAndUpdate(visit.lead, {
        $set: {
          currentStatus: "site_visit_completed",
          lastActivityAt: new Date(),
        },
      });
    }
    const postVisitFollowUp = existing.status !== "completed" && visit.status === "completed"
      ? await sendPostSiteVisitFollowUp(visit._id)
      : null;
    let description = `Site visit updated: ${visit.leadName} → ${visit.propertyTitle}`;
    let severity = "info";

    if (existing.status !== visit.status) {
      if (visit.status === "completed") {
        description = `Site visit completed: ${visit.leadName} → ${visit.propertyTitle}`;
        severity = "success";
      } else if (visit.status === "cancelled") {
        description = `Site visit cancelled: ${visit.leadName} → ${visit.propertyTitle}`;
        severity = "warning";
      } else if (visit.status === "rescheduled") {
        description = `Site visit rescheduled: ${visit.leadName} → ${visit.propertyTitle}`;
        severity = "warning";
      }
    }

    // Logging must never poison a successful update — wrap it independently
    try {
      await logActivity(request, {
        action: `site_visit.${visit.status}`,
        category: "site_visit",
        description,
        targetType: "SiteVisit",
        targetId: visit._id,
        targetLabel: `${visit.leadName} · ${visit.propertyTitle}`,
        changes: { status: { from: existing.status, to: visit.status } },
        severity,
      });
    } catch (logErr) {
      console.error("[site-visits] activity log failed (non-fatal):", logErr);
    }

    return NextResponse.json({
      success: true,
      data: visit,
      postVisitFollowUp,
      message: "Site visit updated",
    });
  } catch (error) {
    console.error("[site-visits] PUT error:", error);
    return NextResponse.json(
      { error: "Failed to update site visit", message: error.message },
      { status: 500 },
    );
  }
}

// ---- DELETE /api/site-visits/[id] ----
export async function DELETE(request, { params }) {
  try {
    const session = verifySessionToken(request.cookies.get(SESSION_COOKIE_NAME)?.value);
    if (session?.role !== "owner") {
      return NextResponse.json({ error: "Only the owner can delete site visits" }, { status: 403 });
    }
    if (!isDbConnected()) {
      const conn = await dbConnect();
      if (!conn)
        return NextResponse.json({ error: "DB unavailable" }, { status: 503 });
    }

    const { id } = await params;
    if (!id || !isValidObjectId(id)) {
      return NextResponse.json(
        { error: "Invalid site visit ID" },
        { status: 400 },
      );
    }

    const visit = await SiteVisit.findByIdAndDelete(id);
    if (!visit)
      return NextResponse.json(
        { error: "Site visit not found" },
        { status: 404 },
      );
    await Lead.updateOne(
      { _id: visit.lead, activeSiteVisit: visit._id },
      { $unset: { activeSiteVisit: 1 } }
    );
    try {
      await logActivity(request, {
        action: "site_visit.deleted",
        category: "site_visit",
        description: `Site visit deleted: ${visit.leadName} → ${visit.propertyTitle}`,
        targetType: "SiteVisit",
        targetId: visit._id,
        targetLabel: `${visit.leadName} · ${visit.propertyTitle}`,
        severity: "danger",
      });
    } catch (logErr) {
      console.error("[site-visits] activity log failed (non-fatal):", logErr);
    }

    return NextResponse.json({ success: true, message: "Site visit deleted" });
  } catch (error) {
    console.error("[site-visits] DELETE error:", error);
    return NextResponse.json(
      { error: "Failed to delete site visit", message: error.message },
      { status: 500 },
    );
  }
}
