const https = require('https');
const fs = require('fs');
const path = require('path');
const { createHash } = require('crypto');
const { exec } = require('child_process');

const VERCEL_TOKEN = 'eD8KT5tedceAllAcoxOZ820t';

// Deploy using Vercel API directly
async function deployViaAPI(projectPath, projectName) {
  return new Promise((resolve, reject) => {
    // First, we need to get the project ID
    // Then create a deployment via API
    // This is complex, so let's try a different approach
    
    // Use child_process.exec with explicit shell path
    const shellPath = '/bin/bash';
    const cmd = `cd "${projectPath}" && vercel --prod --yes --token ${VERCEL_TOKEN}`;
    
    exec(cmd, {
      shell: shellPath,
      env: { ...process.env, VERCEL_TOKEN }
    }, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error: ${error.message}`);
        reject(error);
        return;
      }
      console.log(stdout);
      if (stderr) console.error(stderr);
      resolve();
    });
  });
}

async function main() {
  try {
    console.log('🚀 Deploying Frontend...');
    await deployViaAPI('/Users/x/Documents/Cursor Projects/Void402', 'Frontend');
    
    console.log('\n🚀 Deploying Backend...');
    await deployViaAPI('/Users/x/Documents/Cursor Projects/Void402/packages/backend', 'Backend');
    
    console.log('\n✅ All deployments complete!');
  } catch (error) {
    console.error('❌ Deployment failed:', error);
    process.exit(1);
  }
}

main();
