ALTER TABLE `users` ADD COLUMN `username` VARCHAR(64) NULL;

CREATE UNIQUE INDEX `users_username_key` ON `users` (`username`);

CREATE TABLE `auth_token_revocations` (
    `tokenId` CHAR(36) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    INDEX `auth_token_revocations_expiresAt_idx`(`expiresAt`),
    PRIMARY KEY (`tokenId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;