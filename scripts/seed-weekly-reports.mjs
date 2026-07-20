#!/usr/bin/env node
// Run: node scripts/seed-weekly-reports.mjs
// Seeds historical weekly reports by aggregating the same RAW data used
// by seed-reports.mjs, grouped into Sun–Thu working weeks.

// Credentials come from env — never hardcode the service-role key in a committed file.
// Run: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... COMPANY_ID=... node scripts/seed-weekly-reports.mjs
const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const COMPANY_ID = process.env.COMPANY_ID
if (!SUPABASE_URL || !SERVICE_KEY || !COMPANY_ID) {
  console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / COMPANY_ID env vars')
  process.exit(1)
}

const ALL_AGENTS = [
  'Ahmed Mustafa', 'Mariam Ahmed', 'Mohamed Sayed', 'Nourhan Ayman',
  'Kareem Mohammed', 'Fady Fawzy', 'Mohamed Shabaan', 'Taher',
  'Yasmine', 'Hadeer', 'Shahd', 'Amira',
]
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

// ── Same RAW data as seed-reports.mjs ──────────────────────────────────────
// format: [timestamp, name, reportDate, sheets, posts, requests, followups,
//          totalLeads, reached, notReached, crmAct, uploaded, notUploaded, summary,
//          m1n,m1p,m1r, m2n,m2p,m2r, m3n,m3p,m3r]
const RAW = [
  ['5/10/2026 20:09:41','Nourhan Ayman','5/10/2026',1,5,2,30,3,1,2,1,0,0,''],
  ['5/10/2026 20:10:32','Taher','5/10/2026',0,5,0,10,2,1,1,4,0,1,''],
  ['5/10/2026 20:37:42','Kareem Mohammed','5/10/2026',0,5,0,10,1,0,1,10,0,1,''],
  ['5/10/2026 21:24:10','Ahmed Mustafa','5/10/2026',1,5,0,8,3,2,1,3,0,0,''],
  ['5/10/2026 22:29:52','Fady Fawzy','5/10/2026',0,5,2,14,6,5,1,3,0,4,''],
  ['5/11/2026 15:19:09','Mariam Ahmed','5/10/2026',0,5,0,20,7,3,4,7,0,7,''],

  ['5/11/2026 19:58:55','Mohamed Shabaan','5/11/2026',0,8,0,15,1,0,1,2,0,0,''],
  ['5/11/2026 19:59:55','Taher','5/11/2026',3,5,1,10,1,0,1,1,0,1,''],
  ['5/11/2026 20:05:41','Kareem Mohammed','5/11/2026',1,5,1,38,1,1,0,1,0,1,''],
  ['5/11/2026 20:16:08','Fady Fawzy','5/11/2026',3,5,1,5,1,1,0,0,0,0,''],
  ['5/11/2026 20:17:19','Ahmed Mustafa','5/11/2026',25,5,2,5,1,1,0,5,0,0,''],
  ['5/11/2026 20:51:07','Mohamed Sayed','5/11/2026',2,5,3,3,1,1,0,1,0,0,''],

  ['5/12/2026 19:46:38','Kareem Mohammed','5/12/2026',1,5,2,53,1,0,1,1,0,1,''],
  ['5/12/2026 19:55:35','Fady Fawzy','5/12/2026',3,5,2,21,2,1,1,21,0,0,''],
  ['5/12/2026 19:59:04','Ahmed Mustafa','5/12/2026',49,5,2,60,1,1,0,0,0,0,''],
  ['5/12/2026 20:02:00','Mohamed Sayed','5/12/2026',2,5,0,9,1,0,0,5,0,0,''],
  ['5/12/2026 20:31:08','Taher','5/12/2026',0,5,0,30,1,1,0,2,0,2,''],
  ['5/13/2026 17:58:24','Mohamed Shabaan','5/12/2026',3,5,1,15,2,1,1,1,0,0,''],

  ['5/13/2026 19:58:14','Mohamed Shabaan','5/13/2026',1,5,0,20,4,3,1,5,0,3,''],
  ['5/13/2026 19:59:27','Nourhan Ayman','5/13/2026',4,5,3,30,1,1,0,3,0,0,''],
  ['5/13/2026 20:00:09','Kareem Mohammed','5/13/2026',2,5,0,22,4,3,1,4,0,4,''],
  ['5/13/2026 20:09:59','Fady Fawzy','5/13/2026',3,5,2,14,3,2,1,14,0,3,''],
  ['5/13/2026 20:16:31','Taher','5/13/2026',0,5,0,15,2,2,0,4,0,4,''],
  ['5/13/2026 20:27:18','Ahmed Mustafa','5/13/2026',2,5,2,15,2,2,0,7,0,0,''],
  ['5/13/2026 20:30:31','Mohamed Sayed','5/13/2026',3,6,3,31,0,0,0,15,0,0,''],
  ['5/13/2026 20:43:48','Mariam Ahmed','5/13/2026',0,5,0,20,3,1,2,3,0,1,''],
  ['5/13/2026 20:46:51','Mariam Ahmed','5/13/2026',0,5,0,25,4,3,1,4,0,4,''],

  ['5/14/2026 19:32:35','Kareem Mohammed','5/14/2026',1,5,1,5,0,0,0,0,0,0,''],
  ['5/14/2026 20:05:10','Fady Fawzy','5/14/2026',1,5,1,38,1,0,1,1,0,1,''],
  ['5/14/2026 20:08:21','Taher','5/14/2026',1,5,0,7,0,0,0,2,0,0,''],
  ['5/14/2026 20:14:17','Ahmed Mustafa','5/14/2026',2,5,3,5,0,0,0,0,0,0,''],
  ['5/14/2026 21:06:07','Nourhan Ayman','5/14/2026',0,5,3,30,0,0,0,2,0,0,''],
  ['5/14/2026 21:22:38','Mariam Ahmed','5/14/2026',0,5,0,20,1,1,0,1,0,1,''],
  ['5/14/2026 21:32:06','Mohamed Sayed','5/14/2026',3,5,2,15,0,0,0,3,0,0,''],

  ['5/16/2026 22:02:05','Nourhan Ayman','5/16/2026',0,5,3,40,0,0,0,4,0,0,''],
  ['5/16/2026 22:04:30','Ahmed Mustafa','5/16/2026',2,5,4,75,0,0,0,2,0,0,''],
  ['5/16/2026 22:08:03','Fady Fawzy','5/16/2026',4,5,4,28,0,0,0,28,0,0,''],
  ['5/16/2026 22:12:48','Kareem Mohammed','5/16/2026',2,5,1,52,0,0,0,52,0,0,''],
  ['5/16/2026 23:02:57','Mariam Ahmed','5/16/2026',1,5,1,20,0,0,0,0,0,0,''],
  ['5/16/2026 23:07:21','Mohamed Sayed','5/16/2026',2,5,0,30,0,0,0,22,0,0,''],

  ['5/17/2026 19:55:13','Ahmed Mustafa','5/17/2026',3,5,2,25,0,0,0,25,0,0,''],
  ['5/17/2026 19:58:53','Mohamed Shabaan','5/17/2026',2,5,2,25,0,0,0,1,0,0,''],
  ['5/17/2026 20:04:36','Nourhan Ayman','5/17/2026',7,5,2,40,0,0,0,3,0,0,''],
  ['5/17/2026 20:25:07','Fady Fawzy','5/17/2026',1,5,0,3,0,3,0,3,0,0,''],
  ['5/17/2026 20:27:51','Kareem Mohammed','5/17/2026',1,5,1,48,0,0,0,48,0,0,''],
  ['5/17/2026 20:28:03','Mohamed Sayed','5/17/2026',1,5,2,7,2,2,0,60,2,0,''],
  ['5/17/2026 21:14:09','Taher','5/17/2026',3,5,0,13,0,0,0,1,0,0,''],
  ['5/17/2026 21:17:59','Mariam Ahmed','5/17/2026',0,5,0,15,0,0,0,0,0,0,''],

  ['5/18/2026 20:01:57','Kareem Mohammed','5/18/2026',2,5,1,18,0,0,0,0,0,0,''],
  ['5/18/2026 20:23:20','Mohamed Shabaan','5/18/2026',3,5,3,20,0,0,0,1,0,0,''],
  ['5/18/2026 20:48:57','Ahmed Mustafa','5/18/2026',4,5,1,55,0,0,0,55,0,0,''],
  ['5/18/2026 21:25:17','Fady Fawzy','5/18/2026',1,5,2,53,0,0,0,53,1,0,''],
  ['5/18/2026 21:41:10','Mariam Ahmed','5/18/2026',1,5,0,15,0,0,0,0,0,0,''],
  ['5/18/2026 21:46:31','Nourhan Ayman','5/18/2026',4,5,5,40,0,0,0,2,0,0,''],
  ['5/18/2026 21:49:29','Mohamed Sayed','5/18/2026',2,5,2,20,0,0,0,48,0,0,''],

  ['5/19/2026 20:01:46','Kareem Mohammed','5/19/2026',1,5,3,8,0,0,0,0,0,0,''],
  ['5/19/2026 20:02:13','Mohamed Shabaan','5/19/2026',1,5,0,15,0,0,0,0,0,0,''],
  ['5/19/2026 20:08:13','Nourhan Ayman','5/19/2026',3,5,2,40,0,0,0,2,0,0,''],
  ['5/19/2026 20:17:22','Taher','5/19/2026',2,5,1,10,0,0,0,2,0,0,''],
  ['5/19/2026 20:25:40','Fady Fawzy','5/19/2026',4,5,1,37,0,0,0,37,0,0,''],
  ['5/19/2026 20:47:13','Ahmed Mustafa','5/19/2026',4,5,1,50,0,0,0,1,0,0,''],

  ['5/19/2026 23:18:48','Mariam Ahmed','5/20/2026',0,5,0,10,0,0,0,0,0,0,''],
  ['5/20/2026 19:51:40','Mohamed Shabaan','5/20/2026',2,5,2,20,0,0,0,0,0,0,''],
  ['5/20/2026 19:59:06','Taher','5/20/2026',0,5,0,20,0,0,0,0,0,0,''],
  ['5/20/2026 20:06:27','Ahmed Mustafa','5/20/2026',3,5,1,20,0,0,0,0,0,0,''],
  ['5/20/2026 20:07:10','Kareem Mohammed','5/20/2026',2,5,1,27,27,0,0,0,0,0,''],
  ['5/20/2026 20:11:40','Fady Fawzy','5/20/2026',2,5,2,37,0,0,0,37,0,2,''],
  ['5/20/2026 21:07:52','Mohamed Sayed','5/20/2026',1,5,2,40,0,0,0,4,0,0,''],
  ['5/20/2026 21:08:23','Nourhan Ayman','5/20/2026',2,5,3,30,0,0,0,0,0,0,''],

  ['5/21/2026 18:06:13','Kareem Mohammed','5/21/2026',1,5,0,50,0,0,0,0,0,0,''],
  ['5/21/2026 20:01:21','Mohamed Shabaan','5/21/2026',2,5,1,15,0,0,0,0,0,0,''],
  ['5/21/2026 20:02:35','Ahmed Mustafa','5/21/2026',4,5,1,53,0,0,0,0,0,0,''],
  ['5/21/2026 20:04:25','Fady Fawzy','5/21/2026',1,5,2,30,0,0,0,30,0,0,''],
  ['5/21/2026 20:22:20','Nourhan Ayman','5/21/2026',3,5,2,40,0,0,0,3,0,0,''],
  ['5/21/2026 20:24:28','Mohamed Sayed','5/21/2026',0,7,0,3,0,0,0,19,0,0,''],
  ['5/21/2026 21:04:22','Taher','5/21/2026',0,5,0,40,0,0,0,6,0,0,''],

  ['5/23/2026 20:02:39','Fady Fawzy','5/23/2026',0,5,0,3,0,0,0,3,0,0,''],
  ['5/23/2026 20:02:48','Mohamed Shabaan','5/23/2026',1,5,0,5,0,0,0,0,0,0,''],
  ['5/23/2026 20:14:22','Ahmed Mustafa','5/23/2026',2,5,0,30,0,0,0,0,0,0,''],

  ['5/24/2026 21:15:36','Kareem Mohammed','5/24/2026',0,5,0,60,0,0,0,0,0,0,''],
  ['5/24/2026 21:16:46','Taher','5/24/2026',0,5,0,30,0,0,0,5,0,0,''],
  ['5/24/2026 21:17:44','Nourhan Ayman','5/24/2026',0,5,0,0,0,0,0,0,0,0,''],
  ['5/24/2026 21:17:46','Mohamed Sayed','5/24/2026',0,5,0,18,0,0,0,19,0,0,''],
  ['5/24/2026 22:13:44','Fady Fawzy','5/24/2026',0,5,0,35,0,0,0,35,0,0,''],

  ['5/25/2026 20:19:45','Taher','5/25/2026',1,5,1,5,0,0,0,0,0,0,''],

  ['5/31/2026 19:59:41','Kareem Mohammed','5/31/2026',1,5,0,2,0,0,0,0,0,0,''],
  ['5/31/2026 20:08:25','Fady Fawzy','5/31/2026',0,5,0,0,0,0,0,0,0,0,''],
  ['5/31/2026 21:33:12','Nourhan Ayman','5/31/2026',2,5,0,20,0,0,0,0,0,0,''],
  ['5/31/2026 21:41:19','Mohamed Sayed','5/31/2026',1,5,0,5,0,0,0,9,0,0,''],

  ['6/1/2026 21:08:52','Kareem Mohammed','6/1/2026',3,5,0,12,0,0,0,0,0,0,''],
  ['6/1/2026 21:09:03','Taher','6/1/2026',2,5,1,6,0,0,0,0,0,0,''],
  ['6/1/2026 21:10:10','Mohamed Shabaan','6/1/2026',4,5,0,5,0,0,0,0,0,0,''],

  ['6/2/2026 20:05:34','Mohamed Shabaan','6/2/2026',4,5,0,5,0,0,0,0,0,0,''],
  ['6/2/2026 20:14:10','Taher','6/2/2026',5,5,0,7,0,0,0,0,0,0,''],
  ['6/2/2026 20:18:26','Fady Fawzy','6/2/2026',3,5,2,17,0,0,0,17,0,0,''],

  ['6/3/2026 20:12:59','Mohamed Shabaan','6/3/2026',9,5,1,10,0,0,0,0,0,0,''],
  ['6/3/2026 20:26:24','Taher','6/3/2026',9,5,1,0,0,0,0,0,0,0,''],
  ['6/3/2026 20:34:28','Fady Fawzy','6/3/2026',5,5,2,8,0,0,0,8,0,0,''],
  ['6/3/2026 20:35:46','Kareem Mohammed','6/3/2026',6,5,3,7,0,0,0,0,0,0,''],
  ['6/3/2026 20:35:50','Nourhan Ayman','6/3/2026',5,5,2,20,0,0,0,0,0,0,''],
  ['6/3/2026 20:57:38','Mariam Ahmed','6/3/2026',0,5,0,0,0,0,0,0,0,0,''],
  ['6/3/2026 21:00:05','Mohamed Sayed','6/3/2026',7,5,0,3,0,0,0,0,0,0,''],

  ['6/4/2026 19:44:29','Mariam Ahmed','6/4/2026',0,5,0,0,0,0,0,0,0,0,''],
  ['6/4/2026 19:46:08','Fady Fawzy','6/4/2026',1,5,1,0,0,0,0,0,0,0,''],
  ['6/4/2026 20:04:29','Nourhan Ayman','6/4/2026',2,5,0,0,0,0,0,0,0,0,''],
  ['6/4/2026 20:43:07','Kareem Mohammed','6/4/2026',1,5,1,7,0,0,0,0,0,0,''],
  ['6/4/2026 21:12:57','Taher','6/4/2026',5,5,7,3,0,0,0,0,0,0,''],
  ['6/4/2026 21:20:01','Mohamed Shabaan','6/4/2026',3,5,7,3,0,0,0,0,0,0,''],
  ['6/4/2026 22:14:06','Mohamed Sayed','6/4/2026',5,5,1,2,0,0,0,0,0,0,''],

  ['6/6/2026 18:03:37','Taher','6/6/2026',1,5,0,3,0,0,0,0,0,0,''],
  ['6/6/2026 20:03:12','Mohamed Shabaan','6/6/2026',2,5,0,3,0,0,0,0,0,0,''],
  ['6/6/2026 20:11:27','Kareem Mohammed','6/6/2026',0,5,0,2,0,0,0,0,0,0,''],
  ['6/6/2026 20:23:37','Fady Fawzy','6/6/2026',1,5,0,19,0,0,0,19,0,0,''],
  ['6/6/2026 21:00:05','Nourhan Ayman','6/6/2026',3,5,0,0,0,0,0,0,0,0,''],
  ['6/6/2026 21:08:59','Mariam Ahmed','6/6/2026',1,5,0,0,0,0,0,0,0,0,''],
  ['6/6/2026 21:09:42','Mohamed Sayed','6/6/2026',1,5,0,11,0,0,0,4,0,0,''],

  ['6/7/2026 20:07:49','Ahmed Mustafa','6/7/2026',1,5,0,40,0,0,0,0,0,0,''],
  ['6/7/2026 20:21:31','Nourhan Ayman','6/7/2026',1,5,0,0,0,0,0,0,0,0,''],
  ['6/7/2026 20:30:02','Fady Fawzy','6/7/2026',0,5,0,0,0,0,0,0,0,0,''],
  ['6/7/2026 20:54:39','Taher','6/7/2026',1,5,0,5,0,0,0,0,0,0,''],
  ['6/7/2026 20:56:39','Mariam Ahmed','6/7/2026',0,5,0,0,0,0,0,0,0,0,''],
  ['6/7/2026 22:20:14','Mohamed Sayed','6/7/2026',1,5,0,9,0,0,0,2,0,0,''],
  ['6/7/2026 23:14:07','Kareem Mohammed','6/7/2026',1,5,0,0,0,0,0,0,0,0,''],
  ['6/7/2026 23:14:49','Mohamed Shabaan','6/7/2026',1,5,0,9,0,0,0,0,0,0,''],

  ['6/8/2026 20:05:32','Kareem Mohammed','6/8/2026',1,5,0,0,0,0,0,0,0,0,''],
  ['6/8/2026 20:06:58','Taher','6/8/2026',0,5,0,0,0,0,0,9,0,0,''],
  ['6/8/2026 20:07:18','Mohamed Shabaan','6/8/2026',2,5,1,25,0,0,0,4,0,0,''],
  ['6/8/2026 20:36:59','Ahmed Mustafa','6/8/2026',2,5,1,30,0,0,0,0,0,0,''],
  ['6/8/2026 20:58:49','Fady Fawzy','6/8/2026',2,5,2,17,0,0,0,17,0,0,''],
  ['6/8/2026 21:25:20','Mariam Ahmed','6/8/2026',1,5,1,15,0,0,0,0,0,0,''],
  ['6/9/2026 0:03:57','Nourhan Ayman','6/8/2026',3,5,3,10,0,0,0,0,0,0,''],
  ['6/9/2026 0:04:07','Mohamed Sayed','6/8/2026',2,5,1,8,0,0,0,0,0,0,''],

  ['6/9/2026 20:12:27','Kareem Mohammed','6/9/2026',1,5,0,0,0,0,0,0,0,0,''],
  ['6/9/2026 20:12:42','Yasmine','6/9/2026',3,5,3,7,0,3,0,0,0,0,''],
  ['6/9/2026 20:13:04','Taher','6/9/2026',1,5,1,5,0,0,0,0,0,0,''],
  ['6/9/2026 20:14:50','Fady Fawzy','6/9/2026',0,5,1,13,0,0,0,13,0,0,''],
  ['6/9/2026 20:14:57','Mariam Ahmed','6/9/2026',1,5,1,8,1,0,1,1,0,0,''],
  ['6/9/2026 20:15:43','Ahmed Mustafa','6/9/2026',2,5,1,30,0,0,0,0,0,0,''],
  ['6/9/2026 20:43:37','Nourhan Ayman','6/9/2026',3,6,2,10,0,0,0,3,0,0,''],
  ['6/9/2026 20:44:22','Mohamed Sayed','6/9/2026',3,5,0,5,0,0,0,11,0,0,''],

  ['6/10/2026 19:55:43','Kareem Mohammed','6/10/2026',4,5,1,3,0,0,0,0,0,0,''],
  ['6/10/2026 20:05:24','Mohamed Shabaan','6/10/2026',7,5,1,6,1,0,1,1,0,0,''],
  ['6/10/2026 20:05:32','Nourhan Ayman','6/10/2026',6,5,1,20,0,0,0,5,0,0,''],
  ['6/10/2026 20:05:39','Taher','6/10/2026',4,5,2,4,0,0,0,0,0,0,''],
  ['6/10/2026 20:05:58','Amira','6/10/2026',6,5,4,2,0,0,0,0,0,0,''],
  ['6/10/2026 20:06:54','Fady Fawzy','6/10/2026',5,5,1,5,0,0,0,5,0,0,''],
  ['6/10/2026 20:10:56','Yasmine','6/10/2026',5,5,2,5,0,0,0,0,0,0,''],
  ['6/10/2026 20:12:00','Hadeer','6/10/2026',3,5,0,0,1,1,0,1,0,0,''],
  ['6/10/2026 21:44:34','Mohamed Sayed','6/10/2026',8,5,2,8,0,0,0,9,0,0,''],

  ['6/11/2026 20:02:32','Kareem Mohammed','6/11/2026',0,5,0,0,1,1,0,1,0,1,''],
  ['6/11/2026 20:11:05','Taher','6/11/2026',0,5,0,11,2,0,2,3,0,0,''],
  ['6/11/2026 20:13:52','Ahmed Mustafa','6/11/2026',1,5,0,20,0,0,0,0,0,0,''],
  ['6/11/2026 20:15:12','Fady Fawzy','6/11/2026',0,5,1,5,1,0,1,5,0,0,''],
  ['6/11/2026 20:22:37','Mariam Ahmed','6/11/2026',0,5,0,15,5,3,2,4,0,5,''],
  ['6/11/2026 20:32:28','Mohamed Shabaan','6/11/2026',2,5,0,6,3,3,0,3,0,0,''],
  ['6/11/2026 21:18:31','Hadeer','6/11/2026',0,5,5,0,5,4,1,5,0,5,''],
  ['6/11/2026 21:22:17','Nourhan Ayman','6/11/2026',2,5,2,0,1,0,1,1,0,0,''],
  ['6/11/2026 22:32:19','Mohamed Sayed','6/11/2026',3,5,2,4,2,2,0,2,2,0,''],

  ['6/13/2026 19:55:15','Fady Fawzy','6/13/2026',2,5,2,13,4,4,0,14,0,0,''],
  ['6/13/2026 19:56:52','Mohamed Shabaan','6/13/2026',2,5,0,10,2,2,0,2,0,0,''],
  ['6/13/2026 19:57:41','Yasmine','6/13/2026',2,5,2,2,0,0,0,8,0,0,''],
  ['6/13/2026 22:05:35','Mariam Ahmed','6/13/2026',0,5,0,15,8,5,3,8,0,0,''],
  ['6/13/2026 22:06:00','Mohamed Sayed','6/13/2026',2,5,4,7,1,1,1,8,1,0,''],
  ['6/13/2026 22:22:58','Nourhan Ayman','6/13/2026',2,5,2,15,1,1,0,2,0,0,''],

  ['6/14/2026 20:05:02','Mohamed Shabaan','6/14/2026',2,5,0,10,4,4,0,4,0,0,''],
  ['6/14/2026 20:09:10','Kareem Mohammed','6/14/2026',2,5,1,0,0,0,0,0,0,0,''],
  ['6/14/2026 20:49:13','Yasmine','6/14/2026',3,5,4,4,0,0,0,0,0,0,''],
  ['6/14/2026 20:59:08','Taher','6/14/2026',2,5,0,15,5,3,2,4,0,0,''],
  ['6/14/2026 21:51:58','Fady Fawzy','6/14/2026',3,5,5,9,8,6,2,9,0,0,''],
  ['6/14/2026 22:56:07','Nourhan Ayman','6/14/2026',3,5,5,10,0,0,0,0,0,0,''],
  ['6/15/2026 10:35:49','Mohamed Sayed','6/14/2026',5,5,3,20,2,2,0,20,2,0,''],

  ['6/15/2026 20:08:49','Kareem Mohammed','6/15/2026',0,5,1,13,2,1,1,1,0,0,''],
  ['6/15/2026 20:10:30','Yasmine','6/15/2026',2,5,3,6,2,2,0,6,0,0,''],
  ['6/15/2026 20:11:24','Shahd','6/15/2026',2,5,2,6,1,1,0,6,0,0,''],
  ['6/15/2026 20:13:18','Hadeer','6/15/2026',0,5,3,21,3,0,3,21,0,3,''],
  ['6/15/2026 20:20:57','Fady Fawzy','6/15/2026',1,5,3,18,3,3,0,18,0,0,''],
  ['6/15/2026 20:24:44','Taher','6/15/2026',0,5,0,15,3,3,0,5,0,0,''],

  ['6/16/2026 19:56:47','Fady Fawzy','6/16/2026',4,5,2,22,0,0,0,22,0,0,''],
  ['6/16/2026 20:03:43','Shahd','6/16/2026',4,5,4,8,0,0,0,12,0,0,''],
  ['6/16/2026 20:08:07','Yasmine','6/16/2026',4,5,3,5,0,0,0,10,0,0,''],
  ['6/16/2026 20:26:05','Taher','6/16/2026',1,5,0,27,1,1,0,1,0,0,''],
  ['6/16/2026 20:40:26','Nourhan Ayman','6/16/2026',3,5,1,20,1,1,0,3,0,0,''],
  ['6/16/2026 20:43:03','Mohamed Shabaan','6/16/2026',2,5,1,20,2,2,0,3,0,0,''],
  ['6/16/2026 20:59:15','Mohamed Sayed','6/16/2026',7,7,1,14,0,0,0,17,0,0,''],
  ['6/16/2026 20:59:41','Mariam Ahmed','6/16/2026',0,5,0,10,1,1,0,1,0,1,''],
]

