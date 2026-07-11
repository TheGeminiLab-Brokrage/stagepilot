import { fuzzyMatch } from '@/lib/assessment/utils/fuzzy-match';

export interface CapitalZoneAnswer {
  zoneId: string;
  developer: string;
  project: string;
  acres: string;
  logoPath?: string;
}

export const CAPITAL_ZONE_ANSWERS: CapitalZoneAnswer[] = [
  { zoneId: 'cap-A1',  developer: 'MBG',             project: 'Diplo East',           acres: '65',  logoPath: '/assessment/logos/MBG.jpeg' },
  { zoneId: 'cap-B1',  developer: 'Sky AD',           project: 'Residence Eight',      acres: '23' },
  { zoneId: 'cap-B2',  developer: 'Taj Misr',         project: 'Dejoya 1',             acres: '23' },
  { zoneId: 'cap-C1.1', developer: 'New Event', project: 'Qamari', acres: '25' },
  { zoneId: 'cap-C1.2', developer: 'Captain',   project: 'Ravia',  acres: '33' },
  { zoneId: 'cap-C2',  developer: 'LARZ',             project: 'Madai',                acres: '36' },
  { zoneId: 'cap-D1',  developer: 'New Event',        project: 'layal',                acres: '38' },
  { zoneId: 'cap-D2',  developer: 'Qurtuba',          project: 'Hava',                 acres: '21' },
  { zoneId: 'cap-D3',  developer: 'CCR',              project: 'Ayyam',                acres: '39' },
  { zoneId: 'cap-M4',  developer: 'Dominar',          project: 'Winter Park',          acres: '31' },
  { zoneId: 'cap-M2',  developer: 'Artal',            project: 'Plato',                acres: '28' },
  { zoneId: 'cap-F4',  developer: 'EUPHORIA',         project: 'Queen Land',           acres: '24' },
  { zoneId: 'cap-F3',  developer: 'Hometown',         project: 'Canyon8',              acres: '25' },
  { zoneId: 'cap-H2',  developer: 'Qontrac',          project: 'Yaru',                 acres: '37' },
  { zoneId: 'cap-H1',  developer: 'Ramatan',          project: 'Ramatan',              acres: '20' },
  { zoneId: 'cap-H3',  developer: 'ERG',              project: 'Ri8',                  acres: '25' },
  { zoneId: 'cap-H4',  developer: 'Dubai Misr',       project: 'Lumia',                acres: '36' },
  { zoneId: 'cap-I3',  developer: 'Better House',     project: 'Sky Capital 2',        acres: '14' },
  { zoneId: 'cap-I5',  developer: 'Taj Misr',         project: 'Dejoya 2',             acres: '11' },
  { zoneId: 'cap-I6',  developer: 'Corner Stone',     project: 'The Curve',            acres: '13' },
  { zoneId: 'cap-I4',  developer: 'AQAR MASR',        project: 'Anakaji',              acres: '20' },
  { zoneId: 'cap-J',   developer: 'La Verde',         project: 'La Verde New Capital', acres: '35' },
  { zoneId: 'cap-K1',  developer: 'La Verde',         project: 'La Verde Casette',     acres: '60' },
  { zoneId: 'cap-L1',  developer: 'fourseason group', project: 'Floria 5',             acres: '23' },
  { zoneId: 'cap-L2',  developer: 'EgyGab',           project: 'The Islands',          acres: '36' },
  { zoneId: 'cap-L3',  developer: 'Prime',            project: 'ION',                  acres: '26' },
  { zoneId: 'cap-L7',  developer: 'Capital Elite',    project: 'Elite Park',           acres: '30' },
  { zoneId: 'cap-L6',  developer: 'GoldenHouse',      project: 'Roses',                acres: '17' },
  { zoneId: 'cap-L9',  developer: 'Master Group',     project: 'The City Oval',        acres: '30' },
  { zoneId: 'cap-L4',  developer: 'Mardev',           project: 'Menorca',              acres: '18' },
  { zoneId: 'cap-L10', developer: 'Edgestone',        project: 'Moraya',               acres: '25' },
  { zoneId: 'cap-M1',  developer: 'Modon',            project: 'Lagoons',              acres: '60' },
  { zoneId: 'cap-K2',  developer: 'Taj Misr',         project: 'Dejoya 4',             acres: '70' },
  { zoneId: 'cap-M3',  developer: 'Mooon',            project: 'Lagoons',              acres: '60' },
  { zoneId: 'cap-M5',  developer: 'Jadeer',           project: 'chapters',             acres: '33' },
  { zoneId: 'cap-M6',  developer: 'Squares',          project: 'Sage Lake',            acres: '32' },
  { zoneId: 'cap-M7',  developer: 'Dominar',          project: 'Winter Park',          acres: '31' },
  { zoneId: 'cap-M9',  developer: 'Squares',          project: 'Sage Lake',            acres: '32' },
  { zoneId: 'cap-M10', developer: 'Jadeer',           project: 'chapters',             acres: '33' },
  { zoneId: 'cap-L5',  developer: 'MAK',              project: 'Light City',           acres: '18' },
  { zoneId: 'cap-M8',  developer: 'EMPIRE STATE',     project: 'Upmount',              acres: '21' },
  { zoneId: 'cap-D5',  developer: 'EMPIRE STATE',     project: 'Upmount',              acres: '21' },
  { zoneId: 'cap-N1',  developer: 'Orbis',            project: 'Orbis',                acres: '19' },
  { zoneId: 'cap-N2',  developer: 'DIG',              project: 'Defaf',                acres: '22' },
  { zoneId: 'cap-P1',  developer: 'MAG',              project: 'La Reva',              acres: '38' },
  { zoneId: 'cap-P2',  developer: 'MAG',              project: 'La Reva',              acres: '38' },
  { zoneId: 'cap-F1',  developer: 'Hometown',         project: 'Canyon8',              acres: '25' },
  { zoneId: 'cap-O1',  developer: 'Radix',            project: 'Ray',                  acres: '27' },
  { zoneId: 'cap-O2',  developer: 'Capital Link',     project: 'Kardia',               acres: '24' },
  { zoneId: 'cap-O3',  developer: 'UC Developments',  project: 'Suli',                 acres: '26' },
];

export const UNIQUE_DEVELOPERS: string[] = [
  ...new Set(CAPITAL_ZONE_ANSWERS.map(a => a.developer))
].sort((a, b) => a.localeCompare(b));

export const UNIQUE_PROJECTS: string[] = [
  ...new Set(CAPITAL_ZONE_ANSWERS.map(a => a.project))
].sort((a, b) => a.localeCompare(b));

export function getZoneAnswer(zoneId: string): CapitalZoneAnswer | undefined {
  return CAPITAL_ZONE_ANSWERS.find(a => a.zoneId === zoneId);
}

export function acresVarianceOk(given: string, expected: string): boolean {
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

export function gradeZoneForm(
  form: { developer: string; project: string; acres: string },
  zoneId: string
): { developerOk: boolean; projectOk: boolean; acresOk: boolean; allOk: boolean } {
  const ans = getZoneAnswer(zoneId);
  if (!ans) return { developerOk: false, projectOk: false, acresOk: false, allOk: false };
  const developerOk = fuzzyMatch(form.developer, ans.developer);
  const projectOk   = fuzzyMatch(form.project,   ans.project);
  const acresOk     = acresVarianceOk(form.acres, ans.acres);
  return { developerOk, projectOk, acresOk, allOk: developerOk && projectOk };
}
