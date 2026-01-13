import { aiDrawFactory, aiFactory } from "./ai";
import { createConnector } from "./db";
import { emo } from "./emo";
import { processRinMessage } from "./rin-model";
import { Storage, StorageSchema } from "./storage";
import { parseTgUpdate, processInlineQuery } from "./tg";
import { Rinputs } from "./types";
import { escapeMarkdown, nothrowParse, tg } from "./utils";

async function registerTgWebhook(url: string, tgToken: string) {
	console.log(`setting webhook to ${url}`);

	return await tg("setWebhook", {
		url,
		allowed_updates: ["message", "inline_query"]
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

export default {
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
			if (parsed?.iq) {
				const config = await storageInstance.get("config");
				ctx.waitUntil(processInlineQuery(parsed.id, env.TG_ME, env.TG_TOKEN, config.inline));
			} else {
				if (
					parsed.personal &&
					parsed.raw.message?.chat?.id && 
					parsed.raw.message?.sticker?.file_id
				)
					ctx.waitUntil(emo(
						parsed.raw.message.sticker.file_id,
						parsed.raw.message.sticker.file_size ?? 0,
						parsed.raw.message.chat.id,
						env.TG_TOKEN,
						env.OR_KEY
					));
				else
					ctx.waitUntil(processRinMessage(rinputs));
			}

		}

		return new Response();
	},
} satisfies ExportedHandler<Env>;
