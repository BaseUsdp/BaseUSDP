#!/usr/bin/env python3
import subprocess
import os
import sys

os.environ['VERCEL_TOKEN'] = 'eD8KT5tedceAllAcoxOZ820t'

def deploy(dir, name):
    print(f'🚀 Deploying {name}...')
    try:
        # Use shell=False to bypass shell initialization
        result = subprocess.run(
            ['vercel', '--prod', '--yes', '--token', 'eD8KT5tedceAllAcoxOZ820t'],
            cwd=dir,
            env=os.environ,
            check=False,
            capture_output=False
        )
        if result.returncode == 0:
            print(f'✅ {name} deployed!')
            return True
        else:
            # Try npx as fallback
            print(f'Trying npx for {name}...')
            result = subprocess.run(
                ['npx', '--yes', 'vercel@latest', '--prod', '--yes', '--token', 'eD8KT5tedceAllAcoxOZ820t'],
                cwd=dir,
                env=os.environ,
                check=False,
                capture_output=False
            )
            if result.returncode == 0:
                print(f'✅ {name} deployed via npx!')
                return True
            else:
                print(f'❌ {name} failed')
                return False
    except Exception as e:
        print(f'❌ {name} error: {e}')
        return False

if __name__ == '__main__':
    frontend_ok = deploy('/Users/x/Documents/Cursor Projects/Void402', 'Frontend')
    backend_ok = deploy('/Users/x/Documents/Cursor Projects/Void402/packages/backend', 'Backend')
    
    if frontend_ok and backend_ok:
        print('\n✅ All deployments complete!')
        sys.exit(0)
    else:
        print('\n❌ Some deployments failed')
        sys.exit(1)
