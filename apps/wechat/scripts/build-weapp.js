const { execSync } = require('child_process')
const path = require('path')
const { ensureRootCompArtifacts } = require('./ensure-root-comp-artifacts')
const { ensureWorkspaceDeps } = require('./ensure-workspace-deps')

const mode = process.argv[2] || 'local'

function getBuildEnv(buildMode) {
  if (buildMode === 'release') {
    return {
      ...process.env,
      NODE_ENV: 'production',
      // Taro joins this value to appRoot, so use a relative path even when the
      // caller specifies an absolute task directory outside the workspace.
      WEAPP_OUTPUT_ROOT: process.env.WEAPP_OUTPUT_ROOT
        ? path.relative(process.cwd(), path.resolve(process.cwd(), process.env.WEAPP_OUTPUT_ROOT))
        : 'dist-release',
    }
  }

  if (buildMode === 'lan') {
    return {
      ...process.env,
      NODE_ENV: 'development',
      USE_LAN: '1',
      WEAPP_OUTPUT_ROOT: 'dist',
    }
  }

  return {
    ...process.env,
    NODE_ENV: 'development',
    USE_LOCALHOST: '1',
    WEAPP_OUTPUT_ROOT: 'dist',
  }
}

const env = getBuildEnv(mode)

console.log(`[build-weapp] mode=${mode} output=${env.WEAPP_OUTPUT_ROOT} node_env=${env.NODE_ENV}`)
ensureWorkspaceDeps()

execSync('npx taro build --type weapp', {
  cwd: process.cwd(),
  stdio: 'inherit',
  shell: true,
  env,
})

ensureRootCompArtifacts(path.resolve(process.cwd(), env.WEAPP_OUTPUT_ROOT || 'dist'))

execSync('node scripts/fix-weapp-wxml.js', {
  cwd: process.cwd(),
  stdio: 'inherit',
  shell: true,
  env,
})

execSync('node scripts/fix-weapp-comp-path.js', {
  cwd: process.cwd(),
  stdio: 'inherit',
  shell: true,
  env,
})

execSync('node scripts/copy-comp-to-subpackages.js', {
  cwd: process.cwd(),
  stdio: 'inherit',
  shell: true,
  env,
})
