export default function AdminBanner({ onDisable }) {
  return (
    <div className="admin-mode-banner">
      🔐 MODO ADMINISTRADOR ACTIVO
      <button className="admin-mode-toggle" onClick={onDisable}>
        ✕ Desactivar
      </button>
    </div>
  );
}
