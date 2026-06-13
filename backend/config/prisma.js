// backend/config/prisma.js
// Singleton PrismaClient — the application's MySQL data layer.
const { PrismaClient } = require('@prisma/client');

const prisma = global.__domdomPrisma || new PrismaClient();
if (!global.__domdomPrisma) global.__domdomPrisma = prisma;

module.exports = prisma;
