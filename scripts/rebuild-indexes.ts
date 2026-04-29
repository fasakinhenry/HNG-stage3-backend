import 'dotenv/config';
import { connectDatabase } from '../src/config/database';
import { User } from '../src/models/User';

async function rebuildIndexes() {
  try {
    console.log('🔌 Connecting to database...');
    await connectDatabase();

    console.log('\n🔧 Rebuilding User collection indexes...');
    
    // Drop all indexes except _id
    await User.collection.dropIndexes();
    console.log('  ✅ Dropped all indexes');

    // Delete all data to start fresh
    await User.deleteMany({});
    console.log('  ✅ Cleared all user data');

    // Rebuild indexes from schema definition
    await User.collection.createIndexes();
    console.log('  ✅ Recreated indexes from schema');

    console.log('\n✅ Database ready for seeding!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error rebuilding indexes:', err);
    process.exit(1);
  }
}

void rebuildIndexes();
