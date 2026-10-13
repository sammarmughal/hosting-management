-- CreateTable
CREATE TABLE `admins` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `username` VARCHAR(50) NOT NULL,
    `email` VARCHAR(190) NOT NULL,
    `password_hash` VARCHAR(255) NOT NULL,
    `totp_secret_enc` TEXT NULL,
    `totp_enabled` BOOLEAN NOT NULL DEFAULT false,
    `totp_last_step` INTEGER NULL,
    `recovery_codes` JSON NULL,
    `last_login_at` DATETIME(3) NULL,
    `last_login_ip` VARCHAR(45) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `admins_username_key`(`username`),
    UNIQUE INDEX `admins_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sessions` (
    `id` CHAR(64) NOT NULL,
    `admin_id` INTEGER NOT NULL,
    `stage` ENUM('password_ok', 'full') NOT NULL,
    `user_agent` VARCHAR(300) NULL,
    `ip` VARCHAR(45) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `last_seen_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expires_at` DATETIME(3) NOT NULL,
    `pending_totp_secret_enc` TEXT NULL,
    `totp_failures` INTEGER NOT NULL DEFAULT 0,

    INDEX `sessions_admin_id_idx`(`admin_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `login_attempts` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `ip` VARCHAR(45) NOT NULL,
    `identifier` VARCHAR(190) NOT NULL,
    `step` ENUM('password', 'totp', 'recovery', 'reset') NOT NULL DEFAULT 'password',
    `success` BOOLEAN NOT NULL,
    `attempted_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `login_attempts_ip_attempted_at_idx`(`ip`, `attempted_at`),
    INDEX `login_attempts_identifier_attempted_at_idx`(`identifier`, `attempted_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `password_resets` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `admin_id` INTEGER NOT NULL,
    `token_hash` CHAR(64) NOT NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `used_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `password_resets_token_hash_key`(`token_hash`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `clients` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(150) NOT NULL,
    `company` VARCHAR(150) NULL,
    `email` VARCHAR(190) NULL,
    `phone` VARCHAR(20) NULL,
    `address` VARCHAR(300) NULL,
    `currency` CHAR(3) NOT NULL,
    `notes` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `clients_name_idx`(`name`),
    INDEX `clients_email_idx`(`email`),
    INDEX `clients_phone_idx`(`phone`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `services` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `client_id` INTEGER NOT NULL,
    `domain` VARCHAR(190) NOT NULL,
    `plan_label` VARCHAR(100) NULL,
    `start_date` DATE NOT NULL,
    `renewal_date` DATE NOT NULL,
    `charge_amount` DECIMAL(15, 3) NOT NULL DEFAULT 0,
    `currency` CHAR(3) NOT NULL DEFAULT 'PKR',
    `status` ENUM('active', 'cancelled') NOT NULL DEFAULT 'active',
    `reminders_enabled` BOOLEAN NOT NULL DEFAULT true,
    `notes` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `services_status_renewal_date_idx`(`status`, `renewal_date`),
    INDEX `services_domain_idx`(`domain`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payments` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `service_id` INTEGER NOT NULL,
    `amount` DECIMAL(15, 3) NOT NULL,
    `currency` CHAR(3) NOT NULL DEFAULT 'PKR',
    `paid_on` DATE NOT NULL,
    `method` ENUM('cash', 'bank_transfer', 'jazzcash', 'easypaisa', 'other') NOT NULL DEFAULT 'cash',
    `reference` VARCHAR(100) NULL,
    `period_from` DATE NOT NULL,
    `period_to` DATE NOT NULL,
    `notes` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `payments_service_id_paid_on_idx`(`service_id`, `paid_on`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `reminders` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `service_id` INTEGER NOT NULL,
    `cycle_date` DATE NOT NULL,
    `stage` SMALLINT NOT NULL,
    `channel` ENUM('email', 'whatsapp') NOT NULL,
    `recipient` ENUM('client', 'admin') NOT NULL,
    `status` ENUM('pending', 'sent', 'opened', 'failed', 'skipped') NOT NULL DEFAULT 'pending',
    `attempts` SMALLINT NOT NULL DEFAULT 0,
    `last_error` VARCHAR(500) NULL,
    `sent_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `reminders_status_created_at_idx`(`status`, `created_at`),
    UNIQUE INDEX `reminders_service_id_cycle_date_stage_channel_recipient_key`(`service_id`, `cycle_date`, `stage`, `channel`, `recipient`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `notifications` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `service_id` INTEGER NULL,
    `type` ENUM('expiring', 'expired', 'renewed', 'email_failed', 'system', 'invoice_created') NOT NULL,
    `title` VARCHAR(190) NOT NULL,
    `body` VARCHAR(500) NULL,
    `dedupe_key` VARCHAR(120) NOT NULL,
    `is_read` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `notifications_dedupe_key_key`(`dedupe_key`),
    INDEX `notifications_is_read_created_at_idx`(`is_read`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `settings` (
    `key` VARCHAR(80) NOT NULL,
    `value` TEXT NULL,
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `message_templates` (
    `key` VARCHAR(50) NOT NULL,
    `subject` VARCHAR(190) NULL,
    `body` TEXT NOT NULL,
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `audit_log` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `action` VARCHAR(50) NOT NULL,
    `entity` VARCHAR(30) NULL,
    `entity_id` INTEGER NULL,
    `details` JSON NULL,
    `ip` VARCHAR(45) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `audit_log_action_created_at_idx`(`action`, `created_at`),
    INDEX `audit_log_entity_entity_id_idx`(`entity`, `entity_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `invoices` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `number` VARCHAR(40) NOT NULL,
    `client_id` INTEGER NOT NULL,
    `service_id` INTEGER NOT NULL,
    `period_start` DATE NOT NULL,
    `period_end` DATE NOT NULL,
    `issue_date` DATE NOT NULL,
    `due_date` DATE NOT NULL,
    `currency` CHAR(3) NOT NULL,
    `subtotal` DECIMAL(15, 3) NOT NULL,
    `discount` DECIMAL(15, 3) NOT NULL DEFAULT 0,
    `tax_rate` DECIMAL(5, 2) NOT NULL DEFAULT 0,
    `tax_amount` DECIMAL(15, 3) NOT NULL DEFAULT 0,
    `total` DECIMAL(15, 3) NOT NULL,
    `status` ENUM('issued', 'sent', 'paid', 'void') NOT NULL DEFAULT 'issued',
    `bill_to` JSON NOT NULL,
    `seller` JSON NOT NULL,
    `notes` TEXT NULL,
    `public_token` VARCHAR(64) NOT NULL,
    `public_token_revoked_at` DATETIME(3) NULL,
    `first_sent_at` DATETIME(3) NULL,
    `paid_at` DATE NULL,
    `payment_id` INTEGER NULL,
    `voided_at` DATETIME(3) NULL,
    `void_reason` VARCHAR(300) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `invoices_number_key`(`number`),
    UNIQUE INDEX `invoices_public_token_key`(`public_token`),
    UNIQUE INDEX `invoices_payment_id_key`(`payment_id`),
    INDEX `invoices_status_due_date_idx`(`status`, `due_date`),
    INDEX `invoices_client_id_idx`(`client_id`),
    INDEX `invoices_issue_date_idx`(`issue_date`),
    UNIQUE INDEX `invoices_service_id_period_start_key`(`service_id`, `period_start`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `invoice_items` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `invoice_id` INTEGER NOT NULL,
    `position` INTEGER NOT NULL DEFAULT 0,
    `description` VARCHAR(300) NOT NULL,
    `period_label` VARCHAR(100) NOT NULL,
    `quantity` INTEGER NOT NULL DEFAULT 1,
    `unit_amount` DECIMAL(15, 3) NOT NULL,
    `amount` DECIMAL(15, 3) NOT NULL,

    INDEX `invoice_items_invoice_id_idx`(`invoice_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `invoice_events` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `invoice_id` INTEGER NOT NULL,
    `type` ENUM('created', 'updated', 'email_sent', 'email_failed', 'whatsapp_opened', 'whatsapp_marked_sent', 'link_viewed', 'pdf_downloaded', 'paid', 'voided', 'link_regenerated', 'details_refreshed') NOT NULL,
    `details` JSON NULL,
    `ip` VARCHAR(45) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `invoice_events_invoice_id_created_at_idx`(`invoice_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `invoice_counters` (
    `year` INTEGER NOT NULL,
    `next` INTEGER NOT NULL DEFAULT 1,
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`year`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `app_locks` (
    `name` VARCHAR(40) NOT NULL,

    PRIMARY KEY (`name`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Hand-added: the row runCheck() locks (FOR UPDATE SKIP LOCKED), docs/02 §2.
INSERT INTO `app_locks` (`name`) VALUES ('check');

-- CreateTable
CREATE TABLE `rate_limits` (
    `key` VARCHAR(120) NOT NULL,
    `window_start` DATETIME(3) NOT NULL,
    `count` INTEGER NOT NULL DEFAULT 0,

    PRIMARY KEY (`key`, `window_start`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `sessions` ADD CONSTRAINT `sessions_admin_id_fkey` FOREIGN KEY (`admin_id`) REFERENCES `admins`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `password_resets` ADD CONSTRAINT `password_resets_admin_id_fkey` FOREIGN KEY (`admin_id`) REFERENCES `admins`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `services` ADD CONSTRAINT `services_client_id_fkey` FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payments` ADD CONSTRAINT `payments_service_id_fkey` FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `reminders` ADD CONSTRAINT `reminders_service_id_fkey` FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_service_id_fkey` FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `invoices` ADD CONSTRAINT `invoices_client_id_fkey` FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `invoices` ADD CONSTRAINT `invoices_service_id_fkey` FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `invoices` ADD CONSTRAINT `invoices_payment_id_fkey` FOREIGN KEY (`payment_id`) REFERENCES `payments`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `invoice_items` ADD CONSTRAINT `invoice_items_invoice_id_fkey` FOREIGN KEY (`invoice_id`) REFERENCES `invoices`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `invoice_events` ADD CONSTRAINT `invoice_events_invoice_id_fkey` FOREIGN KEY (`invoice_id`) REFERENCES `invoices`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
