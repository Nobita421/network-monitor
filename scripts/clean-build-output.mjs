import fs from 'node:fs/promises'
import path from 'node:path'

const workspaceRoot = process.cwd()
const targets = [
  'dist',
  'dist-electron',
  'dist-renderer',
]

function isWithinWorkspace(targetPath) {
  const relative = path.relative(workspaceRoot, targetPath)
  return relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative)
}

async function removeTarget(target) {
  const absoluteTarget = path.resolve(workspaceRoot, target)

  if (!isWithinWorkspace(absoluteTarget)) {
    throw new Error(`Refusing to remove path outside workspace: ${absoluteTarget}`)
  }

  await fs.rm(absoluteTarget, { recursive: true, force: true })
}

await Promise.all(targets.map(removeTarget))
