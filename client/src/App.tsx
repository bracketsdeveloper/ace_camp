// src/App.tsx
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Login from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import Admin from "@/pages/admin";
import Cart from "@/pages/cart";
import MyOrders from "@/pages/my-orders";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { SessionTimer } from "@/components/session/session-timer";
import Landing from "./pages/landing";
import Home from "./pages/home";
import OccasionalCampaigns from "./pages/occasional-campaigns";
import BlogPage from "./pages/blog";
import BlogDetailPage from "./pages/blog-detail";
import CSRSupportPage from "./pages/csr-support";
import BulkBuyPage from "./pages/bulk-buy";

function Routes() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <Switch>
      <Route path="/admin">
        <Admin />
      </Route>

      <Route path="/dashboard">
        {isAuthenticated ? <Dashboard /> : <Login />}
      </Route>

      <Route path="/cart">
        {isAuthenticated ? <Cart /> : <Login />}
      </Route>

      <Route path="/my-orders">
        {isAuthenticated ? <MyOrders /> : <Login />}
      </Route>

      <Route path="/login">
        {isAuthenticated ? <Dashboard /> : <Login />}
      </Route>

      <Route path="/home">
        {isAuthenticated ? <Home /> : <Login />}
      </Route>

      <Route path="/special-occasions">
        {isAuthenticated ? <OccasionalCampaigns /> : <Login />}
      </Route>

      <Route path="/csr">
        {isAuthenticated ? <CSRSupportPage /> : <Login />}
      </Route>


      // Blogs should be PUBLIC 
      <Route path="/blog" component={BlogPage} />
      <Route path="/blog/:slug" component={BlogDetailPage} />

      <Route path="/bulk-buy">
        {isAuthenticated ? <BulkBuyPage /> : <Login />}
      </Route>


      <Route path="/">
        <Landing />
      </Route>

      <Route>
        <NotFound />
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <Toaster />
          <Routes />
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;