ALTER TABLE `job_seeker_skills`
    ADD COLUMN `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);

CREATE TABLE `skill_assessment_questions` (
    `id` VARCHAR(191) NOT NULL,
    `skillId` VARCHAR(191) NOT NULL,
    `questionKey` VARCHAR(191) NOT NULL,
    `prompt` TEXT NOT NULL,
    `optionsJson` JSON NOT NULL,
    `correctOption` TINYINT UNSIGNED NOT NULL,
    `questionOrder` INTEGER NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `skill_assessment_questions_skillId_questionKey_key`(`skillId`, `questionKey`),
    INDEX `skill_assessment_questions_skillId_isActive_questionOrder_idx`(`skillId`, `isActive`, `questionOrder`),
    PRIMARY KEY (`id`),
    CONSTRAINT `skill_assessment_questions_skillId_fkey`
        FOREIGN KEY (`skillId`) REFERENCES `skills`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `skill_assessment_responses` (
    `id` VARCHAR(191) NOT NULL,
    `assessmentId` VARCHAR(191) NOT NULL,
    `questionId` VARCHAR(191) NOT NULL,
    `selectedOption` TINYINT UNSIGNED NOT NULL,
    `isCorrect` BOOLEAN NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `skill_assessment_responses_assessmentId_questionId_key`(`assessmentId`, `questionId`),
    INDEX `skill_assessment_responses_questionId_idx`(`questionId`),
    PRIMARY KEY (`id`),
    CONSTRAINT `skill_assessment_responses_assessmentId_fkey`
        FOREIGN KEY (`assessmentId`) REFERENCES `skill_assessments`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `skill_assessment_responses_questionId_fkey`
        FOREIGN KEY (`questionId`) REFERENCES `skill_assessment_questions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
