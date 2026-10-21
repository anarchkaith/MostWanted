export default function DataTable({ caption, columns, rows, getRowKey, className = '' }) {
  return (
    <table className={['cyber-table cyber-style-2', className].filter(Boolean).join(' ')}>
      {caption && <caption className="sr-only">{caption}</caption>}
      <thead>
        <tr>
          {columns.map(column => <th key={column.key} scope="col">{column.header}</th>)}
        </tr>
      </thead>
      <tbody>
        {rows.map(row => (
          <tr key={getRowKey(row)}>
            {columns.map(column => (
              <td key={column.key} data-label={column.label}>{column.render(row)}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
