CREATE TABLE `issued_reports` (
  `id` VARCHAR(32) NOT NULL,
  `issuerUserId` VARCHAR(191) NOT NULL,
  `issuerRole` ENUM('ADMIN', 'EMPLOYER') NOT NULL,
  `employerId` VARCHAR(191) NULL,
  `reportType` VARCHAR(80) NOT NULL,
  `reportTitle` VARCHAR(191) NOT NULL,
  `generatedAt` DATETIME(3) NOT NULL,
  `reportHash` CHAR(64) NOT NULL,
  `recordCount` INT UNSIGNED NOT NULL DEFAULT 0,
  `status` ENUM('VALID', 'REVOKED') NOT NULL DEFAULT 'VALID',
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `revokedAt` DATETIME(3) NULL,
  PRIMARY KEY (`id`),
  INDEX `issued_reports_issuerUserId_createdAt_idx` (`issuerUserId`, `createdAt`),
  INDEX `issued_reports_employerId_createdAt_idx` (`employerId`, `createdAt`),
  INDEX `issued_reports_status_createdAt_idx` (`status`, `createdAt`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
