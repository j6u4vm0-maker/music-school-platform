import { clearAllInventoryData } from '../src/lib/services/inventory';

async function run() {
  try {
    console.log('Executing force cleanup...');
    await clearAllInventoryData();
    console.log('Cleanup successful!');
    process.exit(0);
  } catch (error) {
    console.error('Cleanup failed:', error);
    process.exit(1);
  }
}

run();
