import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../styles/App.css'
import '../styles/PlayerDossier.css'
import '../styles/ReportForm.css'
import '../styles/ReportFormWizard.css'
import '../styles/LandingScreen.css'
import '../styles/Cyberpunk.css'
import '../styles/GlitchTheme.css'
import '../styles/TerminalText.css'
import '../styles/PlayerFile.css'
import App from './App.jsx'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
)
