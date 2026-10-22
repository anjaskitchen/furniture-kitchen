import "server-only";
import JSZip from "jszip";

/**
 * Menyisipkan grafik Excel NATIVE (bisa diedit & ikut berubah saat data sel diubah)
 * ke file .xlsx buatan ExcelJS. ExcelJS belum mendukung chart, jadi bagian
 * DrawingML (xl/charts, xl/drawings + relasi) ditambahkan langsung ke paket ZIP.
 */

export interface ChartSeries {
  /** Referensi sel judul seri, mis. 'Tren'!$B$1 */
  nameRef: string;
  /** Referensi nilai, mis. 'Tren'!$B$2:$B$32 */
  valuesRef: string;
  color: string;
  /** Untuk grafik kombinasi: tampilkan seri ini sebagai garis. */
  asLine?: boolean;
}

export interface ChartSpec {
  /** Nomor file sheet (urutan worksheet, mulai 1). */
  sheet: number;
  type: "column" | "bar" | "doughnut";
  title: string;
  categoriesRef: string;
  series: ChartSeries[];
  /** Posisi (indeks 0) kolom/baris kiri-atas & kanan-bawah. */
  from: { col: number; row: number };
  to: { col: number; row: number };
  numberFormat?: string;
  /** Warna per irisan (doughnut). */
  pointColors?: string[];
}

const NS_C = "http://schemas.openxmlformats.org/drawingml/2006/chart";
const NS_A = "http://schemas.openxmlformats.org/drawingml/2006/main";
const NS_R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const REL_CHART = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart";
const REL_DRAWING = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const fill = (hex: string) => `<c:spPr><a:solidFill><a:srgbClr val="${hex.replace("#", "")}"/></a:solidFill></c:spPr>`;
const lineFill = (hex: string) =>
  `<c:spPr><a:ln w="28575" cap="rnd"><a:solidFill><a:srgbClr val="${hex.replace("#", "")}"/></a:solidFill><a:round/></a:ln></c:spPr>`;

const title = (text: string) =>
  `<c:title><c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="1200" b="1"/></a:pPr><a:r><a:rPr lang="id-ID" sz="1200" b="1"><a:solidFill><a:srgbClr val="1C1C1C"/></a:solidFill></a:rPr><a:t>${esc(text)}</a:t></a:r></a:p></c:rich></c:tx><c:overlay val="0"/></c:title><c:autoTitleDeleted val="0"/>`;

const serHead = (i: number, s: ChartSeries) => `<c:idx val="${i}"/><c:order val="${i}"/><c:tx><c:strRef><c:f>${esc(s.nameRef)}</c:f></c:strRef></c:tx>`;
const catVal = (spec: ChartSpec, s: ChartSeries) =>
  `<c:cat><c:strRef><c:f>${esc(spec.categoriesRef)}</c:f></c:strRef></c:cat><c:val><c:numRef><c:f>${esc(s.valuesRef)}</c:f></c:numRef></c:val>`;

function axes(spec: ChartSpec) {
  const fmt = esc(spec.numberFormat ?? "#,##0");
  const horizontal = spec.type === "bar";
  return (
    `<c:catAx><c:axId val="500001"/><c:scaling><c:orientation val="${horizontal ? "maxMin" : "minMax"}"/></c:scaling><c:delete val="0"/>` +
    `<c:axPos val="${horizontal ? "l" : "b"}"/><c:numFmt formatCode="General" sourceLinked="1"/><c:majorTickMark val="none"/><c:minorTickMark val="none"/>` +
    `<c:tickLblPos val="nextTo"/><c:spPr><a:ln><a:solidFill><a:srgbClr val="D9D9D9"/></a:solidFill></a:ln></c:spPr>` +
    `<c:txPr><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="900"><a:solidFill><a:srgbClr val="595959"/></a:solidFill></a:defRPr></a:pPr><a:endParaRPr lang="id-ID"/></a:p></c:txPr>` +
    `<c:crossAx val="500002"/><c:crosses val="autoZero"/><c:auto val="1"/><c:lblAlgn val="ctr"/><c:lblOffset val="100"/><c:noMultiLvlLbl val="0"/></c:catAx>` +
    `<c:valAx><c:axId val="500002"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="${horizontal ? "b" : "l"}"/>` +
    `<c:majorGridlines><c:spPr><a:ln><a:solidFill><a:srgbClr val="EDEDED"/></a:solidFill></a:ln></c:spPr></c:majorGridlines>` +
    `<c:numFmt formatCode="${fmt}" sourceLinked="0"/><c:majorTickMark val="none"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/>` +
    `<c:spPr><a:ln><a:noFill/></a:ln></c:spPr>` +
    `<c:txPr><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="900"><a:solidFill><a:srgbClr val="595959"/></a:solidFill></a:defRPr></a:pPr><a:endParaRPr lang="id-ID"/></a:p></c:txPr>` +
    `<c:crossAx val="500001"/><c:crosses val="${horizontal ? "max" : "autoZero"}"/><c:crossBetween val="between"/></c:valAx>`
  );
}

