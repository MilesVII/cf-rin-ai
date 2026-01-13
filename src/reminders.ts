import { KyselyDB } from "./db";
import { parseDateDMY } from "./utils";

export async function add(db: KyselyDB, chat: string, at: string, message: string) {
	await db
		.insertInto("reminders")
		.values({ chat, at, message })
		.execute();
}

export async function list(db: KyselyDB, chat: string) {
	const reminders = await db
		.selectFrom("reminders")
		.selectAll()
		.where("chat", "=", chat)
		.execute();

	const sorted = reminders
		.map(
			({ id, at, message }) => {
				const [, date] = parseDateDMY(at);
				return {
					id, message,
					at: date!.getTime(),
					date: date!.toLocaleDateString("ru")
				};
			}
		)
		.sort((a, b) => a.at - b.at);

	return sorted;
}

export async function remove(db: KyselyDB, id: number, chat: string) {
	
	await db
	.deleteFrom("reminders")
	.where("id", "=", id)
	.where("chat", "=", chat)
	.execute();
}

export async function removeFew(db: KyselyDB, ids: number[]) {
	await db
		.deleteFrom("reminders")
		.where("id", "in", ids)
		.execute();
}