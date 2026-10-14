import { ReactNode } from "react";

export interface StrategyInfo {
  id: string;
  label: string;
  color: string;
  description: string;
  explanation: string;
  code: string;
}

export default function StrategyModal({ strategy, onClose }: { strategy: StrategyInfo | null; onClose: () => void }) {
  if (!strategy) return null;
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)" }} />
      <div
        style={{
          position: "relative",
          width: 500,
          maxWidth: "90vw",
          maxHeight: "80vh",
          overflow: "auto",
          background: "#fff",
          borderRadius: 8,
          padding: 24,
          boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
        }}
      >
        <button
          onClick={onClose}
          style={{ position: "absolute", top: 8, right: 12, background: "none", border: "none", fontSize: 24, cursor: "pointer", color: "#999" }}
        >
          ×
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <span style={{ width: 16, height: 16, background: strategy.color, borderRadius: 3, flexShrink: 0 }} />
          <h2 style={{ margin: 0, fontSize: 20 }}>{strategy.label}</h2>
        </div>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 600, marginBottom: 4, color: "#999", fontSize: 13 }}>简述</div>
          <div style={{ fontSize: 14 }}>{strategy.description}</div>
        </div>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 600, marginBottom: 4, color: "#999", fontSize: 13 }}>原理</div>
          <div style={{ lineHeight: 1.6, color: "#444", fontSize: 13 }}>{strategy.explanation}</div>
        </div>
        <div>
          <div style={{ fontWeight: 600, marginBottom: 4, color: "#999", fontSize: 13 }}>决策逻辑</div>
          <pre
            style={{
              background: "#1e1e1e",
              color: "#d4d4d4",
              padding: 12,
              borderRadius: 4,
              fontSize: 12,
              lineHeight: 1.5,
              overflow: "auto",
              margin: 0,
            }}
          >
            {strategy.code}
          </pre>
        </div>
      </div>
    </div>
  );
}

export function LinkName({ label, onOpen, bold }: { label: string; onOpen: () => void; bold?: boolean }) {
  return (
    <span
      onClick={onOpen}
      title="点击查看详情"
      style={{
        fontWeight: bold ? 600 : 400,
        cursor: "pointer",
        textDecoration: "underline dotted",
        color: "#555",
      }}
    >
      {label}
    </span>
  );
}

export function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "8px 16px",
        background: active ? "#333" : "#eee",
        color: active ? "#fff" : "#333",
        border: "none",
        borderRadius: 4,
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}
