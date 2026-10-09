import { Children as e, cloneElement as t, forwardRef as n, isValidElement as r, useCallback as i, useEffect as a, useImperativeHandle as o, useLayoutEffect as s, useMemo as c, useRef as l, useState as u } from "react";
import { Fragment as d, jsx as f, jsxs as p } from "react/jsx-runtime";
import * as m from "react-dom";
import { createPortal as h } from "react-dom";
//#region src/components/ImagePreview/flattenGroupedImages.ts
function g() {
	let e = globalThis.process;
	return e !== void 0 && e.env?.NODE_ENV !== "production";
}
function _(e) {
	let t = [], n = [], r = 0;
	for (let i of e) {
		let e = i.images ?? [];
		if (e.length === 0) continue;
		let a = r;
		for (let n of e) t.push(n), r++;
		n.push({
			name: i.name,
			start: a,
			end: r - 1,
			id: i.id
		});
	}
	return {
		images: t,
		groupSlices: n
	};
}
function v(e, t) {
	let { groupSlices: n } = _(e);
	if (n.length === 0) return 0;
	let r = t.defaultGroupIndex;
	(!Number.isFinite(r) || r < 0 || r >= n.length) && (r = 0);
	let i = n[r], a = i.end - i.start + 1, o = t.defaultIndexInGroup;
	return (!Number.isFinite(o) || o < 0) && (o = 0), o >= a && (o = Math.max(0, a - 1)), i.start + o;
}
function y(e) {
	if (Array.isArray(e.groupedImages) && e.groupedImages.length > 0) {
		g() && e.images && e.images.length > 0 && console.warn("[right-image-preview] Both `groupedImages` and `images` are set; using `groupedImages` and ignoring `images`.");
		let { images: t, groupSlices: n } = _(e.groupedImages);
		return {
			images: t,
			groupSlices: n.length > 0 ? n : void 0
		};
	}
	return e.images && e.images.length > 0 ? {
		images: e.images,
		groupSlices: void 0
	} : e.src || e.source ? {
		images: [{
			src: e.src ?? "media-source",
			source: e.source,
			kind: e.kind,
			mimeType: e.mimeType,
			alt: e.alt,
			minimapSrc: e.minimapSrc,
			minimapSource: e.minimapSource,
			minimap: e.minimap,
			exif: e.exif
		}],
		groupSlices: void 0
	} : {
		images: [],
		groupSlices: void 0
	};
}
//#endregion
//#region src/components/ImagePreview/lib/imagePreviewData.ts
function b(e) {
	return y(e).images;
}
function x(e) {
	return e.minimapSource ? e.minimapSource : e.minimapSrc ? {
		type: "url",
		href: e.minimapSrc
	} : e.source ?? {
		type: "url",
		href: e.src
	};
}
function S(e) {
	return e.thumbnailSource === void 0 ? e.thumbnailSrc === void 0 ? x(e) : e.thumbnailSrc ? {
		type: "url",
		href: e.thumbnailSrc
	} : null : e.thumbnailSource;
}
//#endregion
//#region src/components/ImagePreview/core/media-source.ts
var C = 128 * 1024;
function w(e) {
	if (e.type !== "url") {
		if (e.mimeType) return M(e.mimeType);
		if (e.type === "blob" && e.blob.type) return M(e.blob.type);
	}
}
function T(e, t = URL) {
	if (e.type === "url") return {
		href: e.href,
		owned: !1,
		dispose() {}
	};
	let n = e.type === "blob" ? e.blob : new Blob([e.data], { type: e.mimeType ?? "" }), r = t.createObjectURL(n), i = !1;
	return {
		href: r,
		owned: !0,
		dispose() {
			i || (i = !0, t.revokeObjectURL(r));
		}
	};
}
async function E(e, t = {}) {
	if (e.type === "blob") return k(t.onProgress, e.blob.size), e.blob;
	if (e.type === "bytes") {
		let n = new Blob([e.data], { type: e.mimeType ?? "" });
		return k(t.onProgress, n.size), n;
	}
	let n = await (t.fetchImpl ?? fetch)(e.href, { signal: t.signal });
	if (!n.ok) throw Error(`Failed to load media source: ${n.status} ${n.statusText}`);
	let r = D(n.headers.get("content-length")) ?? D(e.contentLength), i = n.headers.get("content-type") ?? "";
	if (!n.body) {
		let e = await n.blob();
		return k(t.onProgress, e.size, r), e;
	}
	let a = n.body.getReader(), o = [], s = 0, c = 0, l = performance.now();
	t.onProgress?.(O(0, r, !1));
	try {
		for (;;) {
			let { done: e, value: n } = await a.read();
			if (e) break;
			o.push(n), s += n.byteLength;
			let i = performance.now();
			((r ? (s - c) / r : 0) >= .01 || i - l >= 200) && (t.onProgress?.(O(s, r, !1)), c = s, l = i);
		}
	} finally {
		a.releaseLock();
	}
	let u = new Blob(o, { type: i });
	return k(t.onProgress, s, r), u;
}
function D(e) {
	if (e == null || e === "") return;
	let t = Number(e);
	return Number.isFinite(t) && t > 0 ? t : void 0;
}
function O(e, t, n) {
	return {
		loadedBytes: e,
		...t ? { totalBytes: t } : {},
		...t ? { progress: n ? 1 : Math.max(0, Math.min(1, e / t)) } : {},
		complete: n
	};
}
function k(e, t, n = t) {
	e?.({
		loadedBytes: t,
		totalBytes: n,
		progress: 1,
		complete: !0
	});
}
async function A(e, t = C, n = {}) {
	let r = j(t);
	if (e.type === "bytes") return new Uint8Array(e.data, 0, Math.min(r, e.data.byteLength));
	if (e.type === "blob") return new Uint8Array(await e.blob.slice(0, r).arrayBuffer());
	let i = await (n.fetchImpl ?? fetch)(e.href, {
		headers: { Range: `bytes=0-${r - 1}` },
		signal: n.signal
	});
	if (!i.ok) throw Error(`Failed to inspect media source: ${i.status} ${i.statusText}`);
	if (!i.body) return new Uint8Array(await i.arrayBuffer()).subarray(0, r);
	let a = i.body.getReader(), o = [], s = 0;
	try {
		for (; s < r;) {
			let { done: e, value: t } = await a.read();
			if (e) break;
			let n = r - s, i = t.byteLength > n ? t.subarray(0, n) : t;
			o.push(i), s += i.byteLength;
		}
	} finally {
		await a.cancel().catch(() => void 0);
	}
	let c = new Uint8Array(s), l = 0;
	for (let e of o) c.set(e, l), l += e.byteLength;
	return c;
}
function j(e) {
	return !Number.isFinite(e) || e <= 0 ? C : Math.max(1, Math.floor(e));
}
function M(e) {
	return e.split(";", 1)[0]?.trim().toLowerCase() || void 0;
}
//#endregion
//#region src/components/ImagePreview/core/use-media-source-url.ts
function N(e) {
	let [t, n] = u(null);
	return a(() => {
		if (e.type === "url") return;
		let t = T(e);
		return n({
			source: e,
			href: t.href
		}), () => t.dispose();
	}, [e]), e.type === "url" ? e.href : t?.source === e ? t.href : "";
}
//#endregion
//#region src/components/ImagePreview/core/MediaSourceImage.tsx
function ee({ source: e, ...t }) {
	let n = N(e);
	return /* @__PURE__ */ f("img", {
		...t,
		src: n
	});
}
//#endregion
//#region src/components/ImagePreview/DelayedTooltip.tsx
var P = 5e4;
function F({ content: e, delayMs: n = 900, disabled: r = !1, children: o }) {
	let [s, c] = u(!1), [m, g] = u({
		top: 0,
		left: 0
	}), _ = l(null), v = l(null), y = i(() => {
		_.current &&= (clearTimeout(_.current), null);
	}, []), b = i(() => {
		y(), c(!1);
	}, [y]), x = i((e) => {
		y(), v.current = e, _.current = setTimeout(() => {
			let e = v.current;
			if (!e) return;
			let t = e.getBoundingClientRect();
			g({
				top: t.top,
				left: t.left + t.width / 2
			}), c(!0);
		}, n);
	}, [y, n]);
	if (a(() => () => y(), [y]), a(() => {
		if (!s) return;
		let e = () => {
			let e = v.current;
			if (!e) return;
			let t = e.getBoundingClientRect();
			g({
				top: t.top,
				left: t.left + t.width / 2
			});
		};
		return window.addEventListener("scroll", e, !0), window.addEventListener("resize", e), () => {
			window.removeEventListener("scroll", e, !0), window.removeEventListener("resize", e);
		};
	}, [s]), r || !e.trim()) return o;
	let S = o.props, C = t(o, {
		...S,
		onMouseEnter: (e) => {
			o.props.onMouseEnter?.(e), x(e.currentTarget);
		},
		onMouseLeave: (e) => {
			o.props.onMouseLeave?.(e), b();
		}
	}), w = m.top < 72, T = /* @__PURE__ */ f("div", {
		role: "tooltip",
		style: {
			position: "fixed",
			left: m.left,
			top: m.top,
			transform: w ? "translate(-50%, 10px)" : "translate(-50%, calc(-100% - 10px))",
			maxWidth: Math.min(320, typeof window < "u" ? window.innerWidth - 24 : 320),
			padding: "8px 11px",
			borderRadius: 8,
			fontSize: 13,
			lineHeight: 1.45,
			color: "rgba(235,242,255,0.95)",
			background: "rgba(12,18,32,0.96)",
			border: "1px solid rgba(140,162,188,0.28)",
			boxShadow: "0 8px 28px rgba(0,0,0,0.55)",
			pointerEvents: "none",
			zIndex: P,
			boxSizing: "border-box"
		},
		children: e
	});
	return /* @__PURE__ */ p(d, { children: [C, s && typeof document < "u" ? h(T, document.body) : null] });
}
//#endregion
//#region src/components/ImagePreview/imagePreviewTuning.ts
var te = 300, I = 200, L = .5, ne = .9, R = L, re = .15;
function ie(e) {
	return e?.split(/[-_]/)[0].toLowerCase(), 56;
}
function ae(e) {
	return e?.split(/[-_]/)[0].toLowerCase() === "zh" ? 136 : 110;
}
function oe() {
	return 66;
}
function se(e, t) {
	if (e <= 1 || t <= 0) return !1;
	let n = oe();
	return e > Math.max(1, Math.floor(t / n)) * 3;
}
function ce(e) {
	return e <= 1 ? 0 : 84;
}
var le = .25;
//#endregion
//#region src/components/ImagePreview/minimapMath.ts
function ue(e, t, n, r) {
	return {
		ix: (e - n) / 2,
		iy: (t - r) / 2
	};
}
function de(e, t, n) {
	let { cw: r, ch: i, nw: a, nh: o, scale: s, tx: c, ty: l, rotationDeg: u, flipH: d, flipV: f } = n, { ix: p, iy: m } = ue(r, i, a, o), h = e - p - a / 2 - c, g = t - m - o / 2 - l, _ = -u * Math.PI / 180, v = h * Math.cos(_) - g * Math.sin(_), y = h * Math.sin(_) + g * Math.cos(_), b = d ? -v : v, x = f ? -y : y, S = b / s, C = x / s;
	return {
		nx: S + a / 2,
		ny: C + o / 2
	};
}
function z(e, t, n) {
	let { cw: r, ch: i, nw: a, nh: o, scale: s, tx: c, ty: l, rotationDeg: u, flipH: d, flipV: f } = n, { ix: p, iy: m } = ue(r, i, a, o), h = e - a / 2, g = t - o / 2, _ = h * s, v = g * s, y = d ? -_ : _, b = f ? -v : v, x = u * Math.PI / 180, S = y * Math.cos(x) - b * Math.sin(x), C = y * Math.sin(x) + b * Math.cos(x);
	return {
		cx: p + a / 2 + S + c,
		cy: m + o / 2 + C + l
	};
}
function B(e, t, n) {
	let { cw: r, ch: i } = n, { cx: a, cy: o } = z(e, t, {
		...n,
		tx: 0,
		ty: 0
	});
	return {
		tx: r / 2 - a,
		ty: i / 2 - o
	};
}
function fe(e, t, n, r, i, a, o, s, c, l) {
	let { ix: u, iy: d } = ue(n, r, i, a), f = e - i / 2, p = t - a / 2, m = f * o, h = p * o, g = c ? -m : m, _ = l ? -h : h, v = s * Math.PI / 180, y = g * Math.cos(v) - _ * Math.sin(v), b = g * Math.sin(v) + _ * Math.cos(v);
	return {
		mx: u + i / 2 + y,
		my: d + a / 2 + b
	};
}
function pe(e, t, n, r, i, a, o, s, c) {
	let { ix: l, iy: u } = ue(n, n, r, i), d = e - l - r / 2, f = t - u - i / 2, p = -o * Math.PI / 180, m = d * Math.cos(p) - f * Math.sin(p), h = d * Math.sin(p) + f * Math.cos(p), g = s ? -m : m, _ = c ? -h : h, v = g / a, y = _ / a;
	return he(v + r / 2, y + i / 2, r, i);
}
function me(e, t, n) {
	let r = n * Math.PI / 180;
	return {
		rw: Math.abs(e * Math.cos(r)) + Math.abs(t * Math.sin(r)),
		rh: Math.abs(e * Math.sin(r)) + Math.abs(t * Math.cos(r))
	};
}
function he(e, t, n, r) {
	return {
		nx: Math.max(0, Math.min(n, e)),
		ny: Math.max(0, Math.min(r, t))
	};
}
function ge(e, t, n) {
	let r = 0, i = n.length;
	for (let a = 0; a < i; a++) {
		let [o, s] = n[a], [c, l] = n[(a + 1) % i];
		s <= t ? l > t && (c - o) * (t - s) - (e - o) * (l - s) > 0 && r++ : l <= t && (c - o) * (t - s) - (e - o) * (l - s) < 0 && r--;
	}
	return r !== 0;
}
function _e(e, t, n, r, i) {
	let { nx: a, ny: o } = de(e.cw / 2, e.ch / 2, e);
	return fe(a, o, r, r, t, n, i, e.rotationDeg, e.flipH, e.flipV);
}
function ve(e, t, n, r, i, a, o) {
	let s = le, c = _e(n, r, i, a, o), l = _e({
		...n,
		tx: n.tx + s
	}, r, i, a, o), u = _e({
		...n,
		ty: n.ty + s
	}, r, i, a, o), d = (l.mx - c.mx) / s, f = (l.my - c.my) / s, p = (u.mx - c.mx) / s, m = (u.my - c.my) / s, h = d * m - p * f;
	if (!Number.isFinite(h) || Math.abs(h) < 1e-14) {
		let { scale: r } = n, i = Number.isFinite(r) && r > 0 && Number.isFinite(o) && o > 0 ? r / o : 1;
		return {
			dtx: -e * i,
			dty: -t * i
		};
	}
	let g = m / h, _ = -p / h, v = -f / h, y = d / h;
	return {
		dtx: g * e + _ * t,
		dty: v * e + y * t
	};
}
//#endregion
//#region src/components/ImagePreview/Minimap.tsx
var V = 152, ye = 2, be = "rgba(0,0,0,0.52)";
function xe(e, t = .75) {
	if (e.length !== 4) return null;
	let n = e.map((e) => e[0]), r = e.map((e) => e[1]), i = Math.min(...n), a = Math.max(...n), o = Math.min(...r), s = Math.max(...r), c = (e, n) => Math.abs(e - n) <= t, l = (e, t) => (c(e, i) || c(e, a)) && (c(t, o) || c(t, s));
	return !e.every(([e, t]) => l(e, t)) || a - i < .5 || s - o < .5 ? null : {
		minX: i,
		maxX: a,
		minY: o,
		maxY: s
	};
}
function Se(e, t) {
	if (!e) return null;
	let n = e;
	if (typeof n.setPointerCapture != "function") return null;
	try {
		return n.setPointerCapture(t), {
			el: e,
			id: t
		};
	} catch {
		return null;
	}
}
function Ce(e, t) {
	let n = e;
	try {
		typeof n.hasPointerCapture == "function" && n.hasPointerCapture(t) && n.releasePointerCapture(t);
	} catch {}
}
function we({ imageSrc: e, imageSource: t, thumbnail: n, imageAlt: r, nw: i, nh: o, cw: m, ch: h, scale: g, mode: _, tx: v, ty: y, rotationDeg: b, flipH: x, flipV: S, controlsVisible: C, idleOpacity: w = .12, bottomPx: T = 22, onPanByDelta: E, onJumpToNatural: D, onUserActivity: O, onDragChange: k, ariaLabel: A, minimapTooltip: j }) {
	let M = c(() => ({
		cw: m,
		ch: h,
		nw: i,
		nh: o,
		scale: g,
		tx: v,
		ty: y,
		rotationDeg: b,
		flipH: x,
		flipV: S
	}), [
		m,
		h,
		i,
		o,
		g,
		v,
		y,
		b,
		x,
		S
	]), { rw: N, rh: P } = c(() => me(i, o, b), [
		i,
		o,
		b
	]), te = c(() => Math.min(V / Math.max(N, 1e-6), V / Math.max(P, 1e-6)) * .98, [N, P]), I = c(() => [
		de(0, 0, M),
		de(m, 0, M),
		de(m, h, M),
		de(0, h, M)
	].map((e) => he(e.nx, e.ny, i, o)), [
		M,
		m,
		h,
		i,
		o
	]), L = c(() => I.map((e) => {
		let { mx: t, my: n } = fe(e.nx, e.ny, V, V, i, o, te, b, x, S);
		return [t, n];
	}), [
		I,
		i,
		o,
		te,
		b,
		x,
		S
	]), ne = c(() => L.map(([e, t]) => `${e.toFixed(2)},${t.toFixed(2)}`).join(" "), [L]), R = c(() => xe(L), [L]), re = c(() => {
		let e = `M 0 0 L ${V} 0 L ${V} ${V} L 0 ${V} Z`;
		return L.length < 3 ? e : `${e} ${`${L.map(([e, t]) => `${e.toFixed(2)} ${t.toFixed(2)}`).reduce((e, t, n) => n === 0 ? `M ${t}` : `${e} L ${t}`, "")} Z`}`;
	}, [L]), ie = l({
		p: M,
		nw: i,
		nh: o,
		thumbS: te
	});
	s(() => {
		ie.current = {
			p: M,
			nw: i,
			nh: o,
			thumbS: te
		};
	}, [
		M,
		i,
		o,
		te
	]);
	let [ae, oe] = u(!1), se = l({
		x: 0,
		y: 0
	}), ce = l(null), le = l(null), ue = l(E), z = l(D), B = l(O), _e = l(k);
	s(() => {
		ue.current = E, z.current = D, B.current = O, _e.current = k;
	}, [
		E,
		D,
		O,
		k
	]);
	let we = () => {
		let e = ce.current;
		if (!e) return;
		window.removeEventListener("blur", e.blur), window.removeEventListener("pointermove", e.move, !0), window.removeEventListener("pointerup", e.up, !0), window.removeEventListener("pointercancel", e.up, !0), ce.current = null;
		let t = le.current;
		t && (le.current = null, Ce(t.el, t.id));
	}, Te = () => {
		ce.current && (we(), oe(!1), _e.current?.(!1), B.current?.());
	};
	a(() => () => {
		ce.current && (we(), _e.current?.(!1));
	}, []);
	let Ee = (e, t, n) => {
		ce.current && Te(), e.preventDefault(), e.stopPropagation(), ie.current = {
			p: n,
			nw: i,
			nh: o,
			thumbS: te
		};
		let r = e.pointerId;
		se.current = {
			x: e.clientX,
			y: e.clientY
		}, oe(!0), _e.current?.(!0), B.current?.();
		let a = (e, t) => {
			let n = e - se.current.x, r = t - se.current.y;
			if (se.current = {
				x: e,
				y: t
			}, n === 0 && r === 0) return;
			let { p: i, nw: a, nh: o, thumbS: s } = ie.current, { dtx: c, dty: l } = ve(n, r, i, a, o, V, s), u = ue.current;
			typeof u == "function" && Number.isFinite(c) && Number.isFinite(l) && u(c, l), B.current?.();
		}, s = () => Te();
		le.current = t ? Se(t, r) : null;
		let c = (e) => {
			e.pointerId === r && (e.preventDefault(), a(e.clientX, e.clientY));
		}, l = (e) => {
			e.pointerId === r && (e.preventDefault(), Te());
		};
		ce.current = {
			move: c,
			up: l,
			blur: s
		}, window.addEventListener("pointermove", c, {
			capture: !0,
			passive: !1
		}), window.addEventListener("pointerup", l, { capture: !0 }), window.addEventListener("pointercancel", l, { capture: !0 }), window.addEventListener("blur", s);
	}, De = (e) => {
		e.button === 0 && Ee(e, e.currentTarget, M);
	}, Oe = (e) => {
		if (e.button !== 0) return;
		let t = z.current;
		if (typeof t != "function" || ce.current) return;
		let n = e.currentTarget.ownerSVGElement;
		if (!n) return;
		let r = n.createSVGPoint();
		r.x = e.clientX, r.y = e.clientY;
		let a = n.getScreenCTM();
		if (!a) return;
		let s;
		try {
			s = r.matrixTransform(a.inverse());
		} catch {
			return;
		}
		let c = s.x, l = s.y;
		if (ge(c, l, L)) return;
		let { nx: u, ny: d } = pe(c, l, V, i, o, te, b, x, S), f = t(u, d);
		if (!f) return;
		let p = {
			...M,
			tx: f.tx,
			ty: f.ty
		};
		Ee(e, e.currentTarget, p);
	}, H = (b % 360 + 360) % 360, ke = H === 90 || H === 270, Ae = (ke ? o : i) * g, je = (ke ? i : o) * g;
	if (!(_ === "native" && (Ae > m + .5 || je > h + .5)) || i <= 0 || o <= 0 || m <= 0 || h <= 0) return null;
	let Me = i * te, Ne = o * te, Pe = `rotate(${b}deg)${x ? " scaleX(-1)" : ""}${S ? " scaleY(-1)" : ""}`;
	return /* @__PURE__ */ f(F, {
		content: j,
		children: /* @__PURE__ */ f("div", {
			role: "navigation",
			"aria-label": A,
			onWheel: (e) => {
				e.stopPropagation(), O?.();
			},
			style: {
				position: "absolute",
				right: 10,
				bottom: T,
				zIndex: 25,
				padding: ye,
				background: "rgba(8,12,22,0.88)",
				border: "2px solid rgba(255,255,255,0.92)",
				borderRadius: 4,
				boxShadow: "0 4px 18px rgba(0,0,0,0.55)",
				opacity: C ? 1 : w,
				transition: C ? "opacity 0.12s ease" : "opacity 1.6s ease",
				pointerEvents: C || w > 0 ? "auto" : "none",
				userSelect: "none",
				touchAction: "none",
				cursor: ae ? "grabbing" : D ? "default" : void 0
			},
			children: /* @__PURE__ */ p("div", {
				style: {
					width: V,
					height: V,
					position: "relative",
					overflow: "hidden",
					background: "rgba(0,0,0,0.35)"
				},
				children: [/* @__PURE__ */ f("div", {
					style: {
						position: "absolute",
						left: (V - Me) / 2,
						top: (V - Ne) / 2,
						width: Me,
						height: Ne,
						transform: Pe,
						transformOrigin: "center center",
						pointerEvents: "none",
						overflow: "hidden"
					},
					children: n == null ? /* @__PURE__ */ f(ee, {
						source: t ?? {
							type: "url",
							href: e
						},
						alt: r,
						draggable: !1,
						style: {
							width: "100%",
							height: "100%",
							objectFit: "fill",
							display: "block",
							pointerEvents: "none"
						}
					}) : /* @__PURE__ */ f("div", {
						style: {
							width: "100%",
							height: "100%",
							display: "flex",
							alignItems: "center",
							justifyContent: "center"
						},
						children: n
					})
				}), /* @__PURE__ */ p("svg", {
					width: V,
					height: V,
					style: {
						position: "absolute",
						left: 0,
						top: 0,
						display: "block"
					},
					"aria-hidden": "true",
					children: [
						D && /* @__PURE__ */ f("rect", {
							width: V,
							height: V,
							fill: "rgba(0,0,0,0.001)",
							style: {
								cursor: "pointer",
								touchAction: "none"
							},
							onPointerDown: Oe
						}),
						R ? /* @__PURE__ */ p(d, { children: [
							/* @__PURE__ */ f("rect", {
								x: 0,
								y: 0,
								width: V,
								height: R.minY,
								fill: be,
								style: { pointerEvents: "none" }
							}),
							/* @__PURE__ */ f("rect", {
								x: 0,
								y: R.maxY,
								width: V,
								height: V - R.maxY,
								fill: be,
								style: { pointerEvents: "none" }
							}),
							/* @__PURE__ */ f("rect", {
								x: 0,
								y: R.minY,
								width: R.minX,
								height: R.maxY - R.minY,
								fill: be,
								style: { pointerEvents: "none" }
							}),
							/* @__PURE__ */ f("rect", {
								x: R.maxX,
								y: R.minY,
								width: V - R.maxX,
								height: R.maxY - R.minY,
								fill: be,
								style: { pointerEvents: "none" }
							})
						] }) : /* @__PURE__ */ f("path", {
							d: re,
							fill: be,
							fillRule: "evenodd",
							style: { pointerEvents: "none" }
						}),
						/* @__PURE__ */ f("polygon", {
							points: ne,
							fill: "rgba(255,255,255,0.06)",
							stroke: "rgba(255,255,255,0.9)",
							strokeWidth: 1,
							strokeLinejoin: "miter",
							vectorEffect: "non-scaling-stroke",
							style: {
								cursor: ae ? "grabbing" : "grab",
								pointerEvents: "all"
							},
							onPointerDown: De
						})
					]
				})]
			})
		})
	});
}
//#endregion
//#region src/components/ImagePreview/parts/ImagePreviewCloseButton.tsx
function Te({ onClick: e, visible: t, idleOpacity: n = .1, label: r, tip: i }) {
	let [a, o] = u(!1);
	return /* @__PURE__ */ f(F, {
		content: i,
		children: /* @__PURE__ */ f("button", {
			type: "button",
			"aria-label": r,
			onClick: e,
			onMouseEnter: () => o(!0),
			onMouseLeave: () => o(!1),
			style: {
				position: "absolute",
				top: 14,
				right: 16,
				zIndex: 20,
				width: 46,
				height: 46,
				borderRadius: "50%",
				border: "1px solid rgba(255,255,255,0.22)",
				background: a ? "rgba(8,14,26,0.78)" : "rgba(8,14,26,0.50)",
				backdropFilter: "blur(6px)",
				WebkitBackdropFilter: "blur(6px)",
				boxShadow: "0 2px 12px rgba(0,0,0,0.45)",
				color: "rgba(235,242,255,0.92)",
				cursor: "pointer",
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				opacity: t ? 1 : n,
				transition: t ? "opacity 0.12s ease, background 0.15s" : "opacity 1.6s ease, background 0.15s",
				pointerEvents: t || n > 0 ? "auto" : "none",
				flexShrink: 0
			},
			children: /* @__PURE__ */ p("svg", {
				viewBox: "0 0 24 24",
				fill: "none",
				stroke: "currentColor",
				strokeWidth: 2.5,
				width: 18,
				height: 18,
				"aria-hidden": "true",
				children: [/* @__PURE__ */ f("line", {
					x1: "18",
					y1: "6",
					x2: "6",
					y2: "18"
				}), /* @__PURE__ */ f("line", {
					x1: "6",
					y1: "6",
					x2: "18",
					y2: "18"
				})]
			})
		})
	});
}
//#endregion
//#region src/components/ImagePreview/parts/OriginalTooLargeNotice.tsx
function Ee({ message: e }) {
	return /* @__PURE__ */ f("div", {
		"data-rip-original-too-large-notice": "",
		role: "status",
		"aria-live": "polite",
		style: De,
		children: e
	});
}
var De = {
	position: "absolute",
	top: 16,
	left: "50%",
	transform: "translateX(-50%)",
	zIndex: 19,
	maxWidth: "min(560px, calc(100% - 120px))",
	padding: "10px 16px",
	borderRadius: 10,
	border: "1px solid rgba(251, 191, 36, 0.55)",
	background: "rgba(28, 18, 4, 0.88)",
	boxShadow: "0 8px 28px rgba(0,0,0,0.45)",
	color: "#fde68a",
	fontSize: 14,
	fontWeight: 650,
	letterSpacing: "0.01em",
	lineHeight: 1.45,
	textAlign: "center",
	pointerEvents: "none"
}, Oe = [
	"file",
	"camera",
	"exposure",
	"gps",
	"other"
], H = {
	file: [
		"fileName",
		"fileSize",
		"mimeType",
		"width",
		"height",
		"colorSpace",
		"orientation"
	],
	camera: [
		"make",
		"model",
		"lens",
		"software",
		"dateTimeOriginal",
		"dateTimeDigitized",
		"createDate"
	],
	exposure: [
		"exposureTime",
		"fNumber",
		"iso",
		"focalLength",
		"focalLength35mm",
		"exposureProgram",
		"meteringMode",
		"flash",
		"whiteBalance",
		"exposureBias"
	],
	gps: [
		"gpsLatitude",
		"gpsLongitude",
		"gpsAltitude"
	]
}, ke = new Set(Object.values(H).flat());
function Ae(e) {
	return e == null ? !1 : typeof e == "string" ? e.trim() !== "" : typeof e == "number" ? Number.isFinite(e) : !0;
}
function je(e, t, n) {
	return Ae(e) ? typeof e == "boolean" ? e ? t : n : typeof e == "number" ? String(e) : String(e).trim() : null;
}
function Me(e) {
	return e === "file" || e === "camera" || e === "exposure" || e === "gps" || e === "other" ? e : "other";
}
function Ne(e, t, n) {
	if (!e) return [];
	let r = /* @__PURE__ */ new Map();
	for (let e of Oe) r.set(e, []);
	for (let i of [
		"file",
		"camera",
		"exposure",
		"gps"
	]) {
		let a = H[i], o = r.get(i);
		for (let r of a) {
			let i = je(e[r], t, n);
			i != null && o.push({
				key: r,
				labelKey: r,
				labelFallback: null,
				value: i
			});
		}
	}
	let i = Array.isArray(e.extra) ? e.extra : [];
	for (let a of i) {
		if (!a || typeof a.key != "string" || a.key.trim() === "" || ke.has(a.key) && Ae(e[a.key])) continue;
		let i = je(a.value, t, n);
		if (i == null) continue;
		let o = Me(a.group), s = typeof a.label == "string" && a.label.trim() !== "" ? a.label.trim() : a.key;
		r.get(o).push({
			key: `extra:${a.key}`,
			labelKey: null,
			labelFallback: s,
			value: i
		});
	}
	return Oe.map((e) => ({
		id: e,
		rows: r.get(e)
	})).filter((e) => e.rows.length > 0);
}
//#endregion
//#region src/components/ImagePreview/parts/ExifInfoPanel.tsx
var Pe = 300, Fe = .62, Ie = 0, Le = "#f0f1f3", Re = "rgba(40,48,64,0.12)", ze = "#2a3140", Be = "#6b7385", Ve = "rgba(40,48,64,0.12)", He = "rgba(40,48,64,0.07)", U = "rgba(40,48,64,0.08)";
function Ue(e, t) {
	switch (e) {
		case "file": return t.exifGroupFile;
		case "camera": return t.exifGroupCamera;
		case "exposure": return t.exifGroupExposure;
		case "gps": return t.exifGroupGps;
		default: return t.exifGroupOther;
	}
}
function We(e, t) {
	return e.labelKey ? {
		fileName: t.exifFieldFileName,
		fileSize: t.exifFieldFileSize,
		mimeType: t.exifFieldMimeType,
		width: t.exifFieldWidth,
		height: t.exifFieldHeight,
		colorSpace: t.exifFieldColorSpace,
		orientation: t.exifFieldOrientation,
		make: t.exifFieldMake,
		model: t.exifFieldModel,
		lens: t.exifFieldLens,
		software: t.exifFieldSoftware,
		dateTimeOriginal: t.exifFieldDateTimeOriginal,
		dateTimeDigitized: t.exifFieldDateTimeDigitized,
		createDate: t.exifFieldCreateDate,
		exposureTime: t.exifFieldExposureTime,
		fNumber: t.exifFieldFNumber,
		iso: t.exifFieldIso,
		focalLength: t.exifFieldFocalLength,
		focalLength35mm: t.exifFieldFocalLength35mm,
		exposureProgram: t.exifFieldExposureProgram,
		meteringMode: t.exifFieldMeteringMode,
		flash: t.exifFieldFlash,
		whiteBalance: t.exifFieldWhiteBalance,
		exposureBias: t.exifFieldExposureBias,
		gpsLatitude: t.exifFieldGpsLatitude,
		gpsLongitude: t.exifFieldGpsLongitude,
		gpsAltitude: t.exifFieldGpsAltitude
	}[e.labelKey] ?? e.labelKey : e.labelFallback ?? e.key;
}
function W(e, t, n) {
	return n < t ? t : Math.min(n, Math.max(t, e));
}
function G(e, t, n, r, i) {
	return e === "left" || e === "right" ? Math.max(0, i - n) : Math.max(0, r - t);
}
function K(e, t, n, r, i) {
	let a = G(e.edge, t, n, r, i), o = W(e.along, 0, a);
	switch (e.edge) {
		case "right": return {
			top: o,
			right: Ie,
			left: "auto",
			bottom: "auto"
		};
		case "left": return {
			top: o,
			left: Ie,
			right: "auto",
			bottom: "auto"
		};
		case "top": return {
			top: Ie,
			left: o,
			right: "auto",
			bottom: "auto"
		};
		case "bottom": return {
			bottom: Ie,
			left: o,
			right: "auto",
			top: "auto"
		};
	}
}
function Ge(e, t, n, r) {
	let i = e, a = n - e, o = t, s = r - t, c = Math.min(i, a, o, s);
	return c === i ? "left" : c === a ? "right" : c === o ? "top" : "bottom";
}
function Ke(e, t, n, r, i) {
	return e === "left" || e === "right" ? n - i / 2 : t - r / 2;
}
function qe({ exif: e, strings: t, onUserActivity: n }) {
	let r = c(() => Ne(e, t.exifBoolYes, t.exifBoolNo), [
		e,
		t.exifBoolYes,
		t.exifBoolNo
	]), a = l(null), o = l(null), m = l({}), [h, g] = u({
		edge: "right",
		along: 0
	}), [_, v] = u(!1), [y, b] = u(null), [x, S] = u({
		w: Pe,
		h: 280
	}), [C, w] = u(null), T = C != null && r.some((e) => e.id === C) ? C : r[0]?.id ?? null;
	s(() => {
		let e = a.current;
		if (!e) return;
		let t = () => {
			S({
				w: e.offsetWidth || Pe,
				h: e.offsetHeight || 280
			});
		};
		t();
		let n = new ResizeObserver(t);
		return n.observe(e), () => n.disconnect();
	}, [r]);
	let E = typeof window < "u" ? window.innerWidth : 1200, D = typeof window < "u" ? window.innerHeight : 800, O = c(() => _ && y ? {
		left: y.left,
		top: y.top,
		right: "auto",
		bottom: "auto"
	} : K(h, x.w, x.h, E, D), [
		_,
		y,
		h,
		x,
		E,
		D
	]), k = i((e) => {
		w(e);
		let t = o.current, r = m.current[e];
		if (!t || !r) return;
		let i = r.offsetTop - 8;
		t.scrollTo({
			top: Math.max(0, i),
			behavior: "smooth"
		}), n?.();
	}, [n]), A = i((e) => {
		if (e.button !== 0) return;
		e.preventDefault(), e.stopPropagation(), n?.();
		let t = a.current;
		if (!t) return;
		let r = t.getBoundingClientRect(), i = e.clientX - r.left, o = e.clientY - r.top;
		v(!0), b({
			left: r.left,
			top: r.top
		});
		let s = (e) => {
			b({
				left: W(e.clientX - i, 0, window.innerWidth - r.width),
				top: W(e.clientY - o, 0, window.innerHeight - r.height)
			});
		}, c = (e) => {
			window.removeEventListener("pointermove", s), window.removeEventListener("pointerup", c), window.removeEventListener("pointercancel", c);
			let t = W(e.clientX - i, 0, window.innerWidth - r.width), a = W(e.clientY - o, 0, window.innerHeight - r.height), l = t + r.width / 2, u = a + r.height / 2, d = Ge(l, u, window.innerWidth, window.innerHeight);
			g({
				edge: d,
				along: Ke(d, l, u, r.width, r.height)
			}), v(!1), b(null), n?.();
		};
		window.addEventListener("pointermove", s), window.addEventListener("pointerup", c), window.addEventListener("pointercancel", c);
	}, [n]), j = Math.round(D * Fe);
	return /* @__PURE__ */ p("div", {
		ref: a,
		role: "complementary",
		"aria-label": t.exifPanel,
		onMouseDown: (e) => e.stopPropagation(),
		onClick: (e) => e.stopPropagation(),
		style: {
			position: "absolute",
			width: Pe,
			maxWidth: "100vw",
			maxHeight: j,
			display: "flex",
			flexDirection: "column",
			background: Le,
			color: ze,
			borderRadius: 10,
			border: `1px solid ${Re}`,
			boxShadow: "0 8px 28px rgba(0,0,0,0.28)",
			overflow: "hidden",
			pointerEvents: "auto",
			userSelect: _ ? "none" : "auto",
			...O
		},
		children: [/* @__PURE__ */ f("div", {
			onPointerDown: A,
			style: {
				display: "flex",
				alignItems: "center",
				justifyContent: "flex-start",
				padding: "8px 12px 6px",
				cursor: _ ? "grabbing" : "grab",
				touchAction: "none",
				borderBottom: `1px solid ${U}`,
				flexShrink: 0
			},
			"aria-label": t.exifDragHandle,
			title: t.exifDragHandle,
			children: /* @__PURE__ */ f("span", {
				style: {
					fontSize: 12,
					fontWeight: 650,
					color: ze,
					letterSpacing: "0.04em"
				},
				children: "EXIF"
			})
		}), r.length === 0 ? /* @__PURE__ */ f("div", {
			style: {
				padding: "20px 16px",
				fontSize: 13,
				color: Be,
				lineHeight: 1.5
			},
			children: t.exifEmpty
		}) : /* @__PURE__ */ p(d, { children: [r.length > 1 && /* @__PURE__ */ f("div", {
			role: "tablist",
			"aria-label": t.exifPanel,
			style: {
				display: "flex",
				flexWrap: "wrap",
				gap: 4,
				padding: "8px 8px 6px",
				borderBottom: `1px solid ${U}`,
				flexShrink: 0
			},
			children: r.map((e) => {
				let n = T === e.id;
				return /* @__PURE__ */ f("button", {
					type: "button",
					role: "tab",
					"aria-selected": n,
					onClick: () => k(e.id),
					style: {
						border: "none",
						borderRadius: 6,
						padding: "4px 8px",
						fontSize: 11,
						fontWeight: n ? 650 : 500,
						cursor: "pointer",
						background: n ? Ve : "transparent",
						color: n ? ze : Be,
						transition: "background 0.12s"
					},
					onMouseEnter: (e) => {
						n || (e.currentTarget.style.background = He);
					},
					onMouseLeave: (e) => {
						e.currentTarget.style.background = n ? Ve : "transparent";
					},
					children: Ue(e.id, t)
				}, e.id);
			})
		}), /* @__PURE__ */ f("div", {
			ref: o,
			style: {
				overflowY: "auto",
				overflowX: "hidden",
				flex: "1 1 auto",
				minHeight: 0,
				padding: "4px 0 10px",
				scrollBehavior: "smooth"
			},
			children: r.map((e) => /* @__PURE__ */ p("section", {
				ref: (t) => {
					m.current[e.id] = t;
				},
				"aria-label": Ue(e.id, t),
				style: { padding: "8px 12px 4px" },
				children: [/* @__PURE__ */ f("div", {
					style: {
						fontSize: 11,
						fontWeight: 700,
						letterSpacing: "0.06em",
						textTransform: "uppercase",
						color: Be,
						marginBottom: 6
					},
					children: Ue(e.id, t)
				}), e.rows.map((e) => /* @__PURE__ */ p("div", {
					style: {
						display: "grid",
						gridTemplateColumns: "1fr 1.15fr",
						gap: 8,
						padding: "5px 0",
						borderBottom: `1px solid ${U}`,
						fontSize: 12,
						lineHeight: 1.4
					},
					children: [/* @__PURE__ */ f("span", {
						style: {
							color: Be,
							wordBreak: "break-word"
						},
						children: We(e, t)
					}), /* @__PURE__ */ f("span", {
						style: {
							color: ze,
							fontWeight: 500,
							wordBreak: "break-word"
						},
						children: e.value
					})]
				}, e.key))]
			}, e.id))
		})] })]
	});
}
//#endregion
//#region src/components/ImagePreview/injectGlobalStyle.ts
var Je = /* @__PURE__ */ new Set();
function q(e, t) {
	if (typeof document > "u" || Je.has(e)) return;
	Je.add(e);
	let n = document.createElement("style");
	n.setAttribute("data-rip", e), n.textContent = t, document.head.appendChild(n);
}
//#endregion
//#region src/components/ImagePreview/parts/ThumbnailsStrip.tsx
q("rip-thumbnail-preload-indeterminate", "@keyframes _rip_thumbnail_preload{0%{transform:translateX(-110%)}100%{transform:translateX(310%)}}");
function Ye() {
	return typeof window > "u" ? 1024 : Math.max(320, Math.min(window.innerWidth || 1024, 1024));
}
function Xe(e, t, n, r, i) {
	let a = e.findIndex((e) => e.flatIndex === t);
	return a < 0 ? 0 : Math.max(0, a * n - i / 2 + r / 2);
}
function Ze(e, t) {
	return e.id ?? `${t}-${e.src}`;
}
var Qe = "#60a5fa", $e = "#c084fc", et = "rgba(226, 232, 240, 0.32)", tt = "#34d399", nt = "rgba(6, 10, 20, 0.55)", rt = 4, it = 3;
function at(e) {
	return e ? e.phase === "ready" || e.phase === "warm" || e.phase === "browse-ready" || e.phase === "display-ready" ? 1 : e.phase === "error" ? null : typeof e.progress == "number" && Number.isFinite(e.progress) ? Math.max(0, Math.min(1, e.progress)) : "indeterminate" : null;
}
function ot({ entries: e, activeFlatIndex: t, controlsVisible: n = !0, idleOpacity: r = .1, preloadStatus: i, ariaLabel: o, thumbAria: d, onSelect: m, onUserActivity: h, onVisibleIndexesChange: g }) {
	let _ = l(null), v = l(null), y = l(null), b = oe(), x = Ye(), [C, w] = u(!1), [T, E] = u(x), [D, O] = u(() => Xe(e, t, b, 60, x)), k = e.length * b - (e.length > 0 ? 6 : 0), A = se(e.length, T), j = c(() => {
		if (!A) return {
			start: 0,
			end: e.length
		};
		let t = Math.max(0, Math.floor(D / b) - 8), n = Math.max(1, Math.floor((T || 1) / b));
		return {
			start: t,
			end: Math.min(e.length, t + n + 16)
		};
	}, [
		A,
		D,
		b,
		T,
		e.length
	]), M = l(void 0);
	if (a(() => {
		if (!g) return;
		let t = e.slice(j.start, j.end).map((e) => e.flatIndex), n = t.join(","), r = M.current;
		r?.callback === g && r.signature === n || (M.current = {
			callback: g,
			signature: n
		}, g(t));
	}, [
		e,
		g,
		j.end,
		j.start
	]), s(() => {
		let n = y.current, r = v.current;
		if (!(!r || e.length === 0)) {
			if (A) {
				let n = Xe(e, t, b, 60, r.clientWidth || T);
				typeof r.scrollTo == "function" ? r.scrollTo({
					left: n,
					behavior: "auto"
				}) : r.scrollLeft = n, O((e) => e === n ? e : n);
				return;
			}
			!n || typeof n.scrollIntoView != "function" || n.scrollIntoView({
				block: "nearest",
				inline: "center",
				behavior: "auto"
			});
		}
	}, [
		t,
		A,
		e,
		b,
		60,
		T
	]), s(() => {
		let e = _.current, t = v.current;
		if (!e || !t) return;
		let n = () => {
			let n = t.clientWidth;
			w(t.scrollWidth > e.clientWidth + 1 || A), n > 0 && E((e) => e === n ? e : n), O((e) => e === t.scrollLeft ? e : t.scrollLeft);
		};
		n();
		let r = new ResizeObserver(n);
		return r.observe(e), r.observe(t), () => r.disconnect();
	}, [e, A]), e.length <= 1) return null;
	let N = (n, r) => {
		let { flatIndex: a, item: o } = n, s = a === t, c = s ? null : at(i?.[a]), l = s ? void 0 : i?.[a]?.phase, u = l === "warm", g = l === "browse-ready", _ = l === "display-ready", v = l === "loading" && i?.[a]?.targetLod === "browse", b = l === "loading" && i?.[a]?.targetLod === "screen", x = c === "indeterminate", C = S(o), w = _ ? Qe : g ? $e : b ? Qe : v ? $e : tt;
		return /* @__PURE__ */ p("button", {
			ref: s ? y : void 0,
			type: "button",
			"aria-label": d(r + 1, e.length),
			"aria-current": s ? "true" : void 0,
			onClick: () => {
				h?.(), m(a);
			},
			style: {
				position: "relative",
				flexShrink: 0,
				width: 56,
				height: 56,
				padding: 0,
				border: s ? "2px solid rgba(239, 246, 255, 0.96)" : "2px solid transparent",
				borderRadius: 4,
				background: "rgba(0, 0, 0, 0.35)",
				cursor: "pointer",
				opacity: 1,
				boxShadow: s ? "0 0 0 1px rgba(96, 165, 250, 0.55), 0 0 10px rgba(96, 165, 250, 0.24)" : "none",
				transition: "border-color 0.15s ease, box-shadow 0.15s ease",
				overflow: "hidden"
			},
			children: [C ? /* @__PURE__ */ f(ee, {
				source: C,
				alt: "",
				draggable: !1,
				loading: "lazy",
				decoding: "async",
				style: {
					display: "block",
					width: "100%",
					height: "100%",
					objectFit: "cover",
					pointerEvents: "none"
				}
			}) : null, c != null && /* @__PURE__ */ f("span", {
				"aria-hidden": !0,
				"data-preload-bar": l ?? "loading",
				title: _ ? "GPU-ready (blue): instant switch" : g ? "GPU Browse-ready (violet): instant medium-detail switch" : b ? `Preparing Screen LOD: ${Math.round((i?.[a]?.progress ?? 0) * 100)}%` : v ? `Preparing Browse LOD: ${Math.round((i?.[a]?.progress ?? 0) * 100)}%` : u || l === "ready" ? "Original cached (green)" : i?.[a]?.totalBytes ? `Downloading: ${Math.round((i[a].progress ?? 0) * 100)}%` : "Downloading: unknown total",
				style: {
					position: "absolute",
					left: rt,
					right: rt,
					bottom: 0,
					height: it,
					background: et,
					pointerEvents: "none",
					overflow: "hidden"
				},
				children: /* @__PURE__ */ f("span", { style: {
					display: "block",
					height: "100%",
					width: x ? "32%" : `${Number(c) * 100}%`,
					background: w,
					transition: x ? void 0 : "width 0.2s ease",
					animation: x ? "_rip_thumbnail_preload 1.1s ease-in-out infinite" : void 0
				} })
			})]
		}, Ze(o, a));
	};
	return /* @__PURE__ */ f("div", {
		role: "navigation",
		"aria-label": o,
		onMouseMove: h,
		onMouseDown: h,
		style: {
			position: "absolute",
			left: 0,
			right: 0,
			bottom: 0,
			zIndex: 9,
			display: "flex",
			justifyContent: "center",
			padding: C ? 0 : "0 16px 12px",
			pointerEvents: "none",
			opacity: n ? 1 : r,
			transition: n ? "opacity 0.12s ease" : "opacity 1.6s ease"
		},
		children: /* @__PURE__ */ f("div", {
			ref: _,
			style: {
				pointerEvents: "auto",
				width: C ? "100%" : "fit-content",
				maxWidth: "100%",
				background: nt,
				backdropFilter: "blur(12px)",
				WebkitBackdropFilter: "blur(12px)",
				borderRadius: C ? "10px 10px 0 0" : 10,
				boxShadow: C ? "0 -4px 24px rgba(0, 0, 0, 0.35)" : "0 4px 20px rgba(0, 0, 0, 0.35)",
				padding: "8px 16px"
			},
			children: /* @__PURE__ */ f("div", {
				ref: v,
				onScroll: () => {
					let e = v.current;
					e && O(e.scrollLeft);
				},
				style: {
					display: "flex",
					alignItems: "center",
					gap: A ? 0 : 6,
					overflowX: "auto",
					overflowY: "hidden",
					scrollbarWidth: "thin"
				},
				children: A ? /* @__PURE__ */ f("div", {
					style: {
						display: "flex",
						alignItems: "center",
						width: k,
						position: "relative",
						flexShrink: 0,
						height: 60
					},
					children: e.slice(j.start, j.end).map((e, t) => {
						let n = j.start + t;
						return /* @__PURE__ */ f("div", {
							style: {
								position: "absolute",
								left: n * b,
								top: 0
							},
							children: N(e, n)
						}, Ze(e.item, e.flatIndex));
					})
				}) : e.map((e, t) => N(e, t))
			})
		})
	});
}
//#endregion
//#region src/components/ImagePreview/parts/navArrowPolylines.ts
var st = "15,18 9,12 15,6", ct = "9,18 15,12 9,6", lt = "19,18 13,12 19,6", ut = "11,18 5,12 11,6", dt = "5,18 11,12 5,6", ft = "13,18 19,12 13,6";
//#endregion
//#region src/components/ImagePreview/parts/ImagePreviewNavArrow.tsx
function pt({ direction: e, isGroupJump: t = !1, onClick: n, onPointerDown: r, onPointerUp: i, onPointerCancel: a, label: o, tip: s, visible: c, idleOpacity: l = .1 }) {
	let [m, h] = u(!1);
	return /* @__PURE__ */ f(F, {
		content: s,
		children: /* @__PURE__ */ f("button", {
			type: "button",
			"aria-label": o,
			onClick: n,
			onPointerDown: r,
			onPointerUp: i,
			onPointerCancel: a,
			onPointerLeave: (e) => {
				e.buttons !== 0 && i?.(e), h(!1);
			},
			onMouseEnter: () => h(!0),
			onMouseLeave: () => h(!1),
			style: {
				position: "absolute",
				top: "50%",
				[e]: 16,
				transform: "translateY(-50%)",
				width: 44,
				height: 44,
				borderRadius: "50%",
				border: "1px solid rgba(255,255,255,0.28)",
				background: m ? "rgba(8,14,26,0.80)" : "rgba(8,14,26,0.52)",
				backdropFilter: "blur(6px)",
				WebkitBackdropFilter: "blur(6px)",
				boxShadow: "0 2px 16px rgba(0,0,0,0.55)",
				color: "rgba(235,242,255,0.92)",
				cursor: "pointer",
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				zIndex: 10,
				opacity: c ? 1 : l,
				pointerEvents: c || l > 0 ? "auto" : "none",
				transition: c ? "opacity 0.12s ease, background 0.15s, box-shadow 0.15s" : "opacity 1.6s ease, background 0.15s, box-shadow 0.15s"
			},
			children: /* @__PURE__ */ f("svg", {
				viewBox: "0 0 24 24",
				fill: "none",
				stroke: "currentColor",
				strokeWidth: 2.5,
				width: 22,
				height: 22,
				"aria-hidden": "true",
				children: e === "left" ? t ? /* @__PURE__ */ p(d, { children: [/* @__PURE__ */ f("polyline", { points: lt }), /* @__PURE__ */ f("polyline", { points: ut })] }) : /* @__PURE__ */ f("polyline", { points: st }) : t ? /* @__PURE__ */ p(d, { children: [/* @__PURE__ */ f("polyline", { points: dt }), /* @__PURE__ */ f("polyline", { points: ft })] }) : /* @__PURE__ */ f("polyline", { points: ct })
			})
		})
	});
}
//#endregion
//#region src/components/ImagePreview/Toolbar.tsx
var J = {
	text: "#cdd5e0",
	textMuted: "rgba(175,190,210,0.65)",
	textDisabled: "rgba(130,148,168,0.35)",
	active: "#cdd5e0",
	activeBg: "rgba(255,255,255,0.16)",
	hoverBg: "rgba(255,255,255,0.09)",
	divider: "rgba(140,162,188,0.22)",
	lockActive: "#7daaff"
}, mt = ({ children: e, size: t = 18, strokeWidth: n = 2 }) => /* @__PURE__ */ f("svg", {
	viewBox: "0 0 24 24",
	fill: "none",
	stroke: "currentColor",
	strokeWidth: n,
	strokeLinecap: "round",
	strokeLinejoin: "round",
	width: t,
	height: t,
	"aria-hidden": "true",
	children: e
}), ht = () => /* @__PURE__ */ p(mt, { children: [
	/* @__PURE__ */ f("circle", {
		cx: "11",
		cy: "11",
		r: "8"
	}),
	/* @__PURE__ */ f("line", {
		x1: "21",
		y1: "21",
		x2: "16.65",
		y2: "16.65"
	}),
	/* @__PURE__ */ f("line", {
		x1: "11",
		y1: "8",
		x2: "11",
		y2: "14"
	}),
	/* @__PURE__ */ f("line", {
		x1: "8",
		y1: "11",
		x2: "14",
		y2: "11"
	})
] }), gt = () => /* @__PURE__ */ p(mt, { children: [
	/* @__PURE__ */ f("circle", {
		cx: "11",
		cy: "11",
		r: "8"
	}),
	/* @__PURE__ */ f("line", {
		x1: "21",
		y1: "21",
		x2: "16.65",
		y2: "16.65"
	}),
	/* @__PURE__ */ f("line", {
		x1: "8",
		y1: "11",
		x2: "14",
		y2: "11"
	})
] }), _t = () => /* @__PURE__ */ f(mt, {
	strokeWidth: 2.5,
	children: /* @__PURE__ */ f("polyline", { points: "15,18 9,12 15,6" })
}), vt = () => /* @__PURE__ */ f(mt, {
	strokeWidth: 2.5,
	children: /* @__PURE__ */ f("polyline", { points: "9,18 15,12 9,6" })
}), Y = () => /* @__PURE__ */ p(mt, {
	strokeWidth: 2.5,
	children: [/* @__PURE__ */ f("polyline", { points: "19,18 13,12 19,6" }), /* @__PURE__ */ f("polyline", { points: "11,18 5,12 11,6" })]
}), yt = () => /* @__PURE__ */ p(mt, {
	strokeWidth: 2.5,
	children: [/* @__PURE__ */ f("polyline", { points: "5,18 11,12 5,6" }), /* @__PURE__ */ f("polyline", { points: "13,18 19,12 13,6" })]
}), bt = () => /* @__PURE__ */ p(mt, { children: [/* @__PURE__ */ f("path", { d: "M21 2v6h-6" }), /* @__PURE__ */ f("path", { d: "M21 13a9 9 0 1 1-3-7.7L21 8" })] }), xt = () => /* @__PURE__ */ p(mt, { children: [/* @__PURE__ */ f("path", { d: "M3 2v6h6" }), /* @__PURE__ */ f("path", { d: "M3 13a9 9 0 1 0 3-7.7L3 8" })] }), St = () => /* @__PURE__ */ p(mt, { children: [
	/* @__PURE__ */ f("path", {
		d: "M12 3v18",
		strokeDasharray: "2 2"
	}),
	/* @__PURE__ */ f("path", { d: "M5 8l-3 4 3 4" }),
	/* @__PURE__ */ f("path", { d: "M19 8l3 4-3 4" })
] }), Ct = () => /* @__PURE__ */ p(mt, { children: [
	/* @__PURE__ */ f("path", {
		d: "M3 12h18",
		strokeDasharray: "2 2"
	}),
	/* @__PURE__ */ f("path", { d: "M8 5l4-3 4 3" }),
	/* @__PURE__ */ f("path", { d: "M8 19l4 3 4-3" })
] }), wt = () => /* @__PURE__ */ f("svg", {
	viewBox: "0 0 24 24",
	fill: "none",
	stroke: "currentColor",
	strokeWidth: 2,
	strokeLinecap: "round",
	strokeLinejoin: "round",
	width: 18,
	height: 18,
	"aria-hidden": "true",
	children: /* @__PURE__ */ f("path", { d: "M3 9V3h6 M21 9V3h-6 M3 15v6h6 M21 15v6h-6" })
}), Tt = () => /* @__PURE__ */ p("svg", {
	viewBox: "0 0 28 18",
	width: 28,
	height: 18,
	fill: "none",
	stroke: "currentColor",
	strokeWidth: 1.8,
	strokeLinecap: "round",
	strokeLinejoin: "round",
	"aria-hidden": "true",
	children: [
		/* @__PURE__ */ f("line", {
			x1: "7",
			y1: "3",
			x2: "7",
			y2: "15"
		}),
		/* @__PURE__ */ f("line", {
			x1: "4",
			y1: "6",
			x2: "7",
			y2: "3"
		}),
		/* @__PURE__ */ f("circle", {
			cx: "14",
			cy: "7",
			r: 1.1,
			fill: "currentColor",
			stroke: "none"
		}),
		/* @__PURE__ */ f("circle", {
			cx: "14",
			cy: "11",
			r: 1.1,
			fill: "currentColor",
			stroke: "none"
		}),
		/* @__PURE__ */ f("line", {
			x1: "21",
			y1: "3",
			x2: "21",
			y2: "15"
		}),
		/* @__PURE__ */ f("line", {
			x1: "18",
			y1: "6",
			x2: "21",
			y2: "3"
		})
	]
}), Et = () => /* @__PURE__ */ p("svg", {
	viewBox: "0 0 24 24",
	fill: "none",
	stroke: "currentColor",
	strokeWidth: 2,
	strokeLinecap: "round",
	strokeLinejoin: "round",
	width: 16,
	height: 16,
	"aria-hidden": "true",
	children: [/* @__PURE__ */ f("rect", {
		x: "3",
		y: "11",
		width: "18",
		height: "11",
		rx: "2"
	}), /* @__PURE__ */ f("path", { d: "M7 11V7a5 5 0 0 1 9.9-1" })]
}), Dt = () => /* @__PURE__ */ p("svg", {
	viewBox: "0 0 24 24",
	fill: "none",
	stroke: "currentColor",
	strokeWidth: 2,
	strokeLinecap: "round",
	strokeLinejoin: "round",
	width: 16,
	height: 16,
	"aria-hidden": "true",
	children: [/* @__PURE__ */ f("rect", {
		x: "3",
		y: "11",
		width: "18",
		height: "11",
		rx: "2"
	}), /* @__PURE__ */ f("path", { d: "M7 11V7a5 5 0 0 1 10 0v4" })]
}), Ot = () => /* @__PURE__ */ p("svg", {
	viewBox: "0 0 24 24",
	fill: "none",
	stroke: "currentColor",
	strokeWidth: 2,
	strokeLinecap: "round",
	strokeLinejoin: "round",
	width: 17,
	height: 17,
	"aria-hidden": "true",
	children: [
		/* @__PURE__ */ f("circle", {
			cx: "12",
			cy: "12",
			r: "9"
		}),
		/* @__PURE__ */ f("line", {
			x1: "12",
			y1: "10",
			x2: "12",
			y2: "16"
		}),
		/* @__PURE__ */ f("circle", {
			cx: "12",
			cy: "7",
			r: "0.9",
			fill: "currentColor",
			stroke: "none"
		})
	]
}), kt = () => /* @__PURE__ */ p("svg", {
	viewBox: "0 0 24 24",
	fill: "none",
	stroke: "currentColor",
	strokeWidth: 2,
	strokeLinecap: "round",
	strokeLinejoin: "round",
	width: 17,
	height: 17,
	"aria-hidden": "true",
	children: [
		/* @__PURE__ */ f("polyline", { points: "3 6 5 6 21 6" }),
		/* @__PURE__ */ f("path", { d: "M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" }),
		/* @__PURE__ */ f("path", { d: "M10 11v6" }),
		/* @__PURE__ */ f("path", { d: "M14 11v6" }),
		/* @__PURE__ */ f("path", { d: "M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" })
	]
}), At = () => /* @__PURE__ */ p("svg", {
	viewBox: "0 0 24 24",
	fill: "none",
	stroke: "currentColor",
	strokeWidth: 2,
	strokeLinecap: "round",
	strokeLinejoin: "round",
	width: 17,
	height: 17,
	"aria-hidden": "true",
	children: [
		/* @__PURE__ */ f("path", { d: "M8 3H5a2 2 0 0 0-2 2v3" }),
		/* @__PURE__ */ f("path", { d: "M21 8V5a2 2 0 0 0-2-2h-3" }),
		/* @__PURE__ */ f("path", { d: "M3 16v3a2 2 0 0 0 2 2h3" }),
		/* @__PURE__ */ f("path", { d: "M16 21h3a2 2 0 0 0 2-2v-3" })
	]
}), jt = () => /* @__PURE__ */ p("svg", {
	viewBox: "0 0 24 24",
	fill: "none",
	stroke: "currentColor",
	strokeWidth: 2,
	strokeLinecap: "round",
	strokeLinejoin: "round",
	width: 17,
	height: 17,
	"aria-hidden": "true",
	children: [
		/* @__PURE__ */ f("path", { d: "M8 3v3a2 2 0 0 1-2 2H3" }),
		/* @__PURE__ */ f("path", { d: "M21 8h-3a2 2 0 0 1-2-2V3" }),
		/* @__PURE__ */ f("path", { d: "M3 16h3a2 2 0 0 1 2 2v3" }),
		/* @__PURE__ */ f("path", { d: "M16 21v-3a2 2 0 0 1 2-2h3" })
	]
});
function X({ label: e, tip: t, active: n, accent: r, children: i, ...a }) {
	let o = a.disabled ? J.textDisabled : r || J.text, s = n ? J.activeBg : "transparent";
	return /* @__PURE__ */ f(F, {
		content: t,
		children: /* @__PURE__ */ f("button", {
			type: "button",
			"aria-label": e,
			style: {
				display: "inline-flex",
				alignItems: "center",
				justifyContent: "center",
				width: 34,
				height: 34,
				borderRadius: 6,
				border: "none",
				cursor: a.disabled ? "not-allowed" : "pointer",
				background: s,
				color: o,
				transition: "background 0.15s, color 0.15s",
				flexShrink: 0
			},
			onMouseEnter: (e) => {
				a.disabled || (e.currentTarget.style.background = n ? J.activeBg : J.hoverBg);
			},
			onMouseLeave: (e) => {
				e.currentTarget.style.background = s;
			},
			...a,
			children: i
		})
	});
}
var Z = () => /* @__PURE__ */ f("div", { style: {
	width: 1,
	height: 18,
	background: J.divider,
	margin: "0 3px",
	flexShrink: 0
} });
function Mt({ name: e, style: t }) {
	let n = e.lastIndexOf(".");
	if (n <= 0) return /* @__PURE__ */ f("span", {
		style: {
			overflow: "hidden",
			textOverflow: "ellipsis",
			whiteSpace: "nowrap",
			...t
		},
		children: e
	});
	let r = e.slice(0, n), i = e.slice(n);
	if (r.length <= 11) return /* @__PURE__ */ p("span", {
		style: {
			display: "flex",
			minWidth: 0,
			overflow: "hidden",
			...t
		},
		children: [/* @__PURE__ */ f("span", {
			style: {
				overflow: "hidden",
				textOverflow: "ellipsis",
				whiteSpace: "nowrap",
				flexShrink: 1,
				minWidth: "2ch"
			},
			children: r
		}), /* @__PURE__ */ f("span", {
			style: {
				flexShrink: 0,
				whiteSpace: "nowrap"
			},
			children: i
		})]
	});
	let a = r.slice(0, r.length - 8), o = r.slice(-8) + i;
	return /* @__PURE__ */ p("span", {
		style: {
			display: "flex",
			minWidth: 0,
			overflow: "hidden",
			...t
		},
		children: [/* @__PURE__ */ f("span", {
			style: {
				overflow: "hidden",
				textOverflow: "ellipsis",
				whiteSpace: "nowrap",
				flexShrink: 1,
				minWidth: "2ch"
			},
			children: a
		}), /* @__PURE__ */ f("span", {
			style: {
				flexShrink: 0,
				whiteSpace: "nowrap"
			},
			children: o
		})]
	});
}
function Nt({ disabled: e = !1, mode: t, nativePercent: n, fitEquivalentNativePercent: r, stops: o, onFit: s, onSetNative: c, strings: d, zoomLabelSlotPx: m, zoomDropdownWidthPx: h }) {
	let [g, _] = u(!1), [v, y] = u(""), b = l(null), x = l(null), S = t === "fit" ? r === void 0 ? "—" : `${Math.round(r)}%` : `${Math.round(n)}%`, C = t === "native" ? Math.round(n) : null, w = i(() => {
		e || (y(t === "fit" ? r === void 0 ? "" : String(Math.round(r)) : String(Math.round(n))), _(!0), requestAnimationFrame(() => {
			x.current?.focus(), x.current?.select();
		}));
	}, [
		e,
		t,
		n,
		r
	]), T = i((e) => {
		let t = e.trim().replace("%", ""), n = parseInt(t, 10);
		!isNaN(n) && n > 0 && c(n), _(!1);
	}, [c]);
	a(() => {
		if (!g) return;
		let e = (e) => {
			b.current && !b.current.contains(e.target) && _(!1);
		};
		return document.addEventListener("mousedown", e), () => document.removeEventListener("mousedown", e);
	}, [g]);
	let E = [...o].sort((e, t) => t - e);
	return /* @__PURE__ */ p("div", {
		ref: b,
		style: {
			position: "relative",
			flexShrink: 0,
			width: m,
			display: "flex",
			justifyContent: "center",
			alignItems: "center"
		},
		children: [g ? /* @__PURE__ */ f("input", {
			ref: x,
			value: v,
			onChange: (e) => y(e.target.value),
			onKeyDown: (e) => {
				e.key === "Enter" && T(v), e.key === "Escape" && _(!1), e.stopPropagation();
			},
			style: {
				width: "100%",
				textAlign: "center",
				background: "rgba(255,255,255,0.08)",
				border: "1px solid rgba(180,200,225,0.3)",
				borderRadius: 5,
				color: J.text,
				fontSize: 13,
				padding: "3px 4px",
				outline: "none",
				boxSizing: "border-box"
			}
		}) : /* @__PURE__ */ f(F, {
			content: d.tipZoomLevel,
			children: /* @__PURE__ */ f("span", {
				onClick: w,
				role: "button",
				"aria-disabled": e,
				tabIndex: 0,
				onKeyDown: (e) => {
					(e.key === "Enter" || e.key === " ") && w();
				},
				style: {
					display: "block",
					width: "100%",
					boxSizing: "border-box",
					textAlign: "center",
					fontSize: 13,
					color: e ? J.textDisabled : J.text,
					cursor: e ? "not-allowed" : "pointer",
					padding: "3px 5px",
					borderRadius: 5,
					border: "1px solid transparent",
					fontVariantNumeric: "tabular-nums",
					transition: "border-color 0.15s",
					overflow: "hidden",
					textOverflow: "ellipsis",
					whiteSpace: "nowrap"
				},
				onMouseEnter: (e) => {
					e.currentTarget.style.borderColor = "rgba(180,200,225,0.28)";
				},
				onMouseLeave: (e) => {
					e.currentTarget.style.borderColor = "transparent";
				},
				children: S
			})
		}), g && /* @__PURE__ */ p("div", {
			style: {
				position: "absolute",
				bottom: "calc(100% + 8px)",
				left: "50%",
				transform: "translateX(-50%)",
				width: h,
				minWidth: 0,
				maxWidth: "min(92vw, 160px)",
				background: "rgba(12,16,26,0.97)",
				backdropFilter: "blur(12px)",
				WebkitBackdropFilter: "blur(12px)",
				border: "1px solid rgba(140,162,188,0.18)",
				borderRadius: 9,
				padding: "4px 0",
				boxShadow: "0 -6px 24px rgba(0,0,0,0.55)",
				zIndex: 200,
				boxSizing: "border-box"
			},
			children: [
				E.map((e) => /* @__PURE__ */ f(Pt, {
					label: `${e}%`,
					tip: d.tipZoomRowPercent(e),
					active: C === e,
					onMouseDown: () => {
						c(e), _(!1);
					}
				}, e)),
				/* @__PURE__ */ f("div", { style: {
					height: 1,
					background: J.divider,
					margin: "3px 0"
				} }),
				/* @__PURE__ */ f(Pt, {
					label: r === void 0 ? d.fit : d.fitApprox(Math.round(r)),
					tip: r === void 0 ? d.tipZoomRowFit : d.tipZoomRowFitApprox(Math.round(r)),
					active: t === "fit",
					onMouseDown: () => {
						s(), _(!1);
					}
				})
			]
		})]
	});
}
function Pt({ label: e, tip: t, active: n, onMouseDown: r }) {
	let [i, a] = u(!1);
	return /* @__PURE__ */ f(F, {
		content: t,
		children: /* @__PURE__ */ p("div", {
			onMouseDown: (e) => {
				e.preventDefault(), r();
			},
			onMouseEnter: () => a(!0),
			onMouseLeave: () => a(!1),
			style: {
				display: "flex",
				flexDirection: "row",
				justifyContent: "space-between",
				alignItems: "center",
				columnGap: 8,
				padding: "5px 8px",
				cursor: "pointer",
				background: n ? "rgba(88,101,242,0.18)" : i ? "rgba(255,255,255,0.06)" : "transparent",
				transition: "background 0.1s",
				boxSizing: "border-box",
				width: "100%",
				minWidth: 0
			},
			children: [/* @__PURE__ */ f("span", {
				style: {
					flex: "1 1 auto",
					minWidth: 0,
					fontSize: 13,
					color: n ? "#8fa8ff" : J.text,
					fontWeight: n ? 600 : 400,
					whiteSpace: "nowrap",
					fontVariantNumeric: "tabular-nums",
					overflow: "hidden",
					textOverflow: "ellipsis"
				},
				children: e
			}), /* @__PURE__ */ f("span", {
				style: {
					width: 14,
					flex: "0 0 14px",
					display: "flex",
					justifyContent: "center"
				},
				children: n && /* @__PURE__ */ f("svg", {
					viewBox: "0 0 16 16",
					fill: "currentColor",
					width: 12,
					height: 12,
					style: { color: "#8fa8ff" },
					"aria-hidden": "true",
					children: /* @__PURE__ */ f("path", { d: "M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z" })
				})
			})]
		})
	});
}
function Ft({ capabilities: e = {
	zoom: !0,
	nativeZoom: !0,
	pan: !0,
	rotate: !0,
	flip: !0,
	minimap: !0
}, mode: t, nativePercent: n, fitEquivalentNativePercent: r, atMinStop: i, totalImages: a, currentIndex: o, groupCurrentIndex: c, groupTotal: m, hasPrevGroup: h, hasNextGroup: g, onPrevGroup: _, onNextGroup: v, showToolbarArrows: y = !0, imageName: b, groupName: x, groupOrdinal: S, groupCount: C, showFlip: w = !1, showExif: T = !1, exifOpen: E = !1, showDelete: D = !1, showFullscreen: O = !1, isFullscreen: k = !1, toolbarExtra: A, zoomLocked: j, controlsVisible: M = !0, idleOpacity: N = .1, bottomPx: ee = 20, stops: P, onZoomIn: F, onZoomOut: te, onFit: I, onOneToOne: L, onSetNative: ne, onRotateCW: R, onRotateCCW: re, onFlipH: ie, onFlipV: ae, onPrev: oe, onNext: se, onToggleLock: ce, onToggleExif: le, onDeleteImage: ue, onToggleFullscreen: de, strings: z, zoomLabelSlotPx: B, zoomDropdownWidthPx: fe }) {
	let pe = Math.min(...P), me = e.zoom && (t === "native" ? !i : (r ?? 0) > pe), he = e.zoom, ge = m !== void 0 && c !== void 0, _e = ge || a > 1, ve = l(null), [V, ye] = u(560);
	return s(() => {
		let e = ve.current;
		if (!e) return;
		let t = () => ye(e.offsetWidth);
		t();
		let n = new ResizeObserver(t);
		return n.observe(e), () => n.disconnect();
	}, []), /* @__PURE__ */ p("div", {
		style: {
			position: "absolute",
			bottom: ee,
			left: "50%",
			transform: "translateX(-50%)",
			display: "flex",
			flexDirection: "column",
			alignItems: "center",
			gap: 5,
			userSelect: "none",
			zIndex: 10,
			opacity: M ? 1 : N,
			transition: M ? "opacity 0.12s ease" : "opacity 1.6s ease",
			pointerEvents: M || N > 0 ? "auto" : "none"
		},
		children: [b && /* @__PURE__ */ p("div", {
			style: {
				display: "inline-flex",
				flexDirection: "column",
				alignItems: "flex-start",
				gap: 2,
				background: "rgba(6,10,20,0.58)",
				backdropFilter: "blur(10px)",
				WebkitBackdropFilter: "blur(10px)",
				borderRadius: 7,
				padding: "5px 14px",
				maxWidth: V,
				minWidth: 0,
				overflow: "hidden",
				pointerEvents: "none"
			},
			children: [/* @__PURE__ */ f("div", {
				style: {
					display: "flex",
					alignItems: "baseline",
					gap: 7,
					width: "100%",
					minWidth: 0
				},
				children: /* @__PURE__ */ f(Mt, {
					name: b,
					style: {
						fontSize: 13,
						fontWeight: 500,
						color: J.text,
						flex: "1 1 0"
					}
				})
			}), x != null && x !== "" || S != null && C != null ? /* @__PURE__ */ p("div", {
				style: {
					display: "flex",
					alignItems: "baseline",
					gap: 6,
					minWidth: 0,
					width: "100%",
					maxWidth: "100%"
				},
				children: [S != null && C != null ? /* @__PURE__ */ p("span", {
					style: {
						fontSize: 12,
						color: J.textMuted,
						fontVariantNumeric: "tabular-nums",
						whiteSpace: "nowrap",
						flexShrink: 0
					},
					children: [
						"(",
						S,
						"/",
						C,
						")"
					]
				}) : null, x != null && x !== "" ? /* @__PURE__ */ f("span", {
					style: {
						fontSize: 11,
						color: "#c8d0e0",
						overflow: "hidden",
						textOverflow: "ellipsis",
						whiteSpace: "nowrap",
						minWidth: 0,
						flex: "1 1 0"
					},
					children: x
				}) : null]
			}) : null]
		}), /* @__PURE__ */ p("div", {
			ref: ve,
			role: "toolbar",
			"aria-label": z.toolbar,
			style: {
				display: "flex",
				flexWrap: "nowrap",
				alignItems: "center",
				gap: 1,
				padding: "3px 8px",
				borderRadius: 10,
				background: "rgba(6,10,20,0.68)",
				backdropFilter: "blur(14px)",
				WebkitBackdropFilter: "blur(14px)",
				boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
				maxWidth: "calc(100vw - 40px)"
			},
			children: [
				_e && /* @__PURE__ */ p(d, { children: [
					ge && /* @__PURE__ */ f(X, {
						label: z.prevGroup,
						tip: z.tipPrevGroup,
						onClick: _,
						disabled: !h,
						children: /* @__PURE__ */ f(Y, {})
					}),
					y && /* @__PURE__ */ f(X, {
						label: z.prev,
						tip: z.tipPrev,
						onClick: oe,
						disabled: o === 0,
						children: /* @__PURE__ */ f(_t, {})
					}),
					/* @__PURE__ */ f("span", {
						style: {
							fontSize: 12,
							color: J.textMuted,
							minWidth: 52,
							textAlign: "center",
							fontVariantNumeric: "tabular-nums",
							whiteSpace: "nowrap",
							padding: "0 4px",
							flexShrink: 0
						},
						children: ge ? `${c} / ${m}` : `${o + 1} / ${a}`
					}),
					y && /* @__PURE__ */ f(X, {
						label: z.next,
						tip: z.tipNext,
						onClick: se,
						disabled: o === a - 1,
						children: /* @__PURE__ */ f(vt, {})
					}),
					ge && /* @__PURE__ */ f(X, {
						label: z.nextGroup,
						tip: z.tipNextGroup,
						onClick: v,
						disabled: !g,
						children: /* @__PURE__ */ f(yt, {})
					}),
					/* @__PURE__ */ f(Z, {})
				] }),
				w && /* @__PURE__ */ p(d, { children: [
					/* @__PURE__ */ f(X, {
						label: z.flipH,
						tip: z.tipFlipH,
						onClick: ie,
						disabled: !e.flip,
						children: /* @__PURE__ */ f(St, {})
					}),
					/* @__PURE__ */ f(X, {
						label: z.flipV,
						tip: z.tipFlipV,
						onClick: ae,
						disabled: !e.flip,
						children: /* @__PURE__ */ f(Ct, {})
					}),
					/* @__PURE__ */ f(Z, {})
				] }),
				/* @__PURE__ */ f(X, {
					label: z.rotateCCW,
					tip: z.tipRotateCCW,
					onClick: re,
					disabled: !e.rotate,
					children: /* @__PURE__ */ f(xt, {})
				}),
				/* @__PURE__ */ f(X, {
					label: z.rotateCW,
					tip: z.tipRotateCW,
					onClick: R,
					disabled: !e.rotate,
					children: /* @__PURE__ */ f(bt, {})
				}),
				/* @__PURE__ */ f(Z, {}),
				/* @__PURE__ */ f(X, {
					label: z.fitToViewport,
					tip: z.tipFitToViewport,
					onClick: I,
					disabled: !e.zoom,
					active: t === "fit",
					children: /* @__PURE__ */ f(wt, {})
				}),
				/* @__PURE__ */ f(X, {
					label: z.actualSize,
					tip: z.tipActualSize,
					onClick: L,
					disabled: !e.nativeZoom,
					active: t === "native" && n === 100,
					children: /* @__PURE__ */ f(Tt, {})
				}),
				/* @__PURE__ */ f(Z, {}),
				/* @__PURE__ */ f(X, {
					label: z.zoomOut,
					tip: z.tipZoomOut,
					onClick: te,
					disabled: !me,
					children: /* @__PURE__ */ f(gt, {})
				}),
				/* @__PURE__ */ f(Nt, {
					disabled: !e.zoom,
					mode: t,
					nativePercent: n,
					fitEquivalentNativePercent: r,
					stops: P,
					onFit: I,
					onSetNative: ne,
					strings: z,
					zoomLabelSlotPx: B,
					zoomDropdownWidthPx: fe
				}),
				/* @__PURE__ */ f(X, {
					label: z.zoomIn,
					tip: z.tipZoomIn,
					onClick: F,
					disabled: !he,
					children: /* @__PURE__ */ f(ht, {})
				}),
				/* @__PURE__ */ f(X, {
					label: j ? z.unlockZoom : z.lockZoom,
					tip: j ? z.tipUnlockZoom : z.tipLockZoom,
					active: j,
					accent: j ? J.lockActive : void 0,
					onClick: ce,
					disabled: !e.zoom,
					children: f(j ? Dt : Et, {})
				}),
				T && /* @__PURE__ */ p(d, { children: [/* @__PURE__ */ f(Z, {}), /* @__PURE__ */ f(X, {
					label: E ? z.hideExif : z.showExif,
					tip: E ? z.tipHideExif : z.tipShowExif,
					active: E,
					onClick: le,
					children: /* @__PURE__ */ f(Ot, {})
				})] }),
				D && /* @__PURE__ */ p(d, { children: [/* @__PURE__ */ f(Z, {}), /* @__PURE__ */ f(X, {
					label: z.deleteImage,
					tip: z.tipDeleteImage,
					onClick: ue,
					children: /* @__PURE__ */ f(kt, {})
				})] }),
				O && /* @__PURE__ */ p(d, { children: [/* @__PURE__ */ f(Z, {}), /* @__PURE__ */ f(X, {
					label: k ? z.exitFullscreen : z.enterFullscreen,
					tip: k ? z.tipExitFullscreen : z.tipEnterFullscreen,
					active: k,
					onClick: de,
					children: f(k ? jt : At, {})
				})] }),
				A != null && /* @__PURE__ */ p(d, { children: [/* @__PURE__ */ f(Z, {}), /* @__PURE__ */ f("div", {
					style: {
						display: "flex",
						alignItems: "center",
						gap: 4
					},
					children: A
				})] })
			]
		})]
	});
}
//#endregion
//#region src/components/ImagePreview/core/media-contract.ts
var It = Object.freeze({
	zoom: !1,
	nativeZoom: !1,
	pan: !1,
	rotate: !1,
	flip: !1,
	minimap: !1
}), Lt = class {
	controller = null;
	generation = 0;
	attach(e) {
		this.controller = e;
		let t = ++this.generation;
		return () => {
			this.generation !== t || this.controller !== e || (this.controller = null, this.generation += 1);
		};
	}
	execute(e) {
		let t = this.controller;
		return t ? (t.execute(e), !0) : !1;
	}
	getCapabilities() {
		return this.controller?.getCapabilities() ?? It;
	}
	getViewState() {
		return this.controller?.getViewState() ?? {};
	}
	get attached() {
		return this.controller !== null;
	}
}, Rt = new Set([
	"jpg",
	"jpeg",
	"jpe",
	"bmp",
	"avif",
	"heic",
	"heif",
	"tif",
	"tiff",
	"ico"
]), zt = new Set([
	"mp4",
	"m4v",
	"mov",
	"webm",
	"ogv",
	"avi",
	"mkv",
	"mpeg",
	"mpg"
]);
function Q(e) {
	if (e.kind) return e.kind;
	if (e.header) {
		let t = Vt(e.header);
		if (t) return t;
	}
	let t = Qt(e.mimeType);
	if (t === "image/svg+xml") return "svg";
	if (t === "image/gif" || t === "image/apng") return "animated-image";
	if (t?.startsWith("video/")) return "video";
	if (t === "image/png" || t === "image/webp") return "unknown";
	if (t?.startsWith("image/")) return "raster";
	let n = Zt(e.href);
	return n ? n === "svg" || n === "svgz" ? "svg" : n === "gif" || n === "apng" ? "animated-image" : n === "png" || n === "webp" ? "unknown" : zt.has(n) ? "video" : Rt.has(n) ? "raster" : "unknown" : "unknown";
}
async function Bt(e, t = {}) {
	if (t.kind) return t.kind;
	let n = t.href ?? (e.type === "url" ? e.href : void 0), r = t.mimeType ?? w(e), i = Q({
		mimeType: r,
		href: n
	});
	if (i !== "unknown") return i;
	try {
		return Q({
			mimeType: r,
			href: n,
			header: await A(e, t.sniffBytes, t)
		});
	} catch {
		return Q({
			mimeType: r,
			href: n
		});
	}
}
function Vt(e) {
	let t = e instanceof Uint8Array ? e : new Uint8Array(e);
	return Gt(t) ? "animated-image" : Kt(t) ? Ht(t) : qt(t) ? Ut(t) : Xt(t) ? "svg" : Jt(t) || $(t) || Yt(t) ? "raster" : Wt(t);
}
function Ht(e) {
	let t = 8;
	for (; t + 12 <= e.length;) {
		let n = en(e, t), r = $t(e, t + 4, 4);
		if (r === "acTL") return "animated-image";
		if (r === "IDAT" || r === "IEND") return "raster";
		let i = t + 12 + n;
		if (!Number.isSafeInteger(i) || i <= t || i > e.length) break;
		t = i;
	}
	return null;
}
function Ut(e) {
	let t = 12;
	for (; t + 8 <= e.length;) {
		let n = $t(e, t, 4), r = tn(e, t + 4), i = t + 8;
		if (n === "ANIM" || n === "ANMF") return "animated-image";
		if (n === "VP8X" && i < e.length) return e[i] & 2 ? "animated-image" : "raster";
		if (n === "VP8 " || n === "VP8L") return "raster";
		let a = i + r + r % 2;
		if (!Number.isSafeInteger(a) || a <= t || a > e.length) break;
		t = a;
	}
	return null;
}
function Wt(e) {
	if (e.length < 16 || $t(e, 4, 4) !== "ftyp") return null;
	let t = $t(e, 8, Math.min(e.length - 8, 48));
	return /avis/.test(t) ? "animated-image" : /(avif|heic|heix|hevc|mif1|msf1)/.test(t) ? "raster" : /(isom|iso2|mp41|mp42|M4V |qt {2})/.test(t) ? "video" : null;
}
function Gt(e) {
	let t = $t(e, 0, 6);
	return t === "GIF87a" || t === "GIF89a";
}
function Kt(e) {
	return e.length >= 8 && e[0] === 137 && $t(e, 1, 3) === "PNG" && e[4] === 13 && e[5] === 10 && e[6] === 26 && e[7] === 10;
}
function qt(e) {
	return e.length >= 12 && $t(e, 0, 4) === "RIFF" && $t(e, 8, 4) === "WEBP";
}
function Jt(e) {
	return e.length >= 3 && e[0] === 255 && e[1] === 216 && e[2] === 255;
}
function $(e) {
	return e.length >= 2 && e[0] === 66 && e[1] === 77;
}
function Yt(e) {
	if (e.length < 4) return !1;
	let t = e[0] === 73 && e[1] === 73 && e[2] === 42 && e[3] === 0, n = e[0] === 77 && e[1] === 77 && e[2] === 0 && e[3] === 42;
	return t || n;
}
function Xt(e) {
	if (e.length === 0) return !1;
	let t = new TextDecoder().decode(e.subarray(0, Math.min(e.length, 4096))).replace(/^\uFEFF/, "").trimStart();
	return /^(?:<\?xml[\s\S]*?\?>\s*)?(?:<!--[\s\S]*?-->\s*)*<svg(?:\s|>)/i.test(t);
}
function Zt(e) {
	return e ? (e.split(/[?#]/, 1)[0] ?? "").match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase() ?? null : null;
}
function Qt(e) {
	return e?.split(";", 1)[0]?.trim().toLowerCase() || void 0;
}
function $t(e, t, n) {
	let r = "", i = Math.min(e.length, t + n);
	for (let n = Math.max(0, t); n < i; n += 1) r += String.fromCharCode(e[n]);
	return r;
}
function en(e, t) {
	return t + 4 > e.length ? 0 : e[t] * 16777216 + (e[t + 1] << 16) + (e[t + 2] << 8) + e[t + 3] >>> 0;
}
function tn(e, t) {
	return t + 4 > e.length ? 0 : e[t] + (e[t + 1] << 8) + (e[t + 2] << 16) + e[t + 3] * 16777216 >>> 0;
}
//#endregion
//#region src/components/ImagePreview/core/use-detected-media-kind.ts
function nn(e) {
	let { source: t, kind: n, mimeType: r, href: i, fileName: o } = e, s = c(() => {
		let e = Q({
			kind: n,
			mimeType: r,
			href: i
		});
		return e === "unknown" ? Q({ href: o }) : e;
	}, [
		n,
		r,
		i,
		o
	]), l = [
		n,
		r,
		i,
		o
	].join("\n"), [d, f] = u(null);
	a(() => {
		let e = !0;
		return s === "unknown" && Bt(t, {
			kind: n,
			mimeType: r,
			href: i
		}).then((n) => {
			e && f({
				source: t,
				key: l,
				kind: n
			});
		}), () => {
			e = !1;
		};
	}, [
		t,
		n,
		r,
		i,
		s,
		l
	]);
	let p = d?.source === t && d.key === l ? d : null;
	return {
		kind: p?.kind ?? s,
		pending: s === "unknown" && p === null
	};
}
//#endregion
//#region src/components/ImagePreview/renderers/raster-webgl/rasterLod.ts
var rn = 1, an = .6, on = 300, sn = 4096, cn = 1024 ** 3;
function ln(e, t) {
	return !Number.isFinite(e) || !Number.isFinite(t) || e <= 0 || t <= 0 ? 0 : Math.min(2 ** 53 - 1, Math.ceil(e) * Math.ceil(t) * 4);
}
function un(e, t, n, r, i = 1, a = sn) {
	let o = Math.max(1, Math.floor(e)), s = Math.max(1, Math.floor(t)), c = Math.max(1, n * Math.max(1, i)), l = Math.max(1, r * Math.max(1, i)), u = Number.isFinite(a) && a > 0 ? Math.max(1, Math.floor(a)) : sn, d = Math.min(1, c / o, l / s, u / Math.max(o, s));
	return {
		width: Math.max(1, Math.round(o * d)),
		height: Math.max(1, Math.round(s * d))
	};
}
function dn(e, t = cn) {
	let n = fn(t);
	if (!e || e.width <= 0 || e.height <= 0) return {
		status: "unknown",
		allowed: !1,
		limitBytes: n
	};
	let r = ln(e.width, e.height), i = r <= n;
	return {
		status: i ? "eligible" : "blocked",
		allowed: i,
		estimatedBytes: r,
		limitBytes: n
	};
}
function fn(e) {
	return !Number.isFinite(e) || e < 4 ? cn : Math.floor(e);
}
function pn(e, t = an) {
	let n = Math.max(.1, Math.min(1, t));
	return {
		width: Math.max(1, Math.round(e.width * n)),
		height: Math.max(1, Math.round(e.height * n))
	};
}
function mn(e, t = sn) {
	let n = Math.max(1, Math.round(e.width)), r = Math.max(1, Math.round(e.height)), i = Math.min(1, (Number.isFinite(t) && t > 0 ? Math.max(1, Math.floor(t)) : sn) / Math.max(n, r));
	return {
		width: Math.max(1, Math.round(n * i)),
		height: Math.max(1, Math.round(r * i))
	};
}
function hn(e, t, n, r) {
	if (t.width >= e.width && t.height >= e.height) return !1;
	let i = Math.max(0, n) * Math.max(1, r);
	return t.width < e.width && e.width * i > t.width * 1.01 || t.height < e.height && e.height * i > t.height * 1.01;
}
function gn({ images: e, currentIndex: t, direction: n, range: r, maxCount: i, allowPreviewSource: a = !0 }) {
	if (r === 0 || i <= 0 || e.length <= 1) return [];
	if (r === "auto") return _n(e, t, n, Math.max(1, Math.floor(i)), a);
	let o = Math.max(0, Math.floor(r)), s = [];
	for (let r = 1; r <= o; r += 1) {
		let o = t + r * n, c = t - r * n;
		for (let t of [o, c]) {
			let n = vn(e, t, t === o ? "forward" : "backward", r, a);
			if (n && s.push(n), s.length >= i) return s;
		}
	}
	return s;
}
function _n(e, t, n, r, i) {
	let a = [], o = [], s = !1, c = !1;
	for (let l = 1; l < e.length; l += 1) {
		if (!s) {
			let o = t + l * n;
			if (o < 0 || o >= e.length) s = !0;
			else {
				let t = vn(e, o, "forward", l, i);
				t && a.push(t), a.length >= r && (s = !0);
			}
		}
		if (!c) {
			let a = t - l * n;
			if (a < 0 || a >= e.length) c = !0;
			else {
				let t = vn(e, a, "backward", l, i);
				t && o.push(t), o.length >= r && (c = !0);
			}
		}
		if (s && c) break;
	}
	let l = [], u = (e) => {
		e && l.length < r && l.push(e);
	};
	for (let e = 0; e < 2; e += 1) u(a[e]), u(o[e]);
	for (let e = 2; e < 3; e += 1) u(a[e]);
	let d = 3, f = 2;
	for (; l.length < r && (d < a.length || f < o.length);) u(a[d++]), u(o[f++]);
	return l;
}
function vn(e, t, n, r, i) {
	let a = e[t];
	if (!a) return;
	let o = a.source?.type === "url" ? a.source.href : a.src, s = Q({
		kind: a.kind,
		mimeType: a.mimeType,
		href: o
	});
	if ((s === "unknown" ? Q({ href: a.name }) : s) === "raster") return {
		resourceKey: a.id ?? a.src,
		source: a.source ?? {
			type: "url",
			href: a.src
		},
		previewSource: i ? a.minimapSource ?? (a.minimapSrc ? {
			type: "url",
			href: a.minimapSrc
		} : void 0) : void 0,
		flatIndex: t,
		side: n,
		distance: r,
		knownSize: Number(a.exif?.width) > 0 && Number(a.exif?.height) > 0 ? {
			width: Number(a.exif?.width),
			height: Number(a.exif?.height)
		} : void 0
	};
}
function yn({ candidates: e, viewport: t, budgetBytes: n, reservedBytes: r, maxTextureSize: i }) {
	let a = mn({
		width: Math.max(1, Math.round(t.width * t.dpr)),
		height: Math.max(1, Math.round(t.height * t.dpr))
	}), o = pn(a), s = Math.max(0, Math.floor(n - r)), c = new Map(e.map((e) => [e.resourceKey, {
		browse: bn(e.knownSize, o, i),
		screen: bn(e.knownSize, a, i)
	}])), l = /* @__PURE__ */ new Map(), u = /* @__PURE__ */ new Map(), d = 0, f = 0, p = {
		forward: e.filter((e) => e.side === "forward").sort((e, t) => e.distance - t.distance),
		backward: e.filter((e) => e.side === "backward").sort((e, t) => e.distance - t.distance)
	}, m = e.reduce((e, t) => e + c.get(t.resourceKey).screen, 0), h = xn(e.map((e) => c.get(e.resourceKey).screen), .75), g = h > 0 ? Math.floor(s / h) : 0, _ = m <= s ? e.length : Math.min(e.length, Math.max(2, Math.min(5, g))), v = {
		forward: 0,
		backward: 0
	}, y = {
		forward: !1,
		backward: !1
	}, b = (e) => {
		if (y[e]) return;
		let t = p[e][v[e]];
		if (!t) {
			y[e] = !0;
			return;
		}
		let n = c.get(t.resourceKey).screen;
		if (f + n > s) {
			y[e] = !0;
			return;
		}
		l.set(t.resourceKey, "screen"), u.set(t.resourceKey, d++), v[e] += 1, f += n;
	};
	for (; l.size < _;) {
		let e = v.forward <= v.backward ? "forward" : "backward", t = e === "forward" ? "backward" : "forward", n = l.size;
		if (b(e), l.size === n && b(t), l.size === n) break;
	}
	let x = { ...v }, S = (e) => {
		let t = p[e];
		for (; x[e] < t.length;) {
			let n = t[x[e]++];
			if (!l.has(n.resourceKey)) return n;
		}
	}, C = {
		forward: S("forward"),
		backward: S("backward")
	};
	for (;;) {
		let e = [...l.keys()].filter((e) => p.forward.some((t) => t.resourceKey === e)).length, t = e <= l.size - e ? "forward" : "backward", n = [t, t === "forward" ? "backward" : "forward"].find((e) => {
			let t = C[e];
			return t && f + c.get(t.resourceKey).browse <= s;
		});
		if (!n) break;
		let r = C[n];
		l.set(r.resourceKey, "browse"), u.set(r.resourceKey, d++), f += c.get(r.resourceKey).browse, C[n] = S(n);
	}
	let w = e.flatMap((t, n) => {
		let r = l.get(t.resourceKey);
		if (!r) return [];
		let i = c.get(t.resourceKey);
		return [{
			...t,
			lod: r,
			targetBox: r === "screen" ? a : o,
			estimatedBytes: r === "screen" ? i.screen : i.browse,
			priority: (r === "screen" ? 90 : 60) - (u.get(t.resourceKey) ?? n) / Math.max(1, e.length)
		}];
	}).sort((e, t) => t.priority - e.priority), T = (e, t) => w.filter((n) => n.lod === e && n.side === t && n.flatIndex != null).map((e) => e.flatIndex);
	return {
		entries: w,
		snapshot: {
			viewport: {
				cssWidth: t.width,
				cssHeight: t.height,
				dpr: t.dpr,
				pixelWidth: a.width,
				pixelHeight: a.height
			},
			budgetBytes: n,
			reservedBytes: r,
			estimatedBytes: r + f,
			screenForwardIndexes: T("screen", "forward"),
			screenBackwardIndexes: T("screen", "backward"),
			browseForwardIndexes: T("browse", "forward"),
			browseBackwardIndexes: T("browse", "backward"),
			historyScreenIndexes: [],
			historyScreenBytes: 0
		}
	};
}
function bn(e, t, n) {
	let r = e ? un(e.width, e.height, t.width, t.height) : t, i = Math.min(1, Math.max(1, n) / Math.max(r.width, r.height));
	return Math.max(4, Math.round(r.width * i) * Math.round(r.height * i) * 4);
}
function xn(e, t) {
	if (e.length === 0) return 0;
	let n = [...e].sort((e, t) => e - t);
	return n[Math.min(n.length - 1, Math.max(0, Math.ceil(n.length * t) - 1))];
}
//#endregion
//#region src/components/ImagePreview/renderers/animated/zoomPan.ts
var Sn = Object.freeze({
	zoom: !0,
	nativeZoom: !0,
	pan: !0,
	rotate: !0,
	flip: !0,
	minimap: !1
});
function Cn(e) {
	return {
		transform: e.cssTransform,
		transformOrigin: "center center"
	};
}
//#endregion
//#region src/components/ImagePreview/renderers/animated/AnimatedImageViewer.tsx
function wn(e) {
	let { source: t, alt: n, transform: r, onDimensions: i, onPhaseChange: a, onError: o, onPresented: s } = e;
	return /* @__PURE__ */ f("div", {
		"data-rip-animated-viewer": "",
		style: Tn,
		children: /* @__PURE__ */ f("img", {
			src: N(t),
			alt: n,
			draggable: !1,
			onLoad: (e) => {
				i(e.currentTarget.naturalWidth, e.currentTarget.naturalHeight), a("display-ready"), s();
			},
			onError: () => o(/* @__PURE__ */ Error("Unable to load animated image source")),
			style: {
				display: "block",
				maxWidth: "none",
				maxHeight: "none",
				...Cn(r)
			}
		})
	});
}
var Tn = {
	position: "absolute",
	inset: 0,
	display: "flex",
	alignItems: "center",
	justifyContent: "center",
	overflow: "hidden",
	pointerEvents: "none"
};
//#endregion
//#region src/components/ImagePreview/renderers/raster-dom/RasterFallbackViewer.tsx
function En(e) {
	let { source: t, alt: n, naturalSize: r, transform: i, onDimensions: a, onPhaseChange: o, onError: s, onPresented: c } = e;
	return /* @__PURE__ */ f("div", {
		"data-rip-raster-fallback": "",
		style: Dn,
		children: /* @__PURE__ */ f("img", {
			src: N(t),
			alt: n,
			draggable: !1,
			onLoad: (e) => {
				a(r?.width ?? e.currentTarget.naturalWidth, r?.height ?? e.currentTarget.naturalHeight), o("display-ready"), c();
			},
			onError: () => s(/* @__PURE__ */ Error("Unable to load Raster fallback source")),
			style: r && (r.width > 8192 || r.height > 8192) ? {
				display: "block",
				maxWidth: "100%",
				maxHeight: "100%",
				width: "auto",
				height: "auto",
				objectFit: "contain"
			} : {
				display: "block",
				maxWidth: "none",
				maxHeight: "none",
				width: r?.width,
				height: r?.height,
				transform: i.cssTransform,
				transformOrigin: "center center"
			}
		})
	});
}
var Dn = {
	position: "absolute",
	inset: 0,
	display: "flex",
	alignItems: "center",
	justifyContent: "center",
	overflow: "hidden",
	pointerEvents: "none"
}, On = class {
	budgetBytes;
	entries = /* @__PURE__ */ new Map();
	priorities = /* @__PURE__ */ new Map();
	gl;
	protectedKeys = /* @__PURE__ */ new Set();
	usedBytes = 0;
	reservedBytes = 0;
	activeReservations = /* @__PURE__ */ new Set();
	constructor(e, t) {
		this.gl = e, this.budgetBytes = t;
	}
	get maxBytes() {
		return this.budgetBytes;
	}
	setMaxBytes(e) {
		for (let e of this.activeReservations) e.cancelled = !0;
		this.activeReservations.clear(), this.reservedBytes = 0, this.budgetBytes = Math.max(1, Math.floor(e)), this.enforceBudget();
	}
	get(e) {
		let t = this.entries.get(e);
		return t && (t.lastUsedAt = performance.now()), t;
	}
	put(e, t = 0) {
		return this.delete(e.key), this.makeRoom(e.estimatedBytes, !1, t) ? (this.entries.set(e.key, e), this.priorities.set(e.key, t), this.usedBytes += e.estimatedBytes, !0) : (this.gl.deleteTexture(e.texture), !1);
	}
	reserve(e, t, n, r = 0) {
		let i = Math.max(0, Math.floor(t));
		if (this.delete(e), !this.makeRoom(i, n, r)) return null;
		this.reservedBytes += i;
		let a = {
			bytes: i,
			cancelled: !1
		};
		this.activeReservations.add(a);
		let o = !1;
		return {
			commit: (e, t = 0) => o ? !1 : (o = !0, this.activeReservations.delete(a) && (this.reservedBytes = Math.max(0, this.reservedBytes - i)), a.cancelled || e.estimatedBytes !== i || this.usedBytes + this.reservedBytes + e.estimatedBytes > this.budgetBytes ? (this.gl.deleteTexture(e.texture), this.enforceBudget(), !1) : (this.entries.set(e.key, e), this.priorities.set(e.key, t), this.usedBytes += e.estimatedBytes, !0)),
			release: () => {
				o || (o = !0, this.activeReservations.delete(a) && (this.reservedBytes = Math.max(0, this.reservedBytes - i)), this.enforceBudget());
			}
		};
	}
	has(e) {
		return this.entries.has(e);
	}
	isResident(e) {
		return this.entries.get(e.key) === e;
	}
	bestResident(e) {
		for (let t of [
			"full",
			"display",
			"browse",
			"preview"
		]) {
			let n = this.entries.get(`${e}|${t}`);
			if (n) return n.lastUsedAt = performance.now(), n;
		}
	}
	prioritize(e) {
		this.priorities.clear();
		for (let [t, n] of e) this.entries.has(t) && this.priorities.set(t, n);
		this.enforceBudget();
	}
	protect(e) {
		this.protectedKeys = new Set(e), this.enforceBudget();
	}
	retainOnly(e) {
		let t = new Set(e), n = !1;
		for (let e of [...this.entries.keys()]) t.has(e) || (n = this.delete(e) || n);
		return n;
	}
	delete(e, t = !0) {
		let n = this.entries.get(e);
		return n ? (this.entries.delete(e), this.priorities.delete(e), this.usedBytes -= n.estimatedBytes, t && this.gl.deleteTexture(n.texture), !0) : !1;
	}
	rekey(e, t, n) {
		let r = this.entries.get(e);
		if (!r) return;
		let i = this.priorities.get(e) ?? 0;
		return e !== t && (this.delete(t), this.entries.delete(e), this.priorities.delete(e)), Object.assign(r, n, { key: t }), this.entries.set(t, r), this.priorities.set(t, i), this.protectedKeys.delete(e) && this.protectedKeys.add(t), r;
	}
	clear(e = !0) {
		if (e) for (let e of this.entries.values()) this.gl.deleteTexture(e.texture);
		this.entries.clear(), this.priorities.clear(), this.protectedKeys.clear(), this.usedBytes = 0;
		for (let e of this.activeReservations) e.cancelled = !0;
		this.activeReservations.clear(), this.reservedBytes = 0;
	}
	snapshot() {
		return {
			count: this.entries.size,
			usedBytes: this.usedBytes,
			reservedBytes: this.reservedBytes,
			maxBytes: this.budgetBytes,
			oversubscribed: this.usedBytes + this.reservedBytes > this.budgetBytes
		};
	}
	residentResourceKeys() {
		return [...new Set([...this.entries.values()].filter((e) => e.quality === "browse" || e.quality === "display" || e.quality === "full").map((e) => e.resourceKey))];
	}
	residentEntries() {
		return [...this.entries.values()];
	}
	enforceBudget() {
		for (; this.usedBytes + this.reservedBytes > this.budgetBytes && this.entries.size > 0;) {
			let e = this.selectVictim(!0);
			if (!e) break;
			this.delete(e.key);
		}
	}
	makeRoom(e, t, n) {
		if (e > this.budgetBytes) return !1;
		for (; this.usedBytes + this.reservedBytes + e > this.budgetBytes;) {
			let e = this.selectVictim(t);
			if (!e || !t && n < (this.priorities.get(e.key) ?? 0)) return !1;
			this.delete(e.key);
		}
		return !0;
	}
	selectVictim(e) {
		return [...this.entries.values()].filter((t) => e || !this.protectedKeys.has(t.key)).sort((e, t) => !!this.protectedKeys.has(e.key) - +!!this.protectedKeys.has(t.key) || (this.priorities.get(e.key) ?? 0) - (this.priorities.get(t.key) ?? 0) || e.lastUsedAt - t.lastUsedAt)[0];
	}
};
//#endregion
//#region src/components/ImagePreview/renderers/raster-webgl/rasterQuad.ts
function kn(e, t, n, r) {
	let i = e * r.scale / 2, a = t * r.scale / 2, o = r.rotation * Math.PI / 180, s = Math.cos(o), c = Math.sin(o), l = r.flipH ? -1 : 1, u = r.flipV ? -1 : 1, d = (e, t, i, a) => {
		let o = e * l, d = t * u, f = o * s - d * c, p = o * c + d * s, m = n.width / 2 + r.translateX + f, h = n.height / 2 + r.translateY + p;
		return [
			m / n.width * 2 - 1,
			1 - h / n.height * 2,
			i,
			a
		];
	};
	return new Float32Array([
		...d(-i, -a, 0, 0),
		...d(i, -a, 1, 0),
		...d(-i, a, 0, 1),
		...d(i, a, 1, 1)
	]);
}
//#endregion
//#region src/components/ImagePreview/renderers/raster-webgl/shaders.ts
var An = [
	"#version 300 es",
	"in vec2 a_position;",
	"in vec2 a_texCoord;",
	"out vec2 v_texCoord;",
	"void main() {",
	"  gl_Position = vec4(a_position, 0.0, 1.0);",
	"  v_texCoord = a_texCoord;",
	"}"
].join("\n"), jn = [
	"#version 300 es",
	"precision highp float;",
	"uniform sampler2D u_texture;",
	"in vec2 v_texCoord;",
	"out vec4 outColor;",
	"void main() {",
	"  outColor = texture(u_texture, v_texCoord);",
	"}"
].join("\n"), Mn = .9;
function Nn(e) {
	if (!e.webgl2Available) return {
		renderer: "dom-image",
		fallbackReason: "webgl2-unavailable"
	};
	let t = Number(e.maxTextureSize);
	if (!Number.isFinite(t) || t <= 0) return {
		renderer: "dom-image",
		fallbackReason: "renderer-initialization-failed"
	};
	let n = Math.max(1, Math.floor(t * Mn)), r = Number(e.naturalSize?.width), i = Number(e.naturalSize?.height);
	return Number.isFinite(r) && Number.isFinite(i) && (r > n || i > n) ? {
		renderer: "dom-image",
		fallbackReason: "texture-too-large",
		safeTextureSize: n
	} : {
		renderer: "webgl2",
		safeTextureSize: n
	};
}
var Pn = class extends Error {
	reason;
	cause;
	naturalSize;
	constructor(e, t, n, r) {
		super(t), this.name = "RasterRendererFallbackError", this.reason = e, this.cause = n, this.naturalSize = r;
	}
};
function Fn(e) {
	return e instanceof Pn ? e.naturalSize : void 0;
}
function In(e) {
	return e instanceof Pn ? e.reason : e instanceof DOMException && e.name === "QuotaExceededError" ? "texture-budget-exceeded" : null;
}
//#endregion
//#region src/components/ImagePreview/renderers/raster-webgl/WebGLRasterRenderer.ts
var Ln = class {
	canvas;
	gl;
	maxTextureSize;
	program = null;
	buffer = null;
	positionLocation = -1;
	texCoordLocation = -1;
	listeners = /* @__PURE__ */ new Set();
	onContextLost;
	onContextRestored;
	lastContextFailure = null;
	constructor(e) {
		this.canvas = e;
		let t = e.getContext("webgl2", {
			alpha: !0,
			antialias: !1,
			depth: !1,
			desynchronized: !0,
			powerPreference: "default",
			preserveDrawingBuffer: !1,
			stencil: !1
		});
		if (!t) throw new Pn("webgl2-unavailable", "WebGL2 is not available");
		this.gl = t, this.maxTextureSize = t.getParameter(t.MAX_TEXTURE_SIZE);
		try {
			this.initialize();
		} catch (e) {
			throw new Pn("renderer-initialization-failed", "Unable to initialize the WebGL2 Raster renderer", e);
		}
		this.onContextLost = (e) => {
			e.preventDefault(), this.listeners.forEach((e) => e("lost"));
		}, this.onContextRestored = () => {
			try {
				this.initialize(), this.lastContextFailure = null, this.listeners.forEach((e) => e("restored"));
			} catch (e) {
				this.lastContextFailure = e instanceof Error ? e : Error(String(e)), this.listeners.forEach((e) => e("restore-failed"));
			}
		}, e.addEventListener("webglcontextlost", this.onContextLost), e.addEventListener("webglcontextrestored", this.onContextRestored);
	}
	subscribeContext(e) {
		return this.listeners.add(e), () => this.listeners.delete(e);
	}
	get contextFailure() {
		return this.lastContextFailure;
	}
	resize(e) {
		let t = Math.max(1, Math.round(e.width * e.dpr)), n = Math.max(1, Math.round(e.height * e.dpr));
		this.canvas.width !== t && (this.canvas.width = t), this.canvas.height !== n && (this.canvas.height = n), this.gl.viewport(0, 0, t, n);
	}
	async upload(e) {
		let t = this.gl, n = t.createTexture();
		if (!n) throw new Pn("texture-create-failed", "Unable to create WebGL texture");
		let r = t.getParameter(t.TEXTURE_BINDING_2D);
		try {
			t.bindTexture(t.TEXTURE_2D, n), t.pixelStorei(t.UNPACK_FLIP_Y_WEBGL, !1), t.pixelStorei(t.UNPACK_PREMULTIPLY_ALPHA_WEBGL, !1), t.texParameteri(t.TEXTURE_2D, t.TEXTURE_WRAP_S, t.CLAMP_TO_EDGE), t.texParameteri(t.TEXTURE_2D, t.TEXTURE_WRAP_T, t.CLAMP_TO_EDGE), t.texParameteri(t.TEXTURE_2D, t.TEXTURE_MIN_FILTER, t.LINEAR), t.texParameteri(t.TEXTURE_2D, t.TEXTURE_MAG_FILTER, t.LINEAR), t.texImage2D(t.TEXTURE_2D, 0, t.RGBA, t.RGBA, t.UNSIGNED_BYTE, e);
			let r = t.getError();
			if (r !== t.NO_ERROR) throw new Pn("texture-upload-failed", `WebGL texture upload failed with error 0x${r.toString(16)}`);
			let i = t.fenceSync(t.SYNC_GPU_COMMANDS_COMPLETE, 0);
			if (!i) throw Error("Unable to create WebGL upload fence");
			t.flush();
			try {
				await Bn(t, i);
			} finally {
				t.deleteSync(i);
			}
			return n;
		} catch (e) {
			throw t.deleteTexture(n), e instanceof Pn ? e : new Pn("texture-upload-failed", "Unable to upload the Raster texture", e);
		} finally {
			t.bindTexture(t.TEXTURE_2D, r && t.isTexture(r) ? r : null);
		}
	}
	render(e, t, n) {
		if (this.gl.isContextLost() || !this.gl.isTexture(e.texture)) return !1;
		if (!this.program || !this.buffer) throw Error("WebGL renderer is not initialized");
		let r = this.gl;
		this.resize(t);
		let i = kn(e.naturalWidth, e.naturalHeight, t, n);
		return r.clearColor(0, 0, 0, 1), r.clear(r.COLOR_BUFFER_BIT), r.useProgram(this.program), r.bindBuffer(r.ARRAY_BUFFER, this.buffer), r.bufferData(r.ARRAY_BUFFER, i, r.DYNAMIC_DRAW), r.enableVertexAttribArray(this.positionLocation), r.vertexAttribPointer(this.positionLocation, 2, r.FLOAT, !1, 16, 0), r.enableVertexAttribArray(this.texCoordLocation), r.vertexAttribPointer(this.texCoordLocation, 2, r.FLOAT, !1, 16, 8), r.activeTexture(r.TEXTURE0), r.bindTexture(r.TEXTURE_2D, e.texture), r.drawArrays(r.TRIANGLE_STRIP, 0, 4), r.flush(), !0;
	}
	dispose() {
		this.canvas.removeEventListener("webglcontextlost", this.onContextLost), this.canvas.removeEventListener("webglcontextrestored", this.onContextRestored), this.buffer && this.gl.deleteBuffer(this.buffer), this.program && this.gl.deleteProgram(this.program), this.buffer = null, this.program = null, this.listeners.clear();
	}
	initialize() {
		this.buffer && this.gl.deleteBuffer(this.buffer), this.program && this.gl.deleteProgram(this.program);
		let e = Rn(this.gl, An, jn), t = this.gl.createBuffer();
		if (!t) throw this.gl.deleteProgram(e), Error("Unable to create WebGL vertex buffer");
		this.program = e, this.buffer = t, this.positionLocation = this.gl.getAttribLocation(e, "a_position"), this.texCoordLocation = this.gl.getAttribLocation(e, "a_texCoord"), this.gl.useProgram(e), this.gl.uniform1i(this.gl.getUniformLocation(e, "u_texture"), 0);
	}
};
function Rn(e, t, n) {
	let r = zn(e, e.VERTEX_SHADER, t), i = zn(e, e.FRAGMENT_SHADER, n), a = e.createProgram();
	if (!a) throw Error("Unable to create WebGL program");
	if (e.attachShader(a, r), e.attachShader(a, i), e.linkProgram(a), e.deleteShader(r), e.deleteShader(i), !e.getProgramParameter(a, e.LINK_STATUS)) {
		let t = e.getProgramInfoLog(a) ?? "unknown link error";
		throw e.deleteProgram(a), Error("WebGL program link failed: " + t);
	}
	return a;
}
function zn(e, t, n) {
	let r = e.createShader(t);
	if (!r) throw Error("Unable to create WebGL shader");
	if (e.shaderSource(r, n), e.compileShader(r), !e.getShaderParameter(r, e.COMPILE_STATUS)) {
		let t = e.getShaderInfoLog(r) ?? "unknown compile error";
		throw e.deleteShader(r), Error("WebGL shader compile failed: " + t);
	}
	return r;
}
function Bn(e, t, n = 5e3) {
	let r = performance.now();
	return new Promise((i, a) => {
		let o = () => {
			let s = e.clientWaitSync(t, 0, 0);
			s === e.ALREADY_SIGNALED || s === e.CONDITION_SATISFIED ? i() : s === e.WAIT_FAILED ? a(/* @__PURE__ */ Error("WebGL upload fence failed")) : performance.now() - r >= n ? a(/* @__PURE__ */ Error("WebGL upload exceeded " + n + "ms")) : requestAnimationFrame(o);
		};
		o();
	});
}
//#endregion
//#region src/components/ImagePreview/renderers/raster-webgl/PriorityTaskQueue.ts
var Vn = class {
	concurrency;
	reservedPriority;
	pending = [];
	active = 0;
	activeBackground = 0;
	sequence = 0;
	disposed = !1;
	constructor(e = 2, t = Infinity) {
		this.concurrency = Math.max(1, Math.floor(e)), this.reservedPriority = t;
	}
	schedule(e, t, n) {
		return this.disposed ? Promise.reject(/* @__PURE__ */ Error("Task queue has been disposed")) : new Promise((r, i) => {
			this.pending.push({
				tag: n,
				priority: e,
				sequence: this.sequence++,
				run: t,
				resolve: r,
				reject: i
			}), this.pending.sort((e, t) => t.priority - e.priority || e.sequence - t.sequence), this.drain();
		});
	}
	cancelPending(e, t = /* @__PURE__ */ Error(`Task queue group was cancelled: ${e}`)) {
		for (let n = this.pending.length - 1; n >= 0; --n) {
			if (this.pending[n].tag !== e) continue;
			let [r] = this.pending.splice(n, 1);
			r.reject(t);
		}
	}
	dispose() {
		this.disposed = !0;
		let e = /* @__PURE__ */ Error("Task queue has been disposed");
		for (let t of this.pending.splice(0)) t.reject(e);
	}
	drain() {
		for (; !this.disposed && this.active < this.concurrency && this.pending.length > 0;) {
			let e = this.pending.findIndex((e) => e.priority >= this.reservedPriority || this.activeBackground < Math.max(1, this.concurrency - 1));
			if (e < 0) break;
			let [t] = this.pending.splice(e, 1), n = t.priority < this.reservedPriority;
			this.active += 1, n && (this.activeBackground += 1), t.run().then(t.resolve, t.reject).finally(() => {
				--this.active, n && --this.activeBackground, this.drain();
			});
		}
	}
}, Hn = 512 * 1024;
async function Un(e) {
	let t = new Uint8Array(await e.slice(0, Hn).arrayBuffer());
	return Wn(t) ?? qn(t) ?? Jn(t) ?? Yn(t) ?? Xn(t);
}
function Wn(e) {
	if (e[0] !== 255 || e[1] !== 216) return;
	let t = 2, n = 1, r;
	for (; t + 4 <= e.length;) {
		for (; e[t] === 255;) t += 1;
		let i = e[t++];
		if (i === 217 || i === 218) break;
		if (i === 1 || i >= 208 && i <= 215) continue;
		let a = $n(e, t);
		if (a < 2 || t + a > e.length) break;
		let o = t + 2;
		i === 225 && (n = Kn(e, o, a - 2) ?? n), Gn(i) && a >= 7 && (r = {
			height: $n(e, o + 1),
			width: $n(e, o + 3)
		}), t += a;
	}
	if (!(!r?.width || !r.height)) return n >= 5 && n <= 8 ? {
		width: r.height,
		height: r.width
	} : r;
}
function Gn(e) {
	return e >= 192 && e <= 207 && ![
		196,
		200,
		204
	].includes(e);
}
function Kn(e, t, n) {
	if (n < 14 || String.fromCharCode(...e.subarray(t, t + 4)) !== "Exif") return;
	let r = t + 6, i = e[r] === 73 && e[r + 1] === 73, a = e[r] === 77 && e[r + 1] === 77;
	if (!i && !a) return;
	let o = (t) => i ? e[t] | e[t + 1] << 8 : $n(e, t), s = r + ((t) => i ? (e[t] | e[t + 1] << 8 | e[t + 2] << 16 | e[t + 3] << 24) >>> 0 : nr(e, t))(r + 4);
	if (s + 2 > t + n) return;
	let c = o(s);
	for (let e = 0; e < c; e += 1) {
		let r = s + 2 + e * 12;
		if (r + 12 > t + n) break;
		if (o(r) === 274) return o(r + 8);
	}
}
function qn(e) {
	if (!(e.length < 24 || e[0] !== 137 || Qn(e, 1, 3) !== "PNG")) return Zn(nr(e, 16), nr(e, 20));
}
function Jn(e) {
	if (e.length < 30 || Qn(e, 0, 4) !== "RIFF" || Qn(e, 8, 4) !== "WEBP") return;
	let t = Qn(e, 12, 4);
	if (t === "VP8X") return Zn(1 + tr(e, 24), 1 + tr(e, 27));
	if (t === "VP8 " && e.length >= 30) return Zn(er(e, 26) & 16383, er(e, 28) & 16383);
	if (t === "VP8L" && e.length >= 25 && e[20] === 47) {
		let t = rr(e, 21);
		return Zn((t & 16383) + 1, (t >>> 14 & 16383) + 1);
	}
}
function Yn(e) {
	if (!(e.length < 26 || Qn(e, 0, 2) !== "BM")) return Zn(Math.abs(ir(e, 18)), Math.abs(ir(e, 22)));
}
function Xn(e) {
	for (let t = 4; t + 16 <= e.length; t += 1) {
		if (Qn(e, t, 4) !== "ispe") continue;
		let n = Zn(nr(e, t + 8), nr(e, t + 12));
		if (n) return n;
	}
}
function Zn(e, t) {
	return e > 0 && t > 0 ? {
		width: e,
		height: t
	} : void 0;
}
function Qn(e, t, n) {
	return String.fromCharCode(...e.subarray(t, t + n));
}
function $n(e, t) {
	return e[t] << 8 | e[t + 1];
}
function er(e, t) {
	return e[t] | e[t + 1] << 8;
}
function tr(e, t) {
	return e[t] | e[t + 1] << 8 | e[t + 2] << 16;
}
function nr(e, t) {
	return (e[t] << 24 | e[t + 1] << 16 | e[t + 2] << 8 | e[t + 3]) >>> 0;
}
function rr(e, t) {
	return (e[t] | e[t + 1] << 8 | e[t + 2] << 16 | e[t + 3] << 24) >>> 0;
}
function ir(e, t) {
	return e[t] | e[t + 1] << 8 | e[t + 2] << 16 | e[t + 3] << 24;
}
//#endregion
//#region src/components/ImagePreview/renderers/raster-webgl/rasterMemoryBudget.ts
var ar = 1024 * 1024, or = 192 * ar, sr = 256 * ar, cr = 384 * ar, lr = 512 * ar, ur = 768 * ar;
function dr({ width: e, height: t, dpr: n }) {
	let r = Math.max(1, e) * Math.max(1, t) * Math.max(1, n) ** 2;
	return r <= 15e5 ? or : r <= 26e5 ? sr : r <= 5e6 ? cr : r <= 16e6 ? lr : ur;
}
function fr({ totalMemoryBytes: e, availableMemoryBytes: t, gpuBudgetBytes: n }) {
	let r = mr(e), i = n && n > 0 ? pr(n) : ur, a = Math.min(r, i), o = t / Math.max(1, e), s = [
		or,
		sr,
		cr,
		lr,
		ur
	], c = o < .08 ? 2 : +(o < .15);
	return s[Math.max(0, s.indexOf(a) - c)];
}
function pr(e) {
	let t = Math.max(0, e) / 1024 ** 3;
	return t <= 2 ? or : t <= 4 ? sr : t <= 6 ? cr : t <= 10 ? lr : ur;
}
function mr(e) {
	let t = Math.max(0, e) / 1024 ** 3;
	return t <= 8 ? or : t <= 16 ? sr : t <= 32 ? cr : t <= 64 ? lr : ur;
}
function hr() {
	return typeof window > "u" || typeof screen > "u" ? cr : dr({
		width: screen.width || window.innerWidth || 1,
		height: screen.height || window.innerHeight || 1,
		dpr: window.devicePixelRatio || 1
	});
}
//#endregion
//#region src/components/ImagePreview/renderers/raster-webgl/rasterDecode.worker.ts?worker&inline
var gr = "(function(){async function e(e){let n=new Uint8Array(await e.slice(0,524288).arrayBuffer());return t(n)??i(n)??a(n)??o(n)??s(n)}function t(e){if(e[0]!==255||e[1]!==216)return;let t=2,i=1,a;for(;t+4<=e.length;){for(;e[t]===255;)t+=1;let o=e[t++];if(o===217||o===218)break;if(o===1||o>=208&&o<=215)continue;let s=u(e,t);if(s<2||t+s>e.length)break;let c=t+2;o===225&&(i=r(e,c,s-2)??i),n(o)&&s>=7&&(a={height:u(e,c+1),width:u(e,c+3)}),t+=s}if(!(!a?.width||!a.height))return i>=5&&i<=8?{width:a.height,height:a.width}:a}function n(e){return e>=192&&e<=207&&![196,200,204].includes(e)}function r(e,t,n){if(n<14||String.fromCharCode(...e.subarray(t,t+4))!==`Exif`)return;let r=t+6,i=e[r]===73&&e[r+1]===73,a=e[r]===77&&e[r+1]===77;if(!i&&!a)return;let o=t=>i?e[t]|e[t+1]<<8:u(e,t),s=r+(t=>i?(e[t]|e[t+1]<<8|e[t+2]<<16|e[t+3]<<24)>>>0:p(e,t))(r+4);if(s+2>t+n)return;let c=o(s);for(let e=0;e<c;e+=1){let r=s+2+e*12;if(r+12>t+n)break;if(o(r)===274)return o(r+8)}}function i(e){if(!(e.length<24||e[0]!==137||l(e,1,3)!==`PNG`))return c(p(e,16),p(e,20))}function a(e){if(e.length<30||l(e,0,4)!==`RIFF`||l(e,8,4)!==`WEBP`)return;let t=l(e,12,4);if(t===`VP8X`)return c(1+f(e,24),1+f(e,27));if(t===`VP8 `&&e.length>=30)return c(d(e,26)&16383,d(e,28)&16383);if(t===`VP8L`&&e.length>=25&&e[20]===47){let t=m(e,21);return c((t&16383)+1,(t>>>14&16383)+1)}}function o(e){if(!(e.length<26||l(e,0,2)!==`BM`))return c(Math.abs(h(e,18)),Math.abs(h(e,22)))}function s(e){for(let t=4;t+16<=e.length;t+=1){if(l(e,t,4)!==`ispe`)continue;let n=c(p(e,t+8),p(e,t+12));if(n)return n}}function c(e,t){return e>0&&t>0?{width:e,height:t}:void 0}function l(e,t,n){return String.fromCharCode(...e.subarray(t,t+n))}function u(e,t){return e[t]<<8|e[t+1]}function d(e,t){return e[t]|e[t+1]<<8}function f(e,t){return e[t]|e[t+1]<<8|e[t+2]<<16}function p(e,t){return(e[t]<<24|e[t+1]<<16|e[t+2]<<8|e[t+3])>>>0}function m(e,t){return(e[t]|e[t+1]<<8|e[t+2]<<16|e[t+3]<<24)>>>0}function h(e,t){return e[t]|e[t+1]<<8|e[t+2]<<16|e[t+3]<<24}let g=self;g.onmessage=async t=>{let{id:n,blob:r,url:i,contentLength:a,resizeWidth:o,resizeHeight:s,fitWidth:c,fitHeight:l,maxTextureSize:u}=t.data;try{let t=r??await _(n,i,a),d=await e(t).catch(()=>void 0),f=d?y(d.width,d.height,c,l,u):void 0,p=o&&s?{width:o,height:s}:f&&d&&(f.width!==d.width||f.height!==d.height)?f:void 0,m=p?await createImageBitmap(t,{imageOrientation:`from-image`,resizeWidth:p.width,resizeHeight:p.height,resizeQuality:`high`}):await createImageBitmap(t,{imageOrientation:`from-image`}),h=d?.width??m.width,v=d?.height??m.height;if(!p&&!d){let e=y(h,v,c,l,u);if(e.width!==m.width||e.height!==m.height){let t=await createImageBitmap(m,0,0,m.width,m.height,{resizeWidth:e.width,resizeHeight:e.height,resizeQuality:`high`});m.close(),m=t}}g.postMessage({id:n,bitmap:m,naturalWidth:h,naturalHeight:v},[m])}catch(e){g.postMessage({id:n,error:e instanceof Error?e.message:String(e)},[])}};async function _(e,t,n){let r=await fetch(t);if(!r.ok)throw Error(`Failed to load media source: ${r.status} ${r.statusText}`);let i=Number(r.headers.get(`content-length`)),a=Number.isFinite(i)&&i>0?i:n&&n>0?n:void 0,o=r.headers.get(`content-type`)??``;if(!r.body){let t=await r.blob();return v(e,t.size,a??t.size,!0),t}let s=r.body.getReader(),c=[],l=0,u=0,d=performance.now();v(e,0,a,!1);try{for(;;){let{done:t,value:n}=await s.read();if(t)break;c.push(n),l+=n.byteLength;let r=performance.now();((a?(l-u)/a:0)>=.01||r-d>=200)&&(v(e,l,a,!1),u=l,d=r)}}finally{s.releaseLock()}let f=new Blob(c,{type:o});return v(e,l,a??l,!0),f}function v(e,t,n,r){g.postMessage({id:e,progress:{loadedBytes:t,...n?{totalBytes:n}:{},...n?{progress:r?1:Math.max(0,Math.min(1,t/n))}:{},complete:r}},[])}function y(e,t,n,r,i){let a=n&&r?Math.min(1,n/e,r/t):1,o=Math.min(a,Math.max(1,Math.floor(i??1/0))/Math.max(e,t));return{width:Math.max(1,Math.round(e*o)),height:Math.max(1,Math.round(t*o))}}})();\n//# sourceMappingURL=rasterDecode.worker-CHdh6UOo.js.map", _r = typeof self < "u" && self.Blob && new Blob(["(self.URL || self.webkitURL).revokeObjectURL(self.location.href);", gr], { type: "text/javascript;charset=utf-8" });
function vr(e) {
	let t;
	try {
		if (t = _r && (self.URL || self.webkitURL).createObjectURL(_r), !t) throw "";
		let n = new Worker(t, { name: e?.name });
		return n.addEventListener("error", () => {
			(self.URL || self.webkitURL).revokeObjectURL(t);
		}), n;
	} catch {
		return new Worker("data:text/javascript;charset=utf-8," + encodeURIComponent(gr), { name: e?.name });
	}
}
//#endregion
//#region src/components/ImagePreview/renderers/raster-webgl/rasterDecodePolicy.ts
var yr = 3, br = 3, xr = 8e7;
function Sr({ workers: e = "auto", maxWorkers: t = 3, hardwareConcurrency: n = Tr() } = {}) {
	let r = wr(t);
	if (e !== "auto" && Number.isFinite(e)) return Math.min(r, wr(e));
	let i = Math.max(1, Math.floor(n || 1));
	return Math.min(r, i <= 4 ? 1 : i <= 8 ? 2 : 3);
}
function Cr(e) {
	return Number.isFinite(e) && (e ?? 0) >= 8e7;
}
function wr(e) {
	return Number.isFinite(e) ? Math.max(1, Math.min(3, Math.floor(e))) : 3;
}
function Tr() {
	return typeof navigator > "u" ? 2 : navigator.hardwareConcurrency || 2;
}
//#endregion
//#region src/components/ImagePreview/renderers/raster-webgl/RasterDecodeWorkerPool.ts
var Er = class {
	workerCount;
	slots = [];
	pending = [];
	workerFactory;
	inlineDecode;
	inlineRunning;
	nextId = 1;
	sequence = 0;
	disposed = !1;
	constructor(e = {}) {
		if (this.workerCount = Sr({
			workers: e.workers,
			maxWorkers: e.maxWorkers,
			hardwareConcurrency: e.hardwareConcurrency
		}), this.workerFactory = e.workerFactory ?? Dr(), this.inlineDecode = e.inlineDecode ?? Or, this.workerFactory) for (let e = 0; e < this.workerCount; e += 1) {
			let t = {
				index: e,
				worker: null,
				version: 0
			};
			this.slots.push(t), this.replaceWorker(t);
		}
	}
	decode(e) {
		return this.disposed ? Promise.reject(Ar("Raster decode pool has been disposed")) : new Promise((t, n) => {
			let r = {
				id: this.nextId++,
				request: e,
				sequence: this.sequence++,
				heavy: Cr(e.naturalPixels),
				cancelled: !1,
				settled: !1,
				resolve: t,
				reject: n
			};
			this.pending.push(r), this.sortPending(), e.foreground && this.preemptLowerPriority(r), this.drain();
		});
	}
	promote(e, t, n = !1) {
		for (let r of this.pending) if (r.request.key === e) {
			r.request.priority = Math.max(r.request.priority, t), r.request.foreground ||= n, this.sortPending(), r.request.foreground && this.preemptLowerPriority(r), this.drain();
			return;
		}
		for (let r of this.slots) {
			let i = r.running;
			if (i?.request.key === e) {
				i.request.priority = Math.max(i.request.priority, t), i.request.foreground ||= n, i.request.foreground && this.preemptLowerPriority(i), this.drain();
				return;
			}
		}
		let r = this.inlineRunning;
		r?.request.key === e && (r.request.priority = Math.max(r.request.priority, t), r.request.foreground ||= n);
	}
	cancel(e, t = !1) {
		let n = !1;
		for (let t = this.pending.length - 1; t >= 0; --t) {
			let r = this.pending[t];
			r.request.key === e && (this.pending.splice(t, 1), this.rejectJob(r, Ar(`Raster decode cancelled: ${e}`)), n = !0);
		}
		for (let r of this.slots) {
			let i = r.running;
			i?.request.key === e && (n = !0, t ? this.terminateRunning(r, Ar(`Raster decode preempted: ${e}`)) : this.softCancel(i, Ar(`Raster decode cancelled: ${e}`)));
		}
		return this.inlineRunning?.request.key === e && (n = !0, this.softCancel(this.inlineRunning, Ar(`Raster decode cancelled: ${e}`))), this.drain(), n;
	}
	dispose() {
		if (this.disposed) return;
		this.disposed = !0;
		let e = Ar("Raster decode pool has been disposed");
		for (let t of this.pending.splice(0)) this.rejectJob(t, e);
		for (let t of this.slots) t.running && this.rejectJob(t.running, e), t.running = void 0, t.worker?.terminate(), t.worker = null;
		this.inlineRunning && this.softCancel(this.inlineRunning, e);
	}
	drain() {
		if (this.disposed) return;
		let e = this.slots.filter((e) => e.worker);
		if (e.length === 0) {
			this.drainInline();
			return;
		}
		for (; this.pending.length > 0;) {
			let t = e.find((e) => !e.running);
			if (!t) return;
			let n = this.pending[0], r = this.activeJobs();
			if (r.some((e) => e.heavy) || n.heavy && r.length > 0) return;
			this.pending.shift(), this.runOnWorker(t, n);
		}
	}
	drainInline() {
		if (this.inlineRunning || this.pending.length === 0) return;
		let e = this.pending.shift();
		this.inlineRunning = e, this.inlineDecode(e.request).then(({ bitmap: t, naturalSize: n }) => {
			if (e.cancelled || this.disposed) {
				t.close();
				return;
			}
			this.resolveJob(e, {
				bitmap: t,
				naturalSize: n
			});
		}, (t) => this.rejectJob(e, t)).finally(() => {
			this.inlineRunning === e && (this.inlineRunning = void 0), this.drain();
		});
	}
	runOnWorker(e, t) {
		let n = e.worker;
		if (!n) {
			this.pending.unshift(t);
			return;
		}
		e.running = t;
		let r = t.request.blob ? { blob: t.request.blob } : t.request.url ? {
			url: t.request.url.href,
			contentLength: t.request.url.contentLength
		} : null;
		if (!r) {
			e.running = void 0, this.rejectJob(t, /* @__PURE__ */ Error("Raster decode request has no Blob or URL source")), this.drain();
			return;
		}
		let i = {
			id: t.id,
			...r,
			resizeWidth: t.request.targetSize?.width,
			resizeHeight: t.request.targetSize?.height,
			fitWidth: t.request.fitBox?.width,
			fitHeight: t.request.fitBox?.height,
			maxTextureSize: t.request.maxTextureSize
		};
		try {
			n.postMessage(i);
		} catch (n) {
			e.running = void 0, this.rejectJob(t, n), this.replaceWorker(e), this.drain();
		}
	}
	replaceWorker(e) {
		if (e.worker?.terminate(), e.worker = null, !this.workerFactory || this.disposed) return;
		let t = ++e.version;
		try {
			let n = this.workerFactory();
			e.worker = n, n.onmessage = (r) => {
				if (e.version !== t || e.worker !== n) {
					r.data.bitmap?.close();
					return;
				}
				this.onWorkerMessage(e, r.data);
			}, n.onerror = (r) => {
				if (r.preventDefault?.(), e.version !== t || e.worker !== n) return;
				let i = Error(r.message || `Raster decode Worker ${e.index} failed`);
				this.terminateRunning(e, i), this.drain();
			};
		} catch {
			e.worker = null;
		}
	}
	onWorkerMessage(e, t) {
		let n = e.running;
		if (!n || n.id !== t.id) {
			t.bitmap?.close();
			return;
		}
		if (t.progress) {
			!n.cancelled && !this.disposed && n.request.onProgress?.(t.progress);
			return;
		}
		e.running = void 0, n.cancelled || this.disposed ? t.bitmap?.close() : t.bitmap ? this.resolveJob(n, {
			bitmap: t.bitmap,
			naturalSize: t.naturalWidth && t.naturalHeight ? {
				width: t.naturalWidth,
				height: t.naturalHeight
			} : void 0
		}) : this.rejectJob(n, Error(t.error ?? "Raster decode Worker returned no bitmap")), this.drain();
	}
	preemptLowerPriority(e) {
		let t = this.slots.filter((e) => !!e.running).sort((e, t) => e.running.request.priority - t.running.request.priority), n = e.heavy;
		for (let r of t) if (!(r.running.request.priority >= e.request.priority) && (!n && this.hasIdleWorker() || (this.terminateRunning(r, Ar(`Raster decode preempted by ${e.request.key}`)), !n))) break;
	}
	terminateRunning(e, t) {
		let n = e.running;
		e.running = void 0, n && this.rejectJob(n, t), this.replaceWorker(e);
	}
	activeJobs() {
		let e = this.slots.flatMap((e) => e.running ? [e.running] : []);
		return this.inlineRunning && e.push(this.inlineRunning), e;
	}
	hasIdleWorker() {
		return this.slots.some((e) => e.worker && !e.running);
	}
	softCancel(e, t) {
		e.cancelled = !0, this.rejectJob(e, t);
	}
	resolveJob(e, t) {
		if (e.settled) {
			t.bitmap.close();
			return;
		}
		e.settled = !0, e.resolve(t);
	}
	rejectJob(e, t) {
		e.settled || (e.settled = !0, e.reject(t));
	}
	sortPending() {
		this.pending.sort((e, t) => t.request.priority - e.request.priority || e.sequence - t.sequence);
	}
};
function Dr() {
	if (!(typeof Worker > "u")) return () => new vr({ name: "right-image-preview-raster-decode" });
}
async function Or(e) {
	let t = e.blob ?? (e.url ? await E({
		type: "url",
		href: e.url.href,
		contentLength: e.url.contentLength
	}, { onProgress: e.onProgress }) : null);
	if (!t) throw Error("Raster decode request has no Blob or URL source");
	let n = e.targetSize ? await createImageBitmap(t, {
		imageOrientation: "from-image",
		resizeWidth: e.targetSize.width,
		resizeHeight: e.targetSize.height,
		resizeQuality: "high"
	}) : await createImageBitmap(t, { imageOrientation: "from-image" }), r = {
		width: n.width,
		height: n.height
	};
	if (!e.targetSize) {
		let t = kr(n, e.fitBox, e.maxTextureSize);
		if (t.width !== n.width || t.height !== n.height) {
			let e = await createImageBitmap(n, 0, 0, n.width, n.height, {
				resizeWidth: t.width,
				resizeHeight: t.height,
				resizeQuality: "high"
			});
			n.close(), n = e;
		}
	}
	return {
		bitmap: n,
		naturalSize: r
	};
}
function kr(e, t, n) {
	let r = t ? Math.min(1, t.width / e.width, t.height / e.height) : 1, i = Math.min(r, Math.max(1, Math.floor(n ?? Infinity)) / Math.max(e.width, e.height));
	return {
		width: Math.max(1, Math.round(e.width * i)),
		height: Math.max(1, Math.round(e.height * i))
	};
}
function Ar(e) {
	let t = Error(e);
	return t.name = "AbortError", t;
}
//#endregion
//#region src/components/ImagePreview/renderers/raster-webgl/RasterPipeline.ts
var jr = lr, Mr = class extends Error {
	estimatedBytes;
	limitBytes;
	constructor(e, t) {
		super(`Raster Full decode requires ${e} bytes, exceeding ${t}`), this.name = "RasterFullDecodeBlockedError", this.estimatedBytes = e, this.limitBytes = t;
	}
}, Nr = class {
	renderer;
	cache;
	inFlight = /* @__PURE__ */ new Map();
	decodePool;
	uploadQueue = new Vn(1);
	disposed = !1;
	unsubscribeContext;
	contextGeneration = 0;
	contextLost = !1;
	contextStatus = "healthy";
	listeners = /* @__PURE__ */ new Set();
	downloads = /* @__PURE__ */ new Map();
	foregroundBlob = null;
	displayGeneration = 0;
	displayBox = null;
	activeResourceKey;
	requestSequence = 0;
	fullDecodeMaxBytes;
	constructor(e, t = jr, n = {}) {
		this.renderer = e, this.cache = new On(e.gl, t), this.decodePool = n.decodePool ?? new Er({
			workers: n.decodeWorkers,
			maxWorkers: n.decodeWorkerMax
		}), this.fullDecodeMaxBytes = fn(n.fullDecodeMaxBytes ?? cn), this.unsubscribeContext = e.subscribeContext((e) => {
			e === "lost" ? (this.contextLost = !0, this.contextStatus = "lost", this.cancelAllInFlight(!0, "WebGL context lost"), this.cache.clear(!1)) : e === "restored" ? (this.contextLost = !1, this.contextStatus = "restored", this.contextGeneration += 1) : (this.contextLost = !0, this.contextStatus = "restore-failed", this.cancelAllInFlight(!0, "WebGL context restoration failed"), this.cache.clear(!1)), this.emit();
		});
	}
	subscribe(e) {
		return this.listeners.add(e), () => this.listeners.delete(e);
	}
	get generation() {
		return this.contextGeneration;
	}
	get isContextLost() {
		return this.contextLost;
	}
	get currentContextStatus() {
		return this.contextStatus;
	}
	runtimeSnapshot() {
		let e = this.cache.snapshot();
		return {
			downloads: Object.fromEntries(this.downloads),
			residentResourceKeys: this.cache.residentResourceKeys(),
			residentTextures: this.cache.residentEntries().map((e) => ({
				resourceKey: e.resourceKey,
				quality: e.quality,
				width: e.textureWidth,
				height: e.textureHeight,
				naturalWidth: e.naturalWidth,
				naturalHeight: e.naturalHeight,
				bytes: e.estimatedBytes
			})),
			cache: e,
			context: {
				status: this.contextStatus,
				generation: this.contextGeneration
			}
		};
	}
	reconcileViewportLods(e, t, n) {
		let r = this.displayBox;
		(!r || e.width > r.width * 1.1 || e.height > r.height * 1.1 || e.width < r.width * .9 || e.height < r.height * .9) && (this.displayBox = e, this.displayGeneration += 1, this.cancelInFlight((e) => e.viewportLod, !0, "Raster viewport LOD became stale after stage resize"));
		let i = !1;
		for (let r of this.cache.residentEntries()) if (r.resourceKey !== n) if (r.quality === "display") {
			if (this.cachedEntryMatchesTarget(r, "display", e)) continue;
			if (this.cachedEntryMeetsMinimum(r, "browse", t)) {
				let e = r.resourceKey + "|browse";
				this.cache.rekey(r.key, e, { quality: "browse" }), i = !0;
			} else i = this.cache.delete(r.key) || i;
		} else r.quality === "browse" && !this.cachedEntryMatchesTarget(r, "browse", t) && (i = this.cache.delete(r.key) || i);
		i && this.emit();
	}
	retainOnly(e) {
		this.cache.retainOnly(e) && this.emit();
	}
	release(e) {
		this.cache.delete(e) && this.emit();
	}
	setBudgetBytes(e) {
		this.cache.setMaxBytes(e), this.emit();
	}
	reconcileDecodePlan(e) {
		let t = new Set(e);
		this.cancelInFlight((e) => !e.activeSpecific && !t.has(`${e.resourceKey}|${e.quality}`), !1, "Raster decode removed from the current preload plan");
	}
	prepare(e, t, n, r, i = 0, a) {
		let o = e + "|" + n, s = n === "display" || n === "browse", c = n === "display" && i >= 100;
		c && this.activateResource(e);
		let l = this.displayGeneration, u = s ? `${o}@${l}` : o, d = this.cache.get(o);
		if (d && this.cachedEntryMeetsMinimum(d, n, a)) return Promise.resolve(d);
		let f = this.inFlight.get(u);
		if (f) return c && (f.activeSpecific = !0, f.scheduling.priority = Math.max(f.scheduling.priority, i), f.scheduling.foreground = !0, this.decodePool.promote(f.decodeKey, f.scheduling.priority, !0)), f.promise;
		let p = this.contextGeneration, m = new AbortController(), h = `${u}#${++this.requestSequence}`, g = {
			priority: i,
			foreground: c || n === "full"
		}, _ = {}, v = this.createEntry(o, e, t, n, r, a, g, h, m.signal).then(({ entry: e, reservation: t }) => {
			if (this.disposed) throw this.renderer.gl.deleteTexture(e.texture), t.release(), new DOMException("Raster pipeline has been disposed", "AbortError");
			if (p !== this.contextGeneration || this.contextLost) throw this.renderer.gl.deleteTexture(e.texture), t.release(), new DOMException("Raster upload became stale after WebGL context loss", "AbortError");
			if (s && l !== this.displayGeneration) throw this.renderer.gl.deleteTexture(e.texture), t.release(), new DOMException("Raster viewport LOD became stale after stage resize", "AbortError");
			if (!t.commit(e, g.priority)) throw new DOMException("Raster texture budget changed before upload admission completed", "AbortError");
			return this.emit(), e;
		}).finally(() => {
			this.inFlight.get(u) === _ && this.inFlight.delete(u);
		});
		return Object.assign(_, {
			resourceKey: e,
			quality: n,
			viewportLod: s,
			activeSpecific: c || n === "preview" || n === "full",
			decodeKey: h,
			abortController: m,
			scheduling: g,
			promise: v
		}), this.inFlight.set(u, _), v;
	}
	dispose() {
		this.disposed = !0, this.unsubscribeContext(), this.cancelAllInFlight(!0, "Raster pipeline has been disposed"), this.decodePool.dispose(), this.uploadQueue.dispose(), this.cache.clear(), this.foregroundBlob = null, this.listeners.clear();
	}
	async createEntry(e, t, n, r, i, a, o = {
		priority: 0,
		foreground: !1
	}, s = `${t}|${r}`, c) {
		let l = r === "preview" ? void 0 : (e) => {
			this.downloads.set(t, e), this.emit();
		}, u = r !== "preview" && this.activeResourceKey === t, d = u && this.foregroundBlob?.resourceKey === t && Fr(this.foregroundBlob.source, n) ? this.foregroundBlob.blob : void 0, f = d ?? (n.type === "url" ? void 0 : await E(n, {
			onProgress: l,
			signal: c
		}));
		c?.throwIfAborted(), u && !d && f && (this.foregroundBlob = {
			resourceKey: t,
			source: n,
			blob: f
		});
		let p = r === "preview" || i || !f ? void 0 : await Un(f).catch(() => void 0), m = i ?? p;
		if (r === "full" && m) {
			let e = dn(m, this.fullDecodeMaxBytes);
			if (!e.allowed) throw new Mr(e.estimatedBytes ?? 2 ** 53 - 1, e.limitBytes);
		}
		if (m && r !== "preview") {
			let e = Nn({
				webgl2Available: !0,
				maxTextureSize: this.renderer.maxTextureSize,
				naturalSize: m
			});
			if (e.renderer === "dom-image") throw this.foregroundBlob?.resourceKey === t && (this.foregroundBlob = null), new Pn(e.fallbackReason ?? "texture-too-large", `Raster dimensions exceed the safe WebGL texture edge (${e.safeTextureSize ?? 0}px)`, void 0, m);
		}
		let h = m ? Pr(r, m, a, this.renderer.maxTextureSize, this.cache.maxBytes) : void 0, g = h && m && (h.width < m.width || h.height < m.height) ? h : void 0, _ = await this.decodePool.decode({
			key: s,
			blob: f,
			url: n.type === "url" ? {
				href: n.href,
				contentLength: n.contentLength
			} : void 0,
			onProgress: l,
			targetSize: g,
			fitBox: !m && (r === "display" || r === "browse") ? a : void 0,
			maxTextureSize: this.renderer.maxTextureSize,
			naturalPixels: r !== "preview" && m ? m.width * m.height : void 0,
			priority: o.priority,
			foreground: o.foreground
		}), v = _.bitmap;
		if (f && r !== "preview" && this.activeResourceKey === t && (this.foregroundBlob?.resourceKey !== t || !Fr(this.foregroundBlob.source, n)) && (this.foregroundBlob = {
			resourceKey: t,
			source: n,
			blob: f
		}), c?.aborted && (v.close(), c.throwIfAborted()), m ||= _.naturalSize ?? {
			width: v.width,
			height: v.height
		}, r !== "preview") {
			let e = Nn({
				webgl2Available: !0,
				maxTextureSize: this.renderer.maxTextureSize,
				naturalSize: m
			});
			if (e.renderer === "dom-image") throw v.close(), this.foregroundBlob?.resourceKey === t && (this.foregroundBlob = null), new Pn(e.fallbackReason ?? "texture-too-large", `Raster dimensions exceed the safe WebGL texture edge (${e.safeTextureSize ?? 0}px)`, void 0, m);
		}
		let y = m.width, b = m.height, x = r === "full" && (v.width !== y || v.height !== b);
		try {
			return await this.uploadQueue.schedule(o.priority, async () => {
				c?.throwIfAborted();
				let n = v.width * v.height * 4, i = this.cache.reserve(e, n, o.foreground, o.priority);
				if (!i) throw new DOMException("Raster texture rejected by the configured texture budget", "QuotaExceededError");
				try {
					let a = await this.renderer.upload(v);
					c?.aborted && (this.renderer.gl.deleteTexture(a), c.throwIfAborted());
					let o = performance.now();
					return {
						entry: {
							key: e,
							resourceKey: t,
							quality: r,
							texture: a,
							textureWidth: v.width,
							textureHeight: v.height,
							naturalWidth: y,
							naturalHeight: b,
							estimatedBytes: n,
							lastUsedAt: o,
							readyAt: o,
							textureLimited: x
						},
						reservation: i
					};
				} catch (e) {
					throw i.release(), e;
				}
			}, s);
		} finally {
			v.close(), r === "full" && this.foregroundBlob?.resourceKey === t && (this.foregroundBlob = null);
		}
	}
	activateResource(e) {
		this.activeResourceKey !== e && (this.activeResourceKey = e, this.foregroundBlob?.resourceKey !== e && (this.foregroundBlob = null), this.cancelInFlight((t) => t.activeSpecific && t.resourceKey !== e, !0, `Raster decode superseded by current resource: ${e}`));
	}
	cancelAllInFlight(e, t) {
		this.cancelInFlight(() => !0, e, t);
	}
	cancelInFlight(e, t, n) {
		for (let [r, i] of this.inFlight) {
			if (!e(i)) continue;
			this.inFlight.delete(r);
			let a = new DOMException(n, "AbortError");
			i.abortController.abort(a), this.decodePool.cancel(i.decodeKey, t), this.uploadQueue.cancelPending(i.decodeKey, a);
		}
	}
	cachedEntryMeetsMinimum(e, t, n) {
		if (t !== "display" && t !== "browse" || !n) return !0;
		let r = Pr(t, {
			width: e.naturalWidth,
			height: e.naturalHeight
		}, n, this.renderer.maxTextureSize, this.cache.maxBytes);
		return e.textureWidth >= r.width * .9 && e.textureHeight >= r.height * .9;
	}
	cachedEntryMatchesTarget(e, t, n) {
		if (!this.cachedEntryMeetsMinimum(e, t, n)) return !1;
		let r = Pr(t, {
			width: e.naturalWidth,
			height: e.naturalHeight
		}, n, this.renderer.maxTextureSize, this.cache.maxBytes);
		return e.textureWidth <= r.width * 1.35 && e.textureHeight <= r.height * 1.35;
	}
	emit() {
		this.listeners.forEach((e) => e());
	}
};
function Pr(e, t, n, r, i) {
	let a = (e === "display" || e === "browse") && n ? un(t.width, t.height, n.width, n.height) : t, o = Ir(a.width, a.height, r);
	return Lr(o.width, o.height, i);
}
function Fr(e, t) {
	return e.type === t.type ? e.type === "url" && t.type === "url" ? e.href === t.href : e.type === "blob" && t.type === "blob" ? e.blob === t.blob : e.type === "bytes" && t.type === "bytes" ? e.data === t.data : !1 : !1;
}
function Ir(e, t, n) {
	let r = Math.max(1, Math.floor(e)), i = Math.max(1, Math.floor(t)), a = Math.max(1, Math.floor(n)), o = Math.max(r, i);
	if (o <= a) return {
		width: r,
		height: i
	};
	let s = a / o;
	return {
		width: Math.max(1, Math.round(r * s)),
		height: Math.max(1, Math.round(i * s))
	};
}
function Lr(e, t, n) {
	let r = Math.max(1, Math.floor(e)), i = Math.max(1, Math.floor(t)), a = Math.max(0, Math.floor(n)), o = r * i * 4;
	if (o <= a) return {
		width: r,
		height: i
	};
	if (a < 4) return {
		width: 1,
		height: 1
	};
	let s = Math.floor(a / 4), c = Math.sqrt(a / o), l = Math.max(1, Math.floor(r * c)), u = Math.max(1, Math.floor(i * c));
	return l * u > s && (l >= u ? l = Math.max(1, Math.floor(s / u)) : u = Math.max(1, Math.floor(s / l))), {
		width: l,
		height: u
	};
}
function Rr(e, t, n) {
	return [t, ...e.filter((e) => e.resourceKey !== t.resourceKey && e.resourceKey !== n)].slice(0, 32);
}
function zr({ enabled: e, resourceKey: t, history: n, residentTextures: r, budgetBytes: i, currentReservedBytes: a, immediateNeighborScreenBytes: o }) {
	if (!e || !t) return [];
	let s = new Map(r.filter((e) => e.quality === "display").map((e) => [e.resourceKey, e.bytes])), c = Math.max(0, i - a - o), l = [];
	for (let e of n) {
		if (e.resourceKey === t) continue;
		let n = s.get(e.resourceKey);
		!n || n > c || (l.push({
			...e,
			bytes: n
		}), c -= n);
	}
	return l;
}
//#endregion
//#region src/components/ImagePreview/renderers/raster-webgl/WebGLRasterStage.tsx
function Br(e) {
	return e instanceof Error && e.name === "AbortError";
}
function Vr(e, t) {
	return e.length === t.length && e.every((e, n) => {
		let r = t[n];
		return r != null && e.resourceKey === r.resourceKey && e.quality === r.quality && e.width === r.width && e.height === r.height && e.naturalWidth === r.naturalWidth && e.naturalHeight === r.naturalHeight && e.bytes === r.bytes;
	});
}
function Hr(e, t) {
	return !!e && e.resourceKey === t.resourceKey && e.renderer === t.renderer && e.routeReason === t.routeReason && e.fallbackReason === t.fallbackReason && e.webgl2Available === t.webgl2Available && e.maxTextureSize === t.maxTextureSize && e.safeTextureSize === t.safeTextureSize && e.sourceWidth === t.sourceWidth && e.sourceHeight === t.sourceHeight && e.contextStatus === t.contextStatus && e.decodeSource === t.decodeSource && e.fullDecodeStatus === t.fullDecodeStatus && e.fullDecodeEstimatedBytes === t.fullDecodeEstimatedBytes && e.fullDecodeLimitBytes === t.fullDecodeLimitBytes;
}
function Ur(e, t, n) {
	return new Nr(new Ln(e), t, n);
}
function Wr({ active: e, resourceKey: t, currentFlatIndex: n, source: r, previewSource: o, preloadSources: d = [], preloadEnabled: m = !0, preloadPaused: h = !1, fullResolutionPaused: g = !1, fullResolutionSettleMs: _ = 300, fullDecodeMaxBytes: v = cn, textureBudgetBytes: y, decodeWorkers: b, decodeWorkerMax: x, onPreloadStateChange: S, onRuntimeStateChange: C, onRendererStateChange: w, onPreloadPlanChange: T, transform: E, knownSize: D, onDimensions: O, onPhaseChange: k, onError: A, onPresented: j, createPipeline: M = Ur }) {
	let N = l(null), ee = l(null), P = l(null), F = l(t), te = l(null), I = l(e), L = l(0), ne = l(0), R = l({
		onDimensions: O,
		onPhaseChange: k,
		onError: A,
		onPresented: j
	}), re = l(S), ie = l(C), ae = l(w), oe = l(T), se = l(null), ce = l(!0), le = l(null), ue = l([]), de = l(t ? {
		resourceKey: t,
		flatIndex: n
	} : null), [z, B] = u(null), [fe, pe] = u([]), [me, he] = u({
		width: 1,
		height: 1,
		dpr: 1
	}), [ge] = u(hr), [_e, ve] = u(0), [V, ye] = u(16384), be = l(void 0), [xe, Se] = u(null), [Ce, we] = u({
		count: 0,
		usedBytes: 0,
		maxBytes: 0
	}), [Te, Ee] = u([]), De = D?.width, Oe = D?.height, H = xe && (xe.resourceKey == null || xe.resourceKey === t) ? xe : null, ke = c(() => t ? [
		t + "|display",
		t + "|full",
		t + "|browse"
	] : [], [t]), Ae = c(() => mn({
		width: Math.max(1, Math.round(me.width * me.dpr)),
		height: Math.max(1, Math.round(me.height * me.dpr))
	}), [
		me.width,
		me.height,
		me.dpr
	]), je = c(() => pn(Ae), [Ae]), Me = y ?? ge ?? jr, Ne = V, Pe = Te.filter((e) => e.resourceKey === t).reduce((e, t) => e + t.bytes, 0), Fe = t && De && Oe ? bn({
		width: De,
		height: Oe
	}, {
		width: De,
		height: Oe
	}, Ne) + bn({
		width: De,
		height: Oe
	}, Ae, Ne) : Pe, Ie = Math.max(Pe, Fe), Le = c(() => {
		let e = (e) => d.filter((t) => t.side === e).sort((e, t) => e.distance - t.distance)[0];
		return ["forward", "backward"].reduce((t, n) => {
			let r = e(n);
			return t + (r ? bn(r.knownSize, Ae, Ne) : 0);
		}, 0);
	}, [
		d,
		Ae,
		Ne
	]), Re = c(() => zr({
		enabled: m,
		resourceKey: t,
		history: fe,
		residentTextures: Te,
		budgetBytes: Me,
		currentReservedBytes: Ie,
		immediateNeighborScreenBytes: Le
	}), [
		m,
		t,
		Te,
		Me,
		Ie,
		Le,
		fe
	]), ze = c(() => Re.map((e) => e.resourceKey + "|display"), [Re]), Be = c(() => [...ke, ...ze], [ke, ze]), Ve = c(() => d.filter((e) => !Re.some((t) => t.resourceKey === e.resourceKey)), [d, Re]), He = Re.reduce((e, t) => e + t.bytes, 0), U = c(() => yn({
		candidates: m ? Ve : [],
		viewport: me,
		budgetBytes: Me,
		reservedBytes: Ie + He,
		maxTextureSize: Ne
	}), [
		m,
		Ve,
		me,
		Me,
		Ie,
		He,
		Ne
	]), Ue = c(() => ({
		...U.snapshot,
		historyScreenIndexes: Re.map((e) => e.flatIndex).filter((e) => e != null),
		historyScreenBytes: He
	}), [
		U.snapshot,
		Re,
		He
	]), We = dn(z && z.resourceKey === t ? {
		width: z.naturalWidth,
		height: z.naturalHeight
	} : De && Oe ? {
		width: De,
		height: Oe
	} : void 0, v), W = !!(e && t && z?.resourceKey === t && z.quality === "display" && We.allowed && hn({
		width: z.naturalWidth,
		height: z.naturalHeight
	}, {
		width: z.textureWidth,
		height: z.textureHeight
	}, E.scale, me.dpr)), G = i((e) => {
		Hr(se.current, e) || (se.current = e, ae.current?.(e));
	}, []), K = i((e, t, n, r = "healthy", i = "original") => {
		Se((r) => r?.reason === e && r.resourceKey === t && r.naturalSize?.width === n?.width && r.naturalSize?.height === n?.height ? r : {
			reason: e,
			resourceKey: t,
			naturalSize: n
		});
		let a = be.current, o = Nn({
			webgl2Available: e !== "webgl2-unavailable",
			maxTextureSize: a,
			naturalSize: n
		}), s = dn(n, v);
		G({
			resourceKey: t ?? F.current,
			renderer: "dom-image",
			routeReason: "fallback",
			fallbackReason: e,
			webgl2Available: e !== "webgl2-unavailable",
			maxTextureSize: a,
			safeTextureSize: o.safeTextureSize,
			sourceWidth: n?.width,
			sourceHeight: n?.height,
			contextStatus: r,
			decodeSource: i,
			fullDecodeStatus: s.status,
			fullDecodeEstimatedBytes: s.estimatedBytes,
			fullDecodeLimitBytes: s.limitBytes
		});
	}, [v, G]), Ge = i((e, t, n = "healthy", r = "original") => {
		let i = be.current, a = Nn({
			webgl2Available: !0,
			maxTextureSize: i,
			naturalSize: t
		}), o = dn(t, v);
		G({
			resourceKey: e,
			renderer: "webgl2",
			routeReason: "fast-path",
			webgl2Available: !0,
			maxTextureSize: i,
			safeTextureSize: a.safeTextureSize,
			sourceWidth: t?.width,
			sourceHeight: t?.height,
			contextStatus: n,
			decodeSource: r,
			fullDecodeStatus: o.status,
			fullDecodeEstimatedBytes: o.estimatedBytes,
			fullDecodeLimitBytes: o.limitBytes
		});
	}, [v, G]);
	s(() => {
		I.current = e, F.current = t, R.current = {
			onDimensions: O,
			onPhaseChange: k,
			onError: A,
			onPresented: j
		}, re.current = S, ie.current = C, ae.current = w, oe.current = T;
	}, [
		e,
		t,
		O,
		k,
		A,
		j,
		S,
		C,
		w,
		T
	]), s(() => {
		ue.current = Be;
	}, [Be]), s(() => {
		if (!e || !t) return;
		let r = de.current;
		r && r.resourceKey !== t && pe((e) => Rr(e, r, t)), de.current = {
			resourceKey: t,
			flatIndex: n
		};
	}, [
		e,
		t,
		n
	]), s(() => {
		oe.current?.(Ue);
	}, [Ue]), a(() => {
		let e = ee.current;
		if (e) try {
			let t = M(e, jr, {
				decodeWorkers: b,
				decodeWorkerMax: x,
				fullDecodeMaxBytes: v
			});
			ye(t.renderer.maxTextureSize), be.current = t.renderer.maxTextureSize, te.current = null, P.current = t, Ge(F.current), B(null), Ee([]);
			let n = t.subscribe(() => {
				let e = t.cache.snapshot();
				we((t) => t.count === e.count && t.usedBytes === e.usedBytes && t.maxBytes === e.maxBytes ? t : {
					count: e.count,
					usedBytes: e.usedBytes,
					maxBytes: e.maxBytes
				});
				let n = t.runtimeSnapshot();
				if (Ee((e) => Vr(e, n.residentTextures) ? e : n.residentTextures), B((e) => {
					if (!e || t.cache.isResident(e)) return e;
					let n = F.current;
					return n ? t.cache.bestResident(n) ?? e : e;
				}), ie.current?.(n), t.currentContextStatus === "lost") {
					K("context-lost", F.current, void 0, "lost"), I.current && R.current.onPhaseChange("restoring");
					return;
				}
				if (t.currentContextStatus === "restore-failed") {
					K("context-restore-failed", F.current, void 0, "restore-failed");
					return;
				}
				t.currentContextStatus === "restored" && K("context-lost", F.current, void 0, "restored"), ve(t.generation);
			});
			return () => {
				n(), t.dispose(), t.renderer.dispose(), P.current = null;
			};
		} catch (e) {
			te.current = e instanceof Error ? e : Error(String(e)), K(In(e) ?? "renderer-initialization-failed", void 0);
			return;
		}
	}, [
		K,
		M,
		b,
		x,
		v,
		Ge
	]), s(() => {
		P.current?.reconcileViewportLods(Ae, je, t);
	}, [
		Ae,
		je,
		t
	]), a(() => {
		P.current?.setBudgetBytes(Me);
	}, [
		Me,
		b,
		x
	]), s(() => {
		let e = N.current;
		if (!e) return;
		let t = () => {
			let t = e.getBoundingClientRect();
			he({
				width: Math.max(1, t.width),
				height: Math.max(1, t.height),
				dpr: Math.max(1, window.devicePixelRatio || 1)
			});
		};
		t();
		let n = new ResizeObserver(t);
		return n.observe(e), window.addEventListener("resize", t), () => {
			n.disconnect(), window.removeEventListener("resize", t);
		};
	}, []), a(() => {
		let n = P.current, i = ++L.current;
		ne.current = 0;
		let a = le.current;
		if (a && a !== t && n?.release(a + "|full"), le.current = e && t ? t : null, !e || !t || !r) return;
		let s = t + "|full", c = De && Oe ? {
			width: De,
			height: Oe
		} : void 0, l = dn(c, v), u = l.status === "blocked", d = u ? o : r, f = u ? "preview" : "original";
		if (!d) {
			let e = /* @__PURE__ */ Error(`Raster original decode requires ${l.estimatedBytes ?? 0} bytes, exceeding the ${l.limitBytes}-byte safety limit; provide a Preview source`);
			e.name = "RasterDecodeSafetyError";
			let r = Nn({
				webgl2Available: !!n,
				maxTextureSize: n?.renderer.maxTextureSize,
				naturalSize: c
			});
			G({
				resourceKey: t,
				renderer: r.renderer,
				routeReason: r.renderer === "webgl2" ? "fast-path" : "fallback",
				fallbackReason: r.fallbackReason,
				webgl2Available: !!n,
				maxTextureSize: n?.renderer.maxTextureSize,
				safeTextureSize: r.safeTextureSize,
				sourceWidth: c?.width,
				sourceHeight: c?.height,
				contextStatus: n?.currentContextStatus ?? "healthy",
				decodeSource: "preview",
				fullDecodeStatus: l.status,
				fullDecodeEstimatedBytes: l.estimatedBytes,
				fullDecodeLimitBytes: l.limitBytes
			}), R.current.onPhaseChange("error"), R.current.onError(e);
			return;
		}
		let p = Nn({
			webgl2Available: !!n,
			maxTextureSize: n?.renderer.maxTextureSize,
			naturalSize: c
		});
		if (p.renderer === "dom-image") {
			K(n ? p.fallbackReason ?? "texture-too-large" : In(te.current) ?? "webgl2-unavailable", n ? t : void 0, c, n?.currentContextStatus ?? "healthy", f), R.current.onPhaseChange("loading");
			return;
		}
		if (!n) return;
		if (n.isContextLost) {
			K(n.currentContextStatus === "restore-failed" ? "context-restore-failed" : "context-lost", t, c, n.currentContextStatus, f), R.current.onPhaseChange("restoring");
			return;
		}
		if (H && H.reason !== "context-lost") return;
		B((e) => e?.resourceKey === t ? e : null);
		let m = n.cache.get(t + "|browse");
		m ? (B(m), R.current.onDimensions(m.naturalWidth, m.naturalHeight), R.current.onPhaseChange("display-ready")) : R.current.onPhaseChange("loading"), o && !m && !u && n.prepare(t, o, "preview", c, 80).then((e) => {
			L.current === i && ne.current !== i && (B(e), R.current.onDimensions(e.naturalWidth, e.naturalHeight), R.current.onPhaseChange("preview-ready"));
		}).catch(() => void 0);
		let h = n.cache.get(s);
		if (h) {
			ne.current = i, n.cache.protect(ue.current), B(h), R.current.onDimensions(h.naturalWidth, h.naturalHeight), R.current.onPhaseChange("display-ready");
			return;
		}
		n.prepare(t, d, "display", c, 100, Ae).then((e) => {
			L.current === i && (ne.current = i, Se((e) => e?.resourceKey === t || e?.resourceKey == null ? null : e), Ge(t, {
				width: e.naturalWidth,
				height: e.naturalHeight
			}, n.currentContextStatus, f), n.cache.protect(ue.current), n.release(t + "|preview"), n.release(t + "|browse"), B(e), R.current.onDimensions(e.naturalWidth, e.naturalHeight), R.current.onPhaseChange("display-ready"));
		}).catch((e) => {
			if (L.current !== i || Br(e)) return;
			let r = In(e);
			if (r) {
				let i = Fn(e) ?? c, a = dn(i, v);
				if (a.status === "blocked" && !o) {
					let e = /* @__PURE__ */ Error(`Raster fallback requires a Preview because original decode exceeds ${a.limitBytes} bytes`);
					e.name = "RasterDecodeSafetyError", R.current.onPhaseChange("error"), R.current.onError(e);
					return;
				}
				K(r, t, i, n.currentContextStatus, a.status === "blocked" ? "preview" : f);
				return;
			}
			let a = e instanceof Error ? e : Error(String(e));
			if (o) {
				K("texture-create-failed", t, c, n.currentContextStatus, "preview");
				return;
			}
			R.current.onPhaseChange("error"), R.current.onError(a);
		});
	}, [
		e,
		t,
		r,
		o,
		De,
		Oe,
		Ae,
		_e,
		b,
		x,
		v,
		H,
		K,
		Ge,
		G
	]), a(() => {
		let n = P.current;
		if (!e || !n || !t || !r || g || !z || z.resourceKey !== t || z.quality !== "display" || !W) return;
		let i = L.current, a = t + "|full", o = De && Oe ? {
			width: De,
			height: Oe
		} : {
			width: z.naturalWidth,
			height: z.naturalHeight
		}, s = !1, c = setTimeout(() => {
			n.prepare(t, r, "full", o, 90).then((e) => {
				if (s || L.current !== i || !I.current) {
					n.release(a);
					return;
				}
				n.cache.protect(ue.current), B(e), R.current.onDimensions(e.naturalWidth, e.naturalHeight);
			}).catch((e) => {
				if (s || Br(e)) return;
				let n = In(e);
				n && K(n, t, o);
			});
		}, Math.max(0, _));
		return () => {
			s = !0, clearTimeout(c);
		};
	}, [
		e,
		t,
		r,
		z,
		g,
		_,
		De,
		Oe,
		E.scale,
		me.dpr,
		_e,
		W,
		K
	]), a(() => {
		let n = P.current;
		if (!e || !n || H) return;
		let r = !1, i = !!(t && z && z.resourceKey === t && (z.quality === "display" || z.quality === "full"));
		if (n.cache.protect(Be), n.reconcileDecodePlan([...Be, ...U.entries.flatMap((e) => e.lod === "screen" ? [e.resourceKey + "|display"] : [e.resourceKey + "|browse", e.resourceKey + "|display"])]), h || W) return;
		if (!m || !i) {
			n.retainOnly(m ? Be : ke);
			return;
		}
		let a = /* @__PURE__ */ new Map();
		Be.forEach((e) => a.set(e, 100)), U.entries.forEach((e) => {
			let t = e.resourceKey + "|display";
			e.lod === "screen" || a.set(e.resourceKey + "|browse", e.priority), a.set(t, e.priority);
		}), n.retainOnly([...a.keys()]), n.cache.prioritize(a);
		let o = (e) => {
			if (r) return;
			let t = e.resourceKey + "|display", i = e.resourceKey + "|browse";
			re.current?.(e, n.cache.has(t) ? "display-ready" : n.cache.has(i) ? "browse-ready" : "evicted");
		}, s = U.entries.filter((e) => e.lod === "screen").map((e) => ({
			item: e,
			quality: "display"
		})), c = U.entries.filter((e) => e.lod === "browse").map((e) => ({
			item: e,
			quality: "browse"
		})), l = [...s, ...c];
		return (async () => {
			for (let e = 0; e < l.length; e += 1) {
				if (r) return;
				let { item: t, quality: i } = l[e], a = t.resourceKey + "|" + i;
				if (i === "browse" && n.cache.has(t.resourceKey + "|display")) {
					o(t);
					continue;
				}
				if (n.cache.has(a)) {
					o(t);
					continue;
				}
				if (h) return;
				re.current?.(t, "loading", i === "display" ? "screen" : "browse");
				let s = dn(t.knownSize, v).status === "blocked" ? t.previewSource : t.source;
				if (!s) {
					re.current?.(t, "error");
					continue;
				}
				try {
					if (await n.prepare(t.resourceKey, s, i, t.knownSize, t.priority, t.targetBox), r || (o(t), !n.cache.has(a))) return;
				} catch (e) {
					if (r || Br(e)) return;
					re.current?.(t, "error");
				}
			}
		})(), () => {
			r = !0;
		};
	}, [
		e,
		t,
		z,
		U.entries,
		m,
		h,
		W,
		ke,
		Be,
		_e,
		H,
		v
	]), s(() => {
		let n = P.current;
		if (!e || H || !n || !z || !t) return;
		let r = z.resourceKey === t && n.cache.isResident(z) ? z : n.cache.bestResident(t);
		if (!r) return;
		if (r !== z) {
			B(r);
			return;
		}
		try {
			if (!n.renderer.render(r, me, E)) {
				K(n.isContextLost ? "context-lost" : "texture-invalid", t, {
					width: r.naturalWidth,
					height: r.naturalHeight
				}, n.currentContextStatus);
				return;
			}
		} catch (e) {
			K(In(e) ?? "texture-invalid", t, {
				width: r.naturalWidth,
				height: r.naturalHeight
			}, n.currentContextStatus);
			return;
		}
		let i = requestAnimationFrame(() => R.current.onPresented());
		return () => cancelAnimationFrame(i);
	}, [
		e,
		H,
		K,
		z,
		t,
		me,
		E
	]);
	let Ke = !!(t && z && (z.resourceKey === t || z.resourceKey === t + "|preview")), qe = H?.naturalSize ?? (De && Oe ? {
		width: De,
		height: Oe
	} : z && z.resourceKey === t ? {
		width: z.naturalWidth,
		height: z.naturalHeight
	} : void 0), Je = dn(qe, v).status === "blocked" && !!o, q = Je ? o : r;
	return s(() => {
		let t = N.current;
		if (t) {
			if (!e) {
				ce.current = !0, t.style.visibility = "hidden";
				return;
			}
			(Ke || H) && (ce.current = !1), t.style.visibility = ce.current ? "hidden" : "visible";
		}
	}, [
		e,
		H,
		Ke
	]), /* @__PURE__ */ p("div", {
		ref: N,
		"data-rip-raster-webgl": "",
		"data-rip-raster-quality": z?.quality ?? "pending",
		"data-rip-raster-resource": z?.resourceKey,
		"data-rip-raster-active": e ? "true" : "false",
		"data-rip-raster-renderer": H ? "dom-image" : "webgl2",
		"data-rip-raster-fallback-reason": H?.reason,
		"data-rip-raster-cache-count": Ce.count,
		"data-rip-raster-cache-bytes": Ce.usedBytes,
		"data-rip-raster-cache-max-bytes": Ce.maxBytes,
		"aria-hidden": !e,
		style: {
			position: "absolute",
			inset: 0,
			visibility: "hidden",
			pointerEvents: "none"
		},
		children: [/* @__PURE__ */ f("canvas", {
			ref: ee,
			"data-rip-raster-canvas": "",
			style: {
				display: "block",
				width: "100%",
				height: "100%"
			}
		}), e && H && q ? /* @__PURE__ */ f(En, {
			source: q,
			naturalSize: Je ? qe : void 0,
			alt: "",
			transform: E,
			onDimensions: O,
			onPhaseChange: k,
			onPresented: j,
			onError: (e) => {
				R.current.onPhaseChange("error"), R.current.onError(e);
			}
		}, t) : null]
	});
}
//#endregion
//#region src/components/ImagePreview/renderers/svg/zoomPan.ts
var Gr = Object.freeze({
	zoom: !0,
	nativeZoom: !0,
	pan: !0,
	rotate: !0,
	flip: !0,
	minimap: !0
});
function Kr(e) {
	return {
		transform: e.cssTransform,
		transformOrigin: "center center"
	};
}
//#endregion
//#region src/components/ImagePreview/renderers/svg/SvgViewer.tsx
function qr(e) {
	let { source: t, alt: n, transform: r, onDimensions: i, onPhaseChange: a, onError: o, onPresented: s } = e;
	return /* @__PURE__ */ f("div", {
		"data-rip-svg-viewer": "",
		style: Jr,
		children: /* @__PURE__ */ f("img", {
			src: N(t),
			alt: n,
			draggable: !1,
			onLoad: (e) => {
				i(e.currentTarget.naturalWidth, e.currentTarget.naturalHeight), a("display-ready"), s();
			},
			onError: () => o(/* @__PURE__ */ Error("Unable to load SVG source")),
			style: {
				display: "block",
				maxWidth: "none",
				maxHeight: "none",
				...Kr(r)
			}
		})
	});
}
var Jr = {
	position: "absolute",
	inset: 0,
	display: "flex",
	alignItems: "center",
	justifyContent: "center",
	overflow: "hidden",
	pointerEvents: "none"
};
//#endregion
//#region src/components/ImagePreview/renderers/unknown/UnknownMediaViewer.tsx
function Yr({ label: e, pending: t = !1, onPhaseChange: n, onError: r }) {
	return a(() => {
		if (t) {
			n("loading");
			return;
		}
		n("unsupported"), r(/* @__PURE__ */ Error("Unsupported or unreadable media source"));
	}, [
		r,
		n,
		t
	]), t ? /* @__PURE__ */ f("div", {
		"data-rip-unknown-viewer": "",
		"aria-hidden": "true"
	}) : /* @__PURE__ */ p("div", {
		"data-rip-unknown-viewer": "",
		role: "status",
		style: {
			position: "absolute",
			inset: 0,
			display: "grid",
			placeItems: "center",
			color: "#fff"
		},
		children: ["Unsupported media: ", e]
	});
}
//#endregion
//#region src/components/ImagePreview/renderers/video/zoomPan.ts
var Xr = Object.freeze({
	zoom: !0,
	nativeZoom: !1,
	pan: !1,
	rotate: !1,
	flip: !1,
	minimap: !1
});
function Zr(e) {
	return {
		transform: e.cssTransform,
		transformOrigin: "center center"
	};
}
//#endregion
//#region src/components/ImagePreview/renderers/video/VideoViewer.tsx
function Qr(e) {
	let { source: t, transform: n, onDimensions: r, onPhaseChange: i, onError: a, onPresented: o, onPlaybackChange: s } = e;
	return /* @__PURE__ */ f("div", {
		"data-rip-video-viewer": "",
		style: $r,
		children: /* @__PURE__ */ f("video", {
			src: N(t),
			controls: !0,
			playsInline: !0,
			onPlay: () => s?.(!0),
			onPause: () => s?.(!1),
			onEnded: () => s?.(!1),
			onLoadedData: (e) => {
				r(e.currentTarget.videoWidth, e.currentTarget.videoHeight), i("display-ready"), o();
			},
			onError: () => a(/* @__PURE__ */ Error("Unable to load video source")),
			style: {
				display: "block",
				maxWidth: "none",
				maxHeight: "none",
				...Zr(n)
			}
		})
	});
}
var $r = {
	position: "absolute",
	inset: 0,
	display: "flex",
	alignItems: "center",
	justifyContent: "center",
	overflow: "hidden"
};
//#endregion
//#region src/components/ImagePreview/renderers/MediaStage.tsx
function ei(e) {
	let t = e.kind === "raster", [n, r] = u({
		resourceKey: "",
		playing: !1
	}), a = e.kind === "video" && n.resourceKey === e.resourceKey && n.playing, o = l({
		onDimensions: e.onDimensions,
		onPhaseChange: e.onPhaseChange,
		onError: e.onError,
		onPresented: e.onPresented
	});
	s(() => {
		o.current = {
			onDimensions: e.onDimensions,
			onPhaseChange: e.onPhaseChange,
			onError: e.onError,
			onPresented: e.onPresented
		};
	});
	let c = i((e, t) => {
		o.current.onDimensions(e, t);
	}, []), d = i((e) => {
		o.current.onPhaseChange(e);
	}, []), m = i((e) => {
		o.current.onPhaseChange("error"), o.current.onError(e);
	}, []), h = i((e) => {
		o.current.onError(e);
	}, []), g = i(() => o.current.onPresented(), []), _ = {
		transform: e.transform,
		onDimensions: c,
		onPhaseChange: d,
		onError: m,
		onPresented: g
	}, v = null;
	switch (e.kind) {
		case "svg":
			v = /* @__PURE__ */ f(qr, {
				source: e.source,
				alt: e.alt,
				..._
			}, e.resourceKey);
			break;
		case "animated-image":
			v = /* @__PURE__ */ f(wn, {
				source: e.source,
				alt: e.alt,
				..._
			}, e.resourceKey);
			break;
		case "video":
			v = /* @__PURE__ */ f(Qr, {
				source: e.source,
				onPlaybackChange: (t) => {
					r({
						resourceKey: e.resourceKey,
						playing: t
					});
				},
				..._
			}, e.resourceKey);
			break;
		case "unknown":
			v = /* @__PURE__ */ f(Yr, {
				label: e.label,
				pending: e.kindPending,
				onPhaseChange: d,
				onError: h
			}, e.resourceKey);
			break;
	}
	return /* @__PURE__ */ p("div", {
		"data-rip-media-stage": "",
		style: {
			position: "absolute",
			inset: 0
		},
		children: [/* @__PURE__ */ f(Wr, {
			active: t,
			resourceKey: t ? e.resourceKey : void 0,
			currentFlatIndex: t ? e.currentFlatIndex : void 0,
			source: t ? e.source : void 0,
			previewSource: t ? e.previewSource : void 0,
			preloadSources: e.preloadSources,
			preloadEnabled: e.rasterPreloadEnabled,
			preloadPaused: e.rasterPreloadPaused || e.kind === "animated-image" || e.kind === "video" && a,
			fullResolutionPaused: e.rasterFullResolutionPaused,
			fullResolutionSettleMs: e.rasterFullResolutionSettleMs,
			fullDecodeMaxBytes: e.rasterFullDecodeMaxBytes,
			textureBudgetBytes: e.textureBudgetBytes,
			decodeWorkers: e.decodeWorkers,
			decodeWorkerMax: e.decodeWorkerMax,
			onPreloadStateChange: e.onPreloadStateChange,
			onRuntimeStateChange: e.onRasterRuntimeStateChange,
			onRendererStateChange: e.onRasterRendererStateChange,
			onPreloadPlanChange: e.onRasterPreloadPlanChange,
			knownSize: t ? e.knownSize : void 0,
			..._
		}), v]
	});
}
//#endregion
//#region src/components/ImagePreview/renderers/raster-webgl/zoomPan.ts
var ti = Object.freeze({
	zoom: !0,
	nativeZoom: !0,
	pan: !0,
	rotate: !0,
	flip: !0,
	minimap: !0
});
//#endregion
//#region src/components/ImagePreview/renderers/media-capabilities.ts
function ni(e) {
	switch (e) {
		case "raster": return ti;
		case "svg": return Gr;
		case "animated-image": return Sn;
		case "video": return Xr;
		default: return It;
	}
}
//#endregion
//#region src/components/ImagePreview/lib/imagePreviewFindGroup.ts
function ri(e, t) {
	if (!e) return null;
	let n = e.findIndex((e) => t >= e.start && t <= e.end);
	return n === -1 ? null : {
		group: e[n],
		groupIdx: n
	};
}
//#endregion
//#region src/components/ImagePreview/lib/localPackBuildInfo.ts
var ii = {
	fit: "Fit",
	fitApprox: (e) => `Fit (${e}%)`,
	fitToViewport: "Fit to viewport",
	actualSize: "Actual size (100%)",
	zoomIn: "Zoom in",
	zoomOut: "Zoom out",
	lockZoom: "Lock zoom (preserve zoom when switching images)",
	unlockZoom: "Unlock zoom (preserve zoom when switching images)",
	rotateCW: "Rotate clockwise",
	rotateCCW: "Rotate counter-clockwise",
	flipH: "Flip horizontal",
	flipV: "Flip vertical",
	prev: "Previous",
	next: "Next",
	prevGroup: "Previous group",
	nextGroup: "Next group",
	imagePreview: "Image preview",
	toolbar: "Image preview toolbar",
	close: "Close (Esc)",
	loadingImage: "Loading image",
	originalTooLargeNotice: "Original is too large to decode. Showing the thumbnail.",
	minimapNav: "Navigation minimap",
	thumbnailsNav: "Image thumbnails",
	thumbStripItem: (e, t) => `Image ${e} of ${t}`,
	tipFitToViewport: "Fit to viewport",
	tipActualSize: "1:1",
	tipZoomIn: "",
	tipZoomOut: "",
	tipLockZoom: "Keep zoom when switching images",
	tipUnlockZoom: "Fit on switch",
	tipRotateCW: "",
	tipRotateCCW: "",
	tipFlipH: "",
	tipFlipV: "",
	tipPrev: "",
	tipNext: "",
	tipPrevGroup: "Previous group",
	tipNextGroup: "Next group",
	tipClose: "",
	tipZoomLevel: "Click to type zoom %",
	tipZoomRowPercent: () => "",
	tipZoomRowFit: "",
	tipZoomRowFitApprox: () => "",
	tipMinimap: "Drag the frame to pan; click outside to center",
	showExif: "Show EXIF info",
	hideExif: "Hide EXIF info",
	tipShowExif: "EXIF",
	tipHideExif: "Hide EXIF",
	exifPanel: "Image EXIF information",
	exifEmpty: "No EXIF information for this image.",
	exifDragHandle: "Drag to move; snaps to an edge when released",
	exifBoolYes: "Yes",
	exifBoolNo: "No",
	deleteImage: "Delete image",
	tipDeleteImage: "Delete",
	enterFullscreen: "Enter fullscreen",
	exitFullscreen: "Exit fullscreen",
	tipEnterFullscreen: "Fullscreen",
	tipExitFullscreen: "Exit fullscreen",
	exifGroupFile: "File",
	exifGroupCamera: "Camera",
	exifGroupExposure: "Exposure",
	exifGroupGps: "Location",
	exifGroupOther: "Other",
	exifFieldFileName: "File name",
	exifFieldFileSize: "File size",
	exifFieldMimeType: "MIME type",
	exifFieldWidth: "Width",
	exifFieldHeight: "Height",
	exifFieldColorSpace: "Color space",
	exifFieldOrientation: "Orientation",
	exifFieldMake: "Make",
	exifFieldModel: "Model",
	exifFieldLens: "Lens",
	exifFieldSoftware: "Software",
	exifFieldDateTimeOriginal: "Date taken",
	exifFieldDateTimeDigitized: "Date digitized",
	exifFieldCreateDate: "Create date",
	exifFieldExposureTime: "Shutter",
	exifFieldFNumber: "Aperture",
	exifFieldIso: "ISO",
	exifFieldFocalLength: "Focal length",
	exifFieldFocalLength35mm: "Focal length (35mm)",
	exifFieldExposureProgram: "Exposure program",
	exifFieldMeteringMode: "Metering",
	exifFieldFlash: "Flash",
	exifFieldWhiteBalance: "White balance",
	exifFieldExposureBias: "Exposure bias",
	exifFieldGpsLatitude: "Latitude",
	exifFieldGpsLongitude: "Longitude",
	exifFieldGpsAltitude: "Altitude"
}, ai = {
	en: ii,
	zh: {
		fit: "适应",
		fitApprox: (e) => `适应 (约 ${e}%)`,
		fitToViewport: "适应视口",
		actualSize: "原始比例 (100%)",
		zoomIn: "放大",
		zoomOut: "缩小",
		lockZoom: "锁定缩放（切图时保持当前比例）",
		unlockZoom: "解锁缩放（切图时保持当前比例）",
		rotateCW: "顺时针旋转",
		rotateCCW: "逆时针旋转",
		flipH: "水平翻转",
		flipV: "垂直翻转",
		prev: "上一张",
		next: "下一张",
		prevGroup: "上一组",
		nextGroup: "下一组",
		imagePreview: "图片预览",
		toolbar: "图片预览工具栏",
		close: "关闭 (Esc)",
		loadingImage: "图片加载中",
		originalTooLargeNotice: "原图太大，只能显示缩略图。",
		minimapNav: "导航缩略图",
		thumbnailsNav: "缩略图导航",
		thumbStripItem: (e, t) => `第 ${e} 张，共 ${t} 张`,
		tipFitToViewport: "适应视口",
		tipActualSize: "1:1",
		tipZoomIn: "",
		tipZoomOut: "",
		tipLockZoom: "切图时保持缩放",
		tipUnlockZoom: "切图时自动适应",
		tipRotateCW: "",
		tipRotateCCW: "",
		tipFlipH: "",
		tipFlipV: "",
		tipPrev: "",
		tipNext: "",
		tipPrevGroup: "上一组",
		tipNextGroup: "下一组",
		tipClose: "",
		tipZoomLevel: "点击输入缩放比例",
		tipZoomRowPercent: () => "",
		tipZoomRowFit: "",
		tipZoomRowFitApprox: () => "",
		tipMinimap: "拖动高亮框平移；点击框外居中",
		showExif: "显示 EXIF 信息",
		hideExif: "隐藏 EXIF 信息",
		tipShowExif: "EXIF",
		tipHideExif: "隐藏 EXIF",
		exifPanel: "图片 EXIF 信息",
		exifEmpty: "当前图片没有 EXIF 信息。",
		exifDragHandle: "拖动可移动；松开后吸附到边缘",
		exifBoolYes: "是",
		exifBoolNo: "否",
		deleteImage: "删除图片",
		tipDeleteImage: "删除",
		enterFullscreen: "进入全屏",
		exitFullscreen: "退出全屏",
		tipEnterFullscreen: "全屏",
		tipExitFullscreen: "退出全屏",
		exifGroupFile: "文件",
		exifGroupCamera: "相机",
		exifGroupExposure: "曝光",
		exifGroupGps: "位置",
		exifGroupOther: "其他",
		exifFieldFileName: "文件名",
		exifFieldFileSize: "文件大小",
		exifFieldMimeType: "MIME 类型",
		exifFieldWidth: "宽度",
		exifFieldHeight: "高度",
		exifFieldColorSpace: "色彩空间",
		exifFieldOrientation: "方向",
		exifFieldMake: "制造商",
		exifFieldModel: "型号",
		exifFieldLens: "镜头",
		exifFieldSoftware: "软件",
		exifFieldDateTimeOriginal: "拍摄时间",
		exifFieldDateTimeDigitized: "数字化时间",
		exifFieldCreateDate: "创建时间",
		exifFieldExposureTime: "快门",
		exifFieldFNumber: "光圈",
		exifFieldIso: "ISO",
		exifFieldFocalLength: "焦距",
		exifFieldFocalLength35mm: "焦距（35mm）",
		exifFieldExposureProgram: "曝光程序",
		exifFieldMeteringMode: "测光模式",
		exifFieldFlash: "闪光灯",
		exifFieldWhiteBalance: "白平衡",
		exifFieldExposureBias: "曝光补偿",
		exifFieldGpsLatitude: "纬度",
		exifFieldGpsLongitude: "经度",
		exifFieldGpsAltitude: "海拔"
	}
};
function oi(e) {
	return e ? ai[e.split(/[-_]/)[0].toLowerCase()] ?? ii : ii;
}
function si(e, t) {
	return t ? {
		...e,
		...t
	} : e;
}
//#endregion
//#region src/components/ImagePreview/useImagePreviewKeyboard.ts
function ci(e) {
	return e === "ArrowUp" || e === "ArrowDown" || e === "ArrowLeft" || e === "ArrowRight";
}
function li(e, t, n) {
	let r = Number(e.has("ArrowRight")) - Number(e.has("ArrowLeft")), i = Number(e.has("ArrowDown")) - Number(e.has("ArrowUp")), a = Math.hypot(r, i);
	a !== 0 && n(r === 0 ? 0 : -(r / a) * t, i === 0 ? 0 : -(i / a) * t);
}
function ui(e) {
	let t = l(e), n = l(/* @__PURE__ */ new Set()), { keyboardActive: r, endNavHold: i, shiftArrowAction: o } = e;
	a(() => {
		t.current = e;
	}, [e]), a(() => {
		r === !1 && (n.current.clear(), i?.());
	}, [r, i]), a(() => {
		n.current.clear();
	}, [o]), a(() => {
		let e = n.current, r = (n) => {
			let { keyboardActive: r = !0, resetHideTimer: i, onClose: a, zoomIn: o, zoomOut: s, fit: c, setNative: l, mode: u, prev: d, next: f, prevGroup: p, nextGroup: m, rotateCW: h, rotateCCW: g, panByDelta: _, keyboardPanStepPx: v, shiftArrowAction: y, fitEquivalentNativePercent: b, onDeleteImage: x, isFullscreen: S, exitFullscreen: C, beginNavHold: w, endNavHold: T } = t.current;
			if (!r) return;
			i();
			let E = n.target;
			if (E.tagName === "INPUT" || E.tagName === "TEXTAREA") return;
			let D = n.ctrlKey || n.metaKey;
			switch (n.key) {
				case "Escape":
					if (S?.()) {
						n.preventDefault(), C?.();
						break;
					}
					a?.();
					break;
				case "Delete":
				case "Backspace":
					x && (n.preventDefault(), x());
					break;
				case "+":
				case "=":
				case "Add":
					n.preventDefault(), o(b);
					break;
				case "ArrowUp":
					if (n.preventDefault(), D || n.shiftKey && y === "pan") {
						T?.(), e.add(n.key), li(e, v, _);
						break;
					}
					o(b);
					break;
				case "-":
				case "Subtract":
					n.preventDefault(), s(b);
					break;
				case "ArrowDown":
					if (n.preventDefault(), D || n.shiftKey && y === "pan") {
						T?.(), e.add(n.key), li(e, v, _);
						break;
					}
					s(b);
					break;
				case "0":
					c();
					break;
				case "1":
					l(100);
					break;
				case " ":
					n.preventDefault(), u === "fit" ? l(100) : c();
					break;
				case "ArrowLeft":
					if (n.preventDefault(), D || n.shiftKey && y === "pan") {
						T?.(), e.add(n.key), li(e, v, _);
						break;
					}
					if (n.shiftKey) {
						g();
						break;
					}
					w && !n.repeat ? w("prev") : w || d();
					break;
				case "ArrowRight":
					if (n.preventDefault(), D || n.shiftKey && y === "pan") {
						T?.(), e.add(n.key), li(e, v, _);
						break;
					}
					if (n.shiftKey) {
						h();
						break;
					}
					w && !n.repeat ? w("next") : w || f();
					break;
				case "PageUp":
					n.preventDefault(), p();
					break;
				case "PageDown":
					n.preventDefault(), m();
					break;
			}
		}, i = (n) => {
			ci(n.key) && e.delete(n.key), (n.key === "Meta" || n.key === "Control" || n.key === "Shift") && e.clear();
			let { endNavHold: r } = t.current;
			r && (n.key === "ArrowLeft" && r("prev"), n.key === "ArrowRight" && r("next"));
		}, a = () => {
			e.clear(), t.current.endNavHold?.();
		};
		return window.addEventListener("keydown", r, !0), window.addEventListener("keyup", i, !0), window.addEventListener("blur", a), () => {
			window.removeEventListener("keydown", r, !0), window.removeEventListener("keyup", i, !0), window.removeEventListener("blur", a), e.clear(), t.current.endNavHold?.();
		};
	}, []);
}
//#endregion
//#region src/components/ImagePreview/useThumbPacedNavigation.ts
function di({ currentIndex: e, thumbReady: t, prev: n, next: r, repeatDelayMs: o = 300, minVisibleMs: c = 200 }) {
	let d = l(null), [f, p] = u(null), m = l(t), h = l(e), g = l(null), _ = l(null), v = l(null), y = l(n), b = l(r), x = l(c), S = l(o), C = l(0), w = l(!1);
	s(() => {
		m.current = t, h.current = e, y.current = n, b.current = r, x.current = c, S.current = o;
	}, [
		e,
		c,
		r,
		n,
		o,
		t
	]);
	let T = i(() => {
		v.current != null && (clearTimeout(v.current), v.current = null);
	}, []), E = i((e) => {
		d.current === e && (e === "next" ? b.current() : y.current());
	}, []), D = i(() => {
		let e = d.current;
		if (!e || !m.current || g.current === h.current) return;
		_.current ??= performance.now(), T();
		let t = Math.max(0, x.current), n = performance.now() - _.current, r = Math.max(0, t - n), i = w.current ? Math.max(0, Math.max(0, S.current) - (performance.now() - C.current)) : 0;
		v.current = setTimeout(() => {
			if (v.current = null, d.current !== e || !m.current) return;
			let t = h.current;
			g.current !== t && (g.current = t, w.current = !1, E(e));
		}, Math.max(r, i));
	}, [T, E]), O = i((e) => {
		T(), d.current = e, p(e), C.current = performance.now(), w.current = !0, g.current = h.current, _.current = null, E(e);
	}, [T, E]), k = i((e) => {
		e != null && d.current !== e || (T(), d.current = null, p(null), _.current = null, w.current = !1);
	}, [T]), A = i(() => d.current != null, []);
	return a(() => {
		d.current && (_.current = null, T(), m.current && g.current !== h.current && D());
	}, [
		e,
		D,
		T
	]), a(() => {
		if (d.current) {
			if (!t) {
				T(), _.current = null;
				return;
			}
			g.current !== e && D();
		}
	}, [
		t,
		e,
		D,
		T
	]), a(() => () => T(), [T]), {
		beginHold: O,
		endHold: k,
		isHolding: A,
		holdingDirection: f
	};
}
//#endregion
//#region src/components/ImagePreview/useImageTransform.ts
function fi(e, t, n = Infinity) {
	if (t.width === 0 || t.height === 0) return 1;
	let r = Math.min(t.width / e.naturalWidth, t.height / e.naturalHeight);
	return !Number.isFinite(r) || r <= 0 ? 1 : Math.min(r, Number.isFinite(n) && n > 0 ? n : Infinity);
}
function pi(e) {
	return e == null || !Number.isFinite(e) || e <= 0 ? Infinity : e / 100;
}
function mi(e, t, n, r, i, a, o) {
	let s = (a % 360 + 360) % 360, c = s === 90 || s === 270, l = (c ? r.naturalHeight : r.naturalWidth) * n, u = (c ? r.naturalWidth : r.naturalHeight) * n, { width: d, height: f } = i, p = Math.min(l / 2, o * d), m = Math.min(u / 2, o * f);
	return {
		x: Math.max(-d / 2 + p - l / 2, Math.min(d / 2 - p + l / 2, e)),
		y: Math.max(-f / 2 + m - u / 2, Math.min(f / 2 - m + u / 2, t))
	};
}
function hi(e, t, n, r, i, a) {
	let o = [`translate(${e}px, ${t}px)`, `rotate(${n}deg)`];
	return r && o.push("scaleX(-1)"), i && o.push("scaleY(-1)"), o.push(`scale(${a})`), o.join(" ");
}
function gi(e) {
	let { mode: t, nativePercent: n, fitResetPan: r, fitMaxScale: o = Infinity } = e, [c, d] = u(null), [f, p] = u(null), [m, h] = u(0), [g, _] = u(0), v = l({
		x: 0,
		y: 0
	}), y = l(null), b = l(null), [x, S] = u(0), [C, w] = u(!1), [T, E] = u(!1), [D, O] = u(!1), [k, A] = u(null), j = l(null), M = l(/* @__PURE__ */ new Map()), N = i((e, t) => {
		h((t) => t === e ? t : e), _((e) => e === t ? e : t);
	}, []), ee = i(() => {
		b.current !== null && (cancelAnimationFrame(b.current), b.current = null), y.current = null;
	}, []), P = i((e, t) => {
		ee(), v.current = {
			x: e,
			y: t
		}, N(e, t);
	}, [ee, N]), F = i((e, t) => {
		v.current = {
			x: e,
			y: t
		}, y.current = {
			x: e,
			y: t
		}, b.current === null && (b.current = requestAnimationFrame(() => {
			b.current = null;
			let e = y.current;
			y.current = null, e && N(e.x, e.y);
		}));
	}, [N]), te = i(() => {
		let e = y.current;
		e && (b.current !== null && (cancelAnimationFrame(b.current), b.current = null), y.current = null, N(e.x, e.y));
	}, [N]);
	a(() => ee, [ee]), a(() => {
		if (!k) return;
		let e = new ResizeObserver((e) => {
			let t = e[0]?.contentRect;
			t && p({
				width: t.width,
				height: t.height
			});
		});
		return e.observe(k), () => e.disconnect();
	}, [k]);
	let I = i((e) => {
		d((t) => t && t.naturalWidth === e.naturalWidth && t.naturalHeight === e.naturalHeight ? t : e);
	}, []), re = i(() => d(null), []), ie = l(t);
	a(() => {
		ie.current !== "fit" && t === "fit" && r && P(0, 0), ie.current = t;
	}, [
		t,
		r,
		P
	]);
	let ae = i(() => P(0, 0), [P]), oe = i((e, r) => {
		if (t !== "native" || !c || !f) return;
		let i = n / 100, a = mi(v.current.x + e, v.current.y + r, i, c, f, x, ne);
		F(a.x, a.y);
	}, [
		t,
		c,
		f,
		x,
		n,
		F
	]), se = i((e, r) => {
		if (t !== "native" || !c || !f) return;
		let i = n / 100, { tx: a, ty: o } = B(e, r, {
			cw: f.width,
			ch: f.height,
			nw: c.naturalWidth,
			nh: c.naturalHeight,
			scale: i,
			tx: v.current.x,
			ty: v.current.y,
			rotationDeg: x,
			flipH: C,
			flipV: T
		}), s = mi(a, o, i, c, f, x, ne);
		return P(s.x, s.y), {
			tx: s.x,
			ty: s.y
		};
	}, [
		t,
		c,
		f,
		x,
		n,
		C,
		T,
		P
	]), ce = i(() => S((e) => e + 90), []), le = i(() => S((e) => e - 90), []), ue = i(() => w((e) => !e), []), de = i(() => E((e) => !e), []), z = i(() => {
		S(0), w(!1), E(!1);
	}, []), fe = i((e) => {
		e.button === 0 && (M.current.set(e.pointerId, e.nativeEvent), M.current.size === 1 && (j.current = {
			x: e.clientX,
			y: e.clientY,
			tx: v.current.x,
			ty: v.current.y
		}, O(!0)), e.target.setPointerCapture(e.pointerId));
	}, []), pe = i((e) => {
		if (e.buttons === 0) {
			M.current.clear(), j.current = null, O(!1);
			return;
		}
		if (M.current.set(e.pointerId, e.nativeEvent), M.current.size === 1 && j.current) {
			let r = e.clientX - j.current.x, i = e.clientY - j.current.y, a = j.current.tx + r, o = j.current.ty + i;
			if (t === "native" && c && f) {
				let e = n / 100, t = mi(a, o, e, c, f, x, L);
				a = t.x, o = t.y;
			}
			F(a, o);
		}
	}, [
		F,
		t,
		c,
		f,
		x,
		n
	]), me = i((e) => {
		e && M.current.delete(e.pointerId), M.current.size === 0 && (j.current = null, O(!1), te());
	}, [te]), he = l(n), ge = l(!1);
	a(() => {
		t === "fit" && (he.current = 0);
	}, [t]), s(() => {
		let e = he.current;
		if (he.current = n, ge.current) {
			ge.current = !1;
			return;
		}
		if (t !== "native" || !c || e === 0 || e === n) return;
		let r = n / e, i = v.current.x * r, a = v.current.y * r;
		if (f) {
			let e = mi(i, a, n / 100, c, f, x, R);
			i = e.x, a = e.y;
		}
		P(i, a);
	}, [
		n,
		t,
		c,
		f,
		x,
		P
	]);
	let _e = i((e, n, r, i) => {
		if (e === 0 || e === n) return;
		ge.current = !0;
		let a = n / e, o = t === "fit" ? 0 : v.current.x, s = t === "fit" ? 0 : v.current.y, l = r * (1 - a) + o * a, u = i * (1 - a) + s * a;
		if (c && f) {
			let e = mi(l, u, n, c, f, x, R);
			l = e.x, u = e.y;
		}
		P(l, u);
	}, [
		P,
		c,
		f,
		x,
		t
	]), ve = 1, V, ye = !!f && f.width > 1 && f.height > 1;
	if (c && ye) {
		let e = (x % 360 + 360) % 360, r = fi(e === 90 || e === 270 ? {
			naturalWidth: c.naturalHeight,
			naturalHeight: c.naturalWidth
		} : c, f, o);
		V = r * 100, ve = t === "fit" ? r : n / 100;
	} else t === "fit" && c && !ye && (ve = 0);
	let be = t === "fit" ? 0 : m, xe = t === "fit" ? 0 : g, Se = hi(be, xe, x, C, T, ve);
	return {
		transform: {
			scale: ve,
			translateX: be,
			translateY: xe,
			rotation: x,
			flipH: C,
			flipV: T,
			cssTransform: Se
		},
		isPanning: D,
		fitEquivalentNativePercent: V,
		setContainerEl: A,
		onImageLoad: I,
		resetImageDims: re,
		onPanStart: fe,
		onPanMove: pe,
		onPanEnd: me,
		resetPan: ae,
		rotateCW: ce,
		rotateCCW: le,
		flipHorizontal: ue,
		flipVertical: de,
		resetOrientation: z,
		imageDims: c,
		containerSize: f,
		zoomAnchorTranslate: _e,
		panByDelta: oe,
		panJumpToNatural: se
	};
}
//#endregion
//#region src/components/ImagePreview/usePinchZoom.ts
function _i(e) {
	let { containerRef: t, enabled: n, mode: r, currentScale: o, stops: s, fitEquivalentNativePercent: c, fit: u, setNative: d, zoomAnchorTranslate: f } = e, p = l(/* @__PURE__ */ new Map()), m = l(null), h = l(1), g = l(null), _ = s[0] ?? 10, v = s[s.length - 1] ?? 200, y = (e, t) => {
		let n = e.clientX - t.clientX, r = e.clientY - t.clientY;
		return Math.sqrt(n * n + r * r);
	}, b = (e, t, n) => ({
		x: (e.clientX + t.clientX) / 2 - n.left - n.width / 2,
		y: (e.clientY + t.clientY) / 2 - n.top - n.height / 2
	}), x = i((e) => {
		if (n && (p.current.set(e.pointerId, e), p.current.size === 2)) {
			let [e, n] = [...p.current.values()];
			m.current = y(e, n), h.current = r === "fit" ? (c ?? _) / 100 : o;
			let i = t.current?.getBoundingClientRect();
			i && (g.current = b(e, n, i));
		}
	}, [
		n,
		r,
		o,
		c,
		_,
		t
	]), S = i((e) => {
		if (!n || !p.current.has(e.pointerId) || (p.current.set(e.pointerId, e), p.current.size !== 2 || m.current === null)) return;
		let [i, a] = [...p.current.values()], s = y(i, a);
		if (s === 0) return;
		let l = s / m.current, u = h.current, x = u * l, S = Math.min(_ / 100, u), C = Math.max(v * 4 / 100, u * 4);
		x = Math.max(S, Math.min(C, x));
		let w = t.current?.getBoundingClientRect(), T = w ? b(i, a, w) : g.current ?? {
			x: 0,
			y: 0
		};
		f(r === "fit" ? (c ?? _) / 100 : o, x, T.x, T.y), d(x * 100);
	}, [
		n,
		r,
		o,
		c,
		_,
		v,
		f,
		d,
		t
	]), C = i((e) => {
		p.current.delete(e.pointerId), p.current.size < 2 && (m.current = null, g.current = null);
	}, []);
	a(() => {
		let e = t.current;
		if (!(!e || !n)) return e.addEventListener("pointerdown", x), e.addEventListener("pointermove", S), e.addEventListener("pointerup", C), e.addEventListener("pointercancel", C), () => {
			e.removeEventListener("pointerdown", x), e.removeEventListener("pointermove", S), e.removeEventListener("pointerup", C), e.removeEventListener("pointercancel", C);
		};
	}, [
		t,
		n,
		x,
		S,
		C
	]), a(() => {
		n || (p.current.clear(), m.current = null);
	}, [n]);
}
//#endregion
//#region src/components/ImagePreview/flushSyncCompat.ts
var vi = (() => {
	let e = m.flushSync;
	return typeof e == "function" ? e : (e) => {
		e();
	};
})();
//#endregion
//#region src/components/ImagePreview/useWheelZoom.ts
function yi(e) {
	let { containerRef: t, enabled: n, mode: r, currentScale: o, fitEquivalentNativePercent: c, zoomIn: u, zoomOut: d, peekZoomIn: f, peekZoomOut: p, zoomAnchorTranslate: m } = e, h = l(o);
	s(() => {
		h.current = o;
	}, [o]);
	let g = l(0), _ = l(null), v = l(() => !1), y = l({
		x: 0,
		y: 0
	}), b = l(0);
	a(() => () => {
		_.current !== null && (cancelAnimationFrame(_.current), _.current = null);
	}, []);
	let x = i((e) => {
		if (!n) return;
		e.preventDefault(), y.current = {
			x: e.clientX,
			y: e.clientY
		};
		let i = performance.now(), a = i - b.current;
		b.current = i;
		let o = r === "fit", s = 0, l = (e) => {
			if (o && e && s >= 1) return g.current = 0, !1;
			let n = e ? f(c) : p(c);
			if (n === null) return g.current = 0, !1;
			let r = t.current?.getBoundingClientRect(), { x: i, y: a } = y.current, l = r ? i - r.left - r.width / 2 : 0, _ = r ? a - r.top - r.height / 2 : 0, v = h.current, b = n.mode === "fit" ? (c ?? n.percent) / 100 : n.percent / 100;
			return vi(() => {
				m(v, b, l, _), h.current = b, e ? u(c) : d(c);
			}), o && e && s++, !0;
		};
		if (e.deltaMode === WheelEvent.DOM_DELTA_LINE && e.deltaY !== 0) {
			let t = Math.min(10, Math.max(1, Math.round(Math.abs(e.deltaY)))), n = e.deltaY < 0;
			for (let e = 0; e < t && l(n); e++);
			return;
		}
		if (e.deltaMode === WheelEvent.DOM_DELTA_PIXEL) {
			let t = Math.abs(e.deltaY);
			if (t >= 16 && t <= 220 && e.deltaY !== 0) {
				g.current = 0, l(e.deltaY < 0);
				return;
			}
			if (e.deltaY !== 0 && t >= 2 && t < 16 && a >= 90) {
				g.current = 0, l(e.deltaY < 0);
				return;
			}
		}
		let x = e.deltaMode === WheelEvent.DOM_DELTA_PAGE ? e.deltaY * 600 : e.deltaY;
		g.current += x, v.current = () => {
			let e = g.current;
			if (Math.abs(e) < 3) return !1;
			let t = e < 0;
			return t && e > -3 || !t && e < 3 || !l(t) ? !1 : (g.current += t ? 3 : -3, !0);
		};
		let S = () => {
			let e = 0;
			for (; e < 10 && v.current();) e++;
		};
		S();
		let C = () => {
			Math.abs(g.current) < 3 || _.current === null && (_.current = requestAnimationFrame(() => {
				_.current = null, S(), C();
			}));
		};
		C();
	}, [
		n,
		r,
		c,
		u,
		d,
		f,
		p,
		m,
		t
	]);
	a(() => {
		let e = t.current;
		if (e) return e.addEventListener("wheel", x, { passive: !1 }), () => e.removeEventListener("wheel", x);
	}, [t, x]);
}
//#endregion
//#region src/components/ImagePreview/useZoomState.ts
function bi(e, t) {
	return t.includes(e) ? e : t.reduce((t, n) => Math.abs(n - e) < Math.abs(t - e) ? n : t);
}
function xi(e) {
	let { stops: t, initialMode: n, initialNativePercent: r, firstZoomInStrategy: a, zoomOutBelowMinBehaviour: o, zoomInAtMaxBehaviour: s, onZoomChange: c, onMaxStopReached: d } = e, f = [...t].sort((e, t) => e - t), p = f[0], m = f[f.length - 1], h = f.length > 1 ? m / f[f.length - 2] : 1.25, g = i((e) => {
		let t = f.find((t) => t > e);
		return t === void 0 ? Math.max(e + 1, Math.round(e * h)) : t;
	}, [f, h]), _ = i((e) => {
		if (e > m) {
			let t = e / h;
			if (t > m) return Math.round(t);
		}
		return [...f].reverse().find((t) => t < e);
	}, [
		f,
		m,
		h
	]), v = () => r === void 0 ? p : bi(r, f), [y, b] = u(n), [x, S] = u(v), C = l({
		mode: y,
		nativePercent: x
	}), w = i((e, t, n) => {
		c?.({
			mode: e,
			nativePercent: t,
			fitEquivalentNativePercent: n
		});
	}, [c]), T = i(() => {
		C.current = {
			...C.current,
			mode: "fit"
		}, b("fit"), w("fit", C.current.nativePercent);
	}, [w]), E = i((e) => {
		C.current = {
			mode: "native",
			nativePercent: e
		}, b("native"), S(e), w("native", e);
	}, [w]), D = i((e) => {
		let { mode: t, nativePercent: n } = C.current;
		if (t === "fit") {
			let t = e ?? 0, n;
			n = t >= m ? g(t) : a === "hundred" ? bi(100, f) : a === "first-stop" ? p : f.find((e) => e > t) ?? m, C.current = {
				mode: "native",
				nativePercent: n
			}, b("native"), S(n), w("native", n, e);
			return;
		}
		let r = g(n);
		n === m && s === "notify" && d?.(), C.current = {
			mode: "native",
			nativePercent: r
		}, S(r), w("native", r, e);
	}, [
		f,
		p,
		m,
		g,
		a,
		s,
		d,
		w
	]), O = i((e) => {
		let { mode: t, nativePercent: n } = C.current, r = _(t === "fit" ? e ?? 0 : n);
		if (r === void 0 || r < p) {
			o === "fit" && t !== "fit" && (C.current = {
				mode: "fit",
				nativePercent: n
			}, b("fit"), w("fit", n, e));
			return;
		}
		C.current = {
			mode: "native",
			nativePercent: r
		}, b("native"), S(r), w("native", r, e);
	}, [
		p,
		_,
		o,
		w
	]), k = i((e) => {
		let { mode: t, nativePercent: n } = C.current;
		if (t === "fit") {
			let t = e ?? 0, n;
			return n = t >= m ? g(t) : a === "hundred" ? bi(100, f) : a === "first-stop" ? p : f.find((e) => e > t) ?? m, {
				mode: "native",
				percent: n
			};
		}
		return {
			mode: "native",
			percent: g(n)
		};
	}, [
		f,
		p,
		m,
		g,
		a
	]), A = i((e) => {
		let { mode: t, nativePercent: n } = C.current, r = _(t === "fit" ? e ?? 0 : n);
		return r === void 0 || r < p ? o === "fit" && t !== "fit" ? {
			mode: "fit",
			percent: n
		} : null : {
			mode: "native",
			percent: r
		};
	}, [
		p,
		_,
		o
	]);
	return {
		mode: y,
		nativePercent: x,
		zoomIn: D,
		zoomOut: O,
		fit: T,
		setNative: E,
		reset: i(() => {
			C.current = {
				mode: n,
				nativePercent: v()
			}, b(n), S(C.current.nativePercent);
		}, [n, r]),
		getState: i((e) => ({
			mode: C.current.mode,
			nativePercent: C.current.nativePercent,
			fitEquivalentNativePercent: e
		}), []),
		peekZoomIn: k,
		peekZoomOut: A
	};
}
//#endregion
//#region src/components/ImagePreview/shell/ImagePreviewInner.tsx
function Si(e) {
	let t = Number(e?.width), n = Number(e?.height);
	if (t > 0 && n > 0) return {
		width: t,
		height: n
	};
}
function Ci(e, t) {
	return e === t || !!e && !!t && e.phase === t.phase && e.targetLod === t.targetLod && e.progress === t.progress && e.loadedBytes === t.loadedBytes && e.totalBytes === t.totalBytes && e.textureBytes === t.textureBytes && e.textureWidth === t.textureWidth && e.textureHeight === t.textureHeight;
}
function wi(e, t) {
	let n = Object.keys(e), r = Object.keys(t);
	return n.length === r.length && r.every((n) => {
		let r = Number(n);
		return Ci(e[r], t[r]);
	});
}
var Ti = [
	5,
	10,
	20,
	35,
	50,
	75,
	100,
	125,
	150,
	175,
	200
];
q("rip-spin", "@keyframes _rip_spin{to{transform:rotate(360deg)}}");
function Ei(e, t, n, r, i, a, o, s, c, l) {
	if (n <= 0 || r <= 0 || i <= 0 || a <= 0 || o <= 0) return !1;
	let u = e - i / 2 - s, d = t - a / 2 - c, f = l * Math.PI / 180, p = Math.cos(f), m = Math.sin(f), h = u * p + d * m, g = -u * m + d * p;
	return Math.abs(h) <= n * o / 2 && Math.abs(g) <= r * o / 2;
}
var Di = n(function(e, t) {
	let { stops: n = Ti, initialMode: r = "fit", initialNativePercent: m, fitMaxNativePercent: h, firstZoomInStrategy: g = "above-fit", zoomOutBelowMinBehaviour: _ = "noop", zoomInAtMaxBehaviour: b = "noop", wheelEnabled: S = !0, doubleClickEnabled: C = !0, pinchEnabled: w = !0, switchImageResetZoom: T = !0, switchImageResetTransform: E = !0, fitResetPan: D = !0, defaultIndex: O = 0, showFlip: k = !1, showExif: A = !1, initialExifOpen: j = !1, showDelete: M = !1, arrows: N = "both", initialZoomLocked: ee = !1, showMinimap: P = !0, showThumbnails: F = !1, thumbnailsScope: te = "group", fullscreen: I, onFullscreenError: L, onThumbnailVisibleIndexesChange: ne, presentation: R = "overlay", shiftArrowAction: oe = "pan", preloadRadius: se = "auto", preloadMaxCount: le = 128, holdRepeatDelayMs: ue = 300, holdMinVisibleMs: de = 200, fullResolutionSettleMs: z, rasterFullDecodeMaxBytes: B, preloadMemoryBudgetBytes: fe, rasterDecodeWorkers: pe, rasterDecodeWorkerMax: me, onPreloadIndexesChange: he, onPreloadStatusChange: ge, onRasterPreloadPlanChange: _e, onRasterRendererStateChange: ve, showThumbnailPreloadStatus: V = !1, showSwitchLoader: ye = !0, chrome: be = "default", progressiveMain: xe = !0, onMainImageLoadStageChange: Se, closeOnMaskClick: Ce = !1, overlayClassName: De, overlayStyle: Oe, language: H, strings: ke, index: Ae, toolbarExtra: je, onClose: Me, onZoomChange: Ne, onIndexChange: Pe, onMaxStopReached: Fe, onImageError: Ie, errorFallback: Le, onDeleteImage: Re } = e, ze = R === "contained", Be = Ae !== void 0, Ve = be === "minimal" ? 0 : .1, He = be === "minimal" ? 0 : .12, U = c(() => si(oi(H), ke), [H, ke]), Ue = c(() => ie(H), [H]), We = c(() => ae(H), [H]), { images: W, groupSlices: G } = c(() => y(e), [
		e.groupedImages,
		e.images,
		e.source,
		e.src,
		e.kind,
		e.mimeType,
		e.alt,
		e.minimapSource,
		e.minimapSrc,
		e.minimap,
		e.exif
	]), K = Array.isArray(G) && G.length > 0, Ge = N === "both" || N === "side", Ke = K || N === "both" || N === "toolbar", Je = c(() => [...n].sort((e, t) => e - t), [n]), [q, Ye] = u(() => K && e.defaultGroupedSelection && e.groupedImages?.length ? v(e.groupedImages, e.defaultGroupedSelection) : Ae === void 0 ? O : Ae), Xe = l(q), Ze = l(1), Qe = q === Xe.current ? Ze.current : q > Xe.current ? 1 : -1;
	s(() => {
		q !== Xe.current && (Ze.current = q > Xe.current ? 1 : -1, Xe.current = q);
	}, [q]), a(() => {
		Ae !== void 0 && Ye(Ae);
	}, [Ae]);
	let [$e, et] = u(ee), [tt, nt] = u(j && A), [rt, it] = u(!1), [at, st] = u(!1), ct = l(null), lt = xi({
		stops: Je,
		initialMode: r,
		initialNativePercent: m,
		firstZoomInStrategy: g,
		zoomOutBelowMinBehaviour: _,
		zoomInAtMaxBehaviour: b,
		onZoomChange: Ne,
		onMaxStopReached: Fe
	}), { mode: ut, nativePercent: dt, zoomIn: ft, zoomOut: J, fit: mt, setNative: ht, reset: gt, peekZoomIn: _t, peekZoomOut: vt } = lt, { transform: Y, isPanning: yt, fitEquivalentNativePercent: bt, setContainerEl: xt, onImageLoad: St, onPanStart: Ct, onPanMove: wt, onPanEnd: Tt, resetPan: Et, rotateCW: Dt, rotateCCW: Ot, flipHorizontal: kt, flipVertical: At, resetOrientation: jt, imageDims: X, containerSize: Z, zoomAnchorTranslate: Mt, panByDelta: Nt, panJumpToNatural: Pt } = gi({
		mode: ut,
		nativePercent: dt,
		fitResetPan: D,
		fitMaxScale: pi(h)
	}), [It] = u(() => new Lt()), Rt = l(ni("raster")), zt = c(() => ({
		execute(e) {
			let t = Rt.current;
			switch (e.type) {
				case "zoom-in":
					if (!t.zoom) break;
					ft(bt);
					break;
				case "zoom-out":
					if (!t.zoom) break;
					J(bt);
					break;
				case "set-native":
					if (!t.nativeZoom) break;
					ht(e.percent);
					break;
				case "fit":
					if (!t.zoom) break;
					mt();
					break;
				case "reset":
					gt(), Et(), jt();
					break;
				case "pan-by":
					if (!t.pan) break;
					Nt(e.dx, e.dy);
					break;
				case "pan-to-natural":
					if (!t.pan) break;
					Pt(e.x, e.y);
					break;
				case "rotate-cw":
					if (!t.rotate) break;
					Dt();
					break;
				case "rotate-ccw":
					if (!t.rotate) break;
					Ot();
					break;
				case "flip-horizontal":
					if (!t.flip) break;
					kt();
					break;
				case "flip-vertical":
					if (!t.flip) break;
					At();
					break;
			}
		},
		getCapabilities: () => Rt.current,
		getViewState: () => ({
			zoomMode: ut,
			zoomPercent: ut === "fit" ? bt : dt,
			fitEquivalentNativePercent: bt,
			canZoomIn: !0,
			canZoomOut: ut === "native" ? dt > Je[0] : (bt ?? 0) > Je[0],
			rotation: Y.rotation,
			flipH: Y.flipH,
			flipV: Y.flipV,
			isPanned: Y.translateX !== 0 || Y.translateY !== 0,
			minimapGeometry: X && Z ? {
				naturalWidth: X.naturalWidth,
				naturalHeight: X.naturalHeight,
				viewportWidth: Z.width,
				viewportHeight: Z.height,
				scale: Y.scale,
				translateX: Y.translateX,
				translateY: Y.translateY,
				rotation: Y.rotation,
				flipH: Y.flipH,
				flipV: Y.flipV
			} : void 0
		})
	}), [
		ft,
		J,
		mt,
		ht,
		gt,
		Et,
		jt,
		Nt,
		Pt,
		Dt,
		Ot,
		kt,
		At,
		ut,
		dt,
		Je,
		bt,
		Y,
		X,
		Z
	]);
	s(() => It.attach(zt), [It, zt]);
	let Q = i((e) => {
		It.execute(e);
	}, [It]), Bt = i(() => Q({ type: "zoom-in" }), [Q]), Vt = i(() => Q({ type: "zoom-out" }), [Q]), Ht = i(() => Q({ type: "fit" }), [Q]), Ut = i((e) => Q({
		type: "set-native",
		percent: e
	}), [Q]), Wt = i(() => Q({ type: "rotate-cw" }), [Q]), Gt = i(() => Q({ type: "rotate-ccw" }), [Q]), Kt = i(() => Q({ type: "flip-horizontal" }), [Q]), qt = i(() => Q({ type: "flip-vertical" }), [Q]), Jt = i((e, t) => Q({
		type: "pan-by",
		dx: e,
		dy: t
	}), [Q]), $ = W[q] ?? W[0], Yt = c(() => $.source ?? {
		type: "url",
		href: $.src
	}, [$.source, $.src]), Xt = Yt.type === "url" ? Yt.href : $.src, Zt = nn({
		source: Yt,
		kind: $.kind,
		mimeType: $.mimeType,
		href: Xt,
		fileName: $.name
	}), Qt = Zt.kind, $t = ni(Qt);
	s(() => {
		Rt.current = $t;
	}, [$t]);
	let en = c(() => xe ? $.minimapSource ?? ($.minimapSrc ? {
		type: "url",
		href: $.minimapSrc
	} : void 0) : void 0, [
		$.minimapSource,
		$.minimapSrc,
		xe
	]), tn = c(() => en ? dn(Si($.exif), B).status === "blocked" : !1, [
		en,
		$.exif,
		B
	]), [rn, an] = u({}), on = c(() => se === 0 || le <= 0 ? [] : gn({
		images: W,
		currentIndex: q,
		direction: Qe,
		range: se,
		maxCount: le,
		allowPreviewSource: xe
	}).map((e) => ({
		...e,
		knownSize: e.knownSize ?? rn[e.resourceKey]
	})), [
		se,
		le,
		q,
		W,
		Qe,
		rn,
		xe
	]), sn = c(() => {
		let e = /* @__PURE__ */ new Map();
		return e.set($.id ?? $.src, q), on.forEach((t) => {
			t.flatIndex != null && e.set(t.resourceKey, t.flatIndex);
		}), e;
	}, [
		$.id,
		$.src,
		q,
		on
	]), [cn, ln] = u({}), un = i((e, t, n) => {
		e.flatIndex != null && ln((r) => {
			let i = t === "loading" ? {
				...r[e.flatIndex],
				phase: "loading",
				targetLod: n
			} : t === "display-ready" ? {
				...r[e.flatIndex],
				phase: "display-ready",
				progress: 1
			} : t === "browse-ready" ? {
				...r[e.flatIndex],
				phase: "browse-ready",
				progress: 1
			} : t === "evicted" ? {
				phase: "warm",
				progress: 1
			} : {
				phase: "error",
				progress: 0
			};
			return Ci(r[e.flatIndex], i) ? r : {
				...r,
				[e.flatIndex]: i
			};
		});
	}, []), fn = i((e) => {
		an((t) => {
			let n = !1, r = { ...t };
			return e.residentTextures.forEach((e) => {
				let i = t[e.resourceKey];
				i?.width === e.naturalWidth && i.height === e.naturalHeight || (r[e.resourceKey] = {
					width: e.naturalWidth,
					height: e.naturalHeight
				}, n = !0);
			}), n ? r : t;
		});
		let t = /* @__PURE__ */ new Map();
		e.residentTextures.forEach((e) => {
			t.set(e.resourceKey, [...t.get(e.resourceKey) ?? [], e]);
		}), ln((n) => {
			let r = {};
			return t.forEach((e, t) => {
				let n = sn.get(t);
				if (n == null) return;
				let i = e.reduce((e, t) => !e || t.bytes > e.bytes ? t : e, void 0);
				r[n] = {
					phase: e.some((e) => e.quality === "display" || e.quality === "full") ? "display-ready" : "browse-ready",
					progress: 1,
					textureBytes: e.reduce((e, t) => e + t.bytes, 0),
					textureWidth: i?.width,
					textureHeight: i?.height
				};
			}), Object.entries(e.downloads).forEach(([e, t]) => {
				let i = sn.get(e);
				if (!(i == null || r[i])) if (t.complete) {
					let e = n[i]?.phase === "loading" ? n[i]?.targetLod : void 0;
					r[i] = {
						phase: e ? "loading" : "warm",
						progress: 1,
						loadedBytes: t.loadedBytes,
						totalBytes: t.totalBytes,
						targetLod: e
					};
				} else r[i] = {
					phase: "loading",
					progress: t.progress,
					loadedBytes: t.loadedBytes,
					totalBytes: t.totalBytes,
					targetLod: n[i]?.targetLod
				};
			}), Object.entries(n).forEach(([e, t]) => {
				let n = Number(e);
				!r[n] && t.phase === "error" && (r[n] = t);
			}), wi(n, r) ? n : r;
		});
	}, [sn]), pn = cn;
	a(() => {
		he?.(on.map((e) => e.flatIndex).filter((e) => e != null));
	}, [he, on]);
	let [mn, hn] = u("idle"), _n = `${q}:${$.id ?? $.src}`, [vn, yn] = u(null);
	s(() => {
		let e = Number($.exif?.width), t = Number($.exif?.height);
		Number.isFinite(e) && Number.isFinite(t) && e > 1 && t > 1 && St({
			naturalWidth: e,
			naturalHeight: t
		});
	}, [
		$.src,
		$.exif?.width,
		$.exif?.height,
		St
	]);
	let bn = c(() => ri(G, q), [G, q]), xn = bn?.group ?? null, Sn = bn?.groupIdx ?? -1, Cn = i((e) => {
		if (W.length === 0) return;
		let t = Math.max(0, Math.min(W.length - 1, e));
		t !== q && (Be || Ye(t), st(!1), Pe?.(t), T && !$e && gt(), Et(), E && jt());
	}, [
		W,
		q,
		Be,
		Pe,
		gt,
		Et,
		jt,
		T,
		E,
		$e
	]), wn = i(() => {
		q > 0 && Cn(q - 1);
	}, [q, Cn]), Tn = i(() => {
		q < W.length - 1 && Cn(q + 1);
	}, [
		q,
		W.length,
		Cn
	]), En = i(() => {
		G && Sn > 0 && Cn(G[Sn - 1].start);
	}, [
		G,
		Sn,
		Cn
	]), Dn = i(() => {
		G && Sn < G.length - 1 && Cn(G[Sn + 1].start);
	}, [
		G,
		Sn,
		Cn
	]);
	a(() => {
		if (W.length !== 0 && q > W.length - 1) {
			let e = W.length - 1;
			Be || Ye(e), Pe?.(e);
		}
	}, [
		W.length,
		q,
		Pe,
		Be
	]);
	let On = pn;
	a(() => {
		ge?.(On);
	}, [On, ge]);
	let kn = i(() => {
		let e = W[q];
		if (!e) return;
		let t = W.length <= 1, n = t ? null : q < W.length - 1 ? q : q - 1;
		if (Re?.(q, e), t) {
			Me?.();
			return;
		}
		n != null && n !== q && Cn(n);
	}, [
		W,
		q,
		Re,
		Me,
		Cn
	]), An = c(() => Z ? Math.min(Z.width, Z.height) * re : 0, [Z]), [jn, Mn] = u(!0), Nn = l(null), Pn = i(() => {
		Mn(!0), Nn.current !== null && clearTimeout(Nn.current), Nn.current = setTimeout(() => Mn(!1), 3e3);
	}, []);
	a(() => (Pn(), () => {
		Nn.current !== null && clearTimeout(Nn.current);
	}), [Pn]), yi({
		containerRef: ct,
		enabled: S,
		mode: ut,
		currentScale: Y.scale,
		fitEquivalentNativePercent: bt,
		zoomIn: ft,
		zoomOut: J,
		peekZoomIn: _t,
		peekZoomOut: vt,
		zoomAnchorTranslate: Mt
	}), _i({
		containerRef: ct,
		enabled: w,
		mode: ut,
		currentScale: Y.scale,
		stops: Je,
		fitEquivalentNativePercent: bt,
		fit: mt,
		setNative: ht,
		zoomAnchorTranslate: Mt
	});
	let [Fn, In] = u(!ze), [Ln, Rn] = u(!1), zn = l(!1), Bn = i(() => {
		let e = ct.current;
		return !!e && document.fullscreenElement === e;
	}, []), Vn = i(() => {
		zn.current || Rn(Bn());
	}, [Bn]);
	a(() => {
		if (!I) return Vn(), document.addEventListener("fullscreenchange", Vn), () => document.removeEventListener("fullscreenchange", Vn);
	}, [I, Vn]);
	let Hn = i((e) => {
		let t = () => {};
		return {
			confirmation: new Promise((n) => {
				let r = !1, i = (e) => {
					r || (r = !0, document.removeEventListener("fullscreenchange", a), window.clearTimeout(o), n(e));
				}, a = () => {
					i(Bn() === e);
				}, o = window.setTimeout(() => i(!1), 500);
				t = () => i(!1), document.addEventListener("fullscreenchange", a);
			}),
			cancel: t
		};
	}, [Bn]), Un = i(() => I ? I.isFullscreen : Bn(), [I, Bn]), Wn = i(async () => {
		if (zn.current) return !1;
		if (zn.current = !0, I) try {
			return await I.enter(), !0;
		} catch (e) {
			return L?.(e), !1;
		} finally {
			zn.current = !1;
		}
		let e = ct.current;
		if (!e || typeof e.requestFullscreen != "function" || typeof document.exitFullscreen != "function") return L?.(/* @__PURE__ */ Error("Browser Fullscreen API is not available for this preview.")), zn.current = !1, !1;
		let { confirmation: t, cancel: n } = Hn(!0);
		try {
			await e.requestFullscreen();
			let n = await t;
			return n ? Rn(!0) : L?.(/* @__PURE__ */ Error("Browser fullscreen state did not change after the request.")), n;
		} catch (e) {
			return n(), L?.(e), !1;
		} finally {
			zn.current = !1;
		}
	}, [
		I,
		L,
		Hn
	]), Gn = i(async () => {
		if (zn.current) return;
		if (zn.current = !0, I) {
			try {
				await I.exit();
			} catch (e) {
				L?.(e);
			} finally {
				zn.current = !1;
			}
			return;
		}
		if (!document.fullscreenElement) {
			zn.current = !1;
			return;
		}
		if (typeof document.exitFullscreen != "function") {
			L?.(/* @__PURE__ */ Error("Browser Fullscreen API cannot exit fullscreen.")), zn.current = !1;
			return;
		}
		let { confirmation: e, cancel: t } = Hn(!1);
		try {
			await document.exitFullscreen(), await e ? Rn(!1) : L?.(/* @__PURE__ */ Error("Browser fullscreen state did not change after the exit request."));
		} catch (e) {
			t(), L?.(e);
		} finally {
			zn.current = !1;
		}
	}, [
		I,
		L,
		Hn
	]), Kn = i(() => {
		Un() ? Gn() : Wn();
	}, [
		Un,
		Gn,
		Wn
	]), qn = l(!1), { beginHold: Jn, endHold: Yn, holdingDirection: Xn } = di({
		currentIndex: q,
		thumbReady: vn === _n,
		prev: wn,
		next: Tn,
		repeatDelayMs: ue,
		minVisibleMs: de
	});
	ui({
		resetHideTimer: Pn,
		onClose: Me,
		zoomIn: Bt,
		zoomOut: Vt,
		fit: Ht,
		setNative: Ut,
		mode: ut,
		prev: wn,
		next: Tn,
		prevGroup: En,
		nextGroup: Dn,
		rotateCW: Wt,
		rotateCCW: Gt,
		panByDelta: Jt,
		keyboardPanStepPx: An,
		shiftArrowAction: oe,
		fitEquivalentNativePercent: bt,
		onDeleteImage: M ? kn : void 0,
		keyboardActive: ze ? Fn : !0,
		isFullscreen: Un,
		exitFullscreen: Gn,
		beginNavHold: Jn,
		endNavHold: Yn
	});
	let Zn = i(() => {
		C && (ut === "fit" ? Ut(100) : Ht());
	}, [
		C,
		ut,
		Ht,
		Ut
	]);
	a(() => {
		ze || ct.current?.focus();
	}, [ze]), a(() => {
		if (!ze) {
			In(!0);
			return;
		}
		let e = ct.current;
		if (!e) return;
		let t = () => In(!0), n = (t) => {
			let n = t.relatedTarget;
			n && e.contains(n) || In(!1);
		};
		return e.addEventListener("focusin", t), e.addEventListener("focusout", n), In(e.contains(document.activeElement)), () => {
			e.removeEventListener("focusin", t), e.removeEventListener("focusout", n);
		};
	}, [ze]), o(t, () => ({
		zoomIn: Bt,
		zoomOut: Vt,
		fit: Ht,
		setNative: Ut,
		rotateCW: Wt,
		rotateCCW: Gt,
		flipHorizontal: Kt,
		flipVertical: qt,
		next: Tn,
		prev: wn,
		nextGroup: Dn,
		prevGroup: En,
		goTo: Cn,
		requestFullscreen: Wn,
		exitFullscreen: Gn,
		isFullscreen: Un,
		getState: () => lt.getState(bt)
	}), [
		Bt,
		Vt,
		Ht,
		Ut,
		Wt,
		Gt,
		Kt,
		qt,
		Tn,
		wn,
		Dn,
		En,
		Cn,
		Wn,
		Gn,
		Un,
		lt,
		bt
	]);
	let Qn = ut === "native" && dt <= Je[0], $n = ut === "native" && dt >= Je[Je.length - 1], er = mn === "loading" || mn === "preview-ready" || mn === "restoring", [tr, nr] = u(!1);
	a(() => {
		if (!er) {
			nr(!1);
			return;
		}
		let e = setTimeout(() => nr(!0), 300);
		return () => clearTimeout(e);
	}, [er]);
	let rr = ye && tr, ir = xn && G ? {
		groupCurrentIndex: q - xn.start + 1,
		groupTotal: xn.end - xn.start + 1,
		hasPrevGroup: Sn > 0,
		hasNextGroup: Sn < G.length - 1,
		groupName: xn.name,
		groupOrdinal: Sn + 1,
		groupCount: G.length,
		onPrevGroup: En,
		onNextGroup: Dn
	} : {}, ar = F, or = te === "flat" ? 0 : xn?.start ?? 0, sr = te === "flat" ? W.length - 1 : xn?.end ?? W.length - 1, cr = c(() => {
		if (!ar || W.length <= 1 || sr - or < 1) return [];
		let e = [];
		for (let t = or; t <= sr; t++) e.push({
			flatIndex: t,
			item: W[t]
		});
		return e;
	}, [
		ar,
		W,
		or,
		sr
	]), lr = ce(cr.length);
	return /* @__PURE__ */ f("div", {
		ref: ct,
		role: ze ? "region" : "dialog",
		"aria-modal": ze ? void 0 : "true",
		"aria-label": U.imagePreview,
		tabIndex: -1,
		className: De,
		style: {
			position: ze ? "absolute" : "fixed",
			inset: 0,
			zIndex: ze ? 1 : 9999,
			background: "rgba(10, 12, 20, 0.70)",
			backdropFilter: "blur(24px) saturate(160%)",
			WebkitBackdropFilter: "blur(24px) saturate(160%)",
			display: "flex",
			alignItems: "center",
			justifyContent: "center",
			outline: "none",
			...Oe
		},
		onClick: (e) => {
			Ce && e.target === e.currentTarget && Me?.();
		},
		onMouseMove: Pn,
		onMouseDown: (e) => {
			Pn(), ze && e.currentTarget.focus({ preventScroll: !0 });
		},
		children: /* @__PURE__ */ p("div", {
			ref: xt,
			onClick: (e) => {
				Ce && e.target === e.currentTarget && Me?.();
			},
			style: {
				position: "relative",
				width: "100%",
				height: "100%",
				overflow: "hidden"
			},
			children: [
				/* @__PURE__ */ f("div", {
					"data-rip-floor": "content",
					style: {
						position: "absolute",
						inset: 0,
						overflow: "hidden",
						zIndex: 0
					},
					children: /* @__PURE__ */ f(ei, {
						resourceKey: $.id ?? $.src,
						currentFlatIndex: q,
						kind: Qt,
						kindPending: Zt.pending,
						source: Yt,
						previewSource: en,
						preloadSources: on,
						rasterPreloadEnabled: se !== 0 && le > 0,
						rasterPreloadPaused: yt || rt,
						rasterFullResolutionPaused: Xn != null,
						rasterFullResolutionSettleMs: z,
						rasterFullDecodeMaxBytes: B,
						textureBudgetBytes: fe,
						decodeWorkers: pe,
						decodeWorkerMax: me,
						onPreloadStateChange: un,
						onRasterRuntimeStateChange: fn,
						onRasterRendererStateChange: ve,
						onRasterPreloadPlanChange: _e,
						alt: $.alt ?? "",
						label: $.name ?? $.src,
						transform: Y,
						knownSize: Si($.exif),
						onDimensions: (e, t) => {
							St({
								naturalWidth: e,
								naturalHeight: t
							});
						},
						onPhaseChange: (e) => {
							hn(e), Se?.(e === "idle" ? "inactive" : e === "preview-ready" ? "thumbnail-placeholder" : e === "display-ready" ? tn ? "thumb-only" : "full-ready" : "preloading");
						},
						onPresented: () => {
							yn(_n);
						},
						onError: () => {
							st(!0), Se?.("error"), Ie?.(q, $.src);
						}
					})
				}),
				/* @__PURE__ */ f("div", {
					"data-rip-floor": "hit",
					style: {
						position: "absolute",
						inset: 0,
						zIndex: 1,
						cursor: ut === "native" ? "grab" : "zoom-in",
						touchAction: "none",
						userSelect: "none"
					},
					onPointerDown: Ct,
					onPointerMove: wt,
					onPointerUp: (e) => Tt(e),
					onPointerCancel: (e) => Tt(e),
					onLostPointerCapture: (e) => Tt(e),
					onDoubleClick: Zn,
					onClick: (e) => {
						if (!Ce) return;
						let t = e.currentTarget.getBoundingClientRect();
						X && Z && Ei(e.clientX - t.left, e.clientY - t.top, X.naturalWidth, X.naturalHeight, Z.width, Z.height, Y.scale, Y.translateX, Y.translateY, Y.rotation) || Me?.();
					}
				}),
				/* @__PURE__ */ p("div", {
					"data-rip-floor": "chrome",
					style: {
						position: "absolute",
						inset: 0,
						zIndex: 2,
						pointerEvents: "none"
					},
					children: [
						/* @__PURE__ */ f(Te, {
							onClick: () => Me?.(),
							visible: jn,
							idleOpacity: Ve,
							label: U.close,
							tip: U.tipClose
						}),
						tn && U.originalTooLargeNotice ? /* @__PURE__ */ f(Ee, { message: U.originalTooLargeNotice }) : null,
						P && $t.minimap && X && Z && /* @__PURE__ */ f(we, {
							imageSrc: $.minimapSrc ?? $.src,
							imageSource: x($),
							thumbnail: $.minimap,
							imageAlt: $.alt ?? "",
							nw: X.naturalWidth,
							nh: X.naturalHeight,
							cw: Z.width,
							ch: Z.height,
							scale: Y.scale,
							mode: ut,
							tx: Y.translateX,
							ty: Y.translateY,
							rotationDeg: Y.rotation,
							flipH: Y.flipH,
							flipV: Y.flipV,
							controlsVisible: jn,
							idleOpacity: He,
							bottomPx: 22 + lr,
							onPanByDelta: Nt,
							onJumpToNatural: Pt,
							onUserActivity: Pn,
							onDragChange: it,
							ariaLabel: U.minimapNav,
							minimapTooltip: U.tipMinimap
						}),
						(() => {
							if (!Ge) return null;
							let e = q === 0, t = q === W.length - 1;
							return /* @__PURE__ */ p(d, { children: [!e && /* @__PURE__ */ f(pt, {
								direction: "left",
								onClick: () => {
									if (qn.current) {
										qn.current = !1;
										return;
									}
									Jn("prev"), Yn("prev");
								},
								onPointerDown: (e) => {
									e.preventDefault(), qn.current = !0, e.currentTarget.setPointerCapture?.(e.pointerId), Jn("prev");
								},
								onPointerUp: () => Yn("prev"),
								onPointerCancel: () => Yn("prev"),
								label: U.prev,
								tip: U.tipPrev,
								visible: jn,
								idleOpacity: Ve
							}), !t && /* @__PURE__ */ f(pt, {
								direction: "right",
								onClick: () => {
									if (qn.current) {
										qn.current = !1;
										return;
									}
									Jn("next"), Yn("next");
								},
								onPointerDown: (e) => {
									e.preventDefault(), qn.current = !0, e.currentTarget.setPointerCapture?.(e.pointerId), Jn("next");
								},
								onPointerUp: () => Yn("next"),
								onPointerCancel: () => Yn("next"),
								label: U.next,
								tip: U.tipNext,
								visible: jn,
								idleOpacity: Ve
							})] });
						})(),
						cr.length > 0 && /* @__PURE__ */ f(ot, {
							entries: cr,
							activeFlatIndex: q,
							controlsVisible: jn,
							idleOpacity: Ve,
							preloadStatus: V ? On : void 0,
							ariaLabel: U.thumbnailsNav,
							thumbAria: U.thumbStripItem,
							onSelect: Cn,
							onUserActivity: Pn,
							onVisibleIndexesChange: ne
						}),
						A && tt && /* @__PURE__ */ f(qe, {
							exif: $.exif,
							strings: U,
							onUserActivity: Pn
						}),
						/* @__PURE__ */ f(Ft, {
							capabilities: $t,
							controlsVisible: jn,
							idleOpacity: Ve,
							bottomPx: lr + 5,
							mode: ut,
							nativePercent: dt,
							fitEquivalentNativePercent: bt,
							stops: Je,
							atMinStop: Qn,
							atMaxStop: $n,
							totalImages: W.length,
							currentIndex: q,
							imageName: $.name,
							showFlip: k,
							showExif: A,
							exifOpen: tt,
							showDelete: M,
							showFullscreen: !0,
							isFullscreen: I ? I.isFullscreen : Ln,
							toolbarExtra: je,
							showToolbarArrows: Ke,
							zoomLocked: $e,
							strings: U,
							zoomLabelSlotPx: Ue,
							zoomDropdownWidthPx: We,
							onToggleLock: () => et((e) => !e),
							onToggleExif: () => nt((e) => !e),
							onDeleteImage: kn,
							onToggleFullscreen: Kn,
							onZoomIn: Bt,
							onZoomOut: Vt,
							onFit: Ht,
							onOneToOne: () => Ut(100),
							onSetNative: Ut,
							onRotateCW: Wt,
							onRotateCCW: Gt,
							onFlipH: Kt,
							onFlipV: qt,
							onPrev: wn,
							onNext: Tn,
							...ir
						})
					]
				}),
				/* @__PURE__ */ p("div", {
					"data-rip-floor": "loading",
					"data-rip-loader": rr ? "on" : "off",
					"data-rip-media-phase": mn,
					style: {
						position: "absolute",
						inset: 0,
						pointerEvents: "none",
						zIndex: 3
					},
					children: [/* @__PURE__ */ f("div", {
						"aria-label": U.loadingImage,
						"aria-live": "polite",
						"aria-hidden": !rr,
						style: {
							position: "absolute",
							inset: 0,
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
							pointerEvents: "none",
							visibility: rr ? "visible" : "hidden",
							opacity: +!!rr,
							transition: "none"
						},
						children: /* @__PURE__ */ f("div", { style: {
							width: 36,
							height: 36,
							borderRadius: "50%",
							border: "3px solid rgba(96, 165, 250, 0.28)",
							borderTopColor: "rgba(147, 197, 253, 0.95)",
							animation: "_rip_spin 0.75s linear infinite"
						} })
					}), at && Le && /* @__PURE__ */ f("div", {
						style: {
							position: "absolute",
							inset: 0,
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
							pointerEvents: "none"
						},
						children: Le(q, $.src)
					})]
				}),
				null
			]
		})
	});
});
//#endregion
//#region src/components/ImagePreview/shell/ImagePreviewTriggerShell.tsx
function Oi(e, n) {
	let r = e.props.onClick;
	return t(e, { onClick: (t) => {
		r?.(t), !t.defaultPrevented && (e.type === "a" && t.preventDefault(), n(t));
	} });
}
var ki = n(function(t, n) {
	let { children: r, visible: a, onClose: o, onOpenChange: s, ...c } = t, l = a !== void 0, [m, h] = u(!1), g = l ? a : m, _ = i(() => {
		l || h(!0), s?.(!0);
	}, [l, s]), v = i(() => {
		l || h(!1), s?.(!1), o?.();
	}, [
		l,
		o,
		s
	]), y = Oi(e.only(r), () => {
		_();
	}), b = {
		...c,
		onClose: v
	};
	return /* @__PURE__ */ p(d, { children: [y, g ? /* @__PURE__ */ f(Di, {
		...b,
		ref: n
	}) : null] });
}), Ai = n(function(t, n) {
	let i = b(t), a = e.toArray(t.children);
	return a.length > 0 ? a.length !== 1 || !r(a[0]) || i.length === 0 ? /* @__PURE__ */ f(d, { children: t.children }) : /* @__PURE__ */ f(ki, {
		...t,
		ref: n,
		children: a[0]
	}) : !t.visible || i.length === 0 ? null : /* @__PURE__ */ f(Di, {
		...t,
		ref: n
	});
});
//#endregion
export { Ai as ImagePreview, I as NAV_HOLD_MIN_VISIBLE_MS, te as NAV_HOLD_REPEAT_DELAY_MS, an as RASTER_BROWSE_LOD_SCALE, xr as RASTER_DECODE_HEAVY_PIXEL_THRESHOLD, yr as RASTER_DECODE_WORKER_DEFAULT_MAX, br as RASTER_DECODE_WORKER_HARD_MAX, cn as RASTER_FULL_DECODE_MAX_BYTES, on as RASTER_FULL_RESOLUTION_SETTLE_MS, sn as RASTER_PREVIEW_MAX_EDGE, Mn as RASTER_SAFE_TEXTURE_EDGE_RATIO, rn as RASTER_SCREEN_LOD_OVERSAMPLE, lr as RASTER_TEXTURE_BUDGET_4K_BYTES, ur as RASTER_TEXTURE_BUDGET_ABOVE_4K_BYTES, sr as RASTER_TEXTURE_BUDGET_FHD_BYTES, or as RASTER_TEXTURE_BUDGET_HD_BYTES, cr as RASTER_TEXTURE_BUDGET_QHD_BYTES, mn as capRasterSizeToEdge, fi as computeFitScale, hr as detectRasterTextureBudgetBytes, un as fitRasterToScreenLod, _ as flattenGroupedImages, si as mergeStrings, fn as normalizeRasterFullDecodeMaxBytes, v as resolveDefaultGroupedFlatIndex, pi as resolveFitMaxScale, y as resolvePreviewImages, Sr as resolveRasterDecodeWorkerCount, dn as resolveRasterFullDecodePolicy, Nn as resolveRasterRendererRoute, oi as resolveStrings, ln as rgbaTextureBytes, pn as scaleRasterLodBox, fr as suggestRasterHardwareTextureBudgetBytes, dr as suggestRasterTextureBudgetBytes };

//# sourceMappingURL=index.mjs.map