// ═══════════════════════════════════════════
// CALENDAR & ZMANIM
// ═══════════════════════════════════════════
// Elevations (meters) – approximate, improves zmanim accuracy vs yeshiva.org.il
// Source: Israel mapping data
const CITIES = {
  petah_tikva: { name: 'פתח תקווה',  lat: 32.0833, lon: 34.8878, elev: 52  },
  jerusalem:   { name: 'ירושלים',    lat: 31.7683, lon: 35.2137, elev: 775 },
  tel_aviv:    { name: 'תל אביב',    lat: 32.0853, lon: 34.7818, elev: 5   },
  haifa:       { name: 'חיפה',       lat: 32.7940, lon: 34.9896, elev: 10  },
  beersheba:   { name: 'באר שבע',    lat: 31.2518, lon: 34.7915, elev: 285 },
  bnei_brak:   { name: 'בני ברק',    lat: 32.0841, lon: 34.8337, elev: 45  },
  rehovot:     { name: 'רחובות',     lat: 31.8928, lon: 34.8113, elev: 54  },
  ashdod:      { name: 'אשדוד',      lat: 31.8044, lon: 34.6553, elev: 30  },
  netanya:     { name: 'נתניה',      lat: 32.3215, lon: 34.8532, elev: 18  },
  modiin:      { name: 'מודיעין',    lat: 31.8969, lon: 35.0095, elev: 250 },
  raanana:     { name: 'רעננה',      lat: 32.1840, lon: 34.8706, elev: 45  },
  herzliya:    { name: 'הרצליה',     lat: 32.1663, lon: 34.8434, elev: 10  },
  kfar_saba:   { name: 'כפר סבא',   lat: 32.1787, lon: 34.9078, elev: 60  },
  safed:       { name: 'צפת',        lat: 32.9642, lon: 35.4960, elev: 900 },
  tiberias:    { name: 'טבריה',      lat: 32.7933, lon: 35.5311, elev: -210},
};

function setCity(cityKey) {
  if (cityKey === 'gps') {
    console.log('[Location] GPS selected, requesting...');
    if (navigator.geolocation) {
      document.getElementById('zmanim-location').textContent = '📍 מאתר מיקום...';
      navigator.geolocation.getCurrentPosition(
        pos => {
          userLat = pos.coords.latitude;
          userLon = pos.coords.longitude;
          userElev = Math.round(pos.coords.altitude || 0);
          console.log('[Location] GPS OK:', userLat, userLon, 'elev:', userElev);
          document.getElementById('zmanim-location').textContent = `📍 ${userLat.toFixed(3)}, ${userLon.toFixed(3)}`;
          appState.cityKey = 'gps'; appState.gpsLat = userLat; appState.gpsLon = userLon; appState.gpsElev = userElev; saveState();
          loadZmanim(formatDate(getTargetDate()));
        },
        err => {
          console.warn('[Location] GPS failed:', err.message);
          document.getElementById('zmanim-location').textContent = '⚠️ GPS נכשל, משתמש בפתח תקווה';
          document.getElementById('city-select').value = 'petah_tikva';
          setCity('petah_tikva');
        }
      );
    }
    return;
  }
  const city = CITIES[cityKey];
  if (!city) return;
  userLat = city.lat; userLon = city.lon; userElev = city.elev || 0;
  document.getElementById('zmanim-location').textContent = `📍 ${city.name}`;
  appState.cityKey = cityKey; saveState();
  console.log('[Location] set to', city.name, userLat, userLon, 'elev:', userElev);
  loadZmanim(formatDate(getTargetDate()));
}

async function loadCalendar() {
  const d = getTargetDate();
  const ds = formatDate(d);
  console.log('[loadCalendar] date:', ds, 'lat:', userLat, 'lon:', userLon);
  document.getElementById('cal-greg').textContent = formatDisplayDate(d);

  // Restore saved city
  const savedCity = appState.cityKey || 'petah_tikva';
  const sel = document.getElementById('city-select');
  if (sel) sel.value = savedCity;
  if (savedCity === 'gps' && appState.gpsLat) {
    userLat = appState.gpsLat; userLon = appState.gpsLon; userElev = appState.gpsElev || 0;
    document.getElementById('zmanim-location').textContent = `📍 ${userLat.toFixed(3)}, ${userLon.toFixed(3)}`;
  } else if (CITIES[savedCity]) {
    const c = CITIES[savedCity];
    userLat = c.lat; userLon = c.lon; userElev = c.elev || 0;
    document.getElementById('zmanim-location').textContent = `📍 ${c.name}`;
  }

  await loadHebrewDate();
  loadZmanim(ds);
  loadEvents(ds);
}

