import React, { useState } from 'react';
import { UserContext } from './lib/UserContext';
import Sidebar from './components/Sidebar';
import LoginPage from './components/LoginPage';
import Dashboard from './views/Dashboard';
import Tresor from './views/Tresor';
import Stock from './views/Stock';
import SpareParts from './views/SpareParts';
import Partners from './views/Partners';
import EntreesVentes from './views/EntreesVentes';
import FinanceCompta from './views/FinanceCompta';
import Recouvrement from './views/Recouvrement';
import SAV from './views/SAV';
import Forecast from './views/Forecast';
import './App.css';

export default function App() {
  const [activeTab, setActiveTab] = useState('bord');
  const [user, setUser] = useState(null);

  const handleLogin = (loggedInUser) => {
    setUser(loggedInUser);
  };

  const handleLogout = () => {
    setUser(null);
    setActiveTab('bord');
  };

  if (!user) {
    return <LoginPage onLogin={handleLogin} />;
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'bord':
        return <Dashboard setActiveTab={setActiveTab} />;
      case 'tresor':
        return <Tresor />;
      case 'stock':
        return <Stock />;
      case 'pieces-rechange':
        return <SpareParts />;
      case 'partenaires':
        return <Partners />;
      case 'entrees':
        return <EntreesVentes initialTab="entrees" />;
      case 'ventes':
        return <EntreesVentes initialTab="ventes" />;
      case 'finance':
        return <FinanceCompta initialMode="finance" />;
      case 'compta':
        return <FinanceCompta initialMode="compta" />;
      case 'recouvr':
        return <Recouvrement />;
      case 'sav':
        return <SAV />;
      case 'forecast':
        return <Forecast />;
      default:
        return <Dashboard setActiveTab={setActiveTab} />;
    }
  };

  const getPageTitle = () => {
    switch (activeTab) {
      case 'bord': return 'Tableau de bord';
      case 'tresor': return 'Gestion de Trésorerie';
      case 'stock': return 'Inventaire & Stock';
      case 'pieces-rechange': return 'Pièces de Rechange';
      case 'partenaires': return 'Annuaire des Partenaires';
      case 'entrees': return 'Entrées & Approvisionnements';
      case 'ventes': return 'Suivi des Ventes';
      case 'finance': return 'Analyse Financière';
      case 'compta': return 'Journal Comptable';
      case 'recouvr': return 'Suivi du Recouvrement';
      case 'sav': return 'Support Service Après-Vente (SAV)';
      case 'forecast': return 'Prévisions (Forecast)';
      default: return 'TAP Manager';
    }
  };

  return (
    <UserContext.Provider value={user}>
      <div className="app-container">
        <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
        <main className="main-content">
          <header className="top-bar">
            <h1 className="top-bar-title">{getPageTitle()}</h1>
            <div className="top-bar-actions">
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                  Session : <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{user.name}</span>
                  <span style={{ fontSize: '11px', color: '#64748b' }}>({user.email})</span>
                  {user.role === 'viewer' && (
                    <span style={{
                      padding: '2px 8px',
                      borderRadius: '6px',
                      background: 'rgba(251, 191, 36, 0.12)',
                      border: '1px solid rgba(251, 191, 36, 0.25)',
                      color: '#fbbf24',
                      fontSize: '10px',
                      fontWeight: '700',
                      letterSpacing: '0.5px',
                      textTransform: 'uppercase'
                    }}>Lecture seule</span>
                  )}
                </div>
                <button
                  onClick={handleLogout}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 14px',
                    borderRadius: '8px',
                    border: '1px solid rgba(239, 68, 68, 0.25)',
                    background: 'rgba(239, 68, 68, 0.08)',
                    color: '#f87171',
                    fontSize: '12px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    fontFamily: 'inherit'
                  }}
                  onMouseEnter={e => { e.target.style.background = 'rgba(239, 68, 68, 0.15)'; e.target.style.borderColor = 'rgba(239, 68, 68, 0.4)'; }}
                  onMouseLeave={e => { e.target.style.background = 'rgba(239, 68, 68, 0.08)'; e.target.style.borderColor = 'rgba(239, 68, 68, 0.25)'; }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <polyline points="16 17 21 12 16 7" />
                    <line x1="21" x2="9" y1="12" y2="12" />
                  </svg>
                  Déconnexion
                </button>
              </div>
            </div>
          </header>
          <div className="content-body">
            {renderContent()}
          </div>
        </main>
      </div>
    </UserContext.Provider>
  );
}
