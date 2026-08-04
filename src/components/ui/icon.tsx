import {
  BedDouble,
  Bus,
  CalendarCheck,
  CalendarDays,
  Check,
  CircleCheck,
  Clock,
  CreditCard,
  Facebook,
  FileSignature,
  Gem,
  Handshake,
  Headset,
  IdCard,
  Instagram,
  Linkedin,
  Mail,
  MapPin,
  MapPinned,
  Maximize2,
  Phone,
  Plug,
  Route,
  ShieldCheck,
  ShowerHead,
  Sofa,
  Star,
  Target,
  Thermometer,
  Truck,
  Tv,
  UserRound,
  Utensils,
  Wrench,
  type LucideIcon,
} from 'lucide-react'

/**
 * Icons are decorative here — every icon in this design sits beside a real text
 * label, so they are aria-hidden and the label carries the meaning.
 * The design source names FontAwesome classes; those names map here.
 */
const ICONS: Record<string, LucideIcon> = {
  bed: BedDouble,
  bus: Bus,
  'calendar-check': CalendarCheck,
  'calendar-day': CalendarDays,
  check: Check,
  'circle-check': CircleCheck,
  clock: Clock,
  'credit-card': CreditCard,
  facebook: Facebook,
  'file-signature': FileSignature,
  'file-lines': FileSignature,
  gem: Gem,
  handshake: Handshake,
  headset: Headset,
  'id-card': IdCard,
  instagram: Instagram,
  linkedin: Linkedin,
  mail: Mail,
  envelope: Mail,
  'location-dot': MapPin,
  'map-location-dot': MapPinned,
  'maximize': Maximize2,
  'slide-out': Maximize2,
  phone: Phone,
  plug: Plug,
  road: Route,
  route: Route,
  'shield-halved': ShieldCheck,
  shower: ShowerHead,
  couch: Sofa,
  star: Star,
  bullseye: Target,
  'temperature-half': Thermometer,
  truck: Truck,
  'truck-ramp-box': Truck,
  tv: Tv,
  'user-tie': UserRound,
  utensils: Utensils,
  'screwdriver-wrench': Wrench,
  'money-bill-transfer': CreditCard,
  x: Star,
}

export function Icon({
  name,
  className,
  strokeWidth = 2,
}: {
  name: string
  className?: string
  strokeWidth?: number
}) {
  const Component = ICONS[name] ?? Check
  return <Component className={className} strokeWidth={strokeWidth} aria-hidden focusable="false" />
}

export function hasIcon(name: string): boolean {
  return name in ICONS
}
