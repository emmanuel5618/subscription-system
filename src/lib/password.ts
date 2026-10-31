import bcrypt from "bcryptjs";
import { z } from "zod";
export const passwordSchema = z
.string()
.min(9, "Password must be more than 8 characters")
.regex(/[A-Z]/, "Password must contain at least one uppercase letter")
.regex(/[a-z]/, "Password must contain at least one lowercase letter")
.regex(/[^A-Za-z0-9]/, "Password must contain at least one special character");
export async function hashPassword(password: string): Promise<string> {
return bcrypt.hash(password, 12);
}
export async function verifyPassword(password: string, hash: string): Promise<boolean
> {
return bcrypt.compare(password, hash);
}