CREATE TABLE `employer_verification_documents` (
    `id` VARCHAR(64) NOT NULL,
    `employerId` VARCHAR(191) NOT NULL,
    `verificationRecordId` VARCHAR(191) NOT NULL,
    `category` ENUM('BUSINESS_REGISTRATION', 'TIN_CERTIFICATE', 'SUPPORTING') NOT NULL,
    `originalFilename` VARCHAR(255) NOT NULL,
    `storageKey` VARCHAR(80) NOT NULL,
    `contentType` VARCHAR(100) NOT NULL,
    `sizeBytes` INT UNSIGNED NOT NULL,
    `status` ENUM('PENDING', 'APPROVED', 'REJECTED', 'RESUBMISSION_REQUIRED') NOT NULL DEFAULT 'PENDING',
    `reviewerAdminId` VARCHAR(191) NULL,
    `reviewNotes` TEXT NULL,
    `submittedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `reviewedAt` DATETIME(3) NULL,
    `archivedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (`id`),
    UNIQUE INDEX `employer_verification_documents_storageKey_key` (`storageKey`),
    INDEX `employer_verification_documents_employerId_submittedAt_idx` (`employerId`, `submittedAt`),
    INDEX `employer_verification_documents_verificationRecordId_idx` (`verificationRecordId`),
    INDEX `employer_verification_documents_status_idx` (`status`),
    CONSTRAINT `employer_verification_documents_employerId_fkey`
      FOREIGN KEY (`employerId`) REFERENCES `employer_profiles` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `employer_verification_documents_verificationRecordId_fkey`
      FOREIGN KEY (`verificationRecordId`) REFERENCES `employer_verification_records` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `employer_verification_documents_reviewerAdminId_fkey`
      FOREIGN KEY (`reviewerAdminId`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
