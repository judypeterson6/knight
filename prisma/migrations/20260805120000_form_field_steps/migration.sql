-- AlterTable: multi-step form support
ALTER TABLE `FormField` ADD COLUMN `step` INTEGER NOT NULL DEFAULT 1;
ALTER TABLE `FormField` ADD COLUMN `stepTitle` VARCHAR(160) NULL;