import React, { useState } from 'react';
import './HelpModal.css';
import Modal from './ui/Modal';

export default function HelpModal({ open, onClose }) {
  if (!open) return null;
  return (
    <Modal
      title="¿Qué es Most Wanted?"
      titleIcon={<span style={{ fontSize: '1.3rem', marginRight: 8 }} aria-hidden="true">❓</span>}
      closeLabel="Cerrar ayuda"
      onClose={onClose}
      zIndex={3000}
      maxWidth={420}
    >
      <p><b>Most Wanted</b> es el archivo comunitario de jugadores y reportes.</p>
      <ul className="cyber-ul mw-cyber-list" style={{ margin: '1rem 0 0', fontSize: '0.95em' }}>
        <li>Busca por nombre o RID, con o sin reportes previos.</li>
        <li>Consulta la ficha y aporta nuevos reportes.</li>
        <li>Abre cada reporte para ver evidencias y votar.</li>
      </ul>
      <p>Los estados los gestiona la comunidad; no representan sanciones de Rockstar. Los datos reportados pueden no estar vigentes. Los votos valoran cada reporte, no al jugador.</p>
      <p style={{ marginTop: '1.2rem', fontSize: '0.95em' }}>Visita <a href="https://kaithsrebels.com/" target="_blank" rel="noopener noreferrer">kaithsrebels.com</a> para más información y recursos.</p>
    </Modal>
  );
}
