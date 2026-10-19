"use client";

import { useState } from 'react';
import { parseSiteVisitTime } from '@/lib/site-visit-time';

const inputClass =
  'w-full rounded-xl border border-[#e8f0e6] bg-[#fafffa] px-3 py-2 text-sm focus:border-[#2d7a3a] focus:outline-none focus:ring-2 focus:ring-[#2d7a3a]/20';

export default function TimePicker({ value, onChange, required = false, disabled = false }) {
  const [parts, setParts] = useState(() => {
    const parsed = parseSiteVisitTime(value);
    return {
      hour: parsed ? String(parsed.hour).padStart(2, '0') : '',
      minute: parsed ? String(parsed.minute).padStart(2, '0') : '',
      period: parsed?.period || '',
    };
  });
  const { hour, minute, period } = parts;

  const update = (part, nextValue) => {
    const next = { ...parts, [part]: nextValue };
    setParts(next);
    if (!next.hour || !next.minute || !next.period) {
      onChange('');
      return;
    }
    onChange(`${next.hour}:${next.minute} ${next.period}`);
  };

  return (
    <div className="grid grid-cols-3 gap-2">
      <label className="block min-w-0">
        <span className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-[#6a7f6a]">Hour </span>
        <select
          aria-label="Hour, 1 to 12"
          required={required}
          disabled={disabled}
          value={hour}
          onChange={(event) => update('hour', event.target.value)}
          className={inputClass}
        >
          <option value="">Hour</option>
          {Array.from({ length: 12 }, (_, index) => String(index + 1)).map((option) => (
            <option key={option} value={option.padStart(2, '0')}>{option}</option>
          ))}
        </select>
      </label>
      <label className="block min-w-0">
        <span className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-[#6a7f6a]">Minute</span>
        <select
          aria-label="Minute"
          required={required}
          disabled={disabled}
          value={minute}
          onChange={(event) => update('minute', event.target.value)}
          className={inputClass}
        >
          <option value="">Minute</option>
          {Array.from({ length: 60 }, (_, index) => String(index).padStart(2, '0')).map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
      </label>
      <label className="block min-w-0">
        <span className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-[#6a7f6a]">AM / PM</span>
        <select
          aria-label="AM or PM"
          required={required}
          disabled={disabled}
          value={period}
          onChange={(event) => update('period', event.target.value)}
          className={inputClass}
        >
          <option value="">Select</option>
          <option value="AM">AM</option>
          <option value="PM">PM</option>
        </select>
      </label>
    </div>
  );
}
