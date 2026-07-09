import React from 'react';
import {
  LayoutGrid,
  CircleDollarSign,
  Box,
  Settings,
  UserCheck,
  ArrowUpDown,
  Zap,
  Calculator,
  FileBarChart2,
  CreditCard,
  ClipboardEdit,
  TrendingUp
} from 'lucide-react';

export default function Sidebar({ activeTab, setActiveTab }) {
  const menuItems = [
    { id: 'bord', label: 'Bord', icon: LayoutGrid },
    { id: 'tresor', label: 'Trésor', icon: CircleDollarSign },
    { id: 'stock', label: 'Stock', icon: Box },
    { id: 'pieces-rechange', label: 'Pièces Rechange', icon: Settings },
    { id: 'partenaires', label: 'Partenaires', icon: UserCheck },
    { id: 'entrees', label: 'Entrées', icon: ArrowUpDown },
    { id: 'ventes', label: 'Ventes', icon: Zap },
    { id: 'finance', label: 'Finance', icon: Calculator },
    { id: 'compta', label: 'Compta', icon: FileBarChart2 },
    { id: 'recouvr', label: 'Recouvr.', icon: CreditCard },
    { id: 'sav', label: 'SAV', icon: ClipboardEdit },
    { id: 'forecast', label: 'Forecast', icon: TrendingUp }
  ];

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        TAP <span>Manager</span>
      </div>
      <nav className="sidebar-nav">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <div
              key={item.id}
              className={`sidebar-nav-item ${isActive ? 'active' : ''}`}
              onClick={() => setActiveTab(item.id)}
            >
              <div className="sidebar-nav-item-left">
                <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
                <span>{item.label}</span>
              </div>
              {isActive && <div className="active-dot" />}
            </div>
          );
        })}
      </nav>
      <div className="sidebar-footer">
        <div className="user-profile">
          <div className="user-avatar">AD</div>
          <div className="user-info">
            <span className="user-name">Admin TAP</span>
            <span className="user-role">Super Administrateur</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
