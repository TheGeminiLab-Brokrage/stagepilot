export interface KmRange {
  label: string;
  centerLat: number;
  centerLng: number;
  radiusMeters: number;
  zoom: number;
  sectionId: string;
}

export const KM_RANGES: KmRange[] = [
  { label: '21–100 km',  centerLat: 30.830, centerLng: 29.250, radiusMeters: 20000, zoom: 9,  sectionId: 'new_alamein' },
  { label: '107–123 km', centerLat: 30.855, centerLng: 28.932, radiusMeters: 4500,  zoom: 12, sectionId: 'new_alamein' },
  { label: '124–144 km', centerLat: 30.978, centerLng: 28.710, radiusMeters: 7000,  zoom: 11, sectionId: 'sidi_abdel_rahman' },
  { label: '145–154 km', centerLat: 31.022, centerLng: 28.595, radiusMeters: 4000,  zoom: 12, sectionId: 'sidi_abdel_rahman' },
  { label: '155–177 km', centerLat: 31.063, centerLng: 28.345, radiusMeters: 8000,  zoom: 11, sectionId: 'el_dabaa' },
  { label: '178–220 km', centerLat: 31.110, centerLng: 27.980, radiusMeters: 12000, zoom: 10, sectionId: 'ras_al_hekma' },
  { label: '221–275 km', centerLat: 31.190, centerLng: 27.605, radiusMeters: 14000, zoom: 10, sectionId: 'sidi_heneish' },
];
