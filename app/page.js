"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, PointElement, LineElement,
  Title, Tooltip, Legend, Filler,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import {
  Users, Building2, UserCheck, Calendar,
  UserCircle, ArrowRight, FolderOpen,
  Phone, BarChart3, Clock, Bell, X,
} from 'lucide-react';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

export default function Dashboard() {
  const [stats, setStats] = useState({
    activeLeads: 0,
    pendingSiteVisits: 0,
    activeProperties: 0,
    convertedClients: 0,
  });
  const [recentLeads, setRecentLeads] = useState([]);
  const [pendingVisits, setPendingVisits] = useState([]);
  const [leadReminders, setLeadReminders] = useState([]);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
    const [chartHistory, setChartHistory] = useState({
    labels: [],
    leads: [],
    conversions: [],
  });

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

  // Chart data — built from real /api/leads/history response
  const chartData = {
    labels: chartHistory.labels,
    datasets: [
      {
        label: 'Leads',
        data: chartHistory.leads,
        borderColor: '#2d7a3a',
        backgroundColor: 'rgba(45, 122, 58, 0.08)',
        borderWidth: 2.5,
        fill: true,
        tension: 0.3,
        pointBackgroundColor: '#2d7a3a',
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 6,
      },
      {
        label: 'Conversions',
        data: chartHistory.conversions,
        borderColor: '#6fbf73',
        backgroundColor: 'rgba(111, 191, 115, 0.08)',
        borderWidth: 2.5,
        fill: true,
        tension: 0.3,
        pointBackgroundColor: '#6fbf73',
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 6,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'top',
        align: 'end',
        labels: {
          usePointStyle: true,
          pointStyle: 'circle',
          padding: 16,
          font: { size: 11, weight: '500', family: 'Inter' },
          color: '#1e2a1e',
          boxWidth: 8,
          boxHeight: 8,
        },
      },
      tooltip: {
        backgroundColor: 'rgba(255,255,255,0.98)',
        titleColor: '#1e2a1e',
        bodyColor: '#2d4a2d',
        borderColor: '#e8f0e6',
        borderWidth: 1,
        padding: 12,
        cornerRadius: 8,
        titleFont: { size: 12, weight: '600' },
        bodyFont: { size: 12 },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: { color: 'rgba(0,0,0,0.04)', drawBorder: false },
        ticks: { font: { size: 10, family: 'Inter' }, color: '#6a7f6a', padding: 6 },
      },
      x: {
        grid: { display: false },
        ticks: { font: { size: 10, family: 'Inter' }, color: '#6a7f6a', padding: 6 },
      },
    },
    interaction: { intersect: false, mode: 'index' },
  };

   useEffect(() => {
     fetchLeadReminders();
     const interval = setInterval(fetchLeadReminders, 60 * 1000);
     return () => clearInterval(interval);
   }, []);

   useEffect(() => {
     (async () => {
      try {
        const [statsRes, leadsRes, visitsRes, historyRes] = await Promise.all([
          fetch('/api/leads/stats').then((r) => r.json()).catch(() => ({})),
          fetch('/api/leads?limit=5').then((r) => r.json()).catch(() => ({})),
          fetch('/api/site-visits?limit=5').then((r) => r.json()).catch(() => ({})),
          fetch('/api/leads/history?months=6').then((r) => r.json()).catch(() => ({})),
        ]);

        setStats({
          activeLeads: statsRes?.data?.active ?? 0,
          convertedClients: statsRes?.data?.converted ?? 0,
          activeProperties: statsRes?.data?.byCategory
            ? (statsRes.data.byCategory.purchase || 0) +
              (statsRes.data.byCategory.rent || 0) +
              (statsRes.data.byCategory.rentOut || 0)
            : 0,
          pendingSiteVisits:
            visitsRes?.data?.filter((v) => v.status === 'pending').length ?? 0,
        });

        setRecentLeads(leadsRes?.data || []);
        setPendingVisits(
          (visitsRes?.data || [])
            .filter((v) => v.status !== 'completed')
            .slice(0, 5)
        );

        if (historyRes?.success && historyRes.data) {
          setChartHistory({
            labels: historyRes.data.labels || [],
            leads: historyRes.data.leads || [],
            conversions: historyRes.data.conversions || [],
          });
        }
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
                <div className="max-h-80 divide-y divide-[#eef5ec] overflow-y-auto">
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
        <MiniStatCard icon={Users} label="Active Leads" value={stats.activeLeads} />
        <MiniStatCard icon={Calendar} label="Pending Site Visits" value={stats.pendingSiteVisits} />
        <MiniStatCard icon={Building2} label="Active Properties" value={stats.activeProperties} />
        <MiniStatCard icon={UserCheck} label="Converted Clients" value={stats.convertedClients} />
      </div>

      {/* Chart (60%) + Recent Leads (40%) — side-by-side on desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 sm:gap-5 mb-6">
        {/* Chart — spans 3 of 5 columns (60%) */}
        <div className="lg:col-span-3 bg-white rounded-2xl border border-[#e8f0e6] p-4 sm:p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4 gap-2">
            <h2 className="text-sm sm:text-base font-semibold text-[#1a2e1a] flex items-center gap-2 min-w-0">
              <BarChart3 className="w-4 h-4 text-[#2d7a3a] flex-shrink-0" />
              <span className="truncate">Leads vs Conversions</span>
            </h2>
            <span className="text-xs text-[#6a7f6a] bg-[#f0f7ef] px-3 py-1 rounded-full flex-shrink-0 whitespace-nowrap">
              Last 6 months
            </span>
          </div>
          <div className="h-[240px] sm:h-[280px] lg:h-[320px]">
            <Line data={chartData} options={chartOptions} />
          </div>
        </div>

        {/* Recent Leads — spans 2 of 5 columns (40%) */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-[#e8f0e6] overflow-hidden shadow-sm flex flex-col">
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

          <div className="divide-y divide-[#eef5ec] flex-1 overflow-y-auto">
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
                  className="block px-4 sm:px-5 py-3 hover:bg-[#fafffa] transition-colors group"
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
      </div>

      {/* Pending Site Visits */}
      <div className="bg-white rounded-2xl border border-[#e8f0e6] overflow-hidden shadow-sm mb-6">
        <div className="px-4 sm:px-5 py-4 border-b border-[#e8f0e6] flex items-center justify-between bg-[#fafffa]">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <Clock className="w-4 h-4 text-[#2d7a3a] flex-shrink-0" />
            <h2 className="text-sm font-semibold text-[#1a2e1a] truncate">
              Pending Site Visits
            </h2>
          </div>
          <Link
            href="/site-visits"
            className="text-xs font-medium text-[#2d7a3a] hover:text-[#23682e] transition-colors flex items-center gap-1 flex-shrink-0"
          >
            View all <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        {/* Mobile — stacked cards */}
        <div className="md:hidden divide-y divide-[#eef5ec]">
          {pendingVisits.length === 0 ? (
            <div className="text-center py-8 text-[#6a7f6a] text-sm">
              <FolderOpen className="w-4 h-4 inline-block mr-2" />
              No pending site visits
            </div>
          ) : (
            pendingVisits.map((visit) => (
              <div key={visit._id} className="px-4 py-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium text-[#1a2e1a] truncate">
                    {visit.leadName || 'N/A'}
                  </p>
                  <VisitStatusBadge status={visit.status} />
                </div>
                <p className="text-xs text-[#4f6b4f] mt-1">{visit.propertyTitle || 'N/A'}</p>
                <div className="flex items-center justify-between mt-1.5">
                  <span className="text-xs text-[#6a7f6a] flex items-center gap-1">
                    <Phone className="w-3 h-3" />
                    {visit.leadPhone || 'N/A'}
                  </span>
                  <span className="text-xs text-[#6a7f6a]">
                    {visit.rawPreferredDateTime
                      ? visit.rawPreferredDateTime
                      : visit.scheduledDate
                      ? new Date(visit.scheduledDate).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })
                      : 'N/A'}
                  </span>
                </div>
                <p className="text-xs text-[#6a7f6a] mt-1">
                  Channel Partner: {visit.channelPartnerName || 'Not assigned'}
                </p>
              </div>
            ))
          )}
        </div>

        {/* Desktop table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full min-w-[700px]">
            <thead>
              <tr className="bg-[#fafffa]">
                <th className="text-left px-5 py-3 text-xs font-medium text-[#6a7f6a] uppercase tracking-wider">Name</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-[#6a7f6a] uppercase tracking-wider">Property</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-[#6a7f6a] uppercase tracking-wider">Contact</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-[#6a7f6a] uppercase tracking-wider">Date</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-[#6a7f6a] uppercase tracking-wider">Channel Partner</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-[#6a7f6a] uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody>
              {pendingVisits.length === 0 ? (
                <tr className="border-t border-[#eef5ec]">
                  <td colSpan="6" className="text-center py-8 text-[#6a7f6a] text-sm">
                    <FolderOpen className="w-4 h-4 inline-block mr-2" />
                    No pending site visits
                  </td>
                </tr>
              ) : (
                pendingVisits.map((visit) => (
                  <tr
                    key={visit._id}
                    className="border-t border-[#eef5ec] hover:bg-[#fafffa] transition-colors"
                  >
                    <td className="px-5 py-3 text-sm font-medium text-[#1a2e1a]">
                      {visit.leadName || 'N/A'}
                    </td>
                    <td className="px-5 py-3 text-sm text-[#4f6b4f]">
                      {visit.propertyTitle || 'N/A'}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1">
                        <Phone className="w-3 h-3 text-[#6a7f6a]" />
                        <span className="text-sm text-[#4f6b4f]">
                          {visit.leadPhone || 'N/A'}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-sm text-[#4f6b4f]">
                      {visit.rawPreferredDateTime
                        ? visit.rawPreferredDateTime
                        : visit.scheduledDate
                        ? new Date(visit.scheduledDate).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })
                        : 'N/A'}
                    </td>
                    <td className="px-5 py-3 text-sm text-[#4f6b4f]">
                      {visit.channelPartnerName || 'Not assigned'}
                    </td>
                    <td className="px-5 py-3">
                      <VisitStatusBadge status={visit.status} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* -------------------- Components -------------------- */

function MiniStatCard({ icon: Icon, label, value }) {
  return (
    <div className="bg-white rounded-2xl border border-[#e8f0e6] p-3.5 sm:p-4 shadow-sm hover:shadow-md transition-shadow duration-200 h-full flex items-center">
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
    </div>
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