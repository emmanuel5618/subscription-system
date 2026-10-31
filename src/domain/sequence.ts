import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
export async function nextSequence(
key: string,
prefix: string,
tx?: Prisma.TransactionClient
): Promise<string> {
const client = tx ?? prisma;
const counter = await client.sequenceCounter.upsert({
where: { key },
update: { lastValue: { increment: 1 } },
create: { key, lastValue: 1 }
});
const year = new Date().getFullYear();
return `${prefix}-${year}-${String(counter.lastValue).padStart(6, "0")}`;
}