#!/usr/bin/env node
/**
 * Migration script: Extract EXDATE from RRULE strings and move to exDates field.
 *
 * This script fixes tasks where EXDATE was incorrectly stored as part of the RRULE string.
 * EXDATE should be stored in the exDates array field, not embedded in the RRULE string.
 *
 * For DATE-only exdates (YYYYMMDD), converts them to DateTime matching the task's startAt time.
 *
 * Usage:
 *   pnpm --filter api run migrate:rrule-exdate
 *
 * Or directly:
 *   node apps/api/scripts/migrate-rrule-exdate-to-field.cjs
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

/**
 * Sanitize RRULE string by extracting EXDATE values
 * Returns { cleanRrule: string, extractedExdates: Date[] }
 */
function sanitizeRrule(rruleStr, dtstart) {
  if (!rruleStr || (!rruleStr.includes('EXDATE') && !rruleStr.includes('exdate'))) {
    return { cleanRrule: rruleStr, extractedExdates: [] };
  }

  const parts = rruleStr.split(';');
  const rruleParts = [];
  const extractedExdates = [];

  for (const part of parts) {
    const partLower = part.toLowerCase();
    if (partLower.startsWith('exdate=') || partLower.startsWith('exdate:')) {
      const exdateStr = part.substring(part.indexOf('=') + 1);
      const exdateValues = exdateStr.split(',');
      
      for (const exdateValue of exdateValues) {
        try {
          const dateStr = exdateValue.trim();
          let exdate;
          
          if (dateStr.length === 8) {
            // YYYYMMDD format (DATE-only) - convert to DateTime matching dtstart time
            const year = parseInt(dateStr.substring(0, 4), 10);
            const month = parseInt(dateStr.substring(4, 6), 10) - 1;
            const day = parseInt(dateStr.substring(6, 8), 10);
            
            // Use the same time-of-day as dtstart (in UTC)
            exdate = new Date(Date.UTC(
              year, month, day,
              dtstart.getUTCHours(),
              dtstart.getUTCMinutes(),
              dtstart.getUTCSeconds(),
              dtstart.getUTCMilliseconds()
            ));
            
            if (!isNaN(exdate.getTime())) {
              extractedExdates.push(exdate);
            }
          } else if (dateStr.length >= 15) {
            // YYYYMMDDTHHMMSSZ format (DateTime)
            const year = parseInt(dateStr.substring(0, 4), 10);
            const month = parseInt(dateStr.substring(4, 6), 10) - 1;
            const day = parseInt(dateStr.substring(6, 8), 10);
            const hour = dateStr.length > 9 ? parseInt(dateStr.substring(9, 11), 10) : 0;
            const minute = dateStr.length > 11 ? parseInt(dateStr.substring(11, 13), 10) : 0;
            const second = dateStr.length > 13 ? parseInt(dateStr.substring(13, 15), 10) : 0;
            
            exdate = new Date(Date.UTC(year, month, day, hour, minute, second));
            if (!isNaN(exdate.getTime())) {
              extractedExdates.push(exdate);
            }
          } else {
            // Try parsing as ISO string
            exdate = new Date(dateStr);
            if (!isNaN(exdate.getTime())) {
              extractedExdates.push(exdate);
            }
          }
        } catch (error) {
          console.warn(`  Invalid EXDATE value: ${exdateValue}, skipping`);
        }
      }
    } else {
      rruleParts.push(part);
    }
  }

  return {
    cleanRrule: rruleParts.join(';'),
    extractedExdates,
  };
}

async function migrateRruleExdate() {
  console.log('Starting RRULE EXDATE migration...\n');

  try {
    // Find all tasks with EXDATE in their rrule
    const tasksWithExdate = await prisma.task.findMany({
      where: {
        rrule: {
          contains: 'EXDATE',
          mode: 'insensitive',
        },
      },
      select: {
        id: true,
        rrule: true,
        startAt: true,
        exDates: true,
        customerName: true,
      },
    });

    console.log(`Found ${tasksWithExdate.length} task(s) with EXDATE in RRULE\n`);

    if (tasksWithExdate.length === 0) {
      console.log('No tasks to migrate. Exiting.');
      return;
    }

    let fixed = 0;
    let errors = 0;

    for (const task of tasksWithExdate) {
      try {
        // Extract EXDATE from rrule
        const { cleanRrule, extractedExdates } = sanitizeRrule(task.rrule, task.startAt);
        
        if (cleanRrule === task.rrule) {
          console.log(`Task ${task.id} (${task.customerName}): No change needed`);
          continue;
        }

        // Normalize each extracted exdate to seconds precision (matching expansion logic)
        const normalizedExdates = extractedExdates.map(exdate => {
          const normalized = new Date(exdate);
          normalized.setUTCMilliseconds(0);
          return normalized;
        });

        // Create TaskOverride records with isDeleted=true for each extracted exdate
        let createdOverrides = 0;
        for (const normalizedExdate of normalizedExdates) {
          try {
            // Check if override already exists
            const existingOverride = await prisma.taskOverride.findUnique({
              where: {
                seriesId_originalStartAt: {
                  seriesId: task.id,
                  originalStartAt: normalizedExdate,
                },
              },
            });

            if (!existingOverride) {
              // Create new override with deletedAt set
              await prisma.taskOverride.create({
                data: {
                  seriesId: task.id,
                  originalStartAt: normalizedExdate,
                  deletedAt: new Date(), // Mark as deleted
                },
              });
              createdOverrides++;
            } else if (!existingOverride.deletedAt) {
              // Update existing override to mark as deleted
              await prisma.taskOverride.update({
                where: {
                  seriesId_originalStartAt: {
                    seriesId: task.id,
                    originalStartAt: normalizedExdate,
                  },
                },
                data: {
                  deletedAt: new Date(),
                },
              });
              createdOverrides++;
            }
          } catch (error) {
            console.warn(`  Warning: Could not create override for ${normalizedExdate.toISOString()}:`, error.message);
          }
        }

        // Update the task with cleaned RRULE (no EXDATE)
        await prisma.task.update({
          where: { id: task.id },
          data: {
            rrule: cleanRrule,
          },
        });

        console.log(`✓ Migrated task ${task.id} (${task.customerName})`);
        console.log(`  Old rrule: ${task.rrule}`);
        console.log(`  New rrule: ${cleanRrule}`);
        console.log(`  Created ${createdOverrides} TaskOverride record(s) with deletedAt=true\n`);
        fixed++;
      } catch (error) {
        console.error(`✗ Error migrating task ${task.id}:`, error.message);
        errors++;
      }
    }

    console.log(`\nMigration complete:`);
    console.log(`  Fixed: ${fixed}`);
    console.log(`  Errors: ${errors}`);
    console.log(`  Total: ${tasksWithExdate.length}`);
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

migrateRruleExdate()
  .then(() => {
    console.log('\nDone.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });
