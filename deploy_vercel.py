#!/usr/bin/env python3
import subprocess
import os
import sys

os.environ['VERCEL_TOKEN'] = 'eD8KT5tedceAllAcoxOZ820t'

# Deploy frontend
print("🚀 Deploying frontend to Vercel production...")
try:
    os.chdir("/Users/x/Documents/Cursor Projects/Void402")
    subprocess.run(['vercel', '--prod', '--yes'], check=True, env=os.environ)
    print("✅ Frontend deployed!")
except Exception as e:
    print(f"❌ Frontend deployment failed: {e}")
    sys.exit(1)

# Deploy backend
print("\n🚀 Deploying backend to Vercel production...")
try:
    os.chdir("/Users/x/Documents/Cursor Projects/Void402/packages/backend")
    subprocess.run(['vercel', '--prod', '--yes'], check=True, env=os.environ)
    print("✅ Backend deployed!")
except Exception as e:
    print(f"❌ Backend deployment failed: {e}")
    sys.exit(1)

print("\n✅ All deployments complete!")
