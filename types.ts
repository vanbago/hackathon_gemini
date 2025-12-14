
export enum ActivityStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  ALERT = 'ALERT',
  DELAYED = 'DELAYED'
}

export enum ActivityContext {
  SURVEY = 'SURVEY',
  INCIDENT = 'INCIDENT',
  MAINTENANCE = 'MAINTENANCE',
  PLANNED_WORK = 'PLANNED_WORK',
  PHYSICAL_CHECK = 'PHYSICAL_CHECK',
  OTHER = 'OTHER'
}

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface Activity {
  id: string;
  title: string;
  description: string;
  locationName: string;
  coordinates: Coordinates;
  status: ActivityStatus;
  context?: ActivityContext;
  timestamp: string;
  source: 'UPLOAD' | 'WHATSAPP' | 'MANUAL' | 'MEDIA' | 'PLANNING'; 
  technician?: string;
  imageUrl?: string;
  linkedDocumentId?: string;
}

export interface ChatMessage {
  id: string;
  sender: string;
  content: string;
  timestamp: string;
  processed: boolean;
  source?: 'SIMULATION' | 'WHATSAPP_API' | 'IMPORT'; // Added source field
}

export interface ReportConfig {
  startDate: string;
  endDate: string;
  focusArea: string;
}

export interface AnalysisResult {
  activities: Activity[];
  summary: string;
}

export enum Operator {
  CAMTEL = 'CAMTEL',
  MTN = 'MTN',
  OCM = 'OCM',
  OTHER = 'OTHER'
}

export enum SiteType {
  TRANSMISSION_CENTER = 'TRANSMISSION_CENTER',
  TOWER = 'TOWER',
  JUNCTION = 'JUNCTION',
  TECHNICAL_ROOM = 'TECHNICAL_ROOM'
}

// --- NOUVEAU: GESTION DES EQUIPEMENTS ---
export enum EquipmentType {
  WDM = 'WDM',      // OSN 8800, 9800 (Photonic/Optical)
  SDH = 'SDH',      // OSN 3500, 1500, 7500
  IP_MPLS = 'IP_MPLS', // ATN, NE40, CX600
  MICROWAVE = 'MICROWAVE', // RTN 980, 950
  ACCESS = 'ACCESS', // OLT, MSAN, BBU
  POWER = 'POWER'   // Rectifier, Genset
}

export enum PowerStatus {
  STABLE = 'STABLE',
  UNSTABLE = 'UNSTABLE', // Perturbe
  DOWN = 'DOWN' // HS
}

export enum PowerSource {
  GRID = 'GRID', // ENEO
  GENSET = 'GENSET', // GE
  SOLAR = 'SOLAR',
  BATTERY = 'BATTERY'
}

export interface Equipment {
  id: string;
  name: string;      // ex: "OSN 8800 Mbalmayo"
  model: string;     // ex: "Huawei OSN 8800 T32"
  type: EquipmentType;
  status: 'OPERATIONAL' | 'FAULTY' | 'MAINTENANCE';
  serialNumber?: string;
  ipAddress?: string; // Management IP
  slots?: number; // Nombre de slots/ports dispo
  
  // New Power Fields
  powerStatus?: PowerStatus;
  powerSource?: PowerSource;
}

export interface Ctt {
  id: string;
  name: string;
  coordinates: Coordinates;
  equipments?: Equipment[]; // Equipements au CTT
}

export interface Bts {
  id: string;
  name: string;
  operator: Operator;
  type: SiteType;
  coordinates: Coordinates;
  controlledByCttId: string;
  equipments?: Equipment[]; // Equipements sur le site
  mobileTechnologies?: string[]; // e.g. ['2G', '3G', '4G', '5G']
}

export enum LiaisonType {
  FIBER = 'FIBER',
  RADIO = 'RADIO',
  OTHER = 'OTHER'
}

export enum LiaisonStatus {
  OPERATIONAL = 'OPERATIONAL',
  FAULTY = 'FAULTY',
  MAINTENANCE = 'MAINTENANCE'
}

export enum LiaisonCategory {
  BACKBONE = 'BACKBONE',
  LAST_MILE = 'LAST_MILE'
}

export enum InfrastructureType {
  CHAMBRE = 'CHAMBRE', // Manhole
  MANCHON = 'MANCHON',  // Splice Closure (Aerial or Wall)
  MANCHON_ENTERRE = 'MANCHON_ENTERRE' // Buried Splice Closure
}

export enum InfrastructureCategory {
  ARTERE = 'ARTERE',           // Croisement de ≥2 Backbones
  SEMI_ARTERE = 'SEMI_ARTERE', // Backbone + Piquage Last Mile
  STANDARD = 'STANDARD'        // Passage simple
}

export interface SplicingConnection {
    incomingStrandId: string; // ID du brin section précédente
    outgoingStrandId: string; // ID du brin section suivante
    status: 'SPLICED' | 'CUT' | 'PASS_THROUGH';
    attenuation?: number; // dB loss at splice
}

