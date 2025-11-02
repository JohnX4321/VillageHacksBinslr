import {processData} from './pdfFiller.js'

const DEFAULT_DATA_PATH = "./assets/inspection.json";
const DEFAULT_TEMPLATE_PATH = "./assets/TREC_Template_Blank.pdf";

processData(DEFAULT_DATA_PATH,DEFAULT_TEMPLATE_PATH).catch((e) => {
    console.error(e);
    process.exit(1);
})