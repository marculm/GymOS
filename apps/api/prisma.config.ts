import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    // Plain lookup so prisma generate works without DATABASE_URL.
    url: process.env.DATABASE_URL,
  },
});
