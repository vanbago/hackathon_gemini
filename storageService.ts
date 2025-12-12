
import { Activity, ChatMessage, Ctt, Bts, Liaison, Ticket, Operator, Coordinates, LiaisonType, LiaisonStatus, TicketType, TicketPriority, TicketStatus, ActivityStatus, LiaisonCategory, ActivityContext, SiteType, AppNotification, PlanningEntry, InfrastructureType, FiberStrand, EquipmentType, Equipment, PowerStatus, PowerSource, InfrastructureCategory, InfrastructurePoint } from "./types";

interface AppState {
  activities: Activity[];
  ctt: Ctt | null;
  btsStations: Bts[];
  liaisons: Liaison[];
  tickets: Ticket[];
  notifications: AppNotification[];
  planning: PlanningEntry[];
}

const STORAGE_KEY = 'transmissionCenterAI_state_v19_robust'; 

export const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; 
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

export const loadState = (): AppState | null => {
  try {
    const serializedState = localStorage.getItem(STORAGE_KEY);
    return serializedState ? JSON.parse(serializedState) as AppState : null;
  } catch (error) { return null; }
};

export const saveState = (state: AppState) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) { console.error(error); }
};

// Helper to generate standard fiber colors (ITU-T)
const generateStandardFibers = (count: number, services: {idx: number, name: string, client?: string, colorCodeOverride?: string}[]): FiberStrand[] => {
    const colors = ["Bleu", "Orange", "Vert", "Marron", "Gris", "Blanc", "Rouge", "Noir", "Jaune", "Violet", "Rose", "Aqua"];
    const strands: FiberStrand[] = [];
    for (let i = 0; i < count; i++) {
        const defaultColor = colors[i % 12];
        const assignedService = services.find(s => s.idx === i + 1);
        strands.push({
            id: `f-${i}-${Date.now()}-${Math.random()}`, 
            number: i + 1,
            colorCode: assignedService?.colorCodeOverride || defaultColor,
            status: assignedService ? 'USE' : 'CONTINU',
            serviceName: assignedService?.name,
            client: assignedService?.client || 'CAMTEL'
        });
    }
    return strands;
};

/**
 * Initializes default data with HIERARCHY: CABLE vs SERVICE
 */
