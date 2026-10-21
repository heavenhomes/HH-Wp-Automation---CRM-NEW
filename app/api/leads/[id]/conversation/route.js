import dbConnect, { isDbConnected } from '@/lib/mongodb';
import Lead from '@/lib/models/Lead';
import { NextResponse } from 'next/server';
import { verifySessionToken, SESSION_COOKIE_NAME } from '@/lib/auth/session';
import {
  bodyParameters,
  quickReplyParameters,
  sendWhatsAppTemplate,
  sendWhatsAppText,
  WHATSAPP_TEMPLATE_NAMES,
} from '@/lib/whatsapp-template';

function isValidObjectId(id) {
  return /^[0-9a-fA-F]{24}$/.test(id);
}

const CUSTOMER_CONNECT_TEMPLATES = {
  [WHATSAPP_TEMPLATE_NAMES.customerConnectEnglish]: {
    language: 'en',
    body: (name) =>
      `Hi *${name}*, our team at Heaven Homes would like to connect with you regarding your property enquiry/Site Visit. Are you available to chat with us right now?`,
    buttons: ["Yes, I'm Available", 'Not Right Now'],
  },
  [WHATSAPP_TEMPLATE_NAMES.customerConnectHindi]: {
    language: 'hi',
    body: (name) =>
      `नमस्ते *${name}*, Heaven Homes की हमारी टीम आपकी प्रॉपर्टी संबंधी पूछताछ के बारे में आपसे बात करना चाहती है। क्या आप अभी बात करने के लिए उपलब्ध हैं?`,
    buttons: ['हाँ, मैं उपलब्ध हूँ', 'अभी नहीं'],
  },
  [WHATSAPP_TEMPLATE_NAMES.customerConnectGujarati]: {
    language: 'gu',
    body: (name) =>
      `નમસ્તે *${name}*, Heaven Homes ની અમારી ટીમ તમારી પ્રોપર્ટી સંબંધિત પૂછપરછ વિશે તમારી સાથે વાત કરવા માંગે છે. શું તમે અત્યારે વાત કરવા માટે ઉપલબ્ધ છો?`,
    buttons: ['હા, હું ઉપલબ્ધ છું', 'હમણાં નહીં'],
  },
};

const WHATSAPP_WINDOW_MS = 24 * 60 * 60 * 1000;

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

    const lead = await Lead.findById(id).select('conversation lastInboundMessageAt').lean();
    if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });

    const sorted = [...(lead.conversation || [])].sort(
      (a, b) => new Date(a.at || 0) - new Date(b.at || 0)
    );

    return NextResponse.json({
      success: true,
      data: sorted,
      lastInboundMessageAt: lead.lastInboundMessageAt || null,
    });
  } catch (error) {
    console.error('[leads/conversation] error:', error);
    return NextResponse.json({ error: 'Failed to fetch conversation', message: error.message }, { status: 500 });
  }
}

export async function POST(request, { params }) {
  try {
    const session = verifySessionToken(request.cookies.get(SESSION_COOKIE_NAME)?.value);
    if (!session) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    if (!isDbConnected()) {
      const conn = await dbConnect();
      if (!conn) return NextResponse.json({ error: 'DB unavailable' }, { status: 503 });
    }

    const { id } = await params;
    if (!id || !isValidObjectId(id)) {
      return NextResponse.json({ error: 'Invalid lead ID' }, { status: 400 });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const lead = await Lead.findById(id).select('name phone lastInboundMessageAt');
    if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    if (!lead.phone) {
      return NextResponse.json({ error: 'Lead has no WhatsApp phone number' }, { status: 400 });
    }

    const windowOpen =
      lead.lastInboundMessageAt &&
      Date.now() - new Date(lead.lastInboundMessageAt).getTime() < WHATSAPP_WINDOW_MS;
    let entry;

    if (body.mode === 'message') {
      const text = typeof body.text === 'string' ? body.text.trim() : '';
      if (!text || text.length > 4096) {
        return NextResponse.json(
          { error: 'Message must be between 1 and 4096 characters' },
          { status: 400 }
        );
      }
      if (!windowOpen) {
        return NextResponse.json(
          { error: 'The 24-hour WhatsApp window is closed. Send an approved template instead.' },
          { status: 409 }
        );
      }
      const sent = await sendWhatsAppText(lead.phone, text);
      if (!sent) {
        return NextResponse.json({ error: 'WhatsApp could not send the message' }, { status: 502 });
      }
      entry = { direction: 'out', type: 'text', text };
    } else if (body.mode === 'template') {
      const template = CUSTOMER_CONNECT_TEMPLATES[body.templateName];
      if (!template) {
        return NextResponse.json({ error: 'Choose an approved customer-connect template' }, { status: 400 });
      }
      const name = lead.name?.trim() || 'there';
      const sent = await sendWhatsAppTemplate(
        lead.phone,
        body.templateName,
        template.language,
        [
          ...bodyParameters([name]),
          ...quickReplyParameters(template.buttons.map((_, index) => `customer_connect_${template.language}_${index}`)),
        ]
      );
      if (!sent) {
        return NextResponse.json({ error: 'WhatsApp could not send the template' }, { status: 502 });
      }
      entry = {
        direction: 'out',
        type: 'template',
        text: template.body(name),
        payload: {
          templateName: body.templateName,
          buttons: template.buttons.map((title) => ({ title })),
        },
      };
    } else {
      return NextResponse.json({ error: 'Choose a message or approved template' }, { status: 400 });
    }

    const saved = await Lead.findByIdAndUpdate(
      lead._id,
      {
        $push: {
          conversation: {
            $each: [{ ...entry, at: new Date() }],
            $slice: -500,
          },
        },
        $set: { lastActivityAt: new Date() },
      },
      { new: true, projection: { conversation: { $slice: -1 }, lastInboundMessageAt: 1 } }
    ).lean();
    const message = saved?.conversation?.[0];
    if (!message) {
      console.error(`[leads/conversation] Sent message could not be logged for lead ${id}`);
      return NextResponse.json({ error: 'Message sent but conversation history could not be updated' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: message,
      lastInboundMessageAt: saved.lastInboundMessageAt || null,
    });
  } catch (error) {
    console.error('[leads/conversation] send error:', error);
    return NextResponse.json({ error: 'Failed to send conversation message', message: error.message }, { status: 500 });
  }
}