// ── Helpers ────────────────────────────────────────────────────────────────

function extractDateStr(s) {
  s = String(s).trim()
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`
  const us = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (us) {
    const y = parseInt(us[3])
    if (y < 2000 || y > 2100) return null
    return `${us[3]}-${us[1].padStart(2,'0')}-${us[2].padStart(2,'0')}`
  }
  return null
}

function pad(n) { return String(n).padStart(2, '0') }

// week_number 1–4: which group-of-7 the Thursday falls in (capped at 4 for 5-Thursday months).
function weekNumberFromThursday(thursdayDayOfMonth) {
  return Math.min(4, Math.ceil(thursdayDayOfMonth / 7))
}

// Build the 5 Sun–Thu date strings for the week whose Thursday = thursdayStr
function buildWeekDates(thursdayStr) {
  const [y, m, d] = thursdayStr.split('-').map(Number)
  const thuUTC = Date.UTC(y, m - 1, d)
  const dates = []
  for (let i = 4; i >= 0; i--) {
    const dt = new Date(thuUTC - i * 86400000)
    dates.push(`${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`)
  }
  return dates
}

function buildWeeklyHTML(thursdayStr, weekDates, rawRows) {
  // Deduplicate per agent per day (latest submission wins)
  const byKey = {}
  for (const r of rawRows) {
    const ts = new Date(r[0]).getTime()
    const name = r[1]
    const dateKey = extractDateStr(r[2])
    if (!dateKey) continue
    const key = `${name}__${dateKey}`
    if (!byKey[key] || ts > byKey[key].ts) byKey[key] = { ts, r }
  }
  const deduped = Object.values(byKey).map(v => v.r)

  // Per-agent aggregation
  const stats = {}
  for (const agent of ALL_AGENTS) {
    stats[agent] = {
      sheets:0, posts:0, requests:0, followups:0,
      totalLeads:0, reached:0, notReached:0,
      crmAct:0, uploaded:0, notUploaded:0,
      submittedDays: new Set(), score:0,
    }
  }
  for (const r of deduped) {
    const s = stats[r[1]]
    if (!s) continue
    const dk = extractDateStr(r[2])
    if (dk) s.submittedDays.add(dk)
    s.sheets      += r[3]  || 0
    s.posts       += r[4]  || 0
    s.requests    += r[5]  || 0
    s.followups   += r[6]  || 0
    s.totalLeads  += r[7]  || 0
    s.reached     += r[8]  || 0
    s.notReached  += r[9]  || 0
    s.crmAct      += r[10] || 0
    s.uploaded    += r[11] || 0
    s.notUploaded += r[12] || 0
  }
  for (const a of ALL_AGENTS) {
    const s = stats[a]
    s.score = s.sheets + s.totalLeads + s.requests + s.followups
  }

  // Top performer
  let topAgent = '', topScore = 0
  for (const a of ALL_AGENTS) {
    if (stats[a].score > topScore) { topScore = stats[a].score; topAgent = a }
  }

  // Sort
  const sorted = [...ALL_AGENTS].sort((a, b) => stats[b].score - stats[a].score)

  // Agents who submitted at least one day vs. didn't submit at all
  const submittedAgents = ALL_AGENTS.filter(a => stats[a].submittedDays.size > 0)
  const missingAgents   = ALL_AGENTS.filter(a => stats[a].submittedDays.size === 0)

  // Attendance chips: perfect = submitted every required day (historical = no grace)
  const perfect = ALL_AGENTS.filter(a => weekDates.every(d => stats[a].submittedDays.has(d)))
  const missedAtt = ALL_AGENTS.filter(a => !perfect.includes(a))

  // Week label
  function fmtDay(key, withYear = false) {
    const [y, m, d] = key.split('-').map(Number)
    return new Date(Date.UTC(y, m-1, d)).toLocaleDateString('en-GB', {
      day: 'numeric', month: 'short', ...(withYear ? {year:'numeric'} : {}), timeZone: 'UTC',
    })
  }
  const weekLabel = `${fmtDay(weekDates[0])} – ${fmtDay(thursdayStr, true)}`

  // Team totals
  let tSheets=0, tPosts=0, tRequests=0, tFollowups=0, tLeads=0, tReached=0, tCrm=0, tNotUpl=0
  for (const a of ALL_AGENTS) {
    const s = stats[a]
    tSheets+=s.sheets; tPosts+=s.posts; tRequests+=s.requests; tFollowups+=s.followups
    tLeads+=s.totalLeads; tReached+=s.reached; tCrm+=s.crmAct; tNotUpl+=s.notUploaded
  }

  // Agent cards
  let agentRows = ''
  for (const agent of sorted) {
    const s = stats[agent]
    const isTop = agent === topAgent && topScore > 0
    const missedDays = weekDates.filter(d => !s.submittedDays.has(d))
    const missedLabels = missedDays.map(d => DAY_NAMES[new Date(d + 'T00:00:00Z').getUTCDay()])

    let attHTML
    if (missedDays.length === 0) {
      attHTML = `<div class="att-line ok-line">&#10003; Submitted all required days</div>`
    } else {
      attHTML = `<div class="att-line miss-line">&#10007; Missing: <strong>${missedLabels.join(', ')}</strong></div>`
    }

    const postStatus = s.posts >= 25 ? '<span class="badge-ok">&#10003;</span>' : '<span class="badge-warn">!</span>'
    const uplStatus  = s.notUploaded > 0 ? '<span class="badge-warn">!</span>' : '<span class="badge-ok">&#10003;</span>'
    const topBadge   = isTop ? `<span class="top-badge">&#127942; Top Performer</span>` : ''

    agentRows += `<div class="card agent-card${isTop ? ' top-card' : ''}">
      <div class="agent-header">
        <span class="agent-name">${agent}</span>
        ${topBadge}
      </div>
      <div class="days-line">&#128197; Days submitted: <strong class="accent">${s.submittedDays.size}/5</strong></div>
      ${attHTML}
      <div class="stats-grid">
        <div class="stat-box"><div class="stat-lbl">Cold Call Sheets</div><div class="stat-val">${s.sheets}</div></div>
        <div class="stat-box"><div class="stat-lbl">Organic Posts ${postStatus}</div><div class="stat-val">${s.posts}</div></div>
        <div class="stat-box"><div class="stat-lbl">New Requests</div><div class="stat-val">${s.requests}</div></div>
        <div class="stat-box"><div class="stat-lbl">Follow-Ups</div><div class="stat-val">${s.followups}</div></div>
        <div class="stat-box"><div class="stat-lbl">Total New Leads</div><div class="stat-val">${s.totalLeads}</div></div>
        <div class="stat-box"><div class="stat-lbl">Reached</div><div class="stat-val">${s.reached}</div></div>
        <div class="stat-box"><div class="stat-lbl">Not Reached</div><div class="stat-val">${s.notReached}</div></div>
        <div class="stat-box"><div class="stat-lbl">CRM Activities</div><div class="stat-val">${s.crmAct}</div></div>
        <div class="stat-box"><div class="stat-lbl">Calls Uploaded ${uplStatus}</div><div class="stat-val">${s.uploaded}</div></div>
        <div class="stat-box"><div class="stat-lbl">Not Uploaded</div><div class="stat-val" style="color:${s.notUploaded > 0 ? '#ff4444' : 'inherit'}">${s.notUploaded}</div></div>
      </div>
    </div>`
  }

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: 'Montserrat', Arial, sans-serif; background: #080808; color: #ffffff; padding: 28px; }
.accent { color: #D7FF00; }
.header { background: #0f0f0f; border: 1px solid rgba(215,255,0,0.18); border-radius: 14px; padding: 28px 32px; margin-bottom: 22px; text-align: center; }
.header h1 { font-size: 22px; font-weight: 800; color: #D7FF00; letter-spacing: 0.5px; }
.header p { font-size: 13px; color: rgba(255,255,255,0.5); margin-top: 6px; }
.card { background: #111111; border: 1px solid rgba(255,255,255,0.06); border-radius: 12px; padding: 20px; margin-bottom: 18px; }
.section-title { font-size: 13px; font-weight: 700; color: rgba(255,255,255,0.45); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 14px; }
.team-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
.team-stat { background: #191919; border-radius: 8px; padding: 14px 10px; text-align: center; border: 1px solid rgba(255,255,255,0.04); }
.team-stat .lbl { font-size: 10px; color: rgba(255,255,255,0.4); margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px; }
.team-stat .val { font-size: 26px; font-weight: 800; color: #D7FF00; }
.att-chips { display: flex; gap: 8px; flex-wrap: wrap; }
.chip { padding: 5px 13px; border-radius: 20px; font-size: 11px; font-weight: 700; }
.chip-ok   { background: rgba(215,255,0,0.1);  color: #D7FF00;  border: 1px solid rgba(215,255,0,0.25); }
.chip-miss { background: rgba(255,68,68,0.1);  color: #ff6b6b;  border: 1px solid rgba(255,68,68,0.25); }
.agent-card { }
.top-card { border-color: rgba(215,255,0,0.35); }
.agent-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; padding-bottom: 12px; border-bottom: 1px solid rgba(255,255,255,0.07); }
.agent-name { font-size: 16px; font-weight: 700; color: #ffffff; }
.top-badge { background: rgba(215,255,0,0.12); color: #D7FF00; font-size: 11px; font-weight: 700; padding: 4px 12px; border-radius: 20px; border: 1px solid rgba(215,255,0,0.3); }
.days-line { font-size: 12px; color: rgba(255,255,255,0.5); margin-bottom: 5px; }
.att-line { font-size: 12px; margin-bottom: 13px; }
.ok-line   { color: #D7FF00; }
.miss-line { color: #ff6b6b; }
.stats-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; }
.stat-box { background: #191919; border-radius: 8px; padding: 10px 8px; text-align: center; border: 1px solid rgba(255,255,255,0.04); }
.stat-lbl { font-size: 9px; color: rgba(255,255,255,0.4); margin-bottom: 5px; text-transform: uppercase; letter-spacing: 0.4px; }
.stat-val { font-size: 20px; font-weight: 800; color: #ffffff; }
.badge-ok   { display: inline-block; width: 14px; height: 14px; background: rgba(215,255,0,0.15); color: #D7FF00; border-radius: 50%; font-size: 9px; line-height: 14px; text-align: center; font-weight: 700; }
.badge-warn { display: inline-block; width: 14px; height: 14px; background: rgba(255,68,68,0.15); color: #ff6b6b; border-radius: 50%; font-size: 9px; line-height: 14px; text-align: center; font-weight: 700; }
.footer { text-align: center; font-size: 10px; color: rgba(255,255,255,0.2); margin-top: 28px; }
</style>
</head>
<body>
<div class="header">
  <h1>&#128202; Weekly Sales Report &mdash; The Gemini Lab</h1>
  <p>Week of ${weekLabel}</p>
</div>
<div class="card">
  <div class="section-title">&#127970; Team Totals This Week</div>
  <div class="team-grid">
    <div class="team-stat"><div class="lbl">Cold Call Sheets</div><div class="val">${tSheets}</div></div>
    <div class="team-stat"><div class="lbl">Organic Posts</div><div class="val">${tPosts}</div></div>
    <div class="team-stat"><div class="lbl">New Requests</div><div class="val">${tRequests}</div></div>
    <div class="team-stat"><div class="lbl">Follow-Ups</div><div class="val">${tFollowups}</div></div>
    <div class="team-stat"><div class="lbl">Total New Leads</div><div class="val">${tLeads}</div></div>
    <div class="team-stat"><div class="lbl">Reached</div><div class="val">${tReached}</div></div>
    <div class="team-stat"><div class="lbl">CRM Activities</div><div class="val">${tCrm}</div></div>
    <div class="team-stat"><div class="lbl">Missed Uploads</div><div class="val" style="color:${tNotUpl > 0 ? '#ff4444' : '#D7FF00'}">${tNotUpl}</div></div>
  </div>
</div>
<div class="card">
  <div class="section-title">&#128197; Weekly Attendance</div>
  <div class="att-chips">
    ${perfect.map(a => `<span class="chip chip-ok">${a} &#10003;</span>`).join('')}
    ${missedAtt.map(a => `<span class="chip chip-miss">${a} &#10007;</span>`).join('')}
  </div>
</div>
${agentRows}
<div class="footer">Generated automatically &mdash; The Gemini Lab Sales System</div>
</body>
</html>`

  return { html, weekLabel, topAgent, perfectCount: perfect.length, missedAgents: missedAtt }
}

async function upsertWeekly(thursdayStr, weekNumber, data) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/reports?on_conflict=company_id,type,report_date`,
    {
      method: 'POST',
      headers: {
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates',
      },
      body: JSON.stringify({
        company_id: COMPANY_ID,
        type: 'weekly',
        report_date: thursdayStr,
        week_number: weekNumber,
        data,
      }),
    }
  )
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Upsert failed for ${thursdayStr}: ${err}`)
  }
}

// ── Define weeks to seed ────────────────────────────────────────────────────
// Each week is identified by its Thursday date (the cron fire date).
// Only Sun–Thu dates are included; Fri–Sat are excluded.
//
// Calendar anchor: June 1, 2026 = Monday.
//   Week 1: Sun May 10 – Thu May 14  → report_date 2026-05-14, week_number 2
//   Week 2: Sun May 17 – Thu May 21  → report_date 2026-05-21, week_number 3
//   Week 3: Sun May 24 – Thu May 28  → report_date 2026-05-28, week_number 4
//   Week 4: Sun May 31 – Thu Jun 04  → report_date 2026-06-04, week_number 1
//   Week 5: Sun Jun 07 – Thu Jun 11  → report_date 2026-06-11, week_number 2
//   (Jun 14–18 is the current in-progress week; the live cron handles it Thursday night)
const THURSDAYS = [
  '2026-05-14',
  '2026-05-21',
  '2026-05-28',
  '2026-06-04',
  '2026-06-11',
]

async function main() {
  // Build a lookup: reportDate → [rawRow, ...]
  const byDate = {}
  for (const r of RAW) {
    const d = extractDateStr(r[2])
    if (!d) continue
    if (!byDate[d]) byDate[d] = []
    byDate[d].push(r)
  }

  for (const thursdayStr of THURSDAYS) {
    const weekDates = buildWeekDates(thursdayStr)
    const weekSet = new Set(weekDates)

    // Collect all raw rows whose report date falls in this week's Sun–Thu window
    const weekRows = []
    for (const d of weekDates) {
      if (byDate[d]) weekRows.push(...byDate[d])
    }

    if (weekRows.length === 0) {
      console.log(`⚠️  ${thursdayStr}: no submissions in window ${weekDates[0]}–${weekDates[4]}, skipping`)
      continue
    }

    const [, , tdStr] = thursdayStr.split('-')
    const weekNumber = weekNumberFromThursday(parseInt(tdStr, 10))

    const { html, weekLabel, topAgent, perfectCount, missedAgents } = buildWeeklyHTML(thursdayStr, weekDates, weekRows)
    await upsertWeekly(thursdayStr, weekNumber, { html, weekLabel, topAgent, perfectCount, missedAgents })
    console.log(`✅  ${thursdayStr} (W${weekNumber}) — "${weekLabel}" — ${perfectCount}/12 perfect, ${missedAgents.length} missed, top: ${topAgent || 'none'}`)
  }

  console.log('\nDone! All historical weekly reports seeded.')
}

main().catch(e => { console.error(e); process.exit(1) })
