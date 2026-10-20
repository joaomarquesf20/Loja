import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Vazio é aceite pelo `prisma generate` (não liga à BD); `migrate` falha com erro próprio se faltar.
    url: process.env.DATABASE_URL ?? "",
  },
});
