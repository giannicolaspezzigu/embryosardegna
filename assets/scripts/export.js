(function () {
  const app = (window.EmbryoApp = window.EmbryoApp || {});

  const LEFT_BUCKETS = [1, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6, 6.5, 7, 8];
  const RIGHT_BUCKETS = [1, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6, 6.5, 7, 7.5];
  const LEFT_COLUMNS = ["F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R"];
  const RIGHT_COLUMNS = ["T", "U", "V", "W", "X", "Y", "Z", "AA", "AB", "AC", "AD", "AE", "AF"];
  const TOTAL_COLUMNS = ["AG", "AH", "AI"];
  const COLUMN_WIDTHS = [
    4.453125,
    26.6328125,
    25.6328125,
    12.6328125,
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
    const totalGreen = "FF8ED973";
    const totalGreenSoft = "FFB4E5A2";

    return {
      row1Index: withFont(base(paleYellowSoft), 16, true, false),
      row1Header: withFont(base(paleYellowSoft), 14, true, false),
      row1Date: withFont(base(paleYellowSoft), 16, true, false),
      row1LeftGroup: withFont(base(leftBlue), 11, true, false),
      row1RightGroup: withFont(base(rightPink), 11, true, false),
      row2Index: withFont(base(paleYellow), 16, true, false),
      row2Header: withFont(base(paleYellow), 14, true, false),
      row2Date: base(paleYellow),
      row2Wrapped: withFont(base(paleYellow), 11, true, true),
      row2Side: withFont(base(paleYellow), 11, true, false),
      row2LeftSmall: withFont(base(leftBlue), 11, true, false),
      row2LeftLarge: withFont(base(rightPinkSoft), 11, true, false),
      row2Totals: withFont(base(totalGreen), 11, true, true),
      dataIndex: withFont(base(paleYellowSoft), 16, true, false),
      dataId: withFont(base(paleYellowSoft), 14, true, false),
      dataDate: Object.assign(base(paleYellowSoft), {
        numFmt: "dd/mm/yyyy",
      }),
      dataText: base(paleYellowSoft),
      dataLeftSmall: base(leftBlueSoft),
      dataLeftLarge: base(rightPinkSoft),
      dataTotals: base(totalGreenSoft),
    };
  }

  function cloneStyle(style) {
    return JSON.parse(JSON.stringify(style));
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

  function getPostPartumDays(animal, visit) {
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

  function parseDateOnly(isoValue) {
    const raw = String(isoValue || "");
    const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);

    if (match) {
      return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    }

    const fallback = new Date(raw);
    if (Number.isNaN(fallback.getTime())) {
      return "";
    }

    return new Date(fallback.getFullYear(), fallback.getMonth(), fallback.getDate());
  }

  function getSideStructures(visit, sideKey) {
    const ovaries = visit && visit.ovaries ? visit.ovaries : {};
    const side = ovaries[sideKey] || {};
    return Array.isArray(side.structures) ? side.structures : [];
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

  function buildSideSummary(visit, sideKey, buckets) {
    const structures = getSideStructures(visit, sideKey);

    if (!structures.length) {
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

  function buildVisitExportRecord(animal, visit) {
    const leftCountsMap = buildSideBucketCounts(visit, "left", LEFT_BUCKETS);
    const rightCountsMap = buildSideBucketCounts(visit, "right", RIGHT_BUCKETS);
    const leftCounts = countMapToArray(leftCountsMap, LEFT_BUCKETS);
    const rightCounts = countMapToArray(rightCountsMap, RIGHT_BUCKETS);
    const totalFollicles = sumValues(leftCounts) + sumValues(rightCounts);
    const smallFollicles = sumValues(leftCounts.slice(0, 4)) + sumValues(rightCounts.slice(0, 4));
    const largeFollicles = totalFollicles - smallFollicles;

    return {
      animalId: getDisplayAnimalId(animal),
      visitDate: parseDateOnly(visit.visitAt),
      postPartumDays: getPostPartumDays(animal, visit),
      leftSummary: buildSideSummary(visit, "left", LEFT_BUCKETS),
      rightSummary: buildSideSummary(visit, "right", RIGHT_BUCKETS),
      leftCounts,
      rightCounts,
      totalFollicles,
      smallFollicles,
      largeFollicles,
    };
  }

  function formulaForColumns(columns, rowNumber) {
    return columns.map((column) => `${column}${rowNumber}`).join("+");
  }

  function writeHeaderRows(worksheet) {
    worksheet.properties.defaultRowHeight = 21;
    worksheet.views = [{ state: "frozen", ySplit: 1, topLeftCell: "A2", zoomScale: 70 }];

    for (let index = 0; index < COLUMN_WIDTHS.length; index += 1) {
      worksheet.getColumn(index + 1).width = COLUMN_WIDTHS[index];
    }

    worksheet.mergeCells("F1:Q1");
    worksheet.mergeCells("T1:AE1");

    setCell(worksheet, "A1", "n", STYLES.row1Index);
    setCell(worksheet, "B1", "ID capo", STYLES.row1Header);
    setCell(worksheet, "C1", "Data ecografia", STYLES.row1Date);
    setBlankStyledCell(worksheet, "D1", STYLES.row1Header);
    setCell(worksheet, "F1", "OVAIO SINISTRO", STYLES.row1LeftGroup);
    setBlankStyledCell(worksheet, "R1", STYLES.row1LeftGroup);
    setCell(worksheet, "T1", "OVAIO DESTRO", STYLES.row1RightGroup);
    setBlankStyledCell(worksheet, "AF1", STYLES.row1RightGroup);

    worksheet.getRow(2).height = 43.5;

    setBlankStyledCell(worksheet, "A2", STYLES.row2Index);
    setBlankStyledCell(worksheet, "B2", STYLES.row2Header);
    setBlankStyledCell(worksheet, "C2", STYLES.row2Date);
    setCell(worksheet, "D2", "Giorni PP rilevazione ovaie", STYLES.row2Wrapped);
    setCell(worksheet, "E2", "Ovaio SX", STYLES.row2Side);

    LEFT_COLUMNS.forEach((column, index) => {
      const style = index < 4 ? STYLES.row2LeftSmall : STYLES.row2LeftLarge;
      setCell(worksheet, `${column}2`, sizeLabel(LEFT_BUCKETS[index]), style);
    });

    setCell(worksheet, "S2", "Ovaio DX", STYLES.row2Side);

    RIGHT_COLUMNS.forEach((column, index) => {
      const style = index < 4 ? STYLES.row2LeftSmall : STYLES.row2LeftLarge;
      setCell(worksheet, `${column}2`, sizeLabel(RIGHT_BUCKETS[index]), style);
    });

    setCell(worksheet, "AG2", "Follicoli totali", STYLES.row2Totals);
    setCell(worksheet, "AH2", "follicoli </= 3 mm", STYLES.row2Totals);
    setCell(worksheet, "AI2", "follicoli > 3 mm", STYLES.row2Totals);
  }

  function writeDataRow(worksheet, rowNumber, record, animalIndex, showAnimalHeaders) {
    setCell(worksheet, `A${rowNumber}`, showAnimalHeaders ? animalIndex : "", STYLES.dataIndex);
    setCell(worksheet, `B${rowNumber}`, showAnimalHeaders ? record.animalId : "", STYLES.dataId);
    setCell(worksheet, `C${rowNumber}`, record.visitDate || "", STYLES.dataDate);
    setCell(worksheet, `D${rowNumber}`, record.postPartumDays, STYLES.dataText);
    setCell(worksheet, `E${rowNumber}`, record.leftSummary, STYLES.dataText);

    LEFT_COLUMNS.forEach((column, index) => {
      const style = index < 4 ? STYLES.dataLeftSmall : STYLES.dataLeftLarge;
      setCell(worksheet, `${column}${rowNumber}`, record.leftCounts[index], style);
    });

    setCell(worksheet, `S${rowNumber}`, record.rightSummary, STYLES.dataText);

    RIGHT_COLUMNS.forEach((column, index) => {
      const style = index < 4 ? STYLES.dataLeftSmall : STYLES.dataLeftLarge;
      setCell(worksheet, `${column}${rowNumber}`, record.rightCounts[index], style);
    });

    setCell(
      worksheet,
      `AG${rowNumber}`,
      { formula: formulaForColumns(LEFT_COLUMNS.concat(RIGHT_COLUMNS), rowNumber), result: record.totalFollicles },
      STYLES.dataTotals
    );
    setCell(
      worksheet,
      `AH${rowNumber}`,
      { formula: formulaForColumns(["F", "G", "H", "I", "T", "U", "V", "W"], rowNumber), result: record.smallFollicles },
      STYLES.dataTotals
    );
    setCell(
      worksheet,
      `AI${rowNumber}`,
      { formula: formulaForColumns(["J", "K", "L", "M", "N", "O", "P", "Q", "R", "X", "Y", "Z", "AA", "AB", "AC", "AD", "AE", "AF"], rowNumber), result: record.largeFollicles },
      STYLES.dataTotals
    );
  }

  function writeSeparatorRow(worksheet, rowNumber) {
    setBlankStyledCell(worksheet, `A${rowNumber}`, STYLES.dataIndex);
    setBlankStyledCell(worksheet, `B${rowNumber}`, STYLES.dataId);
    setBlankStyledCell(worksheet, `C${rowNumber}`, STYLES.dataDate);
    setBlankStyledCell(worksheet, `D${rowNumber}`, STYLES.dataText);
    setBlankStyledCell(worksheet, `E${rowNumber}`, STYLES.dataText);

    LEFT_COLUMNS.forEach((column, index) => {
      const style = index < 4 ? STYLES.dataLeftSmall : STYLES.dataLeftLarge;
      setBlankStyledCell(worksheet, `${column}${rowNumber}`, style);
    });

    setBlankStyledCell(worksheet, `S${rowNumber}`, STYLES.dataText);

    RIGHT_COLUMNS.forEach((column, index) => {
      const style = index < 4 ? STYLES.dataLeftSmall : STYLES.dataLeftLarge;
      setBlankStyledCell(worksheet, `${column}${rowNumber}`, style);
    });

    TOTAL_COLUMNS.forEach((column) => {
      setBlankStyledCell(worksheet, `${column}${rowNumber}`, STYLES.dataTotals);
    });
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

  async function collectExportGroups() {
    const repository = app.data.repository;
    const clinicId = app.data.activeClinicId;
    const animals = sortAnimalsForExport(await repository.listAnimals(clinicId));
    const groups = [];

    for (let index = 0; index < animals.length; index += 1) {
      const animal = animals[index];
      const visits = sortVisitsForExport(await repository.listAnimalVisits(clinicId, animal.id));

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

  function buildFileName() {
    const now = new Date();
    const yyyy = String(now.getFullYear());
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    return `embryosardegna_follicoli_${yyyy}-${mm}-${dd}.xlsx`;
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

    async exportWorkbook() {
      if (!assertExcelJsAvailable()) {
        app.ui.toast("Libreria Excel non disponibile nella pagina", "warn");
        return;
      }

      const groups = await collectExportGroups();
      const workbook = new window.ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Follicoli");
      let rowNumber = 3;

      workbook.creator = "Embryosardegna";
      workbook.created = new Date();
      workbook.modified = new Date();
      workbook.calcProperties.fullCalcOnLoad = true;

      writeHeaderRows(worksheet);

      for (let animalIndex = 0; animalIndex < groups.length; animalIndex += 1) {
        const group = groups[animalIndex];

        for (let visitIndex = 0; visitIndex < group.visits.length; visitIndex += 1) {
          writeDataRow(worksheet, rowNumber, group.visits[visitIndex], animalIndex + 1, visitIndex === 0);
          rowNumber += 1;
        }

        writeSeparatorRow(worksheet, rowNumber);
        rowNumber += 1;
      }

      if (!groups.length) {
        writeSeparatorRow(worksheet, rowNumber);
      }

      const buffer = await workbook.xlsx.writeBuffer();
      downloadWorkbookBuffer(buffer, buildFileName());
      app.ui.toast(groups.length ? "Excel esportato" : "Excel esportato: template vuoto");
    },
  };
})();
