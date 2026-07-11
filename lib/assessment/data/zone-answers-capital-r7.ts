import { fuzzyMatch } from '@/lib/assessment/utils/fuzzy-match';

export interface CapitalR7ZoneAnswer {
  zoneId: string;
  developer: string;
  project: string;
  acres: string;
  pricePerMeter?: string;
  logoPath?: string;
}

export const CAPITAL_R7_ZONE_ANSWERS: CapitalR7ZoneAnswer[] = [
  { zoneId: 'cap-r7-A1',   developer: 'Cred',              project: 'Castle Landmark',            acres: '43',  pricePerMeter: '48058' },
  { zoneId: 'cap-r7-A2',   developer: 'Akam',              project: 'Scenario',                   acres: '39',  pricePerMeter: '45784' },
  { zoneId: 'cap-r7-B1',   developer: 'Sorouh',            project: 'Entrada',                    acres: '72',  pricePerMeter: '43639' },
  { zoneId: 'cap-r7-B2',   developer: 'Stau',              project: 'Stau',                       acres: '68',  pricePerMeter: '23460' },
  { zoneId: 'cap-r7-C',    developer: 'El Fedaa Gardens',  project: 'El Fedaa Gardens',           acres: '50'  },
  { zoneId: 'cap-r7-D2',   developer: 'El Attal',          project: 'Park Lane',                  acres: '27',  pricePerMeter: '63834' },
  { zoneId: 'cap-r7-D3',   developer: 'Golden Eagle',      project: 'Golden Eagle',               acres: '42'  },
  { zoneId: 'cap-r7-D4',   developer: 'GATES',             project: 'Venia',                      acres: '40'  },
  { zoneId: 'cap-r7-E1',   developer: 'Taj Misr',          project: 'DEJOYA 3',                   acres: '33',  pricePerMeter: '52682' },
  { zoneId: 'cap-r7-E2.1', developer: 'Pyramids',          project: 'La Capitale Suite Lagoons',  acres: '30',  pricePerMeter: '48000' },
  { zoneId: 'cap-r7-E2.2', developer: 'NGD',               project: 'Botanica',                   acres: '23',  pricePerMeter: '39677' },
  { zoneId: 'cap-r7-E3',   developer: 'TLD',               project: 'Armonia',                    acres: '42',  pricePerMeter: '45534' },
  { zoneId: 'cap-r7-E4',   developer: 'AMG',               project: 'Oro',                        acres: '38',  pricePerMeter: '35640' },
  { zoneId: 'cap-r7-F1',   developer: 'Dubai Misr',        project: 'Lumia',                      acres: '36',  pricePerMeter: '34000' },
  { zoneId: 'cap-r7-F4',   developer: 'CECELIA',           project: 'Le Ciel',                    acres: '16'  },
  { zoneId: 'cap-r7-F5',   developer: 'AlTameer Arabian',  project: 'Rivan',                      acres: '17',  pricePerMeter: '53481' },
  { zoneId: 'cap-r7-G1',   developer: 'New Plan',          project: 'Atika',                      acres: '35',  pricePerMeter: '70000' },
  { zoneId: 'cap-r7-G2',   developer: 'Akam',              project: 'Scene 7',                    acres: '40',  pricePerMeter: '51705' },
  { zoneId: 'cap-r7-G3',   developer: 'Better Home',       project: 'Midtown Sky',                acres: '122', pricePerMeter: '49624' },
  { zoneId: 'cap-r7-G4',   developer: 'Misr Italia',       project: 'Vinci',                      acres: '110', pricePerMeter: '61321' },
  { zoneId: 'cap-r7-G5',   developer: 'Edge Holding',      project: 'OIA',                        acres: '30',  pricePerMeter: '50000' },
  { zoneId: 'cap-r7-G6',   developer: 'OUD',               project: 'Jnoub',                      acres: '48',  pricePerMeter: '41000' },
  { zoneId: 'cap-r7-G7',   developer: 'RFCO',              project: 'Il Mondo',                   acres: '23',  pricePerMeter: '45000' },
  { zoneId: 'cap-r7-H1',   developer: 'EG Master',         project: 'The City Valley',            acres: '63',  pricePerMeter: '43000' },
  { zoneId: 'cap-r7-H2',   developer: 'MASTER',            project: 'The City',                   acres: '55'  },
  { zoneId: 'cap-r7-I1',   developer: 'New Plan',          project: 'TALAH',                      acres: '30',  pricePerMeter: '47151' },
  { zoneId: 'cap-r7-I2',   developer: 'Living Yards',      project: 'The Loft',                   acres: '23',  pricePerMeter: '45946' },
  { zoneId: 'cap-r7-I3',   developer: 'GATES',             project: 'Catalan',                    acres: '40',  pricePerMeter: '38871' },
  { zoneId: 'cap-r7-J1',   developer: 'Elite',             project: 'Elite',                      acres: '52'  },
  { zoneId: 'cap-r7-J2',   developer: 'Smart',             project: 'Town Gate',                  acres: '21',  pricePerMeter: '34150' },
  { zoneId: 'cap-r7-K1',   developer: 'Better Home',       project: 'Midtown Condo',              acres: '60',  pricePerMeter: '45376' },
  { zoneId: 'cap-r7-K2',   developer: 'Capital Flowers',   project: 'Capital Flowers',            acres: '22'  },
  { zoneId: 'cap-r7-L5',   developer: 'ATRIC',             project: 'Boardwalk',                  acres: '45',  pricePerMeter: '53200' },
  { zoneId: 'cap-r7-N1',   developer: 'New Plan',          project: 'Serrano',                    acres: '15',  pricePerMeter: '72000' },
  { zoneId: 'cap-r7-N2',   developer: 'Pyramids',          project: 'La Capitale',                acres: '13',  pricePerMeter: '54000' },
  { zoneId: 'cap-r7-N4',   developer: 'SAK',               project: 'Sueno',                      acres: '11',  pricePerMeter: '45000' },
  { zoneId: 'cap-r7-N5',   developer: 'Better House',      project: 'Sky Capital View',           acres: '14',  pricePerMeter: '39000' },
  { zoneId: 'cap-r7-N6',   developer: 'NJD',               project: 'Green Avenue',               acres: '11',  pricePerMeter: '44829' },
  { zoneId: 'cap-r7-O3',   developer: 'Plaza Gardens',     project: 'Rhodes',                     acres: '100', pricePerMeter: '34354' },
];

