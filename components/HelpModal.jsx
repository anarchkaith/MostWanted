import React, { useState } from 'react';
import './HelpModal.css';

export default function HelpModal({ open, onClose }) {
  if (!open) return null;
  return (
    <div className="modal-overlay" style={{ zIndex: 3000 }}>
      <div className="modal" style={{ maxWidth: 420 }}>
        <div className="modal__header">
          <span style={{ fontSize: '1.3rem', marginRight: 8 }}>❓</span>
          <span className="modal__title">¿Qué es Most Wanted?</span>
          <button className="modal__close" onClick={onClose} aria-label="Cerrar ayuda">✕</button>
        </div>
        <div className="modal__body">
          <p><b>Most Wanted</b> es una herramienta comunitaria de <b>Kaith's Rebels</b> para reportar, rastrear y compartir información sobre modders, griffers y tramposos en juegos online.</p>
          <ul style={{ margin: '1rem 0 0 1.2rem', fontSize: '0.95em' }}>
            <li>🔍 Busca usuarios reportados por la comunidad.</li>
            <li>📋 Consulta detalles, evidencias y estado de validación.</li>
            <li>🚨 Reporta nuevos casos y ayuda a mantener la justicia en el gaming.</li>
            <li>✅ Vota y comenta para validar reportes.</li>
          </ul>
          <p style={{ marginTop: '1.2rem', fontSize: '0.95em' }}>Visita <a href="https://kaithsrebels.com/" target="_blank" rel="noopener noreferrer">kaithsrebels.com</a> para más información y recursos.</p>
        </div>
      </div>
    </div>
  );
}
