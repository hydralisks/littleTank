import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './app/App'
import './styles/tokens.css'
import './styles/encounter.css'

async function bootstrap() {
  const { loadDesignerWorkbooks } = await import('./game/data/workbookLoader')
  await loadDesignerWorkbooks()

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

void bootstrap()
