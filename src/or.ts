import { Ask } from "./types"

export const ask: Ask = async (key, dialog, systemPrompt, models) => {
	const response = await fetch(
		"https://openrouter.ai/api/v1/chat/completions",
		{
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"Authorization": `Bearer ${key}`
			},
			body: JSON.stringify({
				"models": models ?? ["google/gemini-2.0-flash-exp:free"],
				"messages": [
					{
						role: "system",
						content: systemPrompt
					},
					...dialog.map(
						([fromUser, text]) => ({
							role: fromUser ? "user" : "assistant",
							content: text
						})
					)
				],
				"max_tokens": 3200
			})
		}
	);

	if (response.ok) {
		const yapping: any = await response.json();
		console.warn({
			RRR: yapping.choices[0].message.content,
			EEE: yapping.usage.total_tokens,
			BBB: [
				{
					role: "system",
					content: systemPrompt
				},
				...dialog.map(
					([fromUser, text]) => ({
						role: fromUser ? "user" : "assistant",
						content: text
					})
				)
			]
		});
		return {
			success: true,
			tokenUsage: yapping.usage.total_tokens,
			answer: yapping.choices[0].message.content as string
		};
	} else {
		const error = await response.text();
		console.error(error);
		return {
			success: false,
			code: response.status,
			message: error
		};
	}
}
