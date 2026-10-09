-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "ResponseType" AS ENUM ('static', 'api', 'report');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('pending', 'reviewed', 'resolved');

-- CreateEnum
CREATE TYPE "ReportPriority" AS ENUM ('low', 'medium', 'high', 'urgent');

-- CreateEnum
CREATE TYPE "KYCFieldType" AS ENUM ('text', 'number', 'tel', 'email', 'password', 'boolean');

-- CreateEnum
CREATE TYPE "LogStatus" AS ENUM ('success', 'failed', 'error');

-- CreateEnum
CREATE TYPE "MenuApprovalStatus" AS ENUM ('pending', 'approved', 'rejected');

-- CreateEnum
CREATE TYPE "AdminRole" AS ENUM ('admin', 'checker', 'support');

-- CreateTable
CREATE TABLE "menu_items" (
    "id" TEXT NOT NULL,
    "parentId" TEXT,
    "name" TEXT NOT NULL,
    "nameAm" TEXT,
    "responseType" "ResponseType" NOT NULL,
    "content" TEXT,
    "contentAm" TEXT,
    "api_config" JSONB,
    "support_assignee" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "approvalStatus" "MenuApprovalStatus" NOT NULL DEFAULT 'approved',
    "createdBy" TEXT,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "pending_update" JSONB,
    "pending_status" "MenuApprovalStatus",
    "pending_created_by" TEXT,
    "pending_reviewed_by" TEXT,
    "pending_reviewed_at" TIMESTAMP(3),
    "pending_rejection_reason" TEXT,
    "trackClicks" BOOLEAN NOT NULL DEFAULT false,
    "clickCount" INTEGER NOT NULL DEFAULT 0,
    "sessionClickCount" INTEGER NOT NULL DEFAULT 0,
    "translations" JSONB,
    "attachment_description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "menu_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "menu_attachments" (
    "id" SERIAL NOT NULL,
    "menuId" TEXT NOT NULL,
    "attachedMenuId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "menu_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kyc_fields" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "promptAm" TEXT,
    "type" "KYCFieldType" NOT NULL,
    "validation" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "show_to_user" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kyc_fields_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "menu_kyc" (
    "id" SERIAL NOT NULL,
    "menuId" TEXT NOT NULL,
    "kycId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "menu_kyc_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_reports" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "menuId" TEXT,
    "menuName" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "status" "ReportStatus" NOT NULL DEFAULT 'pending',
    "priority" "ReportPriority" NOT NULL DEFAULT 'medium',
    "adminResponse" TEXT,
    "internalNotes" TEXT,
    "support_assignee" TEXT,
    "service_rating" INTEGER,
    "service_feedback" TEXT,
    "service_rated_at" TIMESTAMP(3),
    "service_rated_by_session_id" TEXT,
    "service_rated_support_assignee" TEXT,
    "resolved_by" TEXT,
    "resolved_at" TIMESTAMP(3),
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_activities" (
    "id" SERIAL NOT NULL,
    "reportId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "target" TEXT,
    "content" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "report_activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "supportedLanguages" JSONB,
    "systemTranslations" JSONB,
    "reportIdId" INTEGER,
    "botAvatarType" TEXT NOT NULL DEFAULT 'text',
    "botAvatarText" TEXT,
    "botAvatarImage" TEXT,
    "userAvatarType" TEXT NOT NULL DEFAULT 'text',
    "userAvatarText" TEXT,
    "userAvatarImage" TEXT,
    "appLogo" TEXT,
    "showAdminPanelIcon" BOOLEAN NOT NULL DEFAULT true,
    "liveAgentEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "app_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_id_config" (
    "id" SERIAL NOT NULL,
    "prefix" TEXT NOT NULL DEFAULT 'NIB',
    "yearEnabled" BOOLEAN NOT NULL DEFAULT true,
    "numberLength" INTEGER NOT NULL DEFAULT 6,
    "startValue" INTEGER NOT NULL DEFAULT 100000,
    "resetEveryYear" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "report_id_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "click_history" (
    "id" SERIAL NOT NULL,
    "menuId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "clickedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "click_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interaction_logs" (
    "id" SERIAL NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sessionId" TEXT NOT NULL,
    "userMessage" TEXT NOT NULL,
    "botResponse" TEXT NOT NULL,
    "status" "LogStatus" NOT NULL,
    "endpoint" TEXT,
    "responseTime" INTEGER,
    "errorDetails" TEXT,
    "tags" TEXT[],

    CONSTRAINT "interaction_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_credentials" (
    "id" SERIAL NOT NULL,
    "username" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "AdminRole" NOT NULL DEFAULT 'admin',
    "group_name" TEXT,
    "session_version" INTEGER NOT NULL DEFAULT 1,
    "must_change_password" BOOLEAN NOT NULL DEFAULT false,
    "password_expires_at" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_recovery_tokens" (
    "token" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_recovery_tokens_pkey" PRIMARY KEY ("token")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" SERIAL NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actor" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "details" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "drafts" (
    "id" SERIAL NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "drafts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "menu_attachments_menuId_attachedMenuId_key" ON "menu_attachments"("menuId", "attachedMenuId");

-- CreateIndex
CREATE UNIQUE INDEX "menu_kyc_menuId_kycId_key" ON "menu_kyc"("menuId", "kycId");

-- CreateIndex
CREATE INDEX "user_reports_menuId_idx" ON "user_reports"("menuId");

-- CreateIndex
CREATE INDEX "user_reports_userId_idx" ON "user_reports"("userId");

-- CreateIndex
CREATE INDEX "user_reports_support_assignee_idx" ON "user_reports"("support_assignee");

-- CreateIndex
CREATE INDEX "user_reports_service_rated_support_assignee_idx" ON "user_reports"("service_rated_support_assignee");

-- CreateIndex
CREATE INDEX "report_activities_reportId_idx" ON "report_activities"("reportId");

-- CreateIndex
CREATE UNIQUE INDEX "app_settings_reportIdId_key" ON "app_settings"("reportIdId");

-- CreateIndex
CREATE INDEX "click_history_menuId_idx" ON "click_history"("menuId");

-- CreateIndex
CREATE UNIQUE INDEX "admin_credentials_username_key" ON "admin_credentials"("username");

-- CreateIndex
CREATE UNIQUE INDEX "admin_credentials_email_key" ON "admin_credentials"("email");

-- CreateIndex
CREATE INDEX "admin_credentials_group_name_idx" ON "admin_credentials"("group_name");

-- CreateIndex
CREATE INDEX "admin_recovery_tokens_username_idx" ON "admin_recovery_tokens"("username");

-- CreateIndex
CREATE INDEX "audit_logs_actor_idx" ON "audit_logs"("actor");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- CreateIndex
CREATE INDEX "audit_logs_timestamp_idx" ON "audit_logs"("timestamp");

-- CreateIndex
CREATE INDEX "drafts_createdAt_idx" ON "drafts"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "drafts_entityType_entityId_createdBy_key" ON "drafts"("entityType", "entityId", "createdBy");

-- AddForeignKey
ALTER TABLE "menu_items" ADD CONSTRAINT "menu_items_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "menu_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menu_attachments" ADD CONSTRAINT "menu_attachments_menuId_fkey" FOREIGN KEY ("menuId") REFERENCES "menu_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menu_attachments" ADD CONSTRAINT "menu_attachments_attachedMenuId_fkey" FOREIGN KEY ("attachedMenuId") REFERENCES "menu_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menu_kyc" ADD CONSTRAINT "menu_kyc_menuId_fkey" FOREIGN KEY ("menuId") REFERENCES "menu_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menu_kyc" ADD CONSTRAINT "menu_kyc_kycId_fkey" FOREIGN KEY ("kycId") REFERENCES "kyc_fields"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_reports" ADD CONSTRAINT "user_reports_menuId_fkey" FOREIGN KEY ("menuId") REFERENCES "menu_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_activities" ADD CONSTRAINT "report_activities_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "user_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_settings" ADD CONSTRAINT "app_settings_reportIdId_fkey" FOREIGN KEY ("reportIdId") REFERENCES "report_id_config"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "click_history" ADD CONSTRAINT "click_history_menuId_fkey" FOREIGN KEY ("menuId") REFERENCES "menu_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

