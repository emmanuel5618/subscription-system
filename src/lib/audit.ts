import { Prisma } from "@prisma/client";
export async function audit(
tx: Prisma.TransactionClient,
actorId: string | null | undefined,
entityType: string,
entityId: string,
action: string,
before?: unknown,
after?: unknown
): Promise<void> {
await tx.auditLog.create({
data: {
actorId: actorId ?? undefined,
entityType,
entityId,
action,
before: before === undefined ? undefined : (before as Prisma.InputJsonValue),
after: after === undefined ? undefined : (after as Prisma.InputJsonValue)
}
});
}