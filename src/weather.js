import { t, locale } from './language.js';
import { fetchWeather, parseWeather, WEATHER_REFRESH_MS } from './lib/weather.js';
import './weather.css';

export function startWeather() {
  const sky = document.createElement('div');
  sky.className = 'weather-sky';
  sky.setAttribute('aria-hidden', 'true');
  sky.innerHTML = `<div class="weather-orb"></div><div class="weather-stars"></div><div class="weather-cloud cloud-one"></div><div class="weather-cloud cloud-two"></div><div class="weather-cloud cloud-three"></div><div class="weather-fog"></div><div class="weather-precipitation">${Array.from({ length: 28 }, (_, i) => `<i style="--x:${(i * 37) % 101}%;--delay:-${i * 0.7}s;--duration:${1.4 + (i % 4) * 0.3}s;--snow-duration:${9 + i % 6}s"></i>`).join('')}</div>`;
  document.body.prepend(sky);
  const summary = document.querySelector('#weather-summary');
  const detail = document.querySelector('#weather-detail');
  const toggle = document.querySelector('#weather-motion');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const cacheKey = 'vlc-weather-varna-v1';
  let payload, lastAttempt = 0, loading = false, failed = false;
  const readStorage = key => { try { return localStorage.getItem(key); } catch { return null; } };
  const saveStorage = (key, value) => { try { localStorage.setItem(key, value); } catch { /* Storage is optional. */ } };
  let paused = readStorage('vlc-weather-paused') === 'true';
  const updateMotion = () => {
    sky.classList.toggle('weather-paused', paused || reducedMotion.matches || document.hidden);
    toggle.setAttribute('aria-pressed', String(paused || reducedMotion.matches));
    toggle.textContent = paused || reducedMotion.matches ? t("Анимация выключена") : t("Выключить анимацию");
    toggle.disabled = reducedMotion.matches;
  };
  toggle.addEventListener('click', () => { paused = !paused; saveStorage('vlc-weather-paused', String(paused)); updateMotion(); });
  reducedMotion.addEventListener('change', updateMotion);
  updateMotion();
  const render = () => {
    try {
      const weather = parseWeather(payload);
      sky.dataset.weather = weather.condition;
      sky.dataset.night = String(weather.night);
      summary.textContent = `${weather.temperature > 0 ? '+' : ''}${weather.temperature}° · ${t(weather.label)}`;
      const time = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Sofia' }).format(weather.time);
      detail.textContent = `${failed ? t("Не удалось обновить · ") : ''}${t("Ветер")} ${weather.wind} ${t("м/с · данные на")} ${time}, ${t("Варна")}`;
      toggle.hidden = false;
    } catch {
      delete sky.dataset.weather;
      delete sky.dataset.night;
      summary.textContent = t("Погода временно недоступна");
      detail.textContent = t("Попробуем обновить автоматически");
      toggle.hidden = true;
    }
  };
  try {
    const saved = JSON.parse(readStorage(cacheKey));
    parseWeather(saved?.data);
    payload = saved.data;
    lastAttempt = Math.min(Date.now(), Number(saved.fetchedAt) || 0);
    render();
  } catch { /* Keep the neutral background until current data arrives. */ }

  const refresh = async () => {
    if (document.hidden || loading) return;
    if (Date.now() - lastAttempt < WEATHER_REFRESH_MS) {
      if (payload) render();
      return;
    }
    loading = true;
    lastAttempt = Date.now();
    try {
      payload = await fetchWeather();
      failed = false;
      saveStorage(cacheKey, JSON.stringify({ data: payload, fetchedAt: Date.now() }));
      render();
    } catch { failed = true; render(); }
    finally { loading = false; }
  };
  document.addEventListener('visibilitychange', () => { updateMotion(); if (!document.hidden) void refresh(); });
  window.addEventListener('online', () => { lastAttempt = 0; void refresh(); });
  // Recheck freshness without polling the API more than once every 15 minutes.
  setInterval(() => void refresh(), 60000);
  void refresh();
}
