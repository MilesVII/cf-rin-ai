import { tgReport } from "./utils";

const api = (location: string) => [
	"https://api.open-meteo.com/v1/forecast?",
	location,
	"&daily=weather_code,temperature_2m_max,temperature_2m_min,wind_speed_10m_max,surface_pressure_max,surface_pressure_min,surface_pressure_mean,cloud_cover_mean,cloud_cover_max,cloud_cover_min"
].join("");

const mmhgInHpa = .75006;
const migraineThresholdMMHG = 7;

const WMO = new Map(Object.entries({
	"0": "Sunny",
	"1": "Mainly Sunny",
	"2": "Partly Cloudy",
	"3": "Cloudy",
	"45": "Foggy",
	"48": "Rime Fog",
	"51": "Light Drizzle",
	"53": "Drizzle",
	"55": "Heavy Drizzle",
	"56": "Light Freezing Drizzle",
	"57": "Freezing Drizzle",
	"61": "Light Rain",
	"63": "Rain",
	"65": "Heavy Rain",
	"66": "Light Freezing Rain",
	"67": "Freezing Rain",
	"71": "Light Snow",
	"73": "Snow",
	"75": "Heavy Snow",
	"77": "Snow Grains",
	"80": "Light Showers",
	"81": "Showers",
	"82": "Heavy Showers",
	"85": "Light Snow Showers",
	"86": "Snow Showers",
	"95": "Thunderstorm",
	"96": "Light Thunderstorms With Hail",
	"99": "Thunderstorm With Hail"
}));

export async function weather(tgToken: string, tgTo: string, location: string) {
	const response = await fetch(api(location));
	if (!response.ok) return;
	const payload: any = await response.json();
	const lines = (payload.daily.time as string[]).map((t, ix) => {
		const pmin = mmhgInHpa * payload.daily.surface_pressure_min[ix];
		const pmax = mmhgInHpa * payload.daily.surface_pressure_max[ix];
		const pmen = mmhgInHpa * payload.daily.surface_pressure_mean[ix];
		
		const cmin = payload.daily.cloud_cover_min[ix];
		const cmax = payload.daily.cloud_cover_max[ix];
		const cmen = payload.daily.cloud_cover_mean[ix];
		const [y,m,d] = t.split("-");
		const time = `${d}.${m}`;
		const dow = new Date(parseInt(y), parseInt(m) - 1, parseInt(d)).toLocaleDateString("en", { weekday: "long" });

		const mayday = pmax - pmin > migraineThresholdMMHG;
		const barCount = Math.min(1, (pmax - pmin) / 20) * 7
		const bars = Array.from({ length: Math.round(barCount) }, () => "█").join("");

		const tempMin = payload.daily.temperature_2m_min[ix];
		const tempMax = payload.daily.temperature_2m_max[ix];
		const wmoCaption = WMO.get(String(payload.daily.weather_code[ix])) ?? `[unknown WMO code: ${payload.daily.weather_code[ix]}]`;
		const windMax = payload.daily.wind_speed_10m_max[ix];

		const all = [
			`${time} (${dow}): ${wmoCaption}`,
			"> temperature:",
			`${tempMin}°C - ${tempMax}°C`,
			"> wind:",
			`up to ${windMax}km/h`,
			"> pressure:",
			`${Math.round(pmen)}mmHg avg, ${Math.round(pmin)}-${Math.round(pmax)}`,
			`${bars} (${Math.round(pmax-pmin)}mmHg delta)`,
			"> clouds:",
			`☁️: ${Math.round(cmen)}% avg, ${Math.round(cmin)}-${Math.round(cmax)}`,
		];
		if (mayday) all.push(`⚠️ mayday warning: ${Math.round(pmax - pmin)}mmHg delta`);
		return all.join("\n");
	});

	await tgReport(lines.join("\n\n"), tgToken, tgTo);
}