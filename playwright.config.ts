import { defineConfig, devices } from '@playwright/test'

const port = 3100
const baseURL = `http://localhost:${port}`

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  // Os testes correm contra o servidor de desenvolvimento do Next, que
  // compila rotas sob demanda; com vários workers o redirecionamento
  // do checkout ficava lento e falhava de forma intermitente.
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL,
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: `npm run dev -- --port ${port}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
