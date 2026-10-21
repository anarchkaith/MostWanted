import Button from './Button';

export default function Pagination({ page, pageCount, onPageChange, label = 'Páginas' }) {
  return (
    <nav className="case-pagination" aria-label={label}>
      <Button variant="secondary" glitch={false} disabled={page <= 1} onClick={() => onPageChange(page - 1)}>Anterior</Button>
      <span>{page} / {pageCount}</span>
      <Button variant="secondary" glitch={false} disabled={page >= pageCount} onClick={() => onPageChange(page + 1)}>Siguiente</Button>
    </nav>
  );
}
