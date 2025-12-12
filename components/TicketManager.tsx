import React, { useState } from 'react';
import { Ticket, TicketPriority, TicketStatus, TicketType } from '../types';

interface TicketManagerProps {
  tickets: Ticket[];
  onUpdateTicket: (updatedTicket: Ticket) => void;
}

const TicketManager: React.FC<TicketManagerProps> = ({ tickets, onUpdateTicket }) => {
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [filterPriority, setFilterPriority] = useState<string>('ALL');
  const [filterType, setFilterType] = useState<string>('ALL');

  const filteredTickets = tickets.filter(ticket => {
    const statusMatch = filterStatus === 'ALL' || ticket.status === filterStatus;
    const priorityMatch = filterPriority === 'ALL' || ticket.priority === filterPriority;
    const typeMatch = filterType === 'ALL' || ticket.type === filterType;
    return statusMatch && priorityMatch && typeMatch;
  });

  const getStatusColorClass = (status: TicketStatus) => {
    switch (status) {
      case TicketStatus.OPEN: return 'bg-blue-500';
      case TicketStatus.IN_PROGRESS: return 'bg-yellow-500';
      case TicketStatus.RESOLVED: return 'bg-green-500';
      case TicketStatus.CLOSED: return 'bg-slate-600';
      case TicketStatus.ESCALATED: return 'bg-red-500';
      default: return 'bg-slate-500';
    }
  };

  const getPriorityColorClass = (priority: TicketPriority) => {
    switch (priority) {
      case TicketPriority.HIGH: return 'bg-red-600';
      case TicketPriority.MEDIUM: return 'bg-orange-500';
      case TicketPriority.LOW: return 'bg-green-600';
      default: return 'bg-slate-500';
    }
  };

  const handleStatusChange = (ticket: Ticket, newStatus: TicketStatus) => {
    onUpdateTicket({ ...ticket, status: newStatus, resolutionDate: (newStatus === TicketStatus.RESOLVED || newStatus === TicketStatus.CLOSED) && !ticket.resolutionDate ? new Date().toISOString() : ticket.resolutionDate });
  };

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-xl h-full flex flex-col overflow-hidden">
      <div className="p-4 border-b border-slate-700 bg-slate-800">
        <h3 className="font-semibold text-slate-100">Gestion des Tickets ({tickets.length})</h3>
      </div>

      {/* Filters */}
      <div className="p-4 bg-slate-800 border-b border-slate-700 grid grid-cols-3 gap-3 text-sm">
        <select
          aria-label="Filter by Status"
          className="bg-slate-900 border border-slate-600 rounded px-2 py-1 text-slate-300 focus:outline-none focus:border-blue-500"
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
        >
          <option value="ALL">Tous les Statuts</option>
          {Object.values(TicketStatus).map(status => <option key={status} value={status}>{status.replace('_', ' ')}</option>)}
        </select>
        <select
          aria-label="Filter by Priority"
          className="bg-slate-900 border border-slate-600 rounded px-2 py-1 text-slate-300 focus:outline-none focus:border-blue-500"
          value={filterPriority}
          onChange={(e) => setFilterPriority(e.target.value)}
        >
          <option value="ALL">Toutes les Priorités</option>
          {Object.values(TicketPriority).map(priority => <option key={priority} value={priority}>{priority}</option>)}
        </select>
        <select
          aria-label="Filter by Type"
          className="bg-slate-900 border border-slate-600 rounded px-2 py-1 text-slate-300 focus:outline-none focus:border-blue-500"
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
        >
          <option value="ALL">Tous les Types</option>
          {Object.values(TicketType).map(type => <option key={type} value={type}>{type.replace('_', ' ')}</option>)}
        </select>
      </div>

      {/* Tickets List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {filteredTickets.length === 0 ? (
          <p className="text-center text-slate-500 text-sm mt-10">Aucun ticket trouvé avec les filtres actuels.</p>
        ) : (
          filteredTickets.map(ticket => (
            <div key={ticket.id} className="bg-slate-800 p-4 rounded-lg border border-slate-700 shadow-md">
              <div className="flex justify-between items-start mb-2">
                <h4 className="font-bold text-lg text-slate-100">{ticket.title}</h4>
                <div className="flex items-center gap-2 text-xs">
                  <span className={`px-2 py-0.5 rounded-full text-white ${getPriorityColorClass(ticket.priority)}`}>
                    {ticket.priority}
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-white ${getStatusColorClass(ticket.status)}`}>
                    {ticket.status.replace('_', ' ')}
                  </span>
                </div>
              </div>
              <p className="text-sm text-slate-300 mb-2">{ticket.description}</p>
              <div className="text-xs text-slate-400 grid grid-cols-2 gap-y-1">
                <div><span className="font-semibold">ID:</span> {ticket.id}</div>
                <div><span className="font-semibold">Type:</span> {ticket.type.replace('_', ' ')}</div>
                {ticket.locationName && <div><span className="font-semibold">Lieu:</span> {ticket.locationName}</div>}
                {ticket.technicianAssigned && <div><span className="font-semibold">Tech:</span> {ticket.technicianAssigned}</div>}
                <div><span className="font-semibold">Créé:</span> {new Date(ticket.creationDate).toLocaleDateString()}</div>
                {ticket.resolutionDate && <div><span className="font-semibold">Résolu:</span> {new Date(ticket.resolutionDate).toLocaleDateString()}</div>}
              </div>
              {ticket.scopeOfWork && <p className="text-xs italic text-slate-500 mt-2"><span className="font-semibold">Périmètre:</span> {ticket.scopeOfWork}</p>}
              {ticket.componentsAffected && ticket.componentsAffected.length > 0 && (
                  <p className="text-xs italic text-slate-500 mt-1"><span className="font-semibold">Composants:</span> {ticket.componentsAffected.join(', ')}</p>
              )}

              {/* Action for status update */}
              <div className="mt-3 pt-3 border-t border-slate-700 flex justify-end gap-2">
                <select
                  aria-label={`Change status for ticket ${ticket.id}`}
                  className="bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs text-slate-300 focus:outline-none"
                  value={ticket.status}
                  onChange={(e) => handleStatusChange(ticket, e.target.value as TicketStatus)}
                >
                  {Object.values(TicketStatus).map(status => (
                    <option key={status} value={status}>{status.replace('_', ' ')}</option>
                  ))}
                </select>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default TicketManager;