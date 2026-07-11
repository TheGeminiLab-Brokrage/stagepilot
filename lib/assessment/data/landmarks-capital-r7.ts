import type { CapitalZone } from '@/lib/assessment/data/landmarks-capital';

// Coordinate system: percentages of the image container (0–100).
// Calibrated to r7-capital-map.png (1998×1563 px).
export const CAPITAL_R7_ZONES: CapitalZone[] = [
  // ── Row A ──────────────────────────────────────────────
  {
    id: 'cap-r7-A1', code: 'A1', label: 'A1',
    xPct: 30.7, yPct: 22.3, widthPct: 9.8, heightPct: 10.7,
    pts: '613,462 741,349 808,402 674,517',
    masterPlanImage: '/assessment/r7/A1.jpg',
  },
  {
    id: 'cap-r7-A2', code: 'A2', label: 'A2',
    xPct: 35.4, yPct: 25.4, widthPct: 7.3, heightPct: 9.9,
    pts: '808,397 833,415 844,445 847,466 851,480 853,498 853,515 853,529 851,544 835,544 816,542 796,542 782,545 766,549 754,551 740,535 727,522 717,507 708,492',
    masterPlanImage: '/assessment/r7/A2.jpg',
  },
  // ── Row B ──────────────────────────────────────────────
  {
    id: 'cap-r7-B1', code: 'B1', label: 'B1',
    xPct: 19.5, yPct: 26.0, widthPct: 10.2, heightPct: 16.8,
    pts: '389,641 455,512 531,406 593,466 535,549 475,669',
    masterPlanImage: '/assessment/r7/B1.avif',
  },
  {
    id: 'cap-r7-B2', code: 'B2', label: 'B2',
    xPct: 24.2, yPct: 30.5, widthPct: 10.1, heightPct: 14.5,
    pts: '484,673 530,569 598,477 627,500 655,525 655,539 644,556 646,569 657,581 678,602 685,611 665,641 655,662 644,682 637,699 620,703',
    masterPlanImage: '/assessment/r7/B2.jpg',
  },
  // ── Row C ──────────────────────────────────────────────
  {
    id: 'cap-r7-C', code: 'C', label: 'C',
    xPct: 32.8, yPct: 36.1, widthPct: 9.7, heightPct: 10.5,
    pts: '763,574 796,565 826,565 844,568 849,579 846,589 842,609 830,655 798,715 775,717 761,729 706,718 665,711 655,702 669,674 685,648 704,623 727,646 756,628 770,614 784,598 773,582',
  },
  // ── Row D ──────────────────────────────────────────────
  {
    id: 'cap-r7-D2', code: 'D2', label: 'D2',
    xPct: 62.6, yPct: 36.7, widthPct: 6.2, heightPct: 4.3,
    pts: '1250,640 1253,573 1371,582 1374,603 1374,622 1304,631',
    masterPlanImage: '/assessment/r7/D2.jpg',
  },
  {
    id: 'cap-r7-D3', code: 'D3', label: 'D3',
    xPct: 58.1, yPct: 42.4, widthPct: 4.2, heightPct: 9.3,
    pts: '1160,668 1226,662 1238,716 1244,789 1235,807 1166,807 1166,734',
    masterPlanImage: '/assessment/r7/D3.jpg',
  },
  {
    id: 'cap-r7-D4', code: 'D4', label: 'D4',
    xPct: 62.6, yPct: 41.2, widthPct: 6.8, heightPct: 7.4,
    pts: '1250,665 1347,644 1371,644 1377,668 1386,753 1380,759 1262,759 1259,725',
    masterPlanImage: '/assessment/r7/D4.jpg',
  },
  // ── Row E ──────────────────────────────────────────────
  {
    id: 'cap-r7-E1', code: 'E1', label: 'E1',
    xPct: 74.0, yPct: 44.1, widthPct: 5.3, heightPct: 7.6,
    pts: '1479,766 1479,690 1585,690 1585,808 1491,808 1488,778',
    masterPlanImage: '/assessment/r7/E1.jpeg',
  },
  {
    id: 'cap-r7-E2.1', code: 'E2.1', label: 'E2.1',
    xPct: 73.0, yPct: 53.2, widthPct: 6.4, heightPct: 6.7,
    pts: '1461,832 1582,832 1585,937 1546,937 1458,913',
  },
  {
    id: 'cap-r7-E2.2', code: 'E2.2', label: 'E2.2',
    xPct: 69.7, yPct: 53.2, widthPct: 3.3, heightPct: 5.8,
    pts: '1401,832 1458,832 1458,916 1392,922 1395,868',
    masterPlanImage: '/assessment/r7/E2.2.jpg',
  },
  {
    id: 'cap-r7-E3', code: 'E3', label: 'E3',
    xPct: 69.8, yPct: 37.1, widthPct: 4.2, heightPct: 11.6,
    pts: '1398,583 1479,580 1479,761 1413,761 1395,655',
    masterPlanImage: '/assessment/r7/E3.jpg',
  },
  {
    id: 'cap-r7-E4', code: 'E4', label: 'E4',
    xPct: 74.2, yPct: 36.0, widthPct: 5.2, heightPct: 8.1,
    pts: '1482,689 1482,578 1585,562 1585,689',
    masterPlanImage: '/assessment/r7/E4.jpg',
  },
  // ── Row F ──────────────────────────────────────────────
  {
    id: 'cap-r7-F1', code: 'F1', label: 'F1',
    xPct: 47.1, yPct: 41.3, widthPct: 7.9, heightPct: 9.5,
    pts: '942,779 951,752 960,725 973,707 994,682 1015,670 1033,658 1048,652 1066,646 1084,649 1096,661 1099,676 1090,695 1078,713 1063,728 1051,743 1042,761 1027,776 1012,785 988,791 970,794',
    masterPlanImage: '/assessment/r7/F1.jpg',
  },
  {
    id: 'cap-r7-F4', code: 'F4', label: 'F4',
    xPct: 46.8, yPct: 51.1, widthPct: 3.8, heightPct: 6.7,
    pts: '954,798 1012,837 1006,873 994,900 979,903 957,885 945,858 936,825 939,798',
  },
  {
    id: 'cap-r7-F5', code: 'F5', label: 'F5',
    xPct: 50.5, yPct: 52.7, widthPct: 5.9, heightPct: 5.4,
    pts: '1024,848 1039,839 1111,824 1126,836 1111,854 1087,881 1054,905 1024,908 1009,899 1012,875',
    masterPlanImage: '/assessment/r7/F5.jpg',
  },
  // ── Row G ──────────────────────────────────────────────
  {
    id: 'cap-r7-G1', code: 'G1', label: 'G1',
    xPct: 17.9, yPct: 43.1, widthPct: 5.3, heightPct: 8.0,
    pts: '374,674 387,674 411,683 445,693 459,697 464,706 462,720 459,739 406,735 402,799 358,799 367,730',
    masterPlanImage: '/assessment/r7/G1.jpg',
  },
  {
    id: 'cap-r7-G2', code: 'G2', label: 'G2',
    xPct: 23.6, yPct: 45.2, widthPct: 7.3, heightPct: 7.0,
    pts: '478,751 487,706 617,730 602,815 565,815 529,812 472,806',
    masterPlanImage: '/assessment/r7/G2.webp',
  },
  {
    id: 'cap-r7-G3', code: 'G3', label: 'G3',
    xPct: 18.2, yPct: 52.4, widthPct: 12.3, heightPct: 15.2,
    pts: '363,819 598,834 602,855 608,934 592,943 571,961 574,1000 499,1030 439,1051 405,1057 369,934',
    masterPlanImage: '/assessment/r7/G3.jpg',
  },
  {
    id: 'cap-r7-G4', code: 'G4', label: 'G4',
    xPct: 20.4, yPct: 65.0, widthPct: 15.1, heightPct: 15.1,
    pts: '408,1071 577,1016 592,1040 608,1052 632,1049 653,1043 698,1101 710,1119 665,1161 608,1200 556,1227 487,1252',
    masterPlanImage: '/assessment/r7/G4.webp',
  },
  {
    id: 'cap-r7-G5', code: 'G5', label: 'G5',
    xPct: 24.5, yPct: 79.6, widthPct: 5.6, heightPct: 7.7,
    pts: '490,1265 559,1244 580,1286 602,1355 556,1364 541,1349 526,1346',
    masterPlanImage: '/assessment/r7/G5.jpg',
  },
  {
    id: 'cap-r7-G6', code: 'G6', label: 'G6',
    xPct: 29.0, yPct: 76.5, widthPct: 8.3, heightPct: 10.2,
    pts: '580,1237 617,1216 653,1195 671,1207 701,1228 719,1246 737,1249 746,1264 707,1340 620,1355 598,1276',
    masterPlanImage: '/assessment/r7/G6.avif',
  },
  {
    id: 'cap-r7-G7', code: 'G7', label: 'G7',
    xPct: 33.6, yPct: 72.4, widthPct: 5.6, heightPct: 7.0,
    pts: '671,1183 725,1131 783,1174 779,1195 755,1240 725,1228 689,1204',
    masterPlanImage: '/assessment/r7/G7.jpg',
  },
  // ── Row H ──────────────────────────────────────────────
  {
    id: 'cap-r7-H1', code: 'H1', label: 'H1',
    xPct: 31.5, yPct: 47.4, widthPct: 6.9, heightPct: 12.9,
    pts: '644,747 662,741 701,747 731,756 755,759 764,783 767,922 710,943 683,910 641,919 629,841',
    masterPlanImage: '/assessment/r7/H1.jpeg',
  },
  {
    id: 'cap-r7-H2', code: 'H2', label: 'H2',
    xPct: 34.0, yPct: 60.8, widthPct: 8.5, heightPct: 12.9,
    pts: '770,950 822,1019 846,1043 846,1065 849,1074 801,1152 752,1119 707,1074 680,1037 716,1016 728,992 716,965',
    masterPlanImage: '/assessment/r7/H2.webp',
  },
  // ── Row I ──────────────────────────────────────────────
  {
    id: 'cap-r7-I1', code: 'I1', label: 'I1',
    xPct: 53.9, yPct: 53.2, widthPct: 7.6, heightPct: 7.9,
    pts: '1078,917 1154,835 1223,832 1229,850 1196,896 1135,944 1108,956 1090,933',
    masterPlanImage: '/assessment/r7/I1.jpg',
  },
  {
    id: 'cap-r7-I2', code: 'I2', label: 'I2',
    xPct: 61.2, yPct: 53.4, widthPct: 7.7, heightPct: 3.8,
    pts: '1223,891 1241,858 1253,834 1377,834 1371,861 1359,894',
    masterPlanImage: '/assessment/r7/I2.jpg',
  },
  {
    id: 'cap-r7-I3', code: 'I3', label: 'I3',
    xPct: 56.5, yPct: 57.1, widthPct: 11.5, heightPct: 6.2,
    pts: '1129,972 1141,956 1166,941 1190,923 1217,893 1359,893 1335,944 1304,966 1250,984 1220,990 1157,987',
    masterPlanImage: '/assessment/r7/I3.png',
  },
  // ── Row J ──────────────────────────────────────────────
  {
    id: 'cap-r7-J1', code: 'J1', label: 'J1',
    xPct: 41.7, yPct: 69.0, widthPct: 8.5, heightPct: 7.2,
    pts: '870,1094 891,1094 906,1079 1003,1106 994,1145 963,1154 957,1191 909,1188 867,1179 834,1166',
    masterPlanImage: '/assessment/r7/J1.jpeg',
  },
  {
    id: 'cap-r7-J2', code: 'J2', label: 'J2',
    xPct: 50.7, yPct: 70.6, widthPct: 7.0, heightPct: 4.7,
    pts: '1012,1144 1021,1104 1087,1107 1135,1119 1151,1128 1151,1135 1117,1156 1057,1177 1039,1147',
    masterPlanImage: '/assessment/r7/J2.jpg',
  },
  // ── Row K ──────────────────────────────────────────────
  {
    id: 'cap-r7-K1', code: 'K1', label: 'K1',
    xPct: 38.1, yPct: 76.3, widthPct: 10.3, heightPct: 8.9,
    pts: '764,1331 761,1304 816,1192 840,1195 861,1205 888,1211 909,1217 933,1217 963,1220 967,1241 967,1289',
    masterPlanImage: '/assessment/r7/K1.jpg',
  },
  {
    id: 'cap-r7-K2', code: 'K2', label: 'K2',
    xPct: 52.9, yPct: 73.3, widthPct: 8.9, heightPct: 8.3,
    pts: '1057,1206 1078,1197 1181,1145 1199,1157 1217,1173 1235,1197 1217,1248 1072,1275',
  },
  // ── Row L ──────────────────────────────────────────────
  {
    id: 'cap-r7-L5', code: 'L5', label: 'L5',
    xPct: 41.6, yPct: 37.4, widthPct: 7.7, heightPct: 11.2,
    pts: '834,746 831,722 861,662 882,593 888,584 921,605 942,620 970,635 985,647 973,662 957,677 942,695 933,710 918,731 906,759',
    masterPlanImage: '/assessment/r7/L5.jpeg',
  },
  // ── Row N ──────────────────────────────────────────────
  {
    id: 'cap-r7-N1', code: 'N1', label: 'N1',
    xPct: 45.9, yPct: 64.6, widthPct: 5.9, heightPct: 4.2,
    pts: '924,1027 939,1009 970,1024 1036,1048 1021,1074 957,1062 927,1056 918,1042 924,1027',
    masterPlanImage: '/assessment/r7/N1.jpg',
  },
  {
    id: 'cap-r7-N2', code: 'N2', label: 'N2',
    xPct: 47.9, yPct: 61.6, widthPct: 5.5, heightPct: 4.4,
    pts: '957,989 985,962 1006,974 1021,980 1036,989 1048,992 1066,1001 1045,1031 994,1013',
    masterPlanImage: '/assessment/r7/N2.jpg',
  },
  {
    id: 'cap-r7-N4', code: 'N4', label: 'N4',
    xPct: 51.4, yPct: 67.1, widthPct: 6.2, heightPct: 2.5,
    pts: '1027,1075 1042,1048 1093,1060 1151,1060 1138,1087',
    masterPlanImage: '/assessment/r7/N4.jpg',
  },
  {
    id: 'cap-r7-N5', code: 'N5', label: 'N5',
    xPct: 58.7, yPct: 63.7, widthPct: 6.3, heightPct: 3.5,
    pts: '1172,1043 1193,1016 1223,1016 1247,1013 1265,1007 1289,995 1298,998 1289,1022 1265,1049 1223,1043',
  },
  {
    id: 'cap-r7-N6', code: 'N6', label: 'N6',
    xPct: 57.5, yPct: 67.7, widthPct: 5.1, heightPct: 3.3,
    pts: '1148,1091 1163,1058 1232,1058 1250,1061 1223,1088 1193,1109 1169,1100',
    masterPlanImage: '/assessment/r7/N6.jpg',
  },
  // ── Row O ──────────────────────────────────────────────
  {
    id: 'cap-r7-O3', code: 'O3', label: 'O3',
    xPct: 69.1, yPct: 63.3, widthPct: 10.1, heightPct: 13.7,
    pts: '1470,992 1494,989 1510,989 1528,989 1549,995 1561,1004 1576,1013 1582,1028 1582,1052 1582,1167 1555,1170 1525,1179 1500,1182 1476,1188 1455,1194 1434,1197 1413,1203 1404,1182 1395,1161 1386,1140 1380,1116 1380,1086 1380,1065 1389,1046 1404,1028 1419,1013 1440,998',
    masterPlanImage: '/assessment/r7/O3.webp',
  },
];

// All R7 zones are assessable — none are display-only.
export const CAPITAL_R7_NO_PIN_IDS = new Set<string>([]);
