"use client";
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import ImageGalleryModal from '@/components/Properties/ImageGalleryModal';
import TimePicker from '@/components/SiteVisits/TimePicker';
import { useAuth } from '@/lib/auth/useAuth';
import {
  createLocalDateTime,
  formatSiteVisitTime,
  localDateInput,
  siteVisitDateTimeParts,
} from '@/lib/site-visit-time';
import {
  ArrowLeft, Phone, MessageSquare,
  Star, Building2, Image as ImageIcon, Pencil,
  Bell, Calendar, UserRoundPen, Plus, X, Loader2, StickyNote,
} from 'lucide-react';

const TABS = [
  { id: 'enquiry', label: 'Property Enquiry', icon: Building2 },
  { id: 'interested', label: 'Interested Property', icon: Star },
  { id: 'conversation', label: 'WhatsApp Conversation', icon: MessageSquare },
  { id: 'followups', label: 'Follow Ups', icon: Bell },
  { id: 'visits', label: 'Site Visits', icon: Calendar },
  { id: 'notes', label: 'Add Note', icon: StickyNote },
];

const FORM_CLASSES = [
  { value: 'residential', label: 'Residential' },
  { value: 'commercial', label: 'Commercial' },
];
const FORM_CATEGORIES = [
  { value: 'purchase', label: 'Purchase' },
  { value: 'rent_lease', label: 'Rent / Lease' },
];
const FORM_SUBTYPES = {
  residential_buy: [['apartment', 'Apartment / Flat'], ['house', 'Independent House'], ['villa', 'Villa'], ['builder_floor', 'Builder Floor'], ['studio', 'Studio Apartment'], ['penthouse', 'Penthouse'], ['farmhouse', 'Farmhouse'], ['plot', 'Land / Plot']],
  commercial_buy: [['office', 'Office Space'], ['shop', 'Shop / Retail'], ['showroom', 'Showroom'], ['warehouse', 'Warehouse / Godown'], ['industrial', 'Industrial Land / Factory'], ['plot', 'Land / Plot'], ['coworking', 'Co-working Space']],
  residential_rent: [['apartment', 'Apartment / Flat'], ['house', 'Independent House'], ['villa', 'Villa'], ['builder_floor', 'Builder Floor'], ['bunglow', 'Bunglow'], ['pg', 'PG (Paying Guest)'], ['farmhouse', 'Farmhouse']],
  commercial_rent: [['office', 'Office Space'], ['shop', 'Shop / Retail'], ['showroom', 'Showroom'], ['warehouse', 'Warehouse / Godown'], ['industrial', 'Industrial Land / Factory'], ['coworking', 'Co-working Space']],
};
const FORM_BUY_BUDGETS = [['30L_50L', '₹30L – ₹50L'], ['50L_75L', '₹50L – ₹75L'], ['75L_1Cr', '₹75L – ₹1Cr'], ['above_1Cr', 'Above ₹1Cr']];
const FORM_RENT_BUDGETS = [['15k_25k', '💵 ₹15,000-₹25,000'], ['25k_35k', '💵 ₹25,000-₹35,000'], ['35k_50k', '💵 ₹35,000-₹50,000'], ['above_50k', '💎 Above ₹50,000']];
const FORM_RENT_BUDGET_RANGES = { '15k_25k': 'mid', '25k_35k': 'high', '35k_50k': 'luxury', above_50k: 'luxury' };
const FORM_BUYING_PLANS = [['immediately', 'Immediately'], ['within_1_month', 'Within 1 month'], ['1_3_months', '1–3 months'], ['3_6_months', '3–6 months'], ['just_exploring', 'Just exploring'], ['sell_existing_first', 'Need to sell my existing property first']];
const FORM_FURNISHING = [['unfurnished', 'Unfurnished'], ['semi_furnished', 'Semi-Furnished'], ['fully_furnished', 'Fully Furnished']];
const FORM_SETUP = [['bare_shell', 'Bare Shell'], ...FORM_FURNISHING];
const FORM_SIZES = [['upto_500', 'Up to 500 Sq.Ft.'], ['500_1000', '500–1,000 Sq.Ft.'], ['1000_2000', '1,000–2,000 Sq.Ft.'], ['2000_5000', '2,000–5,000 Sq.Ft.'], ['above_5000', 'Above 5,000 Sq.Ft.']];

const CRM_STATUSES = [
  { value: 'new', label: 'New' },
  { value: 'follow_up', label: 'Follow Up' },
  { value: 'active', label: 'Active' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'interested', label: 'Interested' },
  { value: 'site_visit_scheduled', label: 'Site Visit Scheduled' },
  { value: 'site_visit_completed', label: 'Site Visit Completed' },
  { value: 're_visit', label: 'Re-visit' },
  { value: 'lost', label: 'Lost' },
  { value: 'converted', label: 'Converted' },
];

// Format a JS Date to "3:45 PM" style
const formatTime12h = (dateInput) => {
  if (!dateInput) return '—';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
};

// Format date to "Mon, Sep 28, 2026"
const formatDate = (dateInput) => {
  if (!dateInput) return '—';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const formatDateTime = (dateInput) => {
  if (!dateInput) return '—';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
    hour12: true,
  });
};

