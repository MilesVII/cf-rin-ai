import { ask } from "./or";
import { tg, tgReport } from "./utils";
import { encode } from "uint8-to-base64";

export async function emo(fileId: string, fileSize: number, chat: number, tgToken: string, orKey: string) {
	if (fileSize > 20_000_000) {
		await tgReport(`damn that's a heavy one`, tgToken, chat);
		return;
	}
	const r = await tg("getFile", { file_id: fileId }, tgToken);
	const response = await r.json() as any;
	if (!response?.ok) {
		await tgReport(`telegram says something's off\n${JSON.stringify(response, undefined, "\t")}`, tgToken, chat);
		return;
	}

	const path = response.result.file_path as string;
	const url = `https://api.telegram.org/file/bot${tgToken}/${path}`;
	const stickerFileResponse = await fetch(url);
	if (!stickerFileResponse.ok) {
		await tgReport(`failed to fetch sticker file`, tgToken, chat);
		return;
	}
	const bytes = await stickerFileResponse.bytes();
	const b64 = encode(bytes);
	const text = "please describe the emotion conveyed in this picture using one or few words";

	const result = await ask(
		orKey,
		[[true, text, `data:image/webp;base64,${b64}`]],
		null,
		// ["google/gemma-3-27b-it:free"]
		["nvidia/nemotron-nano-12b-v2-vl:free"]
	);

	if (result.success) {
		await tgReport(result.answer, tgToken, chat);
	} else {
		console.error(result.code, result.message);
		await tgReport(`E code ${result.code} message ${result.message}`, tgToken, chat);
	}
}