async function loadZmanim(ds) {
  if (!userLat || !userLon) return;
  console.log('[Zmanim] loading for', ds, userLat, userLon, 'elev:', userElev);
  const dateEl = document.getElementById('zmanim-date-display');
  const d = getTargetDate();
  if (dateEl) dateEl.textContent = `📅 טוען: ${formatDisplayDate(d)}...`;
  try {
    // elevation= improves accuracy vs yeshiva.org.il; sec=1 gives seconds precision
    const elev = Math.max(0, userElev || 0); // Hebcal requires non-negative elevation
    const url = `https://www.hebcal.com/zmanim?cfg=json&date=${ds}&sec=1&latitude=${userLat.toFixed(6)}&longitude=${userLon.toFixed(6)}&elevation=${elev}&tzid=Asia/Jerusalem`;
    const data = await fetchWithDelay(url, 300);
    const z = data?.times || {};
    console.log('[Zmanim] elevation used:', elev, 'm | all fields:', Object.keys(z).join(', '));
    function fmtT(iso) {
      if (!iso) return '--:--';
      return new Date(iso).toLocaleTimeString('he-IL', {hour:'2-digit',minute:'2-digit',hour12:false});
    }
    document.getElementById('z-alot').textContent        = fmtT(z.alotHaShachar);
    // misheyakir: ישיבה.org = 10.2° = הכרת פני חבירו ~50 דק' לפני הנץ
    // Hebcal returns misheyakir (11.5°) and misheyakir10Point2Degrees (10.2°)
    const misheVal = z.misheyakir || z.misheyakir10Point2Degrees;  // Hebcal misheyakir = 11.5° ≈ ישיבה.org
    document.getElementById('z-misheyakir').textContent = fmtT(misheVal);
    console.log('[Zmanim] misheyakir fields:', z.misheyakir, z.misheyakir10Point2Degrees);
    document.getElementById('z-sunrise').textContent     = fmtT(z.sunrise);
    // Exact Hebcal API field names (verified from official docs):
    // sofZmanShma = GRA, sofZmanShmaMGA = MGA
    // sofZmanTfilla = GRA, sofZmanTfillaMGA = MGA
    document.getElementById('z-shema-gra').textContent  = fmtT(z.sofZmanShma);
    document.getElementById('z-shema-mga').textContent  = fmtT(z.sofZmanShmaMGA);
    document.getElementById('z-tefila-gra').textContent = fmtT(z.sofZmanTfilla);
    document.getElementById('z-tefila-mga').textContent = fmtT(z.sofZmanTfillaMGA);
    document.getElementById('z-noon').textContent       = fmtT(z.chatzot);
    document.getElementById('z-mincha').textContent         = fmtT(z.minchaGedola);
    document.getElementById('z-mincha-ketana').textContent   = fmtT(z.minchaKetana);
    document.getElementById('z-plag').textContent            = fmtT(z.plagHaMincha);
    document.getElementById('z-sunset').textContent     = fmtT(z.sunset);
    // צאת הכוכבים: ישיבה.org = 3 כוכבים בינוניים = 13.5 דק' אחרי שקיעה
    // Hebcal: tzeit7083deg = 7.083° (≈16.5min) - קצת יותר מדי
    // נחשב ידנית שקיעה + 13.5 דקות
    const tzeitMs = z.sunset ? new Date(z.sunset).getTime() + 18*60000 : null;  // 18min = ישיבה.org standard
    const tzeitVal = tzeitMs ? new Date(tzeitMs).toISOString() : z.tzeit7083deg || z.tzeit85deg;
    document.getElementById('z-tzeit').textContent = fmtT(tzeitVal);
    console.log('[Zmanim] tzeit=sunset+13.5min:', fmtT(tzeitVal));
    console.log('[Zmanim] GRA shema:', z.sofZmanShma, '| GRA tfilla:', z.sofZmanTfilla, '| all keys:', Object.keys(z).join(','));
    // Cache for auto-reminders
    appState._lastZmanim = z;
    saveState();
    scheduleZmanimRemindersForToday();

    // ── Special day zmanim ──────────────────────────────────────────
    const specialRows = document.getElementById('z-special-rows');
    if (specialRows) {
      const specials = [];
      // Erev Pesach chametz times
      // Hebcal API field names: sofZmanAchilatChametz, sofZmanBiurChametz
      // These only appear on 14 Nisan (Erev Pesach)
      if (z.sofZmanAchilatChametz) {
        specials.push({ label: '⏰ סוף זמן אכילת חמץ', time: z.sofZmanAchilatChametz });
      }
      if (z.sofZmanBiurChametz) {
        specials.push({ label: '🔥 סוף זמן ביעור חמץ', time: z.sofZmanBiurChametz });
      }

      // Also check alternative field names (Hebcal API versions vary)
      const altAchila = z['sofZmanAchilatChametzGRA'] || z['sofZmanAchilatChametzMGA'];
      const altBiur   = z['sofZmanBiurChametzGRA'] || z['sofZmanBiurChametzMGA'];
      if (!z.sofZmanAchilatChametz && altAchila) {
        specials.push({ label: '⏰ סוף זמן אכילת חמץ', time: altAchila });
      }
      if (!z.sofZmanBiurChametz && altBiur) {
        specials.push({ label: '🔥 סוף זמן ביעור חמץ', time: altBiur });
      }

      // Log all z fields for debugging chametz detection
      console.log('[Zmanim] all fields:', Object.keys(z).join(', '));
      const chametzFields = Object.keys(z).filter(k => /chametz|biur|achila/i.test(k));
      if (chametzFields.length) console.log('[Zmanim] chametz fields:', chametzFields, chametzFields.map(k=>z[k]));

      // If still no chametz times, check if this date is Erev Pesach from Hebrew date
      // 14 Nisan = Erev Pesach → compute times from Hebcal zmanim
      if (!specials.length && appState._lastHebrewDate) {
        const hd = appState._lastHebrewDate;
        if (hd.hm === 'Nisan' && hd.hd === 14 && z.sunrise && z.sunset) {
          // GRA shaot zmaniyot: day = sunrise to sunset, divide by 12
          // Sof zman achilat chametz = end of 4th shaah zmanit = sofZmanTfilla
          // Sof zman biur chametz = end of 5th shaah zmanit
          const sunriseMs = new Date(z.sunrise).getTime();
          const sunsetMs  = new Date(z.sunset).getTime();
          const shaaZmanit = (sunsetMs - sunriseMs) / 12;

          // Use sofZmanTfilla if available (it's exactly 4 shaot after sunrise)
          const achilaMsGRA = z.sofZmanTfilla
            ? new Date(z.sofZmanTfilla).getTime()
            : sunriseMs + shaaZmanit * 4;
          const biurMsGRA = sunriseMs + shaaZmanit * 5;

          specials.push({ label: '⏰ סוף זמן אכילת חמץ (גר"א)', time: new Date(achilaMsGRA).toISOString() });
          specials.push({ label: '🔥 סוף זמן ביעור חמץ (גר"א)', time: new Date(biurMsGRA).toISOString() });
          console.log('[Zmanim] computed chametz times for 14 Nisan: achila=', fmtT(new Date(achilaMsGRA).toISOString()), 'biur=', fmtT(new Date(biurMsGRA).toISOString()));
        }
      }

      if (specials.length) {
        specialRows.innerHTML = `<div style="margin:6px 0 2px;font-size:10px;font-weight:700;color:var(--gold);font-family:'Heebo',sans-serif;letter-spacing:.3px">ערב פסח</div>` +
          specials.map(s =>
            `<div class="zman-item" style="background:rgba(201,165,74,.06)">
              <div class="label" style="color:var(--gold)">${s.label}</div>
              <div class="time" style="color:var(--gold)">${fmtT(s.time)}</div>
            </div>`
          ).join('');
      } else {
        specialRows.innerHTML = '';
      }
    }

    // candle lighting
    const evData = await fetchWithDelay(
      `https://www.hebcal.com/hebcal?v=1&cfg=json&maj=on&min=on&nx=on&start=${ds}&end=${ds}&c=on&geo=pos&latitude=${userLat.toFixed(6)}&longitude=${userLon.toFixed(6)}&elevation=${elev}&tzid=Asia/Jerusalem&i=1&b=18&m=42`, 400
    );
    const candles  = (evData?.items || []).find(e => e.category === 'candles');
    const havdalah = (evData?.items || []).find(e => e.category === 'havdalah');
    document.getElementById('z-candles').textContent = candles ? fmtT(candles.date) : '--:--';
    const havdalahRow = document.getElementById('z-havdalah-row');
    if (havdalah && havdalahRow) {
      document.getElementById('z-havdalah').textContent = fmtT(havdalah.date);
      havdalahRow.style.display = '';
    } else if (havdalahRow) {
      havdalahRow.style.display = 'none';
    }
    // Update date display with Hebrew date
    try {
      const conv = await fetchWithDelay(`https://www.hebcal.com/converter?cfg=json&date=${ds}&g2h=1&strict=1`, 200);
      if (dateEl) dateEl.textContent = `📅 ${formatDisplayDate(d)} | ${conv.hebrew || ''}`;
    } catch {}
  } catch(e) {
    console.error('[Zmanim] error:', e);
    if (dateEl) dateEl.textContent = `⚠️ שגיאה: ${e.message}`;
  }
}

