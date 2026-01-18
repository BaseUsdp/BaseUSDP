const { execSync } = require('child_process');
const path = require('path');

const VERCEL_TOKEN = 'eD8KT5tedceAllAcoxOZ820t';

console.log('🚀 Deploying frontend to Vercel production...');
try {
  execSync(`cd "${__dirname}" && vercel --prod --yes --token ${VERCEL_TOKEN}`, {
    stdio: 'inherit',
    env: { ...process.env, VERCEL_TOKEN }
  });
  console.log('✅ Frontend deployed!');
} catch (error) {
  console.error('❌ Frontend deployment failed:', error.message);
}

console.log('\n🚀 Deploying backend to Vercel production...');
try {
  execSync(`cd "${__dirname}/packages/backend" && vercel --prod --yes --token ${VERCEL_TOKEN}`, {
    stdio: 'inherit',
    env: { ...process.env, VERCEL_TOKEN }
  });
  console.log('✅ Backend deployed!');
} catch (error) {
  console.error('❌ Backend deployment failed:', error.message);
}

console.log('\n✅ All deployments complete!');
