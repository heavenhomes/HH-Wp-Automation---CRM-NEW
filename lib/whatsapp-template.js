import axios from 'axios';
import { getWhatsAppConfig, graphMessagesUrl } from '@/lib/whatsapp-config';

export const WHATSAPP_TEMPLATE_NAMES = {
  siteVisitReminder: 'site_visit_reminder',
  propertyFollowup: 'property_followup',
  postSiteVisitFollowup: 'post_site_visit_followup',
  customerConnectEnglish: 'customer_connect_request_english',
  customerConnectHindi: 'customer_connect_request_hindi',
  customerConnectGujarati: 'customer_connect_request_gujarati',
};

const LANGUAGE_TEMPLATE_NAMES = {
  [WHATSAPP_TEMPLATE_NAMES.postSiteVisitFollowup]: {
    gu: 'post_site_visit_followu',
  },
};

const TEMPLATE_LANGUAGES = {
  en: 'en',
  hi: 'hi',
  gu: 'gu',
};

export async function sendWhatsAppTemplate(to, name, language, components = []) {
  const { accessToken, phoneNumberId } = getWhatsAppConfig();
  if (!accessToken || !phoneNumberId) {
    console.error('[whatsapp-template] Missing WhatsApp env vars');
    return false;
  }

  const languageCode = TEMPLATE_LANGUAGES[language] || TEMPLATE_LANGUAGES.en;
  const templateName = LANGUAGE_TEMPLATE_NAMES[name]?.[language] || name;

  try {
    const response = await axios.post(
      graphMessagesUrl(phoneNumberId),
      {
        messaging_product: 'whatsapp',
        to,
        type: 'template',
        template: {
          name: templateName,
          language: { code: languageCode },
          ...(components.length ? { components } : {}),
        },
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );
    return response.status >= 200 && response.status < 300;
  } catch (error) {
    console.error(
      `[whatsapp-template] Failed to send ${templateName}:`,
      error.response?.data?.error?.message || error.message
    );
    return false;
  }
}

export async function sendWhatsAppText(to, text) {
  const { accessToken, phoneNumberId } = getWhatsAppConfig();
  if (!accessToken || !phoneNumberId) {
    console.error('[whatsapp-template] Missing WhatsApp env vars');
    return false;
  }

  try {
    const response = await axios.post(
      graphMessagesUrl(phoneNumberId),
      {
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { body: text, preview_url: false },
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );
    return response.status >= 200 && response.status < 300;
  } catch (error) {
    console.error(
      '[whatsapp-template] Failed to send text:',
      error.response?.data?.error?.message || error.message
    );
    return false;
  }
}

export function bodyParameters(values) {
  return [{
    type: 'body',
    parameters: values.map((text) => ({ type: 'text', text: String(text || '-') })),
  }];
}

export function quickReplyParameters(buttons) {
  return buttons.map((payload, index) => ({
    type: 'button',
    sub_type: 'quick_reply',
    index: String(index),
    parameters: [{ type: 'payload', payload }],
  }));
}
