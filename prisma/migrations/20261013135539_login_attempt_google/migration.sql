-- AlterTable
ALTER TABLE `login_attempts` MODIFY `step` ENUM('password', 'totp', 'recovery', 'reset', 'google') NOT NULL DEFAULT 'password';