// Format a JS Date to "Sep 28, 2026" (day group label)
const formatDayLabel = (dateInput) => {
  const d = new Date(dateInput);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  const sameDay = (a, b) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  if (sameDay(d, today)) return 'Today';
  if (sameDay(d, yesterday)) return 'Yesterday';
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

// Group conversation messages by calendar day
const groupByDay = (messages) => {
  const groups = [];
  let current = null;
  for (const m of messages) {
    const d = new Date(m.at);
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    if (!current || current.key !== key) {
      current = { key, date: d, items: [] };
      groups.push(current);
    }
    current.items.push(m);
  }
  return groups;
};

export default function LeadDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const [lead, setLead] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('enquiry');
  const [subData, setSubData] = useState({
    enquiry: [],
    interested: [],
    conversation: [],
    followUps: null,
    visits: [],
    notes: [],
  });
  const [subLoading, setSubLoading] = useState(false);
  const [selectedGallery, setSelectedGallery] = useState(null);
  const [personalInfoOpen, setPersonalInfoOpen] = useState(false);
  const [enquiryOpen, setEnquiryOpen] = useState(false);
  const [savingPersonalInfo, setSavingPersonalInfo] = useState(false);
  const [savingEnquiry, setSavingEnquiry] = useState(false);
  const [personalInfo, setPersonalInfo] = useState({ name: '', phone: '' });
  const [partnerOptions, setPartnerOptions] = useState([]);
  const [propertyOptions, setPropertyOptions] = useState([]);
  const [siteVisitOpen, setSiteVisitOpen] = useState(false);
  const [savingSiteVisit, setSavingSiteVisit] = useState(false);
  const [siteVisitForm, setSiteVisitForm] = useState({ propertyId: '', date: '', time: '', notes: '' });
  const [editingVisit, setEditingVisit] = useState(null);

  useEffect(() => {
    if (!user?.role) return;
    let cancelled = false;
    const fetchAvailableProperties = async () => {
      const fetchPage = async (page) => {
        const response = await fetch(`/api/properties?status=available&limit=200&page=${page}`);
        const json = await response.json();
        if (!response.ok || !json.success) throw new Error(json.error || 'Failed to load properties');
        return json;
      };
      const firstPage = await fetchPage(1);
      const remaining = await Promise.all(
        Array.from({ length: Math.max(0, (firstPage.pagination?.pages || 1) - 1) }, (_, index) =>
          fetchPage(index + 2)
        )
      );
      return [firstPage, ...remaining].flatMap((result) => result.data || []);
    };
    Promise.all([
      user.role === 'owner'
        ? fetch('/api/team-members?role=channel_partner&active=true&limit=500').then(async (response) => {
          const json = await response.json();
          if (!response.ok || !json.success) throw new Error(json.error || 'Failed to load channel partners');
          return json.data || [];
        })
        : Promise.resolve([]),
      fetchAvailableProperties(),
    ])
      .then(([partners, properties]) => {
        if (!cancelled) {
          setPartnerOptions(partners);
          setPropertyOptions(properties);
        }
      })
      .catch((error) => {
        console.error('[lead-detail] schedule options error:', error);
        if (!cancelled) toast.error(error.message || 'Failed to load schedule options');
      });
    return () => { cancelled = true; };
  }, [user?.role]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/leads/${params.id}`);
        const json = await res.json();
        if (json.success) setLead(json.data);
        else {
          toast.error('Lead not found');
          router.push('/leads');
        }
      } catch {
        toast.error('Failed to fetch lead');
      } finally {
        setLoading(false);
      }
    })();
  }, [params.id, router]);

  useEffect(() => {
    if (!lead) return;
    (async () => {
      setSubLoading(true);
      try {
        const endpointMap = {
          enquiry: `/api/leads/${lead._id}/enquiries`,
          interested: `/api/leads/${lead._id}/interests`,
          conversation: `/api/leads/${lead._id}/conversation`,
          followups: `/api/leads/${lead._id}/follow-ups`,
          visits: `/api/leads/${lead._id}/site-visits`,
          notes: `/api/leads/${lead._id}/notes`,
        };
        const key = activeTab;
        const url = endpointMap[key];

        const res = await fetch(url, { cache: 'no-store' });
        const json = await res.json();

        if (json.success) {
          if (key === 'followups') {
            setSubData((p) => ({ ...p, followUps: json.data }));
          } else {
            setSubData((p) => ({ ...p, [key]: json.data }));
          }
        }
      } catch (e) {
        console.error('[lead-detail] fetch error', e);
      } finally {
        setSubLoading(false);
      }
    })();
  }, [activeTab, lead]);

  const updateLead = async (patch) => {
    try {
      const res = await fetch(`/api/leads/${lead._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      const json = await res.json();
      if (json.success) {
        setLead(json.data);
        toast.success('Updated');
      } else toast.error(json.error || 'Failed to update');
    } catch {
      toast.error('Failed to update');
    }
  };

  const savePersonalInfo = async (event) => {
    event.preventDefault();
    setSavingPersonalInfo(true);
    try {
      const response = await fetch(`/api/leads/${lead._id}/personal-info`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(personalInfo),
      });
      const json = await response.json();
      if (!response.ok || !json.success) throw new Error(json.error || 'Failed to update personal information');
      setLead((previous) => ({ ...previous, ...json.data }));
      setPersonalInfoOpen(false);
      toast.success('Personal information updated');
    } catch (error) {
      toast.error(error.message || 'Failed to update personal information');
    } finally {
      setSavingPersonalInfo(false);
    }
  };

  const saveEnquiry = async (form) => {
    setSavingEnquiry(true);
    try {
      const response = await fetch(`/api/leads/${lead._id}/enquiries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const json = await response.json();
      if (!response.ok || !json.success) {
        throw new Error(json.details?.join(', ') || json.error || 'Failed to update enquiry');
      }
      setLead((previous) => ({ ...previous, ...json.data }));
      setEnquiryOpen(false);
      setActiveTab('enquiry');
      toast.success('Enquiry updated');
    } catch (error) {
      toast.error(error.message || 'Failed to update enquiry');
    } finally {
      setSavingEnquiry(false);
    }
  };

  const saveSiteVisit = async (event) => {
    event.preventDefault();
    const scheduledDate = createLocalDateTime(siteVisitForm.date, siteVisitForm.time);
    if (!scheduledDate || !siteVisitForm.propertyId) {
      toast.error('Select a valid date and time');
      return;
    }
    setSavingSiteVisit(true);
    try {
      const response = await fetch(`/api/leads/${lead._id}/site-visits`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertyId: siteVisitForm.propertyId,
          scheduledDate: scheduledDate.toISOString(),
          scheduledTime: formatSiteVisitTime(siteVisitForm.time),
          notes: siteVisitForm.notes,
        }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok || !json.success) throw new Error(json.error || 'Failed to schedule site visit');
      setSubData((previous) => ({
        ...previous,
        visits: [json.data, ...previous.visits.filter((visit) => visit._id !== json.data._id)],
      }));
      setSiteVisitOpen(false);
      setSiteVisitForm({ propertyId: '', date: '', time: '', notes: '' });
      setActiveTab('visits');
      setLead((previous) => ({ ...previous, currentStatus: 'site_visit_scheduled' }));
      toast.success('Site visit scheduled');
    } catch (error) {
      toast.error(error.message || 'Failed to schedule site visit');
    } finally {
      setSavingSiteVisit(false);
    }
  };

  const saveVisitEdit = async (event) => {
    event.preventDefault();
    if (!editingVisit) return;
    const scheduledDate = createLocalDateTime(editingVisit.date, editingVisit.time);
    if (!scheduledDate || !editingVisit.propertyId) {
      toast.error('Select a valid date and time');
      return;
    }
    setSavingSiteVisit(true);
    try {
      const response = await fetch(`/api/site-visits/${editingVisit._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertyId: editingVisit.propertyId,
          scheduledDate: scheduledDate.toISOString(),
          scheduledTime: formatSiteVisitTime(editingVisit.time),
          status: editingVisit.status,
          notes: editingVisit.notes,
        }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok || !json.success) throw new Error(json.error || 'Failed to update site visit');
      setSubData((previous) => ({
        ...previous,
        visits: previous.visits.map((visit) => visit._id === json.data._id ? json.data : visit),
      }));
      setEditingVisit(null);
      toast.success('Site visit updated');
    } catch (error) {
      toast.error(error.message || 'Failed to update site visit');
    } finally {
      setSavingSiteVisit(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#f8faf7]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-3 border-[#2d7a3a] border-t-transparent rounded-full animate-spin" />
          <p className="text-[#4f6b4f] text-sm font-medium">Loading lead...</p>
        </div>
      </div>
    );
  }

  if (!lead) return null;

  return (
    <div className="p-4 md:p-6 bg-[#f8faf7] min-h-screen">
      {selectedGallery && (
        <ImageGalleryModal
          images={selectedGallery.images}
          title={selectedGallery.title}
          onClose={() => setSelectedGallery(null)}
        />
      )}
      <div className="mb-6">
        <button
          onClick={() => router.push('/leads')}
          className="text-sm text-[#6a7f6a] hover:text-[#1a2e1a] mb-2 inline-flex items-center gap-1.5 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Leads
        </button>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-semibold text-[#1a2e1a] break-words">
            {lead.name || 'Lead'}
          </h1>
          <span className={`inline-flex px-2.5 py-1 text-xs font-medium rounded-full ${
            lead.source === 'manual'
              ? 'bg-[#fef7e0] text-[#b68b40]'
              : 'bg-[#e8f5e6] text-[#2d7a3a]'
          }`}>
            {lead.source === 'manual' ? 'Manual' : 'WhatsApp'}
          </span>
          </div>
          {['owner', 'channel_partner'].includes(user?.role) && (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setPersonalInfo({ name: lead.name || '', phone: lead.phone || '' });
                  setPersonalInfoOpen(true);
                }}
                className="inline-flex items-center gap-2 rounded-xl border border-[#d8e7d5] bg-white px-3 py-2 text-sm font-medium text-[#2d7a3a] hover:bg-[#f0f7ef]"
              >
                <UserRoundPen className="h-4 w-4" /> Edit Personal Info
              </button>
              <button
                type="button"
                onClick={() => setEnquiryOpen(true)}
                className="inline-flex items-center gap-2 rounded-xl bg-[#2d7a3a] px-3 py-2 text-sm font-medium text-white hover:bg-[#23682e]"
              >
                <Plus className="h-4 w-4" /> Add Inquiry
              </button>
              {['owner', 'channel_partner'].includes(user?.role) && (
                <button
                  type="button"
                  onClick={() => setSiteVisitOpen(true)}
                  className="inline-flex items-center gap-2 rounded-xl border border-[#d8e7d5] bg-white px-3 py-2 text-sm font-medium text-[#2d7a3a] hover:bg-[#f0f7ef]"
                >
                  <Calendar className="h-4 w-4" /> Schedule Site Visit
                </button>
              )}
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-2 text-sm text-[#4f6b4f]">
          <span className="flex items-center gap-1.5">
            <Phone className="w-3.5 h-3.5" /> {lead.phone}
          </span>
        </div>

        {personalInfoOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setPersonalInfoOpen(false)}>
            <form onSubmit={savePersonalInfo} className="w-[calc(100%-2rem)] max-w-md rounded-2xl bg-white shadow-xl" onClick={(event) => event.stopPropagation()}>
              <ModalHeader title="Edit Personal Info" onClose={() => setPersonalInfoOpen(false)} />
              <div className="space-y-4 p-5">
                <FormField label="Name">
                  <input required maxLength={200} value={personalInfo.name} onChange={(event) => setPersonalInfo((previous) => ({ ...previous, name: event.target.value }))} className={inputClass} />
                </FormField>
                <FormField label="Phone Number">
                  <input required type="tel" maxLength={50} value={personalInfo.phone} onChange={(event) => setPersonalInfo((previous) => ({ ...previous, phone: event.target.value }))} className={inputClass} />
                </FormField>
              </div>
              <ModalFooter onCancel={() => setPersonalInfoOpen(false)} saving={savingPersonalInfo} submitLabel="Save Personal Info" />
            </form>
          </div>
        )}

        {enquiryOpen && (
          <ManualEnquiryModal
            lead={lead}
            saving={savingEnquiry}
            onClose={() => setEnquiryOpen(false)}
            onSave={saveEnquiry}
          />
        )}
        {siteVisitOpen && (
          <SiteVisitModal
            title="Schedule Site Visit"
            form={siteVisitForm}
            properties={propertyOptions}
            saving={savingSiteVisit}
            onChange={setSiteVisitForm}
            onClose={() => setSiteVisitOpen(false)}
            onSubmit={saveSiteVisit}
          />
        )}
        {editingVisit && (
          <SiteVisitModal
            title="Edit Site Visit"
            form={editingVisit}
            properties={propertyOptions}
            saving={savingSiteVisit}
            editing
            onChange={setEditingVisit}
            onClose={() => setEditingVisit(null)}
            onSubmit={saveVisitEdit}
          />
        )}
      </div>

      {/* Info card */}
      <div className="bg-white rounded-2xl border border-[#e8f0e6] p-4 sm:p-5 shadow-sm mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          <Field label="Name" value={lead.name} />
          <Field label="Contact Number" value={lead.phone} />
          
          <Field label={user?.role === 'owner' ? 'Assign Channel Partner' : 'Channel Partner'}>
            {user?.role === 'owner' ? (
              <select
                value={lead.assignedTo || ''}
                onChange={(event) => updateLead({ assignedTo: event.target.value })}
                className="w-full px-2 py-1 border border-[#e8f0e6] rounded-lg text-sm bg-[#fafffa] focus:outline-none focus:border-[#2d7a3a]"
              >
                <option value="">Unassigned</option>
                {partnerOptions.map((partner) => (
                  <option key={partner._id} value={partner.name}>{partner.name}</option>
                ))}
              </select>
            ) : lead.assignedTo ? (
              <p className="text-sm font-medium text-[#1a2e1a] break-words">
                {lead.assignedTo}
              </p>
            ) : (
              <p className="text-sm text-[#6a7f6a] italic">Unassigned</p>
            )}
          </Field>
          <Field label="Current Status">
            <select
              value={lead.currentStatus || 'new'}
              onChange={(e) => updateLead({ currentStatus: e.target.value })}
              className="w-full px-2 py-1 border border-[#e8f0e6] rounded-lg text-sm bg-[#fafffa] focus:outline-none focus:border-[#2d7a3a]"
            >
              {CRM_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-2xl border border-[#e8f0e6] mb-4 shadow-sm overflow-hidden">
        <div className="flex border-b border-[#e8f0e6] overflow-x-auto">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`px-3 sm:px-4 md:px-6 py-3 text-xs sm:text-sm font-medium transition-colors whitespace-nowrap flex items-center gap-2 ${
                activeTab === id
                  ? 'text-[#2d7a3a] border-b-2 border-[#2d7a3a]'
                  : 'text-[#6a7f6a] hover:text-[#1a2e1a]'
              }`}
            >
              <Icon className="w-4 h-4" /> {label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="bg-white rounded-2xl border border-[#e8f0e6] shadow-sm p-4 md:p-6">
        {subLoading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-3 border-[#2d7a3a] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {activeTab === 'enquiry' && (
              <EnquiryTab enquiries={subData.enquiry} />
            )}
            {activeTab === 'interested' && (
              <InterestedTab
                interests={subData.interested}
                selectedProperty={lead.interested}
                onOpenGallery={(property) => {
                  const images = Array.isArray(property.images) ? property.images : [];
                  setSelectedGallery({
                    images: property.imageUrl
                      ? [property.imageUrl, ...images]
                      : images,
                    title: property.title || 'Property',
                  });
                }}
              />
            )}
            {activeTab === 'conversation' && (
              <ConversationTab conversation={subData.conversation} />
            )}
            {activeTab === 'followups' && (
              <FollowUpsTab data={subData.followUps} />
            )}
            {activeTab === 'visits' && (
              <VisitsTab
                visits={subData.visits}
                onEdit={(visit) => setEditingVisit({
                  ...visit,
                  date: localDateInput(visit.scheduledDate),
                  time: formatSiteVisitTime(visit.scheduledTime, visit.scheduledDate),
                  propertyId: String(visit.property?._id || visit.property || ''),
                })}
              />
            )}
            {activeTab === 'notes' && (
              <NotesTab
                leadId={lead._id}
                notes={subData.notes}
                onNotesChange={(notes) => setSubData((previous) => ({ ...previous, notes }))}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* ---------- Sub components ---------- */

function Field({ label, value, children }) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-medium text-[#6a7f6a] uppercase tracking-wider mb-1">
        {label}
      </p>
      {children || (
        <p className="text-sm font-medium text-[#1a2e1a] break-words">
          {value || '—'}
        </p>
      )}
    </div>
  );
}

const inputClass = 'w-full rounded-xl border border-[#e8f0e6] bg-[#fafffa] px-3 py-2 text-sm focus:border-[#2d7a3a] focus:outline-none focus:ring-2 focus:ring-[#2d7a3a]/20';

function ModalHeader({ title, onClose }) {
  return (
    <div className="flex items-center justify-between rounded-t-2xl border-b border-[#e8f0e6] bg-[#fafffa] px-5 py-4">
      <h2 className="text-base font-semibold text-[#1a2e1a]">{title}</h2>
      <button type="button" onClick={onClose} className="p-1 text-[#6a7f6a] hover:text-[#1a2e1a]" aria-label="Close dialog">
        <X className="h-5 w-5" />
      </button>
    </div>
  );
}

function ModalFooter({ onCancel, saving, submitLabel }) {
  return (
    <div className="flex flex-col-reverse gap-2 border-t border-[#e8f0e6] px-5 py-4 sm:flex-row sm:justify-end">
      <button type="button" onClick={onCancel} className="rounded-xl px-4 py-2 text-sm text-[#4f6b4f] hover:bg-[#f0f7ef]">Cancel</button>
      <button type="submit" disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#2d7a3a] px-4 py-2 text-sm font-medium text-white hover:bg-[#23682e] disabled:opacity-60">
        {saving && <Loader2 className="h-4 w-4 animate-spin" />}
        {saving ? 'Saving...' : submitLabel}
      </button>
    </div>
  );
}

function FormField({ label, children }) {
  return (
    <label className="block min-w-0">
      <span className="mb-1 block text-xs font-medium uppercase tracking-wider text-[#6a7f6a]">{label}</span>
      {children}
    </label>
  );
}

function ManualEnquiryModal({ lead, saving, onClose, onSave }) {
  const [areas, setAreas] = useState([]);
  const [properties, setProperties] = useState([]);
  const [form, setForm] = useState(() => {
    const purchaseType = ['residential_buy', 'commercial_buy', 'residential_rent', 'commercial_rent'].includes(lead.purchaseType)
      ? lead.purchaseType
      : '';
    const rentOption = FORM_RENT_BUDGETS.find(([, label]) => label === lead.rentBudgetLabel)?.[0] || '';
    const preferredVisit = siteVisitDateTimeParts(lead.siteVisit);
    return {
      area: lead.area === 'Not provided' ? '' : (lead.area || ''),
      propertyCategory: FORM_CATEGORIES.some((item) => item.value === lead.propertyCategory) ? lead.propertyCategory : '',
      purchaseType,
      propertySubType: lead.propertySubType || '',
      configuration: lead.propertyType === 'commercial' ? '' : (lead.configuration === 'Not provided' ? '' : (lead.configuration || '')),
      budgetRange: rentOption ? (FORM_RENT_BUDGET_RANGES[rentOption] || '') : (lead.budgetRange === 'Not provided' ? '' : (lead.budgetRange || '')),
      rentBudgetLabel: lead.rentBudgetLabel || '',
      timeline: lead.timeline || '',
      furnishing: lead.furnishing === 'Not provided' ? '' : (lead.furnishing || ''),
      investmentType: lead.investmentType === 'Not provided' ? '' : (lead.investmentType || ''),
      siteVisitDate: preferredVisit.date,
      siteVisitTime: preferredVisit.time,
      spaceSize: lead.spaceSize || '',
      interested: typeof lead.interested === 'object' && lead.interested ? lead.interested._id : (lead.interested || ''),
    };
  });
  const isCommercial = form.purchaseType.startsWith('commercial_');
  const isRent = form.purchaseType.endsWith('_rent');
  const propertyClass = form.purchaseType.startsWith('commercial') ? 'commercial' : 'residential';
  const subtypeOptions = FORM_SUBTYPES[`${propertyClass}_${isRent ? 'rent' : 'buy'}`] || [];
  const budgetOptions = isRent ? FORM_RENT_BUDGETS : FORM_BUY_BUDGETS;
  const chosenRentBudget = FORM_RENT_BUDGETS.find(([, label]) => label === form.rentBudgetLabel)?.[0] || '';
  const criteriaReady = Boolean(form.area && form.purchaseType && form.propertySubType && form.budgetRange &&
    (isCommercial || form.propertySubType === 'plot' || form.configuration) &&
    (!isRent || form.furnishing) && (isRent || form.investmentType) &&
    (!isCommercial || form.spaceSize));

  useEffect(() => {
    let cancelled = false;
    fetch('/api/properties?city=Surat&limit=200')
      .then(async (response) => {
        const json = await response.json();
        if (!response.ok || !json.success) throw new Error(json.error || 'Could not load areas');
        if (!cancelled) setAreas([...new Set((json.data || []).map((property) => property.area).filter(Boolean))].sort((a, b) => a.localeCompare(b)));
      })
      .catch((error) => {
        if (!cancelled) toast.error(error.message || 'Could not load areas');
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!criteriaReady) return;
    let cancelled = false;
    const params = new URLSearchParams({
      city: 'Surat',
      area: form.area,
      category: form.purchaseType,
      propertySubType: form.propertySubType,
      limit: '200',
    });
    if (form.configuration) params.set('configuration', form.configuration);
    fetch(`/api/properties?${params}`)
      .then(async (response) => {
        const json = await response.json();
        if (!response.ok || !json.success) throw new Error(json.error || 'Could not load matching properties');
        if (!cancelled) setProperties(json.data || []);
      })
      .catch((error) => {
        if (!cancelled) toast.error(error.message || 'Could not load matching properties');
      });
    return () => { cancelled = true; };
  }, [criteriaReady, form.area, form.purchaseType, form.propertySubType, form.configuration]);

  const updateForm = (key, value) => setForm((previous) => ({ ...previous, [key]: value }));
  const setCategory = (propertyCategory) => setForm((previous) => ({
    ...previous,
    propertyCategory,
    purchaseType: '',
    propertySubType: '',
    configuration: '',
    budgetRange: '',
    rentBudgetLabel: '',
    timeline: '',
    furnishing: '',
    investmentType: '',
    spaceSize: '',
    interested: '',
  }));
  const setClass = (value) => {
    const purchaseType = value ? `${value}${form.propertyCategory === 'purchase' ? '_buy' : '_rent'}` : '';
    setForm((previous) => ({
      ...previous,
      purchaseType,
      propertySubType: '',
      configuration: '',
      budgetRange: '',
      rentBudgetLabel: '',
      furnishing: '',
      investmentType: '',
      spaceSize: '',
      interested: '',
    }));
  };
  const setBudget = (value) => {
    if (isRent) {
      const labels = Object.fromEntries(FORM_RENT_BUDGETS);
      setForm((previous) => ({ ...previous, budgetRange: FORM_RENT_BUDGET_RANGES[value] || '', rentBudgetLabel: labels[value] || '' }));
    } else {
      updateForm('budgetRange', value);
    }
  };

  const submit = (event) => {
    event.preventDefault();
    if (!form.propertyCategory) return toast.error('Select a property category');
    if (!form.purchaseType) return toast.error('Select residential or commercial');
    if (!form.propertySubType) return toast.error('Select a property subtype');
    if (!form.budgetRange) return toast.error('Select a budget');
    if (!isCommercial && form.propertySubType !== 'plot' && !form.configuration) return toast.error('Select a configuration / BHK');
    if (isCommercial && !form.spaceSize) return toast.error('Select a commercial space size');
    if (isRent && !form.furnishing) return toast.error('Select a furnishing / setup preference');
    if (!isRent && !form.investmentType) return toast.error('Select a buying plan');
    onSave({
      ...form,
      siteVisit: createLocalDateTime(form.siteVisitDate, form.siteVisitTime)?.toISOString() || '',
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <form onSubmit={submit} className="max-h-[90vh] w-[calc(100%-2rem)] max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-xl" onClick={(event) => event.stopPropagation()}>
        <ModalHeader title="Add Inquiry" onClose={onClose} />
        <p className="px-5 pt-4 text-xs text-[#6a7f6a]">Update the lead&apos;s property requirements. Personal details are edited separately.</p>
        <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
          <FormField label="City">
            <select disabled value="Surat" className={`${inputClass} bg-gray-100`}><option>Surat</option></select>
          </FormField>
          <FormField label="Area">
            <select value={form.area} onChange={(event) => updateForm('area', event.target.value)} className={inputClass}>
              <option value="">Select area (optional)</option>
              {areas.map((area) => <option key={area} value={area}>{area}</option>)}
            </select>
          </FormField>
          <FormField label="Property Category">
            <select value={form.propertyCategory} onChange={(event) => setCategory(event.target.value)} className={inputClass}>
              <option value="">— Select —</option>
              {FORM_CATEGORIES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </FormField>
          {form.propertyCategory && (
            <FormField label={form.propertyCategory === 'purchase' ? 'Purchase Type' : 'Property Category'}>
              <select value={form.purchaseType ? propertyClass : ''} onChange={(event) => setClass(event.target.value)} className={inputClass}>
                <option value="">Select property class</option>
                {FORM_CLASSES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </FormField>
          )}
          {form.purchaseType && (
            <FormField label="Property Subtype">
              <select value={form.propertySubType} onChange={(event) => {
                const propertySubType = event.target.value;
                const defaultConfig = ['studio', 'pg'].includes(propertySubType) ? '1bhk' : ['villa', 'farmhouse', 'penthouse'].includes(propertySubType) ? '4bhk' : '2bhk';
                setForm((previous) => ({ ...previous, propertySubType, configuration: isCommercial || propertySubType === 'plot' ? '' : defaultConfig, budgetRange: '', rentBudgetLabel: '', interested: '' }));
              }} className={inputClass}>
                <option value="">Select subtype</option>
                {subtypeOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </FormField>
          )}
          {form.purchaseType && !isCommercial && form.propertySubType !== 'plot' && (
            <FormField label="Configuration / BHK">
              <select value={form.configuration} onChange={(event) => updateForm('configuration', event.target.value)} className={inputClass}>
                <option value="">Select configuration</option>
                {(isRent ? [['1bhk', '1 BHK'], ['2bhk', '2 BHK'], ['3bhk', '3 BHK'], ['4bhk', '4+ BHK']] : [['1bhk', '1 BHK'], ['2bhk', '2 BHK'], ['3bhk', '3 BHK'], ['4bhk', '4 BHK'], ['5bhk_plus', '5+ BHK'], ['duplex', 'Duplex']]).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </FormField>
          )}
          {form.purchaseType && form.propertySubType && (
            <FormField label="Budget">
              <select value={isRent ? chosenRentBudget : form.budgetRange} onChange={(event) => setBudget(event.target.value)} className={inputClass}>
                <option value="">Select budget</option>
                {budgetOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </FormField>
          )}
          {form.purchaseType?.endsWith('_buy') && (
            <FormField label="Buying Plan">
              <select value={form.investmentType} onChange={(event) => updateForm('investmentType', event.target.value)} className={inputClass}>
                <option value="">Select buying plan</option>
                {FORM_BUYING_PLANS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </FormField>
          )}
          {isCommercial && form.purchaseType && (
            <FormField label="Commercial Space Size">
              <select value={form.spaceSize} onChange={(event) => updateForm('spaceSize', event.target.value)} className={inputClass}>
                <option value="">Select size</option>
                {FORM_SIZES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </FormField>
          )}
          {isRent && (
            <FormField label="Furnishing / Setup">
              <select value={form.furnishing} onChange={(event) => updateForm('furnishing', event.target.value)} className={inputClass}>
                <option value="">Select furnishing</option>
                {(isCommercial ? FORM_SETUP : FORM_FURNISHING).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </FormField>
          )}
          {form.purchaseType && (
            <FormField label="Preferred Site Visit Date and Time (optional)">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <input
                  type="date"
                  value={form.siteVisitDate}
                  onChange={(event) => updateForm('siteVisitDate', event.target.value)}
                  className={inputClass}
                />
                <TimePicker
                  value={form.siteVisitTime}
                  onChange={(time) => updateForm('siteVisitTime', time)}
                />
              </div>
            </FormField>
          )}
          {criteriaReady && (
            <FormField label="Property (optional)">
              <select value={form.interested} onChange={(event) => updateForm('interested', event.target.value)} className={inputClass}>
                <option value="">Select property (optional)</option>
                {properties.map((property) => <option key={property._id} value={property._id}>{property.propertyId || 'Property'} - {property.internalName || property.title}</option>)}
              </select>
            </FormField>
          )}
        </div>
        <ModalFooter onCancel={onClose} saving={saving} submitLabel="Save Inquiry" />
      </form>
    </div>
  );
}

function NotesTab({ leadId, notes, onNotesChange }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState('');
  const [followUpDate, setFollowUpDate] = useState('');
  const [followUpHour, setFollowUpHour] = useState('09');
  const [followUpMinute, setFollowUpMinute] = useState('00');
  const [followUpPeriod, setFollowUpPeriod] = useState('AM');

  const submit = async (event) => {
    event.preventDefault();
    if (!note.trim()) return toast.error('Enter a note');
    if (!followUpDate) return toast.error('Select the next follow-up date');
    const hour = Number(followUpHour) % 12 + (followUpPeriod === 'PM' ? 12 : 0);
    const localDateTime = `${followUpDate}T${String(hour).padStart(2, '0')}:${followUpMinute}:00`;
    const nextFollowUpAt = new Date(localDateTime);
    if (!Number.isFinite(nextFollowUpAt.getTime())) return toast.error('Select a valid next follow-up date and time');
    setSaving(true);
    try {
      const response = await fetch(`/api/leads/${leadId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: note.trim(), nextFollowUpAt: nextFollowUpAt.toISOString() }),
      });
      const json = await response.json();
      if (!response.ok || !json.success) throw new Error(json.error || 'Failed to save note');
      onNotesChange(json.data);
      setNote('');
      setFollowUpDate('');
      setFollowUpHour('09');
      setFollowUpMinute('00');
      setFollowUpPeriod('AM');
      setModalOpen(false);
      toast.success('Note and reminder saved');
    } catch (error) {
      toast.error(error.message || 'Failed to save note');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-[#1a2e1a]">Notes & Manual Follow-ups</h2>
          <p className="mt-1 text-xs text-[#6a7f6a]">Reminders here are separate from automated follow-ups.</p>
        </div>
        <button type="button" onClick={() => setModalOpen(true)} className="inline-flex items-center gap-2 rounded-xl bg-[#2d7a3a] px-3 py-2 text-sm font-medium text-white hover:bg-[#23682e]">
          <Plus className="h-4 w-4" /> Add Note / Follow-up
        </button>
      </div>
      {!notes?.length ? (
        <Empty icon={StickyNote} text="No notes or manual follow-ups yet" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead>
              <tr className="border-b border-[#e8f0e6] bg-[#fafffa]">
                {['Date Created', 'Note', 'Next Follow-up'].map((label) => (
                  <th key={label} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[#6a7f6a]">{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {notes.map((entry) => (
                <tr key={entry._id} className="border-b border-[#eef5ec] align-top">
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-[#4f6b4f]">{formatDateTime(entry.createdAt)}</td>
                  <td className="whitespace-pre-wrap px-4 py-3 text-sm text-[#1a2e1a]">{entry.note}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-[#2d7a3a]">{formatDateTime(entry.nextFollowUpAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setModalOpen(false)}>
          <form onSubmit={submit} className="w-[calc(100%-2rem)] max-w-md rounded-2xl bg-white shadow-xl" onClick={(event) => event.stopPropagation()}>
            <ModalHeader title="Add Note / Follow-up" onClose={() => setModalOpen(false)} />
            <div className="space-y-4 p-5">
              <FormField label="Note">
                <textarea required maxLength={5000} rows={5} value={note} onChange={(event) => setNote(event.target.value)} className={`${inputClass} resize-y`} placeholder="Write a note for the owner or channel partner..." />
              </FormField>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField label="Next Follow-up Date">
                  <input required type="date" value={followUpDate} onChange={(event) => setFollowUpDate(event.target.value)} className={inputClass} />
                </FormField>
                <FormField label="Next Follow-up Time">
                  <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
                    <select aria-label="Follow-up hour" value={followUpHour} onChange={(event) => setFollowUpHour(event.target.value)} className={inputClass}>
                      {Array.from({ length: 12 }, (_, index) => String(index + 1).padStart(2, '0')).map((hour) => <option key={hour} value={hour}>{Number(hour)}</option>)}
                    </select>
                    <select aria-label="Follow-up minute" value={followUpMinute} onChange={(event) => setFollowUpMinute(event.target.value)} className={inputClass}>
                      {Array.from({ length: 60 }, (_, minute) => String(minute).padStart(2, '0')).map((minute) => <option key={minute} value={minute}>{minute}</option>)}
                    </select>
                    <select aria-label="AM or PM" value={followUpPeriod} onChange={(event) => setFollowUpPeriod(event.target.value)} className={inputClass}>
                      <option value="AM">AM</option>
                      <option value="PM">PM</option>
                    </select>
                  </div>
                </FormField>
              </div>
              <p className="text-xs text-[#6a7f6a]">A dashboard reminder appears two hours before this time.</p>
            </div>
            <ModalFooter onCancel={() => setModalOpen(false)} saving={saving} submitLabel="Save Note" />
          </form>
        </div>
      )}
    </div>
  );
}

function EnquiryTab({ enquiries }) {
  if (!enquiries?.length)
    return <Empty icon={Building2} text="No property enquiries yet" />;

  const sorted = [...enquiries].sort(
    (a, b) => new Date(b.submittedAt) - new Date(a.submittedAt)
  );

  return (
    <div className="space-y-5">
      {sorted.map((e, idx) => (
        <div
          key={e._id}
          className="rounded-2xl border-2 border-[#dbead8] bg-gradient-to-br from-[#fafffa] to-[#f0f7ef] p-4 sm:p-5 shadow-sm relative overflow-hidden"
        >
          {/* Left accent bar to visually distinguish each enquiry */}
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#2d7a3a]" />

          <div className="flex items-center justify-between mb-4 pl-3">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[#2d7a3a] text-white text-xs font-semibold">
                {idx + 1}
              </span>
              <span className="text-xs font-semibold text-[#2d7a3a] uppercase tracking-wider">
                Enquiry
              </span>
            </div>
            <p className="text-xs text-[#6a7f6a] font-medium">
              {new Date(e.submittedAt).toLocaleString('en-IN', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 pl-3">
            <Detail label="City" value={e.city} />
            <Detail label="Area" value={e.area} />
            <Detail label="Purpose" value={e.purpose} />
            <Detail label="Property Category" value={e.propertyCategory} />
            <Detail label="Property Type" value={e.propertyType} />
            <Detail
              label="Configuration / Size"
              value={e.configuration || e.size}
            />
            <Detail label="Budget" value={e.budgetLabel || e.budgetRange} />
            {e.purpose === 'Rent Out' && e.timeline && (
              <Detail label="Availability" value={e.timeline} />
            )}
            {e.buyingPlan && (
              <Detail
                label="Buying Plan"
                value={{
                  immediately: 'Immediately',
                  within_1_month: 'Within 1 month',
                  '1_3_months': '1–3 months',
                  '3_6_months': '3–6 months',
                  just_exploring: 'Just exploring',
                  sell_existing_first: 'Need to sell my existing property first',
                  buy_directly: 'Directly buy',
                  sell_then_buy: 'First sell then buy',
                }[e.buyingPlan] || e.buyingPlan.replace(/_/g, ' ')}
              />
            )}
            {e.furnishing && (
              <Detail
                label="Furnishing"
                value={e.furnishing.replace(/_/g, ' ')}
              />
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function InterestedTab({ interests, selectedProperty, onOpenGallery }) {
  const list = Array.isArray(interests) ? interests : [];
  const selectedPropertyId =
    typeof selectedProperty === 'object' && selectedProperty !== null
      ? selectedProperty._id
      : selectedProperty;
  const hasSelectedProperty = selectedProperty &&
    !list.some((interest) => {
      const propertyId =
        typeof interest.property === 'object' && interest.property !== null
          ? interest.property._id
          : interest.property;
      return String(propertyId) === String(selectedPropertyId);
    });
  const displayedInterests = hasSelectedProperty
    ? [{ _id: `selected-${selectedPropertyId}`, property: selectedProperty, manuallySelected: true }, ...list]
    : list;
  if (displayedInterests.length === 0) {
    return <Empty icon={Star} text="No interested properties yet" />;
  }

  return (
    <div className="space-y-3">
      {displayedInterests.map((it, idx) => {
        const p =
          typeof it.property === 'object' && it.property !== null
            ? it.property
            : null;
        const publicTitle = p?.title || it.propertyTitle || 'Property';
        const propertyId = p?.propertyId || it.propertySnapshot?.propertyId || '';
        const internalName =
          p?.internalName || it.propertySnapshot?.internalName || '';
        const city = p?.city || it.propertySnapshot?.city || '';
        const area = p?.area || it.propertySnapshot?.area || '';
        const price = p?.price || it.propertySnapshot?.price || 0;
        const image = p?.imageUrl || it.propertySnapshot?.imageUrl || null;
        const images = p?.images || it.propertySnapshot?.images || [];
        const galleryImages = image ? [image, ...images] : images;

        return (
          <div
            key={it._id || `int-${idx}`}
            className="min-w-0 overflow-hidden bg-white shadow-sm md:bg-transparent md:shadow-none border border-[#eef5ec] rounded-xl p-3 flex flex-col md:flex-row md:items-center gap-3 hover:bg-[#fafffa] transition-colors"
          >
            {image ? (
              <button
                type="button"
                onClick={() => onOpenGallery({
                  title: publicTitle,
                  imageUrl: image,
                  images: galleryImages,
                })}
                className="relative block overflow-hidden w-full md:w-20 md:h-20 flex-shrink-0 rounded-xl bg-[#f0f7ef] focus:outline-none focus:ring-2 focus:ring-[#2d7a3a]"
                aria-label={`View images for ${publicTitle}`}
              >
                {/* mobile only: blurred copy fills the empty bars around the full image */}
                <img
                  src={image}
                  alt=""
                  aria-hidden="true"
                  className="md:hidden absolute inset-0 w-full h-full object-cover scale-110 blur-xl opacity-60"
                />
                <img
                  src={image}
                  alt={publicTitle}
                  loading="lazy"
                  className="relative block w-full h-auto max-h-[75vh] object-contain rounded-xl md:absolute md:inset-0 md:h-full md:max-h-none md:border md:border-[#eef5ec]"
                />
                {galleryImages.length > 1 && (
                  <span className="md:hidden absolute bottom-2 right-2 flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-medium text-white">
                    <ImageIcon className="w-3 h-3" />
                    {galleryImages.length}
                  </span>
                )}
              </button>
            ) : (
              <div className="w-full aspect-[4/3] md:aspect-auto md:w-20 md:h-20 rounded-xl bg-[#f0f7ef] flex items-center justify-center flex-shrink-0 border border-[#eef5ec]">
                <ImageIcon className="w-6 h-6 text-[#6a7f6a]" />
              </div>
            )}

            <div className="flex-1 min-w-0">
              <div className="flex items-start md:items-center gap-2 mb-1">
                <Star className="w-3.5 h-3.5 mt-0.5 md:mt-0 text-[#f59e0b] fill-[#f59e0b] flex-shrink-0" />
                <span className="text-sm font-medium text-[#1a2e1a] break-words md:truncate">
                  {publicTitle}
                </span>
              </div>

              {propertyId && (
                <p className="text-xs text-[#6a7f6a] mb-1">{propertyId}</p>
              )}

              {internalName && (
                <p className="text-xs text-[#7a3aa8] bg-[#f3e8ff] inline-flex items-center gap-1 px-2 py-0.5 rounded mb-1">
                  <span className="font-medium">Private:</span> {internalName}
                </p>
              )}

              <p className="text-xs text-[#6a7f6a]">
                {city}
                {city && area ? ' • ' : ''}
                {area}
              </p>
              <p className="text-xs text-[#6a7f6a] mt-1">
                {it.manuallySelected
                  ? 'Selected for this lead'
                  : <>Expressed interest on{' '}
                {it.expressedAt
                  ? new Date(it.expressedAt).toLocaleDateString('en-IN', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })
                  : '—'}</>}
              </p>
            </div>

            <div className="text-left md:text-right md:flex-shrink-0">
              <p className="text-base md:text-sm font-semibold text-[#2d7a3a]">
                ₹{Number(price).toLocaleString('en-IN')}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ConversationTab({ conversation }) {
  if (!conversation?.length)
    return <Empty icon={MessageSquare} text="No conversation yet" />;

  const groups = groupByDay(conversation);

  return (
    <div className="max-h-[640px] overflow-y-auto pr-1 space-y-5">
      {groups.map((group) => (
        <div key={group.key}>
          {/* Date separator — centered like WhatsApp */}
          <div className="flex items-center justify-center my-3">
            <span className="px-3 py-1 text-[11px] font-medium text-[#6a7f6a] bg-[#f0f7ef] rounded-full border border-[#e8f0e6] shadow-sm">
              {formatDayLabel(group.date)}
            </span>
          </div>

          {/* Messages for this day — no date inside, only time */}
          <div className="space-y-1.5">
            {group.items.map((c) => (
              <div
                key={c._id}
                className={`flex ${
                  c.direction === 'in' ? 'justify-start' : 'justify-end'
                }`}
              >
                <div
                  className={`max-w-[85%] sm:max-w-[75%] rounded-2xl px-3 sm:px-4 py-2 ${
                    c.direction === 'in'
                      ? 'bg-[#f0f7ef] text-[#1a2e1a] border border-[#e8f0e6] rounded-tl-md'
                      : 'bg-[#2d7a3a] text-white rounded-tr-md'
                  }`}
                >
                  {c.type === 'image' ? (
                    c.imageUrl ? (
                      <img
                        src={c.imageUrl}
                        alt=""
                        className="rounded-lg max-w-full"
                      />
                    ) : (
                      <p className="text-sm italic">📷 Image</p>
                    )
                  ) : (
                    <p className="text-sm whitespace-pre-wrap break-words">
                      {c.text || '—'}
                    </p>
                  )}

                  {c.payload?.buttons && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {c.payload.buttons.map((b, i) => (
                        <span
                          key={i}
                          className={`text-xs px-2 py-0.5 rounded ${
                            c.direction === 'in'
                              ? 'bg-white/50'
                              : 'bg-white/20'
                          }`}
                        >
                          {b.title}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Time only — no date */}
                  <p
                    className={`text-[10px] mt-1 text-right ${
                      c.direction === 'in' ? 'text-[#6a7f6a]' : 'text-white/70'
                    }`}
                  >
                    {formatTime12h(c.at)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function FollowUpsTab({ data }) {
  if (!data) return <Empty icon={Bell} text="No follow-up data" />;

  const statusMap = {
    pending: { label: 'Pending', tone: 'bg-[#fef7e0] text-[#b68b40]' },
    sent: { label: 'Sent', tone: 'bg-[#e6f0fb] text-[#2a6ba8]' },
    responded: { label: 'Responded', tone: 'bg-[#e8f5e6] text-[#2d7a3a]' },
    converted: { label: 'Converted', tone: 'bg-[#e8f5e6] text-[#2d7a3a]' },
    unsubscribed: {
      label: 'Unsubscribed',
      tone: 'bg-[#fde8e8] text-[#c0392b]',
    },
  };
  const s = statusMap[data.status] || statusMap.pending;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SmallStat
          label="Status"
          value={
            <span
              className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${s.tone}`}
            >
              {s.label}
            </span>
          }
        />
        <SmallStat label="Follow-ups Sent" value={data.count || 0} />
        <SmallStat
          label="Last Sent"
          value={
            data.lastSentAt
              ? new Date(data.lastSentAt).toLocaleString('en-IN', {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : '—'
          }
        />
        <SmallStat label="Stuck At Step" value={data.stuckAtStep || '—'} />
      </div>

      {data.messages?.length > 0 && (
        <div>
          <p className="text-xs font-medium text-[#6a7f6a] uppercase tracking-wider mb-2">
            Follow-up History
          </p>
          <div className="space-y-2">
            {data.messages.map((m) => (
              <div
                key={m._id}
                className="border border-[#eef5ec] rounded-xl p-3 bg-[#fafffa]"
              >
                <p className="text-xs text-[#6a7f6a] mb-1">
                  {new Date(m.at).toLocaleString('en-IN')}
                </p>
                <p className="text-sm text-[#1a2e1a] whitespace-pre-wrap break-words">
                  {m.text}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- Site Visits — now a table ---------- */
function VisitsTab({ visits, onEdit }) {
  if (!visits?.length) return <Empty icon={Calendar} text="No site visits yet" />;

  return (
    <div className="overflow-x-auto -mx-4 md:mx-0">
      <table className="w-full min-w-[900px]">
        <thead>
          <tr className="bg-[#fafffa] border-b border-[#e8f0e6]">
            <th className="text-left px-4 py-3 text-xs font-medium text-[#6a7f6a] uppercase tracking-wider">
              Property
            </th>
            <th className="text-left px-4 py-3 text-xs font-medium text-[#6a7f6a] uppercase tracking-wider">
              Date &amp; Time
            </th>
            <th className="text-left px-4 py-3 text-xs font-medium text-[#6a7f6a] uppercase tracking-wider">
              Channel Partner
            </th>
            <th className="text-left px-4 py-3 text-xs font-medium text-[#6a7f6a] uppercase tracking-wider">
              Status
            </th>
            <th className="text-left px-4 py-3 text-xs font-medium text-[#6a7f6a] uppercase tracking-wider">
              Note
            </th>
            <th className="text-right px-4 py-3 text-xs font-medium text-[#6a7f6a] uppercase tracking-wider">
              Action
            </th>
          </tr>
        </thead>
        <tbody>
          {visits.map((v) => (
            <tr
              key={v._id}
              className="border-b border-[#eef5ec] hover:bg-[#fafffa] transition-colors"
            >
              <td className="px-4 py-3 text-sm text-[#1a2e1a]">
                {v.property?.title || v.propertyTitle || '—'}
              </td>
              <td className="px-4 py-3 text-sm text-[#4f6b4f]">
                <div>{formatDate(v.scheduledDate)}</div>
                <div className="text-xs text-[#6a7f6a]">{formatSiteVisitTime(v.scheduledTime, v.scheduledDate) || formatTime12h(v.scheduledDate)}</div>
              </td>
              <td className="px-4 py-3 text-sm text-[#4f6b4f]">
                {v.channelPartnerName || '—'}
              </td>
              <td className="px-4 py-3">
                <VisitStatusBadge status={v.status} />
              </td>
              <td className="px-4 py-3 text-sm text-[#4f6b4f] whitespace-pre-wrap">
                {v.notes || '—'}
              </td>
              <td className="px-4 py-3 text-right">
                <div className="inline-flex items-center gap-1.5">
                  <button
                    type="button"
                    aria-label="Edit site visit"
                    title="Edit site visit"
                    onClick={() => onEdit(v)}
                    className="rounded-lg border border-[#e8f0e6] p-2 text-[#2d7a3a] hover:bg-[#f0f7ef]"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SiteVisitModal({ title, form, properties, saving, editing, onChange, onClose, onSubmit }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <form
        onSubmit={onSubmit}
        className="w-[calc(100%-2rem)] max-w-md rounded-2xl bg-white shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <ModalHeader title={title} onClose={onClose} />
        <div className="space-y-4 p-5">
          <FormField label="Property">
            <select
              required
              value={form.propertyId || ''}
              onChange={(event) => onChange((previous) => ({ ...previous, propertyId: event.target.value }))}
              className={inputClass}
            >
              <option value="">Select a property</option>
              {properties.map((property) => (
                <option key={property._id} value={property._id}>
                  {property.title} · {property.propertyId}
                </option>
              ))}
            </select>
          </FormField>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormField label="Date">
              <input
                required
                type="date"
                value={form.date || ''}
                onChange={(event) => onChange((previous) => ({ ...previous, date: event.target.value }))}
                className={inputClass}
              />
            </FormField>
            <FormField label="Time">
              <TimePicker
                required
                value={form.time || ''}
                onChange={(time) => onChange((previous) => ({ ...previous, time }))}
              />
            </FormField>
          </div>
          {editing && (
            <FormField label="Site Visit Status">
              <select
                value={form.status || 'scheduled'}
                onChange={(event) => onChange((previous) => ({ ...previous, status: event.target.value }))}
                className={inputClass}
              >
                <option value="scheduled">Scheduled</option>
                <option value="pending">Pending</option>
                <option value="completed">Completed</option>
                <option value="rescheduled">Rescheduled</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </FormField>
          )}
          <FormField label={editing ? 'Additional Note' : 'Note'}>
            <textarea
              rows={3}
              maxLength={2000}
              value={form.notes || ''}
              onChange={(event) => onChange((previous) => ({ ...previous, notes: event.target.value }))}
              className={`${inputClass} resize-y`}
            />
          </FormField>
        </div>
        <ModalFooter
          onCancel={onClose}
          saving={saving}
          submitLabel={editing ? 'Save Changes' : 'Schedule Site Visit'}
        />
      </form>
    </div>
  );
}

function VisitStatusBadge({ status }) {
  const map = {
    scheduled: {
      bg: 'bg-[#e6f0fb]',
      text: 'text-[#2a6ba8]',
      dot: 'bg-[#2a6ba8]',
      label: 'Scheduled',
    },
    pending: {
      bg: 'bg-[#fef7e0]',
      text: 'text-[#b68b40]',
      dot: 'bg-[#b68b40]',
      label: 'Pending',
    },
    completed: {
      bg: 'bg-[#e8f5e6]',
      text: 'text-[#2d7a3a]',
      dot: 'bg-[#2d7a3a]',
      label: 'Completed',
    },
    rescheduled: {
      bg: 'bg-[#f3e8ff]',
      text: 'text-[#7a3aa8]',
      dot: 'bg-[#7a3aa8]',
      label: 'Rescheduled',
    },
    cancelled: {
      bg: 'bg-[#fde8e8]',
      text: 'text-[#c0392b]',
      dot: 'bg-[#c0392b]',
      label: 'Cancelled',
    },
  };
  const s = map[status] || map.pending;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium rounded-full whitespace-nowrap ${s.bg} ${s.text}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}

function Detail({ label, value }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-medium text-[#6a7f6a] uppercase tracking-wider">
        {label}
      </p>
      <p className="text-sm text-[#1a2e1a] mt-0.5 break-words">
        {value || '—'}
      </p>
    </div>
  );
}

function SmallStat({ label, value }) {
  return (
    <div className="bg-[#fafffa] border border-[#eef5ec] rounded-xl p-3 min-w-0">
      <p className="text-[10px] font-medium text-[#6a7f6a] uppercase tracking-wider mb-1">
        {label}
      </p>
      <div className="text-sm font-medium text-[#1a2e1a] break-words">
        {value}
      </div>
    </div>
  );
}

function Empty({ icon: Icon, text }) {
  return (
    <div className="text-center py-12">
      <Icon className="w-10 h-10 text-[#6a7f6a]/40 mx-auto mb-3" />
      <p className="text-sm text-[#6a7f6a]">{text}</p>
    </div>
  );
}