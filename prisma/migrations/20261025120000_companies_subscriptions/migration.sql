-- Companies, Service Catalog and Subscriptions (docs/14 §10). Hand-written:
-- `services` is RENAMED to `subscriptions` and every `service_id` to
-- `subscription_id`, so existing rows survive. Works on an empty database
-- and on one with data. Index and key names match what Prisma expects.

-- Foreign keys that point at `services` (re-added under the new names below).
ALTER TABLE `invoices` DROP FOREIGN KEY `invoices_service_id_fkey`;
ALTER TABLE `notifications` DROP FOREIGN KEY `notifications_service_id_fkey`;
ALTER TABLE `payments` DROP FOREIGN KEY `payments_service_id_fkey`;
ALTER TABLE `reminders` DROP FOREIGN KEY `reminders_service_id_fkey`;
ALTER TABLE `services` DROP FOREIGN KEY `services_client_id_fkey`;

-- services → subscriptions
RENAME TABLE `services` TO `subscriptions`;
ALTER TABLE `subscriptions`
    RENAME INDEX `services_client_id_fkey` TO `subscriptions_client_id_fkey`,
    RENAME INDEX `services_domain_idx` TO `subscriptions_domain_idx`,
    RENAME INDEX `services_status_renewal_date_idx` TO `subscriptions_status_renewal_date_idx`;

-- service_id → subscription_id
ALTER TABLE `payments`
    RENAME COLUMN `service_id` TO `subscription_id`,
    RENAME INDEX `payments_service_id_paid_on_idx` TO `payments_subscription_id_paid_on_idx`;
ALTER TABLE `reminders`
    RENAME COLUMN `service_id` TO `subscription_id`,
    RENAME INDEX `reminders_service_id_cycle_date_stage_channel_recipient_key` TO `reminders_subscription_id_cycle_date_stage_channel_recipient_key`;
ALTER TABLE `notifications`
    RENAME COLUMN `service_id` TO `subscription_id`,
    RENAME INDEX `notifications_service_id_fkey` TO `notifications_subscription_id_fkey`;
ALTER TABLE `invoices`
    RENAME COLUMN `service_id` TO `subscription_id`,
    RENAME INDEX `invoices_service_id_period_start_key` TO `invoices_subscription_id_period_start_key`;

-- CreateTable: the Service Catalog, with its defaults (production never runs the seed).
CREATE TABLE `service_types` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(100) NOT NULL,
    `default_price` DECIMAL(15, 3) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `position` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `service_types_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO `service_types` (`name`, `position`, `created_at`, `updated_at`) VALUES
    ('Domain Registration', 1, UTC_TIMESTAMP(3), UTC_TIMESTAMP(3)),
    ('Web Hosting', 2, UTC_TIMESTAMP(3), UTC_TIMESTAMP(3)),
    ('Domain and Hosting', 3, UTC_TIMESTAMP(3), UTC_TIMESTAMP(3)),
    ('Website Maintenance', 4, UTC_TIMESTAMP(3), UTC_TIMESTAMP(3)),
    ('AMC', 5, UTC_TIMESTAMP(3), UTC_TIMESTAMP(3));

-- CreateTable
CREATE TABLE `companies` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `client_id` INTEGER NOT NULL,
    `name` VARCHAR(150) NOT NULL,
    `email` VARCHAR(190) NULL,
    `phone` VARCHAR(20) NULL,
    `address` VARCHAR(300) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `companies_client_id_idx`(`client_id`),
    UNIQUE INDEX `companies_client_id_name_key`(`client_id`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- New subscription columns. Existing rows were hosting services.
ALTER TABLE `subscriptions`
    ADD COLUMN `company_id` INTEGER NULL AFTER `client_id`,
    ADD COLUMN `service_type_id` INTEGER NULL AFTER `company_id`;
UPDATE `subscriptions`
    SET `service_type_id` = (SELECT `id` FROM `service_types` WHERE `name` = 'Web Hosting');
ALTER TABLE `subscriptions`
    MODIFY `service_type_id` INTEGER NOT NULL,
    ADD INDEX `subscriptions_service_type_id_domain_idx`(`service_type_id`, `domain`),
    ADD INDEX `subscriptions_company_id_idx`(`company_id`);

-- The old free-text clients.company becomes a company of that client, and
-- the client's subscriptions move under it. Then the column goes.
INSERT INTO `companies` (`client_id`, `name`, `created_at`, `updated_at`)
    SELECT `id`, TRIM(`company`), UTC_TIMESTAMP(3), UTC_TIMESTAMP(3)
    FROM `clients`
    WHERE `company` IS NOT NULL AND TRIM(`company`) <> '';
UPDATE `subscriptions` s
    JOIN `companies` c ON c.`client_id` = s.`client_id`
    SET s.`company_id` = c.`id`;
ALTER TABLE `clients` DROP COLUMN `company`;

-- AddForeignKey
ALTER TABLE `companies` ADD CONSTRAINT `companies_client_id_fkey` FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `subscriptions` ADD CONSTRAINT `subscriptions_client_id_fkey` FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `subscriptions` ADD CONSTRAINT `subscriptions_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: a service type in use can't be deleted (docs/14 §2).
ALTER TABLE `subscriptions` ADD CONSTRAINT `subscriptions_service_type_id_fkey` FOREIGN KEY (`service_type_id`) REFERENCES `service_types`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payments` ADD CONSTRAINT `payments_subscription_id_fkey` FOREIGN KEY (`subscription_id`) REFERENCES `subscriptions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `reminders` ADD CONSTRAINT `reminders_subscription_id_fkey` FOREIGN KEY (`subscription_id`) REFERENCES `subscriptions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_subscription_id_fkey` FOREIGN KEY (`subscription_id`) REFERENCES `subscriptions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `invoices` ADD CONSTRAINT `invoices_subscription_id_fkey` FOREIGN KEY (`subscription_id`) REFERENCES `subscriptions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
