import { spawn } from 'node:child_process'

const child = spawn('npm run generate', {
  stdio: 'inherit',
  shell: true,
  env: {
    ...process.env,
    NUXT_MOBILE_BUILD: 'true'
  }
})

child.on('exit', (code) => {
  process.exit(code ?? 1)
})
