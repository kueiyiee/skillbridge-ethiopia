ALTER TABLE `users`
  ADD COLUMN `authVersion` INT UNSIGNED NOT NULL DEFAULT 0;

CREATE TABLE `password_reset_challenges` (
  `id` VARCHAR(64) NOT NULL,
  `userId` VARCHAR(191) NULL,
  `email` VARCHAR(191) NOT NULL,
  `isDecoy` BOOLEAN NOT NULL DEFAULT false,
  `tokenHash` CHAR(64) NOT NULL,
  `codeHash` CHAR(64) NOT NULL,
  `expiresAt` DATETIME(3) NOT NULL,
  `lastSentAt` DATETIME(3) NOT NULL,
  `hourWindowStartedAt` DATETIME(3) NOT NULL,
  `sendsInHour` TINYINT UNSIGNED NOT NULL DEFAULT 1,
  `dayWindowStartedAt` DATETIME(3) NOT NULL,
  `sendsInDay` SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  `failedAttempts` TINYINT UNSIGNED NOT NULL DEFAULT 0,
  `consumedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `password_reset_challenges_userId_key`(`userId`),
  UNIQUE INDEX `password_reset_challenges_tokenHash_key`(`tokenHash`),
  INDEX `password_reset_challenges_expiresAt_idx`(`expiresAt`),
  INDEX `password_reset_challenges_lastSentAt_idx`(`lastSentAt`),
  PRIMARY KEY (`id`),
  CONSTRAINT `password_reset_challenges_userId_fkey`
    FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
