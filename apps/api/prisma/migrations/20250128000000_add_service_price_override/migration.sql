-- Drop foreign keys
ALTER TABLE "Task" DROP CONSTRAINT "Task_serviceId_fkey";
ALTER TABLE "Task" DROP CONSTRAINT "Task_teamId_fkey";

-- Add unique constraints
ALTER TABLE "Service" ADD CONSTRAINT "Service_name_key" UNIQUE ("name");
ALTER TABLE "Team" ADD CONSTRAINT "Team_name_key" UNIQUE ("name");

-- Rename teamId to assignedTeamId
ALTER TABLE "Task" RENAME COLUMN "teamId" TO "assignedTeamId";

-- Make serviceId nullable
ALTER TABLE "Task" ALTER COLUMN "serviceId" DROP NOT NULL;

-- Rename servicePrice to servicePriceCents and make nullable
ALTER TABLE "Task" RENAME COLUMN "servicePrice" TO "servicePriceCents";
ALTER TABLE "Task" ALTER COLUMN "servicePriceCents" DROP NOT NULL;

-- Re-add foreign keys with SET NULL on delete
ALTER TABLE "Task" ADD CONSTRAINT "Task_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Task" ADD CONSTRAINT "Task_assignedTeamId_fkey" FOREIGN KEY ("assignedTeamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;