function chartXml(spec: ChartSpec) {
  let plot = "";
  if (spec.type === "doughnut") {
    const s = spec.series[0];
    const points = (spec.pointColors ?? [])
      .map((c, i) => `<c:dPt><c:idx val="${i}"/><c:bubble3D val="0"/><c:spPr><a:solidFill><a:srgbClr val="${c.replace("#", "")}"/></a:solidFill><a:ln><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill></a:ln></c:spPr></c:dPt>`)
      .join("");
    const labels =
      `<c:dLbls><c:numFmt formatCode="0%" sourceLinked="0"/><c:spPr><a:noFill/><a:ln><a:noFill/></a:ln></c:spPr>` +
      `<c:txPr><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="900" b="1"><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill></a:defRPr></a:pPr><a:endParaRPr lang="id-ID"/></a:p></c:txPr>` +
      `<c:showLegendKey val="0"/><c:showVal val="0"/><c:showCatName val="0"/><c:showSerName val="0"/><c:showPercent val="1"/><c:showBubbleSize val="0"/><c:showLeaderLines val="0"/></c:dLbls>`;
    plot = `<c:doughnutChart><c:varyColors val="1"/><c:ser>${serHead(0, s)}${points}${labels}${catVal(spec, s)}</c:ser><c:firstSliceAng val="0"/><c:holeSize val="55"/></c:doughnutChart>`;
  } else {
    const bars = spec.series.map((s, i) => ({ s, i })).filter((x) => !x.s.asLine);
    const lines = spec.series.map((s, i) => ({ s, i })).filter((x) => x.s.asLine);
    plot =
      `<c:barChart><c:barDir val="${spec.type === "bar" ? "bar" : "col"}"/><c:grouping val="clustered"/><c:varyColors val="0"/>` +
      bars.map(({ s, i }) => `<c:ser>${serHead(i, s)}${fill(s.color)}<c:invertIfNegative val="0"/>${catVal(spec, s)}</c:ser>`).join("") +
      `<c:gapWidth val="${spec.type === "bar" ? 50 : 70}"/><c:overlap val="-10"/><c:axId val="500001"/><c:axId val="500002"/></c:barChart>`;
    if (lines.length) {
      plot +=
        `<c:lineChart><c:grouping val="standard"/><c:varyColors val="0"/>` +
        lines
          .map(
            ({ s, i }) =>
              `<c:ser>${serHead(i, s)}${lineFill(s.color)}<c:marker><c:symbol val="circle"/><c:size val="5"/>${fill(s.color)}</c:marker>${catVal(spec, s)}<c:smooth val="0"/></c:ser>`,
          )
          .join("") +
        `<c:marker val="1"/><c:axId val="500001"/><c:axId val="500002"/></c:lineChart>`;
    }
    plot += axes(spec);
  }
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<c:chartSpace xmlns:c="${NS_C}" xmlns:a="${NS_A}" xmlns:r="${NS_R}"><c:roundedCorners val="0"/>` +
    `<c:chart>${title(spec.title)}<c:plotArea><c:layout/>${plot}</c:plotArea>` +
    `<c:legend><c:legendPos val="${spec.type === "doughnut" ? "r" : "b"}"/><c:overlay val="0"/>` +
    `<c:txPr><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="900"/></a:pPr><a:endParaRPr lang="id-ID"/></a:p></c:txPr></c:legend>` +
    `<c:plotVisOnly val="1"/><c:dispBlanksAs val="gap"/></c:chart>` +
    `<c:spPr><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill><a:ln><a:solidFill><a:srgbClr val="E7E2D8"/></a:solidFill></a:ln></c:spPr>` +
    `</c:chartSpace>`
  );
}

function anchorXml(spec: ChartSpec, idx: number, rid: string) {
  return (
    `<xdr:twoCellAnchor editAs="oneCell">` +
    `<xdr:from><xdr:col>${spec.from.col}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${spec.from.row}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from>` +
    `<xdr:to><xdr:col>${spec.to.col}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${spec.to.row}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to>` +
    `<xdr:graphicFrame macro=""><xdr:nvGraphicFramePr><xdr:cNvPr id="${idx + 2}" name="Grafik ${idx + 1}"/><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr>` +
    `<xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm>` +
    `<a:graphic><a:graphicData uri="${NS_C}"><c:chart xmlns:c="${NS_C}" r:id="${rid}"/></a:graphicData></a:graphic>` +
    `</xdr:graphicFrame><xdr:clientData/></xdr:twoCellAnchor>`
  );
}

// Elemen yang (menurut skema CT_Worksheet) harus berada SETELAH <drawing>.
const AFTER_DRAWING = ["<legacyDrawing", "<legacyDrawingHF", "<picture", "<oleObjects", "<controls", "<webPublishItems", "<tableParts", "<extLst"];

export async function addNativeCharts(xlsx: Buffer | ArrayBuffer, charts: ChartSpec[]): Promise<Buffer> {
  if (!charts.length) return Buffer.from(xlsx as ArrayBuffer);
  const zip = await JSZip.loadAsync(xlsx);
  let contentTypes = await zip.file("[Content_Types].xml")!.async("string");
  const overrides: string[] = [];

  const bySheet = new Map<number, ChartSpec[]>();
  for (const c of charts) bySheet.set(c.sheet, [...(bySheet.get(c.sheet) ?? []), c]);

  let chartNo = 0;
  let drawingNo = 0;
  for (const [sheet, specs] of bySheet) {
    drawingNo++;
    const drawingRels: string[] = [];
    const anchors: string[] = [];
    specs.forEach((spec, i) => {
      chartNo++;
      zip.file(`xl/charts/chart${chartNo}.xml`, chartXml(spec));
      overrides.push(`<Override PartName="/xl/charts/chart${chartNo}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/>`);
      const rid = `rId${i + 1}`;
      drawingRels.push(`<Relationship Id="${rid}" Type="${REL_CHART}" Target="../charts/chart${chartNo}.xml"/>`);
      anchors.push(anchorXml(spec, i, rid));
    });

    zip.file(
      `xl/drawings/drawing${drawingNo}.xml`,
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="${NS_A}" xmlns:r="${NS_R}">${anchors.join("")}</xdr:wsDr>`,
    );
    zip.file(
      `xl/drawings/_rels/drawing${drawingNo}.xml.rels`,
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${drawingRels.join("")}</Relationships>`,
    );
    overrides.push(`<Override PartName="/xl/drawings/drawing${drawingNo}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>`);

    // Relasi sheet → drawing
    const relsPath = `xl/worksheets/_rels/sheet${sheet}.xml.rels`;
    const relId = `rIdChartDrawing${drawingNo}`;
    const relEntry = `<Relationship Id="${relId}" Type="${REL_DRAWING}" Target="../drawings/drawing${drawingNo}.xml"/>`;
    const existingRels = zip.file(relsPath) ? await zip.file(relsPath)!.async("string") : null;
    zip.file(
      relsPath,
      existingRels
        ? existingRels.replace("</Relationships>", `${relEntry}</Relationships>`)
        : `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${relEntry}</Relationships>`,
    );

    // Elemen <drawing> di posisi yang benar dalam XML sheet
    const sheetPath = `xl/worksheets/sheet${sheet}.xml`;
    let sheetXml = await zip.file(sheetPath)!.async("string");
    if (sheetXml.includes("<drawing ")) throw new Error(`Sheet ${sheet} sudah memiliki drawing`);
    if (!/xmlns:r=/.test(sheetXml.slice(0, 600))) sheetXml = sheetXml.replace("<worksheet ", `<worksheet xmlns:r="${NS_R}" `);
    const tag = `<drawing r:id="${relId}"/>`;
    const positions = AFTER_DRAWING.map((t) => sheetXml.indexOf(t)).filter((p) => p >= 0);
    const at = positions.length ? Math.min(...positions) : sheetXml.lastIndexOf("</worksheet>");
    sheetXml = sheetXml.slice(0, at) + tag + sheetXml.slice(at);
    zip.file(sheetPath, sheetXml);
  }

  contentTypes = contentTypes.replace("</Types>", `${overrides.join("")}</Types>`);
  zip.file("[Content_Types].xml", contentTypes);
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}
