import { Ask } from "./types"

export const ask: Ask = async (key, dialog, systemPrompt, models, maxTokens = 3200) => {
	const messages = [
		systemPrompt ? {
			role: "system",
			content: systemPrompt
		} : null,
		...dialog.map(
			([fromUser, text, image]) => ({
				role: fromUser ? "user" : "assistant",
				content: [
					{
						type: "text",
						text: text,
					},
					image ? {
						type: "image_url",
						image_url: {
							url: image,
						},
					} : null,
				].filter(v => v)
			})
		)
	].filter(v => v);

	const response = await fetch(
		"https://openrouter.ai/api/v1/chat/completions",
		{
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"Authorization": `Bearer ${key}`
			},
			body: JSON.stringify({
				models: models ?? ["google/gemini-2.0-flash-exp:free"],
				messages,
				max_tokens: maxTokens
			})
		}
	);

	if (response.ok) {
		const yapping: any = await response.json();
		return {
			success: true,
			tokenUsage: yapping.usage.total_tokens,
			answer: yapping.choices[0].message.content as string,
			messages
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
