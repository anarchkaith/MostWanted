(() => {
  const editor = document.querySelector('#mw-report-metadata .mw-report-editor') || document.querySelector('.mw-report-editor');
  if (!editor) return;
  const grid = editor.querySelector('.mw-evidence-grid');
  const status = editor.querySelector('.mw-media-status');
  const mediaButton = editor.querySelector('.mw-select-media');
  const limit = Math.max(5, grid.children.length);
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  let nextId = 0;
  function updateEvidence() {
    mediaButton.disabled = grid.children.length >= limit;
  }
  function updateConducts(clear = false) {
    const selected = Array.from(editor.querySelectorAll('[name="mw_report_form[types][]"]:checked')).map(input => input.value);
    if (clear) editor.querySelectorAll('[name="mw_report_form[conducts][]"]').forEach(input => { input.checked = false; });
    editor.querySelectorAll('[data-category]').forEach(group => {
      group.hidden = !selected.includes(group.dataset.category);
      group.querySelectorAll('input').forEach(input => { input.disabled = group.hidden; });
    });
    const hasHistorical = editor.querySelector('[value^="legacy-"]:checked');
    editor.querySelector('.mw-behaviors').hidden = selected.length === 0 && !hasHistorical;
    const count = editor.querySelectorAll('[name="mw_report_form[conducts][]"]:checked:not(:disabled)').length;
    editor.querySelector('.mw-conduct-count').textContent = `${count} etiqueta(s) seleccionada(s)`;
  }
  const reason = editor.querySelector('#mw-reason');
  reason.addEventListener('input', () => {
    editor.querySelector('.mw-reason-count').textContent = `${Array.from(reason.value).length}/${reason.maxLength}`;
  });
  editor.addEventListener('change', event => {
    if (event.target.name === 'mw_report_form[types][]') updateConducts(true);
    if (event.target.name === 'mw_report_form[conducts][]') updateConducts();
  });
  document.addEventListener('change', event => {
    if (!event.target.matches('[name^="mw_report_votes"][name$="[delete]"]')) return;
    event.target.closest('.mw-vote')?.classList.toggle('mw-vote-deleted', event.target.checked);
  });
  editor.addEventListener('click', event => {
    if (event.target.matches('.mw-remove-evidence')) {
      event.target.closest('.mw-evidence-card').remove();
      updateEvidence();
      mediaButton.focus();
    }
    if (!event.target.matches('.mw-select-media')) return;
    if (!window.wp?.media) {
      status.textContent = 'No se pudo cargar la biblioteca. Recarga la página para seleccionar imágenes.';
      return;
    }
    const frame = window.wp.media({
      title: 'Evidencias del reporte', button: {text: 'Agregar imágenes'}, library: {type: 'image'}, multiple: true,
    });
    frame.on('select', () => {
      const errors = [];
      let added = 0;
      frame.state().get('selection').toJSON().forEach(file => {
        if (grid.children.length >= limit) { errors.push('Máximo 5 imágenes.'); return; }
        if (!allowedTypes.includes(file.mime)) { errors.push('Solo JPG, PNG, GIF o WEBP.'); return; }
        if (!Number.isFinite(file.filesizeInBytes) || file.filesizeInBytes > 5 * 1024 * 1024) {
          errors.push('La imagen supera 5 MB o no se pudo comprobar su tamaño.'); return;
        }
        if (!Number.isInteger(file.id) || !/^https?:\/\//i.test(file.url || '')) {
          errors.push('No se pudo usar el archivo seleccionado.'); return;
        }
        if (grid.querySelector(`[name$="[attachment_id]"][value="${file.id}"]`)) {
          errors.push('La imagen ya está seleccionada.'); return;
        }
        const card = document.createElement('figure');
        card.className = 'mw-evidence-card';
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = `mw_report_form[evidence][new${nextId++}][attachment_id]`;
        input.value = file.id;
        const image = document.createElement('img');
        image.src = file.url;
        image.alt = file.title || file.filename || 'Evidencia';
        image.referrerPolicy = 'no-referrer';
        const caption = document.createElement('figcaption');
        caption.textContent = image.alt;
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'button-link-delete mw-remove-evidence';
        remove.textContent = 'Quitar';
        remove.setAttribute('aria-label', `Quitar ${image.alt}`);
        card.append(input, image, caption, remove);
        grid.append(card);
        added++;
      });
      status.textContent = [...new Set(errors), ...(added ? ['Imágenes agregadas. Guarda el reporte para aplicar los cambios.'] : [])].join(' ');
      updateEvidence();
    });
    frame.open();
  });
  updateConducts();
  updateEvidence();
})();
