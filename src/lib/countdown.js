// Resolve the event's wall-clock time in its IANA timezone, not the viewer's timezone.
export function meetingTimestamp(event) {
  if (!event.meeting?.time) return null;
  const local = Date.parse(`${event.date}T${event.meeting.time}:00Z`);
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: event.timezone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  });
  let timestamp = local;
  for (let attempt = 0; attempt < 4; attempt++) {
    const parts = Object.fromEntries(formatter.formatToParts(timestamp).map(p => [p.type, p.value]));
    const represented = Date.parse(`${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}Z`);
    if (represented === local) return timestamp;
    timestamp += local - represented;
  }
  return null;
}

export function countdownParts(target, now = Date.now()) {
  const seconds = Math.max(0, Math.ceil((target - now) / 1000));
  return {
    started: now >= target,
    days: Math.floor(seconds / 86400),
    hours: Math.floor(seconds / 3600) % 24,
    minutes: Math.floor(seconds / 60) % 60,
    seconds: seconds % 60,
  };
}
