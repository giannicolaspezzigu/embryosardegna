(function () {
  const app = (window.EmbryoApp = window.EmbryoApp || {});

  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  const DAYS_PER_DECIMAL_MONTH = 30;
  const LEFT_BUCKETS = [1, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6, 6.5, 7, 8];
  const RIGHT_BUCKETS = [1, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6, 6.5, 7, 7.5];
  const LEFT_COLUMNS = ["I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U"];
  const RIGHT_COLUMNS = ["W", "X", "Y", "Z", "AA", "AB", "AC", "AD", "AE", "AF", "AG", "AH", "AI"];
  const FIRST_DYNAMIC_COLUMN_INDEX = 40;
  const CL_COLUMN_WIDTH = 10.6328125;
  const OVULATION_COUNT_COLUMN_WIDTH = 12.6328125;
  const COLUMN_WIDTHS = [
    4.453125,
    26.6328125,
    16.6328125,
    27.6328125,
    13.6328125,
    10.6328125,
    16.6328125,
    12.6328125,
    8.81640625,
    8.81640625,
    8.81640625,
    8.81640625,
    8.81640625,
    8.81640625,
    8.81640625,
    8.81640625,
    8.81640625,
    8.81640625,
    8.81640625,
    8.81640625,
    8.81640625,
    12.6328125,
    8.81640625,
    8.81640625,
    8.81640625,
    8.81640625,
    8.81640625,
    8.81640625,
    8.81640625,
    8.81640625,
    8.81640625,
    8.81640625,
    8.81640625,
    8.81640625,
    8.81640625,
    10.6328125,
    10.6328125,
    10.6328125,
    10.6328125,
  ];

  const STYLES = createStyleMap();

  function createStyleMap() {
    const thinBorder = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" },
    };

    function base(fillArgb) {
      return {
        font: {
          name: "Aptos Narrow",
          size: 11,
        },
        fill: {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: fillArgb },
        },
        border: thinBorder,
        alignment: {
          horizontal: "center",
          vertical: "middle",
        },
      };
    }

    function withFont(style, size, bold, wrapText) {
      const next = cloneStyle(style);
      next.font.size = size;
      next.font.bold = Boolean(bold);
      if (wrapText) {
        next.alignment.wrapText = true;
      }
      return next;
    }

    const paleYellow = "FFFFFF99";
    const paleYellowSoft = "FFFFFFCC";
    const leftBlue = "FF83CBEB";
    const leftBlueSoft = "FFC1E5F5";
    const rightPink = "FFF2AA84";
    const rightPinkSoft = "FFE59EDD";
    const mediumYellow = "FFFFE699";
    const mediumYellowSoft = "FFFFF2CC";
    const totalGreen = "FF8ED973";
    const totalGreenSoft = "FFB4E5A2";

    return {
      row1Index: withFont(base(paleYellowSoft), 16, true, false),
      row1Header: withFont(base(paleYellowSoft), 14, true, false),
      row1Date: withFont(base(paleYellowSoft), 16, true, false),
      row1HeaderWrapped: withFont(base(paleYellowSoft), 14, true, true),
      row1DateWrapped: withFont(base(paleYellowSoft), 14, true, true),
      row1LeftGroup: withFont(base(leftBlue), 11, true, false),
      row1RightGroup: withFont(base(rightPink), 11, true, false),
      row2Index: withFont(base(paleYellow), 16, true, false),
      row2Header: withFont(base(paleYellow), 14, true, false),
      row2Date: base(paleYellow),
      row2Wrapped: withFont(base(paleYellow), 11, true, true),
      row2Side: withFont(base(paleYellow), 11, true, false),
      row2LeftSmall: withFont(base(leftBlue), 11, true, true),
      row2LeftMedium: withFont(base(mediumYellow), 11, true, true),
      row2LeftLarge: withFont(base(rightPinkSoft), 11, true, true),
      row2Totals: withFont(base(totalGreen), 11, true, true),
      dataIndex: withFont(base(paleYellowSoft), 16, true, false),
      dataId: withFont(base(paleYellowSoft), 14, true, false),
      dataDate: Object.assign(base(paleYellowSoft), {
        numFmt: "dd/mm/yyyy hh:mm",
      }),
      dataText: base(paleYellowSoft),
      dataAgeMonths: Object.assign(base(paleYellowSoft), {
        numFmt: "0.0",
      }),
      dataLeftSmall: base(leftBlueSoft),
      dataLeftMedium: base(mediumYellowSoft),
      dataLeftLarge: base(rightPinkSoft),
      dataTotals: base(totalGreenSoft),
      dataBirthDate: Object.assign(base(totalGreenSoft), {
        numFmt: "dd/mm/yyyy",
      }),
    };
  }

  function cloneStyle(style) {
    return JSON.parse(JSON.stringify(style));
  }

  function escapeHtml(value) {
    return String(value === null || value === undefined ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function setCell(worksheet, address, value, style) {
    const cell = worksheet.getCell(address);
    cell.value = value;
    if (style) {
      cell.style = cloneStyle(style);
    }
    return cell;
  }

  function setBlankStyledCell(worksheet, address, style) {
    setCell(worksheet, address, "", style);
  }

  function columnNameFromNumber(index) {
    let columnName = "";
    let currentIndex = Number(index);

    while (currentIndex > 0) {
      const remainder = (currentIndex - 1) % 26;
      columnName = String.fromCharCode(65 + remainder) + columnName;
      currentIndex = Math.floor((currentIndex - 1) / 26);
    }

    return columnName;
  }

  function normalizeExportSize(size, buckets) {
    const numericSize = Number(size);

    if (!Number.isFinite(numericSize)) {
      return null;
    }

    const rounded = Math.round(numericSize * 2) / 2;
    let bestBucket = buckets[0];
    let bestDistance = Number.POSITIVE_INFINITY;

    for (let index = 0; index < buckets.length; index += 1) {
      const bucket = buckets[index];
      const distance = Math.abs(bucket - rounded);

      if (distance < bestDistance || (distance === bestDistance && bucket > bestBucket)) {
        bestBucket = bucket;
        bestDistance = distance;
      }
    }

    return bestBucket;
  }

  function sizeLabel(size) {
    const normalized = Number(size);

    if (!Number.isFinite(normalized)) {
      return "";
    }

    const raw = Number.isInteger(normalized) ? String(normalized) : String(normalized).replace(".", ",");
    return `F${raw}`;
  }

  function getDisplayAnimalId(animal) {
    return animal.earTag || animal.animalCode || animal.displayName || animal.id || "";
  }

  function getRecordSessionId(record) {
    return (record && record.sessionId) || app.domain.modelUtils.UNASSIGNED_SESSION_ID;
  }

  function getPostPartumDays(animal, visit) {
    const calculatedPostPartumDays = calculateDaysAtVisit(animal && animal.lastParturitionDate, visit && visit.visitAt);

    if (calculatedPostPartumDays !== "") {
      return calculatedPostPartumDays;
    }

    const sources = [
      visit && visit.protocolContext && visit.protocolContext.daysPostPartum,
      visit && visit.protocolContext && visit.protocolContext.daysPostpartum,
      visit && visit.extensions && visit.extensions.daysPostPartum,
      visit && visit.extensions && visit.extensions.daysPostpartum,
      visit && visit.research && visit.research.daysPostPartum,
      animal && animal.speciesData && animal.speciesData.bovine && animal.speciesData.bovine.postpartumDays,
      animal && animal.extensions && animal.extensions.postpartumDays,
    ];

    for (let index = 0; index < sources.length; index += 1) {
      const value = sources[index];
      if (value !== undefined && value !== null && value !== "") {
        return value;
      }
    }

    return "";
  }

  function parseVisitDateTimeForExcel(isoValue) {
    const raw = String(isoValue || "");
    const dateOnlyMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);

    if (dateOnlyMatch) {
      return new Date(Date.UTC(Number(dateOnlyMatch[1]), Number(dateOnlyMatch[2]) - 1, Number(dateOnlyMatch[3]), 12, 0, 0));
    }

    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) {
      return "";
    }

    return new Date(
      Date.UTC(
        parsed.getFullYear(),
        parsed.getMonth(),
        parsed.getDate(),
        parsed.getHours(),
        parsed.getMinutes(),
        parsed.getSeconds()
      )
    );
  }

  function parseDateForExcel(value) {
    const raw = String(value || "").trim();
    const dateOnlyMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);

    if (dateOnlyMatch) {
      return new Date(Date.UTC(Number(dateOnlyMatch[1]), Number(dateOnlyMatch[2]) - 1, Number(dateOnlyMatch[3]), 12, 0, 0));
    }

    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) {
      return "";
    }

    return new Date(Date.UTC(parsed.getFullYear(), parsed.getMonth(), parsed.getDate(), 12, 0, 0));
  }

  function getLocalDateParts(value, preferDatePrefix) {
    const raw = String(value || "").trim();

    if (preferDatePrefix) {
      const dateOnlyMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (dateOnlyMatch) {
        return {
          year: Number(dateOnlyMatch[1]),
          month: Number(dateOnlyMatch[2]),
          day: Number(dateOnlyMatch[3]),
        };
      }
    }

    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) {
      return null;
    }

    return {
      year: parsed.getFullYear(),
      month: parsed.getMonth() + 1,
      day: parsed.getDate(),
    };
  }

  function toUtcDateOnly(parts) {
    return new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  }

  function getDaysInMonth(year, month) {
    return new Date(Date.UTC(year, month, 0)).getUTCDate();
  }

  function addMonthsClamped(parts, monthOffset) {
    const targetMonthStart = new Date(Date.UTC(parts.year, parts.month - 1 + monthOffset, 1));
    const year = targetMonthStart.getUTCFullYear();
    const month = targetMonthStart.getUTCMonth() + 1;

    return {
      year,
      month,
      day: Math.min(parts.day, getDaysInMonth(year, month)),
    };
  }

  function calculateAgeMonthsAtVisit(birthDate, visitAt) {
    const birth = getLocalDateParts(birthDate, true);
    const visit = getLocalDateParts(visitAt, false);

    if (!birth || !visit) {
      return "";
    }

    const birthDateOnly = toUtcDateOnly(birth);
    const visitDateOnly = toUtcDateOnly(visit);

    if (visitDateOnly.getTime() < birthDateOnly.getTime()) {
      return "";
    }

    let months = (visit.year - birth.year) * 12 + (visit.month - birth.month);
    let monthAnchor = addMonthsClamped(birth, months);

    if (toUtcDateOnly(monthAnchor).getTime() > visitDateOnly.getTime()) {
      months -= 1;
      monthAnchor = addMonthsClamped(birth, months);
    }

    if (months < 0) {
      return "";
    }

    const extraDays = Math.max(0, Math.round((visitDateOnly.getTime() - toUtcDateOnly(monthAnchor).getTime()) / MS_PER_DAY));
    const decimalMonths = months + extraDays / DAYS_PER_DECIMAL_MONTH;

    return Number(decimalMonths.toFixed(1));
  }

  function calculateDaysAtVisit(startDate, visitAt) {
    const start = getLocalDateParts(startDate, true);
    const visit = getLocalDateParts(visitAt, false);

    if (!start || !visit) {
      return "";
    }

    const diffMs = toUtcDateOnly(visit).getTime() - toUtcDateOnly(start).getTime();

    if (diffMs < 0) {
      return "";
    }

    return Math.round(diffMs / MS_PER_DAY);
  }

  function parseDateFilter(value, endOfDay) {
    if (!value) {
      return null;
    }

    const timePart = endOfDay ? "T23:59:59.999" : "T00:00:00.000";
    const date = new Date(`${value}${timePart}`);

    return Number.isNaN(date.getTime()) ? null : date.getTime();
  }

  function getSideStructures(visit, sideKey) {
    const ovaries = visit && visit.ovaries ? visit.ovaries : {};
    const side = ovaries[sideKey] || {};
    return Array.isArray(side.structures) ? side.structures : [];
  }

  function getSideCounts(visit, sideKey) {
    const ovaries = visit && visit.ovaries ? visit.ovaries : {};
    const side = ovaries[sideKey] || {};
    return side.counts || {};
  }

  function isFollicleStructure(structure) {
    return structure && (structure.type === "fol" || structure.type === "follicle");
  }

  function isCorpusLuteumStructure(structure) {
    return structure && (structure.type === "cl" || structure.type === "corpus_luteum");
  }

  function isOvulationStructure(structure) {
    return structure && (structure.type === "ov" || structure.type === "ovulation");
  }

  function isCystStructure(structure) {
    return structure && structure.type === "cyst";
  }

  function buildBucketMap(buckets) {
    return buckets.reduce((accumulator, bucket) => {
      accumulator[bucket] = 0;
      return accumulator;
    }, {});
  }

  function buildSideBucketCounts(visit, sideKey, buckets) {
    const result = buildBucketMap(buckets);
    const structures = getSideStructures(visit, sideKey);

    for (let index = 0; index < structures.length; index += 1) {
      const structure = structures[index];

      if (!isFollicleStructure(structure)) {
        continue;
      }

      const bucket = normalizeExportSize(structure.sizeMm || structure.size, buckets);

      if (bucket === null || result[bucket] === undefined) {
        continue;
      }

      result[bucket] += 1;
    }

    return result;
  }

  function getCorpusLuteumArea(structure) {
    const value =
      structure && structure.clAreaMm2 !== undefined && structure.clAreaMm2 !== null
        ? structure.clAreaMm2
        : structure && structure.clSurf !== undefined && structure.clSurf !== null
          ? structure.clSurf
          : "";
    const numericValue = Number(value);

    return Number.isFinite(numericValue) ? numericValue : "";
  }

  function buildSideCorpusLuteumAreas(visit, sideKey) {
    const structures = getSideStructures(visit, sideKey);
    const sideCounts = getSideCounts(visit, sideKey);
    const areas = [];

    for (let index = 0; index < structures.length; index += 1) {
      const structure = structures[index];

      if (isCorpusLuteumStructure(structure)) {
        areas.push(getCorpusLuteumArea(structure));
      }
    }

    const targetCount = Math.max(areas.length, Number(sideCounts.corporaLutea) || 0);

    while (areas.length < targetCount) {
      areas.push("");
    }

    return areas;
  }

  function buildCorpusLuteumAreas(visit) {
    const ovaries = visit && visit.ovaries ? visit.ovaries : {};
    const totalCounts = ovaries.total || {};
    const areas = buildSideCorpusLuteumAreas(visit, "left").concat(buildSideCorpusLuteumAreas(visit, "right"));
    const targetCount = Math.max(areas.length, Number(totalCounts.corporaLutea) || 0);

    while (areas.length < targetCount) {
      areas.push("");
    }

    return areas;
  }

  function countSideOvulations(visit, sideKey) {
    const structures = getSideStructures(visit, sideKey);
    const sideCounts = getSideCounts(visit, sideKey);
    let structureCount = 0;

    for (let index = 0; index < structures.length; index += 1) {
      if (isOvulationStructure(structures[index])) {
        structureCount += 1;
      }
    }

    return Math.max(structureCount, Number(sideCounts.ovulations) || 0);
  }

  function countVisitOvulations(visit) {
    const ovaries = visit && visit.ovaries ? visit.ovaries : {};
    const totalCounts = ovaries.total || {};
    const sideTotal = countSideOvulations(visit, "left") + countSideOvulations(visit, "right");

    return Math.max(sideTotal, Number(totalCounts.ovulations) || 0);
  }

  function buildSideSummary(visit, sideKey, buckets) {
    const structures = getSideStructures(visit, sideKey);
    const sideCounts = getSideCounts(visit, sideKey);

    if (
      !structures.length &&
      !(Number(sideCounts.totalFollicles) || Number(sideCounts.corporaLutea) || Number(sideCounts.ovulations) || Number(sideCounts.cysts))
    ) {
      return "/";
    }

    const follicleCounts = buildBucketMap(buckets);
    let clCount = 0;
    let cavitaryClCount = 0;
    let ovulationCount = 0;
    let cystCount = 0;

    for (let index = 0; index < structures.length; index += 1) {
      const structure = structures[index];

      if (isFollicleStructure(structure)) {
        const bucket = normalizeExportSize(structure.sizeMm || structure.size, buckets);
        if (bucket !== null && follicleCounts[bucket] !== undefined) {
          follicleCounts[bucket] += 1;
        }
        continue;
      }

      if (isCorpusLuteumStructure(structure)) {
        if (structure.isCavitary) {
          cavitaryClCount += 1;
        } else {
          clCount += 1;
        }
        continue;
      }

      if (isOvulationStructure(structure)) {
        ovulationCount += 1;
        continue;
      }

      if (isCystStructure(structure)) {
        cystCount += 1;
      }
    }

    clCount = Math.max(clCount, Number(sideCounts.corporaLutea) || 0);
    ovulationCount = Math.max(ovulationCount, Number(sideCounts.ovulations) || 0);
    cystCount = Math.max(cystCount, Number(sideCounts.cysts) || 0);

    const parts = [];

    if (cavitaryClCount) {
      parts.push(cavitaryClCount > 1 ? `${cavitaryClCount}CL cavitario` : "CL cavitario");
    }

    if (clCount) {
      parts.push(clCount > 1 ? `${clCount}CL` : "CL");
    }

    if (ovulationCount) {
      parts.push(ovulationCount > 1 ? `${ovulationCount}OV` : "OV");
    }

    if (cystCount) {
      parts.push(cystCount > 1 ? `${cystCount}Cisti` : "Cisti");
    }

    const bucketEntries = Object.keys(follicleCounts)
      .map((key) => Number(key))
      .filter((key) => follicleCounts[key] > 0)
      .sort((left, right) => right - left);

    for (let index = 0; index < bucketEntries.length; index += 1) {
      const bucket = bucketEntries[index];
      const count = follicleCounts[bucket];
      parts.push(count > 1 ? `${count}${sizeLabel(bucket)}` : sizeLabel(bucket));
    }

    return parts.join(" ") || "/";
  }

  function countMapToArray(countMap, buckets) {
    return buckets.map((bucket) => countMap[bucket] || 0);
  }

  function sumValues(values) {
    return values.reduce((accumulator, value) => accumulator + Number(value || 0), 0);
  }

  function sumClassColumns(counts) {
    return {
      small: sumValues(counts.slice(0, 3)),
      medium: sumValues(counts.slice(3, 8)),
      large: sumValues(counts.slice(8)),
    };
  }

  function getFollicleClassStyle(index, smallStyle, mediumStyle, largeStyle) {
    if (index < 3) {
      return smallStyle;
    }

    if (index < 8) {
      return mediumStyle;
    }

    return largeStyle;
  }

  function buildVisitExportRecord(animal, visit) {
    const leftCountsMap = buildSideBucketCounts(visit, "left", LEFT_BUCKETS);
    const rightCountsMap = buildSideBucketCounts(visit, "right", RIGHT_BUCKETS);
    const leftCounts = countMapToArray(leftCountsMap, LEFT_BUCKETS);
    const rightCounts = countMapToArray(rightCountsMap, RIGHT_BUCKETS);
    const leftClassCounts = sumClassColumns(leftCounts);
    const rightClassCounts = sumClassColumns(rightCounts);
    const totalFollicles = sumValues(leftCounts) + sumValues(rightCounts);
    const smallFollicles = leftClassCounts.small + rightClassCounts.small;
    const mediumFollicles = leftClassCounts.medium + rightClassCounts.medium;
    const largeFollicles = leftClassCounts.large + rightClassCounts.large;
    const ovulationCount = countVisitOvulations(visit);

    return {
      animalId: getDisplayAnimalId(animal),
      birthDate: parseDateForExcel(animal && animal.birthDate),
      ageMonthsAtVisit: calculateAgeMonthsAtVisit(animal && animal.birthDate, visit && visit.visitAt),
      animalBodyConditionScore:
        animal && animal.bodyConditionScore !== null && animal.bodyConditionScore !== undefined ? animal.bodyConditionScore : "",
      visitDateTime: parseVisitDateTimeForExcel(visit.visitAt),
      postPartumDays: getPostPartumDays(animal, visit),
      leftSummary: buildSideSummary(visit, "left", LEFT_BUCKETS),
      rightSummary: buildSideSummary(visit, "right", RIGHT_BUCKETS),
      leftCounts,
      rightCounts,
      totalFollicles,
      smallFollicles,
      mediumFollicles,
      largeFollicles,
      corpusLuteumAreas: buildCorpusLuteumAreas(visit),
      ovulationCount: ovulationCount || "",
    };
  }

  function formulaForColumns(columns, rowNumber) {
    return columns.map((column) => `${column}${rowNumber}`).join("+");
  }

  function buildExportLayout(groups) {
    let maxCorpusLuteaCount = 0;

    (groups || []).forEach((group) => {
      (group.visits || []).forEach((record) => {
        maxCorpusLuteaCount = Math.max(maxCorpusLuteaCount, (record.corpusLuteumAreas || []).length);
      });
    });

    const clColumns = [];

    for (let index = 0; index < maxCorpusLuteaCount; index += 1) {
      clColumns.push(columnNameFromNumber(FIRST_DYNAMIC_COLUMN_INDEX + index));
    }

    return {
      clColumns,
      ovulationCountColumn: columnNameFromNumber(FIRST_DYNAMIC_COLUMN_INDEX + clColumns.length),
    };
  }

  function applyDynamicColumnWidths(worksheet, layout) {
    const exportLayout = layout || buildExportLayout([]);

    exportLayout.clColumns.forEach((_, index) => {
      worksheet.getColumn(FIRST_DYNAMIC_COLUMN_INDEX + index).width = CL_COLUMN_WIDTH;
    });
    worksheet.getColumn(FIRST_DYNAMIC_COLUMN_INDEX + exportLayout.clColumns.length).width = OVULATION_COUNT_COLUMN_WIDTH;
  }

  function writeHeaderRows(worksheet, layout) {
    const exportLayout = layout || buildExportLayout([]);

    worksheet.properties.defaultRowHeight = 21;
    worksheet.views = [{ state: "frozen", ySplit: 1, topLeftCell: "A2", zoomScale: 70 }];

    for (let index = 0; index < COLUMN_WIDTHS.length; index += 1) {
      worksheet.getColumn(index + 1).width = COLUMN_WIDTHS[index];
    }
    applyDynamicColumnWidths(worksheet, exportLayout);

    worksheet.mergeCells("I1:T1");
    worksheet.mergeCells("W1:AH1");

    setCell(worksheet, "A1", "n", STYLES.row1Index);
    setCell(worksheet, "B1", "ID capo", STYLES.row1Header);
    setCell(worksheet, "C1", "Data di nascita", STYLES.row1HeaderWrapped);
    setCell(worksheet, "D1", "Data e ora ecografia", STYLES.row1DateWrapped);
    setCell(worksheet, "E1", "Eta mesi", STYLES.row1HeaderWrapped);
    setCell(worksheet, "F1", "BCS", STYLES.row1HeaderWrapped);
    setCell(worksheet, "G1", "Giorni da ultimo parto", STYLES.row1HeaderWrapped);
    setBlankStyledCell(worksheet, "H1", STYLES.row1Header);
    setCell(worksheet, "I1", "OVAIO SINISTRO", STYLES.row1LeftGroup);
    setBlankStyledCell(worksheet, "U1", STYLES.row1LeftGroup);
    setCell(worksheet, "W1", "OVAIO DESTRO", STYLES.row1RightGroup);
    setBlankStyledCell(worksheet, "AI1", STYLES.row1RightGroup);

    worksheet.getRow(1).height = 34.5;
    worksheet.getRow(2).height = 43.5;

    setBlankStyledCell(worksheet, "A2", STYLES.row2Index);
    setBlankStyledCell(worksheet, "B2", STYLES.row2Header);
    setBlankStyledCell(worksheet, "C2", STYLES.row2Date);
    setBlankStyledCell(worksheet, "D2", STYLES.row2Date);
    setBlankStyledCell(worksheet, "E2", STYLES.row2Header);
    setBlankStyledCell(worksheet, "F2", STYLES.row2Header);
    setBlankStyledCell(worksheet, "G2", STYLES.row2Header);
    setCell(worksheet, "H2", "Ovaio SX", STYLES.row2Side);

    LEFT_COLUMNS.forEach((column, index) => {
      const style = getFollicleClassStyle(index, STYLES.row2LeftSmall, STYLES.row2LeftMedium, STYLES.row2LeftLarge);
      setCell(worksheet, `${column}2`, sizeLabel(LEFT_BUCKETS[index]), style);
    });

    setCell(worksheet, "V2", "Ovaio DX", STYLES.row2Side);

    RIGHT_COLUMNS.forEach((column, index) => {
      const style = getFollicleClassStyle(index, STYLES.row2LeftSmall, STYLES.row2LeftMedium, STYLES.row2LeftLarge);
      setCell(worksheet, `${column}2`, sizeLabel(RIGHT_BUCKETS[index]), style);
    });

    setCell(worksheet, "AJ2", "Follicoli totali", STYLES.row2Totals);
    setCell(worksheet, "AK2", "Follicoli piccoli <3 mm", STYLES.row2LeftSmall);
    setCell(worksheet, "AL2", "Follicoli medi 3-5 mm", STYLES.row2LeftMedium);
    setCell(worksheet, "AM2", "Follicoli grandi >5 mm", STYLES.row2LeftLarge);

    exportLayout.clColumns.forEach((column, index) => {
      setBlankStyledCell(worksheet, `${column}1`, STYLES.row1Header);
      setCell(worksheet, `${column}2`, `CL${index + 1}\nmm^2`, STYLES.row2Totals);
    });
    setBlankStyledCell(worksheet, `${exportLayout.ovulationCountColumn}1`, STYLES.row1Header);
    setCell(worksheet, `${exportLayout.ovulationCountColumn}2`, "Ovulazioni", STYLES.row2Totals);
  }

  function writeDataRow(worksheet, rowNumber, record, animalIndex, showAnimalHeaders, layout) {
    const exportLayout = layout || buildExportLayout([]);

    setCell(worksheet, `A${rowNumber}`, showAnimalHeaders ? animalIndex : "", STYLES.dataIndex);
    setCell(worksheet, `B${rowNumber}`, showAnimalHeaders ? record.animalId : "", STYLES.dataId);
    setCell(worksheet, `C${rowNumber}`, showAnimalHeaders ? record.birthDate || "" : "", STYLES.dataBirthDate);
    setCell(worksheet, `D${rowNumber}`, record.visitDateTime || "", STYLES.dataDate);
    setCell(worksheet, `E${rowNumber}`, record.ageMonthsAtVisit, STYLES.dataAgeMonths);
    setCell(worksheet, `F${rowNumber}`, showAnimalHeaders ? record.animalBodyConditionScore : "", STYLES.dataText);
    setCell(worksheet, `G${rowNumber}`, record.postPartumDays, STYLES.dataText);
    setCell(worksheet, `H${rowNumber}`, record.leftSummary, STYLES.dataText);

    LEFT_COLUMNS.forEach((column, index) => {
      const style = getFollicleClassStyle(index, STYLES.dataLeftSmall, STYLES.dataLeftMedium, STYLES.dataLeftLarge);
      setCell(worksheet, `${column}${rowNumber}`, record.leftCounts[index], style);
    });

    setCell(worksheet, `V${rowNumber}`, record.rightSummary, STYLES.dataText);

    RIGHT_COLUMNS.forEach((column, index) => {
      const style = getFollicleClassStyle(index, STYLES.dataLeftSmall, STYLES.dataLeftMedium, STYLES.dataLeftLarge);
      setCell(worksheet, `${column}${rowNumber}`, record.rightCounts[index], style);
    });

    setCell(
      worksheet,
      `AJ${rowNumber}`,
      { formula: formulaForColumns(LEFT_COLUMNS.concat(RIGHT_COLUMNS), rowNumber), result: record.totalFollicles },
      STYLES.dataTotals
    );
    setCell(
      worksheet,
      `AK${rowNumber}`,
      { formula: formulaForColumns(["I", "J", "K", "W", "X", "Y"], rowNumber), result: record.smallFollicles },
      STYLES.dataLeftSmall
    );
    setCell(
      worksheet,
      `AL${rowNumber}`,
      { formula: formulaForColumns(["L", "M", "N", "O", "P", "Z", "AA", "AB", "AC", "AD"], rowNumber), result: record.mediumFollicles },
      STYLES.dataLeftMedium
    );
    setCell(
      worksheet,
      `AM${rowNumber}`,
      { formula: formulaForColumns(["Q", "R", "S", "T", "U", "AE", "AF", "AG", "AH", "AI"], rowNumber), result: record.largeFollicles },
      STYLES.dataLeftLarge
    );

    exportLayout.clColumns.forEach((column, index) => {
      const value = (record.corpusLuteumAreas || [])[index];
      setCell(worksheet, `${column}${rowNumber}`, value === undefined ? "" : value, STYLES.dataTotals);
    });
    setCell(worksheet, `${exportLayout.ovulationCountColumn}${rowNumber}`, record.ovulationCount || "", STYLES.dataTotals);
  }

  function writeSeparatorRow(worksheet, rowNumber, layout) {
    const exportLayout = layout || buildExportLayout([]);

    setBlankStyledCell(worksheet, `A${rowNumber}`, STYLES.dataIndex);
    setBlankStyledCell(worksheet, `B${rowNumber}`, STYLES.dataId);
    setBlankStyledCell(worksheet, `C${rowNumber}`, STYLES.dataBirthDate);
    setBlankStyledCell(worksheet, `D${rowNumber}`, STYLES.dataDate);
    setBlankStyledCell(worksheet, `E${rowNumber}`, STYLES.dataAgeMonths);
    setBlankStyledCell(worksheet, `F${rowNumber}`, STYLES.dataText);
    setBlankStyledCell(worksheet, `G${rowNumber}`, STYLES.dataText);
    setBlankStyledCell(worksheet, `H${rowNumber}`, STYLES.dataText);

    LEFT_COLUMNS.forEach((column, index) => {
      const style = getFollicleClassStyle(index, STYLES.dataLeftSmall, STYLES.dataLeftMedium, STYLES.dataLeftLarge);
      setBlankStyledCell(worksheet, `${column}${rowNumber}`, style);
    });

    setBlankStyledCell(worksheet, `V${rowNumber}`, STYLES.dataText);

    RIGHT_COLUMNS.forEach((column, index) => {
      const style = getFollicleClassStyle(index, STYLES.dataLeftSmall, STYLES.dataLeftMedium, STYLES.dataLeftLarge);
      setBlankStyledCell(worksheet, `${column}${rowNumber}`, style);
    });

    setBlankStyledCell(worksheet, `AJ${rowNumber}`, STYLES.dataTotals);
    setBlankStyledCell(worksheet, `AK${rowNumber}`, STYLES.dataLeftSmall);
    setBlankStyledCell(worksheet, `AL${rowNumber}`, STYLES.dataLeftMedium);
    setBlankStyledCell(worksheet, `AM${rowNumber}`, STYLES.dataLeftLarge);

    exportLayout.clColumns.forEach((column) => {
      setBlankStyledCell(worksheet, `${column}${rowNumber}`, STYLES.dataTotals);
    });
    setBlankStyledCell(worksheet, `${exportLayout.ovulationCountColumn}${rowNumber}`, STYLES.dataTotals);
  }

  function sortAnimalsForExport(animals) {
    return animals.slice().sort((left, right) => {
      return getDisplayAnimalId(left).localeCompare(getDisplayAnimalId(right), "it");
    });
  }

  function sortVisitsForExport(visits) {
    return visits.slice().sort((left, right) => {
      return new Date(left.visitAt).getTime() - new Date(right.visitAt).getTime();
    });
  }

  function buildExportFiltersFromDom() {
    const refs = app.dom.refs;

    return {
      sessionId: refs.exportSessionInput.value || "all",
      dateFrom: refs.exportDateFromInput.value || "",
      dateTo: refs.exportDateToInput.value || "",
      farmName: refs.exportFarmInput.value || "all",
      operatorName: refs.exportOperatorInput.value.trim().toLowerCase(),
    };
  }

  function matchesExportFilters(animal, visit, filters) {
    const settings = filters || {};
    const visitTimestamp = new Date(visit.visitAt).getTime();
    const dateFrom = parseDateFilter(settings.dateFrom, false);
    const dateTo = parseDateFilter(settings.dateTo, true);

    if (settings.sessionId && settings.sessionId !== "all") {
      const animalSessionId = getRecordSessionId(animal);
      const visitSessionId = getRecordSessionId(visit);

      if (animalSessionId !== settings.sessionId && visitSessionId !== settings.sessionId) {
        return false;
      }
    }

    if (dateFrom !== null && (!Number.isFinite(visitTimestamp) || visitTimestamp < dateFrom)) {
      return false;
    }

    if (dateTo !== null && (!Number.isFinite(visitTimestamp) || visitTimestamp > dateTo)) {
      return false;
    }

    if (settings.farmName && settings.farmName !== "all" && (animal.farmName || "") !== settings.farmName) {
      return false;
    }

    if (settings.operatorName && String(visit.operatorName || "").toLowerCase().indexOf(settings.operatorName) < 0) {
      return false;
    }

    return true;
  }

  async function collectExportGroups(filters) {
    const repository = app.data.repository;
    const clinicId = app.data.activeClinicId;
    const animals = sortAnimalsForExport(await repository.listAnimals(clinicId));
    const groups = [];

    for (let index = 0; index < animals.length; index += 1) {
      const animal = animals[index];
      const visits = sortVisitsForExport(await repository.listAnimalVisits(clinicId, animal.id)).filter((visit) => {
        return matchesExportFilters(animal, visit, filters);
      });

      if (!visits.length) {
        continue;
      }

      groups.push({
        animal,
        visits: visits.map((visit) => buildVisitExportRecord(animal, visit)),
      });
    }

    return groups;
  }

  function downloadWorkbookBuffer(buffer, fileName) {
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = fileName;
    link.click();

    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 0);
  }

  function buildExportDateStamp() {
    const now = new Date();
    const yyyy = String(now.getFullYear());
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  function sanitizeFileNameSegment(value) {
    return String(value || "")
      .replace(/[<>:"/\\|?*\u0000-\u001F]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function ensureExcelExtension(fileName) {
    const normalized = String(fileName || "").trim();

    if (!normalized) {
      return "";
    }

    return /\.xlsx$/i.test(normalized) ? normalized : `${normalized}.xlsx`;
  }

  function buildSuggestedFileName(filters) {
    const settings = filters || {};

    if (settings.sessionId && settings.sessionId !== "all") {
      const sessions = app.state.workspace.sessions || [];
      const session = sessions.find((candidate) => candidate.id === settings.sessionId);
      const sessionName = sanitizeFileNameSegment(session && session.name ? session.name : "");

      if (sessionName) {
        return ensureExcelExtension(sessionName);
      }
    }

    return `embryosardegna_follicoli_${buildExportDateStamp()}.xlsx`;
  }

  async function saveWorkbookBuffer(buffer, fileName) {
    const normalizedFileName = ensureExcelExtension(sanitizeFileNameSegment(fileName));

    if (typeof window.showSaveFilePicker === "function") {
      try {
        const fileHandle = await window.showSaveFilePicker({
          suggestedName: normalizedFileName,
          types: [
            {
              description: "Excel Workbook",
              accept: {
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
              },
            },
          ],
        });
        const writable = await fileHandle.createWritable();

        await writable.write(buffer);
        await writable.close();
        return true;
      } catch (error) {
        if (error && error.name === "AbortError") {
          return false;
        }

        throw error;
      }
    }

    downloadWorkbookBuffer(buffer, normalizedFileName);
    return true;
  }

  function assertExcelJsAvailable() {
    return window.ExcelJS && typeof window.ExcelJS.Workbook === "function";
  }

  app.exporter = {
    init() {
      app.dom.refs.exportBtn.addEventListener("click", () => {
        this.exportWorkbook().catch((error) => {
          console.error(error);
          app.ui.toast("Errore durante l'export Excel", "warn");
        });
      });
    },

    refreshFilters() {
      const refs = app.dom.refs;
      const sessions = app.state.workspace.sessions || [];
      const allAnimals = app.state.workspace.allAnimals || app.state.workspace.animals || [];
      const activeSessionId = app.state.context.activeSessionId || app.domain.modelUtils.UNASSIGNED_SESSION_ID;
      const currentSessionValue = refs.exportSessionInput.value || activeSessionId;
      const currentFarmValue = refs.exportFarmInput.value || "all";
      const sessionOptions =
        '<option value="all">Tutte le sessioni</option>' +
        sessions
          .map((session) => {
            const label = `${session.name}${session.code ? ` | ${session.code}` : ""}`;
            return `<option value="${escapeHtml(session.id)}">${escapeHtml(label)}</option>`;
          })
          .join("");
      const farmNames = Array.from(
        new Set(
          allAnimals
            .map((animal) => animal.farmName || "")
            .filter(Boolean)
            .sort((left, right) => left.localeCompare(right, "it"))
        )
      );
      const farmOptions =
        '<option value="all">Tutti gli allevamenti</option>' +
        farmNames.map((farmName) => `<option value="${escapeHtml(farmName)}">${escapeHtml(farmName)}</option>`).join("");

      refs.exportSessionInput.innerHTML = sessionOptions;
      refs.exportFarmInput.innerHTML = farmOptions;

      refs.exportSessionInput.value = sessions.some((session) => session.id === currentSessionValue) || currentSessionValue === "all" ? currentSessionValue : activeSessionId;
      refs.exportFarmInput.value = farmNames.indexOf(currentFarmValue) >= 0 ? currentFarmValue : "all";
    },

    async exportWorkbook() {
      if (!assertExcelJsAvailable()) {
        app.ui.toast("Libreria Excel non disponibile nella pagina", "warn");
        return;
      }

      const filters = buildExportFiltersFromDom();
      const fileName = buildSuggestedFileName(filters);

      const groups = await collectExportGroups(filters);
      const exportLayout = buildExportLayout(groups);
      const workbook = new window.ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Follicoli");
      let rowNumber = 3;

      workbook.creator = "Embryosardegna";
      workbook.created = new Date();
      workbook.modified = new Date();
      workbook.calcProperties.fullCalcOnLoad = true;

      writeHeaderRows(worksheet, exportLayout);

      for (let animalIndex = 0; animalIndex < groups.length; animalIndex += 1) {
        const group = groups[animalIndex];

        for (let visitIndex = 0; visitIndex < group.visits.length; visitIndex += 1) {
          writeDataRow(worksheet, rowNumber, group.visits[visitIndex], animalIndex + 1, visitIndex === 0, exportLayout);
          rowNumber += 1;
        }

        writeSeparatorRow(worksheet, rowNumber, exportLayout);
        rowNumber += 1;
      }

      if (!groups.length) {
        writeSeparatorRow(worksheet, rowNumber, exportLayout);
      }

      const buffer = await workbook.xlsx.writeBuffer();
      const saved = await saveWorkbookBuffer(buffer, fileName);

      if (!saved) {
        app.ui.toast("Export annullato");
        return;
      }

      app.ui.toast(groups.length ? "Excel esportato" : "Excel esportato: template vuoto");
    },
  };
})();
