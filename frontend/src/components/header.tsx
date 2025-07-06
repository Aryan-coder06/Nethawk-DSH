import { useState } from 'react';
import { motion } from 'framer-motion';
import { Bell, Shield, User, Moon, Sun, Monitor } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { useTheme } from '@/components/theme-provider';

type ActiveModule = 'overview' | 'network-scanner' | 'bandwidth' | 'port-scanner' | 'ftp' | 'mail' | 'settings';

interface HeaderProps {
  setActiveModule: (module: ActiveModule) => void;
}

export function Header({ setActiveModule }: HeaderProps) {
  const [notifications] = useState(3);
  const { theme, setTheme } = useTheme();

  return (
    <motion.header

      className="h-16 border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 fixed top-0 left-0 right-0 z-50 w-full"
      initial={{ y: -30 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {}
      {}
      <div className="flex items-center justify-between h-full px-6 max-w-[var(--max-content-width)] mx-auto">
        {}
        <div className="flex items-center space-x-4 flex-shrink-0">
          <motion.div
            className="flex items-center space-x-2"
            whileHover={{ scale: 1.05 }}
            transition={{ type: "spring", stiffness: 400, damping: 17 }}
          >
            <div className="relative">
              <Shield className="h-9 w-9 text-primary" />
              <div className="absolute -top-1 -right-1 h-3 w-3 bg-green-500 rounded-full animate-pulse" />
            </div>
            <div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-blue-500 bg-clip-text text-transparent whitespace-nowrap">
                NetHawk
              </h1>
              <p className="text-xs text-muted-foreground -mt-1 whitespace-nowrap">Network Utility Dashboard</p>
            </div>
          </motion.div>
        </div>

        {}
        <div className="flex items-center space-x-2 flex-shrink-0">
          {}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9">
                <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                <span className="sr-only">Toggle theme</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setTheme("light")}>
                <Sun className="mr-2 h-4 w-4" />
                <span>Light</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme("dark")}>
                <Moon className="mr-2 h-4 w-4" />
                <span>Dark</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme("system")}>
                <Monitor className="mr-2 h-4 w-4" />
                <span>System</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {}
          <Button variant="ghost" size="icon" className="h-9 w-9 relative">
            <Bell className="h-5 w-5" />
            {notifications > 0 && (
              <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs bg-red-500 hover:bg-red-500">
                {notifications}
              </Badge>
            )}
          </Button>

          {}
          {}

          {}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9">
                <User className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Security Admin</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {}
              <DropdownMenuItem onClick={() => setActiveModule('settings')}>
                Profile Settings
              </DropdownMenuItem>
              <DropdownMenuItem>Security Logs</DropdownMenuItem>
              <DropdownMenuItem>Preferences</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem>Sign Out</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </motion.header>
  );
}