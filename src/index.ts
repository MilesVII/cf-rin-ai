import { aiDrawFactory, aiFactory } from "./ai";
import { processRinMessage } from "./rin-model";
import { Storage, StorageSchema } from "./storage";
import { parseTgMessage } from "./tg";
import { safeParse, tg } from "./utils";

interface Env {
	RIN_STATE: KVNamespace;
	TG_ME: string;
	TG_TOKEN: string;
	AI: Ai;
}

async function registerTgWebhook(url: string, tgToken: string) {
	console.log(`setting webhook to ${url}`);

	return await tg("setWebhook", {
		url,
		allowed_updates: "message"
	}, tgToken);
}

function storage(kv: KVNamespace): Storage {
	return {
		get: async <T extends keyof StorageSchema>(key: T) => {
			const rawValue = await kv.get(key) ?? "";
			return safeParse(rawValue) as Promise<StorageSchema[T]>
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

		const ai = aiFactory(env.AI);
		const drawAi = aiDrawFactory(env.AI);

		if (localMode){
			await processRinMessage({
				personal: false,
				origin: {
					sender: env.TG_ME ?? "",
					chat: env.TG_ME ?? "",
					text: messageRaw
				},
				raw: null
			}, env.TG_TOKEN, storageInstance, ai, drawAi);
		} else {
			const parsed = parseTgMessage(messageRaw, env.TG_ME);
			if (parsed) 
				ctx.waitUntil(processRinMessage(parsed, env.TG_TOKEN, storageInstance, ai, drawAi));
		}

		return new Response();
	},
} satisfies ExportedHandler<Env>;
