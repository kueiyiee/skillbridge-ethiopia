CREATE INDEX `users_role_active_created_idx` ON `users` (`role`, `isActive`, `createdAt`);
CREATE INDEX `employer_profiles_approval_idx` ON `employer_profiles` (`isApproved`);
CREATE INDEX `employer_verification_status_created_idx` ON `employer_verification_records` (`status`, `createdAt`);
CREATE INDEX `jobs_status_deadline_employer_idx` ON `jobs` (`status`, `deadline`, `employerId`);
CREATE INDEX `job_applications_status_match_idx` ON `job_applications` (`status`, `matchScore`);
CREATE INDEX `platform_audit_created_idx` ON `platform_audit_logs` (`createdAt`);