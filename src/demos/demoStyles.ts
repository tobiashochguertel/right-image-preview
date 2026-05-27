import type { CSSProperties } from 'react';

export const cardStyle: CSSProperties = {
  background: '#12151c',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 12,
  padding: 0,
  cursor: 'pointer',
  overflow: 'hidden',
  transition: 'border-color 0.15s, transform 0.15s, box-shadow 0.15s',
  outline: 'none',
  textAlign: 'left',
  boxShadow: '0 10px 28px rgba(0,0,0,0.35)',
};

export const thumbImgStyle: CSSProperties = {
  width: '100%',
  height: 152,
  objectFit: 'cover',
  display: 'block',
};

export const thumbLabelStyle: CSSProperties = {
  padding: '7px 10px',
  fontSize: 12,
  color: '#aaa',
  background: '#161822',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};

export const gridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
  gap: 10,
};

export const sectionHeadStyle: CSSProperties = {
  fontSize: 20,
  fontWeight: 700,
  margin: '0 0 6px',
};

export const sectionDescStyle: CSSProperties = {
  margin: '0 0 16px',
  color: '#888',
  fontSize: 13,
  lineHeight: 1.6,
};

export const dividerStyle: CSSProperties = {
  border: 'none',
  borderTop: '1px solid #2a2d3a',
  margin: '44px 0',
};

export const featureGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
  gap: 16,
};

export const featureCardStyle: CSSProperties = {
  background: 'linear-gradient(165deg, rgba(26,29,39,0.95) 0%, rgba(18,21,28,0.98) 100%)',
  border: '1px solid rgba(255,255,255,0.07)',
  borderRadius: 14,
  padding: '18px 18px 16px',
  boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
};

export const codeBlockStyle: CSSProperties = {
  margin: '12px 0 0',
  padding: '14px 18px',
  borderRadius: 10,
  background: '#0c0e14',
  border: '1px solid #2a2d3a',
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, monospace',
  fontSize: 13,
  color: '#9dd4ff',
  overflowX: 'auto',
};
