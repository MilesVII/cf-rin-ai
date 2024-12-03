
export type AIChatPrompt = {
	role: "user" | "system",
	content: string
}

export type AIUnit = ReturnType<typeof aiFactory>;
export type AIDrawUnit = ReturnType<typeof aiDrawFactory>;

export function aiFactory(ai: Ai){
	return async (chat: AIChatPrompt[], systemPrompt: string) => {
		const messages = [
			{ role: "system", content: systemPrompt },
			...chat,
		];
	
		//@ts-ignore
		const response = await ai.run("@hf/thebloke/llama-2-13b-chat-awq", {
			messages
		});
	
		//@ts-ignore
		return response?.response as string ?? "AI implementation failure";
	}
}

export function aiDrawFactory(ai: Ai){
	return async (prompt: string) => {
		//@ts-ignore
		const response = await ai.run('@cf/stabilityai/stable-diffusion-xl-base-1.0', {
			prompt,
		});
		
		const reader = response.getReader();
		const result: number[] = [];

		while (true) {
			const { value, done } = await reader.read();
			if (done) break;
			
			result.push(...value);
		}

		return Uint8Array.from(result);
	}
}
