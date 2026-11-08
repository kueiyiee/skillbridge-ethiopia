import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from '@/src/app/providers/ThemeContext';
import { AuthProvider } from '@/src/app/providers/AuthContext';
import { AiNexusProvider } from '@/src/app/providers/AiNexusContext';
import AppRouter from '@/src/app/router';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ThemeProvider>
          <AiNexusProvider>
            <AppRouter />
          </AiNexusProvider>
        </ThemeProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}