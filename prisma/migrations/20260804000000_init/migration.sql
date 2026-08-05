-- CreateTable
CREATE TABLE `User` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `passwordHash` VARCHAR(255) NOT NULL,
    `role` ENUM('ADMIN', 'EDITOR', 'AUTHOR') NOT NULL DEFAULT 'AUTHOR',
    `bio` TEXT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `lastLoginAt` DATETIME(3) NULL,
    `avatarId` VARCHAR(191) NULL,
    `resetToken` VARCHAR(191) NULL,
    `resetTokenExpiry` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `User_email_key`(`email`),
    UNIQUE INDEX `User_resetToken_key`(`resetToken`),
    INDEX `User_role_idx`(`role`),
    INDEX `User_avatarId_idx`(`avatarId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Media` (
    `id` VARCHAR(191) NOT NULL,
    `path` VARCHAR(500) NOT NULL,
    `sourceUrl` VARCHAR(600) NULL,
    `filename` VARCHAR(255) NOT NULL,
    `mimeType` VARCHAR(120) NOT NULL,
    `width` INTEGER NULL,
    `height` INTEGER NULL,
    `bytes` INTEGER NULL,
    `alt` VARCHAR(500) NOT NULL,
    `decorative` BOOLEAN NOT NULL DEFAULT false,
    `title` VARCHAR(255) NULL,
    `caption` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Media_path_key`(`path`),
    UNIQUE INDEX `Media_sourceUrl_key`(`sourceUrl`),
    INDEX `Media_mimeType_idx`(`mimeType`),
    INDEX `Media_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Page` (
    `id` VARCHAR(191) NOT NULL,
    `path` VARCHAR(300) NOT NULL,
    `slug` VARCHAR(200) NOT NULL,
    `title` VARCHAR(300) NOT NULL,
    `status` ENUM('DRAFT', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT',
    `pageType` VARCHAR(40) NOT NULL DEFAULT 'service',
    `wpId` INTEGER NULL,
    `wpUrl` VARCHAR(600) NULL,
    `heroImageId` VARCHAR(191) NULL,
    `customCss` TEXT NULL,
    `publishedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Page_path_key`(`path`),
    UNIQUE INDEX `Page_wpId_key`(`wpId`),
    INDEX `Page_slug_idx`(`slug`),
    INDEX `Page_status_idx`(`status`),
    INDEX `Page_pageType_idx`(`pageType`),
    INDEX `Page_heroImageId_idx`(`heroImageId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PageBlock` (
    `id` VARCHAR(191) NOT NULL,
    `pageId` VARCHAR(191) NOT NULL,
    `type` VARCHAR(60) NOT NULL,
    `order` INTEGER NOT NULL,
    `visible` BOOLEAN NOT NULL DEFAULT true,
    `props` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `PageBlock_pageId_order_idx`(`pageId`, `order`),
    INDEX `PageBlock_type_idx`(`type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PageRevision` (
    `id` VARCHAR(191) NOT NULL,
    `pageId` VARCHAR(191) NOT NULL,
    `snapshot` JSON NOT NULL,
    `note` VARCHAR(300) NULL,
    `authorId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `PageRevision_pageId_createdAt_idx`(`pageId`, `createdAt`),
    INDEX `PageRevision_authorId_idx`(`authorId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Category` (
    `id` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(200) NOT NULL,
    `name` VARCHAR(200) NOT NULL,
    `description` TEXT NULL,
    `order` INTEGER NOT NULL DEFAULT 0,
    `wpId` INTEGER NULL,
    `parentId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Category_slug_key`(`slug`),
    UNIQUE INDEX `Category_wpId_key`(`wpId`),
    INDEX `Category_parentId_idx`(`parentId`),
    INDEX `Category_order_idx`(`order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Post` (
    `id` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(200) NOT NULL,
    `title` VARCHAR(300) NOT NULL,
    `excerpt` TEXT NULL,
    `body` LONGTEXT NOT NULL,
    `status` ENUM('DRAFT', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT',
    `wpId` INTEGER NULL,
    `wpUrl` VARCHAR(600) NULL,
    `authorId` VARCHAR(191) NULL,
    `categoryId` VARCHAR(191) NULL,
    `featuredImageId` VARCHAR(191) NULL,
    `publishedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Post_slug_key`(`slug`),
    UNIQUE INDEX `Post_wpId_key`(`wpId`),
    INDEX `Post_status_publishedAt_idx`(`status`, `publishedAt`),
    INDEX `Post_authorId_idx`(`authorId`),
    INDEX `Post_categoryId_idx`(`categoryId`),
    INDEX `Post_featuredImageId_idx`(`featuredImageId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PostRevision` (
    `id` VARCHAR(191) NOT NULL,
    `postId` VARCHAR(191) NOT NULL,
    `snapshot` JSON NOT NULL,
    `note` VARCHAR(300) NULL,
    `authorId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `PostRevision_postId_createdAt_idx`(`postId`, `createdAt`),
    INDEX `PostRevision_authorId_idx`(`authorId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CoachClass` (
    `id` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(120) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `description` TEXT NULL,
    `order` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `CoachClass_slug_key`(`slug`),
    INDEX `CoachClass_order_idx`(`order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Coach` (
    `id` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(200) NOT NULL,
    `name` VARCHAR(200) NOT NULL,
    `status` ENUM('DRAFT', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT',
    `classId` VARCHAR(191) NULL,
    `chassis` VARCHAR(120) NOT NULL,
    `bunks` INTEGER NOT NULL,
    `slideOuts` VARCHAR(120) NOT NULL,
    `rearConfig` VARCHAR(160) NOT NULL,
    `amenities` JSON NOT NULL,
    `description` LONGTEXT NOT NULL,
    `tagline` VARCHAR(160) NULL,
    `dailyPrice` INTEGER NULL,
    `currency` VARCHAR(8) NOT NULL DEFAULT 'USD',
    `available` BOOLEAN NOT NULL DEFAULT true,
    `featured` BOOLEAN NOT NULL DEFAULT false,
    `displayOrder` INTEGER NOT NULL DEFAULT 0,
    `publishedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Coach_slug_key`(`slug`),
    INDEX `Coach_classId_idx`(`classId`),
    INDEX `Coach_status_idx`(`status`),
    INDEX `Coach_featured_displayOrder_idx`(`featured`, `displayOrder`),
    INDEX `Coach_bunks_idx`(`bunks`),
    INDEX `Coach_available_idx`(`available`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CoachImage` (
    `id` VARCHAR(191) NOT NULL,
    `coachId` VARCHAR(191) NOT NULL,
    `mediaId` VARCHAR(191) NOT NULL,
    `order` INTEGER NOT NULL DEFAULT 0,
    `caption` VARCHAR(400) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `CoachImage_coachId_order_idx`(`coachId`, `order`),
    INDEX `CoachImage_mediaId_idx`(`mediaId`),
    UNIQUE INDEX `CoachImage_coachId_mediaId_key`(`coachId`, `mediaId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Location` (
    `id` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(200) NOT NULL,
    `city` VARCHAR(160) NOT NULL,
    `state` VARCHAR(80) NOT NULL,
    `region` VARCHAR(80) NULL,
    `status` ENUM('DRAFT', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT',
    `path` VARCHAR(300) NULL,
    `isHub` BOOLEAN NOT NULL DEFAULT false,
    `isPrimary` BOOLEAN NOT NULL DEFAULT false,
    `order` INTEGER NOT NULL DEFAULT 0,
    `summary` TEXT NULL,
    `imageId` VARCHAR(191) NULL,
    `publishedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Location_slug_key`(`slug`),
    UNIQUE INDEX `Location_path_key`(`path`),
    INDEX `Location_state_idx`(`state`),
    INDEX `Location_isHub_order_idx`(`isHub`, `order`),
    INDEX `Location_imageId_idx`(`imageId`),
    INDEX `Location_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Testimonial` (
    `id` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(200) NOT NULL,
    `name` VARCHAR(160) NOT NULL,
    `role` VARCHAR(160) NOT NULL,
    `quote` TEXT NOT NULL,
    `rating` INTEGER NOT NULL DEFAULT 5,
    `status` ENUM('DRAFT', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT',
    `avatarId` VARCHAR(191) NULL,
    `order` INTEGER NOT NULL DEFAULT 0,
    `publishedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Testimonial_slug_key`(`slug`),
    INDEX `Testimonial_order_idx`(`order`),
    INDEX `Testimonial_avatarId_idx`(`avatarId`),
    INDEX `Testimonial_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `FaqItem` (
    `id` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(220) NOT NULL,
    `question` VARCHAR(500) NOT NULL,
    `answer` TEXT NOT NULL,
    `status` ENUM('DRAFT', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED') NOT NULL DEFAULT 'PUBLISHED',
    `group` VARCHAR(120) NOT NULL,
    `order` INTEGER NOT NULL DEFAULT 0,
    `publishedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `FaqItem_slug_key`(`slug`),
    INDEX `FaqItem_group_order_idx`(`group`, `order`),
    INDEX `FaqItem_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Menu` (
    `id` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(120) NOT NULL,
    `name` VARCHAR(160) NOT NULL,
    `location` ENUM('HEADER', 'FOOTER') NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Menu_slug_key`(`slug`),
    INDEX `Menu_location_idx`(`location`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MenuItem` (
    `id` VARCHAR(191) NOT NULL,
    `menuId` VARCHAR(191) NOT NULL,
    `parentId` VARCHAR(191) NULL,
    `kind` ENUM('PAGE', 'POST', 'COACH', 'CATEGORY', 'CUSTOM', 'PHONE') NOT NULL DEFAULT 'CUSTOM',
    `label` VARCHAR(200) NOT NULL,
    `url` VARCHAR(600) NOT NULL,
    `column` INTEGER NULL,
    `order` INTEGER NOT NULL DEFAULT 0,
    `rel` VARCHAR(120) NULL,
    `target` VARCHAR(20) NULL,
    `visible` BOOLEAN NOT NULL DEFAULT true,
    `isCta` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `MenuItem_menuId_order_idx`(`menuId`, `order`),
    INDEX `MenuItem_parentId_idx`(`parentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Setting` (
    `key` VARCHAR(120) NOT NULL,
    `value` JSON NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SeoMeta` (
    `id` VARCHAR(191) NOT NULL,
    `entityType` ENUM('PAGE', 'POST', 'COACH', 'CATEGORY', 'LOCATION') NOT NULL,
    `entityId` VARCHAR(60) NOT NULL,
    `title` VARCHAR(300) NULL,
    `description` TEXT NULL,
    `canonical` VARCHAR(600) NULL,
    `ogTitle` VARCHAR(300) NULL,
    `ogDescription` TEXT NULL,
    `ogImage` VARCHAR(600) NULL,
    `robots` ENUM('INDEX_FOLLOW', 'NOINDEX_FOLLOW', 'INDEX_NOFOLLOW', 'NOINDEX_NOFOLLOW') NOT NULL DEFAULT 'INDEX_FOLLOW',
    `schemaType` VARCHAR(80) NULL,
    `sitemapExclude` BOOLEAN NOT NULL DEFAULT false,
    `sitemapPriority` DOUBLE NULL,
    `sitemapChangefreq` VARCHAR(20) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `SeoMeta_entityId_idx`(`entityId`),
    UNIQUE INDEX `SeoMeta_entityType_entityId_key`(`entityType`, `entityId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SchemaOverride` (
    `id` VARCHAR(191) NOT NULL,
    `entityType` ENUM('PAGE', 'POST', 'COACH', 'CATEGORY', 'LOCATION') NOT NULL,
    `entityId` VARCHAR(60) NOT NULL,
    `jsonLd` JSON NOT NULL,
    `replace` BOOLEAN NOT NULL DEFAULT false,
    `enabled` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `SchemaOverride_entityId_idx`(`entityId`),
    UNIQUE INDEX `SchemaOverride_entityType_entityId_key`(`entityType`, `entityId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Redirect` (
    `id` VARCHAR(191) NOT NULL,
    `from` VARCHAR(600) NOT NULL,
    `to` VARCHAR(600) NOT NULL,
    `kind` ENUM('PERMANENT', 'TEMPORARY') NOT NULL DEFAULT 'PERMANENT',
    `enabled` BOOLEAN NOT NULL DEFAULT true,
    `note` VARCHAR(300) NULL,
    `hits` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Redirect_from_key`(`from`),
    INDEX `Redirect_enabled_idx`(`enabled`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Form` (
    `id` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(120) NOT NULL,
    `name` VARCHAR(200) NOT NULL,
    `description` TEXT NULL,
    `submitLabel` VARCHAR(120) NOT NULL DEFAULT 'Send Request',
    `successTitle` VARCHAR(200) NOT NULL DEFAULT 'Request Received!',
    `successBody` TEXT NOT NULL,
    `notifyEmail` VARCHAR(320) NULL,
    `enabled` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Form_slug_key`(`slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `FormField` (
    `id` VARCHAR(191) NOT NULL,
    `formId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `label` VARCHAR(300) NOT NULL,
    `type` ENUM('TEXT', 'EMAIL', 'TEL', 'NUMBER', 'DATE', 'TEXTAREA', 'SELECT', 'CHECKBOX', 'FILE', 'HIDDEN') NOT NULL DEFAULT 'TEXT',
    `placeholder` VARCHAR(300) NULL,
    `helpText` VARCHAR(400) NULL,
    `required` BOOLEAN NOT NULL DEFAULT false,
    `options` JSON NULL,
    `order` INTEGER NOT NULL DEFAULT 0,
    `showWhen` VARCHAR(120) NULL,
    `halfWidth` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `FormField_formId_order_idx`(`formId`, `order`),
    UNIQUE INDEX `FormField_formId_name_key`(`formId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `FormSubmission` (
    `id` VARCHAR(191) NOT NULL,
    `formId` VARCHAR(191) NOT NULL,
    `data` JSON NOT NULL,
    `ip` VARCHAR(64) NULL,
    `userAgent` VARCHAR(400) NULL,
    `emailed` BOOLEAN NOT NULL DEFAULT false,
    `emailError` TEXT NULL,
    `read` BOOLEAN NOT NULL DEFAULT false,
    `starred` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `FormSubmission_formId_createdAt_idx`(`formId`, `createdAt`),
    INDEX `FormSubmission_read_idx`(`read`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ContactMessage` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(200) NOT NULL,
    `email` VARCHAR(320) NOT NULL,
    `phone` VARCHAR(60) NULL,
    `subject` VARCHAR(300) NULL,
    `message` TEXT NOT NULL,
    `ip` VARCHAR(64) NULL,
    `userAgent` VARCHAR(400) NULL,
    `read` BOOLEAN NOT NULL DEFAULT false,
    `starred` BOOLEAN NOT NULL DEFAULT false,
    `emailed` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ContactMessage_read_createdAt_idx`(`read`, `createdAt`),
    INDEX `ContactMessage_email_idx`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `IndexingLog` (
    `id` VARCHAR(191) NOT NULL,
    `url` VARCHAR(600) NOT NULL,
    `provider` ENUM('INDEXNOW', 'GOOGLE', 'SITEMAP_PING') NOT NULL,
    `action` ENUM('URL_UPDATED', 'URL_DELETED') NOT NULL DEFAULT 'URL_UPDATED',
    `status` ENUM('PENDING', 'SUCCESS', 'FAILED') NOT NULL DEFAULT 'PENDING',
    `code` INTEGER NULL,
    `response` TEXT NULL,
    `attempts` INTEGER NOT NULL DEFAULT 1,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `IndexingLog_provider_createdAt_idx`(`provider`, `createdAt`),
    INDEX `IndexingLog_status_idx`(`status`),
    INDEX `IndexingLog_url_idx`(`url`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `User` ADD CONSTRAINT `User_avatarId_fkey` FOREIGN KEY (`avatarId`) REFERENCES `Media`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Page` ADD CONSTRAINT `Page_heroImageId_fkey` FOREIGN KEY (`heroImageId`) REFERENCES `Media`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PageBlock` ADD CONSTRAINT `PageBlock_pageId_fkey` FOREIGN KEY (`pageId`) REFERENCES `Page`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PageRevision` ADD CONSTRAINT `PageRevision_pageId_fkey` FOREIGN KEY (`pageId`) REFERENCES `Page`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PageRevision` ADD CONSTRAINT `PageRevision_authorId_fkey` FOREIGN KEY (`authorId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Category` ADD CONSTRAINT `Category_parentId_fkey` FOREIGN KEY (`parentId`) REFERENCES `Category`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Post` ADD CONSTRAINT `Post_authorId_fkey` FOREIGN KEY (`authorId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Post` ADD CONSTRAINT `Post_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `Category`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Post` ADD CONSTRAINT `Post_featuredImageId_fkey` FOREIGN KEY (`featuredImageId`) REFERENCES `Media`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PostRevision` ADD CONSTRAINT `PostRevision_postId_fkey` FOREIGN KEY (`postId`) REFERENCES `Post`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PostRevision` ADD CONSTRAINT `PostRevision_authorId_fkey` FOREIGN KEY (`authorId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Coach` ADD CONSTRAINT `Coach_classId_fkey` FOREIGN KEY (`classId`) REFERENCES `CoachClass`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CoachImage` ADD CONSTRAINT `CoachImage_coachId_fkey` FOREIGN KEY (`coachId`) REFERENCES `Coach`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CoachImage` ADD CONSTRAINT `CoachImage_mediaId_fkey` FOREIGN KEY (`mediaId`) REFERENCES `Media`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Location` ADD CONSTRAINT `Location_imageId_fkey` FOREIGN KEY (`imageId`) REFERENCES `Media`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Testimonial` ADD CONSTRAINT `Testimonial_avatarId_fkey` FOREIGN KEY (`avatarId`) REFERENCES `Media`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MenuItem` ADD CONSTRAINT `MenuItem_menuId_fkey` FOREIGN KEY (`menuId`) REFERENCES `Menu`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MenuItem` ADD CONSTRAINT `MenuItem_parentId_fkey` FOREIGN KEY (`parentId`) REFERENCES `MenuItem`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FormField` ADD CONSTRAINT `FormField_formId_fkey` FOREIGN KEY (`formId`) REFERENCES `Form`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FormSubmission` ADD CONSTRAINT `FormSubmission_formId_fkey` FOREIGN KEY (`formId`) REFERENCES `Form`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

