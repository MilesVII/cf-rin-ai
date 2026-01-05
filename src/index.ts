import { aiDrawFactory, aiFactory } from "./ai";
import { emo } from "./emo";
import { processRinMessage } from "./rin-model";
import { Storage, StorageSchema } from "./storage";
import { parseTgUpdate, processInlineQuery } from "./tg";
import { escapeMarkdown, nothrowParse, tg } from "./utils";

interface Env {
	RIN_STATE: KVNamespace;
	TG_ME: string;
	TG_TOKEN: string;
	AI_GEMINI: string;
	AI: Ai;
}

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

		const localMode = request.headers.get("x-local-mode") === "true";
		const storageInstance = storage(env.RIN_STATE);

		const drawAi = aiDrawFactory(env.AI);

		if (localMode){
			await processRinMessage({
				personal: false,
				origin: {
					id: 0,
					sender: env.TG_ME ?? "",
					chat: env.TG_ME ?? "",
					text: messageRaw
				},
				raw: null
			}, env.TG_TOKEN, storageInstance, env.AI_GEMINI, drawAi);
		} else {
			const parsed = parseTgUpdate(messageRaw, env.TG_ME);
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
							env.AI_GEMINI
						));
					else
						ctx.waitUntil(processRinMessage(parsed, env.TG_TOKEN, storageInstance, env.AI_GEMINI, drawAi));
				}

			}
		}

		return new Response();
	},
} satisfies ExportedHandler<Env>;
