import React, { useState } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './views/Dashboard';
import Tresor from './views/Tresor';
import Stock from './views/Stock';
import SpareParts from './views/SpareParts';
import Partners from './views/Partners';
import EntreesVentes from './views/EntreesVentes';
import FinanceCompta from './views/FinanceCompta';
import Recouvrement from './views/Recouvrement';
import SAV from './views/SAV';
import './App.css';

export default function App() {
  const [activeTab, setActiveTab] = useState('bord');

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
      default: return 'TAP Manager';
    }
  };

  return (
    <div className="app-container">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      <main className="main-content">
        <header className="top-bar">
          <h1 className="top-bar-title">{getPageTitle()}</h1>
          <div className="top-bar-actions">
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
              Session : <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>Admin</span>
            </div>
          </div>
        </header>
        <div className="content-body">
          {renderContent()}
        </div>
      </main>
    </div>
  );
}
