export const LANGUAGE_OPTIONS = [
  { label: 'English', value: 'English' },
  { label: 'Spanish', value: 'Spanish' },
  { label: 'Arabic', value: 'Arabic' },
];

export function normalizeLanguage(value) {
  const v = String(value || '').trim().toLowerCase();
  if (v === 'spanish' || v === 'es' || v === 'español' || v === 'espanol') return 'Spanish';
  if (v === 'arabic' || v === 'ar' || v === 'العربية' || v === 'عربي') return 'Arabic';
  return 'English';
}

export function isRtlLanguage(language) {
  return normalizeLanguage(language) === 'Arabic';
}

const DICTS = {
  English: {
    'nav.operations': 'OPERATIONS',
    'nav.management': 'MANAGEMENT',
    'nav.support': 'SUPPORT',
    'nav.myLoads': 'My Loads',
    'nav.docs': 'Document Vault',
    'nav.marketplace': 'Marketplace',
    'nav.myCarrier': 'My Carrier',
    'nav.compliance': 'Compliance & Safety',
    'nav.hiring': 'Hiring & Onboarding',
    'nav.esign': 'Consent & E-Signature',
    'nav.messaging': 'Messaging',
    'nav.alerts': 'Alerts & Notifications',
    'nav.settings': 'Account & Settings',
    'nav.aiHub': 'AI Hub',
    'nav.logout': 'Logout',

    'settings.language': 'Language',
    'settings.calendarSync': 'Calendar Sync',
    'settings.notificationHistory': 'View Notification History',
  },
  Spanish: {
    'nav.operations': 'OPERACIONES',
    'nav.management': 'GESTIÓN',
    'nav.support': 'SOPORTE',
    'nav.myLoads': 'Mis Cargas',
    'nav.docs': 'Bóveda de Documentos',
    'nav.marketplace': 'Mercado',
    'nav.myCarrier': 'Mi Transportista',
    'nav.compliance': 'Cumplimiento y Seguridad',
    'nav.hiring': 'Contratación e Incorporación',
    'nav.esign': 'Consentimiento y Firma',
    'nav.messaging': 'Mensajería',
    'nav.alerts': 'Alertas y Notificaciones',
    'nav.settings': 'Cuenta y Ajustes',
    'nav.aiHub': 'Centro de IA',
    'nav.logout': 'Cerrar sesión',

    'settings.language': 'Idioma',
    'settings.calendarSync': 'Sincronización de Calendario',
    'settings.notificationHistory': 'Ver historial de notificaciones',
  },
  Arabic: {
    'nav.operations': 'العمليات',
    'nav.management': 'الإدارة',
    'nav.support': 'الدعم',
    'nav.myLoads': 'شحناتي',
    'nav.docs': 'مستودع المستندات',
    'nav.marketplace': 'السوق',
    'nav.myCarrier': 'شركة النقل',
    'nav.compliance': 'الامتثال والسلامة',
    'nav.hiring': 'التوظيف والتأهيل',
    'nav.esign': 'الموافقة والتوقيع',
    'nav.messaging': 'الرسائل',
    'nav.alerts': 'التنبيهات والإشعارات',
    'nav.settings': 'الحساب والإعدادات',
    'nav.aiHub': 'مركز الذكاء الاصطناعي',
    'nav.logout': 'تسجيل الخروج',

    'settings.language': 'اللغة',
    'settings.calendarSync': 'مزامنة التقويم',
    'settings.notificationHistory': 'عرض سجل الإشعارات',
  },
};

export function t(language, key, fallback) {
  const lang = normalizeLanguage(language);
  return DICTS?.[lang]?.[key] ?? fallback ?? DICTS?.English?.[key] ?? key;
}
