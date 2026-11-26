/*
  Warnings:

  - Added the required column `updated_at` to the `dept_quota_maps` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `quotas` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "dept_quota_maps" ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "created_by" TEXT,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "updated_by" TEXT;

-- AlterTable
ALTER TABLE "quotas" ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "created_by" TEXT,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "updated_by" TEXT;
