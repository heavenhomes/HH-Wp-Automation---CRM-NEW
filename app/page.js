"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { formatSiteVisitTime } from '@/lib/site-visit-time';
import {
  Users, Building2, UserCheck, Calendar,
  UserCircle, ArrowRight, FolderOpen,
  Phone, Clock, Bell, X,
} from 'lucide-react';

export default function Dashboard() {
  const [stats, setStats] = useState({
    activeLeads: 0,
    pendingSiteVisits: 0,
    activeProperties: 0,
    convertedClients: 0,
  });
  const [recentLeads, setRecentLeads] = useState([]);
  const [todayVisits, setTodayVisits] = useState([]);
  const [yesterdayVisits, setYesterdayVisits] = useState([]);
  const [leadReminders, setLeadReminders] = useState([]);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchLeadReminders = async () => {
    try {
      const response = await fetch('/api/lead-notes/reminders', { cache: 'no-store' });
      const json = await response.json();
      if (!response.ok || !json.success) throw new Error(json.error || 'Failed to fetch lead reminders');
      setLeadReminders(json.data || []);
    } catch (error) {
      console.error('Dashboard lead reminder fetch error:', error);
    }
  };

   useEffect(() => {
     fetchLeadReminders();
     const interval = setInterval(fetchLeadReminders, 60 * 1000);
     return () => clearInterval(interval);
   }, []);

   useEffect(() => {
     (async () => {
      try {
        const fetchDashboardData = async (url) => {
          const response = await fetch(url, { cache: 'no-store' });
          const result = await response.json();
          if (!response.ok || !result.success) {
            throw new Error(result.error || `Failed to fetch ${url}`);
          }
          return result;
        };
        const getDateParams = (daysAgo) => {
          const date = new Date();
          date.setHours(0, 0, 0, 0);
          date.setDate(date.getDate() - daysAgo);
          const dateKey = [
            date.getFullYear(),
            String(date.getMonth() + 1).padStart(2, '0'),
            String(date.getDate()).padStart(2, '0'),
          ].join('-');
          return `date=today&dateKey=${dateKey}&timezoneOffset=${date.getTimezoneOffset()}`;
        };
        const fetchVisitsForDate = async (daysAgo, status) => {
          const params = new URLSearchParams(getDateParams(daysAgo));
          params.set('limit', '200');
          if (status) params.set('status', status);
          const firstPage = await fetchDashboardData(`/api/site-visits?${params}`);
          const visits = [...(firstPage.data || [])];
          for (let page = 2; page <= (firstPage.pagination?.pages || 1); page += 1) {
            params.set('page', String(page));
            const nextPage = await fetchDashboardData(`/api/site-visits?${params}`);
            visits.push(...(nextPage.data || []));
          }
          return { ...firstPage, data: visits };
        };
        const [statsRes, leadsRes, pendingRes, propertiesRes, todayRes, yesterdayRes, dayBeforeRes] =
          await Promise.all([
            fetchDashboardData('/api/leads/stats'),
            fetchDashboardData('/api/leads?limit=5'),
            fetchDashboardData('/api/site-visits?status=pending&limit=1'),
            fetchDashboardData('/api/properties?status=available&limit=1'),
            fetchVisitsForDate(0),
            fetchVisitsForDate(1, 'pending'),
            fetchVisitsForDate(2, 'pending'),
          ]);

        setStats({
          activeLeads: statsRes?.data?.active ?? 0,
          convertedClients: statsRes?.data?.converted ?? 0,
          activeProperties: propertiesRes?.pagination?.total ?? 0,
          pendingSiteVisits: pendingRes?.pagination?.total ?? 0,
        });

        setRecentLeads(leadsRes?.data || []);
        setTodayVisits(todayRes?.data || []);
        setYesterdayVisits(
          [...(yesterdayRes?.data || []), ...(dayBeforeRes?.data || [])]
            .sort((a, b) => new Date(b.scheduledDate) - new Date(a.scheduledDate))
        );
      } catch (err) {
        console.error('Dashboard fetch error:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const getPropertyDisplay = (lead) => {
    if (lead?.interested?.title) return lead.interested.title;
    if (lead?.matchedProperties?.[0]?.title) return lead.matchedProperties[0].title;
    return 'Not assigned';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#f8faf7]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-3 border-[#2d7a3a] border-t-transparent rounded-full animate-spin" />
          <p className="text-[#4f6b4f] text-sm font-medium">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 bg-[#f8faf7] min-h-screen">
      {/* Page Header */}
      <div className="mb-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-semibold text-[#1a2e1a]">
              Dashboard
            </h1>
            <p className="text-sm text-[#4f6b4f] mt-1">Complete overview of your business</p>
          </div>
          <div className="relative ml-auto">
            <button
              type="button"
              onClick={() => setNotificationsOpen((open) => !open)}
              className="relative inline-flex items-center gap-2 rounded-xl border border-[#d8e7d5] bg-white px-3 py-2 text-sm font-medium text-[#2d7a3a] shadow-sm hover:bg-[#f0f7ef]"
              aria-expanded={notificationsOpen}
            >
              <Bell className="h-4 w-4" />
              Follow-up Notifications
              {leadReminders.length > 0 && (
                <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-[#c0392b] px-1.5 py-0.5 text-[10px] font-semibold text-white">
                  {leadReminders.length}
                </span>
              )}
            </button>
            {notificationsOpen && (
              <div className="absolute right-0 z-30 mt-2 w-[min(92vw,420px)] overflow-hidden rounded-2xl border border-[#e8f0e6] bg-white shadow-xl">
                <div className="flex items-center justify-between border-b border-[#e8f0e6] bg-[#fafffa] px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-[#1a2e1a]">Upcoming Manual Follow-ups</p>
                    <p className="mt-0.5 text-xs text-[#6a7f6a]">Includes reminders due within two hours</p>
                  </div>
                  <button type="button" onClick={() => setNotificationsOpen(false)} className="p-1 text-[#6a7f6a] hover:text-[#1a2e1a]" aria-label="Close notifications">
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="max-h-80 divide-y divide-[#eef5ec] overflow-y-auto scrollbar-hidden">
                  {leadReminders.length === 0 ? (
                    <p className="px-4 py-8 text-center text-sm text-[#6a7f6a]">No upcoming manual follow-ups.</p>
                  ) : leadReminders.map((reminder) => (
                    <Link
                      key={`${reminder.leadId}-${reminder._id}`}
                      href={`/leads/${reminder.leadId}`}
                      onClick={() => setNotificationsOpen(false)}
                      className="block px-4 py-3 hover:bg-[#fafffa]"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm font-semibold text-[#1a2e1a]">{reminder.leadName}</p>
                        <span className="shrink-0 text-right text-xs font-medium text-[#b68b40]">
                          {new Date(reminder.nextFollowUpAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short', hour12: true })}
                          {new Date(reminder.nextFollowUpAt).getTime() <= Date.now() + 2 * 60 * 60 * 1000 && (
                            <span className="mt-0.5 block text-[10px] font-semibold text-[#c0392b]">Due within 2 hours</span>
                          )}
                        </span>
                      </div>
                      <p className="mt-1 line-clamp-2 whitespace-pre-wrap text-xs text-[#4f6b4f]">{reminder.note}</p>
                      <p className="mt-1 text-xs text-[#6a7f6a]">{reminder.phone}</p>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* KPI Cards — moderate size, equal height, 2×2 on mobile, 4 across on desktop */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <MiniStatCard href="/leads" icon={Users} label="Active Leads" value={stats.activeLeads} />
        <MiniStatCard href="/site-visits" icon={Calendar} label="Pending Site Visits" value={stats.pendingSiteVisits} />
        <MiniStatCard href="/properties" icon={Building2} label="Active Properties" value={stats.activeProperties} />
        <MiniStatCard icon={UserCheck} label="Converted Clients" value={stats.convertedClients} />
      </div>

      {/* Recent leads and today's visits share the row equally on desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5 mb-6">
        <div className="min-w-0 h-[360px] sm:h-[380px] lg:h-[400px] min-h-0 bg-white rounded-2xl border border-[#e8f0e6] overflow-hidden shadow-sm flex flex-col">
          <div className="px-4 sm:px-5 py-3.5 border-b border-[#e8f0e6] flex items-center justify-between bg-[#fafffa]">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <UserCircle className="w-4 h-4 text-[#2d7a3a] flex-shrink-0" />
              <h2 className="text-sm font-semibold text-[#1a2e1a] truncate">
                Recent New Leads
              </h2>
            </div>
            <Link
              href="/leads"
              className="text-xs font-medium text-[#2d7a3a] hover:text-[#23682e] transition-colors flex items-center gap-1 flex-shrink-0"
            >
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="divide-y divide-[#eef5ec] flex-1 min-h-0 overflow-y-auto scrollbar-hidden">
            {recentLeads.length === 0 ? (
              <div className="text-center py-10 text-[#6a7f6a] text-sm">
                <FolderOpen className="w-4 h-4 inline-block mr-2" />
                No leads found
              </div>
            ) : (
              recentLeads.map((lead) => (
                <Link
                  key={lead._id}
                  href={`/leads/${lead._id}`}
                  className="block px-4 sm:px-5 py-2.5 hover:bg-[#fafffa] transition-colors group"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-[#1a2e1a] truncate group-hover:text-[#2d7a3a] transition-colors">
                        {lead.name || 'N/A'}
                      </p>
                      <p className="text-xs text-[#6a7f6a] flex items-center gap-1 mt-0.5">
                        <Phone className="w-3 h-3 flex-shrink-0" />
                        <span className="truncate">{lead.phone}</span>
                      </p>
                    </div>
                    <span
                      className={`flex-shrink-0 inline-flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-medium rounded-full ${
                        lead.isCompleted
                          ? 'bg-[#e8f5e6] text-[#2d7a3a]'
                          : 'bg-[#fef7e0] text-[#b68b40]'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          lead.isCompleted ? 'bg-[#2d7a3a]' : 'bg-[#b68b40]'
                        }`}
                      />
                      {lead.isCompleted ? 'Done' : 'Active'}
                    </span>
                  </div>
                  <p className="text-xs text-[#4f6b4f] mt-1.5 truncate">
                    {getPropertyDisplay(lead)}
                  </p>
                </Link>
              ))
            )}
          </div>
        </div>

        <div className="min-w-0 h-[360px] sm:h-[380px] lg:h-[400px] min-h-0 bg-white rounded-2xl border border-[#e8f0e6] overflow-hidden shadow-sm flex flex-col">
          <DashboardSectionHeader
            icon={Calendar}
            title="Today Site Visit"
            href="/site-visits"
          />
          <SiteVisitTable visits={todayVisits} emptyMessage="No site visits scheduled for today" />
        </div>
      </div>

      {/* Pending visits from yesterday and the day before */}
      <div className="bg-white rounded-2xl border border-[#e8f0e6] overflow-hidden shadow-sm mb-6">
        <DashboardSectionHeader
          icon={Clock}
          title="Yesterday Site Visit"
          href="/site-visits"
        />
        <SiteVisitTable visits={yesterdayVisits} emptyMessage="No pending site visits from yesterday or the day before" />
      </div>
    </div>
  );
}

/* -------------------- Components -------------------- */

function DashboardSectionHeader({ icon: Icon, title, href }) {
  return (
    <div className="px-4 sm:px-5 py-3.5 border-b border-[#e8f0e6] flex items-center justify-between bg-[#fafffa]">
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        <Icon className="w-4 h-4 text-[#2d7a3a] flex-shrink-0" />
        <h2 className="text-sm font-semibold text-[#1a2e1a] truncate">{title}</h2>
      </div>
      <Link
        href={href}
        className="text-xs font-medium text-[#2d7a3a] hover:text-[#23682e] transition-colors flex items-center gap-1 flex-shrink-0"
      >
        View all <ArrowRight className="w-3 h-3" />
      </Link>
    </div>
  );
}

function SiteVisitTable({ visits, emptyMessage }) {
  return (
    <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hidden">
      {visits.length === 0 ? (
        <div className="px-4 py-8 text-center text-sm text-[#6a7f6a]">
          <FolderOpen className="w-4 h-4 inline-block mr-2" />
          {emptyMessage}
        </div>
      ) : (
        <>
          <div className="divide-y divide-[#eef5ec] 2xl:hidden">
            {visits.map((visit) => (
              <div key={visit._id} className="px-4 py-3 hover:bg-[#fafffa]">
                <div className="flex items-start justify-between gap-2">
                  <p className="min-w-0 truncate text-sm font-medium text-[#1a2e1a]">{visit.leadName || 'N/A'}</p>
                  <VisitStatusBadge status={visit.status} />
                </div>
                <p className="mt-1 truncate text-xs text-[#4f6b4f]">{visit.propertyTitle || 'N/A'}</p>
                <div className="mt-1 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs text-[#6a7f6a]">
                  <span className="inline-flex items-center gap-1">
                    <Phone className="w-3 h-3" />
                    {visit.leadPhone || 'N/A'}
                  </span>
                  <span className="text-right">
                    {formatVisitDate(visit.scheduledDate)}
                    {visit.scheduledTime ? ` · ${formatSiteVisitTime(visit.scheduledTime, visit.scheduledDate)}` : ''}
                  </span>
                </div>
              </div>
            ))}
          </div>
          <div className="hidden min-w-0 2xl:block">
            <table className="w-full table-fixed">
              <thead>
                <tr className="bg-[#fafffa]">
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-[#6a7f6a] uppercase tracking-wider">Name</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-[#6a7f6a] uppercase tracking-wider">Property</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-[#6a7f6a] uppercase tracking-wider">Contact</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-[#6a7f6a] uppercase tracking-wider">Date &amp; Time</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-[#6a7f6a] uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody>
                {visits.map((visit) => (
                  <tr key={visit._id} className="border-t border-[#eef5ec] hover:bg-[#fafffa] transition-colors">
                    <td className="px-2 py-2.5 text-sm font-medium text-[#1a2e1a]"><span className="block truncate">{visit.leadName || 'N/A'}</span></td>
                    <td className="px-2 py-2.5 text-sm text-[#4f6b4f]"><span className="block truncate">{visit.propertyTitle || 'N/A'}</span></td>
                    <td className="px-2 py-2.5 text-sm text-[#4f6b4f]"><span className="block truncate">{visit.leadPhone || 'N/A'}</span></td>
                    <td className="px-2 py-2.5 text-sm text-[#4f6b4f]">
                      {formatVisitDate(visit.scheduledDate)}
                      {visit.scheduledTime && <div className="text-xs text-[#6a7f6a]">{formatSiteVisitTime(visit.scheduledTime, visit.scheduledDate)}</div>}
                    </td>
                    <td className="px-2 py-2.5"><VisitStatusBadge status={visit.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function formatVisitDate(date) {
  return date
    ? new Date(date).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : 'N/A';
}

function MiniStatCard({ icon: Icon, label, value, href }) {
  const Card = href ? Link : 'div';
  return (
    <Card
      {...(href ? { href } : {})}
      className={`bg-white rounded-2xl border border-[#e8f0e6] p-3.5 sm:p-4 shadow-sm transition-shadow duration-200 h-full flex items-center ${
        href ? 'hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#2d7a3a]' : ''
      }`}
    >
      <div className="flex items-center gap-3 w-full min-w-0">
        <div className="w-10 h-10 sm:w-11 sm:h-11 bg-[#e8f5e6] rounded-xl flex items-center justify-center flex-shrink-0">
          <Icon className="w-4 h-4 sm:w-5 sm:h-5 text-[#2d7a3a]" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] sm:text-[11px] font-medium text-[#6a7f6a] uppercase tracking-wider truncate">
            {label}
          </p>
          <p className="text-xl sm:text-2xl font-bold text-[#1a2e1a] leading-tight mt-0.5">
            {value}
          </p>
        </div>
      </div>
    </Card>
  );
}

function VisitStatusBadge({ status }) {
  const map = {
    scheduled:   { bg: 'bg-[#e6f0fb]', text: 'text-[#2a6ba8]', dot: 'bg-[#2a6ba8]', label: 'Scheduled' },
    pending:     { bg: 'bg-[#fef7e0]', text: 'text-[#b68b40]', dot: 'bg-[#b68b40]', label: 'Pending' },
    completed:   { bg: 'bg-[#e8f5e6]', text: 'text-[#2d7a3a]', dot: 'bg-[#2d7a3a]', label: 'Completed' },
    rescheduled: { bg: 'bg-[#f3e8ff]', text: 'text-[#7a3aa8]', dot: 'bg-[#7a3aa8]', label: 'Rescheduled' },
    cancelled:   { bg: 'bg-[#fde8e8]', text: 'text-[#c0392b]', dot: 'bg-[#c0392b]', label: 'Cancelled' },
  };
  const s = map[status] || map.pending;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1 text-[10px] sm:text-xs font-medium rounded-full whitespace-nowrap flex-shrink-0 ${s.bg} ${s.text}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}