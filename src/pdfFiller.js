import fs from 'node:fs/promises';
import {formateDate,getSafeValue,formateDateOnly} from './utils.js';
import {PDFArray, PDFDocument, PDFName, StandardFonts, PDFString, rgb} from "pdf-lib";
import {compress} from "compress-pdf";
import path from "path";


export async function processData(dataPath, templatePath) {

    const [pdfBytes,jsonText] = await Promise.all([
        fs.readFile(templatePath),
        fs.readFile(dataPath)
    ]);

    const data = JSON.parse(jsonText).inspection;

    const clientData = data.clientInfo;

    const pdfDoc = await PDFDocument.load(pdfBytes);
    const form = pdfDoc.getForm();

    let totalPageCount = 6;
    let currentPageCount = 1;

    const setters = [
        ["Name of Client",               getSafeValue(clientData?.name)],
        ["Date of Inspection",           getSafeValue(formateDate(data?.schedule?.date, data?.schedule?.startTime))],
        ["Address of Inspected Property",getSafeValue(data?.address?.fullAddress)],
        ["Name of Inspector",            getSafeValue(data?.inspector?.name)],
        ["TREC License",                 getSafeValue(data?.inspector?.license)],
        ["Name of Sponsor if applicable",getSafeValue(data?.sponsor?.name)],
        ["TREC License_2",               getSafeValue(data?.sponsor?.license)],


    ];

    for (const [k,v] of setters) {
        try {
            const tf = form.getTextField(k);
            if(v && String(v).trim())
                tf.setText(String(v));
        } catch (e) {
            print(e)
        }
    }

    pdfDoc.removePage(2);
    pdfDoc.removePage(2);
    pdfDoc.removePage(2);
    pdfDoc.removePage(2);

    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    form.updateFieldAppearances(font);






    await appendInspectionDetailPages(pdfDoc, data)

    await addPageFooters(pdfDoc);



    //form.flatten();

    const out = await pdfDoc.save({
        useObjectStreams: true
    });
    await fs.writeFile("./output_pdf.pdf",out)


    console.log("Written data");

    console.log("Start Compression");
    await compressPD();

    console.log("Compression Done");





    async function compressPD() {
        const pdf = path.resolve("./output_pdf.pdf");
        const buffer = await compress(pdf);

        const comPdf = path.resolve("./output_pdf.pdf");
        await fs.writeFile(comPdf, buffer);
    }


    function drawLabeledRectangle(page, font, opts = {}) {
        const {
            marginX = 40,
            rectHeight = 20,
            rectY = 720,
            letterPositions = [
                { x: 45,  y: 725, text: "I" },
                { x: 60, y: 725, text: "NI" },
                { x: 80, y: 725, text: "NP" },
                { x: 100, y: 725, text: "D" },
            ],
        } = opts;

        const { width } = page.getSize();
        const rectWidth = width - 2 * marginX;

        // Draw rectangle outline
        page.drawRectangle({
            x: marginX,
            y: rectY,
            width: rectWidth,
            height: rectHeight,
            borderWidth: 1,
            color: rgb(1, 1, 1), // fill white
            borderColor: rgb(0, 0, 0), // black border
        });

        // Draw letters at given coordinates
        for (const { x, y, text } of letterPositions) {
            page.drawText(text, {
                x,
                y,
                size: 6,
                font,
                color: rgb(0, 0, 0),
            });
        }
    }






    async function appendInspectionDetailPages(pdfDoc, data) {
        const form = pdfDoc.getForm();
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold, { bold: true });


        const PAGE_WIDTH = 612, PAGE_HEIGHT = 792;
        const MARGIN_X = 40, MARGIN_Y = 80, RIGHT_MARGIN = 40;
        const LINE_GAP = 8, NAME_SIZE = 11, COMMENTS_SIZE = 10;
        const LINE_HEIGHT_NAME = 14, LINE_HEIGHT_COMMENTS = 12;
        const CHECKBOX_SIZE = 10, CHECK_GAP = 10, LABEL_GAP = 8;
        const STATUS_LABELS = ["I", "NI", "NP", "D"];
        const textWidth = (t, s) => font.widthOfTextAtSize(String(t ?? ""), s);

        const IMG_GAP = 8;                 // gap between thumbnails
        const IMG_MAX_W = 120;             // max width of each thumbnail "box"
        const IMG_MAX_H = 90;              // max height of each thumbnail "box"
        const ROW_TOP_PAD = 4;             // padding before the grid
        const ROW_BOTTOM_PAD = 6;          // padding after the grid

        const wrap = (text, size, maxW) => {
            const words = String(text || "").split(/\s+/);
            const lines = [];
            let line = "";
            for (const w of words) {
                const test = line ? `${line} ${w}` : w;
                if (textWidth(test, size) <= maxW) {
                    line = test;
                } else {
                    if (line) lines.push(line);
                    if (textWidth(w, size) > maxW) {
                        let chunk = "";
                        for (const ch of w) {
                            const t = chunk + ch;
                            if (textWidth(t, size) <= maxW) chunk = t;
                            else { if (chunk) lines.push(chunk); chunk = ch; }
                        }
                        line = chunk;
                    } else {
                        line = w;
                    }
                }
            }
            if (line) lines.push(line);
            return lines;
        };

        const joinComments = (arr = []) =>
            arr
                .map(o => (o?.content ?? o?.commentText ?? o?.label ?? "").trim())
                .filter(Boolean)
                .map((t, i) => `${i + 1}. ${t}`)
                .join("\n");

        const addPage = () => pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);

        let pageCount = 0;
        let page = addPage();
        let { width: PW, height: PH } = page.getSize();
        let y = PH - MARGIN_Y;

        const drawHeaderAndFooter = (page, pageNumber) => {

            const headerLine1 = `Report Identification: ${getSafeValue(data?.address?.fullAddress)} - ${getSafeValue(formateDateOnly(data?.schedule?.date))}`;
            const headerLine2 = "I=Inspected  NI=Not Inspected  NP=Not Present  D=Deficient";
            page.drawText(headerLine1, { x: MARGIN_X, y: PH - 25, size: 10, font });
            page.drawText(headerLine2, { x: MARGIN_X, y: PH - 40, size: 10, font: boldFont });

        };


        const ensureSpacePx = (needPx) => {

            if (y - needPx < MARGIN_Y + 60) {
                pageCount++;
                drawHeaderAndFooter(page, pageCount);
                page = addPage();
                ({ width: PW, height: PH } = page.getSize());
                y = PH - MARGIN_Y;
            }
        };


        pageCount++;
        // drawHeaderAndFooter(page, pageCount);
        //
        // const header = "Inspection Details";
        // const headerSize = 14;
        // page.drawText(header, {
        //     x: (PW - textWidth(header, headerSize)) / 2,
        //     y: y - headerSize,
        //     size: headerSize,
        //     font,
        // });
        // y -= headerSize + 2 * LINE_GAP;

        const imageCache = new Map(); // url -> { kind: 'png'|'jpg', img }
        const sniffKind = (bytes) => {

            if (bytes.length >= 8 &&
                bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47 &&
                bytes[4] === 0x0D && bytes[5] === 0x0A && bytes[6] === 0x1A && bytes[7] === 0x0A) return 'png';

            if (bytes.length >= 2 && bytes[0] === 0xFF && bytes[1] === 0xD8) return 'jpg';
            return 'jpg';
        };

        async function loadImage(url) {
            if (!url) return null;
            if (imageCache.has(url)) return imageCache.get(url);

            try {
                const res = await fetch(url);
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const ab = await res.arrayBuffer();
                const bytes = new Uint8Array(ab);
                const kind = sniffKind(bytes);
                const img = kind === 'png'
                    ? await pdfDoc.embedPng(bytes)
                    : await pdfDoc.embedJpg(bytes);
                const out = { kind, img };
                imageCache.set(url, out);
                return out;
            } catch (e) {

                return null;
            }
        }


        async function fetchArrayBuffer(url) {
            const res = await fetch(url);
            if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
            return await res.arrayBuffer();
        }


        async function embedImageFromUrl(pdfDoc, url) {
            const buf = await fetchArrayBuffer(url);

            if (url.toLowerCase().endsWith('.png')) {
                return pdfDoc.embedPng(buf);
            }
            return pdfDoc.embedJpg(buf);
        }


        function addLinkAnnotation(page, x, y, w, h, url) {
            const { context } = page.doc;


            let annots = page.node.lookup(PDFName.of('Annots'), PDFArray);
            if (!annots) {
                annots = context.obj([]);
                page.node.set(PDFName.of('Annots'), annots);
            }


            const rect = context.obj([x, y, x + w, y + h]);
            const action = context.obj({
                S: PDFName.of('URI'),
                URI: PDFString.of(String(url)),
            });

            const annotDict = context.obj({
                Type: PDFName.of('Annot'),
                Subtype: PDFName.of('Link'),
                Rect: rect,
                Border: context.obj([0, 0, 0]),
                A: action,
            });


            const annotRef = context.register(annotDict);
            annots.push(annotRef);
        }


        function drawTextLink(page, text, x, y, size, font, url, maxWidth, lineHeight) {
            const words = String(text).split(/\s+/);
            let line = '';
            let cursorY = y;
            const widthOf = t => font.widthOfTextAtSize(t, size);

            const flush = l => {
                page.drawText(l, { x, y: cursorY, size, font });

                const underlineY = cursorY - 1;
                page.drawLine({ start: { x, y: underlineY }, end: { x: x + widthOf(l), y: underlineY }, thickness: 0.5 });

                addLinkAnnotation(page, x, cursorY - size, widthOf(l), size + 2, url);
                cursorY -= lineHeight;
            };

            for (const w of words) {
                const test = line ? `${line} ${w}` : w;
                if (widthOf(test) <= maxWidth) line = test;
                else { if (line) flush(line); line = w; }
            }
            if (line) flush(line);
            return cursorY; // new Y after the last line
        }


        function collectPhotoUrls(item) {
            return (item?.comments ?? [])
                .flatMap(c => (c?.photos ?? []).map(p => p?.url).filter(Boolean))
                .filter(Boolean);
        }

        function collectVideoUrls(item) {
            return (item?.comments ?? [])
                .flatMap(c => (c?.videos ?? []).filter(Boolean))
                .filter(Boolean);
        }

        function computeGridCols(maxW) {

            const cellW = IMG_MAX_W;
            const cols = Math.max(1, Math.floor((maxW + IMG_GAP) / (cellW + IMG_GAP)));
            return cols;
        }

        // ---- SNIPPET: render first two sections (plain text on separate pages) ----
        const renderPlainSectionPage = (section) => {
            if (!section) return;

            // new page for this section
            pageCount++;
            page = addPage();
            ({ width: PW, height: PH } = page.getSize());
            y = PH - MARGIN_Y;

            // Optional header/footer:
            // drawHeaderAndFooter(page, pageCount);

            const title =
                (section?.title || section?.name || `Section ${section?.sectionNumber || ""}`).trim();
            const TITLE_SIZE = 14;

            // Title
            page.drawText(title, { x: MARGIN_X, y: y - TITLE_SIZE, size: TITLE_SIZE, font: boldFont });
            y -= TITLE_SIZE + LINE_GAP * 1.5;

            for (const item of (section?.lineItems ?? [])) {
                const startX = MARGIN_X;
                const maxW = PW - RIGHT_MARGIN - startX;

                const name = String(item?.name ?? "").trim();
                const commentsJoined = joinComments(item?.comments);

                // Name (bold)
                if (name) {
                    const nameLines = wrap(name, NAME_SIZE, maxW);
                    ensureSpacePx(nameLines.length);
                    for (const ln of nameLines) {
                        page.drawText(ln, { x: startX, y: y - NAME_SIZE, size: NAME_SIZE, font: boldFont });
                        y -= LINE_HEIGHT_NAME;
                    }
                }

                // Comments (regular)
                if (commentsJoined) {
                    const lines = wrap(commentsJoined, COMMENTS_SIZE, maxW);
                    ensureSpacePx(lines.length);
                    for (const ln of lines) {
                        page.drawText(ln, { x: startX, y: y - COMMENTS_SIZE, size: COMMENTS_SIZE, font });
                        y -= LINE_HEIGHT_COMMENTS;
                    }
                }

                y -= LINE_GAP;
            }

            // Optional footer on this page:
            // drawHeaderAndFooter(page, pageCount);
        };

