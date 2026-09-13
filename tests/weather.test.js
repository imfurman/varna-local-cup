import test from 'node:test';
import assert from 'node:assert/strict';
import { parseWeather, fetchWeather, WEATHER_MAX_AGE_MS } from '../src/lib/weather.js';

const now = Date.now();
const sample = (code = 0, day = 1) => ({
  current: { time: Math.floor(now / 1000), temperature_2m: 24.6, wind_speed_10m: 3.2, weather_code: code, is_day: day },
  current_units: { temperature_2m: '°C', wind_speed_10m: 'm/s' },
});

test('WMO conditions choose the scene, preserving precipitation at night', () => {
  for (const [code, expected] of [[0, 'clear'], [1, 'clear'], [2, 'partly-cloudy'], [3, 'cloudy'],
    [45, 'fog'], [48, 'fog'], [51, 'rain'], [57, 'rain'], [61, 'rain'], [67, 'rain'], [82, 'rain'],
    [71, 'snow'], [77, 'snow'], [86, 'snow'], [95, 'storm'], [99, 'storm']]) {
    for (const day of [0, 1]) {
      const weather = parseWeather(sample(code, day), now);
      assert.equal(weather.condition, expected);
      assert.equal(weather.night, day === 0);
      assert.equal(weather.temperature, 25);
      assert.equal(weather.wind, 3);
    }
  }
});

test('missing, old, future or unsupported data must not imply current weather', () => {
  assert.throws(() => parseWeather(null, now));
  assert.throws(() => parseWeather(sample(100), now));
  assert.throws(() => parseWeather(sample(0, null), now));
  assert.throws(() => parseWeather(sample(), now + WEATHER_MAX_AGE_MS + 1));
  assert.throws(() => parseWeather(sample(), now - 6 * 60 * 1000));
  for (const field of ['temperature_2m', 'wind_speed_10m', 'time']) {
    const data = sample();
    data.current[field] = null;
    assert.throws(() => parseWeather(data, now));
  }
  const fahrenheit = sample();
  fahrenheit.current_units.temperature_2m = '°F';
  assert.throws(() => parseWeather(fahrenheit, now));
});

test('API success is validated; HTTP failures and malformed JSON are rejected', async () => {
  const data = sample();
  assert.deepEqual(await fetchWeather(async (url, options) => {
    assert.equal(new URL(url).searchParams.get('latitude'), '43.20807');
    assert.equal(options.credentials, 'omit');
    assert.ok(options.signal instanceof AbortSignal);
    return { ok: true, json: async () => data };
  }), data);
  await assert.rejects(fetchWeather(async () => ({ ok: false, status: 429 })), /429/);
  await assert.rejects(fetchWeather(async () => ({ ok: true, json: async () => ({}) })));
  await assert.rejects(fetchWeather(async () => { throw new TypeError('offline'); }), /offline/);
});
