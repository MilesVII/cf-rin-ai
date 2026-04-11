import { aiDrawFactory } from "./ai";
import { connectDB, createConnector } from "./db";
import { emo } from "./emo";
import { add, removeFew } from "./reminders";
import { processRinMessage } from "./rin-model";
import { Storage, StorageSchema } from "./storage";
import { parseTgUpdate, processInlineQuery } from "./tg";
import { Rinputs } from "./types";
import { dateToDMY, nothrowParse, parseDateDMY, tg, tgReport } from "./utils";
import { weather } from "./weather";

const REMINDER_BUTTON_1DAY = "REM-PP-1DAY";
const REMINDER_BUTTON_WEEK = "REM-PP-WEEK";

export default {
	async scheduled(controller, env, ctx) {
		const storageInstance = storage(env.RIN_STATE);
		const config = await storageInstance.get("config");
		const promises = config.weather.map(
			([user, location]) => weather(env.TG_TOKEN, user, location)
		);
		ctx.waitUntil(Promise.all(promises));
		const db = connectDB(env.rin_d1);
		const reminders = await db
			.selectFrom("reminders")
			.selectAll()
			.execute();
		
		const filtered = reminders
			.map(r => {
				const [, date] = parseDateDMY(r.at);
				return {...r, at: date!.getTime()};
			})
			.filter(r => r.at <= Date.now());

		if (filtered.length === 0) return;

		for (const reminder of filtered) {
			await tg("sendMessage", {
				chat_id: reminder.chat,
				text: `REMINDER\n${reminder.message}`,
				reply_markup: {
					inline_keyboard: [
						[{ text: "remind tomorrow",     callback_data: REMINDER_BUTTON_1DAY }],
						[{ text: "remind a week later", callback_data: REMINDER_BUTTON_WEEK }]
					]
				}
			}, env.TG_TOKEN);
		}
		await removeFew(db, filtered.map(r => r.id));
	},

	async fetch(request, env, ctx): Promise<Response> {
		const newWebhook = request.headers.get("x-set-tg-webhook");
		if (newWebhook) {
			return registerTgWebhook(newWebhook, env.TG_TOKEN);
		}
		
		const messageRaw = request.headers.get("Content-Type") === "application/json"
			? JSON.stringify(await request.json())
			: await request.text();

		const storageInstance = storage(env.RIN_STATE);
		const drawAi = aiDrawFactory(env.AI);
		const parsed = parseTgUpdate(messageRaw, env.TG_ME);

		const rinputs: Rinputs = {
			aiKey: env.OR_KEY,
			drawAi,
			message: parsed,
			storage: storageInstance,
			tgToken: env.TG_TOKEN,
			dbConnector: createConnector(env.rin_d1)
		};

		if (parsed) {
			ctx.waitUntil(route(parsed, env, rinputs));
		}

		return new Response();
	},
} satisfies ExportedHandler<Env>;

async function route(parsed: any, env: Env, rinputs: Rinputs) {
	if (parsed?.iq) {
		const config = await rinputs.storage.get("config");
		await processInlineQuery(parsed.id, env.TG_ME, env.TG_TOKEN, config.inline);
		return;
	}

	if (parsed?.cbq) {
		const offsetDays = {
			[REMINDER_BUTTON_1DAY]: 1,
			[REMINDER_BUTTON_WEEK]: 7
		}[parsed.data as string];
		const DAY_MS = 24 * 60 * 60 * 1000;
		if (!offsetDays) return;

		const db = connectDB(env.rin_d1);
		const message = (parsed.message.text as string)
			.split("\n")
			.slice(1)
			.join("\n");
		const at = new Date(Date.now() + DAY_MS * offsetDays);

		await add(db, parsed.message.chat.id, dateToDMY(at), message);

		await tg("answerCallbackQuery", {
			callback_query_id: parsed.id
		}, env.TG_TOKEN);
		await tgReport(
			`reminder is set at ${at.toLocaleDateString("ru")}`,
			env.TG_TOKEN,
			parsed.message.chat.id
		);

		return;
	}

	if (
		parsed.personal &&
		parsed.raw.message?.chat?.id && 
		parsed.raw.message?.sticker?.file_id
	) {
		await emo(
			parsed.raw.message.sticker.file_id,
			parsed.raw.message.sticker.file_size ?? 0,
			parsed.raw.message.chat.id,
			env.TG_TOKEN,
			env.OR_KEY
		)
		return;
	}
	
	await processRinMessage(rinputs);
}

async function registerTgWebhook(url: string, tgToken: string) {
	console.log(`setting webhook to ${url}`);

	return await tg("setWebhook", {
		url,
		allowed_updates: ["message", "inline_query", "callback_query"]
	}, tgToken);
}

function storage(kv: KVNamespace): Storage {
	return {
		get: async <T extends keyof StorageSchema>(key: T) => {
			const rawValue = await kv.get(key) ?? "";
			return nothrowParse(rawValue) as Promise<StorageSchema[T]>
		},
		set: <T extends keyof StorageSchema>(key: T, value: StorageSchema[T]) =>
			kv.put(key, JSON.stringify(value))
	}
};
