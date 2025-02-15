// import axios from "axios";
import { AIDrawUnit, aiFactory, AIUnit } from "./ai";
import { ask } from "./gemini";
import { type Storage } from "./storage";
import { tg, pickRandom, sleep, escapeMarkdown, popRandom, tgFD, recoverConversationChain } from "./utils";
import seedrandom from "seedrandom";

export type RinMessage = {
	personal: boolean,
	origin: {
		id: number,
		sender: string,
		chat: string,
		text: string
	}
	isReply?: {
		to: string,
		message: {
			id: number,
			text: string
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

export async function processRinMessage(message: RinMessage, tgToken: string, storage: Storage, geminiKey: string, drawAi: AIDrawUnit) {
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

	await rinModel(message, sayWrapped, storage, geminiKey, drawAi);
}

function roll(threshold: number) {
	return Math.random() < threshold;
}

async function rinModel(message: RinMessage, say: SayFunction, storage: Storage, geminiKey: string, drawAi: AIDrawUnit){
	const prefs = await storage.get("config");
	const state = await storage.get("state");

	const masterSpeaking = prefs.masters.some((m: any) => message.origin.sender == m);
	const autoAppeal = (message.isReply?.to == prefs.me);
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
				
				const chain = [[true, aiPrefs.tarotPromptTemplate.replace("#", pulledCardsNames)] as [boolean, string]];
				const aiResponsePromise = ask(geminiKey, chain, aiPrefs.tarotPrompt);

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

				const aiResponse = await aiResponsePromise;
				const answer = aiResponse.success ? aiResponse.answer : `E${aiResponse.code}: ${aiResponse.message}`

				await say({
					mode: "text",
					text: answer
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
			case ("draw"): {
				const commands = prefs.appealedCommands.find(({command}) => command === "draw")?.triggers
				if (!commands) break;

				let prompt: string | null = null;
				for (let cmd of commands) {
					const pt = messageText.split(cmd)[1];
					if (pt) {
						prompt = pt;
						break;
					}
				}
				if (!prompt) break;

				const response = await drawAi(prompt);
				await say({
					mode: "picture-bytes",
					data: response,
					reply: message.isReply?.to
				});
				break;
			}
			case ("hypno"): {
				const newPrompt = messageText.split("\n").slice(1).join("\n");
				if (newPrompt.trim().length <= 1) {
					await say({
						mode: "text",
						text: "Prompt too short; Prompt is read after first newline"
					});
				} else {
					const aiPrefs = await storage.get("ai");
					aiPrefs.systemPrompt = newPrompt;
					await storage.set("ai", aiPrefs);

					await say({
						mode: "text",
						text: "Prompt override complete"
					});
				}
			}
			default: {
				if (!msgOriginal) break;

				const aiPrefs = await storage.get("ai");
				const conversations = await storage.get("aiConversations") ?? {};
				if (message.isReply && !conversations[message.isReply.message.id])
					conversations[message.isReply.message.id] = {
						previous: null,
						text: message.isReply.message.text,
						fromUser: false
					};
				if (!conversations[message.origin.id])
					conversations[message.origin.id] = {
						previous: message.isReply?.message.id ?? null,
						text: message.origin.text,
						fromUser: true
					};

				const chain = recoverConversationChain(conversations, message.origin.id);
				const response = await ask(geminiKey, chain, aiPrefs.systemPrompt)
				const tgResponse = await say({
					mode: "text",
					text: response.success ? response.answer : `E${response.code}: ${response.message}`,
					reply: message.isReply?.to
				});
				if (tgResponse.ok && response.success) {
					const tgData = await tgResponse.json() as any;
					if (tgData.ok) {

						const responseMessageId = tgData.result.message_id as number;
						conversations[responseMessageId] = {
							previous: message.origin.id,
							text: response.answer,
							fromUser: false
						};
						
						await storage.set("aiConversations", conversations);
					}
				}
				break;
			}
		}
	} else {
		if (state.drafted && masterSpeaking) {
			await say({
				mode: "text",
				text: msgOriginal
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
			const blob = new Blob([input.data], { type: "image/png" });

			const formData = new FormData();
			formData.append("chat_id", commons.chat_id);
			formData.append("photo", blob, "image.png");

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
