export interface CapitalZone {
  id: string;
  code: string;     // letter/code shown on the map zone box (e.g. "A1", "H3")
  label: string;    // correct project name — used for grading and as the draggable item
  xPct: number;     // left edge as % of container width (fallback for non-poly zones)
  yPct: number;     // top edge as % of container height (fallback for non-poly zones)
  widthPct: number;
  heightPct: number;
  clipPath?: string; // CSS clip-path polygon (kept for non-poly zones)
  pts?: string;      // SVG polygon points "x1,y1 x2,y2 ..." in 1153×878 px space
  pts2?: string;     // second polygon for split zones (e.g. C1left+C1right)
  masterPlanImage?: string; // path to masterplan image in /public, e.g. '/assessment/capital-masterplans/a1.jpg'
}

// Runtime version used in page state — adds the accepted drop value
export interface CapitalZoneState extends CapitalZone {
  accepted: string | null;
}

// Coordinate system: percentages of the image container (0–100).
// Calibrated to new-capital-map.png (1153×878px).
export const CAPITAL_ZONES: CapitalZone[] = [
  // ── Row A ──────────────────────────────────────────────
  {
    id: 'cap-A1', code: 'A1', label: 'RAMATAN',
    xPct: 14.3, yPct: 31.3, widthPct: 9.9, heightPct: 20.5,
    pts: '204,316 259,300 302,420 268,441 226,451',
    masterPlanImage: '/assessment/capital-masterplans/A1.jpeg',
  },
  {
    id: 'cap-A2', code: 'A2', label: 'DiploEast',
    xPct: 15.9, yPct: 51.3, widthPct: 16.0, heightPct: 13.1,
    clipPath: 'polygon(0% 0%, 100% 0%, 93% 38%, 86% 62%, 77% 100%, 0% 100%)',
  },
  // ── Row B ──────────────────────────────────────────────
  {
    id: 'cap-B1', code: 'B1', label: 'Residence Eight',
    xPct: 23.2, yPct: 64.6, widthPct: 6.7, heightPct: 5.1,
    pts: '247,595 342,561 350,581 300,607 250,615',
    masterPlanImage: '/assessment/capital-masterplans/B1.jpeg',
  },
  {
    id: 'cap-B2', code: 'B2', label: 'Dejoya New Capital',
    xPct: 24.1, yPct: 69.7, widthPct: 7.5, heightPct: 4.3,
    pts: '253,635 355,598 363,622 340,635 297,647 258,651',
    masterPlanImage: '/assessment/capital-masterplans/B2.jpeg',
  },
  // ── Row C ──────────────────────────────────────────────
  {
    id: 'cap-C1.1', code: 'C1', label: 'Qamari',
    xPct: 22.4, yPct: 72.0, widthPct: 6.7, heightPct: 7.0,
    pts: '258,665 314,657 324,674 331,687 335,704 343,718 305,721 267,719',
    masterPlanImage: '/assessment/capital-masterplans/C1.1.jpeg',
  },
  {
    id: 'cap-C1.2', code: 'C1', label: 'Ravia',
    xPct: 27.6, yPct: 69.9, widthPct: 8.2, heightPct: 8.7,
    pts: '318,655 373,638 413,691 384,709 349,717 343,706 331,671',
    masterPlanImage: '/assessment/capital-masterplans/C1.2.jpeg',
  },
  {
    id: 'cap-C2', code: 'C2', label: 'Madai',
    xPct: 21.0, yPct: 82.0, widthPct: 8.5, heightPct: 9.0,
    pts: '267,734 329,730 349,746 366,758 404,781 404,793 340,791 274,791',
    masterPlanImage: '/assessment/capital-masterplans/C2.jpeg',
  },
  // ── Row H ──────────────────────────────────────────────
  {
    id: 'cap-H1', code: 'H1', label: 'Anakaji',
    xPct: 24.1, yPct: 30.5, widthPct: 4.9, heightPct: 9.1,
    pts: '280,294 322,284 338,342 299,352',
    masterPlanImage: '/assessment/capital-masterplans/H1.jpeg',
  },
  {
    id: 'cap-H2', code: 'H2', label: 'Srv Capital 2',
    xPct: 29.0, yPct: 30.8, widthPct: 5.7, heightPct: 8.5,
    pts: '392,265 411,329 381,350 358,367 343,326 336,278',
    masterPlanImage: '/assessment/capital-masterplans/H2.jpeg',
  },
  {
    id: 'cap-H3', code: 'H3', label: 'QONTRAC',
    xPct: 31.3, yPct: 39.9, widthPct: 7.9, heightPct: 10.8,
    pts: '418,343 365,381 373,394 394,418 422,441 425,403 421,360',
    masterPlanImage: '/assessment/capital-masterplans/H3.jpeg',
  },
  {
    id: 'cap-H4', code: 'H4', label: 'Lumia',
    xPct: 28.6, yPct: 50.7, widthPct: 9.2, heightPct: 6.6,
    pts: '366,411 329,445 352,528 362,528 378,514 396,489 412,460',
    masterPlanImage: '/assessment/capital-masterplans/H4.jpeg',
  },
  // ── Row I ──────────────────────────────────────────────
  {
    id: 'cap-I3', code: 'I3', label: 'I3',
    xPct: 37.0, yPct: 35.9, widthPct: 2.6, heightPct: 8.7,
    pts: '430,337 449,327 456,360 460,406 436,397 433,363',
    masterPlanImage: '/assessment/capital-masterplans/I3.jpeg',
  },
  {
    id: 'cap-I4', code: 'I4', label: 'I4',
    xPct: 39.4, yPct: 34.4, widthPct: 3.1, heightPct: 10.9,
    pts: '458,322 481,314 487,329 491,351 492,364 493,377 493,388 493,402 494,413 480,411 468,408 464,356',
    masterPlanImage: '/assessment/capital-masterplans/I4.jpeg',
  },
  {
    id: 'cap-I5', code: 'I5', label: 'I5',
    xPct: 37.0, yPct: 44.8, widthPct: 2.5, heightPct: 5.7,
    pts: '436,409 447,412 459,416 459,428 457,449 455,461 442,456 430,450 434,426',
    masterPlanImage: '/assessment/capital-masterplans/I5.jpeg',
  },
  {
    id: 'cap-I6', code: 'I6', label: 'I6',
    xPct: 40.3, yPct: 45.9, widthPct: 2.5, heightPct: 6.1,
    pts: '469,419 496,425 497,450 498,474 494,475 471,470',
    masterPlanImage: '/assessment/capital-masterplans/I6.jpeg',
  },
  // ── J ──────────────────────────────────────────────────
  {
    id: 'cap-J', code: 'J', label: 'Yaru',
    xPct: 39.3, yPct: 23.9, widthPct: 8.9, heightPct: 8.0,
    pts: '488,244 496,241 507,236 521,232 529,229 535,227 541,227 546,230 549,234 553,238 557,242 561,246 566,249 569,252 573,256 577,259 580,261 586,268 582,272 572,275 555,277 543,279 536,281 527,283 520,286 513,289 505,292 497,297 490,265',
    masterPlanImage: '/assessment/capital-masterplans/J.jpeg',
  },
  // ── Row K ──────────────────────────────────────────────
  {
    id: 'cap-K1', code: 'K1', label: 'La Verde New Capital',
    xPct: 48.2, yPct: 21.1, widthPct: 13.5, heightPct: 10.0,
    pts: '560,218 565,214 573,211 581,206 589,203 597,199 608,195 615,193 621,190 629,188 639,185 650,181 658,180 665,178 670,182 673,188 675,194 680,200 686,212 694,228 701,240 709,252 712,258 705,261 687,262 660,263 638,265 626,267 616,268 603,259 578,238 568,230',
    masterPlanImage: '/assessment/capital-masterplans/K1.jpeg',
  },
  {
    id: 'cap-K2', code: 'K2', label: 'La Verde Casette',
    xPct: 61.8, yPct: 20.5, widthPct: 12.1, heightPct: 10.2,
    pts: '718,162 733,159 759,157 797,156 821,156 840,156 843,158 847,207 848,266 835,269 815,268 799,265 776,260 766,252 739,212 716,174',
    masterPlanImage: '/assessment/capital-masterplans/K2.jpeg',
  },
  // ── Row L ──────────────────────────────────────────────
  {
    id: 'cap-L1', code: 'L1', label: 'ERG',
    xPct: 39.4, yPct: 30.2, widthPct: 8.5, heightPct: 8.8,
    pts: '499,311 548,295 555,320 569,346 537,353 504,353',
    masterPlanImage: '/assessment/capital-masterplans/L1.jpeg',
  },
  {
    id: 'cap-L2', code: 'L2', label: 'Florja 5',
    xPct: 42.8, yPct: 39.0, widthPct: 6.2, heightPct: 9.2,
    pts: '508,367 536,366 549,364 576,358 581,362 590,375 595,384 603,402 607,414 598,417 583,420 569,421 556,420 541,420 526,417 512,416',
    masterPlanImage: '/assessment/capital-masterplans/L2.jpeg',
  },
  {
    id: 'cap-L3', code: 'L3', label: 'The Islands',
    xPct: 43.1, yPct: 49.0, widthPct: 5.7, heightPct: 6.8,
    pts: '515,429 528,430 553,430 573,430 576,439 576,450 575,459 575,470 573,478 571,487 556,487 542,485 532,484 525,483 516,482 517,466',
    masterPlanImage: '/assessment/capital-masterplans/L3.jpeg',
  },
  {
    id: 'cap-L4', code: 'L4', label: 'Menorca',
    xPct: 42.8, yPct: 56.1, widthPct: 5.8, heightPct: 5.8,
    pts: '518,498 527,498 549,500 567,501 582,501 592,501 579,525 564,545 554,554 532,524',
    masterPlanImage: '/assessment/capital-masterplans/L4.jpeg',
  },
  {
    id: 'cap-L5', code: 'L5', label: 'Ray',
    xPct: 43.6, yPct: 62.1, widthPct: 11.7, heightPct: 4.2,
    pts: '583,535 604,543 632,554 626,564 612,575 602,583 589,578 563,560 572,548',
    masterPlanImage: '/assessment/capital-masterplans/L5.jpeg',
  },
  {
    id: 'cap-L6', code: 'L6', label: 'Elite Park',
    xPct: 48.6, yPct: 56.1, widthPct: 7.4, heightPct: 5.8,
    pts: '603,500 617,497 634,493 647,491 655,489 664,487 665,494 659,509 637,545 587,527',
    masterPlanImage: '/assessment/capital-masterplans/L6.jpeg',
  },
  {
    id: 'cap-L7', code: 'L7', label: 'Ion',
    xPct: 48.8, yPct: 49.0, widthPct: 7.1, heightPct: 6.8,
    pts: '582,428 603,427 617,426 631,422 635,432 637,446 635,465 629,480 619,482 606,484 592,485 579,486 584,458',
    masterPlanImage: '/assessment/capital-masterplans/L7.jpeg',
  },
  {
    id: 'cap-L9', code: 'L9', label: 'Moraya',
    xPct: 49.0, yPct: 37.6, widthPct: 7.2, heightPct: 10.2,
    pts: '586,355 612,344 631,334 643,330 649,336 655,345 659,356 662,365 663,373 666,382 667,390 647,401 615,412 611,399 595,371',
    masterPlanImage: '/assessment/capital-masterplans/L9.jpeg',
  },
  {
    id: 'cap-L10', code: 'L10', label: 'EDGESTONE',
    xPct: 47.8, yPct: 29.4, widthPct: 8.0, heightPct: 8.2,
    pts: '554,292 576,288 603,281 608,286 612,292 617,297 626,307 632,316 624,321 615,327 607,333 596,337 587,340 578,345 570,334 561,316',
    masterPlanImage: '/assessment/capital-masterplans/L10.jpeg',
  },
  // ── Row M ──────────────────────────────────────────────
  {
    id: 'cap-M1', code: 'M1', label: 'The City Oval',
    xPct: 55.9, yPct: 30.1, widthPct: 9.0, heightPct: 8.9,
    pts: '625,280 631,277 666,274 695,271 719,272 725,275 734,284 740,293 748,301 754,306 762,314 769,325 773,333 766,336 755,340 745,345 736,350 726,356 719,360 710,365 703,371 697,375 691,380 685,379 680,364 673,350 666,334 660,325 653,311 645,301 633,287',
    masterPlanImage: '/assessment/capital-masterplans/M1.jpeg',
  },
  {
    id: 'cap-M2', code: 'M2', label: 'MOON',
    xPct: 65.0, yPct: 30.5, widthPct: 8.8, heightPct: 8.5,
    pts: '741,276 746,274 752,275 763,277 768,277 775,278 781,279 787,279 796,281 804,281 810,282 817,283 827,284 838,285 847,285 851,290 851,297 852,305 852,315 844,316 832,317 821,319 811,320 803,322 791,326 784,326 770,311',
    masterPlanImage: '/assessment/capital-masterplans/M2.jpeg',
  },
  {
    id: 'cap-M3', code: 'M3', label: 'CurrBe',
    xPct: 56.2, yPct: 39.0, widthPct: 12.5, heightPct: 11.7,
    pts: '688,391 693,388 701,382 708,378 715,373 724,368 734,359 745,354 759,346 766,343 772,342 779,342 786,349 787,354 787,360 783,366 778,372 773,377 769,383 765,391 764,398 762,407 761,415 759,423 759,428 752,432 744,435 736,439 729,441 719,444 707,447 697,451 690,450 690,434 689,421 689,411 688,403',
  },
  {
    id: 'cap-M4', code: 'M4', label: 'Lagoons',
    xPct: 68.7, yPct: 39.0, widthPct: 6.2, heightPct: 8.7,
    pts: '796,336 800,332 806,331 817,328 826,328 837,327 846,327 853,328 853,336 853,343 853,350 853,357 854,368 854,375 854,380 856,386 856,392 858,398 859,406 854,411 846,412 840,412 830,412 823,413 821,409 818,393 814,380 805,356',
    masterPlanImage: '/assessment/capital-masterplans/M4.jpeg',
  },
  {
    id: 'cap-M5', code: 'M5', label: 'Roses',
    xPct: 53.3, yPct: 54.7, widthPct: 6.9, heightPct: 6.6,
    pts: '689,476 694,472 704,469 711,468 719,465 727,462 728,468 730,474 732,482 732,487 734,494 734,503 734,510 734,518 733,525 730,533 728,537 723,546 719,547 711,547 704,548 695,549 686,549 676,549 667,549 660,548 669,530 676,518 681,509 686,497 687,486 688,483 688,481',
  },
  {
    id: 'cap-M6', code: 'M6', label: 'Golden Roses',
    xPct: 60.5, yPct: 53.8, widthPct: 6.7, heightPct: 6.6,
    pts: '734,459 739,456 745,454 751,453 759,451 763,455 769,463 773,469 777,473 782,476 785,480 790,484 796,488 800,491 806,496 803,505 800,514 798,524 789,527 781,529 775,531 768,534 759,536 751,538 745,539 740,541 732,543 737,535 740,524 741,512 741,503 741,494 739,484 737,474',
    masterPlanImage: '/assessment/capital-masterplans/M6.jpeg',
  },
  {
    id: 'cap-M7', code: 'M7', label: 'Winter Park',
    xPct: 68.3, yPct: 47.6, widthPct: 6.5, heightPct: 9.6,
    pts: '822,435 826,431 834,431 840,430 847,430 855,430 861,432 862,438 861,443 862,448 862,454 862,461 862,466 864,473 865,480 866,487 867,493 868,499 869,506 865,511 855,514 848,515 839,517 827,516 817,515 817,506 818,497 820,486 822,475 822,465 823,456 823,444',
  },
  {
    id: 'cap-M8', code: 'M8', label: 'Light City',
    xPct: 53.6, yPct: 61.3, widthPct: 6.7, heightPct: 5.1,
    pts: '654,557 668,558 677,559 687,559 696,558 704,558 714,558 710,563 706,569 701,576 696,584 690,592 686,597 682,602 671,602 662,600 652,598 643,596 632,595 632,583 643,572',
    masterPlanImage: '/assessment/capital-masterplans/M8.jpeg',
  },
  {
    id: 'cap-M9', code: 'M9', label: 'Sage Lake',
    xPct: 60.5, yPct: 60.4, widthPct: 6.9, heightPct: 5.5,
    pts: '726,554 733,552 747,548 754,546 765,542 774,540 785,535 794,532 792,538 788,547 786,550 783,555 780,561 778,568 774,573 772,579 767,583 760,587 752,591 738,596 729,598 724,599 714,599 704,601 690,604 713,570 720,563 721,561',
  },
  {
    id: 'cap-M10', code: 'M10', label: 'JADEER',
    xPct: 67.8, yPct: 58.1, widthPct: 6.8, heightPct: 6.3,
    pts: '810,531 817,529 826,526 840,525 851,524 859,522 866,522 869,529 869,543 869,565 858,565 843,566 829,569 820,570 810,572 797,575 789,574 793,565 801,550',
  },
  // ── Row N ──────────────────────────────────────────────
  {
    id: 'cap-N1', code: 'N1', label: 'orbis',
    xPct: 48.3, yPct: 68.3, widthPct: 9.4, heightPct: 5.2,
    pts: '612,607 657,613 679,613 707,612 726,609 737,608 725,630 693,634 663,636 636,633 619,628 603,622',
    masterPlanImage: '/assessment/capital-masterplans/N1.jpeg',
  },
  {
    id: 'cap-N2', code: 'N2', label: 'Suli',
    xPct: 48.3, yPct: 73.6, widthPct: 9.8, heightPct: 4.3,
    pts: '595,634 623,641 663,646 683,646 704,643 719,641 713,651 708,662 676,668 638,664 615,658 592,649',
    masterPlanImage: '/assessment/capital-masterplans/N2.jpeg',
  },
  {
    id: 'cap-N3', code: 'N3', label: 'Dejal',
    xPct: 57.8, yPct: 67.4, widthPct: 8.2, heightPct: 5.5,
    pts: '749,608 759,601 773,596 789,590 806,585 834,580 861,578 867,580 866,590 861,604 808,606 792,608 773,612 755,616 743,621 746,614',
  },
  {
    id: 'cap-N4', code: 'N4', label: 'New Event Developments',
    xPct: 57.8, yPct: 72.9, widthPct: 9.0, heightPct: 4.9,
    pts: '734,638 770,625 803,619 834,617 857,617 842,639 815,639 798,641 771,645 749,652 726,657 728,648',
  },
  // ── Row O ──────────────────────────────────────────────
  {
    id: 'cap-O1', code: 'O1', label: 'Captain',
    xPct: 33.1, yPct: 69.8, widthPct: 7.5, heightPct: 5.4,
    pts: '393,633 420,626 453,624 484,629 443,691 418,672 400,652',
    masterPlanImage: '/assessment/capital-masterplans/O1.jpeg',
  },
  {
    id: 'cap-O2', code: 'O2', label: 'Ravja',
    xPct: 40.6, yPct: 70.6, widthPct: 7.5, heightPct: 5.5,
    pts: '490,628 540,641 568,655 563,667 553,691 512,678 470,658',
    masterPlanImage: '/assessment/capital-masterplans/O2.jpeg',
  },
  {
    id: 'cap-O3', code: 'O3', label: 'Capital Link',
    xPct: 39.5, yPct: 76.1, widthPct: 7.5, heightPct: 5.9,
    pts: '469,662 551,694 545,713 537,721 504,717 468,706 449,695',
    masterPlanImage: '/assessment/capital-masterplans/O3.jpeg',
  },
  // ── Row P ──────────────────────────────────────────────
  {
    id: 'cap-P1', code: 'P1', label: 'kardia',
    xPct: 48.1, yPct: 76.1, widthPct: 10.4, heightPct: 5.6,
    pts: '582,666 606,671 622,678 639,681 658,682 688,681 698,684 692,703 683,712 655,715 620,716 598,717 585,717 568,720 560,716 571,686',
    masterPlanImage: '/assessment/capital-masterplans/P1.jpeg',
  },
  {
    id: 'cap-P2', code: 'P2', label: 'La Reva',
    xPct: 58.5, yPct: 75.0, widthPct: 8.7, heightPct: 5.7,
    pts: '709,682 723,674 747,666 764,663 788,661 812,660 821,662 822,664 812,674 802,679 793,685 776,694 754,702 734,708 714,709 703,708 707,694',
  },
  // ── Row D ──────────────────────────────────────────────
  {
    id: 'cap-D1', code: 'D1', label: 'MAG',
    xPct: 52.0, yPct: 81.5, widthPct: 10.6, heightPct: 6.7,
    pts: '709,731 728,732 762,723 768,730 770,774 770,793 685,794 685,779 688,761 694,733',
    masterPlanImage: '/assessment/capital-masterplans/D1.png',
  },
  {
    id: 'cap-D2', code: 'D2', label: 'Hava',
    xPct: 62.6, yPct: 79.5, widthPct: 7.6, heightPct: 5.4,
    pts: '778,720 821,693 856,730 844,733 830,740 805,751 785,755',
    masterPlanImage: '/assessment/capital-masterplans/D2.jpeg',
  },
  {
    id: 'cap-D3', code: 'D3', label: 'Ayyam',
    xPct: 62.6, yPct: 84.9, widthPct: 7.9, heightPct: 5.5,
    pts: '784,764 805,762 824,755 840,750 856,743 864,740 910,791 852,795 789,793',
    masterPlanImage: '/assessment/capital-masterplans/D3.jpeg',
  },
  {
    id: 'cap-D4', code: 'D4', label: 'Empire',
    xPct: 70.5, yPct: 81.5, widthPct: 8.0, heightPct: 9.0,
    pts: '870,736 901,712 923,686 972,710 977,752 977,778 968,793 955,792 927,794',
  },
  {
    id: 'cap-D5', code: 'D5', label: 'Uprmount',
    xPct: 69.4, yPct: 69.9, widthPct: 6.4, heightPct: 5.8,
    pts: '826,689 854,667 862,666 888,672 899,676 905,678 900,686 885,704 860,724',
  },
  // ── Row F ──────────────────────────────────────────────
  {
    id: 'cap-F1', code: 'F1', label: 'Canyon8',
    xPct: 77.6, yPct: 56.4, widthPct: 6.5, heightPct: 12.9,
    pts: '889,477 952,474 962,568 903,563 898,554',
  },
  {
    id: 'cap-F3', code: 'F3', label: 'ARTAL',
    xPct: 77.9, yPct: 39.6, widthPct: 6.2, heightPct: 10.1,
    pts: '877,319 942,315 942,364 881,368',
    masterPlanImage: '/assessment/capital-masterplans/F3.jpeg',
  },
  {
    id: 'cap-F4', code: 'F4', label: 'Dejoya 4',
    xPct: 77.9, yPct: 30.5, widthPct: 6.2, heightPct: 9.1,
    pts: '875,278 879,276 936,269 939,308 876,311',
    masterPlanImage: '/assessment/capital-masterplans/F4.jpeg',
  },
  // ── Special zones (no image-map polygon — rect fallback) ──
  {
    id: 'cap-university-top', code: 'Univ N', label: 'University (North)',
    xPct: 74.2, yPct: 17.7, widthPct: 9.5, heightPct: 7.1,
    clipPath: 'polygon(0% 0%, 77% 0%, 100% 48%, 100% 100%, 0% 100%)',
  },
  {
    id: 'cap-hotel-top', code: 'Hotel N', label: 'Hotel (North)',
    xPct: 74.2, yPct: 24.8, widthPct: 9.5, heightPct: 5.7,
    clipPath: 'polygon(0% 0%, 80% 0%, 100% 20%, 100% 100%, 0% 100%)',
  },
  {
    id: 'cap-elzohar', code: 'Club', label: 'Club',
    xPct: 76.5, yPct: 49.8, widthPct: 7.6, heightPct: 6.6,
  },
  {
    id: 'cap-hotel-bottom', code: 'Hotel S', label: 'Hotel (South)',
    xPct: 31.9, yPct: 81.8, widthPct: 7.3, heightPct: 9.3,
  },
  {
    id: 'cap-university-bottom', code: 'Univ S', label: 'University (South)',
    xPct: 38.6, yPct: 83.4, widthPct: 8.9, heightPct: 8.0,
  },
];

// Project names users drag onto the map
export const DRAGGABLE_LABELS: string[] = CAPITAL_ZONES.map(z => z.label);
