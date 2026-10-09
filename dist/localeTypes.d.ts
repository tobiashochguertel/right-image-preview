/**
 * All user-visible strings in the ImagePreview component.
 * Per-language objects live in `locales/*.ts`.
 */
export interface LocaleStrings {
    /** Zoom dropdown fallback when fit-equivalent % is not yet known. */
    fit: string;
    /** Zoom dropdown row for Fit mode — includes estimated native %. */
    fitApprox(pct: number): string;
    fitToViewport: string;
    actualSize: string;
    zoomIn: string;
    zoomOut: string;
    lockZoom: string;
    unlockZoom: string;
    rotateCW: string;
    rotateCCW: string;
    flipH: string;
    flipV: string;
    prev: string;
    next: string;
    prevGroup: string;
    nextGroup: string;
    imagePreview: string;
    toolbar: string;
    close: string;
    loadingImage: string;
    /**
     * Banner when the original exceeds {@link ImagePreviewProps.rasterFullDecodeMaxBytes}
     * and the main stage stays on `minimapSrc` / `minimapSource`.
     */
    originalTooLargeNotice: string;
    /** Minimap landmark (aria). */
    minimapNav: string;
    /** Classic thumbnail strip landmark (aria). */
    thumbnailsNav: string;
    /** Per-tile label in the classic strip — 1-based index within the visible set. */
    thumbStripItem(index: number, total: number): string;
    /**
     * Delayed hover tooltips. Empty string skips the tooltip (used for obvious
     * chrome such as close, prev/next, rotate, zoom ±). Screen readers still use
     * the short `aria-label` fields above.
     */
    tipFitToViewport: string;
    tipActualSize: string;
    tipZoomIn: string;
    tipZoomOut: string;
    tipLockZoom: string;
    tipUnlockZoom: string;
    tipRotateCW: string;
    tipRotateCCW: string;
    tipFlipH: string;
    tipFlipV: string;
    tipPrev: string;
    tipNext: string;
    tipPrevGroup: string;
    tipNextGroup: string;
    tipClose: string;
    /** Zoom % control: type value or open preset list. Empty skips the tooltip. */
    tipZoomLevel: string;
    tipZoomRowPercent(pct: number): string;
    tipZoomRowFit: string;
    tipZoomRowFitApprox(pct: number): string;
    tipMinimap: string;
    showExif: string;
    hideExif: string;
    tipShowExif: string;
    tipHideExif: string;
    exifPanel: string;
    exifEmpty: string;
    exifDragHandle: string;
    exifBoolYes: string;
    exifBoolNo: string;
    deleteImage: string;
    tipDeleteImage: string;
    enterFullscreen: string;
    exitFullscreen: string;
    tipEnterFullscreen: string;
    tipExitFullscreen: string;
    exifGroupFile: string;
    exifGroupCamera: string;
    exifGroupExposure: string;
    exifGroupGps: string;
    exifGroupOther: string;
    exifFieldFileName: string;
    exifFieldFileSize: string;
    exifFieldMimeType: string;
    exifFieldWidth: string;
    exifFieldHeight: string;
    exifFieldColorSpace: string;
    exifFieldOrientation: string;
    exifFieldMake: string;
    exifFieldModel: string;
    exifFieldLens: string;
    exifFieldSoftware: string;
    exifFieldDateTimeOriginal: string;
    exifFieldDateTimeDigitized: string;
    exifFieldCreateDate: string;
    exifFieldExposureTime: string;
    exifFieldFNumber: string;
    exifFieldIso: string;
    exifFieldFocalLength: string;
    exifFieldFocalLength35mm: string;
    exifFieldExposureProgram: string;
    exifFieldMeteringMode: string;
    exifFieldFlash: string;
    exifFieldWhiteBalance: string;
    exifFieldExposureBias: string;
    exifFieldGpsLatitude: string;
    exifFieldGpsLongitude: string;
    exifFieldGpsAltitude: string;
}
