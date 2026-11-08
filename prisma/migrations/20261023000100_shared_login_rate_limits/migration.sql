CREATE TABLE `auth_login_rate_limits` (
  `keyHash` CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `hits` INT UNSIGNED NOT NULL DEFAULT 0,
  `expiresAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`keyHash`),
  INDEX `auth_login_rate_limits_expiresAt_idx` (`expiresAt`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
