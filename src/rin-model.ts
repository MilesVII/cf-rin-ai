// import axios from "axios";
import { aiFactory, AIUnit } from "./ai";
import { type Storage } from "./storage";
import { tg, pickRandom, sleep, escapeMarkdown, popRandom, tgFD } from "./utils";
import seedrandom from "seedrandom";

export type RinMessage = {
	personal: boolean,
	origin: {
		sender: string,
		chat: string,
		text: string
	}
	reply?: {
		to: string,
		message: {
			id: string
		}
	},
	raw: any
};

export type SayInputPayload = {
	mode: "text",
	text: string
} | {
	mode: "mkdn",
	text: string
} | {
	mode: "picture-id",
	id: string
} | {
	mode: "picture-bytes",
	data: Uint8Array
} | {
	mode: "album",
	ids: string[]
} | {
	mode: "audio",
	id: string
} | {
	mode: "sticker",
	id: string
} | {
	mode: "animation",
	id: string
}
type SayInput = SayInputPayload & {
	reply?: string | boolean
}
type SayFunction = (msg: SayInput, mkdn?: boolean) => Promise<Response>;

export async function processRinMessage(message: RinMessage, tgToken: string, storage: Storage, ai: AIUnit) {
	if (message.personal) {
		await tg(
			"sendMessage",
			{
				chat_id: message.origin.chat,
				parse_mode: "MarkdownV2",
				text: `\`\`\`\n${escapeMarkdown(JSON.stringify(message.raw, undefined, "\t"))}\n\`\`\``
			},
			tgToken
		);
	}

	const tgCommons: any = {
		chat_id: message.origin.chat,
	};
	if (message.raw?.message?.message_id)
		tgCommons.reply_to_message_id = message.raw.message.message_id;

	const sayWrapped: SayFunction = (input) => say(tgCommons, tgToken, input);

	await rinModel(message, sayWrapped, storage, ai);
}

function roll(threshold: number) {
	return Math.random() < threshold;
}

