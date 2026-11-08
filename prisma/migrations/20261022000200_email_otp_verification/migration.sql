ALTER TABLE `users`
  ADD COLUMN `emailVerified` BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE `email_verification_challenges` (
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
    `attemptWindowStartedAt` DATETIME(3) NOT NULL,
    `lockedUntil` DATETIME(3) NULL,
    `verifiedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    UNIQUE INDEX `email_verification_challenges_userId_key`(`userId`),
    UNIQUE INDEX `email_verification_challenges_tokenHash_key`(`tokenHash`),
    INDEX `email_verification_challenges_expiresAt_idx`(`expiresAt`),
    INDEX `email_verification_challenges_lastSentAt_idx`(`lastSentAt`),
    PRIMARY KEY (`id`),
    CONSTRAINT `email_verification_challenges_userId_fkey`
      FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
