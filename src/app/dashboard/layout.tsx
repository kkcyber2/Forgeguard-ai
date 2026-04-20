// =====================================================
// Dashboard Layout
// =====================================================

import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getCurrentUser } from '@/lib/supabase-server';
import {
  LayoutDashboard,
  FolderKanban,
  MessageSquare,
  Calendar,
  User,
  Settings,
  LogOut,
  FileText,
  Users,
  BarChart3,
  Plus,
} from 'lucide-react';

const adminSidebarLinks = [
  { icon: LayoutDashboard, label: 'Overview', href: '/dashboard' },
  { icon: FileText, label: 'Submissions', href: '/dashboard/submissions' },
  { icon: FolderKanban, label: 'All Projects', href: '/dashboard/projects' },
  { icon: Users, label: 'Clients', href: '/dashboard/clients' },
  { icon: MessageSquare, label: 'Messages', href: '/dashboard/messages' },
  { icon: BarChart3, label: 'Analytics', href: '/dashboard/analytics' },
  { icon: User, label: 'Profile', href: '/dashboard/profile' },
  { icon: Settings, label: 'Settings', href: '/dashboard/settings' },
];

const clientSidebarLinks = [
  { icon: LayoutDashboard, label: 'Overview', href: '/dashboard' },
  { icon: Plus, label: 'Submit Project', href: '/dashboard/submit' },
  { icon: FolderKanban, label: 'My Projects', href: '/dashboard/projects' },
  { icon: MessageSquare, label: 'Messages', href: '/dashboard/messages' },
  { icon: User, label: 'Profile', href: '/dashboard/profile' },
  { icon: Settings, label: 'Settings', href: '/dashboard/settings' },
];

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/auth/login');
  }

  const sidebarLinks = user.role === 'admin' ? adminSidebarLinks : clientSidebarLinks;

  return (
    <div className="min-h-screen bg-background">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 bottom-0 w-64 bg-card border-r border-border hidden lg:block">
        <div className="p-6">
          <Link href="/" className="flex items-center gap-2 mb-8">
            <div className="w-8 h-8 rounded-lg bg-cyan flex items-center justify-center">
              <span className="font-bold text-background">F</span>
            </div>
            <span className="font-heading font-bold">ForgeGuard</span>
          </Link>

          <nav className="space-y-1">
            {sidebarLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-gray-400 hover:bg-white/5 hover:text-white transition-colors"
              >
                <link.icon className="w-5 h-5" />
                <span>{link.label}</span>
              </Link>
            ))}
          </nav>
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-6 border-t border-border">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan to-blue-500 flex items-center justify-center text-sm font-bold">
              {user.full_name?.charAt(0) || user.email.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">
                {user.full_name || 'User'}
              </p>
              <p className="text-sm text-gray-400 truncate">{user.email}</p>
            </div>
          </div>
          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-border hover:bg-white/5 transition-colors text-sm"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </form>
        </div>
      </aside>

      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-card border-b border-border flex items-center justify-between px-4 z-50">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-cyan flex items-center justify-center">
            <span className="font-bold text-background">F</span>
          </div>
          <span className="font-heading font-bold">ForgeGuard</span>
        </Link>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan to-blue-500 flex items-center justify-center text-sm font-bold">
            {user.full_name?.charAt(0) || user.email.charAt(0)}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="lg:ml-64 pt-16 lg:pt-0 min-h-screen">
        <div className="p-6 lg:p-8">{children}</div>
      </main>

      {/* Mobile Navigation */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-card border-t border-border flex justify-around p-2 z-50">
        {sidebarLinks.slice(0, 5).map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="flex flex-col items-center gap-1 p-2 text-gray-400 hover:text-cyan transition-colors"
          >
            <link.icon className="w-5 h-5" />
            <span className="text-[10px]">{link.label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
