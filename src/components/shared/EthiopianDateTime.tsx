import React, { useEffect, useState } from 'react';

const ETHIOPIA_TIME_ZONE = 'Africa/Addis_Ababa';

function formatEthiopiaDateTime(date: Date): string {
  return new Intl.DateTimeFormat('en-ET', {
    timeZone: ETHIOPIA_TIME_ZONE,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date);
}

/** Live, accessible Ethiopia-local date and time for application footers. */
export const EthiopianDateTime: React.FC = () => {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const intervalId = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(intervalId);
  }, []);

  return (
    <time
      dateTime={now.toISOString()}
      aria-label={`Current Ethiopia time: ${formatEthiopiaDateTime(now)} EAT`}
      title="Africa/Addis_Ababa · East Africa Time (UTC+3)"
      className="tabular-nums"
    >
      {formatEthiopiaDateTime(now)} EAT
    </time>
  );
};
