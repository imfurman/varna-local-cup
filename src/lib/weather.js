export const WEATHER_REFRESH_MS = 15 * 60 * 1000;
export const WEATHER_MAX_AGE_MS = 30 * 60 * 1000;
export const WEATHER_URL = 'https://api.open-meteo.com/v1/forecast?latitude=43.20807&longitude=27.92384&current=temperature_2m,weather_code,is_day,wind_speed_10m&temperature_unit=celsius&wind_speed_unit=ms&timeformat=unixtime&timezone=UTC&forecast_days=1';

const conditions = [
  [[0], 'clear', 'Ясно'], [[1], 'clear', 'Преимущественно ясно'],
  [[2], 'partly-cloudy', 'Переменная облачность'], [[3], 'cloudy', 'Пасмурно'],
  [[45, 48], 'fog', 'Туман'], [[51, 53, 55, 56, 57], 'rain', 'Морось'],
  [[61, 63, 65, 66, 67], 'rain', 'Дождь'], [[80, 81, 82], 'rain', 'Ливень'],
  [[71, 73, 75, 77, 85, 86], 'snow', 'Снег'], [[95, 96, 99], 'storm', 'Гроза'],
];

export function parseWeather(data, now = Date.now()) {
  const current = data?.current;
  if (!current || !Number.isFinite(current.time) || !Number.isFinite(current.temperature_2m)
    || !Number.isFinite(current.wind_speed_10m) || current.wind_speed_10m < 0
    || ![0, 1].includes(current.is_day) || data.current_units?.temperature_2m !== '°C'
    || data.current_units?.wind_speed_10m !== 'm/s') throw new Error('Invalid weather data');
  const condition = conditions.find(([codes]) => codes.includes(current.weather_code));
  const time = current.time * 1000;
  if (!condition || now - time > WEATHER_MAX_AGE_MS || time - now > 5 * 60 * 1000) throw new Error('Unsupported or outdated weather');
  return { condition: condition[1], label: condition[2], night: current.is_day === 0,
    temperature: Math.round(current.temperature_2m), wind: Math.round(current.wind_speed_10m), time };
}

export async function fetchWeather(fetcher = fetch) {
  const response = await fetcher(WEATHER_URL, { signal: AbortSignal.timeout(10000), credentials: 'omit' });
  if (!response.ok) throw new Error(`Weather HTTP ${response.status}`);
  const data = await response.json();
  parseWeather(data);
  return data;
}
