import { RouterProvider } from './router';
import { AppProviders } from './providers';

export default function App() {
  return (
    <AppProviders>
      <RouterProvider />
    </AppProviders>
  );
}
