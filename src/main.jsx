import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

if (!localStorage.getItem('tap_db_firebase_loaded_v2')) {
  localStorage.removeItem('tap_partners');
  localStorage.removeItem('tap_stock');
  localStorage.removeItem('tap_sav_tickets');
  localStorage.removeItem('tap_cheques');
  localStorage.removeItem('tap_transactions');
  localStorage.setItem('tap_db_firebase_loaded_v2', 'true');
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