export const UNIQUE_R7_DEVELOPERS: string[] = [
  ...new Set(CAPITAL_R7_ZONE_ANSWERS.map(a => a.developer))
].sort((a, b) => a.localeCompare(b));

export const UNIQUE_R7_PROJECTS: string[] = [
  ...new Set(CAPITAL_R7_ZONE_ANSWERS.map(a => a.project))
].sort((a, b) => a.localeCompare(b));

function getR7ZoneAnswer(zoneId: string): CapitalR7ZoneAnswer | undefined {
  return CAPITAL_R7_ZONE_ANSWERS.find(a => a.zoneId === zoneId);
}

function acresVarianceOk(given: string, expected: string): boolean {
  const g = parseFloat(given.trim());
  const e = parseFloat(expected.trim());
  if (isNaN(g) || isNaN(e)) {
    return given.trim().toLowerCase() === expected.trim().toLowerCase();
  }
  let pct: number;
  if (e <= 30)      pct = 0.15;
  else if (e <= 50) pct = 0.10;
  else              pct = 0.05;
  return Math.abs(g - e) <= e * pct;
}

function priceVarianceOk(given: string, expected: string): boolean {
  const g = parseFloat(given.trim().replace(/,/g, ''));
  const e = parseFloat(expected.trim().replace(/,/g, ''));
  if (isNaN(g) || isNaN(e) || e <= 0) return false;
  return Math.abs(g - e) <= e * 0.10;
}

export function gradeR7ZoneForm(
  form: { developer: string; project: string; acres: string; pricePerMeter?: string },
  zoneId: string
): { developerOk: boolean; projectOk: boolean; acresOk: boolean; pricePerMeterOk: boolean; allOk: boolean } {
  const ans = getR7ZoneAnswer(zoneId);
  if (!ans) return { developerOk: false, projectOk: false, acresOk: false, pricePerMeterOk: false, allOk: false };
  const developerOk    = fuzzyMatch(form.developer, ans.developer);
  const projectOk      = fuzzyMatch(form.project,   ans.project);
  const acresOk        = acresVarianceOk(form.acres, ans.acres);
  const pricePerMeterOk = ans.pricePerMeter
    ? priceVarianceOk(form.pricePerMeter ?? '', ans.pricePerMeter)
    : true;
  return { developerOk, projectOk, acresOk, pricePerMeterOk, allOk: developerOk && projectOk };
}
