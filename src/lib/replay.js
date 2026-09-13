// Points: [Unix seconds, latitude, longitude, course metres, GPS metres, altitude].
export function positionAt(track, time, maxGap = 30) {
  if (!track?.length) return null;
  if (time < track[0][0]) return { point: track[0], index: 0, state: 'waiting' };
  if (time >= track.at(-1)[0]) return { point: track.at(-1), index: track.length - 1, state: 'ended' };
  let low = 0, high = track.length - 1;
  while (high - low > 1) { const mid = (low + high) >> 1; if (track[mid][0] <= time) low = mid; else high = mid; }
  const a = track[low], b = track[high];
  if (b[0] - a[0] > maxGap) return { point: a, index: low, state: 'gap' };
  const f = (time - a[0]) / (b[0] - a[0]);
  return { point: a.map((value, i) => value === null || b[i] === null ? null : value + (b[i] - value) * f), index: low, state: 'riding' };
}
export function trackSegments(track) {
  const segments = [[]];
  track.forEach((p, i) => { if (i && p[0] - track[i - 1][0] > 30) segments.push([]); segments.at(-1).push([p[1], p[2]]); });
  return segments;
}
export function categoryStanding(athletes, category = 'all') {
  return athletes.filter(a => category === 'all' || a.gender === category).map(a => ({ ...a, place: category === 'all' ? a.rank : a.categoryRank })).sort((a, b) => a.place - b.place);
}
