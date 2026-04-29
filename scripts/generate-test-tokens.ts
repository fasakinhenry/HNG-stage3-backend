import 'dotenv/config';
import { v7 as uuidv7 } from 'uuid';
import { connectDatabase } from '../src/config/database';
import { User } from '../src/models/User';
import { signAccessToken, signRefreshToken, storeRefreshToken } from '../src/utils/jwt';

async function generateTestTokens() {
  try {
    console.log('🔌 Connecting to database...');
    await connectDatabase();

    const testUsers = [
      {
        github_id: 'test-admin-001',
        username: 'test-admin',
        email: 'admin@insighta.test',
        avatar_url: 'https://avatars.githubusercontent.com/u/1?v=4',
        role: 'admin',
      },
      {
        github_id: 'test-analyst-001',
        username: 'test-analyst',
        email: 'analyst@insighta.test',
        avatar_url: 'https://avatars.githubusercontent.com/u/2?v=4',
        role: 'analyst',
      },
    ];

    console.log('\n🧹 Cleaning up corrupt records...');
    // Remove any null id records
    try {
      await User.collection.deleteMany({ _id: null });
      console.log('  ✅ Cleaned up null id records');
    } catch {
      console.log('  ⚠️ Could not clean null records (may not exist)');
    }

    // Remove test users to ensure fresh state
    await User.deleteMany({ github_id: { $in: testUsers.map((u) => u.github_id) } });
    console.log('  ✅ Cleared existing test users');

    console.log('\n📝 Creating test users...');
    const tokens: Record<string, { access_token: string; refresh_token?: string }> = {};

    for (const userData of testUsers) {
      const user = await User.create({
        _id: uuidv7(),
        ...userData,
        is_active: true,
        last_login_at: new Date(),
      });

      console.log(`  ✨ Created ${userData.role}: @${userData.username} (${user._id})`);

      const payload = { sub: String(user._id), username: user.username, role: user.role };

      const accessToken = signAccessToken(payload);
      const refreshToken = signRefreshToken(payload);
      await storeRefreshToken(String(user._id), refreshToken);

      tokens[userData.role] = { access_token: accessToken, refresh_token: refreshToken };
    }

    console.log('\n🎫 Test Tokens Generated (valid for 3-5 minutes):');
    console.log('\n' + '='.repeat(80));
    console.log('ADMIN TEST TOKEN:');
    console.log('-'.repeat(80));
    console.log(tokens.admin.access_token);
    console.log('\n' + '='.repeat(80));
    console.log('ANALYST TEST TOKEN:');
    console.log('-'.repeat(80));
    console.log(tokens.analyst.access_token);
    console.log('\n' + '='.repeat(80));
    console.log('REFRESH TEST TOKEN (paired with admin):');
    console.log('-'.repeat(80));
    console.log(tokens.admin.refresh_token);
    console.log('\n' + '='.repeat(80));

    console.log('\n✅ All tokens generated and stored successfully.');
    console.log('📋 Copy the tokens above into the /submit form.');

    process.exit(0);
  } catch (err) {
    console.error('❌ Error generating test tokens:', err);
    process.exit(1);
  }
}

void generateTestTokens();
