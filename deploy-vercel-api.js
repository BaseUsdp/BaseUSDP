const https = require('https');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const VERCEL_TOKEN = 'eD8KT5tedceAllAcoxOZ820t';

function deploy(dir, name) {
  return new Promise((resolve, reject) => {
    console.log(`🚀 Deploying ${name}...`);
    
    // Use spawn instead of exec to bypass shell issues
    const vercel = spawn('vercel', ['--prod', '--yes', '--token', VERCEL_TOKEN], {
      cwd: dir,
      env: { ...process.env, VERCEL_TOKEN },
      stdio: 'inherit',
      shell: false
    });
    
    vercel.on('close', (code) => {
      if (code === 0) {
        console.log(`✅ ${name} deployed successfully!`);
        resolve();
      } else {
        console.error(`❌ ${name} deployment failed with code ${code}`);
        reject(new Error(`Deployment failed with code ${code}`));
      }
    });
    
    vercel.on('error', (error) => {
      console.error(`❌ Error spawning vercel for ${name}:`, error.message);
      // Try with npx as fallback
      console.log(`Trying with npx...`);
      const npx = spawn('npx', ['--yes', 'vercel@latest', '--prod', '--yes', '--token', VERCEL_TOKEN], {
        cwd: dir,
        env: { ...process.env, VERCEL_TOKEN },
        stdio: 'inherit',
        shell: false
      });
      
      npx.on('close', (npxCode) => {
        if (npxCode === 0) {
          console.log(`✅ ${name} deployed successfully via npx!`);
          resolve();
        } else {
          reject(new Error(`npx deployment failed with code ${npxCode}`));
        }
      });
      
      npx.on('error', (npxError) => {
        reject(npxError);
      });
    });
  });
}

async function main() {
  try {
    await deploy('/Users/x/Documents/Cursor Projects/Void402', 'Frontend');
    await deploy('/Users/x/Documents/Cursor Projects/Void402/packages/backend', 'Backend');
    console.log('\n✅ All deployments complete!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Deployment failed:', error.message);
    process.exit(1);
  }
}

main();
