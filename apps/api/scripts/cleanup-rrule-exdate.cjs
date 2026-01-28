#!/usr/bin/env node
/**
 * Cleanup script: Remove EXDATE from RRULE strings in Task table.
 * 
 * This script fixes tasks where EXDATE was incorrectly stored as part of the RRULE string.
 * EXDATE should be handled separately using RRuleSet, not embedded in the RRULE string.
 * 
 * Usage:
 *   pnpm --filter api run cleanup:rrule-exdate
 * 
 * Or directly:
 *   node apps/api/scripts/cleanup-rrule-exdate.cjs
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function cleanupRruleExdate() {
  console.log('Starting RRULE EXDATE cleanup...\n');

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
        customerName: true,
      },
    });

    console.log(`Found ${tasksWithExdate.length} task(s) with EXDATE in RRULE\n`);

    if (tasksWithExdate.length === 0) {
      console.log('No tasks to clean up. Exiting.');
      return;
    }

    let fixed = 0;
    let errors = 0;

    for (const task of tasksWithExdate) {
      try {
        // Parse and remove EXDATE from RRULE
        const parts = task.rrule.split(';');
        const rruleParts = parts.filter((p) => !p.startsWith('EXDATE=') && !p.startsWith('exdate='));
        const cleanRrule = rruleParts.join(';');

        if (cleanRrule === task.rrule) {
          console.log(`Task ${task.id} (${task.customerName}): No change needed`);
          continue;
        }

        // Update the task with cleaned RRULE
        await prisma.task.update({
          where: { id: task.id },
          data: { rrule: cleanRrule },
        });

        console.log(`✓ Fixed task ${task.id} (${task.customerName})`);
        console.log(`  Old: ${task.rrule}`);
        console.log(`  New: ${cleanRrule}\n`);
        fixed++;
      } catch (error) {
        console.error(`✗ Error fixing task ${task.id}:`, error.message);
        errors++;
      }
    }

    console.log(`\nCleanup complete:`);
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

cleanupRruleExdate()
  .then(() => {
    console.log('\nDone.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });
