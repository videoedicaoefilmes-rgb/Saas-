-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "jerseyColor" TEXT,
ADD COLUMN     "jerseyNumber" TEXT;

-- CreateTable
CREATE TABLE "athlete_marks" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "mediaAssetId" TEXT NOT NULL,
    "timeMs" INTEGER NOT NULL,
    "x" DOUBLE PRECISION NOT NULL,
    "y" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "athlete_marks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "athlete_marks_mediaAssetId_timeMs_idx" ON "athlete_marks"("mediaAssetId", "timeMs");

-- CreateIndex
CREATE INDEX "athlete_marks_projectId_idx" ON "athlete_marks"("projectId");

-- AddForeignKey
ALTER TABLE "athlete_marks" ADD CONSTRAINT "athlete_marks_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "athlete_marks" ADD CONSTRAINT "athlete_marks_mediaAssetId_fkey" FOREIGN KEY ("mediaAssetId") REFERENCES "media_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
