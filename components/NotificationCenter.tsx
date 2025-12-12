
import React from 'react';
import { AppNotification } from '../types';

interface NotificationCenterProps {
  notifications: AppNotification[];
}

const NotificationCenter: React.FC<NotificationCenterProps> = ({ notifications }) => {
  return (
    <div className="bg-slate-900 border border-slate-700 rounded-xl flex flex-col overflow-hidden mb-4 max-h-48">
      <div className="p-2 px-4 border-b border-slate-700 bg-slate-800 flex justify-between items-center">
        <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
             <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
             Centre de Notifications
        </h4>
        <span className="text-xs bg-slate-700 px-2 rounded-full text-slate-300">{notifications.length}</span>
      </div>
      <div className="overflow-y-auto p-2 space-y-2">
        {notifications.map(notif => (
            <div key={notif.id} className={`p-2 rounded border text-xs flex gap-2 ${
                notif.type === 'WARNING' ? 'bg-orange-900/20 border-orange-500/50 text-orange-200' :
                notif.type === 'ERROR' ? 'bg-red-900/20 border-red-500/50 text-red-200' :
                'bg-blue-900/20 border-blue-500/50 text-blue-200'
            }`}>
                <div className="mt-0.5">
                    {notif.type === 'WARNING' && <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>}
                    {notif.type === 'INFO' && <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                </div>
                <div>
                    <div className="font-bold">{notif.title}</div>
                    <div className="opacity-90">{notif.message}</div>
                </div>
            </div>
        ))}
      </div>
    </div>
  );
};

export default NotificationCenter;