async function loadEvents(ds) {
  const banner = document.getElementById('special-event-banner');
  const list   = document.getElementById('events-list');
  try {
    const data = await fetchWithDelay(
      `https://www.hebcal.com/hebcal?v=1&cfg=json&maj=on&min=on&nx=on&mf=on&ss=on&start=${ds}&end=${ds}&c=off&i=1`, 300
    );
    const items = (data?.items || []).filter(e => e.category !== 'candles' && e.category !== 'havdalah');
    if (!items.length) {
      list.innerHTML = '<div style="color:var(--muted);font-size:13px;padding:8px 0">אין אירועים מיוחדים</div>';
      return;
    }
    // banner for major holiday
    const major = items.find(e => e.yomtov || e.category === 'holiday');
    if (major) {
      const icon = holidayIcon(major.title);
      banner.innerHTML = `<div class="special-banner"><div class="sb-icon">${icon}</div><div><div class="sb-text">${major.hebrew || major.title}</div><div class="sb-sub">יום טוב</div></div></div>`;
    }
    list.innerHTML = items.map(e => `
      <div class="event-item">
        <div class="event-icon">${holidayIcon(e.title)}</div>
        <div>
          <div class="event-title">${e.hebrew || e.title}</div>
          <div class="event-sub">${e.title}${e.date ? ' · '+e.date : ''}</div>
        </div>
      </div>`).join('');

    // ── Fast day times: fetch with candles=on to get fast begin/end ──
    const isFastDay = items.some(e => /fast|צום|tisha|asara|tzom|17.tam/i.test(e.title || ''));
    if (isFastDay) {
      try {
        const elev = Math.max(0, userElev || 0);
        const fastData = await fetchWithDelay(
          `https://www.hebcal.com/hebcal?v=1&cfg=json&maj=on&min=on&nx=on&mf=on&ss=on&start=${ds}&end=${ds}&c=on&geo=pos&latitude=${userLat.toFixed(6)}&longitude=${userLon.toFixed(6)}&elevation=${elev}&tzid=Asia/Jerusalem&i=1&b=18&m=42`, 300
        );
        const fastItems = fastData?.items || [];
        const fastBegin = fastItems.find(e => /fast.begins|begins/i.test(e.title));
        const fastEnd   = fastItems.find(e => /fast.ends|ends/i.test(e.title));
        const specialRows = document.getElementById('z-special-rows');
        if (specialRows && (fastBegin || fastEnd)) {
          function fmtT(iso) {
            if (!iso) return '--:--';
            return new Date(iso).toLocaleTimeString('he-IL', {hour:'2-digit',minute:'2-digit',hour12:false});
          }
          let fastHtml = specialRows.innerHTML;
          if (fastBegin) fastHtml += `<div class="zman-item" style="border-top:1px solid rgba(201,165,74,.2);margin-top:4px"><div class="label" style="color:var(--gold)">🙏 תחילת הצום</div><div class="time" style="color:var(--gold)">${fmtT(fastBegin.date)}</div></div>`;
          if (fastEnd)   fastHtml += `<div class="zman-item"><div class="label" style="color:var(--gold)">✅ סיום הצום</div><div class="time" style="color:var(--gold)">${fmtT(fastEnd.date)}</div></div>`;
          specialRows.innerHTML = fastHtml;
        }
      } catch(e) { console.warn('[Events] fast times fetch failed:', e.message); }
    }

    // Save events for siddur conditional logic
    storeTodayEventsForSiddur(items);
    console.log('[Events] saved', items.length, 'events for siddur');
  } catch(e) {
    list.innerHTML = '<div style="color:var(--muted);font-size:13px">לא ניתן לטעון</div>';
  }
}

function holidayIcon(title) {
  const t = (title||'').toLowerCase();
  if (t.includes('shabbat') || t.includes('שבת')) return '🕯️';
  if (t.includes('rosh hashana') || t.includes('ראש השנה')) return '🍎';
  if (t.includes('yom kippur') || t.includes('כיפור')) return '📿';
  if (t.includes('sukkot') || t.includes('סוכות')) return '🌿';
  if (t.includes('chanukah') || t.includes('חנוכה')) return '🕎';
  if (t.includes('purim') || t.includes('פורים')) return '🎭';
  if (t.includes('pesach') || t.includes('פסח')) return '🫓';
  if (t.includes('shavuot') || t.includes('שבועות')) return '📖';
  if (t.includes('fast') || t.includes('צום') || t.includes('tisha')) return '🙏';
  if (t.includes('rosh chodesh') || t.includes('ראש חודש')) return '🌙';
  if (t.includes('omer') || t.includes('עומר')) return '✡️';
  return '📅';
}
