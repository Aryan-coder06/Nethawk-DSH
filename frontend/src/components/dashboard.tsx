// src/components/dashboard.tsx
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Header } from '@/components/header';
import { Sidebar } from '@/components/sidebar';
import { Overview } from '@/components/overview';
import { NetworkScanner } from '@/components/network-scanner';
import { BandwidthMonitor } from '@/components/bandwidth-monitor';
import { PortScanner } from '@/components/port-scanner';
import { FtpManager } from '@/components/ftp-manager';
import { MailChecker } from '@/components/mail-checker';
import { Settings } from '@/components/settings';

// Define the type for ActiveModule
type ActiveModule = 'overview' | 'network-scanner' | 'bandwidth' | 'port-scanner' | 'ftp' | 'mail' | 'settings';

export function Dashboard() {
  const [activeModule, setActiveModule] = useState<ActiveModule>('overview');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const renderActiveModule = () => {
    switch (activeModule) {
      case 'overview':
        return <Overview />;
      case 'network-scanner':
        return <NetworkScanner />;
      case 'bandwidth':
        return <BandwidthMonitor />;
      case 'port-scanner':
        return <PortScanner />;
      case 'ftp':
        return <FtpManager />;
      case 'mail':
        return <MailChecker />;
      case 'settings':
        return <Settings />;
      default:
        return <Overview />;
    }
  };

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Pass setActiveModule to Header */}
      <Header setActiveModule={setActiveModule} />
      
      {/* Added pt-16 to push content below the fixed header (header is h-16) */}
      <div className="flex flex-1 overflow-hidden pt-16">
        <Sidebar
          activeModule={activeModule}
          setActiveModule={setActiveModule}
          collapsed={sidebarCollapsed}
          setCollapsed={setSidebarCollapsed}
        />
        <motion.main
          // Added pt-0 here to ensure p-6 provides horizontal padding, but not top, as pt-16 is on parent.
          className={`flex-1 overflow-auto p-6 transition-all duration-300 ${
            sidebarCollapsed ? 'ml-16' : 'ml-64'
          } pt-0`}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3 }}
        >
          {renderActiveModule()}
        </motion.main>
      </div>
    </div>
  );
}