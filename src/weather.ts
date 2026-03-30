import { tgReport } from "./utils";

const api = [
	"https://api.open-meteo.com/v1/forecast?",
	"latitude=40.1811&longitude=44.5136&",
	"daily=surface_pressure_max,surface_pressure_min,surface_pressure_mean,cloud_cover_mean,cloud_cover_max,cloud_cover_min"
].join("");
const mmhgInHpa = .75006;
const migraineThresholdMMHG = 10;

export async function weather(tgToken: string, tgTo: string) {
	const response = await fetch(api);
	if (!response.ok) return;
	const payload: any = await response.json();
	const lines = (payload.daily.time as string[]).map((t, ix) => {
		const pmin = mmhgInHpa * payload.daily.surface_pressure_min[ix];
		const pmax = mmhgInHpa * payload.daily.surface_pressure_max[ix];
		const pmen = mmhgInHpa * payload.daily.surface_pressure_mean[ix];
		
		const cmin = payload.daily.cloud_cover_min[ix];
		const cmax = payload.daily.cloud_cover_max[ix];
		const cmen = payload.daily.cloud_cover_mean[ix];
		const [,m,d] = t.split("-");
		const time = `${d}.${m}`;

		const mayday = pmax - pmin > migraineThresholdMMHG;
		const barCount = Math.min(1, (pmax - pmin) / 20) * 7
		const bars = Array.from({ length: Math.round(barCount) }, () => "█").join("");

		const all = [
			`${time}: ${Math.round(pmen)}hhMg ${Math.round(pmin)}hhMg-${Math.round(pmax)}hhMg`,
			`${bars} (${Math.round(pmax-pmin)}hhMg delta)`,
			`☁️: ${Math.round(cmen)}% ${Math.round(cmin)}%-${Math.round(cmax)}%`,
		];
		if (mayday) all.push(`⚠️ mayday warning: ${Math.round(pmax - pmin)}mmHg delta`);
		return all.join("\n");
	});

	await tgReport(lines.join("\n\n"), tgToken, tgTo);
}