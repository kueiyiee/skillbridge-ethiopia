-- CreateTable
CREATE TABLE `users` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `passwordHash` VARCHAR(191) NOT NULL,
    `fullName` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NULL,
    `role` ENUM('JOB_SEEKER', 'EMPLOYER', 'ADMIN') NOT NULL DEFAULT 'JOB_SEEKER',
    `avatarUrl` VARCHAR(191) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `users_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `job_seeker_profiles` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `headline` VARCHAR(191) NULL,
    `bio` TEXT NULL,
    `experienceYears` INTEGER NOT NULL DEFAULT 0,
    `educationLevel` VARCHAR(191) NULL,
    `institutionName` VARCHAR(191) NULL,
    `city` VARCHAR(191) NOT NULL DEFAULT 'Addis Ababa',
    `subCity` VARCHAR(191) NULL,
    `resumeUrl` VARCHAR(191) NULL,
    `portfolioUrl` VARCHAR(191) NULL,
    `githubUrl` VARCHAR(191) NULL,
    `linkedinUrl` VARCHAR(191) NULL,
    `desiredRole` VARCHAR(191) NULL,
    `desiredSalaryETB` INTEGER NULL,
    `availableForWork` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `job_seeker_profiles_userId_key`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `employer_profiles` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `companyName` VARCHAR(191) NOT NULL,
    `industry` VARCHAR(191) NOT NULL,
    `tinNumber` VARCHAR(191) NULL,
    `businessLicenseNo` VARCHAR(191) NULL,
    `city` VARCHAR(191) NOT NULL DEFAULT 'Addis Ababa',
    `address` VARCHAR(191) NULL,
    `website` VARCHAR(191) NULL,
    `employeeRange` VARCHAR(191) NOT NULL DEFAULT '11-50',
    `companyOverview` TEXT NULL,
    `logoUrl` VARCHAR(191) NULL,
    `isApproved` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `employer_profiles_userId_key`(`userId`),
    UNIQUE INDEX `employer_profiles_tinNumber_key`(`tinNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `employer_verification_records` (
    `id` VARCHAR(191) NOT NULL,
    `employerId` VARCHAR(191) NOT NULL,
    `tinNumber` VARCHAR(191) NOT NULL,
    `businessLicenseNo` VARCHAR(191) NOT NULL,
    `documentUrl` VARCHAR(191) NULL,
    `status` ENUM('PENDING', 'APPROVED', 'REJECTED', 'RESUBMISSION_REQUIRED') NOT NULL DEFAULT 'PENDING',
    `reviewerAdminId` VARCHAR(191) NULL,
    `reviewNotes` TEXT NULL,
    `disclaimer` VARCHAR(191) NOT NULL DEFAULT 'Platform verification represents internal review of submitted business credentials and does not constitute a government or legal guarantee.',
    `reviewedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `employer_verification_records_employerId_idx`(`employerId`),
    INDEX `employer_verification_records_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `skills` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `category` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `demandRating` INTEGER NOT NULL DEFAULT 3,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `skills_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `job_seeker_skills` (
    `id` VARCHAR(191) NOT NULL,
    `jobSeekerId` VARCHAR(191) NOT NULL,
    `skillId` VARCHAR(191) NOT NULL,
    `proficiencyLevel` ENUM('BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT') NOT NULL DEFAULT 'INTERMEDIATE',
    `yearsExperience` DOUBLE NOT NULL DEFAULT 1.0,
    `isVerified` BOOLEAN NOT NULL DEFAULT false,
    `verifiedMethod` VARCHAR(191) NULL,
    `verifiedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `job_seeker_skills_jobSeekerId_idx`(`jobSeekerId`),
    INDEX `job_seeker_skills_skillId_idx`(`skillId`),
    UNIQUE INDEX `job_seeker_skills_jobSeekerId_skillId_key`(`jobSeekerId`, `skillId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `jobs` (
    `id` VARCHAR(191) NOT NULL,
    `employerId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `department` VARCHAR(191) NULL,
    `jobType` ENUM('FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP', 'REMOTE', 'HYBRID') NOT NULL DEFAULT 'FULL_TIME',
    `city` VARCHAR(191) NOT NULL DEFAULT 'Addis Ababa',
    `workplaceType` VARCHAR(191) NOT NULL DEFAULT 'Hybrid',
    `summary` TEXT NOT NULL,
    `responsibilities` TEXT NOT NULL,
    `qualifications` TEXT NOT NULL,
    `minExperienceYears` INTEGER NOT NULL DEFAULT 1,
    `salaryMinETB` INTEGER NULL,
    `salaryMaxETB` INTEGER NULL,
    `isSalaryNegotiable` BOOLEAN NOT NULL DEFAULT true,
    `status` ENUM('DRAFT', 'ACTIVE', 'PAUSED', 'CLOSED') NOT NULL DEFAULT 'ACTIVE',
    `deadline` DATETIME(3) NULL,
    `viewsCount` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `jobs_employerId_idx`(`employerId`),
    INDEX `jobs_status_idx`(`status`),
    INDEX `jobs_city_idx`(`city`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `job_skill_requirements` (
    `id` VARCHAR(191) NOT NULL,
    `jobId` VARCHAR(191) NOT NULL,
    `skillId` VARCHAR(191) NOT NULL,
    `isMandatory` BOOLEAN NOT NULL DEFAULT true,
    `weight` INTEGER NOT NULL DEFAULT 3,
    `requiredLevel` ENUM('BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT') NOT NULL DEFAULT 'INTERMEDIATE',

    INDEX `job_skill_requirements_jobId_idx`(`jobId`),
    INDEX `job_skill_requirements_skillId_idx`(`skillId`),
    UNIQUE INDEX `job_skill_requirements_jobId_skillId_key`(`jobId`, `skillId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `job_applications` (
    `id` VARCHAR(191) NOT NULL,
    `jobId` VARCHAR(191) NOT NULL,
    `jobSeekerId` VARCHAR(191) NOT NULL,
    `coverNote` TEXT NULL,
    `resumeSnapshotUrl` VARCHAR(191) NULL,
    `status` ENUM('APPLIED', 'SCREENING', 'TECHNICAL_ASSESSMENT', 'INTERVIEW_SCHEDULED', 'OFFERED', 'REJECTED', 'WITHDRAWN') NOT NULL DEFAULT 'APPLIED',
    `matchScore` INTEGER NOT NULL DEFAULT 0,
    `statusNotes` TEXT NULL,
    `appliedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `job_applications_jobSeekerId_idx`(`jobSeekerId`),
    INDEX `job_applications_jobId_idx`(`jobId`),
    INDEX `job_applications_status_idx`(`status`),
    UNIQUE INDEX `job_applications_jobId_jobSeekerId_key`(`jobId`, `jobSeekerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `saved_jobs` (
    `id` VARCHAR(191) NOT NULL,
    `jobSeekerId` VARCHAR(191) NOT NULL,
    `jobId` VARCHAR(191) NOT NULL,
    `savedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `saved_jobs_jobSeekerId_idx`(`jobSeekerId`),
    UNIQUE INDEX `saved_jobs_jobSeekerId_jobId_key`(`jobSeekerId`, `jobId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `skill_assessments` (
    `id` VARCHAR(191) NOT NULL,
    `jobSeekerId` VARCHAR(191) NOT NULL,
    `skillId` VARCHAR(191) NOT NULL,
    `scorePercentage` DOUBLE NOT NULL,
    `levelAchieved` ENUM('BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT') NOT NULL,
    `questionsCount` INTEGER NOT NULL DEFAULT 10,
    `completedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `skill_assessments_jobSeekerId_idx`(`jobSeekerId`),
    INDEX `skill_assessments_skillId_idx`(`skillId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `skill_gap_results` (
    `id` VARCHAR(191) NOT NULL,
    `jobSeekerId` VARCHAR(191) NOT NULL,
    `jobId` VARCHAR(191) NOT NULL,
    `matchPercentage` DOUBLE NOT NULL,
    `matchedSkillsJson` TEXT NOT NULL,
    `missingSkillsJson` TEXT NOT NULL,
    `aiRoadmapJson` TEXT NULL,
    `calculatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `skill_gap_results_jobSeekerId_idx`(`jobSeekerId`),
    INDEX `skill_gap_results_jobId_idx`(`jobId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `recommendations` (
    `id` VARCHAR(191) NOT NULL,
    `jobSeekerId` VARCHAR(191) NOT NULL,
    `jobId` VARCHAR(191) NOT NULL,
    `score` DOUBLE NOT NULL,
    `reasoning` TEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `recommendations_jobSeekerId_idx`(`jobSeekerId`),
    UNIQUE INDEX `recommendations_jobSeekerId_jobId_key`(`jobSeekerId`, `jobId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `employer_feedbacks` (
    `id` VARCHAR(191) NOT NULL,
    `employerId` VARCHAR(191) NOT NULL,
    `jobSeekerId` VARCHAR(191) NOT NULL,
    `jobId` VARCHAR(191) NOT NULL,
    `period` VARCHAR(191) NOT NULL,
    `technicalScore` DOUBLE NOT NULL,
    `deliveryScore` DOUBLE NOT NULL,
    `communicationScore` DOUBLE NOT NULL,
    `adaptabilityScore` DOUBLE NOT NULL,
    `overallScore` DOUBLE NOT NULL,
    `strengths` TEXT NOT NULL,
    `growthAreas` TEXT NOT NULL,
    `retentionRecommendation` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `employer_feedbacks_employerId_idx`(`employerId`),
    INDEX `employer_feedbacks_jobSeekerId_idx`(`jobSeekerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `platform_audit_logs` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NULL,
    `action` VARCHAR(191) NOT NULL,
    `entityType` VARCHAR(191) NOT NULL,
    `entityId` VARCHAR(191) NULL,
    `details` TEXT NULL,
    `ipAddress` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `platform_audit_logs_userId_idx`(`userId`),
    INDEX `platform_audit_logs_action_idx`(`action`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ai_nexus_conversations` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `role` ENUM('JOB_SEEKER', 'EMPLOYER', 'ADMIN') NOT NULL,
    `title` VARCHAR(191) NOT NULL DEFAULT 'New Conversation',
    `contextRoute` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ai_nexus_conversations_userId_idx`(`userId`),
    INDEX `ai_nexus_conversations_role_idx`(`role`),
    INDEX `ai_nexus_conversations_updatedAt_idx`(`updatedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ai_nexus_messages` (
    `id` VARCHAR(191) NOT NULL,
    `conversationId` VARCHAR(191) NOT NULL,
    `sender` VARCHAR(191) NOT NULL,
    `content` TEXT NOT NULL,
    `isAiGenerated` BOOLEAN NOT NULL DEFAULT true,
    `metadata` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ai_nexus_messages_conversationId_idx`(`conversationId`),
    INDEX `ai_nexus_messages_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `job_seeker_profiles` ADD CONSTRAINT `job_seeker_profiles_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employer_profiles` ADD CONSTRAINT `employer_profiles_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employer_verification_records` ADD CONSTRAINT `employer_verification_records_employerId_fkey` FOREIGN KEY (`employerId`) REFERENCES `employer_profiles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `job_seeker_skills` ADD CONSTRAINT `job_seeker_skills_jobSeekerId_fkey` FOREIGN KEY (`jobSeekerId`) REFERENCES `job_seeker_profiles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `job_seeker_skills` ADD CONSTRAINT `job_seeker_skills_skillId_fkey` FOREIGN KEY (`skillId`) REFERENCES `skills`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `jobs` ADD CONSTRAINT `jobs_employerId_fkey` FOREIGN KEY (`employerId`) REFERENCES `employer_profiles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `job_skill_requirements` ADD CONSTRAINT `job_skill_requirements_jobId_fkey` FOREIGN KEY (`jobId`) REFERENCES `jobs`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `job_skill_requirements` ADD CONSTRAINT `job_skill_requirements_skillId_fkey` FOREIGN KEY (`skillId`) REFERENCES `skills`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `job_applications` ADD CONSTRAINT `job_applications_jobId_fkey` FOREIGN KEY (`jobId`) REFERENCES `jobs`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `job_applications` ADD CONSTRAINT `job_applications_jobSeekerId_fkey` FOREIGN KEY (`jobSeekerId`) REFERENCES `job_seeker_profiles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `saved_jobs` ADD CONSTRAINT `saved_jobs_jobSeekerId_fkey` FOREIGN KEY (`jobSeekerId`) REFERENCES `job_seeker_profiles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `saved_jobs` ADD CONSTRAINT `saved_jobs_jobId_fkey` FOREIGN KEY (`jobId`) REFERENCES `jobs`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `skill_assessments` ADD CONSTRAINT `skill_assessments_jobSeekerId_fkey` FOREIGN KEY (`jobSeekerId`) REFERENCES `job_seeker_profiles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `skill_assessments` ADD CONSTRAINT `skill_assessments_skillId_fkey` FOREIGN KEY (`skillId`) REFERENCES `skills`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `skill_gap_results` ADD CONSTRAINT `skill_gap_results_jobSeekerId_fkey` FOREIGN KEY (`jobSeekerId`) REFERENCES `job_seeker_profiles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `skill_gap_results` ADD CONSTRAINT `skill_gap_results_jobId_fkey` FOREIGN KEY (`jobId`) REFERENCES `jobs`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `recommendations` ADD CONSTRAINT `recommendations_jobSeekerId_fkey` FOREIGN KEY (`jobSeekerId`) REFERENCES `job_seeker_profiles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `recommendations` ADD CONSTRAINT `recommendations_jobId_fkey` FOREIGN KEY (`jobId`) REFERENCES `jobs`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employer_feedbacks` ADD CONSTRAINT `employer_feedbacks_employerId_fkey` FOREIGN KEY (`employerId`) REFERENCES `employer_profiles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employer_feedbacks` ADD CONSTRAINT `employer_feedbacks_jobSeekerId_fkey` FOREIGN KEY (`jobSeekerId`) REFERENCES `job_seeker_profiles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employer_feedbacks` ADD CONSTRAINT `employer_feedbacks_jobId_fkey` FOREIGN KEY (`jobId`) REFERENCES `jobs`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `platform_audit_logs` ADD CONSTRAINT `platform_audit_logs_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ai_nexus_messages` ADD CONSTRAINT `ai_nexus_messages_conversationId_fkey` FOREIGN KEY (`conversationId`) REFERENCES `ai_nexus_conversations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
