// =====================================================
// Messages Hook
// =====================================================

'use client';

import { useState, useCallback, useEffect } from 'react';
import { supabaseBrowser } from '@/lib/supabase';
import { useAuthStore } from '@/lib/store';
import type { Message, Profile } from '@/types';

export function useMessages() {
  const { user } = useAuthStore();
  const [messages, setMessages] = useState<Message[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch messages
  const fetchMessages = useCallback(async () => {
    if (!user) return;

    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await (supabaseBrowser as any)
        .from('messages')
        .select(`
          *,
          sender:profiles!messages_sender_id_fkey(*)
        `)
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      const typedMessages = ((data || []) as any[]).map((msg) => ({
        ...msg,
        sender: msg.sender as Profile,
      })) as Message[];

      setMessages(typedMessages);
      setUnreadCount(
        typedMessages.filter((m) => !m.is_read && m.receiver_id === user.id).length
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch messages');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // Send message
  const sendMessage = useCallback(
    async (content: string, receiverId?: string, projectId?: string) => {
      if (!user) throw new Error('Not authenticated');

      try {
        const { data, error: sendError } = await (supabaseBrowser as any)
          .from('messages')
          .insert({
            sender_id: user.id,
            receiver_id: receiverId || null,
            project_id: projectId || null,
            content,
            is_read: false,
          })
          .select()
          .single();

        if (sendError) throw sendError;

        setMessages((prev) => [data as Message, ...prev]);
        return data as Message;
      } catch (err) {
        throw err instanceof Error ? err : new Error('Failed to send message');
      }
    },
    [user]
  );

  // Mark message as read
  const markAsRead = useCallback(
    async (messageId: string) => {
      if (!user) return;

      try {
        const { error: updateError } = await (supabaseBrowser as any)
          .from('messages')
          .update({ is_read: true })
          .eq('id', messageId)
          .eq('receiver_id', user.id);

        if (updateError) throw updateError;

        setMessages((prev) =>
          prev.map((m) => (m.id === messageId ? { ...m, is_read: true } : m))
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      } catch (err) {
        console.error('Error marking message as read:', err);
      }
    },
    [user]
  );

  // Mark all as read
  const markAllAsRead = useCallback(async () => {
    if (!user) return;

    try {
        const { error: updateError } = await (supabaseBrowser as any)
        .update({ is_read: true })
        .eq('receiver_id', user.id)
        .eq('is_read', false);

      if (updateError) throw updateError;

      setMessages((prev) => prev.map((m) => ({ ...m, is_read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error('Error marking all messages as read:', err);
    }
  }, [user]);

  // Delete message
  const deleteMessage = useCallback(
    async (messageId: string) => {
      if (!user) throw new Error('Not authenticated');

      try {
        const { error: deleteError } = await (supabaseBrowser as any)
          .from('messages')
          .delete()
          .eq('id', messageId)
          .eq('sender_id', user.id);

        if (deleteError) throw deleteError;

        setMessages((prev) => prev.filter((m) => m.id !== messageId));
      } catch (err) {
        throw err instanceof Error ? err : new Error('Failed to delete message');
      }
    },
    [user]
  );

  // Subscribe to new messages
  useEffect(() => {
    if (!user) return;

    const subscription = supabaseBrowser
      .channel('messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `receiver_id=eq.${user.id}`,
        },
        (payload) => {
          const newMessage = payload.new as Message;
          setMessages((prev) => [newMessage, ...prev]);
          if (!newMessage.is_read) {
            setUnreadCount((prev) => prev + 1);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `receiver_id=eq.${user.id}`,
        },
        (payload) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === payload.new.id ? (payload.new as Message) : m
            )
          );
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [user]);

  // Initial fetch
  useEffect(() => {
    if (user) {
      fetchMessages();
    }
  }, [user, fetchMessages]);

  return {
    messages,
    unreadCount,
    isLoading,
    error,
    fetchMessages,
    sendMessage,
    markAsRead,
    markAllAsRead,
    deleteMessage,
  };
}
