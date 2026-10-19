"use client";
import { useAuth } from '@/lib/auth/useAuth';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import TimePicker from '@/components/SiteVisits/TimePicker';
import {
  createLocalDateTime,
  formatSiteVisitTime,
  localDateInput,
} from '@/lib/site-visit-time';
import toast from 'react-hot-toast';
import {
  Calendar,
  Clock,
  CheckCircle,
  Search,
  Pencil,
  Trash2,
  Phone,
  FolderOpen,
  Plus,
} from 'lucide-react';

const STATUS_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'today', label: 'Today' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'pending', label: 'Pending' },
  { value: 'completed', label: 'Completed' },
  { value: 'rescheduled', label: 'Rescheduled' },
  { value: 'cancelled', label: 'Cancelled' },
];

export default function SiteVisitsPage() {
  const { isOwner } = useAuth();
  const router = useRouter();
  const [visits, setVisits] = useState([]);
  const [stats, setStats] = useState({ total: 0, today: 0, pending: 0, completed: 0 });
  const [loading, setLoading] = useState(true);
  const [activeStatus, setActiveStatus] = useState('today');
  const [search, setSearch] = useState('');
  const [filterProperty, setFilterProperty] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, pages: 1 });
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [addingVisit, setAddingVisit] = useState(false);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [savingNewVisit, setSavingNewVisit] = useState(false);
  const [leadOptions, setLeadOptions] = useState([]);
  const [propertyOptions, setPropertyOptions] = useState([]);
  const [newVisit, setNewVisit] = useState({ leadId: '', propertyId: '', date: '', time: '' });

  const fetchAllOptions = async (endpoint) => {
    const fetchPage = async (page) => {
      const response = await fetch(`${endpoint}&page=${page}`);
      const json = await response.json();
      if (!response.ok || !json.success) {
        throw new Error(json.error || 'Failed to load options');
      }
      return json;
    };

    const firstPage = await fetchPage(1);
    const remainingPages = await Promise.all(
      Array.from({ length: Math.max(0, (firstPage.pagination?.pages || 1) - 1) }, (_, index) =>
        fetchPage(index + 2)
      )
    );
    return [firstPage, ...remainingPages].flatMap((result) => result.data || []);
  };

  useEffect(() => {
    if (!addingVisit) return;

    let cancelled = false;
    setLoadingOptions(true);
    Promise.all([
      fetchAllOptions('/api/leads?limit=200'),
      fetchAllOptions('/api/properties?status=available&limit=200'),
    ])
      .then(([leads, properties]) => {
        if (!cancelled) {
          setLeadOptions(leads);
          setPropertyOptions(properties);
        }
      })
      .catch((error) => {
        console.error('[site-visits] option fetch error:', error);
        if (!cancelled) toast.error(error.message || 'Failed to load leads and properties');
      })
      .finally(() => {
        if (!cancelled) setLoadingOptions(false);
      });

    return () => {
      cancelled = true;
    };
  }, [addingVisit]);

  useEffect(() => {
    let cancelled = false;
    fetchAllOptions('/api/properties?status=available&limit=200')
      .then((properties) => {
        if (!cancelled) setPropertyOptions(properties);
      })
      .catch((error) => {
        console.error('[site-visits] property filter options error:', error);
        if (!cancelled) toast.error(error.message || 'Failed to load properties');
      });
    return () => { cancelled = true; };
  }, []);

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/site-visits/stats');
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.success) {
        setStats(json.data);
      } else {
        console.warn('[site-visits] stats API returned failure:', json);
      }
    } catch (err) {
      console.error('[site-visits] stats fetch error:', err);
    }
  };

  const fetchVisits = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        status: activeStatus === 'today' ? 'all' : activeStatus,
        page: String(page),
        limit: '20',
      });
      const trimmedSearch = search.trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(trimmedSearch)) {
        params.set('scheduledDate', trimmedSearch);
        params.set('timezoneOffset', String(new Date().getTimezoneOffset()));
      } else if (trimmedSearch) {
        params.set('search', trimmedSearch);
      }
      if (filterProperty) params.set('propertyId', filterProperty);
      if (activeStatus === 'today' && !/^\d{4}-\d{2}-\d{2}$/.test(trimmedSearch)) {
        const now = new Date();
        const dateKey = [
          now.getFullYear(),
          String(now.getMonth() + 1).padStart(2, '0'),
          String(now.getDate()).padStart(2, '0'),
        ].join('-');
        params.set('date', 'today');
        params.set('dateKey', dateKey);
        params.set('timezoneOffset', String(now.getTimezoneOffset()));
      }
      const res = await fetch(`/api/site-visits?${params}`);
      const json = await res.json();
      if (json.success) {
        setVisits(json.data);
        setPagination(json.pagination);
      } else {
        toast.error('Failed to fetch site visits');
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to fetch site visits');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  useEffect(() => {
    fetchVisits();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeStatus, page, search, filterProperty]);

  const handleDelete = async (id) => {
    if (!confirm('Delete this site visit?')) return;
    try {
      const res = await fetch(`/api/site-visits/${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Site visit deleted');
        setVisits((prev) => prev.filter((v) => v._id !== id));
        fetchStats();
      } else {
        toast.error('Failed to delete');
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to delete');
    }
  };

  const handleSaveEdit = async () => {
    if (!editing) return;
    if (!editing.propertyId) {
      toast.error('Select a property');
      return;
    }
    const visitDate = createLocalDateTime(editing.scheduledDate, editing.scheduledTimeInput);
    if (!visitDate) {
      toast.error('Select a valid date and time');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/site-visits/${editing._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scheduledDate: visitDate.toISOString(),
          scheduledTime: formatSiteVisitTime(editing.scheduledTimeInput),
          propertyId: editing.propertyId,
          status: editing.status,
          notes: editing.notes,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok) {
        toast.success('Site visit updated');
        setEditing(null);
        fetchVisits();
        fetchStats();
      } else {
        toast.error(json.error || 'Failed to update');
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to update');
    } finally {
      setSaving(false);
    }
  };

  const handleAddVisit = async (event) => {
    event.preventDefault();
    const visitDate = createLocalDateTime(newVisit.date, newVisit.time);
    if (!visitDate) {
      toast.error('Select a valid date and time');
      return;
    }

    setSavingNewVisit(true);
    try {
      const response = await fetch('/api/site-visits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId: newVisit.leadId,
          propertyId: newVisit.propertyId,
          scheduledDate: visitDate.toISOString(),
          scheduledTime: formatSiteVisitTime(newVisit.time),
        }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok || !json.success) {
        throw new Error(json.error || 'Failed to add site visit');
      }

      toast.success('Site visit added');
      setAddingVisit(false);
      setNewVisit({ leadId: '', propertyId: '', date: '', time: '' });
      fetchVisits();
      fetchStats();
    } catch (error) {
      console.error('[site-visits] create error:', error);
      toast.error(error.message || 'Failed to add site visit');
    } finally {
      setSavingNewVisit(false);
    }
  };

  const renderDateCell = (v) => {
    if (v.scheduledDate)
      return new Date(v.scheduledDate).toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    return 'N/A';
  };

  const renderTimeCell = (v) => {
    if (v.scheduledTime) {
      const formatted = formatSiteVisitTime(v.scheduledTime, v.scheduledDate);
      if (formatted) return formatted;
    }
    if (v.scheduledDate)
      return new Date(v.scheduledDate).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
    return '—';
  };

  return (
    <div className="p-4 md:p-6 bg-[#f8faf7] min-h-screen">
      {/* Page Header */}
      <div className="mb-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-semibold text-[#1a2e1a] flex items-center gap-2">
              <span className="w-2 h-7 sm:h-8 bg-[#2d7a3a] rounded-full mr-2 flex-shrink-0" />
              Site Visit Management
            </h1>
            <p className="text-sm text-[#4f6b4f] mt-1 ml-4">
              Track and manage all property site visits
            </p>
          </div>
          {isOwner && (
            <button
              type="button"
              onClick={() => setAddingVisit(true)}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-[#2d7a3a] hover:bg-[#23682e] rounded-xl shadow-sm transition-colors w-fit"
            >
              <Plus className="w-4 h-4" />
              Add Site Visit
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div
        className="mb-6"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: '0.75rem',
        }}
      >
        <KpiCard icon={Calendar} label="Today's Site Visits" value={stats.today} tone="blue" onClick={() => { setActiveStatus('today'); setPage(1); }} active={activeStatus === 'today'} />
        <KpiCard icon={Clock} label="Pending Site Visits" value={stats.pending} tone="amber" onClick={() => { setActiveStatus('pending'); setPage(1); }} active={activeStatus === 'pending'} />
        <KpiCard icon={CheckCircle} label="Completed Site Visits" value={stats.completed} tone="green" onClick={() => { setActiveStatus('completed'); setPage(1); }} active={activeStatus === 'completed'} />
      </div>

      {/* Tabs + Search */}
      <div className="bg-white rounded-2xl border border-[#e8f0e6] p-3 sm:p-4 mb-6 shadow-sm">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="relative min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6a7f6a]" />
            <input
              type="text"
              placeholder="Search by lead, phone, or date (YYYY-MM-DD)..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full pl-9 pr-3 py-2 border border-[#e8f0e6] rounded-xl text-sm bg-[#fafffa] focus:outline-none focus:ring-2 focus:ring-[#2d7a3a]/20 focus:border-[#2d7a3a]"
            />
          </div>
          <select
            value={filterProperty}
            onChange={(event) => { setFilterProperty(event.target.value); setPage(1); }}
            className="w-full min-w-0 px-3 py-2 border border-[#e8f0e6] rounded-xl text-sm bg-[#fafffa] focus:outline-none focus:ring-2 focus:ring-[#2d7a3a]/20 focus:border-[#2d7a3a]"
          >
            <option value="">All active properties</option>
            {propertyOptions.map((property) => (
              <option key={property._id} value={property._id}>
                {property.title} · {property.propertyId}
              </option>
            ))}
          </select>
          <select
            aria-label="Filter site visits by status"
            value={activeStatus}
            onChange={(event) => { setActiveStatus(event.target.value); setPage(1); }}
            className="w-full min-w-0 px-3 py-2 border border-[#e8f0e6] rounded-xl text-sm bg-[#fafffa] focus:outline-none focus:ring-2 focus:ring-[#2d7a3a]/20 focus:border-[#2d7a3a]"
          >
            {STATUS_FILTERS.map(({ value, label }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table Card */}
      <div className="bg-white rounded-2xl border border-[#e8f0e6] overflow-hidden shadow-sm">
        {/* ---------- Desktop table ---------- */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full min-w-[1000px]">
            <thead>
              <tr className="bg-[#fafffa]">
                <th className="text-left px-5 py-3 text-xs font-medium text-[#6a7f6a] uppercase tracking-wider">Lead Name</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-[#6a7f6a] uppercase tracking-wider">Property Name</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-[#6a7f6a] uppercase tracking-wider">Date &amp; Time</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-[#6a7f6a] uppercase tracking-wider">Assigned Channel Partner</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-[#6a7f6a] uppercase tracking-wider">Status</th>
                <th className="text-right px-5 py-3 text-xs font-medium text-[#6a7f6a] uppercase tracking-wider">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr className="border-t border-[#eef5ec]">
                  <td colSpan={6} className="text-center py-12">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-8 h-8 border-3 border-[#2d7a3a] border-t-transparent rounded-full animate-spin" />
                      <p className="text-sm text-[#6a7f6a]">Loading site visits...</p>
                    </div>
                  </td>
                </tr>
              ) : visits.length === 0 ? (
                <tr className="border-t border-[#eef5ec]">
                  <td colSpan={6} className="text-center py-12 text-[#6a7f6a] text-sm">
                    <FolderOpen className="w-5 h-5 inline-block mr-2 mb-0.5" />
                    No site visits found
                  </td>
                </tr>
              ) : (
                visits.map((v) => (
                  <tr
                    key={v._id}
                    onClick={() => router.push(`/leads/${v.lead}`)}
                    className="border-t border-[#eef5ec] hover:bg-[#fafffa] transition-colors cursor-pointer"
                  >
                    <td className="px-5 py-3">
                      <p className="text-sm font-medium text-[#1a2e1a]">{v.leadName || 'Unknown'}</p>
                      <p className="text-xs text-[#6a7f6a] flex items-center gap-1 mt-0.5">
                        <Phone className="w-3 h-3" /> {v.leadPhone || '—'}
                      </p>
                    </td>
                    <td className="px-5 py-3">
                      <p className="text-sm text-[#1a2e1a]">{v.propertyTitle || 'N/A'}</p>
                      {v.propertyCode && (
                        <code className="text-xs font-mono text-[#6a7f6a]">{v.propertyCode}</code>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <p className="text-sm text-[#4f6b4f]">{renderDateCell(v)}</p>
                      <p className="text-xs text-[#6a7f6a] flex items-center gap-1 mt-0.5">
                        <Clock className="w-3 h-3" /> {renderTimeCell(v)}
                      </p>
                    </td>
                    <td className="px-5 py-3">
                      <span className="text-sm text-[#4f6b4f]">
                        {v.channelPartnerName || <span className="text-[#6a7f6a]">Not assigned</span>}
                      </span>
                    </td>
                    <td className="px-5 py-3"><StatusBadge status={v.status} /></td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={(event) => {
                            event.stopPropagation();
                            setEditing({
                              ...v,
                              scheduledDate: v.scheduledDate ? localDateInput(v.scheduledDate) : '',
                              scheduledTimeInput: formatSiteVisitTime(v.scheduledTime, v.scheduledDate),
                              propertyId: String(v.property || ''),
                            });
                          }}
                          title="Edit"
                          className="p-1.5 rounded-lg border border-[#e8f0e6] hover:bg-[#f0f7ef] hover:border-[#2d7a3a] transition-colors group"
                        >
                          <Pencil className="w-3.5 h-3.5 text-[#6a7f6a] group-hover:text-[#2d7a3a]" />
                        </button>
                        {isOwner && (
                          <button
                            onClick={(event) => { event.stopPropagation(); handleDelete(v._id); }}
                            title="Delete"
                            className="p-1.5 rounded-lg border border-[#e8f0e6] hover:bg-[#fde8e8] hover:border-[#c0392b] transition-colors group"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-[#6a7f6a] group-hover:text-[#c0392b]" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* ---------- Mobile cards ---------- */}
        <div className="md:hidden divide-y divide-[#eef5ec]">
          {loading ? (
            <div className="text-center py-12">
              <div className="w-8 h-8 border-3 border-[#2d7a3a] border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-sm text-[#6a7f6a] mt-3">Loading site visits...</p>
            </div>
          ) : visits.length === 0 ? (
            <div className="text-center py-12 text-[#6a7f6a] text-sm">
              <FolderOpen className="w-5 h-5 inline-block mr-2 mb-0.5" />
              No site visits found
            </div>
          ) : (
            visits.map((v) => (
              <div
                key={v._id}
                role="link"
                tabIndex={0}
                onClick={() => router.push(`/leads/${v.lead}`)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') router.push(`/leads/${v.lead}`);
                }}
                className="p-4 space-y-2.5 cursor-pointer hover:bg-[#fafffa]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <button
                      type="button"
                      onClick={() => router.push(`/leads/${v.lead}`)}
                      className="text-left text-sm font-semibold text-[#1a2e1a] truncate hover:text-[#2d7a3a]"
                    >
                      {v.leadName || 'Unknown'}
                    </button>
                    <p className="text-xs text-[#6a7f6a] flex items-center gap-1 mt-0.5">
                      <Phone className="w-3 h-3" /> {v.leadPhone || '—'}
                    </p>
                  </div>
                  <StatusBadge status={v.status} />
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="min-w-0">
                    <p className="text-[#6a7f6a] uppercase tracking-wider text-[10px]">Property</p>
                    <p className="text-[#1a2e1a] mt-0.5 truncate">{v.propertyTitle || 'N/A'}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[#6a7f6a] uppercase tracking-wider text-[10px]">Date</p>
                    <p className="text-[#1a2e1a] mt-0.5 truncate">{renderDateCell(v)}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[#6a7f6a] uppercase tracking-wider text-[10px]">Partner</p>
                    <p className="text-[#1a2e1a] mt-0.5 truncate">
                      {v.channelPartnerName || 'Not assigned'}
                    </p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[#6a7f6a] uppercase tracking-wider text-[10px]">Time</p>
                    <p className="text-[#1a2e1a] mt-0.5 truncate">{renderTimeCell(v)}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-[#eef5ec]">
                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      setEditing({
                        ...v,
                        scheduledDate: v.scheduledDate ? localDateInput(v.scheduledDate) : '',
                        scheduledTimeInput: formatSiteVisitTime(v.scheduledTime, v.scheduledDate),
                        propertyId: String(v.property || ''),
                      });
                    }}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 text-xs font-medium text-[#2d7a3a] bg-[#e8f5e6] rounded-lg"
                  >
                    <Pencil className="w-3.5 h-3.5" /> Edit
                  </button>
                  {isOwner && (
                    <button
                      onClick={(event) => { event.stopPropagation(); handleDelete(v._id); }}
                      className="p-2 text-[#c0392b] bg-[#fde8e8] rounded-lg"
                      aria-label="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div className="px-3 sm:px-5 py-4 border-t border-[#e8f0e6] bg-[#fafffa] flex items-center justify-between gap-2">
            <span className="text-xs text-[#6a7f6a]">
              Page {page} of {pagination.pages}
            </span>
            <div className="flex gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="px-3 py-1.5 text-sm border border-[#e8f0e6] rounded-lg hover:bg-[#f0f7ef] disabled:opacity-40 transition-colors"
              >
                Previous
              </button>
              <button
                disabled={page >= pagination.pages}
                onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1.5 text-sm border border-[#e8f0e6] rounded-lg hover:bg-[#f0f7ef] disabled:opacity-40 transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Edit Modal — bottom sheet on mobile */}
      {editing && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)', backdropFilter: 'blur(4px)' }}
          onClick={() => setEditing(null)}
        >
          <div
            className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-[480px] max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 sm:px-6 py-4 border-b border-[#e8f0e6] bg-[#fafffa] flex items-center justify-between rounded-t-2xl sticky top-0 z-10">
              <h3 className="text-base font-semibold text-[#1a2e1a]">Edit Site Visit</h3>
              <button onClick={() => setEditing(null)} className="text-[#6a7f6a] hover:text-[#1a2e1a] text-xl leading-none px-2">
                ✕
              </button>
            </div>

            <div className="p-5 sm:p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Date">
                  <input
                    type="date"
                    value={editing.scheduledDate || ''}
                    onChange={(e) => setEditing((p) => ({ ...p, scheduledDate: e.target.value }))}
                    className="w-full px-3 py-2 border border-[#e8f0e6] rounded-xl text-sm bg-[#fafffa] focus:outline-none focus:ring-2 focus:ring-[#2d7a3a]/20 focus:border-[#2d7a3a]"
                  />
                </Field>
                <Field label="Time">
                  <TimePicker
                    required
                    value={editing.scheduledTimeInput || ''}
                    onChange={(time) => setEditing((p) => ({ ...p, scheduledTimeInput: time }))}
                  />
                </Field>
              </div>

              <Field label="Property">
                <select
                  value={editing.propertyId || ''}
                  onChange={(event) => setEditing((previous) => ({ ...previous, propertyId: event.target.value }))}
                  className="w-full px-3 py-2 border border-[#e8f0e6] rounded-xl text-sm bg-[#fafffa] focus:outline-none focus:ring-2 focus:ring-[#2d7a3a]/20 focus:border-[#2d7a3a]"
                >
                  <option value="">Select an active property</option>
                  {propertyOptions.map((property) => (
                    <option key={property._id} value={property._id}>
                      {property.title} · {property.propertyId}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Channel Partner">
                <div className="w-full px-3 py-2 border border-[#e8f0e6] rounded-xl text-sm bg-[#f0f7ef] text-[#4f6b4f]">
                  {editing.channelPartnerName || (
                    <span className="text-[#6a7f6a] italic">Not assigned</span>
                  )}
                </div>
                <p className="text-[10px] text-[#6a7f6a] mt-1 uppercase tracking-wider">
                  Change via Lead Assignment page
                </p>
              </Field>

              <Field label="Status">
                <select
                  value={editing.status}
                  onChange={(e) => setEditing((p) => ({ ...p, status: e.target.value }))}
                  className="w-full px-3 py-2 border border-[#e8f0e6] rounded-xl text-sm bg-[#fafffa] focus:outline-none focus:ring-2 focus:ring-[#2d7a3a]/20 focus:border-[#2d7a3a]"
                >
                  <option value="scheduled">Scheduled</option>
                  <option value="pending">Pending</option>
                  <option value="completed">Completed</option>
                  <option value="rescheduled">Rescheduled</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </Field>

              <Field label="Notes">
                <textarea
                  rows={3}
                  value={editing.notes || ''}
                  onChange={(e) => setEditing((p) => ({ ...p, notes: e.target.value }))}
                  className="w-full px-3 py-2 border border-[#e8f0e6] rounded-xl text-sm bg-[#fafffa] focus:outline-none focus:ring-2 focus:ring-[#2d7a3a]/20 focus:border-[#2d7a3a]"
                />
              </Field>
            </div>

            <div className="px-5 sm:px-6 py-4 border-t border-[#e8f0e6] flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
              <button
                onClick={() => setEditing(null)}
                className="w-full sm:w-auto px-4 py-2 text-sm text-[#4f6b4f] hover:bg-[#f0f7ef] rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={saving}
                className="w-full sm:w-auto px-4 py-2 bg-[#2d7a3a] hover:bg-[#23682e] text-white text-sm font-medium rounded-xl transition-colors disabled:opacity-60"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {isOwner && addingVisit && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)', backdropFilter: 'blur(4px)' }}
          onClick={() => !savingNewVisit && setAddingVisit(false)}
        >
          <form
            onSubmit={handleAddVisit}
            className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-[480px] max-h-[90vh] overflow-y-auto"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="px-5 sm:px-6 py-4 border-b border-[#e8f0e6] bg-[#fafffa] flex items-center justify-between rounded-t-2xl sticky top-0 z-10">
              <h3 className="text-base font-semibold text-[#1a2e1a]">Add Manual Site Visit</h3>
              <button
                type="button"
                onClick={() => setAddingVisit(false)}
                disabled={savingNewVisit}
                aria-label="Close"
                className="text-[#6a7f6a] hover:text-[#1a2e1a] text-xl leading-none px-2 disabled:opacity-50"
              >
                ✕
              </button>
            </div>

            <div className="p-5 sm:p-6 space-y-4">
              <Field label="Lead Name">
                <select
                  required
                  value={newVisit.leadId}
                  onChange={(event) => setNewVisit((current) => ({ ...current, leadId: event.target.value }))}
                  disabled={loadingOptions || savingNewVisit}
                  className="w-full px-3 py-2 border border-[#e8f0e6] rounded-xl text-sm bg-[#fafffa] focus:outline-none focus:ring-2 focus:ring-[#2d7a3a]/20 focus:border-[#2d7a3a] disabled:opacity-60"
                >
                  <option value="">{loadingOptions ? 'Loading leads...' : 'Select a lead'}</option>
                  {leadOptions.map((lead) => (
                    <option key={lead._id} value={lead._id}>
                      {lead.name || 'Unnamed lead'}{lead.phone ? ` · ${lead.phone}` : ''}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Property">
                <select
                  required
                  value={newVisit.propertyId}
                  onChange={(event) => setNewVisit((current) => ({ ...current, propertyId: event.target.value }))}
                  disabled={loadingOptions || savingNewVisit}
                  className="w-full px-3 py-2 border border-[#e8f0e6] rounded-xl text-sm bg-[#fafffa] focus:outline-none focus:ring-2 focus:ring-[#2d7a3a]/20 focus:border-[#2d7a3a] disabled:opacity-60"
                >
                  <option value="">{loadingOptions ? 'Loading properties...' : 'Select a property'}</option>
                  {propertyOptions.map((property) => (
                    <option key={property._id} value={property._id}>
                      {property.title}{property.propertyId ? ` · ${property.propertyId}` : ''}
                    </option>
                  ))}
                </select>
              </Field>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Date">
                  <input
                    type="date"
                    required
                    value={newVisit.date}
                    onChange={(event) => setNewVisit((current) => ({ ...current, date: event.target.value }))}
                    disabled={savingNewVisit}
                    className="w-full px-3 py-2 border border-[#e8f0e6] rounded-xl text-sm bg-[#fafffa] focus:outline-none focus:ring-2 focus:ring-[#2d7a3a]/20 focus:border-[#2d7a3a]"
                  />
                </Field>
                <Field label="Time">
                  <TimePicker
                    required
                    value={newVisit.time}
                    onChange={(time) => setNewVisit((current) => ({ ...current, time }))}
                    disabled={savingNewVisit}
                  />
                </Field>
              </div>
            </div>

            <div className="px-5 sm:px-6 py-4 border-t border-[#e8f0e6] flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
              <button
                type="button"
                onClick={() => setAddingVisit(false)}
                disabled={savingNewVisit}
                className="w-full sm:w-auto px-4 py-2 text-sm text-[#4f6b4f] hover:bg-[#f0f7ef] rounded-xl transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingNewVisit || loadingOptions}
                className="w-full sm:w-auto px-4 py-2 bg-[#2d7a3a] hover:bg-[#23682e] text-white text-sm font-medium rounded-xl transition-colors disabled:opacity-60"
              >
                {savingNewVisit ? 'Saving...' : 'Save Site Visit'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

/* -------------------- Small components -------------------- */

function KpiCard({ icon: Icon, label, value, tone, onClick, active }) {
  const tones = {
    blue:  { bg: 'bg-[#e6f0fb]', fg: 'text-[#2a6ba8]' },
    amber: { bg: 'bg-[#fef7e0]', fg: 'text-[#b68b40]' },
    green: { bg: 'bg-[#e8f5e6]', fg: 'text-[#2d7a3a]' },
  };
  const t = tones[tone] || tones.green;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`w-full text-left bg-white rounded-2xl border p-4 sm:p-5 shadow-sm hover:shadow-md transition-shadow ${
        active ? 'border-[#2d7a3a] ring-2 ring-[#2d7a3a]/15' : 'border-[#e8f0e6]'
      }`}
    >
      <div className="flex items-center gap-3 sm:gap-4">
        <div className={`w-10 h-10 sm:w-11 sm:h-11 ${t.bg} rounded-xl flex items-center justify-center flex-shrink-0`}>
          <Icon className={`w-4 h-4 sm:w-5 sm:h-5 ${t.fg}`} />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] sm:text-xs font-medium text-[#6a7f6a] uppercase tracking-wider truncate">{label}</p>
          <p className="text-xl sm:text-2xl font-bold text-[#1a2e1a] leading-tight mt-0.5">{value}</p>
        </div>
      </div>
    </button>
  );
}

function StatusBadge({ status }) {
  const map = {
    scheduled:   { bg: 'bg-[#e6f0fb]', text: 'text-[#2a6ba8]', dot: 'bg-[#2a6ba8]', label: 'Scheduled' },
    pending:     { bg: 'bg-[#fef7e0]', text: 'text-[#b68b40]', dot: 'bg-[#b68b40]', label: 'Pending' },
    completed:   { bg: 'bg-[#e8f5e6]', text: 'text-[#2d7a3a]', dot: 'bg-[#2d7a3a]', label: 'Completed' },
    rescheduled: { bg: 'bg-[#f3e8ff]', text: 'text-[#7a3aa8]', dot: 'bg-[#7a3aa8]', label: 'Rescheduled' },
    cancelled:   { bg: 'bg-[#fde8e8]', text: 'text-[#c0392b]', dot: 'bg-[#c0392b]', label: 'Cancelled' },
  };
  const s = map[status] || map.pending;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1 text-[10px] sm:text-xs font-medium rounded-full whitespace-nowrap flex-shrink-0 ${s.bg} ${s.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-xs font-medium text-[#6a7f6a] uppercase tracking-wider mb-1">
        {label}
      </label>
      {children}
    </div>
  );
}
