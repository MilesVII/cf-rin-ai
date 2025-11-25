import { tg, tgReport } from "./utils";
import { encode } from "uint8-to-base64";

export async function emo(fileId: string, fileSize: number, chat: number, tgToken: string, geminiKey: string) {
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
	
	const result = await ask(geminiKey, b64);

	if (result.success) {
		await tgReport(result.answer, tgToken, chat);
	} else {
		console.error(result.code, result.message);
		await tgReport(`E code ${result.code} message ${result.message}`, tgToken, chat);
	}
}
const model = "gemini-2.0-flash";
const url = (key: string) => `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;

async function ask(key: string, picture: string) {
	const payload = {
		contents: [{
			"parts":[
				{
					"inline_data": {
						"mime_type": "image/webp",
						"data": picture
					}
				},
				{ "text": "please describe the emotion conveyed in this picture using one or few words" },
			]
		}],
		safetySettings:
			[
				"HARM_CATEGORY_HARASSMENT",
				"HARM_CATEGORY_HATE_SPEECH",
				"HARM_CATEGORY_SEXUALLY_EXPLICIT",
				"HARM_CATEGORY_DANGEROUS_CONTENT",
				"HARM_CATEGORY_CIVIC_INTEGRITY"
			].map(category => ({
				category: category,
				threshold: "OFF"
			})),
	};

	const response = await fetch(url(key), {
		method: "POST",
		headers: {
			"Content-Type": "application/json"
		},
		body: JSON.stringify(payload)
	});

	if (response.ok) {
		const yapping = await response.json();
		return {
			success: true as const,
			// @ts-ignore
			answer: yapping.candidates[0].content.parts[0].text
		};
	} else {
		const error = await response.text();
		console.error(error);
		return {
			success: false as const,
			code: response.status,
			message: error
		};
	}
}
