import { cookies } from "next/headers";
import { randomBytes, createHash } from "crypto";
import { addDays } from "date-fns";
import { Role, User } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api-error";
const SESSION_COOKIE = "session";
function getSecret(): string {
return process.env.AUTH_SECRET ?? "dev-secret";
}
export function generateToken(): string {
return randomBytes(32).toString("hex");
}
export function hashToken(token: string): string {
return createHash("sha256").update(`${token}:${getSecret()}`).digest("hex");
}
export async function createSession(userId: string): Promise<void> {
const token = generateToken();
const tokenHash = hashToken(token);
await prisma.session.create({
data: {
userId,
tokenHash,
expiresAt: addDays(new Date(), 30)
}
});
cookies().set(SESSION_COOKIE, token, {
httpOnly: true,
path: "/",
sameSite: "lax",
secure: process.env.NODE_ENV === "production",
maxAge: 60 * 60 * 24 * 30
}); }
export async function destroySession(): Promise<void> {
const token = cookies().get(SESSION_COOKIE)?.value;
if (token) {
const tokenHash = hashToken(token);
await prisma.session.deleteMany({
where: { tokenHash }
});
}
cookies().delete(SESSION_COOKIE);
}
export async function getCurrentUser(): Promise<User | null> {
const token = cookies().get(SESSION_COOKIE)?.value;
if (!token) {
return null;
}
const tokenHash = hashToken(token);
const session = await prisma.session.findFirst({
where: {
tokenHash,
expiresAt: { gt: new Date() }
},
include: { user: true }
});
return session?.user ?? null;
}
export async function requireUser(): Promise<User> {
const user = await getCurrentUser();
if (!user) {
throw new ApiError(401, "Unauthorized");
}
return user; }
export async function requireRole(roles: Role[]): Promise<User> {
const user = await requireUser();
if (!roles.includes(user.role)) {
throw new ApiError(403, "Forbidden");
}
return user;
}