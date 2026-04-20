'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase';
import { Database } from '@/types/supabase';
import { Mail, MailOpen } from 'lucide-react';

type Message = Database['public']['Tables']['messages']['Row'];
type Profile = Database['public']['Tables']['profiles']['Row'];

interface MessageWithSender extends Message {
  sender?: Profile;
}

export default function MessagesPage() {
  const [messages, setMessages] = useState<MessageWithSender[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    async function fetchMessages() {
      try {
        setLoading(true);
        const { data: userData } = await supabaseBrowser.auth.getUser();

        if (!userData.user) {
          router.push('/auth/login');
          return;
        }

        // Fetch messages where user is receiver
        const { data, error: fetchError } = await supabaseBrowser
          .from('messages')
          .select(
            `
            *,
            sender:sender_id(id, email, full_name, avatar_url)
          `
          )
          .eq('receiver_id', userData.user.id)
          .order('created_at', { ascending: false });

        if (fetchError) throw fetchError;
        setMessages((data as any) || []);

        // Subscribe to new messages
        if (userData.user) {
          const subscription = supabaseBrowser
            .channel(`messages:receiver_id=eq.${userData.user.id}`)
            .on(
              'postgres_changes',
              {
                event: 'INSERT',
                schema: 'public',
                table: 'messages',
                filter: `receiver_id=eq.${userData.user.id}`,
              },
              (payload) => {
                setMessages((prev) => [payload.new as MessageWithSender, ...prev]);
              }
            )
            .subscribe();

          unsubscribe = () => {
            subscription.unsubscribe();
          };
        }
      } catch (err) {
        console.error('Error fetching messages:', err);
        setError('Failed to load messages');
      } finally {
        setLoading(false);
      }
    }

    fetchMessages();

    return () => {
      unsubscribe?.();
    };
  }, [router]);

  const markAsRead = async (messageId: string) => {
    try {
      await (supabaseBrowser as any)
        .from('messages')
        .update({ is_read: true })
        .eq('id', messageId);

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === messageId ? { ...msg, is_read: true } : msg
        )
      );
    } catch (err) {
      console.error('Error marking message as read:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">Messages</h1>
        <p className="text-gray-400 mt-2">Communication with our team</p>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-500/10 border border-red-500 text-red-400 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Messages List */}
      {messages.length === 0 ? (
        <div className="text-center py-12">
          <Mail className="mx-auto text-gray-600 mb-4" size={48} />
          <p className="text-gray-400">No messages yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {messages.map((message) => (
            <div
              key={message.id}
              onClick={() => !message.is_read && markAsRead(message.id)}
              className={`p-4 rounded-lg border transition-all cursor-pointer ${
                message.is_read
                  ? 'bg-gray-800/30 border-gray-700 hover:border-cyan-500'
                  : 'bg-cyan-500/10 border-cyan-500/50 hover:bg-cyan-500/20'
              }`}
            >
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0">
                  {message.is_read ? (
                    <Mail className="text-gray-600" size={20} />
                  ) : (
                    <MailOpen className="text-cyan-400" size={20} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-white">
                      {message.sender?.full_name || message.sender?.email || 'Unknown'}
                    </p>
                    <span className="text-xs text-gray-500">
                      {new Date(message.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-sm text-gray-400 mt-1 line-clamp-2">
                    {message.content}
                  </p>
                </div>
                {!message.is_read && (
                  <div className="flex-shrink-0 w-3 h-3 bg-cyan-500 rounded-full mt-1"></div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
