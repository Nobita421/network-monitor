import { spawn } from 'node:child_process'

const passthroughArgs = process.argv.slice(2)
const unsupportedFlags = new Set(['--forceExit', '--no-coverage'])
const normalizedArgs = passthroughArgs[0] === '--' ? passthroughArgs.slice(1) : passthroughArgs
const filteredArgs = normalizedArgs.filter((arg) => !unsupportedFlags.has(arg))

const vitestArgs = ['exec', 'vitest', 'run', '--config', 'vitest.config.ts', '--passWithNoTests', ...filteredArgs]
const pnpmCommand = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm'

const child = spawn(pnpmCommand, vitestArgs, {
  stdio: 'inherit',
  shell: process.platform === 'win32',
})

child.on('error', (error) => {
  console.error('Failed to run Vitest:', error)
  process.exit(1)
})

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal)
    return
  }

  process.exit(code ?? 1)
})
