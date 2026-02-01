-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "exDates" TIMESTAMP(3)[];

-- CreateTable
CREATE TABLE "TaskOverride" (
    "id" TEXT NOT NULL,
    "seriesId" TEXT NOT NULL,
    "originalStartAt" TIMESTAMP(3) NOT NULL,
    "customerName" TEXT,
    "customerId" TEXT,
    "address" TEXT,
    "phone" TEXT,
    "serviceId" TEXT,
    "servicePriceCents" INTEGER,
    "description" TEXT,
    "notes" TEXT,
    "startAt" TIMESTAMP(3),
    "endAt" TIMESTAMP(3),
    "allDay" BOOLEAN,
    "assignedTeamId" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaskOverride_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TaskOverride_seriesId_idx" ON "TaskOverride"("seriesId");

-- CreateIndex
CREATE INDEX "TaskOverride_originalStartAt_idx" ON "TaskOverride"("originalStartAt");

-- CreateIndex
CREATE UNIQUE INDEX "TaskOverride_seriesId_originalStartAt_key" ON "TaskOverride"("seriesId", "originalStartAt");

-- AddForeignKey
ALTER TABLE "TaskOverride" ADD CONSTRAINT "TaskOverride_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskOverride" ADD CONSTRAINT "TaskOverride_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskOverride" ADD CONSTRAINT "TaskOverride_assignedTeamId_fkey" FOREIGN KEY ("assignedTeamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskOverride" ADD CONSTRAINT "TaskOverride_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
