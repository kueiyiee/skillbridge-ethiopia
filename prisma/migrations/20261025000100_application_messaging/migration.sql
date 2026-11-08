CREATE TABLE `application_messages` (
    `id` VARCHAR(191) NOT NULL,
    `applicationId` VARCHAR(191) NOT NULL,
    `senderUserId` VARCHAR(191) NOT NULL,
    `recipientUserId` VARCHAR(191) NOT NULL,
    `kind` ENUM('MESSAGE', 'APPLICATION_UPDATE', 'SHORTLISTED', 'INTERVIEW_INVITATION', 'INFORMATION_REQUEST', 'ASSESSMENT_REQUEST') NOT NULL DEFAULT 'MESSAGE',
    `subject` VARCHAR(191) NULL,
    `body` TEXT NOT NULL,
    `dueAt` DATETIME(3) NULL,
    `actionStatus` ENUM('NONE', 'PENDING', 'ACCEPTED', 'DECLINED') NOT NULL DEFAULT 'NONE',
    `readAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `application_messages_applicationId_createdAt_idx`(`applicationId`, `createdAt`),
    INDEX `application_messages_recipientUserId_readAt_createdAt_idx`(`recipientUserId`, `readAt`, `createdAt`),
    INDEX `application_messages_senderUserId_createdAt_idx`(`senderUserId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `application_messages`
  ADD CONSTRAINT `application_messages_applicationId_fkey` FOREIGN KEY (`applicationId`) REFERENCES `job_applications`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `application_messages`
  ADD CONSTRAINT `application_messages_senderUserId_fkey` FOREIGN KEY (`senderUserId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `application_messages`
  ADD CONSTRAINT `application_messages_recipientUserId_fkey` FOREIGN KEY (`recipientUserId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
