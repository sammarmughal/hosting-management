-- Runs once, when the Docker volume is first created (docker-compose.yml).
-- Development, integration tests and Playwright each get their own database.
CREATE DATABASE IF NOT EXISTS hrm CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS hrm_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS hrm_e2e CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Local-only user. Global rights so `prisma migrate dev` can create and drop
-- its temporary shadow database; on Hostinger the user only has its own database.
CREATE USER IF NOT EXISTS 'hrm'@'%' IDENTIFIED BY 'hrm';
GRANT ALL PRIVILEGES ON *.* TO 'hrm'@'%';
FLUSH PRIVILEGES;
