import dayjs from "dayjs";

const DEFAULT_NA_TEXT = "Data not found in test data"
export function formateDate(msDate, msTime) {

    const d = dayjs(msDate);
    const t = dayjs(msTime);

    const fmtD = d && d.isValid() ? d.format("MM/DD/YYYY") : "";
    const fmtT = t && t.isValid() ? t.format("h:mma") : ""

    return [fmtD, fmtT].filter(Boolean).join(" ");

}
export function formateDateOnly(msDate) {

    const d = dayjs(msDate);

    const fmtD = d && d.isValid() ? d.format("MM/DD/YYYY") : "";


    return fmtD;

}



export function getSafe(obj, pathArr, fallback = "") {
    // tiny helper to avoid lots of optional chaining in the mapping table
    return pathArr.reduce((acc, k) => (acc && acc[k] != null ? acc[k] : null), obj) ?? fallback;
}

export function getSafeValue(value, defValue = DEFAULT_NA_TEXT) {
    return value ?? defValue;
}

