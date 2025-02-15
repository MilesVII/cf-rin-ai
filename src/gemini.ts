const model = "gemini-2.0-flash";
const url = (key: string) => `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;

export async function ask(key: string, message: string, systemPrompt: string) {
	const payload = {
		systemInstruction: {
			parts: { "text": systemPrompt }
		},
		contents: {
			parts: { "text": message }
		},
		safetySettings:
			[
				"HARM_CATEGORY_HARASSMENT",
				"HARM_CATEGORY_HATE_SPEECH",
				"HARM_CATEGORY_SEXUALLY_EXPLICIT",
				"HARM_CATEGORY_DANGEROUS_CONTENT",
				"HARM_CATEGORY_CIVIC_INTEGRITY"
			].map(category => ({
				category: category,
				threshold: "BLOCK_NONE"
			})),
		// generationConfig: {
		// 	"stopSequences": [
		// 		"Title"
		// 	],
		// 	"temperature": 1.0,
		// 	"maxOutputTokens": 800,
		// 	"topP": 0.8,
		// 	"topK": 10
		// }
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
