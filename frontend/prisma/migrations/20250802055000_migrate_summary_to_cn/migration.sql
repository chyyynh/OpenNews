-- AddColumn
ALTER TABLE "articles" ADD COLUMN "title_cn" TEXT;
ALTER TABLE "articles" ADD COLUMN "summary_cn" TEXT;

-- Migrate existing summary data to summary_cn
UPDATE "articles" SET "summary_cn" = "summary" WHERE "summary" IS NOT NULL;

-- Clear the original summary column to prepare for English content
UPDATE "articles" SET "summary" = NULL;