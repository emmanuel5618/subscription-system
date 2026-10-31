import { Role } from "@prisma/client";
export const INTERNAL_ROLES: Role[] = [
Role.ADMIN,
Role.SALES,
Role.FINANCE,
Role.SUPPORT
];
export const ADMIN_ONLY: Role[] = [Role.ADMIN];
export const FINANCE_ROLES: Role[] = [Role.ADMIN, Role.FINANCE];
export const SALES_ROLES: Role[] = [Role.ADMIN, Role.SALES];
export function can(role: Role, allowed: Role[]): boolean {
return allowed.includes(role);
}