export interface InfrastructurePoint {
  id: string;
  type: InfrastructureType;
  category?: InfrastructureCategory; // Classification du nœud
  name: string; // e.g., "Chambre K12", "Manchon 144FO"
  coordinates: Coordinates;
  parentLiaisonId: string;
  description?: string;
  
  // Splice Management
  splicingConfig?: {
      connections: SplicingConnection[];
  };
}

export interface FiberStrand {
  id: string;
  colorCode: string; // e.g., "Bleu", "Orange", "Vert"
  number: number; // 1 to 12 (or more)
  status: 'USE' | 'CONTINU' | 'DISCONTINU';
  serviceName?: string; // e.g., "STM-4 Ebolowa", "IP MPLS"
  client?: string; // e.g., "MTN", "CAMTEL-INTERNE"
}

// --- NOUVEAU: TRONÇONS DE CÂBLE ---
export interface CableSection {
  id: string;
  name: string; // ex: "Tronçon Mbalmayo-K4"
  startPointId?: string; // ID Infra ou Site
  endPointId?: string; // ID Infra ou Site
  
  // NEW: GPS Coordinates for Section Limits
  startCoordinate?: Coordinates;
  endCoordinate?: Coordinates;

  fiberCount: number; // ex: 48, 24
  cableType: string; // ex: "G.652D Souterrain", "ADSS Aérien"
  isHosted?: boolean; // Si True, les brins passent dans le câble d'une autre liaison (Gaine Partagée)
  lengthKm?: number;
  
  // New: Color Scheme Definition
  colorScheme?: 'STANDARD' | 'SPECIAL_MENGWA'; // STANDARD (Blue/Orange) vs SPECIAL (Blue/Red/Green/Yellow...)

  // Chaque tronçon a sa propre définition physique des brins
  fiberStrands?: FiberStrand[]; 
}

export interface Liaison {
  id: string;
  name: string;
  type: LiaisonType;
  status: LiaisonStatus;
  category: LiaisonCategory;
  owner?: Operator;
  startCoordinates: Coordinates;
  endCoordinates: Coordinates;
  color?: string; // --- NEW: Custom color for Map Visualization ---
  
  // Routing & Geometry
  routingWaypoints?: Coordinates[]; // Points de passage obligatoires (Carrefours, K4)
  visualOffset?: number; // Pour décaler l'affichage (Côté de la route)
  
  distanceKm: number; // Longueur physique totale
  backboneDistanceKm?: number; // Pour Last Mile
  fiberCount?: number;
  capacity?: string;
  
  controlledByCttId: string;
  associatedBtsIds: string[];
  infrastructurePoints?: InfrastructurePoint[]; 
  fiberStrands?: FiberStrand[]; // GLOBAL / LOGICAL View (End to End)
  
  sections?: CableSection[]; // Découpage technique du câble
}

export enum TicketType {
  INCIDENT_TX = 'INCIDENT_TX',
  FIXE = 'FIXE',
  CDMA = 'CDMA',
  LTE = 'LTE',
  GSM = 'GSM',
  UMTS = 'UMTS',
  RFO = 'RFO',
  MAINTENANCE = 'MAINTENANCE',
  OTHER = 'OTHER'
}

export enum TicketPriority {
  HIGH = 'HIGH',
  MEDIUM = 'MEDIUM',
  LOW = 'LOW'
}

export enum TicketStatus {
  OPEN = 'OPEN',
  IN_PROGRESS = 'IN_PROGRESS',
  RESOLVED = 'RESOLVED',
  CLOSED = 'CLOSED',
  ESCALATED = 'ESCALATED'
}

export interface Ticket {
  id: string;
  title: string;
  description: string;
  type: TicketType;
  priority: TicketPriority;
  status: TicketStatus;
  creationDate: string;
  reportedBy: string;
  technicianAssigned?: string;
  resolutionDate?: string;
  associatedLiaisonId?: string;
  associatedBtsId?: string;
  scopeOfWork?: string;
  componentsAffected?: string[];
  locationName?: string;
  coordinates?: Coordinates;
}

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: 'INFO' | 'WARNING' | 'ERROR' | 'SUCCESS';
  date: string;
  relatedActivityId?: string;
  isRead: boolean;
}

export interface PlanningEntry {
  id: string;
  weekNumber: number;
  activity: string;
  sites: string[];
  plannedDate: string;
  status: ActivityStatus;
  responsible: string;
  resources: string;
}

export enum FormType {
  FIBER_CHECK = 'FIBER_CHECK',
  STATION_MAINT = 'STATION_MAINT',
  RADIO_FH_CHECK = 'RADIO_FH_CHECK'
}

export enum DocumentStatus {
  DRAFT = 'DRAFT',
  VALIDATED = 'VALIDATED',
  ARCHIVED = 'ARCHIVED'
}

export interface MaintenanceDocument {
  id: string;
  type: FormType;
  title: string;
  date: string;
  status: DocumentStatus;
  technicians: string[];
  data: any;
  code: string;
  siteId?: string;
  liaisonId?: string;
}

export enum DashboardTab {
  ASSISTANT = 'ASSISTANT'
}
