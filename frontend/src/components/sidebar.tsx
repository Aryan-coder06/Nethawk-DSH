import { motion } from 'framer-motion';
import { 
  BarChart3, 
  Network, 
  Monitor, 
  Scan, 
  FolderOpen, 
  Mail, 
  Settings, 
  ChevronLeft,
  ChevronRight,
  Activity,
  Zap
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type ActiveModule = 'overview' | 'network-scanner' | 'bandwidth' | 'port-scanner' | 'ftp' | 'mail' | 'settings';

interface SidebarProps {
  activeModule: ActiveModule;
  setActiveModule: (module: ActiveModule) => void;
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
}

const menuItems = [
  {
    id: 'overview' as ActiveModule,
    label: 'Overview',
    icon: BarChart3,
    badge: null,
    description: 'System overview and network status'
  },
  {
    id: 'bandwidth' as ActiveModule,
    label: 'Bandwidth Monitor',
    icon: Activity,
    badge: null,
    description: 'Real-time bandwidth usage monitoring'
  },
  {
    id: 'port-scanner' as ActiveModule,
    label: 'Port Scanner',
    icon: Scan,
    badge: null,
    description: 'Scan ports and detect vulnerabilities'
  },
  {
    id: 'ftp' as ActiveModule,
    label: 'FTP Manager      ',
    icon: FolderOpen,
    badge: 'Debugging',
    description: 'Manage FTP connections and transfers'
  },
  {
    id: 'mail' as ActiveModule,
    label: 'Mail Checker',
    icon: Mail,
    badge: '2',
    description: 'Check mail server connectivity'
  },
  {
    id: 'settings' as ActiveModule,
    label: 'Settings',
    icon: Settings,
    badge: null,
    description: 'Configure dashboard preferences'
  }
];

export function Sidebar({ activeModule, setActiveModule, collapsed, setCollapsed }: SidebarProps) {
  return (
    <TooltipProvider>
      <motion.aside 
        className={cn(
          "fixed left-0 top-16 h-[calc(100vh-4rem)] bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-r border-border/40 z-40 transition-all duration-300",
          collapsed ? "w-16" : "w-64"
        )}
        initial={{ x: -256 }}
        animate={{ x: 0 }}
        transition={{ duration: 0.3 }}
      >
        {/* Collapse Toggle */}
        <div className={cn("absolute z-50 top-6 transition-all duration-300",collapsed ? "right-[-12px]" : "-right-3")}
>
          <Button
            variant="outline"
            size="icon"
            className="h-6 w-6 rounded-full bg-background border-border shadow-md hover:shadow-lg transition-shadow"
            onClick={() => setCollapsed(!collapsed)}
          >
            {collapsed ? (
              <ChevronRight className="h-3 w-3" />
            ) : (
              <ChevronLeft className="h-3 w-3" />
            )}
          </Button>
        </div>

        {/* Navigation */}
        <nav className="p-4 space-y-2">
          {/* Status Indicator */}
          {!collapsed && (
            <motion.div 
              className="mb-6 p-3 rounded-lg bg-green-500/10 border border-green-500/20"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <div className="flex items-center space-x-2">
                <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse" />
                <span className="text-sm font-medium text-green-400">System Online</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">All services operational</p>
            </motion.div>
          )}

          {/* Menu Items */}
          {menuItems.map((item, index) => {
            const isActive = activeModule === item.id;
            const Icon = item.icon;

            const content = (
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Button
                      variant={isActive ? "secondary" : "ghost"}
                      className={cn(
                        "justify-start h-12 transition-all duration-200",
                        collapsed ? "px-3" : "px-4",
                        isActive && "bg-primary/10 text-primary border-primary/20 shadow-md",
                        !isActive && "hover:bg-accent/50 hover:text-accent-foreground"
                      )}
                      style={{
                        width: collapsed ? "calc(100% + 12px)" : "100%",
                      }}
                      onClick={() => setActiveModule(item.id)}
                    >
                  <div className={cn("flex items-center", collapsed ? "justify-center" : "space-x-3")}>
                    <Icon className={cn("h-5 w-5", isActive && "text-primary")} />
                    {!collapsed && (
                      <>
                        <span className="font-medium">{item.label}</span>
                        {item.badge && (
                          <Badge variant={item.badge === 'Active' || 'Debugging' ? 'default' : 'secondary'} className="ml-auto text-xs">
                            {item.badge}
                          </Badge>
                        )}
                      </>
                    )}
                  </div>
                </Button>
              </motion.div>
            );

            if (collapsed) {
              return (
                <Tooltip key={item.id} delayDuration={0}>
                  <TooltipTrigger asChild>
                    {content}
                  </TooltipTrigger>
                  <TooltipContent side="right" className="flex items-center space-x-2">
                    <span>{item.label}</span>
                    {item.badge && (
                      <Badge variant={item.badge === 'Active' ? 'default' : 'secondary'} className="text-xs">
                        {item.badge}
                      </Badge>
                    )}
                  </TooltipContent>
                </Tooltip>
              );
            }

            return <div key={item.id}>{content}</div>;
          })}
        </nav>

        {/* Footer */}
        {!collapsed && (
          <motion.div 
            className="absolute bottom-4 left-4 right-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            <div className="p-3 rounded-lg bg-accent/10 border border-accent/20">
              <div className="flex items-center space-x-2">
                <Zap className="h-4 w-4 text-yellow-500" />
                <span className="text-sm font-medium">Pro Features</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Upgrade for advanced monitoring
              </p>
            </div>
          </motion.div>
        )}
      </motion.aside>
    </TooltipProvider>
  );
}