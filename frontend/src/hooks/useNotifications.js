import { useCallback, useEffect, useRef, useState } from 'react';

import { API_BASE_URL, api, getToken } from '../api/client';

export function useNotifications(token, { onNotification } = {}) {
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const eventSourceRef = useRef(null);
  const onNotificationRef = useRef(onNotification);

  useEffect(() => {
    onNotificationRef.current = onNotification;
  }, [onNotification]);

  const loadNotifications = useCallback(async () => {
    try {
      const data = await api.getNotifications();
      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
    } catch {
      // ignore
    }
  }, []);

  const markAsRead = useCallback(async () => {
    try {
      await api.markNotificationsRead();
      setUnreadCount(0);
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (!token) return;

    loadNotifications();

    let es = null;
    let reconnectTimer = null;

    const openStream = () => {
      const currentToken = getToken() || token;
      if (!currentToken) return;

      const url = `${API_BASE_URL}/notifications/stream?token=${encodeURIComponent(currentToken)}`;
      es = new EventSource(url);
      eventSourceRef.current = es;

      es.onmessage = (event) => {
        try {
          const notification = JSON.parse(event.data);
          setNotifications((prev) => [notification, ...prev].slice(0, 50));
          setUnreadCount((prev) => prev + 1);
          if (onNotificationRef.current) {
            onNotificationRef.current(notification);
          }
        } catch {
          // ignore parse errors (heartbeat comments)
        }
      };

      es.onerror = () => {
        // EventSource auto-reconnects, but if token expired we need to close and reopen with fresh token
        if (es.readyState === EventSource.CLOSED) {
          es.close();
          reconnectTimer = setTimeout(openStream, 3000);
        }
      };
    };

    openStream();

    return () => {
      if (es) es.close();
      if (reconnectTimer) clearTimeout(reconnectTimer);
      eventSourceRef.current = null;
    };
  }, [token, loadNotifications]);

  return { unreadCount, notifications, markAsRead, loadNotifications };
}
