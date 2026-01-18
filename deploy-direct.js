const https = require('https');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const VERCEL_TOKEN = 'eD8KT5tedceAllAcoxOZ820t';

// Use child_process.exec which might bypass shell issues
function deploy(dir, name) {
  return new Promise((resolve, reject) => {
    console.log(`🚀 Deploying ${name}...`);
    const cmd = `cd "${dir}" && VERCEL_TOKEN=${VERCEL_TOKEN} vercel --prod --yes`;
    
    exec(cmd, { 
      env: { ...process.env, VERCEL_TOKEN },
      shell: '/bin/bash'
    }, (error, stdout, stderr) => {
      if (error) {
        console.error(`❌ ${name} deployment failed:`, error.message);
        reject(error);
      } else {
        console.log(stdout);
        console.log(`✅ ${name} deployed!`);
        resolve();
      }
    });
  });
}

async function main() {
  try {
    await deploy('/Users/x/Documents/Cursor Projects/Void402', 'Frontend');
    await deploy('/Users/x/Documents/Cursor Projects/Void402/packages/backend', 'Backend');
    console.log('\n✅ All deployments complete!');
  } catch (error) {
    console.error('Deployment failed:', error);
    process.exit(1);
  }
}

main();
