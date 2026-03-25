import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import * as Sentry from '@sentry/react'
import './index.css'
import App from './App.tsx'

Sentry.init({
  dsn: 'https://KcNpji8QA8baHfo7AihgWcWB@s2321538.eu-fsn-3.betterstackdata.com/2321538',
  environment: import.meta.env.PROD ? 'production' : 'development',
  enabled: import.meta.env.PROD,
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
