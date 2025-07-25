import { ThemeProvider } from '@/components/theme-provider';
import { Dashboard } from '@/components/dashboard';
import { Toaster } from '@/components/ui/sonner';
import './App.css';
// Main function mei add one kiya hain regarding AUth

function App() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="nethawk-ui-theme">
      <div className="min-h-screen bg-background">
        <Dashboard />
        <Toaster />
      </div>
    </ThemeProvider>
  );
}

export default App;
