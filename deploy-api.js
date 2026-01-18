const https = require('https');
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');

const VERCEL_TOKEN = 'eD8KT5tedceAllAcoxOZ820t';

// Try using execFile which might bypass shell issues
function deploy(dir, name) {
  return new Promise((resolve, reject) => {
    console.log(`🚀 Deploying ${name}...`);
    
    // Use execFile with explicit shell
    const vercelPath = '/usr/local/bin/vercel';
    const args = ['--prod', '--yes', '--token', VERCEL_TOKEN];
    
    const child = execFile(vercelPath, args, {
      cwd: dir,
      env: { ...process.env, VERCEL_TOKEN },
      shell: false
    }, (error, stdout, stderr) => {
      if (error) {
        // Try with npx as fallback
        console.log(`Trying npx fallback for ${name}...`);
        const npxChild = execFile('npx', ['vercel@latest', '--prod', '--yes', '--token', VERCEL_TOKEN], {
          cwd: dir,
          env: { ...process.env, VERCEL_TOKEN },
          shell: false
        }, (npxError, npxStdout, npxStderr) => {
          if (npxError) {
            console.error(`❌ ${name} deployment failed:`, npxError.message);
            reject(npxError);
          } else {
            console.log(npxStdout);
            console.log(`✅ ${name} deployed!`);
            resolve();
          }
        });
        
        npxChild.stdout.pipe(process.stdout);
        npxChild.stderr.pipe(process.stderr);
      } else {
        console.log(stdout);
        console.log(`✅ ${name} deployed!`);
        resolve();
      }
    });
    
    child.stdout.pipe(process.stdout);
    child.stderr.pipe(process.stderr);
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
