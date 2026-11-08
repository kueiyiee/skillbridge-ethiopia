ALTER TABLE `users` ADD COLUMN `archivedAt` DATETIME(3) NULL;
ALTER TABLE `employer_profiles` ADD COLUMN `archivedAt` DATETIME(3) NULL;
ALTER TABLE `jobs` ADD COLUMN `archivedAt` DATETIME(3) NULL;
ALTER TABLE `employer_verification_records` ADD COLUMN `archivedAt` DATETIME(3) NULL;
ALTER TABLE `job_applications` ADD COLUMN `archivedAt` DATETIME(3) NULL;
