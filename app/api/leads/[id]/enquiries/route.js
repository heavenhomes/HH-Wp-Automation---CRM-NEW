import dbConnect, { isDbConnected } from '@/lib/mongodb';
import Lead from '@/lib/models/Lead';
import Property from '@/lib/models/Property';
import { sendSiteVisitScheduledConfirmation } from '@/lib/site-visit-confirmation';
import SiteVisit from '@/lib/models/SiteVisit';
import { verifySessionToken, SESSION_COOKIE_NAME } from '@/lib/auth/session';
import { NextResponse } from 'next/server';

function isValidObjectId(id) {
  return /^[0-9a-fA-F]{24}$/.test(id);
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

    const lead = await Lead.findById(id).select('enquiries').lean();
    if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });

    const enquiries = Array.isArray(lead.enquiries)
      ? lead.enquiries.map((enquiry) => {
          if (enquiry.purpose === 'Rent Out') return enquiry;
          const seekerEnquiry = { ...enquiry };
          delete seekerEnquiry.timeline;
          return seekerEnquiry;
        })
      : [];
    const sorted = [...enquiries].sort(
      (a, b) => new Date(b.submittedAt || 0) - new Date(a.submittedAt || 0)
    );

    return NextResponse.json({ success: true, data: sorted });
  } catch (error) {
    console.error('[leads/enquiries] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch enquiries', message: error.message },
      { status: 500 }
    );
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
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'Request body must be a JSON object' }, { status: 400 });
    }

    const lead = await Lead.findById(id);
    if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    if (
      session.role === 'channel_partner' &&
      (!session.name || lead.assignedTo?.trim().toLowerCase() !== session.name.trim().toLowerCase())
    ) {
      return NextResponse.json({ error: 'You can only update leads assigned to you' }, { status: 403 });
    }

    const category = body.propertyCategory;
    const purchaseType = body.purchaseType;
    if (
      !['purchase', 'rent_lease', 'rent_out'].includes(category) ||
      !['residential_buy', 'commercial_buy', 'residential_rent', 'commercial_rent'].includes(purchaseType) ||
      !purchaseType.endsWith(category === 'purchase' ? '_buy' : '_rent')
    ) {
      return NextResponse.json({ error: 'Select a valid property category and residential/commercial type' }, { status: 400 });
    }
    if (typeof body.propertySubType !== 'string' || !body.propertySubType.trim()) {
      return NextResponse.json({ error: 'Select a property subtype' }, { status: 400 });
    }
    if (typeof body.budgetRange !== 'string' || !body.budgetRange.trim()) {
      return NextResponse.json({ error: 'Select a budget' }, { status: 400 });
    }

    const isCommercial = purchaseType.startsWith('commercial_');
    const isLister = category === 'rent_out';
    const isRent = purchaseType.endsWith('_rent');
    if (!isCommercial && body.propertySubType !== 'plot' && !body.configuration) {
      return NextResponse.json({ error: 'Select a configuration / BHK' }, { status: 400 });
    }
    if (isLister && !body.timeline) {
      return NextResponse.json({ error: 'Select availability' }, { status: 400 });
    }
    if (isRent && !body.furnishing) {
      return NextResponse.json({ error: 'Select a furnishing / setup preference' }, { status: 400 });
    }
    if (!isRent && !isLister && !body.investmentType) {
      return NextResponse.json({ error: 'Select a buying plan' }, { status: 400 });
    }
    if (isCommercial && !body.spaceSize) {
      return NextResponse.json({ error: 'Select a commercial space size' }, { status: 400 });
    }

    const siteVisitInput = typeof body.siteVisit === 'string' ? body.siteVisit.trim() : '';
    const siteVisitDate = siteVisitInput ? new Date(siteVisitInput) : null;
    if (siteVisitInput && !Number.isFinite(siteVisitDate.getTime())) {
      return NextResponse.json({ error: 'Invalid preferred site visit date' }, { status: 400 });
    }

    const propertyType = isCommercial ? 'commercial' : (isRent ? 'rent' : 'buy');
    const normalizedFields = {
      city: 'Surat',
      area: typeof body.area === 'string' ? body.area.trim() : '',
      leadType: isLister ? 'lister' : 'seeker',
      propertyCategory: category,
      purchaseType,
      propertyType,
      propertySubType: body.propertySubType.trim(),
      configuration: isCommercial || body.propertySubType === 'plot'
        ? ''
        : body.configuration,
      budgetRange: body.budgetRange,
      rentBudgetLabel: typeof body.rentBudgetLabel === 'string' ? body.rentBudgetLabel : '',
      rentTypeLabel: isRent ? (isCommercial ? 'Commercial' : 'Residential') : '',
      timeline: isLister ? body.timeline : '',
      furnishing: isRent && typeof body.furnishing === 'string' ? body.furnishing : '',
      investmentType: !isRent && !isLister && typeof body.investmentType === 'string' ? body.investmentType : '',
      spaceSize: isCommercial && typeof body.spaceSize === 'string' ? body.spaceSize : '',
      siteVisit: siteVisitDate ? siteVisitDate.toISOString() : '',
    };
    if (body.interested === '') normalizedFields.interested = null;
    else if (body.interested) normalizedFields.interested = body.interested;

    const purpose = isLister ? 'Rent Out' : (category === 'rent_lease' ? 'Rent' : 'Buy');
    const categoryLabel = isCommercial ? 'Commercial' : 'Residential';
    const subtypeLabel = normalizedFields.propertySubType.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
    const configurationLabel = normalizedFields.configuration
      ? normalizedFields.configuration.toUpperCase().replace('BHK', ' BHK').trim()
      : '';

    lead.set(normalizedFields);
    lead.step = 'completed';
    lead.enquiries.push({
      submittedAt: new Date(),
      city: normalizedFields.city,
      area: normalizedFields.area,
      purpose,
      propertyCategory: categoryLabel,
      propertyType: subtypeLabel,
      configuration: configurationLabel,
      size: normalizedFields.spaceSize || '',
      budgetRange: normalizedFields.budgetRange,
      budgetLabel: normalizedFields.rentBudgetLabel || normalizedFields.budgetRange,
      ...(isLister ? { timeline: normalizedFields.timeline } : {}),
      buyingPlan: normalizedFields.investmentType,
      furnishing: normalizedFields.furnishing,
      spaceSize: normalizedFields.spaceSize,
      source: 'manual',
    });
    await lead.save();

    if (siteVisitDate) {
      const property = lead.interested ? await Property.findById(lead.interested).lean() : null;
      const visitDateKey = siteVisitDate.toISOString();
      const visit = await SiteVisit.findOneAndUpdate(
        { lead: lead._id, source: 'admin', rawPreferredDateTime: visitDateKey },
        {
          $set: {
            property: property?._id || null,
            leadName: lead.name || '',
            leadPhone: lead.phone || '',
            propertyTitle: property?.title || property?.internalName || 'Property not specified',
            propertyCode: property?.propertyId || '',
            scheduledDate: siteVisitDate,
            scheduledTime: '',
            rawPreferredDateTime: visitDateKey,
            channelPartnerName: lead.assignedTo || '',
            status: 'scheduled',
          },
          $setOnInsert: { lead: lead._id, source: 'admin' },
        },
        { upsert: true, new: true, runValidators: true }
      );
      await sendSiteVisitScheduledConfirmation(lead, visit);
    }

    await lead.populate([
      { path: 'matchedProperties', select: 'propertyId title city area price configuration imageUrl images status' },
      { path: 'interested', select: 'propertyId title internalName city area price configuration imageUrl images status' },
      { path: 'ownedPropertyDraft', select: 'propertyId title city area price configuration imageUrl status images' },
    ]);
    return NextResponse.json({ success: true, data: lead, message: 'Enquiry updated successfully' });
  } catch (error) {
    console.error('[leads/enquiries] POST error:', error);
    if (error.name === 'ValidationError') {
      return NextResponse.json({ error: 'Validation failed', details: Object.values(error.errors).map((e) => e.message) }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to update enquiry', message: error.message }, { status: 500 });
  }
}
