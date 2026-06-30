import './globals.css';
import { ReactNode } from 'react';
import { CartProvider } from './providers/CartProvider';
import AuthProvider from './providers/AuthProvider';

export const metadata = {
  title: 'Bite Theory — Smart Food, Better Living',
  description: '100% pure veg. Good food, right price. Indore.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0 }}>
        <AuthProvider>
          <CartProvider>{children}</CartProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
