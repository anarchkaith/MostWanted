CREATE TABLE `report_types`(
    `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(128) NOT NULL,
    `description` TEXT NULL
);
CREATE TABLE `player_reports`(
    `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    `player_name` INT NOT NULL,
    `infraction_tags` INT NOT NULL,
    `reason` TEXT NULL,
    `evidence_files` JSON NOT NULL,
    `reported_by` BIGINT NOT NULL,
    `created_at` DATETIME NULL DEFAULT CURRENT_TIMESTAMP(), `updated_at` DATETIME NULL DEFAULT CURRENT_TIMESTAMP());
ALTER TABLE
    `player_reports` ADD INDEX `player_reports_player_name_infraction_tags_index`(`player_name`, `infraction_tags`);
ALTER TABLE
    `player_reports` ADD INDEX `player_reports_player_name_index`(`player_name`);
ALTER TABLE
    `player_reports` ADD INDEX `player_reports_infraction_tags_index`(`infraction_tags`);
CREATE TABLE `crews`(
    `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(128) NOT NULL,
    `tag` VARCHAR(4) NULL,
    `emblem` BIGINT NOT NULL,
    `motto` VARCHAR(255) NULL,
    `socialclub_slug` VARCHAR(128) NOT NULL,
    `members_count` INT NULL,
    `last_synced` DATETIME NULL,
    `created_at` DATETIME NULL DEFAULT CURRENT_TIMESTAMP(), `updated_at` DATETIME NULL DEFAULT CURRENT_TIMESTAMP(), `leader` JSON NOT NULL, `commissioners` JSON NOT NULL, `lieutenants` JSON NOT NULL, `representatives` JSON NOT NULL, `muscle` JSON NOT NULL, `recent_notifications` BIGINT NOT NULL, `recent_emblems` BIGINT NOT NULL);
ALTER TABLE
    `crews` ADD UNIQUE `crews_socialclub_slug_unique`(`socialclub_slug`);
CREATE TABLE `players`(
    `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    `rid` VARCHAR(128) NULL,
    `nickname` VARCHAR(64) NOT NULL,
    `aliases` JSON NOT NULL,
    `avatar_main_url` VARCHAR(255) NULL,
    `avatar_alt_url` VARCHAR(255) NULL,
    `crews` BIGINT NOT NULL,
    `notes` TEXT NULL,
    `total_reports` INT NULL,
    `last_report_at` DATETIME NULL,
    `reports_history` JSON NOT NULL,
    `last_seen` DATETIME NULL,
    `created_at` DATETIME NULL DEFAULT CURRENT_TIMESTAMP(), `updated_at` DATETIME NULL DEFAULT CURRENT_TIMESTAMP());
ALTER TABLE
    `players` ADD UNIQUE `players_nickname_unique`(`nickname`);
ALTER TABLE
    `player_reports` ADD CONSTRAINT `player_reports_infraction_tags_foreign` FOREIGN KEY(`infraction_tags`) REFERENCES `report_types`(`id`);
ALTER TABLE
    `players` ADD CONSTRAINT `players_crews_foreign` FOREIGN KEY(`crews`) REFERENCES `crews`(`id`);
ALTER TABLE
    `player_reports` ADD CONSTRAINT `player_reports_player_name_foreign` FOREIGN KEY(`player_name`) REFERENCES `players`(`id`);