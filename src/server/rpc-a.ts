import { z } from "zod";
import { Role } from "@prisma/client";
import { addHours } from "date-fns";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api-error";
import { hashPassword, verifyPassword, passwordSchema } from "@/lib/password";
import {
createSession,
destroySession,
getCurrentUser,
generateToken,
hashToken,
requireRole
} from "@/lib/auth";
import { can, INTERNAL_ROLES } from "@/lib/permissions";
import { moduleRegistry } from "@/server/registry";
const signupSchema = z.object({
name: z.string().min(1),
email: z.string().email(),
password: passwordSchema
});
const loginSchema = z.object({
email: z.string().email(),
password: z.string().min(1)
});
const resetRequestSchema = z.object({
email: z.string().email()
});
const resetConfirmSchema = z.object({
token: z.string().min(10),
password: passwordSchema
});
const crudSchema = z.object({
module: z.string().min(1),
id: z.string().optional(), page: z.number().int().min(1).default(1),
pageSize: z.number().int().min(1).max(100).default(20),
data: z.record(z.any()).optional()
});
function normalizeEmail(email: string): string {
return email.trim().toLowerCase();
}
function getDelegate(table: string): any {
const delegate = (prisma as any)[table];
if (!delegate) {
throw new ApiError(404, "Module not found");
}
return delegate;
}
export async function handleRpcA(op: string, body: any): Promise<any> {
if (op === "signup") {
const input = signupSchema.parse(body);
const email = normalizeEmail(input.email);
const existing = await prisma.user.findUnique({ where: { email } });
if (existing) {
throw new ApiError(409, "Email already exists");
}
const passwordHash = await hashPassword(input.password);
await prisma.$transaction([
prisma.user.create({
data: {
email,
passwordHash,
role: Role.CUSTOMER,
customer: {
create: {
name: input.name,
email
} }
}
})
]);
return { ok: true };
}
if (op === "login") {
const input = loginSchema.parse(body);
const email = normalizeEmail(input.email);
const user = await prisma.user.findUnique({ where: { email } });
if (!user) {
throw new ApiError(401, "Invalid credentials");
}
const valid = await verifyPassword(input.password, user.passwordHash);
if (!valid) {
throw new ApiError(401, "Invalid credentials");
}
await createSession(user.id);
return { ok: true };
}
if (op === "logout") {
await destroySession();
return { ok: true };
}
if (op === "resetRequest") {
const input = resetRequestSchema.parse(body);
const email = normalizeEmail(input.email);
const user = await prisma.user.findUnique({ where: { email } });
if (user) {
const token = generateToken();
const tokenHash = hashToken(token); await prisma.passwordResetToken.create({
data: {
userId: user.id,
tokenHash,
expiresAt: addHours(new Date(), 1)
}
});
console.log(`Password reset token for ${email}: ${token}`);
return {
ok: true,
devToken: process.env.NODE_ENV !== "production" ? token : undefined
};
}
return { ok: true };
}
if (op === "resetConfirm") {
const input = resetConfirmSchema.parse(body);
const tokenHash = hashToken(input.token);
const resetToken = await prisma.passwordResetToken.findFirst({
where: {
tokenHash,
usedAt: null,
expiresAt: { gt: new Date() }
}
});
if (!resetToken) {
throw new ApiError(400, "Invalid or expired reset token");
}
const passwordHash = await hashPassword(input.password);
await prisma.$transaction([
prisma.user.update({
where: { id: resetToken.userId },
data: { passwordHash }
}),
prisma.passwordResetToken.update({ where: { id: resetToken.id },
data: { usedAt: new Date() }
}),
prisma.session.deleteMany({
where: { userId: resetToken.userId }
})
]);
return { ok: true };
}
const user = await getCurrentUser();
if (op === "meta") {
if (!user || !can(user.role, INTERNAL_ROLES)) {
throw new ApiError(403, "Forbidden");
}
return { modules: Object.keys(moduleRegistry) };
}
if (!user) {
throw new ApiError(401, "Unauthorized");
}
if (op === "list") {
const input = crudSchema.parse(body);
const config = moduleRegistry[input.module];
if (!config) {
throw new ApiError(404, "Module not found");
}
if (!can(user.role, config.read)) {
throw new ApiError(403, "Forbidden");
}
const delegate = getDelegate(config.table);
const [items, total] = await Promise.all([
delegate.findMany({
skip: (input.page - 1) * input.pageSize,
take: input.pageSize, orderBy: { id: "asc" }
}),
delegate.count()
]);
return { items, total };
}
if (op === "create") {
const input = crudSchema.parse(body);
const config = moduleRegistry[input.module];
if (!config) {
throw new ApiError(404, "Module not found");
}
if (!can(user.role, config.write)) {
throw new ApiError(403, "Forbidden");
}
const data = config.create.parse(input.data ?? {});
const delegate = getDelegate(config.table);
const item = await delegate.create({ data });
return { item };
}
if (op === "update") {
const input = crudSchema.parse(body);
const config = moduleRegistry[input.module];
if (!config || !input.id) {
throw new ApiError(400, "Module and id are required");
}
if (!can(user.role, config.write)) {
throw new ApiError(403, "Forbidden");
}
const data = config.update.parse(input.data ?? {});
const delegate = getDelegate(config.table);
const item = await delegate.update({
where: { id: input.id }, data
});
return { item };
}
if (op === "delete") {
const input = crudSchema.parse(body);
const config = moduleRegistry[input.module];
if (!config || !input.id) {
throw new ApiError(400, "Module and id are required");
}
if (!can(user.role, config.write)) {
throw new ApiError(403, "Forbidden");
}
const delegate = getDelegate(config.table);
await delegate.delete({ where: { id: input.id } });
return { ok: true };
}
throw new ApiError(404, "Unknown operation");
}