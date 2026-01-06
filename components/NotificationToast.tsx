import React, { useEffect } from 'react';
import { Notification } from '../types';

interface Props {
  notifications: Notification[];
  removeNotification: (id: string) => void;
}

export const NotificationToast: React.FC<Props> = ({ notifications, removeNotification }) => {
  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2">
      {notifications.map((notif) => (
        <ToastItem key={notif.id} notif={notif} onRemove={() => removeNotification(notif.id)} />
      ))}
    </div>
  );
};

const ToastItem: React.FC<{ notif: Notification; onRemove: () => void }> = ({ notif, onRemove }) => {
  useEffect(() => {
    const timer = setTimeout(onRemove, 3000);
    return () => clearTimeout(timer);
  }, [onRemove]);

  const bgColors = {
    success: 'bg-emerald-500',
    info: 'bg-blue-500',
    error: 'bg-red-500'
  };

  return (
    <div className={`${bgColors[notif.type]} text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 animate-fade-in-down`}>
      <span className="text-sm font-medium">{notif.message}</span>
      <button onClick={onRemove} className="opacity-70 hover:opacity-100">×</button>
    </div>
  );
};