async function rinModel(message: RinMessage, say: SayFunction, storage: Storage, ai: AIUnit){
	const prefs = await storage.get("config");
	const state = await storage.get("state");

	const masterSpeaking = prefs.masters.some((m: any) => message.origin.sender == m);
	const autoAppeal = (message.reply?.to == prefs.me);
	const appeals: string[] = prefs.appeals;
	const msgOriginal = message.origin.text;
	const messageText = message.origin.text.toLowerCase();

	function getCommand(message: string, commands: any[]) {
		return commands.find(
			com => com.triggers.some(
				(trig: string) => message.includes(trig)
			)
		);
	}

	if (autoAppeal || appeals.some(a => messageText.startsWith(a))){
		const command = getCommand(messageText, prefs.appealedCommands);
		if (command?.protected && !masterSpeaking) {
			await say(pickRandom(prefs.protectedCommandFailResponse));
			return;
		}

		switch (command?.command) {
			case ("draft_on"): {
				state.drafted = true;
				await storage.set("state", { drafted: true });
				await say(pickRandom(command.responses));
				break;
			}
			case ("draft_off"): {
				state.drafted = false;
				await storage.set("state", { drafted: false });
				await say(pickRandom(command.responses));
				break;
			}
			case ("ah"): {
				await say(pickRandom(prefs.ahs));
				if (roll(prefs.blush.chance)){
					await say(pickRandom(prefs.blush.says));
				}
				break;
			}
			case ("fortune"): {
				const x2 = prefs.auxTriggers.double.some((t: string) => messageText.includes(t));
				const date = new Date().toLocaleDateString();
				const srnd = seedrandom(`${message.origin.sender}-${date}`);

				const fortunes = await storage.get("fortunes");

				const lines = [
					pickRandom(fortunes, srnd()),
					pickRandom(fortunes, srnd())
				];
				await say({
					mode: "text",
					text: lines[0]
				});
				if (x2)
					await say({
						mode: "text",
						text: lines[1]
					});
				break;
			}
			case ("tarot"): {
				const date = new Date().toLocaleDateString();
				const srnd = seedrandom(`${message.origin.sender}-${date}`);

				const deck = await storage.get("tarot");
				const aiPrefs = await storage.get("ai");
				
				const cards = [
					popRandom(deck, srnd()),
					popRandom(deck, srnd()),
					popRandom(deck, srnd())
				];
				
				const pulledCardsNames = cards
					.map(card => card.ru.name)
					.join(", ");
				
				const aiResponse = ai([{
					role: "user",
					content: aiPrefs.tarotPromptTemplate.replace("#", pulledCardsNames)
				}], aiPrefs.tarotPrompt);

				// for (const card of cards) {
				// 	await sleep(1200);
				// 	await say(`:photo:${card.card}`);
				// }
				await say({
					mode: "album",
					ids: cards.map(card => card.card)
				});

				const comment = cards
					.map((card, index) => `${index + 1}\\. *${card.name}* \\| *${card.ru.name}*\n_${escapeMarkdown(card.description)}_`)
					.join("\n\n");

				await say({
					mode: "mkdn",
					text: comment
				});
				await say({
					mode: "text",
					text: await aiResponse
				});

				break;
			}
			case ("potd"): {
				const date = new Date().toLocaleDateString();
				const srnd = seedrandom(date);

				const loader = pickRandom(prefs.potd.loaders, srnd());
				const member = pickRandom(prefs.potd.members, srnd());
				const name = pickRandom(member, srnd());

				for (let loaderLine of loader) {
					if (loaderLine.mode === "text")
						await say({
							...loaderLine,
							mode: "mkdn",
							text: escapeMarkdown(loaderLine.text).replace("\\#", `*${name}*`)
						})
					else
						await say(loaderLine)
					await sleep(1000);
				}

				break;
			}
			case ("help"): {
				const appealsHelp = escapeMarkdown(prefs.appealsTemplate)
					.replace("\\#", `*${prefs.appeals.join(", ")}*`);
				const apCommandsHelp = prefs.appealedCommands.filter((c: any) => !c.protected).map((c: any) =>
					escapeMarkdown(prefs.commandHelpTemplate)
						.replace("\\#", `*${c.command}*`)
						.replace("\\#", `*${c.triggers.join(", ")}*`)
						.replace("\\#", `*${c.description ?? "N/A"}*`)
				).join("\n\n");
				const basicTriggers = prefs.autoResponse
					.map((c: any) => 
						c.triggers
							.map((t: string) => `*${escapeMarkdown(t)}*`)
							.join(", ")
					)
					.join(", ");
				const basicTriggersHelp = escapeMarkdown(prefs.responseTemplate).replace("\\#", `${basicTriggers}`);
				const help = `${appealsHelp}\n\n${apCommandsHelp}\n\n${basicTriggersHelp}`;
				
				await say({
					mode: "mkdn",
					text: help,
				});
				break;
			}
			default: {
				const aiPrefs = await storage.get("ai");
				const response = await ai([{
					role: "user",
					content: messageText
				}], aiPrefs.systemPrompt);
				await say({
					mode: "text",
					text: msgOriginal,
					reply: message.reply?.to
				});
				break;
			}
		}
	} else {
		if (state.drafted && masterSpeaking) {
			await say({
				mode: "text",
				text: msgOriginal,
				reply: message.reply?.to
			});
		}
		const command = getCommand(messageText, prefs.autoResponse);
		if (command?.chance && !roll(command.chance))
			return;
		if (command) {
			await say(pickRandom(command.responses))
		}
	}
}

function say(options: any, rinToken: string, input: SayInput){
	const commons = {
		...options
	};
	if (input.reply === false){
		delete commons.reply_to_message_id;
	} else if (input.reply !== true) {
		commons.reply_to_message_id = input.reply;
	}

	switch (input.mode) {
		case ("text"): {
			return tg("sendMessage", {
				...commons,
				text: input.text,
			}, rinToken);
		}
		case ("mkdn"): {
			return tg("sendMessage", {
				...commons,
				parse_mode: "MarkdownV2",
				text: input.text,
			}, rinToken);
		}
		case ("picture-id"): {
			return tg("sendPhoto", {
				...commons,
				photo: input.id,
			}, rinToken);
		}
		case ("picture-bytes"): {
			const blob = new Blob([input.data], { type: "image/jpeg" });

			const formData = new FormData();
			formData.append("image", blob, "image.jpg");

			return tgFD("sendPhoto", formData, rinToken);
		}
		case ("album"): {
			return tg("sendMediaGroup", {
				...commons,
				media: input.ids.map(id => ({
					type: "photo",
					media: id
				})),
			}, rinToken);
		}
		case ("sticker"): {
			return tg("sendSticker", {
				...commons,
				sticker: input.id,
			}, rinToken);
		}
		case ("animation"): {
			return tg("sendAnimation", {
				...commons,
				animation: input.id,
			}, rinToken);
		}
		case ("audio"): {
			const id = input.id;
			return tg("sendAudio", {
				...commons,
				audio: id,
			}, rinToken);
		}
	}
}
