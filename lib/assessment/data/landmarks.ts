export interface Landmark {
  id: string;
  label: string;
  lat: number;
  lng: number;
  type?: 'landmark' | 'road';
}

export interface Section {
  id: string;
  label: string;
  center: [number, number];
  bounds: [[number, number], [number, number]];
  polygonCoords?: [number, number][];
  landmarks: Landmark[];
  improvementTip: string;
}

export const SECTIONS: Section[] = [
  {
    id: 'sidi_heneish',
    label: 'Sidi Heneish',
    center: [31.1848, 27.6063],
    bounds: [[31.17, 27.54], [31.21, 27.67]],
    polygonCoords: [
      [31.21, 27.54], [31.21, 27.67], [31.17, 27.67], [31.17, 27.54],
    ],
    improvementTip: 'Review the unique features and real estate projects in Sidi Heneish, including beach access and community amenities.',
    landmarks: [
      { id: 'sh-1', label: 'JAZ Elite Crystal, Almaza Bay', lat: 31.1992062, lng: 27.5534961 },
      { id: 'sh-2', label: 'Silver Sands Project PMV',      lat: 31.1812695, lng: 27.5994832 },
      { id: 'sh-3', label: 'Marsa Baghush Desert',          lat: 31.181253,  lng: 27.615556  },
      { id: 'sh-4', label: 'Marsa Baghush',                 lat: 31.1774707, lng: 27.656592  },
    ],
  },
  {
    id: 'ras_al_hekma',
    label: 'Ras Al Hekma',
    center: [31.1139, 27.9804],
    bounds: [[31.07, 27.85], [31.25, 28.09]],
    polygonCoords: [
      [31.25, 27.85], [31.25, 28.09],
      [31.07, 28.09], [31.07, 27.85],
    ],
    improvementTip: 'Study Ras Al Hekma\'s key attractions — its bay, undeveloped coastline, and the major developments planned or underway.',
    landmarks: [
      { id: 'rh-1', label: 'Marsa Baghoush',                    lat: 31.240333, lng: 27.860361 },
      { id: 'rh-2', label: 'AZHA North',                        lat: 31.0921776, lng: 27.9110713 },
      { id: 'rh-3', label: 'Club House Fouka Bay',              lat: 31.0895505, lng: 27.9364176 },
      { id: 'rh-4', label: 'Hacienda West',                     lat: 31.0886594, lng: 27.9534117 },
      { id: 'rh-5', label: 'Caesar - SODIC',                    lat: 31.0880745, lng: 28.0114949 },
      { id: 'rh-6', label: 'Mountain View Beach Restaurant',    lat: 31.0858629, lng: 28.028083  },
      { id: 'rh-7', label: 'Swan Lake North Coast',             lat: 31.0813142, lng: 28.0608566 },
      { id: 'rh-8', label: 'GAIA Sabbour',                      lat: 31.0849104, lng: 28.0816526 },
    ],
  },
  {
    id: 'el_dabaa',
    label: 'El Dabaa',
    center: [31.0682, 28.3640],
    bounds: [[31.03, 28.18], [31.09, 28.51]],
    polygonCoords: [
      [31.09, 28.18], [31.09, 28.51], [31.03, 28.51], [31.03, 28.18],
    ],
    improvementTip: 'Learn the key facts about El Dabaa — its nuclear plant proximity, infrastructure investments, and coastal properties.',
    landmarks: [
      { id: 'ed-road-1', label: 'El Dabaa Road',              lat: 31.033775,  lng: 28.380921,  type: 'road' },
      { id: 'ed-1', label: 'El Dabaa Nuclear Power Plant',    lat: 31.0457665, lng: 28.4943264 },
      { id: 'ed-2', label: 'D-bay Tatweer',                   lat: 31.0816625, lng: 28.388447  },
      { id: 'ed-3', label: 'La Serena North Coast Village',   lat: 31.0780932, lng: 28.3781774 },
      { id: 'ed-4', label: 'La Vista Bay',                    lat: 31.0705354, lng: 28.3636827 },
      { id: 'ed-5', label: 'Katameya Coast',                  lat: 31.0649581, lng: 28.1952057 },
      { id: 'ed-6', label: 'D.O.S.E North Coast',            lat: 31.0656817, lng: 28.339226  },
      { id: 'ed-7', label: 'The Water Way',                  lat: 31.0697222, lng: 28.3467258 },
      { id: 'ed-8', label: 'Seazen North Coast - AlQamzi',   lat: 31.0688546, lng: 28.3513674 },
    ],
  },
  {
    id: 'sidi_abdel_rahman',
    label: 'Sidi Abdel Rahman',
    center: [30.9806, 28.7103],
    bounds: [[30.925, 28.585], [31.035, 28.816]],
    polygonCoords: [
      [31.035, 28.585], [31.035, 28.816], [30.925, 28.816], [30.925, 28.585],
    ],
    improvementTip: 'Revisit Sidi Abdel Rahman\'s hallmarks — its crystal-clear bay, luxury resort density, and proximity to Alamein.',
    landmarks: [
      { id: 'sar-1', label: 'Masaya',           lat: 30.9870845, lng: 28.7060412 },
      { id: 'sar-2', label: 'Hacienda Bay',     lat: 30.9352435, lng: 28.7886372 },
      { id: 'sar-3', label: 'ZAHRA North Coast',lat: 30.9524885, lng: 28.805802  },
      { id: 'sar-4', label: 'Marassi',          lat: 30.9709015, lng: 28.7506652 },
      { id: 'sar-5', label: 'Shamasy',          lat: 30.985583,  lng: 28.717028  },
      { id: 'sar-6', label: 'ZOYA Ghazala Bay', lat: 31.0248219, lng: 28.5953851 },
      { id: 'sar-7', label: 'Telal El Alamein', lat: 31.0081696, lng: 28.608729  },
      { id: 'sar-8', label: 'Amwaj Chalet',     lat: 30.9993948, lng: 28.6840799 },
    ],
  },
  {
    id: 'marina',
    label: 'Marina',
    center: [30.826013, 28.993615],
    bounds: [[30.80, 28.96], [30.86, 29.02]],
    improvementTip: 'Study the Marina El Alamein compound — its marina, resort layout, and key landmarks.',
    landmarks: [
      { id: 'mr-road-1', label: 'Wadi El Natrun - El Alamein Road', lat: 30.81454, lng: 28.983809, type: 'road' },
      { id: 'mr-1', label: 'Marina Landmark 1', lat: 30.843, lng: 28.974 },
      { id: 'mr-2', label: 'Marina Landmark 2', lat: 30.831, lng: 28.985 },
      { id: 'mr-3', label: 'Marina Landmark 3', lat: 30.820, lng: 28.997 },
    ],
  },
  {
    id: 'new_alamein',
    label: 'New Alamein',
    center: [30.8555, 28.9362],
    bounds: [[30.83, 28.90], [30.88, 28.96]],
    polygonCoords: [
      [30.88, 28.90], [30.88, 28.96], [30.83, 28.96], [30.83, 28.90],
    ],
    improvementTip: 'Deep-dive into New Alamein City — the towers, university, cultural district, corniche, and its status as a year-round city.',
    landmarks: [
      { id: 'na-1', label: 'Palm Hills Alamein',        lat: 30.8607248, lng: 28.9166024 },
      { id: 'na-2', label: 'Down Town New Alamein',     lat: 30.8572587, lng: 28.9136359 },
      { id: 'na-3', label: 'Al Alamein Model Hospital', lat: 30.8429515, lng: 28.9400128 },
      { id: 'na-4', label: 'El Alamein Military Museum',lat: 30.8414013, lng: 28.9428699 },
      { id: 'na-5', label: 'Marina El Alamein',         lat: 30.8548433, lng: 28.9520834 },
      { id: 'na-6', label: 'Marina Al Dawli',           lat: 30.863722,  lng: 28.943222  },
      { id: 'na-7', label: 'Lagoon',                    lat: 30.859833,  lng: 28.931222  },
      { id: 'na-8', label: 'Al Alamein Tower',          lat: 30.860222,  lng: 28.940861  },
      { id: 'na-9', label: 'Marina Yachts',             lat: 30.858472,  lng: 28.944861  },
    ],
  },
];
