import { type RinMessage } from "./rin-model";
import { safeParse } from "./utils";

export function parseTgMessage(rawText: string, me: string): RinMessage | null {
	const raw = safeParse(rawText);
	if (raw === null) return null;

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