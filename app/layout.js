// app/layout.js
import './globals.css';
import { Toaster } from 'react-hot-toast';
import AppShell from '../components/Layout/AppShell';
import NotificationProvider from '../components/NotificationPovider';

export const metadata = {
  title: 'Heaven Homes CRM',
  description: 'CRM for Heaven Homes',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>
        <NotificationProvider>
          <AppShell>{children}</AppShell>
        </NotificationProvider>
        <Toaster position="top-right" />
      </body>
    </html>
  );
}