export const initializeDefaultState = (): AppState => {
  // 1. CTT MBALMAYO
  const mbalmayoCtt: Ctt = {
    id: 'ctt-mbalmayo',
    name: 'CTT Mbalmayo',
    coordinates: { lat: 3.517095, lng: 11.501273 },
    equipments: [
        { id: 'eq-mb-1', name: 'OSN 8800', model: 'Huawei OSN 8800 T32', type: EquipmentType.WDM, status: 'OPERATIONAL', powerStatus: PowerStatus.STABLE, powerSource: PowerSource.GRID },
        { id: 'eq-mb-2', name: 'NE40 Router', model: 'Huawei NetEngine 40E', type: EquipmentType.IP_MPLS, status: 'OPERATIONAL', powerStatus: PowerStatus.STABLE, powerSource: PowerSource.GRID }
    ]
  };

  const getBtsCoords = (id: string, list: Bts[]) => list.find(b => b.id === id)?.coordinates || { lat: 0, lng: 0 };

  // --- SITES ---
  const btsStations: Bts[] = [
    { id: 'site-nsimalen', name: 'Nsimalen', operator: Operator.CAMTEL, type: SiteType.TOWER, coordinates: { lat: 3.7250, lng: 11.5500 }, controlledByCttId: mbalmayoCtt.id, equipments: [] },
    { id: 'site-yaounde', name: 'Yaoundé Centre', operator: Operator.CAMTEL, type: SiteType.TRANSMISSION_CENTER, coordinates: { lat: 3.8480, lng: 11.5021 }, controlledByCttId: mbalmayoCtt.id, equipments: [] },
    { id: 'site-akono', name: 'Akono', operator: Operator.CAMTEL, type: SiteType.TOWER, coordinates: { lat: 3.5050, lng: 11.3300 }, controlledByCttId: mbalmayoCtt.id, equipments: [] },
    { id: 'site-ebanga', name: 'Ebanga-Ngoulou', operator: Operator.CAMTEL, type: SiteType.TECHNICAL_ROOM, coordinates: { lat: 3.125470, lng: 11.409178 }, controlledByCttId: mbalmayoCtt.id, equipments: [] },
    { id: 'site-ebolowa', name: 'Ebolowa Station', operator: Operator.CAMTEL, type: SiteType.TRANSMISSION_CENTER, coordinates: { lat: 2.9100, lng: 11.1500 }, controlledByCttId: mbalmayoCtt.id, equipments: [] },
    { id: 'site-sangmelima', name: 'Sangmelima', operator: Operator.CAMTEL, type: SiteType.TRANSMISSION_CENTER, coordinates: { lat: 2.9333, lng: 11.9833 }, controlledByCttId: mbalmayoCtt.id, equipments: [] },
    { id: 'site-mengbwa', name: 'Mengbwa', operator: Operator.CAMTEL, type: SiteType.TECHNICAL_ROOM, coordinates: { lat: 3.0500, lng: 12.0500 }, controlledByCttId: mbalmayoCtt.id },
    { id: 'site-mengueme', name: 'Mengueme', operator: Operator.CAMTEL, type: SiteType.TOWER, coordinates: { lat: 3.436695, lng: 11.700576 }, controlledByCttId: mbalmayoCtt.id, equipments: [] },
    { id: 'site-ndick', name: 'Ndick', operator: Operator.CAMTEL, type: SiteType.TOWER, coordinates: { lat: 3.476718, lng: 11.656796 }, controlledByCttId: mbalmayoCtt.id, equipments: [], mobileTechnologies: ['UMTS', 'LTE'] },
    { id: 'site-metet', name: 'Metet', operator: Operator.CAMTEL, type: SiteType.TOWER, coordinates: { lat: 3.433446, lng: 11.772319 }, controlledByCttId: mbalmayoCtt.id, equipments: [], mobileTechnologies: ['GSM', 'UMTS'] },
    { id: 'site-zoetele-camtel', name: 'Zoétélé (Camtel)', operator: Operator.CAMTEL, type: SiteType.TOWER, coordinates: { lat: 3.2530, lng: 11.8833 }, controlledByCttId: mbalmayoCtt.id, equipments: [] },
  ];

  // --- INFRASTRUCTURE CLÉ (NOEUDS) ---
  const zoatoupsiJunctionCoords: Coordinates = { lat: 3.459933, lng: 11.513630 }; // Point de split SANGMELIMA / EBOLOWA
  const carrefourSangmelimaCoords: Coordinates = { lat: 3.467063, lng: 11.514433 }; 
  const ndickChambreCoords: Coordinates = { lat: 3.476718, lng: 11.656796 };
  
  const manchonZoatoupsi: InfrastructurePoint = {
      id: 'ch-manchon-zoatoupsi', type: InfrastructureType.MANCHON_ENTERRE, category: InfrastructureCategory.ARTERE,
      name: 'Manchon Zoatoupsi (PK 8.6)', coordinates: zoatoupsiJunctionCoords, parentLiaisonId: 'bb-mbyo-sangmelima',
      description: 'Éclatement: Câble Principal 48FO (Mbyo) s\'arrête. Départ Câble 24FO (Ebanga) et 48FO (Sangmélima).'
  };

  const manchonNdick: InfrastructurePoint = {
      id: 'ch-ndick-piquage', type: InfrastructureType.CHAMBRE, category: InfrastructureCategory.SEMI_ARTERE,
      name: 'Chambre Piquage Ndick (PK 28.5)', coordinates: ndickChambreCoords, parentLiaisonId: 'bb-mbyo-mengbwa',
      description: 'PK 28.5. Extraction brins pour Site Ndick.'
  };

  const liaisons: Liaison[] = [
    // --- LIAISON 1: MBALMAYO - AKONO (Nouveau) ---
    {
        id: 'bb-mbyo-akono', name: 'Liaison Mbalmayo-Akono', type: LiaisonType.FIBER, status: LiaisonStatus.OPERATIONAL, category: LiaisonCategory.LAST_MILE,
        startCoordinates: mbalmayoCtt.coordinates, endCoordinates: getBtsCoords('site-akono', btsStations),
        distanceKm: 22.5, fiberCount: 24, controlledByCttId: mbalmayoCtt.id, associatedBtsIds: ['site-akono'],
        color: '#f43f5e', // Rose/Red
        fiberStrands: generateStandardFibers(24, [{ idx: 1, name: "Services Akono" }]),
        sections: [
            { 
                id: 'sec-mbyo-akono-direct', 
                name: 'Section Unique Mbyo-Akono', 
                fiberCount: 24, cableType: '24FO Aérien ADSS', lengthKm: 22.5,
                startCoordinate: mbalmayoCtt.coordinates,
                endCoordinate: getBtsCoords('site-akono', btsStations)
            }
        ]
    },

    // --- LIAISON 2: EBANGA - EBOLOWA (Extension Sud) ---
    {
        id: 'bb-ebanga-ebolowa', name: 'Backbone Ebanga-Ebolowa', type: LiaisonType.FIBER, status: LiaisonStatus.OPERATIONAL, category: LiaisonCategory.BACKBONE,
        startCoordinates: getBtsCoords('site-ebanga', btsStations), endCoordinates: getBtsCoords('site-ebolowa', btsStations),
        distanceKm: 45.0, fiberCount: 48, controlledByCttId: mbalmayoCtt.id, associatedBtsIds: ['site-ebolowa'],
        color: '#0ea5e9', // Sky Blue (Suite de Mbyo-Ebanga)
        fiberStrands: generateStandardFibers(48, [{ idx: 1, name: "Backbone Sud (Ebolowa)" }]),
        sections: [
            {
                id: 'sec-ebanga-ebolowa-1',
                name: 'Ebanga -> Ebolowa Entrée',
                fiberCount: 48, cableType: '48FO Souterrain', lengthKm: 45.0,
                startCoordinate: getBtsCoords('site-ebanga', btsStations),
                endCoordinate: getBtsCoords('site-ebolowa', btsStations)
            }
        ]
    },

    // --- AXE NORD (YAOUNDE) ---
    {
      id: 'bb-mbyo-yde', name: 'Backbone Mbalmayo-Yaoundé', type: LiaisonType.FIBER, status: LiaisonStatus.OPERATIONAL, category: LiaisonCategory.BACKBONE,
      startCoordinates: mbalmayoCtt.coordinates, endCoordinates: getBtsCoords('site-yaounde', btsStations),
      distanceKm: 50.0, fiberCount: 96, controlledByCttId: mbalmayoCtt.id, associatedBtsIds: ['site-yaounde', 'site-nsimalen'],
      color: '#06b6d4', // Cyan
      fiberStrands: generateStandardFibers(96, [{ idx: 1, name: "STM-64 Backbone Ydé-Mbyo" }, { idx: 2, name: "Protection MSP" }]),
      sections: [
          { id: 'sec-mbyo-nsimalen', name: 'Tronçon Mbyo -> Nsimalen', fiberCount: 96, cableType: '96FO Souterrain (G.652D)', lengthKm: 35.0, startCoordinate: mbalmayoCtt.coordinates },
          { id: 'sec-nsimalen-yde', name: 'Tronçon Nsimalen -> Yaoundé', fiberCount: 96, cableType: '96FO Souterrain', lengthKm: 15.0 }
      ]
    },

    // --- AXE SUD (EBOLOWA & SANGMELIMA) ---
    {
      id: 'bb-mbyo-ebanga', name: 'Liaison Mbalmayo-Ebanga (Câble Porteur)', type: LiaisonType.FIBER, status: LiaisonStatus.OPERATIONAL, category: LiaisonCategory.BACKBONE,
      startCoordinates: mbalmayoCtt.coordinates, endCoordinates: getBtsCoords('site-ebanga', btsStations),
      routingWaypoints: [zoatoupsiJunctionCoords], 
      visualOffset: 1.0, 
      color: '#0284c7', 
      distanceKm: 62.0, fiberCount: 48, 
      controlledByCttId: mbalmayoCtt.id, associatedBtsIds: ['site-ebanga'],
      infrastructurePoints: [manchonZoatoupsi],
      sections: [
          { 
              id: 'sec-mbyo-zoatoupsi-host', 
              name: 'Tronçon Mbalmayo -> Zoatoupsi (Porteur)', 
              fiberCount: 48, cableType: '48FO Souterrain G.652D', lengthKm: 8.6,
              startCoordinate: mbalmayoCtt.coordinates,
              endCoordinate: zoatoupsiJunctionCoords,
              fiberStrands: generateStandardFibers(48, [
                  { idx: 1, name: "Service Mbyo-Ebanga [Bleu]" },
                  { idx: 3, name: "Transit Mbyo-Sangmélima (Vers Zoatoupsi) [Vert]" }, 
                  { idx: 4, name: "Transit Mbyo-Sangmélima (Vers Zoatoupsi) [Marron]" }
              ])
          },
          { 
              id: 'sec-zoatoupsi-ebanga', 
              name: 'Tronçon Zoatoupsi -> Ebanga', 
              fiberCount: 24, cableType: '24FO Aérien', lengthKm: 53.4,
              startCoordinate: zoatoupsiJunctionCoords,
              endCoordinate: getBtsCoords('site-ebanga', btsStations)
          }
      ]
    },

    {
        id: 'bb-mbyo-sangmelima', name: 'Liaison Mbalmayo-Sangmelima', type: LiaisonType.FIBER, status: LiaisonStatus.OPERATIONAL, category: LiaisonCategory.BACKBONE,
        startCoordinates: mbalmayoCtt.coordinates, endCoordinates: getBtsCoords('site-sangmelima', btsStations),
        routingWaypoints: [zoatoupsiJunctionCoords], 
        visualOffset: 2.0, 
        color: '#9333ea', 
        distanceKm: 117.0, fiberCount: 48,
        controlledByCttId: mbalmayoCtt.id, associatedBtsIds: ['site-sangmelima'],
        sections: [
             { 
                 id: 'sec-mbyo-zoatoupsi-hosted', 
                 name: 'Tronçon Virtuel Mbalmayo -> Zoatoupsi (HÉBERGÉ)', 
                 fiberCount: 2, cableType: 'Gaine Partagée (Dans Câble Ebanga)', lengthKm: 8.6, 
                 isHosted: true,
                 startCoordinate: mbalmayoCtt.coordinates,
                 endCoordinate: zoatoupsiJunctionCoords
             },
             { 
                 id: 'sec-zoatoupsi-sangmelima', 
                 name: 'Câble Physique Zoatoupsi -> Sangmelima', 
                 fiberCount: 48, cableType: '48FO Souterrain (Fonçage)', lengthKm: 108.4,
                 isHosted: false,
                 startCoordinate: zoatoupsiJunctionCoords,
                 endCoordinate: getBtsCoords('site-sangmelima', btsStations)
             }
        ],
        fiberStrands: generateStandardFibers(48, [{ idx: 1, name: "SDH Mbyo-Sang (RX)" }, { idx: 2, name: "SDH Mbyo-Sang (TX)" }])
    },

    // --- AXE EST (MENGBWA) ---
    {
        id: 'bb-mbyo-mengbwa', name: 'Backbone Mbalmayo-Mengbwa', type: LiaisonType.FIBER, status: LiaisonStatus.OPERATIONAL, category: LiaisonCategory.BACKBONE,
        startCoordinates: mbalmayoCtt.coordinates, endCoordinates: getBtsCoords('site-mengbwa', btsStations),
        routingWaypoints: [carrefourSangmelimaCoords], 
        visualOffset: -1.0, 
        color: '#ea580c', 
        distanceKm: 125.0, fiberCount: 48, 
        controlledByCttId: mbalmayoCtt.id, associatedBtsIds: ['site-mengbwa', 'site-ndick', 'site-mengueme', 'site-zoetele-camtel', 'site-metet'],
        infrastructurePoints: [manchonNdick],
        sections: [
            { id: 'sec-mbyo-ndick', name: 'Tronçon Mbalmayo -> Ndick', fiberCount: 48, cableType: '48FO Souterrain (4x12)', lengthKm: 28.5 },
             { id: 'sec-ndick-mengueme', name: 'Tronçon Ndick -> Mengueme', fiberCount: 24, cableType: '24FO Souterrain (4x6)', lengthKm: 5.8 },
             { id: 'sec-mengueme-metet', name: 'Tronçon Mengueme -> Metet', fiberCount: 18, cableType: '18FO Souterrain (3x6)', lengthKm: 5.7 },
            { id: 'sec-metet-mengbwa', name: 'Tronçon Metet -> Mengbwa', fiberCount: 18, cableType: '18FO Souterrain (3x6)', lengthKm: 85.0 }
        ],
        fiberStrands: generateStandardFibers(48, [
            { idx: 6, name: "SDH Mbyo-Mengwa [Blanc]", colorCodeOverride: "Blanc" },
            { idx: 8, name: "UMTS Ndick [Rouge]", colorCodeOverride: "Rouge" }
        ])
    },

    // --- LAST MILE ---
    {
        id: 'lm-ndick', name: 'Last Mile Ndick', type: LiaisonType.FIBER, status: LiaisonStatus.OPERATIONAL, category: LiaisonCategory.LAST_MILE,
        startCoordinates: ndickChambreCoords, endCoordinates: getBtsCoords('site-ndick', btsStations),
        distanceKm: 0.150, backboneDistanceKm: 28.5, fiberCount: 12, controlledByCttId: mbalmayoCtt.id, associatedBtsIds: ['site-ndick'],
        color: '#84cc16'
    }
  ];

  const activities: Activity[] = [];
  const tickets: Ticket[] = [];
  const planning: PlanningEntry[] = [];
  const notifications: AppNotification[] = [];

  return { activities, ctt: mbalmayoCtt, btsStations, liaisons, tickets, notifications, planning };
};
