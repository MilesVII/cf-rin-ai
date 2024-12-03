
export function safe<T>(cb: () => T): (T | null) {
	try {
		return cb();
	} catch(e){
		return null;
	}
}

export function safeParse(str: string) {
	try {
		return JSON.parse(str);
	} catch (e) {
		return null;
	}
}

export function last<T>(arr: T[]): T {
	return arr[arr.length - 1];
}

export function unique<T>(arr: T[]): T[] {
	return arr.filter((v, i, a) => !a.slice(i + 1).find(x => x == v))
}

export function range(from: number, to: number): number[] {
	const r = [];
	for (let i = from; i < to; ++i)
		r.push(i);
	return r;
}

export function chunk<T>(a: T[], chunksize: number): T[][] {
	let r = [];
	for (let i = 0; i < a.length; i += chunksize){
		r.push(a.slice(i, i + chunksize));
	}
	return r;
}

export function tg(command: string, payload: any, token: string) {
	const url = `https://api.telegram.org/bot${token}/${command}`;
	return fetch(url, {
		method: "POST",
		headers: {
			"Content-Type": "application/json"
		},
		body: JSON.stringify(payload)
	});
}

export function tgFD(command: string, payload: FormData, token: string) {
	const url = `https://api.telegram.org/bot${token}/${command}`;
	return fetch(url, {
		method: "POST",
		body: payload
	});
}

export function tgReport(message: string, token: string, me: string){
	return tg("sendMessage", {
		chat_id: me,
		text: message
	}, token);
}

export function parseTelegramTarget(raw: string){
	if (raw.startsWith("@")) return raw;
	try {
		return parseInt(raw, 10);
	} catch(e){
		console.error(e);
		return null;
	}
}

export async function sleep(ms: number){
	return new Promise(resolve => setTimeout(resolve, ms));
}

//https://github.com/edwmurph/escape-markdown/blob/master/index.js
export function escapeMarkdown(raw: string){
	const substitutions = {'*': '\\*','#': '\\#','(': '\\(',')': '\\)','[': '\\[',']': '\\]',_: '\\_','\\': '\\\\','+': '\\+','-': '\\-','`': '\\`','<': '&lt;','>': '&gt;','&': '&amp;', '.': '\\.'};

	// @ts-ignore
	return raw.replace(/./g, m => substitutions[m] ?? m);
}

export function pickRandom<T>(array: T[], random = Math.random()): T {
	return array[Math.floor(array.length * random)]
}

export function popRandom<T>(array: T[], random = Math.random()): T {
	const index = Math.floor(array.length * random);
	return array.splice(index, 1)[0];
}
