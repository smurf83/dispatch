export const systemSuperUserEmails = new Set(['suemurphy24@gmail.com']);
export const isSystemSuperUser = email => systemSuperUserEmails.has(email.trim().toLowerCase());