// Call for the first two sections:
        renderPlainSectionPage(data?.sections?.[0]);
        //renderPlainSectionPage(data?.sections?.[1]);
        pdfDoc.removePage(2);



        let i=0;
        for (const section of (data?.sections ?? [])) {
            if (i===0 || i===1) {
                i+=1;
                continue;
            }
            for (const item of (section?.lineItems ?? [])) {

                const checkboxBlockWidth =
                    STATUS_LABELS.length * CHECKBOX_SIZE + (STATUS_LABELS.length - 1) * CHECK_GAP;
                const startX = MARGIN_X + checkboxBlockWidth + LABEL_GAP;
                const maxW = PW - RIGHT_MARGIN - startX;

                const commentsJoined = joinComments(item?.comments);
                const commentLines = wrap(
                    commentsJoined ? `Comments: ${commentsJoined}` : "",
                    COMMENTS_SIZE,
                    Math.max(maxW, 60)
                );

                // Pre-calc total height for name + comments. We'll add images after, with their own ensureSpace.
                const needName = LINE_HEIGHT_NAME;
                const needComments =
                    (commentLines.length ? commentLines.length : 1) * LINE_HEIGHT_COMMENTS;
                const baseNeed = needName + needComments + LINE_GAP;

                ensureSpacePx(baseNeed);

                // 1) draw checkboxes
                let cx = MARGIN_X;
                const cy = y - CHECKBOX_SIZE;
                const boxes = [];
                for (const label of STATUS_LABELS) {
                    const fieldName = `li_${item.id}_${label}`;
                    const cb = form.createCheckBox(fieldName);
                    cb.addToPage(page, { x: cx, y: cy, width: CHECKBOX_SIZE, height: CHECKBOX_SIZE });
                    boxes.push({ cb, label });
                    cx += CHECKBOX_SIZE + CHECK_GAP;
                }
                const sel = STATUS_LABELS.indexOf(String(item?.inspectionStatus || "").toUpperCase());
                if (sel >= 0) boxes[sel].cb.check();


                const nameText = String(item?.name ?? "").trim() || "(unnamed item)";
                page.drawText(nameText, { x: startX, y: y - NAME_SIZE, size: NAME_SIZE, font });
                y -= LINE_HEIGHT_NAME;


                if (commentLines.length) {
                    for (const line of commentLines) {
                        y -= LINE_HEIGHT_COMMENTS;
                        page.drawText(line, { x: startX, y, size: COMMENTS_SIZE, font });
                    }
                } else {
                    y -= LINE_HEIGHT_COMMENTS;
                }

                y -= LINE_GAP;


                const urls = collectPhotoUrls(item);
                if (urls.length) {

                    const cols = computeGridCols(maxW);
                    const cellW = Math.min(IMG_MAX_W, (maxW - (cols - 1) * IMG_GAP) / cols);
                    const cellH = IMG_MAX_H;
                    const rows = Math.ceil(urls.length / cols);
                    const gridHeight = ROW_TOP_PAD + rows * cellH + (rows - 1) * IMG_GAP + ROW_BOTTOM_PAD;


                    ensureSpacePx(gridHeight);


                    y -= ROW_TOP_PAD;


                    for (let i = 0; i < urls.length; i++) {
                        const r = Math.floor(i / cols);
                        const c = i % cols;

                        const x = startX + c * (cellW + IMG_GAP);

                        const rowTopY = y - r * (cellH + IMG_GAP);
                        const imgBoxYTop = rowTopY;
                        const imgBoxYBottom = rowTopY - cellH;

                        const loaded = await loadImage(urls[i]);
                        if (loaded?.img) {
                            const img = loaded.img;
                            const iw = img.width;
                            const ih = img.height;

                            const scale = Math.min(cellW / iw, cellH / ih);
                            const dw = Math.max(1, Math.floor(iw * scale));
                            const dh = Math.max(1, Math.floor(ih * scale));

                            const drawX = x + (cellW - dw) / 2;
                            const drawY = imgBoxYTop - dh; // y is baseline; we want top-left anchor

                            page.drawImage(img, { x: drawX, y: drawY, width: dw, height: dh });
                        }

                    }


                    y -= gridHeight;
                }

                const GRID_COLS = 3;
                const GRID_GAP = 8;
                const THUMB_W = 150;
                const THUMB_H = 100;
                const CAPTION_SIZE = 8;
                const LINK_SIZE = 9;
                const LINK_LINE_HEIGHT = 12;


                let VidUrls = collectVideoUrls(item);
                if (VidUrls.length) {

                    const vidsLabel = 'Videos:';
                    page.drawText(vidsLabel, { x: startX, y: y - NAME_SIZE, size: NAME_SIZE, font });
                    y -= LINE_HEIGHT_NAME;

                    let col = 0;
                    let rowHeight = THUMB_H + CAPTION_SIZE + GRID_GAP;

                    for (let vi = 0; vi < VidUrls.length; vi++) {
                        const v = VidUrls[vi] || {};
                        const hasThumb = !!v.thumbnailURL;


                        ensureSpacePx(Math.ceil(rowHeight / LINE_HEIGHT_COMMENTS));

                        const cellX = startX + col * (THUMB_W + GRID_GAP);
                        const cellYTop = y;

                        if (hasThumb) {
                            // draw thumbnail image
                            try {
                                const img = await embedImageFromUrl(pdfDoc, v.thumbnailURL);
                                const scale = Math.min(THUMB_W / img.width, THUMB_H / img.height);
                                const w = img.width * scale;
                                const h = img.height * scale;
                                const ix = cellX + (THUMB_W - w) / 2;
                                const iy = cellYTop - h;

                                page.drawImage(img, { x: ix, y: iy, width: w, height: h });

                                addLinkAnnotation(page, ix, iy, w, h, v.url || v.thumbnailURL);


                                const cap = v.url ? 'Open video' : 'Open';
                                const capY = iy - CAPTION_SIZE - 2;
                                page.drawText(cap, { x: cellX, y: capY, size: CAPTION_SIZE, font });


                            } catch (e) {

                                const maxW = THUMB_W;
                                const linkText = "Video" || '(video)';
                                const ny = drawTextLink(page, linkText, cellX, cellYTop - LINK_SIZE, LINK_SIZE, font, v.url || '', maxW, LINK_LINE_HEIGHT);

                                rowHeight = Math.max(rowHeight, (cellYTop - ny) + GRID_GAP);
                            }
                        } else {

                            const maxW = THUMB_W;
                            const linkText = "Video" || '(video)';
                            const ny = drawTextLink(page, linkText, cellX, cellYTop - LINK_SIZE, LINK_SIZE, font, v.url || '', maxW, LINK_LINE_HEIGHT);
                            rowHeight = Math.max(rowHeight, (cellYTop - ny) + GRID_GAP);
                        }


                        col++;
                        if (col >= GRID_COLS) {

                            col = 0;
                            y -= rowHeight;
                            rowHeight = THUMB_H + CAPTION_SIZE + GRID_GAP;
                        }
                    }


                    if (col !== 0) y -= rowHeight;

                    y -= LINE_GAP;
                }

            }
        }


        drawHeaderAndFooter(page, pageCount);



        form.updateFieldAppearances(font);
    }



    async function addPageFooters(pdfDoc) {
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const pageCount = pdfDoc.getPageCount();
        form.getTextField("Page 2 of").setFontSize(6);
        form.getTextField("Page 2 of").setText(String(pageCount))

        for (let i = 2; i < pageCount; i++) {
            const page = pdfDoc.getPage(i);
            const { width } = page.getSize();

            const footerText = `Page ${i + 1} of ${pageCount}`;
            const fontSize = 10;
            const textWidth = font.widthOfTextAtSize(footerText, fontSize);


            const x = (width - textWidth) / 2;
            const y = 35; // 35 points from bottom

            page.drawText(footerText, {
                x,
                y,
                size: fontSize,
                font,
                color: undefined,
            });


            const footerLine2 = "REI 7-6 (8/9/2021) \t\t\t Promulgated by the Texas Real Estate Commission - (512) 936-3000 - www.trec.texas.gov";
            page.drawText(footerLine2, {
                x: 20,
                y: 15,
                size: fontSize,
                font,
                color: undefined,
            });

            drawLabeledRectangle(page, font);

        }


    }



}