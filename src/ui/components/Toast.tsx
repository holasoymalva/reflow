import React, { useEffect, useState } from 'react';
import { errorHandler, ToastNotification } from '../utils/errorHandler';

interface ToastProps {
  notification: ToastNotification;
  onClose: (id: string) => void;
}

const Toast: React.FC<ToastProps> = ({ notification, onClose }) => {
  useEffect(() => {
    if (notification.duration) {
      const timer = setTimeout(() => {
        onClose(notification.id);
      }, notification.duration);

      return () => clearTimeout(timer);
    }
  }, [notification.id, notification.duration, onClose]);

  const getBackgroundColor = () => {
    switch (notification.type) {
      case 'error':
        return '#dc2626';
      case 'warning':
        return '#f59e0b';
      case 'success':
        return '#10b981';
      case 'info':
      default:
        return '#3b82f6';
    }
  };

  return (
    <div
      style={{
        backgroundColor: getBackgroundColor(),
        color: 'white',
        padding: '12px 16px',
        borderRadius: '6px',
        marginBottom: '8px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
        minWidth: '300px',
        maxWidth: '500px',
        animation: 'slideIn 0.3s ease-out'
      }}
    >
      <span style={{ flex: 1 }}>{notification.message}</span>
      <button
        onClick={() => onClose(notification.id)}
        style={{
          background: 'none',
          border: 'none',
          color: 'white',
          cursor: 'pointer',
          fontSize: '18px',
          marginLeft: '12px',
          padding: '0 4px'
        }}
        aria-label="Close notification"
      >
        ×
      </button>
    </div>
  );
};

export const ToastContainer: React.FC = () => {
  const [notifications, setNotifications] = useState<ToastNotification[]>([]);

  useEffect(() => {
    const unsubscribe = errorHandler.onToast((notification) => {
      setNotifications((prev) => [...prev, notification]);
    });

    return unsubscribe;
  }, []);

  const handleClose = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  if (notifications.length === 0) {
    return null;
  }

  return (
    <>
      <style>
        {`
          @keyframes slideIn {
            from {
              transform: translateX(100%);
              opacity: 0;
            }
            to {
              transform: translateX(0);
              opacity: 1;
            }
          }
        `}
      </style>
      <div
        style={{
          position: 'fixed',
          top: '16px',
          right: '16px',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end'
        }}
      >
        {notifications.map((notification) => (
          <Toast
            key={notification.id}
            notification={notification}
            onClose={handleClose}
          />
        ))}
      </div>
    </>
  );
};
