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
    success: 'bg-[#4ECDC4]',
    info: 'bg-[#FFE66D]',
    error: 'bg-[#FF6B6B]'
  };

  return (
    <div
      className={`${bgColors[notif.type]} text-gray-900 px-4 py-3 flex items-center gap-3 border-2 border-gray-900 font-bold`}
      style={{boxShadow: '3px 3px 0px #1a1a2e'}}
    >
      <span className="text-sm">{notif.message}</span>
      <button onClick={onRemove} className="opacity-70 hover:opacity-100 text-lg font-black">×</button>
    </div>
  );
};
