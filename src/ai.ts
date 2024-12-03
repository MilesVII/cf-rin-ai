
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
		const response = await ai.run('@cf/black-forest-labs/flux-1-schnell', {
			prompt,
		});
		
		//@ts-ignore
		const binaryString = [...atob(response.image)].map(c => c.codePointAt(0) ?? 0);
		return Uint8Array.from(binaryString);
	}
}
