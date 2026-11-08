ALTER TABLE `job_applications`
  MODIFY COLUMN `status` ENUM(
    'APPLIED',
    'SCREENING',
    'SHORTLISTED',
    'TECHNICAL_ASSESSMENT',
    'INTERVIEW_SCHEDULED',
    'OFFERED',
    'HIRED',
    'REJECTED',
    'WITHDRAWN'
  ) NOT NULL DEFAULT 'APPLIED';

CREATE TABLE `employer_message_batches` (
  `id` VARCHAR(191) NOT NULL,
  `senderUserId` VARCHAR(191) NOT NULL,
  `payloadHash` CHAR(64) NOT NULL,
  `recipientCount` INTEGER NOT NULL DEFAULT 0,
  `completedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `employer_message_batches_senderUserId_createdAt_idx`(`senderUserId`, `createdAt`),
  PRIMARY KEY (`id`),
  CONSTRAINT `employer_message_batches_senderUserId_fkey`
    FOREIGN KEY (`senderUserId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `application_messages`
  ADD COLUMN `deliveryBatchId` VARCHAR(191) NULL,
  ADD UNIQUE INDEX `application_messages_deliveryBatchId_applicationId_key`(`deliveryBatchId`, `applicationId`),
  ADD CONSTRAINT `application_messages_deliveryBatchId_fkey`
    FOREIGN KEY (`deliveryBatchId`) REFERENCES `employer_message_batches`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
