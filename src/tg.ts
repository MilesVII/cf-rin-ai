import { type RinMessage } from "./rin-model";
import { StorageSchema } from "./storage";
import { escapeMarkdown, nothrowParse, pickRandom, tg } from "./utils";

export function parseTgUpdate(rawText: string, me: string) {
	const raw = nothrowParse(rawText);
	if (raw === null) return null;

	if (raw?.message) return parseTgMessage(raw, me);
	if (raw?.inline_query) return parseTgInlineQuery(raw);
	if (raw?.callback_query) return parseTgCallbackQuery(raw);
	return null;
}

function parseTgMessage(raw: any, me: string): RinMessage | null {
	return {
		personal: raw.message?.chat?.type === "private",
		origin: {
			id: raw.message?.message_id,
			sender: raw.message?.from?.id || me || null,
			chat: raw.message?.chat?.id || me,
			text: raw.message?.text?.trim() || ""
		},
		isReply: raw.message?.reply_to_message ? ({
			to: raw.message?.reply_to_message?.from?.id,
			message: {
				id: raw.message?.reply_to_message?.message_id,
				text: raw.message?.reply_to_message?.textx
			}
		}) : undefined,
		raw: raw
	};
}

function parseTgInlineQuery(raw: any) {
	return { iq: true, ...raw?.inline_query };
}

function parseTgCallbackQuery(raw: any) {
	return { cbq: true, ...raw?.callback_query };
}

export async function processInlineQuery(id: string, me: string, token: string, config: StorageSchema["config"]["inline"]) {
	function content(cfg: StorageSchema["config"]["inline"][number], ix: number) {
		return {
			type: "article",
			id: "blop" + ix,
			title: cfg.caption,
			thumbnail_url: cfg.icon,
			thumbnail_width: 128,
			thumbnail_height: 128,
			input_message_content: {
				message_text: pickRandom(cfg.lines)
			}
		};
	}
	await tg(
		"answerInlineQuery",
		{
			inline_query_id: id,
			results: config.map(content),
			cache_time: 30,
			is_personal: true
		},
		token
	);
}
