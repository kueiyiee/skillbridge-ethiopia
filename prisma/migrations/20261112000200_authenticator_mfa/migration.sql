CREATE TABLE `user_mfa_factors` (
  `userId` VARCHAR(191) NOT NULL,
  `secretCiphertext` TEXT NOT NULL,
  `secretIv` VARCHAR(32) NOT NULL,
  `secretTag` VARCHAR(32) NOT NULL,
  `enabledAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`userId`),
  CONSTRAINT `user_mfa_factors_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `user_mfa_recovery_codes` (
  `id` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `codeHash` CHAR(64) NOT NULL,
  `usedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `user_mfa_recovery_codes_userId_codeHash_key` (`userId`, `codeHash`),
  INDEX `user_mfa_recovery_codes_userId_usedAt_idx` (`userId`, `usedAt`),
  CONSTRAINT `user_mfa_recovery_codes_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `auth_mfa_challenges` (
  `id` CHAR(36) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `expiresAt` DATETIME(3) NOT NULL,
  `usedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `auth_mfa_challenges_userId_expiresAt_idx` (`userId`, `expiresAt`),
  CONSTRAINT `auth_mfa_challenges_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
